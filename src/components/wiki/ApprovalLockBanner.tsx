"use client";

import React from "react";
import { FilePlus2, Lock, RotateCcw, ShieldAlert } from "lucide-react";
import { extractFrontmatter } from "../../utils/query/queryFrontmatterExtractor";
import {
  isDocumentWriteProtected,
  type DocumentLockReason,
} from "../../utils/wiki/documentProtection";
import type { WorkspaceFile } from "./wikiTypes";

export interface ApprovalLockBannerProps {
  file?: WorkspaceFile;
  reason?: DocumentLockReason;
  approvedBy?: string;
  revision?: string | number;
  language?: "de" | "en";
  compact?: boolean;
  onStartNewRevision?: () => void;
  onSupersedeAdr?: () => void;
}

/**
 * Reusable write-protection governance banner for both Visual and Code editor panes.
 * Explains why the document is write-locked (Approved Confluence Page or Accepted ADR)
 * and provides 1-click actions to start a new revision or supersede with a new ADR.
 */
export function ApprovalLockBanner({
  file,
  reason,
  approvedBy,
  revision,
  language = "de",
  compact = false,
  onStartNewRevision,
  onSupersedeAdr,
}: ApprovalLockBannerProps) {
  const isEn = language === "en";
  const detected = isDocumentWriteProtected(file);
  const effectiveReason: DocumentLockReason =
    reason !== undefined ? reason : detected.reason;
  const effectiveApprovedBy = approvedBy ?? detected.approvedBy;

  const detectedRevision = React.useMemo(() => {
    if (revision !== undefined) return String(revision);
    if (!file?.content) return "";
    const { frontmatter } = extractFrontmatter(file.content);
    return typeof frontmatter.revision === "string" ? frontmatter.revision : "";
  }, [file?.content, revision]);

  if (!effectiveReason) return null;

  const isAdr = effectiveReason === "accepted-adr";
  const accentColor = isAdr ? "var(--accent-indigo)" : "var(--accent-yellow)";
  const borderTint = isAdr
    ? "rgba(99, 102, 241, 0.42)"
    : "rgba(245, 158, 11, 0.42)";
  const bgTint = isAdr
    ? "rgba(99, 102, 241, 0.1)"
    : "rgba(245, 158, 11, 0.09)";

  const titleText = isAdr
    ? isEn
      ? "Write-Protected: Accepted Architecture Decision Record (ADR)"
      : "Schreibgeschützt: Akzeptierte Architekturentscheidung (ADR)"
    : isEn
      ? "Write-Protected: Approved Page"
      : "Schreibgeschützt: Freigegebene Seite";

  const descriptionText = isAdr
    ? isEn
      ? "Accepted ADRs are immutable architectural records. Create a superseding proposed ADR to revise this decision cleanly."
      : "Akzeptierte ADRs sind unveränderliche Architektur-Nachweise. Erstellen Sie einen neuen Folge-ADR, um diese Entscheidung sauber abzulösen."
    : isEn
      ? "This approved page is locked against accidental edits. Unlock a new revision to transition lifecycle status to In Review."
      : "Diese freigegebene Seite ist vor versehentlichen Änderungen geschützt. Starten Sie eine neue Revision, um sie im Status ‚In Prüfung‘ zu bearbeiten.";

  return (
    <div
      role="region"
      aria-label={titleText}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: compact ? "8px 14px" : "12px 16px",
        backgroundColor: bgTint,
        border: `1px solid ${borderTint}`,
        borderRadius: compact ? "0" : "8px",
        borderLeft: compact ? "none" : `3px solid ${accentColor}`,
        borderRight: compact ? "none" : `1px solid ${borderTint}`,
        borderTop: compact ? "none" : `1px solid ${borderTint}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1, minWidth: "240px" }}>
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            backgroundColor: isAdr ? "rgba(99, 102, 241, 0.2)" : "rgba(245, 158, 11, 0.2)",
            color: accentColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: "1px",
          }}
        >
          {isAdr ? <ShieldAlert size={15} /> : <Lock size={15} />}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)" }}>
              {titleText}
            </span>
            {effectiveApprovedBy && (
              <span
                style={{
                  fontSize: "11px",
                  padding: "1px 7px",
                  borderRadius: "999px",
                  backgroundColor: "var(--bg-sidebar)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-secondary)",
                }}
              >
                {isEn ? "By" : "Von"} {effectiveApprovedBy}
              </span>
            )}
            {detectedRevision && (
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: "4px",
                  backgroundColor: "var(--bg-sidebar)",
                  color: "var(--text-muted)",
                }}
              >
                Rev. {detectedRevision}
              </span>
            )}
          </div>
          <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
            {descriptionText}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {!isAdr && onStartNewRevision && (
          <button
            type="button"
            onClick={onStartNewRevision}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(245, 158, 11, 0.55)",
              backgroundColor: "rgba(245, 158, 11, 0.2)",
              color: "#fde68a",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={13} />
            <span>
              {isEn
                ? "Unlock as New Revision (In Review)"
                : "Als neue Revision entsperren (In Prüfung)"}
            </span>
          </button>
        )}

        {isAdr && onSupersedeAdr && (
          <button
            type="button"
            onClick={onSupersedeAdr}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(99, 102, 241, 0.55)",
              backgroundColor: "var(--accent-indigo)",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <FilePlus2 size={13} />
            <span>
              {isEn ? "Supersede with New ADR" : "Durch neuen Folge-ADR ablösen"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
