"use client";

import React, { useState } from "react";
import { ListChecks, Clock, Plus, X, RefreshCw } from "lucide-react";
import { AgileIssue, IssueSubtask } from "../../../utils/issueEngine";
import { IssueDrawerCopy } from "./issueDrawerI18n";

export interface IssueSubtasksAndTimeSectionProps {
  draft: AgileIssue;
  assigneeOptions: string[];
  currentUser: string;
  t: IssueDrawerCopy;
  onPersistIfEditing: (next: AgileIssue) => void;
  onSetDraft: (next: AgileIssue) => void;
  onPersistDraftOnBlur: () => void;
}

const S = {
  sectionHeader: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.5px", color: "var(--text-secondary)" },
  barTrack: { width: "100%", height: "6px", backgroundColor: "var(--bg-panel)", borderRadius: "999px", overflow: "hidden", border: "1px solid var(--border-color)" },
  subRow: { display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "6px", flexWrap: "wrap" as const },
  subIdBadge: { fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, color: "var(--accent-indigo)", padding: "1px 5px", borderRadius: "4px", backgroundColor: "rgba(99, 102, 241, 0.12)" },
  miniSelect: { backgroundColor: "var(--bg-sidebar)", border: "1px solid var(--border-color)", borderRadius: "4px", color: "var(--text-secondary)", fontSize: "11px", padding: "2px 4px" },
  miniHours: { width: "52px", backgroundColor: "var(--bg-sidebar)", border: "1px solid var(--border-color)", borderRadius: "4px", color: "var(--text-secondary)", fontSize: "11px", fontFamily: "var(--font-mono)", padding: "2px 5px" },
  quickLogBtn: { padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(59, 130, 246, 0.35)", backgroundColor: "rgba(59, 130, 246, 0.12)", color: "var(--accent-blue)", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, cursor: "pointer" },
};

function nextSubtaskId(subtasks: IssueSubtask[]): string {
  let maxNum = 0;
  for (const s of subtasks) {
    const m = s.id.match(/^SUB-(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  return `SUB-${maxNum + 1}`;
}

function parseNonNegInput(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : undefined;
}

export function IssueSubtasksAndTimeSection({
  draft,
  assigneeOptions,
  currentUser,
  t,
  onPersistIfEditing,
  onSetDraft,
  onPersistDraftOnBlur,
}: IssueSubtasksAndTimeSectionProps) {
  const [newSubTitle, setNewSubTitle] = useState("");
  const [newSubAssignee, setNewSubAssignee] = useState("");
  const [newSubEst, setNewSubEst] = useState("");

  const subtasks = draft.subtasks || [];
  const subDoneCount = subtasks.filter((s) => s.done).length;
  const subTotalCount = subtasks.length;
  const subPercent = subTotalCount > 0 ? Math.round((subDoneCount / subTotalCount) * 100) : 0;
  const hasSubtaskHours = subtasks.some(
    (s) => s.estimatedHours !== undefined || s.remainingHours !== undefined
  );

  const handleAddSubtask = () => {
    const cleanTitle = newSubTitle.trim();
    if (!cleanTitle) return;
    const est = parseNonNegInput(newSubEst);
    const defaultHandle =
      newSubAssignee ||
      (currentUser ? (currentUser.startsWith("@") ? currentUser : `@${currentUser}`) : undefined);
    const newItem: IssueSubtask = {
      id: nextSubtaskId(subtasks),
      title: cleanTitle,
      done: false,
      ...(defaultHandle ? { assignee: defaultHandle } : {}),
      ...(est !== undefined ? { estimatedHours: est, remainingHours: est } : {}),
    };
    setNewSubTitle("");
    setNewSubEst("");
    onPersistIfEditing({ ...draft, subtasks: [...subtasks, newItem] });
  };

  const handleToggleSubtask = (idx: number) => {
    const updated = subtasks.map((sub, i) => {
      if (i !== idx) return sub;
      const nextDone = !sub.done;
      const nextRem = nextDone
        ? sub.estimatedHours !== undefined || sub.remainingHours !== undefined
          ? 0
          : undefined
        : sub.remainingHours === 0 && sub.estimatedHours !== undefined
        ? sub.estimatedHours
        : sub.remainingHours;
      return { ...sub, done: nextDone, ...(nextRem !== undefined ? { remainingHours: nextRem } : {}) };
    });
    onPersistIfEditing({ ...draft, subtasks: updated });
  };

  const handleUpdateSubtask = (idx: number, patch: Partial<IssueSubtask>, immediate = false) => {
    const updated = subtasks.map((sub, i) => (i === idx ? { ...sub, ...patch } : sub));
    if (immediate) onPersistIfEditing({ ...draft, subtasks: updated });
    else onSetDraft({ ...draft, subtasks: updated });
  };

  const handleQuickLogHours = (delta: number) => {
    const prevLogged = draft.loggedHours ?? 0;
    const nextLogged = Number((prevLogged + delta).toFixed(2));
    const baseRem =
      draft.remainingHours ??
      (draft.estimatedHours !== undefined ? Math.max(0, draft.estimatedHours - prevLogged) : 0);
    const nextRem = Number(Math.max(0, baseRem - delta).toFixed(2));
    const nextEst = draft.estimatedHours ?? nextLogged + nextRem;
    onPersistIfEditing({ ...draft, estimatedHours: nextEst, loggedHours: nextLogged, remainingHours: nextRem });
  };

  const handleSyncFromSubtasks = () => {
    let sumEst = 0;
    let sumRem = 0;
    for (const s of subtasks) {
      sumEst += s.estimatedHours ?? s.remainingHours ?? 0;
      sumRem += s.done ? 0 : s.remainingHours ?? s.estimatedHours ?? 0;
    }
    onPersistIfEditing({
      ...draft,
      estimatedHours: Number(sumEst.toFixed(2)),
      remainingHours: Number(sumRem.toFixed(2)),
    });
  };

  const estDisplay = draft.estimatedHours ?? 0;
  const loggedDisplay = draft.loggedHours ?? 0;
  const remDisplay = draft.remainingHours ?? 0;
  const loggedPct = Math.min(100, Math.round((loggedDisplay / Math.max(estDisplay, loggedDisplay + remDisplay, 1)) * 100));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Subtasks Checklist */}
      <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={S.sectionHeader}>
            <ListChecks size={14} style={{ color: "var(--accent-indigo)" }} />
            {t.subtasksTitle}
          </label>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {subDoneCount}/{subTotalCount} ({subPercent}%)
          </span>
        </div>

        {subTotalCount > 0 && (
          <div style={S.barTrack}>
            <div style={{ width: `${subPercent}%`, height: "100%", backgroundColor: subPercent === 100 ? "var(--accent-green)" : "var(--accent-indigo)", transition: "width 0.2s ease" }} />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {subtasks.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>{t.noSubtasks}</div>
          ) : (
            subtasks.map((sub, idx) => (
              <div key={sub.id || idx} style={S.subRow}>
                <input
                  type="checkbox"
                  checked={sub.done}
                  onChange={() => handleToggleSubtask(idx)}
                  style={{ width: "15px", height: "15px", accentColor: "var(--accent-green)", cursor: "pointer" }}
                />
                <span style={S.subIdBadge}>{sub.id}</span>
                <input
                  type="text"
                  value={sub.title}
                  onChange={(e) => handleUpdateSubtask(idx, { title: e.target.value })}
                  onBlur={onPersistDraftOnBlur}
                  style={{
                    flex: "1 1 150px",
                    minWidth: "110px",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: "12.5px",
                    color: sub.done ? "var(--text-muted)" : "var(--text-primary)",
                    textDecoration: sub.done ? "line-through" : "none",
                  }}
                />
                <select
                  value={sub.assignee || ""}
                  onChange={(e) => handleUpdateSubtask(idx, { assignee: e.target.value || undefined }, true)}
                  style={S.miniSelect}
                >
                  <option value="">—</option>
                  {assigneeOptions.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="est"
                  title={t.estShort}
                  value={sub.estimatedHours ?? ""}
                  onChange={(e) => handleUpdateSubtask(idx, { estimatedHours: parseNonNegInput(e.target.value) })}
                  onBlur={onPersistDraftOnBlur}
                  style={S.miniHours}
                />
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="rem"
                  title={t.remShort}
                  value={sub.remainingHours ?? ""}
                  onChange={(e) => handleUpdateSubtask(idx, { remainingHours: parseNonNegInput(e.target.value) })}
                  onBlur={onPersistDraftOnBlur}
                  style={{ ...S.miniHours, color: "var(--accent-blue)" }}
                />
                <button
                  type="button"
                  onClick={() => onPersistIfEditing({ ...draft, subtasks: subtasks.filter((_, i) => i !== idx) })}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", display: "flex" }}
                >
                  <X size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <input
            type="text"
            value={newSubTitle}
            placeholder={t.addSubtaskPlaceholder}
            onChange={(e) => setNewSubTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSubtask();
              }
            }}
            style={{
              flex: "1 1 190px",
              backgroundColor: "var(--bg-editor)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "7px 10px",
              fontSize: "12px",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <select
            value={newSubAssignee}
            onChange={(e) => setNewSubAssignee(e.target.value)}
            style={{ ...S.miniSelect, padding: "6px 8px", borderRadius: "6px", backgroundColor: "var(--bg-editor)" }}
          >
            <option value="">{t.unassigned}</option>
            {assigneeOptions.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            step={0.5}
            value={newSubEst}
            placeholder={t.estShort}
            onChange={(e) => setNewSubEst(e.target.value)}
            style={{ ...S.miniHours, width: "72px", padding: "6px 8px", borderRadius: "6px", backgroundColor: "var(--bg-editor)", color: "var(--text-primary)" }}
          />
          <button
            type="button"
            onClick={handleAddSubtask}
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

      {/* Time Tracking Widget */}
      <div style={{ padding: "12px 14px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>
            <Clock size={14} style={{ color: "var(--accent-blue)" }} />
            {t.timeTrackingTitle}
          </span>
          {hasSubtaskHours && (
            <button
              type="button"
              onClick={handleSyncFromSubtasks}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "5px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-sidebar)", color: "var(--accent-indigo)", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
            >
              <RefreshCw size={11} /> {t.syncSubtaskHoursBtn}
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
          <div>
            <label className="settings-label" style={{ fontSize: "10px" }}>{t.estimatedHoursLabel}</label>
            <input
              type="number"
              min={0}
              step={0.5}
              className="settings-input"
              style={{ fontFamily: "var(--font-mono)" }}
              placeholder="0"
              value={draft.estimatedHours ?? ""}
              onChange={(e) => onSetDraft({ ...draft, estimatedHours: parseNonNegInput(e.target.value) })}
              onBlur={onPersistDraftOnBlur}
            />
          </div>
          <div>
            <label className="settings-label" style={{ fontSize: "10px" }}>{t.loggedHoursLabel}</label>
            <input
              type="number"
              min={0}
              step={0.5}
              className="settings-input"
              style={{ fontFamily: "var(--font-mono)" }}
              placeholder="0"
              value={draft.loggedHours ?? ""}
              onChange={(e) => onSetDraft({ ...draft, loggedHours: parseNonNegInput(e.target.value) })}
              onBlur={onPersistDraftOnBlur}
            />
          </div>
          <div>
            <label className="settings-label" style={{ fontSize: "10px" }}>{t.remainingHoursLabel}</label>
            <input
              type="number"
              min={0}
              step={0.5}
              className="settings-input"
              style={{ fontFamily: "var(--font-mono)", color: "var(--accent-blue)" }}
              placeholder="0"
              value={draft.remainingHours ?? ""}
              onChange={(e) => onSetDraft({ ...draft, remainingHours: parseNonNegInput(e.target.value) })}
              onBlur={onPersistDraftOnBlur}
            />
          </div>
        </div>

        {(estDisplay > 0 || loggedDisplay > 0 || remDisplay > 0) && (
          <div style={{ ...S.barTrack, backgroundColor: "var(--bg-sidebar)" }}>
            <div style={{ width: `${loggedPct}%`, height: "100%", backgroundColor: "var(--accent-green)", transition: "width 0.2s ease" }} />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t.quickLogLabel}</span>
          <div style={{ display: "flex", gap: "6px" }}>
            {[1, 2, 4].map((hrs) => (
              <button key={hrs} type="button" onClick={() => handleQuickLogHours(hrs)} style={S.quickLogBtn}>
                +{hrs}h
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
