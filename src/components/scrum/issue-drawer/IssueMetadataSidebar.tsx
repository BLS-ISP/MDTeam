"use client";

import React from "react";
import { Calendar, User, Flag } from "lucide-react";
import {
  AgileIssue,
  AgileSprint,
  IssuePriority,
  IssueStatus,
  IssueType,
  FIBONACCI_POINTS,
} from "../../../utils/issueEngine";
import { priorityColor } from "../scrumI18nAndStyles";
import { IssueDrawerCopy } from "./issueDrawerI18n";
import { IssueRelationsAndGitSection } from "./IssueRelationsAndGitSection";

export interface IssueMetadataSidebarProps {
  draft: AgileIssue;
  epics: AgileIssue[];
  sprints: AgileSprint[];
  assigneeOptions: string[];
  candidateBlockers: AgileIssue[];
  currentUser: string;
  suggestedBranch: string;
  newLabel: string;
  newBlocker: string;
  copiedBranch: boolean;
  t: IssueDrawerCopy;
  onPersistIfEditing: (next: AgileIssue) => void;
  onSetDraft: (next: AgileIssue) => void;
  onPersistDraftOnBlur: () => void;
  onSetNewLabel: (val: string) => void;
  onAddLabel: () => void;
  onRemoveLabel: (lbl: string) => void;
  onSetNewBlocker: (val: string) => void;
  onAddBlocker: (blockerIdRaw?: string) => void;
  onRemoveBlocker: (bId: string) => void;
  onCopyBranchCmd: () => void;
}

export function IssueMetadataSidebar({
  draft,
  epics,
  sprints,
  assigneeOptions,
  candidateBlockers,
  currentUser,
  suggestedBranch,
  newLabel,
  newBlocker,
  copiedBranch,
  t,
  onPersistIfEditing,
  onSetDraft,
  onPersistDraftOnBlur,
  onSetNewLabel,
  onAddLabel,
  onRemoveLabel,
  onSetNewBlocker,
  onAddBlocker,
  onRemoveBlocker,
  onCopyBranchCmd,
}: IssueMetadataSidebarProps) {
  return (
    <div
      style={{
        padding: "18px 18px",
        overflowY: "auto",
        backgroundColor: "var(--bg-panel)",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.7px",
          color: "var(--text-muted)",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "6px",
        }}
      >
        {t.properties}
      </div>

      {/* Type & Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div>
          <label className="settings-label">{t.type}</label>
          <select
            className="settings-select"
            value={draft.type}
            onChange={(e) =>
              onPersistIfEditing({ ...draft, type: e.target.value as IssueType })
            }
          >
            {(["epic", "story", "bug", "task", "spike"] as IssueType[]).map((tp) => (
              <option key={tp} value={tp}>
                {t.types[tp]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="settings-label">{t.status}</label>
          <select
            className="settings-select"
            value={draft.status}
            onChange={(e) =>
              onPersistIfEditing({ ...draft, status: e.target.value as IssueStatus })
            }
          >
            {(["backlog", "ready", "in-progress", "review", "done"] as IssueStatus[]).map((st) => (
              <option key={st} value={st}>
                {t.statuses[st]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="settings-label" style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <Flag size={11} style={{ color: priorityColor(draft.priority) }} />
          {t.priority}
        </label>
        <select
          className="settings-select"
          value={draft.priority}
          onChange={(e) =>
            onPersistIfEditing({ ...draft, priority: e.target.value as IssuePriority })
          }
        >
          {(["critical", "high", "medium", "low"] as IssuePriority[]).map((pr) => (
            <option key={pr} value={pr}>
              {t.priorities[pr]}
            </option>
          ))}
        </select>
      </div>

      {/* Fibonacci Story Points */}
      <div>
        <label className="settings-label">{t.storyPoints}</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {FIBONACCI_POINTS.map((pts) => {
            const selected = draft.storyPoints === pts;
            return (
              <button
                key={pts}
                type="button"
                onClick={() => onPersistIfEditing({ ...draft, storyPoints: pts })}
                style={{
                  minWidth: "32px",
                  height: "28px",
                  padding: "0 8px",
                  borderRadius: "6px",
                  border: selected
                    ? "1px solid var(--accent-indigo)"
                    : "1px solid var(--border-color)",
                  backgroundColor: selected
                    ? "var(--accent-indigo)"
                    : "var(--bg-sidebar)",
                  color: selected ? "#ffffff" : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                }}
              >
                {pts}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sprint & Epic */}
      <div>
        <label className="settings-label">{t.sprint}</label>
        <select
          className="settings-select"
          value={draft.sprint}
          onChange={(e) => onPersistIfEditing({ ...draft, sprint: e.target.value })}
        >
          <option value="">{t.noSprint}</option>
          {sprints.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name} ({sp.state.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {draft.type !== "epic" && (
        <div>
          <label className="settings-label">{t.epic}</label>
          <select
            className="settings-select"
            value={draft.epic}
            onChange={(e) => onPersistIfEditing({ ...draft, epic: e.target.value })}
          >
            <option value="">{t.noEpic}</option>
            {epics.map((ep) => (
              <option key={ep.id} value={ep.id}>
                {ep.id}: {ep.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Assignee & Reporter */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <label className="settings-label" style={{ marginBottom: 0 }}>
            <User size={11} style={{ display: "inline", marginRight: "4px" }} />
            {t.assignee}
          </label>
          <button
            type="button"
            onClick={() => {
              const me = currentUser
                ? currentUser.startsWith("@")
                  ? currentUser
                  : `@${currentUser}`
                : "@developer-a";
              onPersistIfEditing({ ...draft, assignee: me });
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent-indigo)",
              fontSize: "11px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {t.assignToMe}
          </button>
        </div>
        <select
          className="settings-select"
          value={draft.assignee}
          onChange={(e) => onPersistIfEditing({ ...draft, assignee: e.target.value })}
        >
          <option value="">{t.unassigned}</option>
          {assigneeOptions.map((handle) => (
            <option key={handle} value={handle}>
              {handle}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="settings-label">{t.reporter}</label>
        <input
          type="text"
          className="settings-input"
          value={draft.reporter}
          onChange={(e) => onSetDraft({ ...draft, reporter: e.target.value })}
          onBlur={onPersistDraftOnBlur}
        />
      </div>

      {/* Start / End Dates */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <div>
          <label className="settings-label">
            <Calendar size={10} style={{ display: "inline", marginRight: "4px" }} />
            {t.startDate}
          </label>
          <input
            type="date"
            className="settings-input"
            value={draft.startDate || ""}
            onChange={(e) =>
              onPersistIfEditing({ ...draft, startDate: e.target.value || undefined })
            }
          />
        </div>
        <div>
          <label className="settings-label">
            <Calendar size={10} style={{ display: "inline", marginRight: "4px" }} />
            {t.endDate}
          </label>
          <input
            type="date"
            className="settings-input"
            value={draft.endDate || ""}
            onChange={(e) =>
              onPersistIfEditing({ ...draft, endDate: e.target.value || undefined })
            }
          />
        </div>
      </div>

      <IssueRelationsAndGitSection
        draft={draft}
        candidateBlockers={candidateBlockers}
        suggestedBranch={suggestedBranch}
        newLabel={newLabel}
        newBlocker={newBlocker}
        copiedBranch={copiedBranch}
        t={t}
        onSetNewLabel={onSetNewLabel}
        onAddLabel={onAddLabel}
        onRemoveLabel={onRemoveLabel}
        onSetNewBlocker={onSetNewBlocker}
        onAddBlocker={onAddBlocker}
        onRemoveBlocker={onRemoveBlocker}
        onSetBranch={(branch) => onSetDraft({ ...draft, branch })}
        onPersistDraftOnBlur={onPersistDraftOnBlur}
        onCopyBranchCmd={onCopyBranchCmd}
      />
    </div>
  );
}
