"use client";

import React, { useRef, useState, useEffect } from "react";
import { Paperclip, UploadCloud, Trash2, FileText, Eye, X } from "lucide-react";
import {
  AgileIssue,
  IssueAttachment,
  cacheAttachmentDataUrl,
  getCachedAttachmentDataUrl,
  inferMimeTypeFromName,
  removeCachedAttachmentDataUrl,
  sanitizeAttachmentFileName,
} from "../../../utils/issueEngine";
import { useWorkspaceContext } from "../../../context/WorkspaceContext";
import { IssueDrawerCopy } from "./issueDrawerI18n";

export interface IssueAttachmentsSectionProps {
  draft: AgileIssue;
  t: IssueDrawerCopy;
  onPersistIfEditing: (next: AgileIssue) => void;
}

function useOptionalTauriEnv(): { isTauri: boolean; tauriRootFolder: string } {
  try {
    const ctx = useWorkspaceContext();
    return { isTauri: ctx.isTauri, tauriRootFolder: ctx.tauriRootFolder };
  } catch {
    const hasTauriGlobal =
      typeof window !== "undefined" && (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined;
    return { isTauri: hasTauriGlobal, tauriRootFolder: "" };
  }
}

function formatFileSize(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function uint8ToBase64DataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...Array.from(slice));
  }
  const b64 = typeof btoa === "function" ? btoa(binary) : "";
  return b64 ? `data:${mimeType};base64,${b64}` : "";
}

export function IssueAttachmentsSection({
  draft,
  t,
  onPersistIfEditing,
}: IssueAttachmentsSectionProps) {
  const { isTauri, tauriRootFolder } = useOptionalTauriEnv();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<{ name: string; url: string } | null>(null);
  const [hydratedPreviews, setHydratedPreviews] = useState<Record<string, string>>({});

  const attachments = draft.attachments || [];

  // Hydrate Tauri disk image previews if missing from memory cache
  useEffect(() => {
    if (!isTauri || !tauriRootFolder) return;
    let cancelled = false;
    const missingImages = attachments.filter(
      (att) =>
        att.mimeType.startsWith("image/") &&
        !att.dataUrl &&
        !getCachedAttachmentDataUrl(att.path) &&
        !hydratedPreviews[att.path]
    );
    if (missingImages.length === 0) return;

    (async () => {
      try {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const cleanRoot = tauriRootFolder.replace(/[\\/]+$/, "");
        for (const att of missingImages) {
          if (cancelled) return;
          try {
            const bytes = await readFile(`${cleanRoot}/${att.path}`);
            const dataUrl = uint8ToBase64DataUrl(bytes, att.mimeType);
            if (dataUrl && !cancelled) {
              cacheAttachmentDataUrl(att.path, dataUrl);
              setHydratedPreviews((prev) => ({ ...prev, [att.path]: dataUrl }));
            }
          } catch {}
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [attachments, isTauri, tauriRootFolder, hydratedPreviews]);

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const cleanIssueId = (draft.id || "MDT-101").replace(/[^a-zA-Z0-9_-]/g, "");
    const nextAttachments: IssueAttachment[] = [...attachments];

    for (const file of Array.from(fileList)) {
      const safeName = sanitizeAttachmentFileName(file.name);
      const relPath = `assets/issues/${cleanIssueId}/${safeName}`;
      const mimeType = file.type || inferMimeTypeFromName(safeName);
      const nowIso = new Date().toISOString();

      let dataUrl: string | undefined;
      if (mimeType.startsWith("image/") || file.size <= 2 * 1024 * 1024) {
        try {
          dataUrl = await readFileAsDataUrl(file);
          if (dataUrl) cacheAttachmentDataUrl(relPath, dataUrl);
        } catch {}
      }

      if (isTauri && tauriRootFolder) {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const { mkdir, writeFile } = await import("@tauri-apps/plugin-fs");
          const cleanRoot = tauriRootFolder.replace(/[\\/]+$/, "");
          const targetDir = `${cleanRoot}/assets/issues/${cleanIssueId}`;
          await mkdir(targetDir, { recursive: true });
          await writeFile(`${targetDir}/${safeName}`, bytes);
        } catch (err) {
          console.error("Failed writing binary attachment via Tauri FS:", err);
        }
      }

      const existingIdx = nextAttachments.findIndex((a) => a.path === relPath);
      const item: IssueAttachment = {
        id: existingIdx >= 0 ? nextAttachments[existingIdx].id : `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: safeName,
        path: relPath,
        mimeType,
        sizeBytes: file.size,
        addedAt: nowIso,
        ...(dataUrl ? { dataUrl } : {}),
      };
      if (existingIdx >= 0) nextAttachments[existingIdx] = item;
      else nextAttachments.push(item);
    }

    onPersistIfEditing({ ...draft, attachments: nextAttachments });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteAttachment = async (att: IssueAttachment) => {
    removeCachedAttachmentDataUrl(att.path);
    if (isTauri && tauriRootFolder) {
      try {
        const { remove } = await import("@tauri-apps/plugin-fs");
        const cleanRoot = tauriRootFolder.replace(/[\\/]+$/, "");
        await remove(`${cleanRoot}/${att.path}`);
      } catch {}
    }
    const filtered = attachments.filter((a) => a.id !== att.id && a.path !== att.path);
    onPersistIfEditing({ ...draft, attachments: filtered });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: "var(--text-secondary)",
          }}
        >
          <Paperclip size={14} style={{ color: "var(--accent-yellow)" }} />
          {t.attachmentsTitle}
        </label>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          {attachments.length}
        </span>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          void handleUploadFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: "14px",
          borderRadius: "8px",
          border: dragActive
            ? "1.5px dashed var(--accent-indigo)"
            : "1px dashed var(--border-color)",
          backgroundColor: dragActive ? "rgba(99, 102, 241, 0.1)" : "var(--bg-panel)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
          cursor: "pointer",
          textAlign: "center",
        }}
      >
        <UploadCloud size={18} style={{ color: "var(--accent-indigo)" }} />
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
          {t.dropzoneTitle}
        </div>
        <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          {isTauri && tauriRootFolder
            ? `${t.dropzoneHintTauri}${draft.id}/`
            : t.dropzoneHintWeb}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.log,.txt,.json,.md,.csv,.zip"
          onChange={(e) => void handleUploadFiles(e.target.files)}
          style={{ display: "none" }}
        />
      </div>

      {/* Attachment Cards */}
      {attachments.length === 0 ? (
        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
          {t.noAttachments}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px" }}>
          {attachments.map((att) => {
            const previewUrl =
              att.dataUrl || getCachedAttachmentDataUrl(att.path) || hydratedPreviews[att.path];
            const isImage = att.mimeType.startsWith("image/");

            return (
              <div
                key={att.id || att.path}
                style={{
                  backgroundColor: "var(--bg-panel)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                {isImage && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={att.name}
                    onClick={() => setLightboxUrl({ name: att.name, url: previewUrl })}
                    style={{
                      width: "42px",
                      height: "42px",
                      objectFit: "cover",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      cursor: "zoom-in",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-sidebar)",
                      border: "1px solid var(--border-color)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <FileText size={18} style={{ color: "var(--accent-indigo)" }} />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={att.name}
                  >
                    {att.name}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={att.path}
                  >
                    {formatFileSize(att.sizeBytes) ? `${formatFileSize(att.sizeBytes)} • ` : ""}
                    {att.path}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {isImage && previewUrl && (
                    <button
                      type="button"
                      onClick={() => setLightboxUrl({ name: att.name, url: previewUrl })}
                      title={t.previewAttachment}
                      style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "3px" }}
                    >
                      <Eye size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDeleteAttachment(att)}
                    title={t.deleteAttachment}
                    style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", padding: "3px" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.82)",
            zIndex: 250,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#fff", fontSize: "13px", fontWeight: 600 }}>
            <span>{lightboxUrl.name}</span>
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: "6px", padding: "4px 8px", cursor: "pointer" }}
            >
              <X size={15} />
            </button>
          </div>
          <img
            src={lightboxUrl.url}
            alt={lightboxUrl.name}
            style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: "8px", boxShadow: "var(--shadow-lg)" }}
          />
        </div>
      )}
    </div>
  );
}
