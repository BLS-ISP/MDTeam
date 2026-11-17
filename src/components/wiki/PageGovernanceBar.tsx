"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Download,
  History,
  LayoutTemplate,
  Lock,
  MessageSquare,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useWorkspaceContext, type WorkspaceContextValue } from "../../context/WorkspaceContext";
import { exportDocumentToDocx } from "../../utils/docxExporter";
import { extractFrontmatter } from "../../utils/query/queryFrontmatterExtractor";
import {
  createSupersedingAdr,
  isDocumentWriteProtected,
  startNewDocumentRevision,
} from "../../utils/wiki/documentProtection";
import { ApprovalLockBanner } from "./ApprovalLockBanner";
import type { PageGovernanceBarProps, ReviewStatus } from "./wikiTypes";
import {
  countOpenInlineComments,
  estimateReadingStats,
  extractDocTitle,
  normalizeReviewStatus,
  recordPageSessionSnapshot,
  upsertDocumentFrontmatter,
} from "./wikiStorageUtils";

function useOptionalWorkspaceContext(): WorkspaceContextValue | null {
  try {
    return useWorkspaceContext();
  } catch {
    return null;
  }
}

const STATUS_CONFIG: Record<
  ReviewStatus,
  { labelEn: string; labelDe: string; bg: string; color: string; border: string }
> = {
  draft: { labelEn: "Draft", labelDe: "Entwurf", bg: "rgba(245, 158, 11, 0.14)", color: "var(--accent-yellow)", border: "rgba(245, 158, 11, 0.35)" },
  "in-review": { labelEn: "In Review", labelDe: "In Prüfung", bg: "rgba(99, 102, 241, 0.16)", color: "#a5b4fc", border: "rgba(99, 102, 241, 0.45)" },
  approved: { labelEn: "Approved", labelDe: "Freigegeben", bg: "rgba(16, 185, 129, 0.15)", color: "var(--accent-green)", border: "rgba(16, 185, 129, 0.4)" },
};

const ACTION_BTN_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 10px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: 500,
  backgroundColor: "var(--bg-sidebar)",
  border: "1px solid var(--border-color)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};

export function PageGovernanceBar({
  activeFile,
  files,
  currentUser,
  commentCount,
  isTauri = false,
  language = "de",
  onUpdateContent,
  onOpenComments,
  onOpenHistory,
  onOpenTemplates,
  onExportDocx,
}: PageGovernanceBarProps) {
  const isEn = language === "en";
  const workspaceCtx = useOptionalWorkspaceContext();
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportedDone, setExportedDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => recordPageSessionSnapshot(activeFile, currentUser || "@editor"), 650);
    return () => clearTimeout(timer);
  }, [activeFile.path, activeFile.content, currentUser]);

  const { frontmatter } = useMemo(() => extractFrontmatter(activeFile.content), [activeFile.content]);
  const protection = useMemo(() => isDocumentWriteProtected(activeFile), [activeFile]);

  useEffect(() => {
    const editorA = workspaceCtx?.editorRef?.current;
    if (editorA && typeof editorA.updateOptions === "function") {
      editorA.updateOptions({ readOnly: protection.locked });
    }
    return () => {
      if (editorA && typeof editorA.updateOptions === "function") {
        editorA.updateOptions({ readOnly: false });
      }
    };
  }, [protection.locked, activeFile.path, workspaceCtx?.editorMode, workspaceCtx?.editorRef]);

  const reviewStatus: ReviewStatus = useMemo(() => {
    const raw =
      (typeof frontmatter.review_status === "string" ? frontmatter.review_status : "") ||
      (typeof frontmatter.status === "string" ? frontmatter.status : "draft");
    return normalizeReviewStatus(raw);
  }, [frontmatter]);

  const approvedBy = typeof frontmatter.approved_by === "string" ? frontmatter.approved_by : "";
  const revisionNum = typeof frontmatter.revision === "string" ? frontmatter.revision : "";
  const readingStats = useMemo(() => estimateReadingStats(activeFile.content), [activeFile.content]);

  const resolvedCommentCount = useMemo(() => {
    if (typeof commentCount === "number") return commentCount;
    return files ? countOpenInlineComments(files, activeFile.path) : 0;
  }, [commentCount, files, activeFile.path]);

  const handleStartNewRevision = () => {
    const unlocked = startNewDocumentRevision(activeFile, currentUser || "@editor");
    recordPageSessionSnapshot(unlocked, currentUser, "Started new revision (In Review)");
    onUpdateContent(unlocked.content);
  };

  const handleSetReviewStatus = (nextStatus: ReviewStatus) => {
    if (reviewStatus === "approved" && nextStatus === "in-review") {
      handleStartNewRevision();
      setStatusMenuOpen(false);
      return;
    }
    const nextMarkdown = upsertDocumentFrontmatter(activeFile.content, {
      review_status: nextStatus,
      updated_at: new Date().toISOString().slice(0, 10),
      approved_by: nextStatus === "approved" ? currentUser || "@product-owner" : null,
    });
    recordPageSessionSnapshot({ ...activeFile, content: nextMarkdown }, currentUser, `Lifecycle -> ${nextStatus}`);
    onUpdateContent(nextMarkdown);
    setStatusMenuOpen(false);
  };

  const handleSupersedeAdr = async () => {
    const allFiles = files || workspaceCtx?.files || [activeFile];
    const { newAdr, updatedOldAdr } = createSupersedingAdr(activeFile, allFiles, currentUser || "@architect", language);
    recordPageSessionSnapshot(updatedOldAdr, currentUser, `Superseded by ${newAdr.name}`);
    if (workspaceCtx?.handleUpsertMultipleFiles) {
      await workspaceCtx.handleUpsertMultipleFiles([updatedOldAdr, newAdr]);
      workspaceCtx.handleOpenFile(newAdr.path);
    } else {
      onUpdateContent(updatedOldAdr.content);
    }
  };

  const handleDocxClick = async () => {
    if (onExportDocx) return onExportDocx();
    setExportingDocx(true);
    try {
      const ok = await exportDocumentToDocx(activeFile.name, extractDocTitle(activeFile), activeFile.content, isTauri);
      if (ok) {
        setExportedDone(true);
        setTimeout(() => setExportedDone(false), 2000);
      }
    } finally {
      setExportingDocx(false);
    }
  };

  const currentCfg = STATUS_CONFIG[reviewStatus];
  const isVisualPaneActive =
    workspaceCtx?.roleMode === "stakeholder"
      ? Boolean(workspaceCtx?.stakeholderEditVisual)
      : workspaceCtx?.editorMode === "visual";

  return (
    <div style={{ display: "flex", flexDirection: "column", zIndex: 20 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "6px 14px",
          backgroundColor: "var(--bg-panel)",
          borderBottom: "1px solid var(--border-color)",
          fontSize: "12px",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setStatusMenuOpen((prev) => !prev)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 10px",
                borderRadius: "999px",
                fontSize: "11.5px",
                fontWeight: 600,
                backgroundColor: currentCfg.bg,
                color: currentCfg.color,
                border: `1px solid ${currentCfg.border}`,
                cursor: "pointer",
              }}
              title={isEn ? "Change document review lifecycle status" : "Dokument-Freigabestatus ändern"}
            >
              <ShieldCheck size={13} />
              <span>{isEn ? currentCfg.labelEn : currentCfg.labelDe}</span>
              <ChevronDown size={12} />
            </button>

            {statusMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  minWidth: "185px",
                  backgroundColor: "var(--bg-sidebar)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  boxShadow: "var(--shadow-lg)",
                  padding: "4px",
                  zIndex: 60,
                }}
              >
                {(["draft", "in-review", "approved"] as ReviewStatus[]).map((st) => {
                  const cfg = STATUS_CONFIG[st];
                  const selected = reviewStatus === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleSetReviewStatus(st)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        padding: "7px 10px",
                        border: "none",
                        borderRadius: "6px",
                        backgroundColor: selected ? "var(--bg-active)" : "transparent",
                        color: cfg.color,
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span>{isEn ? cfg.labelEn : cfg.labelDe}</span>
                      {selected && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {protection.locked && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "999px",
                fontSize: "11px",
                fontWeight: 600,
                backgroundColor: "rgba(245, 158, 11, 0.14)",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                color: "var(--accent-yellow)",
              }}
            >
              <Lock size={11} />
              <span>{isEn ? "Write-Locked" : "Schreibgeschützt"}</span>
            </span>
          )}

          {revisionNum && <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>Rev. {revisionNum}</span>}

          {reviewStatus === "approved" && approvedBy && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
              <UserCheck size={13} style={{ color: "var(--accent-green)" }} />
              <span>
                {isEn ? "Approved by" : "Freigegeben von"} <strong style={{ color: "var(--text-primary)" }}>{approvedBy}</strong>
              </span>
            </span>
          )}

          <span
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--text-muted)", fontSize: "11.5px" }}
            title={`${readingStats.words} ${isEn ? "words" : "Wörter"}`}
          >
            <BookOpen size={13} />
            <span>~{readingStats.minutes} {isEn ? "min read" : "Min. Lesezeit"} ({readingStats.words} {isEn ? "words" : "Wörter"})</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onOpenComments}
            style={{
              ...ACTION_BTN_STYLE,
              borderColor: resolvedCommentCount > 0 ? "rgba(99, 102, 241, 0.5)" : "var(--border-color)",
              color: resolvedCommentCount > 0 ? "#c7d2fe" : "var(--text-secondary)",
            }}
          >
            <MessageSquare size={13} />
            <span>{isEn ? "Comments" : "Kommentare"}</span>
            <span
              style={{
                padding: "0 6px",
                borderRadius: "999px",
                fontSize: "10.5px",
                fontWeight: 700,
                backgroundColor: resolvedCommentCount > 0 ? "var(--accent-indigo)" : "var(--bg-active)",
                color: resolvedCommentCount > 0 ? "#ffffff" : "var(--text-muted)",
              }}
            >
              {resolvedCommentCount}
            </span>
          </button>

          <button type="button" onClick={onOpenHistory} style={ACTION_BTN_STYLE}>
            <History size={13} />
            <span>{isEn ? "Page History" : "Versionshistorie"}</span>
          </button>

          <button type="button" onClick={onOpenTemplates} style={ACTION_BTN_STYLE}>
            <LayoutTemplate size={13} />
            <span>{isEn ? "Templates" : "Vorlagen"}</span>
          </button>

          <button
            type="button"
            onClick={handleDocxClick}
            disabled={exportingDocx}
            style={{
              ...ACTION_BTN_STYLE,
              backgroundColor: exportedDone ? "rgba(16, 185, 129, 0.16)" : "rgba(99, 102, 241, 0.14)",
              borderColor: exportedDone ? "rgba(16, 185, 129, 0.45)" : "rgba(99, 102, 241, 0.4)",
              color: exportedDone ? "var(--accent-green)" : "#c7d2fe",
            }}
          >
            {exportedDone ? <Check size={13} /> : <Download size={13} />}
            <span>{exportedDone ? (isEn ? "DOCX Saved" : "DOCX gespeichert") : exportingDocx ? "DOCX..." : isEn ? "Export DOCX" : "DOCX Export"}</span>
          </button>
        </div>
      </div>

      {protection.locked && !isVisualPaneActive && (
        <ApprovalLockBanner
          file={activeFile}
          reason={protection.reason}
          approvedBy={protection.approvedBy}
          revision={revisionNum || undefined}
          language={language}
          compact
          onStartNewRevision={handleStartNewRevision}
          onSupersedeAdr={handleSupersedeAdr}
        />
      )}
    </div>
  );
}
