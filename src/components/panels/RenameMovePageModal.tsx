"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, FolderInput, Link2, ShieldCheck, X } from "lucide-react";
import {
  collectAllFolderPaths,
  normalizeWorkspacePath,
  previewLinkRefactorImpact,
  type WorkspaceFile,
} from "../../utils/wiki/pageTreeAndRefactor";

export interface RenameMovePageModalProps {
  isOpen: boolean;
  targetFile: WorkspaceFile | null;
  files: WorkspaceFile[];
  categories: string[];
  language: "de" | "en";
  onClose: () => void;
  onConfirmRenameMove: (oldPath: string, newPath: string) => Promise<void> | void;
}

export function RenameMovePageModal({
  isOpen,
  targetFile,
  files,
  categories,
  language,
  onClose,
  onConfirmRenameMove,
}: RenameMovePageModalProps) {
  const isEn = language === "en";
  const [folderPath, setFolderPath] = useState("");
  const [fileName, setFileName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!targetFile) return;
    const clean = normalizeWorkspacePath(targetFile.path);
    const slashIdx = clean.lastIndexOf("/");
    setFolderPath(slashIdx === -1 ? targetFile.category || "wiki" : clean.slice(0, slashIdx));
    setFileName(slashIdx === -1 ? clean : clean.slice(slashIdx + 1));
    setErrorMsg("");
    setSubmitting(false);
  }, [targetFile, isOpen]);

  const availableFolders = useMemo(
    () => collectAllFolderPaths(files, categories),
    [files, categories]
  );

  const refactorImpact = useMemo(
    () => (targetFile ? previewLinkRefactorImpact(files, targetFile.path) : { totalLinks: 0, affectedFilePaths: [] }),
    [files, targetFile]
  );

  if (!isOpen || !targetFile) return null;

  const cleanFolder = normalizeWorkspacePath(folderPath);
  const rawName = fileName.trim();
  const normalizedFileName =
    rawName && !rawName.toLowerCase().endsWith(".md") && targetFile.path.toLowerCase().endsWith(".md")
      ? `${rawName}.md`
      : rawName;
  const computedNewPath = cleanFolder
    ? normalizeWorkspacePath(`${cleanFolder}/${normalizedFileName}`)
    : normalizeWorkspacePath(normalizedFileName);
  const oldCleanPath = normalizeWorkspacePath(targetFile.path);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!normalizedFileName || normalizedFileName === ".md") {
      setErrorMsg(isEn ? "Please enter a valid file name." : "Bitte einen gültigen Dateinamen eingeben.");
      return;
    }
    if (computedNewPath.includes("..") || normalizedFileName.includes("/")) {
      setErrorMsg(
        isEn
          ? "Invalid path segment. Put nested folder levels in the Target Folder field."
          : "Ungültiger Pfad. Verschachtelte Ebenen bitte im Zielordner-Feld angeben."
      );
      return;
    }
    if (computedNewPath === oldCleanPath) {
      onClose();
      return;
    }
    const collision = files.some((f) => normalizeWorkspacePath(f.path) === computedNewPath);
    if (collision) {
      setErrorMsg(
        isEn
          ? `A page already exists at "${computedNewPath}".`
          : `Unter "${computedNewPath}" existiert bereits eine Datei.`
      );
      return;
    }

    setSubmitting(true);
    try {
      await onConfirmRenameMove(targetFile.path, computedNewPath);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 220,
        padding: "16px",
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "520px",
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "10px",
          boxShadow: "var(--shadow-lg)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FolderInput size={17} style={{ color: "var(--accent-indigo)" }} />
            <h3 style={{ margin: 0, fontSize: "15px", color: "var(--text-primary)" }}>
              {isEn ? "Rename / Move Page (Link-Safe Refactor)" : "Seite umbenennen / verschieben (Link-Refactoring)"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="action-icon-btn"
            style={{ padding: "4px" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Folder selection + custom arbitrary-depth input */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label className="settings-label" style={{ marginBottom: 0 }}>
            {isEn
              ? "Target Folder / Nested Path (arbitrary depth)"
              : "Zielordner / Verschachtelter Pfad (beliebige Tiefe)"}
          </label>
          <input
            type="text"
            list="mdteam-wiki-folder-options"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="wiki/architecture/security"
            className="settings-input"
          />
          <datalist id="mdteam-wiki-folder-options">
            {availableFolders.map((dir) => (
              <option key={dir} value={dir} />
            ))}
          </datalist>
        </div>

        {/* File basename */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label className="settings-label" style={{ marginBottom: 0 }}>
            {isEn ? "Page File Name (.md)" : "Dateiname (.md)"}
          </label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="oauth-flow.md"
            className="settings-input"
            autoFocus
          />
        </div>

        {/* Path preview */}
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            backgroundColor: "var(--bg-panel)",
            border: "1px solid var(--border-color)",
            fontSize: "11.5px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>{oldCleanPath}</span>
          <ArrowRight size={13} style={{ color: "var(--accent-indigo)", flexShrink: 0 }} />
          <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>
            {computedNewPath || "..."}
          </span>
        </div>

        {/* Live Link & Transclusion Refactoring Preview */}
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            backgroundColor:
              refactorImpact.totalLinks > 0
                ? "rgba(99, 102, 241, 0.12)"
                : "rgba(16, 185, 129, 0.08)",
            border:
              refactorImpact.totalLinks > 0
                ? "1px solid rgba(99, 102, 241, 0.38)"
                : "1px solid rgba(16, 185, 129, 0.3)",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, color: "var(--text-primary)" }}>
            {refactorImpact.totalLinks > 0 ? (
              <Link2 size={14} style={{ color: "var(--accent-indigo)" }} />
            ) : (
              <ShieldCheck size={14} style={{ color: "var(--accent-green)" }} />
            )}
            <span>
              {refactorImpact.totalLinks > 0
                ? isEn
                  ? `${refactorImpact.totalLinks} link(s) & transclusion(s) will be updated automatically`
                  : `${refactorImpact.totalLinks} Verweis(e) & Transklusion(en) werden automatisch aktualisiert`
                : isEn
                  ? "0 inbound Markdown links — safe to move cleanly"
                  : "0 eingehende Verweise — sicheres Verschieben ohne Linkbruch"}
            </span>
          </div>
          {refactorImpact.affectedFilePaths.length > 0 && (
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
              {refactorImpact.affectedFilePaths.slice(0, 4).join(", ")}
              {refactorImpact.affectedFilePaths.length > 4
                ? ` +${refactorImpact.affectedFilePaths.length - 4}`
                : ""}
            </div>
          )}
        </div>

        {errorMsg && (
          <div style={{ fontSize: "12px", color: "var(--accent-red)", fontWeight: 500 }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
          <button type="button" onClick={onClose} className="git-btn git-btn-secondary">
            {isEn ? "Cancel" : "Abbrechen"}
          </button>
          <button type="submit" disabled={submitting} className="git-btn">
            <FolderInput size={14} />
            <span>
              {submitting
                ? "..."
                : isEn
                  ? `Apply & Update ${refactorImpact.totalLinks} Link(s)`
                  : `Speichern & ${refactorImpact.totalLinks} Verweis(e) anpassen`}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
