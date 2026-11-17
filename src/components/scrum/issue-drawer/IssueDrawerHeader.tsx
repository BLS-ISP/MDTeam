"use client";

import React from "react";
import {
  X,
  GitBranch,
  Trash2,
  AlertOctagon,
  ExternalLink,
  Check,
  Save,
} from "lucide-react";
import { AgileIssue } from "../../../utils/issueEngine";
import { renderIssueTypeIcon } from "../scrumI18nAndStyles";
import { IssueDrawerCopy } from "./issueDrawerI18n";

export interface IssueDrawerHeaderProps {
  draft: AgileIssue;
  isNew: boolean;
  justSaved: boolean;
  suggestedBranch: string;
  t: IssueDrawerCopy;
  onOpenMarkdownFile?: (filePath: string) => void;
  onCreateBranchClick: () => void;
  onExplicitSave: () => void;
  onDelete?: (issue: AgileIssue) => void;
  onClose: () => void;
}

export function IssueDrawerHeader({
  draft,
  isNew,
  justSaved,
  suggestedBranch,
  t,
  onOpenMarkdownFile,
  onCreateBranchClick,
  onExplicitSave,
  onDelete,
  onClose,
}: IssueDrawerHeaderProps) {
  return (
    <>
      {/* Top Action Header */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-panel)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "6px",
              backgroundColor: "var(--bg-active)",
              border: "1px solid var(--border-color)",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--accent-indigo)",
            }}
          >
            {renderIssueTypeIcon(draft.type, 14)}
            {draft.id}
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
            {isNew ? t.newIssueHeader : t.editIssueHeader}
          </span>
          {justSaved && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                color: "var(--accent-green)",
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                padding: "2px 8px",
                borderRadius: "999px",
                fontWeight: 600,
              }}
            >
              <Check size={11} /> {t.savedBadge}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {!isNew && onOpenMarkdownFile && !draft.isVirtualLegacy && (
            <button
              type="button"
              onClick={() => onOpenMarkdownFile(draft.filePath)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-sidebar)",
                color: "var(--text-secondary)",
                fontSize: "12px",
                cursor: "pointer",
              }}
              title={draft.filePath}
            >
              <ExternalLink size={13} />
              {t.openMarkdown}
            </button>
          )}

          <button
            type="button"
            onClick={onCreateBranchClick}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(99, 102, 241, 0.45)",
              backgroundColor: "rgba(99, 102, 241, 0.14)",
              color: "var(--text-primary)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title={suggestedBranch}
          >
            <GitBranch size={13} style={{ color: "var(--accent-indigo)" }} />
            {t.createBranch}
          </button>

          <button
            type="button"
            onClick={onExplicitSave}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--accent-indigo)",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Save size={13} />
            {isNew ? t.createIssueBtn : t.saveIssue}
          </button>

          {!isNew && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t.confirmDelete)) {
                  onDelete(draft);
                  onClose();
                }
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px 8px",
                borderRadius: "6px",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: "var(--accent-red)",
                cursor: "pointer",
              }}
              title={t.deleteIssue}
            >
              <Trash2 size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Blocked Alert Banner */}
      {draft.blockedBy.length > 0 && (
        <div
          style={{
            padding: "8px 20px",
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            borderBottom: "1px solid rgba(239, 68, 68, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: "var(--accent-red)",
            fontWeight: 600,
          }}
        >
          <AlertOctagon size={15} />
          <span>{t.blockedBanner}</span>
          {draft.blockedBy.map((b) => (
            <span
              key={b}
              style={{
                padding: "2px 7px",
                borderRadius: "4px",
                backgroundColor: "rgba(239, 68, 68, 0.2)",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
              }}
            >
              {b}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
