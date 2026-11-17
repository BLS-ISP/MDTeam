"use client";

import React from "react";
import { X, Plus, CheckSquare } from "lucide-react";
import { AgileIssue } from "../../../utils/issueEngine";
import { IssueDrawerCopy } from "./issueDrawerI18n";

export interface IssueAcceptanceCriteriaSectionProps {
  draft: AgileIssue;
  isNew: boolean;
  newCriterion: string;
  t: IssueDrawerCopy;
  onSetNewCriterion: (val: string) => void;
  onAddCriterion: () => void;
  onToggleCriterion: (idx: number) => void;
  onUpdateCriterionText: (idx: number, text: string) => void;
  onPersistDraftOnBlur: () => void;
  onDeleteCriterion: (idx: number) => void;
}

export function IssueAcceptanceCriteriaSection({
  draft,
  newCriterion,
  t,
  onSetNewCriterion,
  onAddCriterion,
  onToggleCriterion,
  onUpdateCriterionText,
  onPersistDraftOnBlur,
  onDeleteCriterion,
}: IssueAcceptanceCriteriaSectionProps) {
  const acDoneCount = draft.acceptanceCriteria.filter((c) => c.checked).length;
  const acTotalCount = draft.acceptanceCriteria.length;
  const acPercent = acTotalCount > 0 ? Math.round((acDoneCount / acTotalCount) * 100) : 0;

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
          <CheckSquare size={14} style={{ color: "var(--accent-green)" }} />
          {t.acceptanceCriteria}
        </label>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          {acDoneCount}/{acTotalCount} ({acPercent}%)
        </span>
      </div>

      {/* AC Progress Bar */}
      <div
        style={{
          width: "100%",
          height: "6px",
          backgroundColor: "var(--bg-panel)",
          borderRadius: "999px",
          overflow: "hidden",
          border: "1px solid var(--border-color)",
        }}
      >
        <div
          style={{
            width: `${acPercent}%`,
            height: "100%",
            backgroundColor: acPercent === 100 ? "var(--accent-green)" : "var(--accent-indigo)",
            transition: "width 0.2s ease",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {draft.acceptanceCriteria.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
            {t.noCriteria}
          </div>
        ) : (
          draft.acceptanceCriteria.map((ac, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 10px",
                backgroundColor: "var(--bg-panel)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
              }}
            >
              <input
                type="checkbox"
                checked={ac.checked}
                onChange={() => onToggleCriterion(idx)}
                style={{
                  width: "15px",
                  height: "15px",
                  accentColor: "var(--accent-green)",
                  cursor: "pointer",
                }}
              />
              <input
                type="text"
                value={ac.text}
                onChange={(e) => onUpdateCriterionText(idx, e.target.value)}
                onBlur={onPersistDraftOnBlur}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: "13px",
                  color: ac.checked ? "var(--text-muted)" : "var(--text-primary)",
                  textDecoration: ac.checked ? "line-through" : "none",
                }}
              />
              <button
                type="button"
                onClick={() => onDeleteCriterion(idx)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  padding: "2px",
                }}
              >
                <X size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add new AC item */}
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          value={newCriterion}
          placeholder={t.addCriterionPlaceholder}
          onChange={(e) => onSetNewCriterion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddCriterion();
            }
          }}
          style={{
            flex: 1,
            backgroundColor: "var(--bg-editor)",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            padding: "7px 10px",
            fontSize: "12px",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={onAddCriterion}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "7px 12px",
            borderRadius: "6px",
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-active)",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Plus size={13} /> {t.addBtn}
        </button>
      </div>
    </div>
  );
}
