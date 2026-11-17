"use client";

import React from "react";
import { Play, CheckCircle2 } from "lucide-react";
import { AgileIssue, AgileSprint } from "../../utils/issueEngine";
import { ScrumCopy, renderIssueTypeIcon } from "./scrumI18nAndStyles";

export interface SprintCardSectionProps {
  t: ScrumCopy;
  sprint: AgileSprint;
  sprintIssues: AgileIssue[];
  dragOverTarget: string | null;
  onSetDraggedIssueId: (id: string | null) => void;
  onSetDragOverTarget: (target: string | null) => void;
  onDropOnSprint: (targetSprintId: string) => void;
  onStartSprint: (sprint: AgileSprint) => void;
  onCompleteSprint: (sprint: AgileSprint) => void;
  onSelectIssue: (issue: AgileIssue) => void;
}

export function SprintCardSection({
  t,
  sprint,
  sprintIssues,
  dragOverTarget,
  onSetDraggedIssueId,
  onSetDragOverTarget,
  onDropOnSprint,
  onStartSprint,
  onCompleteSprint,
  onSelectIssue,
}: SprintCardSectionProps) {
  const spTotal = sprintIssues.reduce((s, i) => s + (i.storyPoints || 0), 0);
  const spDone = sprintIssues
    .filter((i) => i.status === "done")
    .reduce((s, i) => s + (i.storyPoints || 0), 0);
  const dropKey = `sprint:${sprint.id}`;
  const isOver = dragOverTarget === dropKey;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (dragOverTarget !== dropKey) onSetDragOverTarget(dropKey);
      }}
      onDragLeave={() => {
        if (dragOverTarget === dropKey) onSetDragOverTarget(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropOnSprint(sprint.id);
      }}
      style={{
        backgroundColor: isOver ? "rgba(99, 102, 241, 0.08)" : "var(--bg-panel)",
        border: isOver
          ? "1.5px dashed var(--accent-indigo)"
          : sprint.state === "active"
          ? "1px solid rgba(99, 102, 241, 0.45)"
          : "1px solid var(--border-color)",
        borderRadius: "10px",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Sprint Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700 }}>{sprint.name}</span>
            <span
              style={{
                padding: "2px 7px",
                borderRadius: "4px",
                fontSize: "10px",
                fontWeight: 700,
                backgroundColor:
                  sprint.state === "active"
                    ? "rgba(16, 185, 129, 0.16)"
                    : sprint.state === "closed"
                    ? "rgba(107, 114, 128, 0.2)"
                    : "rgba(99, 102, 241, 0.16)",
                color:
                  sprint.state === "active"
                    ? "var(--accent-green)"
                    : sprint.state === "closed"
                    ? "var(--text-muted)"
                    : "var(--accent-indigo)",
              }}
            >
              {t.sprintStates[sprint.state]}
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {sprint.startDate} → {sprint.endDate}
            </span>
          </div>
          {sprint.goal && (
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px" }}>
              {sprint.goal}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              padding: "3px 8px",
              borderRadius: "6px",
              backgroundColor: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            {spDone}/{spTotal} SP
          </span>

          {sprint.state === "planned" && (
            <button
              type="button"
              onClick={() => onStartSprint(sprint)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 10px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "var(--accent-green)",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Play size={11} />
              {t.startSprintBtn}
            </button>
          )}

          {sprint.state === "active" && (
            <button
              type="button"
              onClick={() => onCompleteSprint(sprint)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(16, 185, 129, 0.45)",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                color: "var(--accent-green)",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <CheckCircle2 size={12} />
              {t.completeSprintBtn}
            </button>
          )}
        </div>
      </div>

      {/* Sprint Issue Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {sprintIssues.length === 0 ? (
          <div
            style={{
              padding: "18px",
              textAlign: "center",
              fontSize: "12px",
              color: "var(--text-muted)",
              border: "1px dashed var(--border-color)",
              borderRadius: "8px",
            }}
          >
            {t.dropIntoSprint}
          </div>
        ) : (
          sprintIssues.map((iss) => (
            <div
              key={iss.id}
              draggable
              onDragStart={(e) => {
                onSetDraggedIssueId(iss.id);
                e.dataTransfer.setData("text/plain", iss.id);
              }}
              onDragEnd={() => {
                onSetDraggedIssueId(null);
                onSetDragOverTarget(null);
              }}
              onClick={() => onSelectIssue(iss)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                padding: "8px 12px",
                backgroundColor: "var(--bg-sidebar)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                cursor: "grab",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                {renderIssueTypeIcon(iss.type, 12)}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: "var(--accent-indigo)" }}>
                  {iss.id}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: iss.status === "done" ? "line-through" : "none",
                    color: iss.status === "done" ? "var(--text-muted)" : "var(--text-primary)",
                  }}
                >
                  {iss.title}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {iss.assignee || "—"}
                </span>
                <span
                  style={{
                    fontSize: "9px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    backgroundColor: "var(--bg-active)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  {iss.status}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: "999px",
                    backgroundColor: "rgba(99, 102, 241, 0.15)",
                    color: "var(--accent-indigo)",
                  }}
                >
                  {iss.storyPoints} SP
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
