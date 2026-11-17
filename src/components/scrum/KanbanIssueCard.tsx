"use client";

import React from "react";
import { AlertOctagon, GitBranch, CheckSquare, Flag, Clock, Tag } from "lucide-react";
import { AgileIssue, computeEffectiveIssueHours } from "../../utils/issueEngine";
import { renderIssueTypeIcon, priorityColor } from "./scrumI18nAndStyles";

export interface KanbanIssueCardProps {
  issue: AgileIssue;
  epics: AgileIssue[];
  draggedIssueId: string | null;
  blockedBadgeLabel: string;
  onDragStart: (issueId: string, e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onSelectIssue: (issue: AgileIssue) => void;
}

export function KanbanIssueCard({
  issue,
  epics,
  draggedIssueId,
  blockedBadgeLabel,
  onDragStart,
  onDragEnd,
  onSelectIssue,
}: KanbanIssueCardProps) {
  const isBlocked =
    issue.blockedBy.length > 0 ||
    issue.labels.some((l) => l.toLowerCase() === "blocked");
  const epicObj = issue.epic
    ? epics.find((e) => e.id.toLowerCase() === issue.epic.toLowerCase())
    : undefined;

  const acDone = issue.acceptanceCriteria.filter((a) => a.checked).length;
  const acTotal = issue.acceptanceCriteria.length;

  const subtasks = issue.subtasks || [];
  const subTotal = subtasks.length;
  const subDone = subtasks.filter((s) => s.done).length;

  const attachmentsCount = issue.attachments?.length ?? 0;
  const fixVersion = issue.fixVersion?.trim() || "";
  const effHours = computeEffectiveIssueHours(issue);
  const showRemainingHours =
    effHours.hasAnyHours &&
    (effHours.remainingHours > 0 || issue.remainingHours !== undefined);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(issue.id, e)}
      onDragEnd={onDragEnd}
      onClick={() => onSelectIssue(issue)}
      style={{
        backgroundColor: "var(--bg-sidebar)",
        border: isBlocked
          ? "1px solid rgba(239, 68, 68, 0.55)"
          : "1px solid var(--border-color)",
        borderLeft: `3px solid ${isBlocked ? "var(--accent-red)" : priorityColor(issue.priority)}`,
        borderRadius: "8px",
        padding: "11px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        cursor: "grab",
        boxShadow: "var(--shadow-sm)",
        opacity: draggedIssueId === issue.id ? 0.45 : 1,
        transition: "transform 0.12s ease, border-color 0.15s ease",
      }}
    >
      {/* Card Top Row: ID, Type, Blocked / Priority */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          {renderIssueTypeIcon(issue.type, 12)}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--text-secondary)",
            }}
          >
            {issue.id}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          {isBlocked && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                padding: "1px 6px",
                borderRadius: "4px",
                backgroundColor: "rgba(239, 68, 68, 0.18)",
                color: "var(--accent-red)",
                fontSize: "9px",
                fontWeight: 700,
              }}
              title={issue.blockedBy.join(", ")}
            >
              <AlertOctagon size={10} />
              {blockedBadgeLabel}
            </span>
          )}
          <Flag size={11} style={{ color: priorityColor(issue.priority) }} />
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: issue.status === "done" ? "var(--text-muted)" : "var(--text-primary)",
          textDecoration: issue.status === "done" ? "line-through" : "none",
          lineHeight: 1.38,
        }}
      >
        {issue.title}
      </div>

      {/* Epic, FixVersion & Labels */}
      {(epicObj || issue.epic || fixVersion || issue.labels.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {fixVersion && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                padding: "1px 6px",
                borderRadius: "4px",
                backgroundColor: "rgba(16, 185, 129, 0.14)",
                border: "1px solid rgba(16, 185, 129, 0.32)",
                color: "var(--accent-green)",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                fontWeight: 700,
              }}
              title={`FixVersion: ${fixVersion}`}
            >
              <Tag size={9} />
              {fixVersion}
            </span>
          )}
          {(epicObj || issue.epic) && (
            <span
              style={{
                padding: "1px 6px",
                borderRadius: "4px",
                backgroundColor: "rgba(168, 85, 247, 0.15)",
                color: "#c084fc",
                fontSize: "10px",
                fontWeight: 600,
                maxWidth: "170px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {epicObj ? epicObj.title : issue.epic}
            </span>
          )}
          {issue.labels.slice(0, 3).map((lbl) => (
            <span
              key={lbl}
              style={{
                padding: "1px 6px",
                borderRadius: "4px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                color: "var(--text-muted)",
                fontSize: "10px",
              }}
            >
              #{lbl}
            </span>
          ))}
        </div>
      )}

      {/* Footer: Assignee, AC, Subtasks (☑ 2/3), Attachments (📎 1), Branch, Hours (4h) & SP */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "6px",
          flexWrap: "wrap",
          marginTop: "2px",
          paddingTop: "6px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "11px",
              color: issue.assignee ? "var(--accent-indigo)" : "var(--text-muted)",
              fontWeight: 600,
            }}
          >
            {issue.assignee || "—"}
          </span>

          {acTotal > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                fontSize: "10px",
                color: acDone === acTotal ? "var(--accent-green)" : "var(--text-muted)",
                fontFamily: "var(--font-mono)",
              }}
              title="Acceptance Criteria"
            >
              <CheckSquare size={10} />
              {acDone}/{acTotal}
            </span>
          )}

          {subTotal > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "2px",
                padding: "1px 5px",
                borderRadius: "4px",
                backgroundColor:
                  subDone === subTotal
                    ? "rgba(16, 185, 129, 0.14)"
                    : "rgba(99, 102, 241, 0.12)",
                color: subDone === subTotal ? "var(--accent-green)" : "var(--text-secondary)",
                fontSize: "10px",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
              }}
              title="Subtasks"
            >
              {`☑ ${subDone}/${subTotal}`}
            </span>
          )}

          {attachmentsCount > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "2px",
                fontSize: "10px",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
              }}
              title="Attachments"
            >
              {`📎 ${attachmentsCount}`}
            </span>
          )}

          {issue.branch && (
            <span title={issue.branch} style={{ color: "var(--accent-blue)", display: "inline-flex" }}>
              <GitBranch size={11} />
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          {showRemainingHours && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                padding: "2px 6px",
                borderRadius: "999px",
                backgroundColor: "rgba(59, 130, 246, 0.14)",
                color: "var(--accent-blue)",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                fontWeight: 700,
              }}
              title={`Remaining: ${effHours.remainingHours}h (Est: ${effHours.estimatedHours}h)`}
            >
              <Clock size={9} />
              {`${effHours.remainingHours}h`}
            </span>
          )}

          <span
            style={{
              padding: "2px 7px",
              borderRadius: "999px",
              backgroundColor:
                issue.storyPoints > 0 ? "rgba(99, 102, 241, 0.16)" : "rgba(255,255,255,0.05)",
              color: issue.storyPoints > 0 ? "var(--accent-indigo)" : "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 700,
            }}
          >
            {issue.storyPoints} SP
          </span>
        </div>
      </div>
    </div>
  );
}
