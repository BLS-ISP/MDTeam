"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Download,
  History,
  LayoutTemplate,
  MessageSquare,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { exportDocumentToDocx } from "../../utils/docxExporter";
import { extractFrontmatter } from "../../utils/query/queryFrontmatterExtractor";
import type { PageGovernanceBarProps, ReviewStatus } from "./wikiTypes";
import {
  countOpenInlineComments,
  estimateReadingStats,
  extractDocTitle,
  normalizeReviewStatus,
  recordPageSessionSnapshot,
  upsertDocumentFrontmatter,
} from "./wikiStorageUtils";

/**
 * 1. <PageGovernanceBar />
 * Confluence-style document status, reading time, and action toolbar above the editor/preview.
 */
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
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportedDone, setExportedDone] = useState(false);

  // Record session snapshots automatically so PageHistoryModal always has Time Machine points
  useEffect(() => {
    const timer = setTimeout(() => {
      recordPageSessionSnapshot(activeFile, currentUser || "@editor");
    }, 650);
    return () => clearTimeout(timer);
  }, [activeFile.path, activeFile.content, currentUser]);

  const { frontmatter } = useMemo(
    () => extractFrontmatter(activeFile.content),
    [activeFile.content]
  );

  const reviewStatus: ReviewStatus = useMemo(() => {
    const raw =
      (typeof frontmatter.review_status === "string"
        ? frontmatter.review_status
        : "") ||
      (typeof frontmatter.status === "string" ? frontmatter.status : "draft");
    return normalizeReviewStatus(raw);
  }, [frontmatter]);

  const approvedBy =
    typeof frontmatter.approved_by === "string"
      ? frontmatter.approved_by
      : "";

  const readingStats = useMemo(
    () => estimateReadingStats(activeFile.content),
    [activeFile.content]
  );

  const resolvedCommentCount = useMemo(() => {
    if (typeof commentCount === "number") return commentCount;
    if (files) return countOpenInlineComments(files, activeFile.path);
    return 0;
  }, [commentCount, files, activeFile.path]);

  const handleSetReviewStatus = (nextStatus: ReviewStatus) => {
    const today = new Date().toISOString().slice(0, 10);
    const updates: Record<string, string | null> = {
      review_status: nextStatus,
      updated_at: today,
      approved_by:
        nextStatus === "approved" ? currentUser || "@product-owner" : null,
    };
    const nextMarkdown = upsertDocumentFrontmatter(activeFile.content, updates);
    recordPageSessionSnapshot(
      { ...activeFile, content: nextMarkdown },
      currentUser,
      `Lifecycle -> ${nextStatus}`
    );
    onUpdateContent(nextMarkdown);
    setStatusMenuOpen(false);
  };

  const handleDocxClick = async () => {
    if (onExportDocx) {
      onExportDocx();
      return;
    }
    setExportingDocx(true);
    try {
      const ok = await exportDocumentToDocx(
        activeFile.name,
        extractDocTitle(activeFile),
        activeFile.content,
        isTauri
      );
      if (ok) {
        setExportedDone(true);
        setTimeout(() => setExportedDone(false), 2000);
      }
    } finally {
      setExportingDocx(false);
    }
  };

  const statusConfig: Record<
    ReviewStatus,
    { labelEn: string; labelDe: string; bg: string; color: string; border: string }
  > = {
    draft: {
      labelEn: "Draft",
      labelDe: "Entwurf",
      bg: "rgba(245, 158, 11, 0.14)",
      color: "var(--accent-yellow)",
      border: "rgba(245, 158, 11, 0.35)",
    },
    "in-review": {
      labelEn: "In Review",
      labelDe: "In Prüfung",
      bg: "rgba(99, 102, 241, 0.16)",
      color: "#a5b4fc",
      border: "rgba(99, 102, 241, 0.45)",
    },
    approved: {
      labelEn: "Approved",
      labelDe: "Freigegeben",
      bg: "rgba(16, 185, 129, 0.15)",
      color: "var(--accent-green)",
      border: "rgba(16, 185, 129, 0.4)",
    },
  };

  const currentCfg = statusConfig[reviewStatus];

  const actionBtnStyle: React.CSSProperties = {
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
    transition: "all 0.15s ease",
  };

  return (
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
        zIndex: 20,
      }}
    >
      {/* Left: Governance Status Badge + Approved By + Reading Time */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
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
            title={
              isEn
                ? "Change document review lifecycle status"
                : "Dokument-Freigabestatus ändern"
            }
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
              {(["draft", "in-review", "approved"] as ReviewStatus[]).map(
                (st) => {
                  const cfg = statusConfig[st];
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
                        backgroundColor: selected
                          ? "var(--bg-active)"
                          : "transparent",
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
                }
              )}
            </div>
          )}
        </div>

        {reviewStatus === "approved" && approvedBy && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11.5px",
              color: "var(--text-secondary)",
            }}
          >
            <UserCheck size={13} style={{ color: "var(--accent-green)" }} />
            <span>
              {isEn ? "Approved by" : "Freigegeben von"}{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {approvedBy}
              </strong>
            </span>
          </span>
        )}

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            color: "var(--text-muted)",
            fontSize: "11.5px",
          }}
          title={`${readingStats.words} ${isEn ? "words" : "Wörter"}`}
        >
          <BookOpen size={13} />
          <span>
            ~{readingStats.minutes}{" "}
            {isEn ? "min read" : "Min. Lesezeit"} ({readingStats.words}{" "}
            {isEn ? "words" : "Wörter"})
          </span>
        </span>
      </div>

      {/* Right: Confluence Parity Action Buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onOpenComments}
          style={{
            ...actionBtnStyle,
            borderColor:
              resolvedCommentCount > 0
                ? "rgba(99, 102, 241, 0.5)"
                : "var(--border-color)",
            color:
              resolvedCommentCount > 0
                ? "#c7d2fe"
                : "var(--text-secondary)",
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
              backgroundColor:
                resolvedCommentCount > 0
                  ? "var(--accent-indigo)"
                  : "var(--bg-active)",
              color:
                resolvedCommentCount > 0 ? "#ffffff" : "var(--text-muted)",
            }}
          >
            {resolvedCommentCount}
          </span>
        </button>

        <button type="button" onClick={onOpenHistory} style={actionBtnStyle}>
          <History size={13} />
          <span>{isEn ? "Page History" : "Versionshistorie"}</span>
        </button>

        <button type="button" onClick={onOpenTemplates} style={actionBtnStyle}>
          <LayoutTemplate size={13} />
          <span>{isEn ? "Templates" : "Vorlagen"}</span>
        </button>

        <button
          type="button"
          onClick={handleDocxClick}
          disabled={exportingDocx}
          style={{
            ...actionBtnStyle,
            backgroundColor: exportedDone
              ? "rgba(16, 185, 129, 0.16)"
              : "rgba(99, 102, 241, 0.14)",
            borderColor: exportedDone
              ? "rgba(16, 185, 129, 0.45)"
              : "rgba(99, 102, 241, 0.4)",
            color: exportedDone ? "var(--accent-green)" : "#c7d2fe",
          }}
        >
          {exportedDone ? <Check size={13} /> : <Download size={13} />}
          <span>
            {exportedDone
              ? isEn
                ? "DOCX Saved"
                : "DOCX gespeichert"
              : exportingDocx
              ? "DOCX..."
              : isEn
              ? "Export DOCX"
              : "DOCX Export"}
          </span>
        </button>
      </div>
    </div>
  );
}
