"use client";

import React from "react";
import { X, GitBranch, Plus, Tag, AlertOctagon, Copy } from "lucide-react";
import { AgileIssue } from "../../../utils/issueEngine";
import { IssueDrawerCopy } from "./issueDrawerI18n";

export interface IssueRelationsAndGitSectionProps {
  draft: AgileIssue;
  candidateBlockers: AgileIssue[];
  suggestedBranch: string;
  newLabel: string;
  newBlocker: string;
  copiedBranch: boolean;
  t: IssueDrawerCopy;
  onSetNewLabel: (val: string) => void;
  onAddLabel: () => void;
  onRemoveLabel: (lbl: string) => void;
  onSetNewBlocker: (val: string) => void;
  onAddBlocker: (blockerIdRaw?: string) => void;
  onRemoveBlocker: (bId: string) => void;
  onSetBranch: (branch: string) => void;
  onPersistDraftOnBlur: () => void;
  onCopyBranchCmd: () => void;
}

export function IssueRelationsAndGitSection({
  draft,
  candidateBlockers,
  suggestedBranch,
  newLabel,
  newBlocker,
  copiedBranch,
  t,
  onSetNewLabel,
  onAddLabel,
  onRemoveLabel,
  onSetNewBlocker,
  onAddBlocker,
  onRemoveBlocker,
  onSetBranch,
  onPersistDraftOnBlur,
  onCopyBranchCmd,
}: IssueRelationsAndGitSectionProps) {
  return (
    <>
      {/* Labels */}
      <div>
        <label className="settings-label">
          <Tag size={11} style={{ display: "inline", marginRight: "4px" }} />
          {t.labels}
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "6px" }}>
          {draft.labels.map((lbl) => (
            <span
              key={lbl}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "999px",
                backgroundColor: "rgba(99, 102, 241, 0.14)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                color: "var(--text-primary)",
                fontSize: "11px",
              }}
            >
              #{lbl}
              <button
                type="button"
                onClick={() => onRemoveLabel(lbl)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  padding: 0,
                }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            type="text"
            className="settings-input"
            placeholder={t.addLabelPlaceholder}
            value={newLabel}
            onChange={(e) => onSetNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddLabel();
              }
            }}
          />
          <button
            type="button"
            onClick={onAddLabel}
            style={{
              padding: "0 10px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-sidebar)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* BlockedBy IDs */}
      <div>
        <label
          className="settings-label"
          style={{ color: draft.blockedBy.length > 0 ? "var(--accent-red)" : undefined }}
        >
          <AlertOctagon size={11} style={{ display: "inline", marginRight: "4px" }} />
          {t.blockedBy}
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "6px" }}>
          {draft.blockedBy.map((bId) => (
            <span
              key={bId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "4px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "var(--accent-red)",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {bId}
              <button
                type="button"
                onClick={() => onRemoveBlocker(bId)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent-red)",
                  cursor: "pointer",
                  display: "flex",
                  padding: 0,
                }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            type="text"
            list="mdteam-blocker-candidates"
            className="settings-input"
            placeholder={t.addBlockerPlaceholder}
            value={newBlocker}
            onChange={(e) => onSetNewBlocker(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddBlocker();
              }
            }}
          />
          <datalist id="mdteam-blocker-candidates">
            {candidateBlockers.map((cand) => (
              <option key={cand.id} value={cand.id}>
                {cand.title}
              </option>
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => onAddBlocker()}
            style={{
              padding: "0 10px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-sidebar)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Git Branch */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <label className="settings-label" style={{ marginBottom: 0 }}>
            <GitBranch size={11} style={{ display: "inline", marginRight: "4px" }} />
            {t.gitBranch}
          </label>
          <button
            type="button"
            onClick={onCopyBranchCmd}
            style={{
              background: "none",
              border: "none",
              color: copiedBranch ? "var(--accent-green)" : "var(--text-muted)",
              fontSize: "10px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
            }}
            title={t.copyBranchCmd}
          >
            <Copy size={10} /> {copiedBranch ? t.copied : "git checkout -b"}
          </button>
        </div>
        <input
          type="text"
          className="settings-input"
          style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}
          placeholder={suggestedBranch}
          value={draft.branch}
          onChange={(e) => onSetBranch(e.target.value)}
          onBlur={onPersistDraftOnBlur}
        />
      </div>

      {/* Audit Timestamps */}
      <div
        style={{
          marginTop: "6px",
          paddingTop: "10px",
          borderTop: "1px solid var(--border-color)",
          fontSize: "11px",
          color: "var(--text-muted)",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t.createdAt}:</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>
            {draft.createdAt.slice(0, 16).replace("T", " ")}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t.updatedAt}:</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>
            {draft.updatedAt.slice(0, 16).replace("T", " ")}
          </span>
        </div>
      </div>
    </>
  );
}
