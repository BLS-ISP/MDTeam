"use client";

import React from "react";
import { Eye, Edit3 } from "lucide-react";
import { AgileIssue } from "../../../utils/issueEngine";
import { IssueDrawerCopy } from "./issueDrawerI18n";

export interface IssueDescriptionSectionProps {
  draft: AgileIssue;
  isNew: boolean;
  descMode: "write" | "preview";
  titleError: boolean;
  t: IssueDrawerCopy;
  onSetDescMode: (mode: "write" | "preview") => void;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onPersistDraftOnBlur: () => void;
}

export function IssueDescriptionSection({
  draft,
  isNew,
  descMode,
  titleError,
  t,
  onSetDescMode,
  onTitleChange,
  onDescriptionChange,
  onPersistDraftOnBlur,
}: IssueDescriptionSectionProps) {
  return (
    <>
      {/* Title */}
      <div>
        <input
          type="text"
          value={draft.title}
          autoFocus={isNew}
          placeholder={t.titlePlaceholder}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onPersistDraftOnBlur}
          style={{
            width: "100%",
            backgroundColor: "var(--bg-editor)",
            border: `1px solid ${titleError ? "var(--accent-red)" : "var(--border-color)"}`,
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "17px",
            fontWeight: 700,
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        {titleError && (
          <div style={{ color: "var(--accent-red)", fontSize: "11px", marginTop: "4px" }}>
            {t.titleRequired}
          </div>
        )}
      </div>

      {/* Description */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "var(--text-secondary)",
            }}
          >
            {t.description}
          </label>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              type="button"
              onClick={() => onSetDescMode("write")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                borderRadius: "4px",
                border: "1px solid var(--border-color)",
                backgroundColor: descMode === "write" ? "var(--bg-active)" : "transparent",
                color: descMode === "write" ? "var(--text-primary)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              <Edit3 size={11} /> {t.writeTab}
            </button>
            <button
              type="button"
              onClick={() => onSetDescMode("preview")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                borderRadius: "4px",
                border: "1px solid var(--border-color)",
                backgroundColor: descMode === "preview" ? "var(--bg-active)" : "transparent",
                color: descMode === "preview" ? "var(--text-primary)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              <Eye size={11} /> {t.previewTab}
            </button>
          </div>
        </div>

        {descMode === "write" ? (
          <textarea
            value={draft.description}
            placeholder={t.descriptionPlaceholder}
            onChange={(e) => onDescriptionChange(e.target.value)}
            onBlur={onPersistDraftOnBlur}
            rows={6}
            style={{
              width: "100%",
              backgroundColor: "var(--bg-editor)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "13px",
              lineHeight: 1.55,
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              resize: "vertical",
              outline: "none",
            }}
          />
        ) : (
          <div
            style={{
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "12px 14px",
              fontSize: "13px",
              lineHeight: 1.6,
              color: draft.description ? "var(--text-primary)" : "var(--text-muted)",
              whiteSpace: "pre-wrap",
              minHeight: "100px",
            }}
          >
            {draft.description || t.noDescription}
          </div>
        )}
      </div>
    </>
  );
}
