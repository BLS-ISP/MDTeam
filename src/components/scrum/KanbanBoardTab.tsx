"use client";

import React, { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AgileIssue,
  AgileSprint,
  IssuePriority,
  IssueStatus,
  filterIssuesJql,
} from "../../utils/issueEngine";
import { BOARD_COLUMNS, ScrumCopy, SwimlaneMode } from "./scrumI18nAndStyles";
import { KanbanFilterBar } from "./KanbanFilterBar";
import { KanbanIssueCard } from "./KanbanIssueCard";

export interface KanbanBoardTabProps {
  t: ScrumCopy;
  allIssues: AgileIssue[];
  epics: AgileIssue[];
  sprints: AgileSprint[];
  activeSprint: AgileSprint | undefined;
  currentUser: string;
  boardScope: string;
  jqlQuery: string;
  swimlaneMode: SwimlaneMode;
  wipLimits: Record<IssueStatus, number>;
  editingWipCol: IssueStatus | null;
  draggedIssueId: string | null;
  dragOverTarget: string | null;
  onSetBoardScope: (scope: string) => void;
  onSetJqlQuery: (query: string) => void;
  onToggleQuickFilter: (token: string) => void;
  onSetSwimlaneMode: (mode: SwimlaneMode) => void;
  onSetEditingWipCol: (col: IssueStatus | null) => void;
  onWipLimitChange: (col: IssueStatus, val: number) => void;
  onSetDraggedIssueId: (id: string | null) => void;
  onSetDragOverTarget: (target: string | null) => void;
  onDropOnColumn: (targetStatus: IssueStatus) => void;
  onSelectIssue: (issue: AgileIssue) => void;
}

export function KanbanBoardTab({
  t,
  allIssues,
  epics,
  sprints,
  activeSprint,
  currentUser,
  boardScope,
  jqlQuery,
  swimlaneMode,
  wipLimits,
  editingWipCol,
  draggedIssueId,
  dragOverTarget,
  onSetBoardScope,
  onSetJqlQuery,
  onToggleQuickFilter,
  onSetSwimlaneMode,
  onSetEditingWipCol,
  onWipLimitChange,
  onSetDraggedIssueId,
  onSetDragOverTarget,
  onDropOnColumn,
  onSelectIssue,
}: KanbanBoardTabProps) {
  const boardIssues = useMemo(() => {
    let base = allIssues.filter((i) => i.type !== "epic");
    if (boardScope === "active" && activeSprint) {
      base = base.filter((i) => i.sprint.toLowerCase() === activeSprint.id.toLowerCase());
    } else if (boardScope !== "all" && boardScope !== "active") {
      base = base.filter((i) => i.sprint.toLowerCase() === boardScope.toLowerCase());
    }
    return filterIssuesJql(base, jqlQuery, currentUser);
  }, [allIssues, boardScope, activeSprint, jqlQuery, currentUser]);

  const swimlanes = useMemo(() => {
    if (swimlaneMode === "none") {
      return [{ key: "all", label: "", issues: boardIssues }];
    }
    const map = new Map<string, { key: string; label: string; issues: AgileIssue[] }>();

    if (swimlaneMode === "priority") {
      (["critical", "high", "medium", "low"] as IssuePriority[]).forEach((p) => {
        map.set(p, { key: p, label: p.toUpperCase(), issues: [] });
      });
    }

    for (const iss of boardIssues) {
      let k = "";
      let lbl = "";
      if (swimlaneMode === "assignee") {
        k = iss.assignee || "__unassigned";
        lbl = iss.assignee || t.unassigned;
      } else if (swimlaneMode === "epic") {
        k = iss.epic || "__no_epic";
        const foundEpic = epics.find((e) => e.id.toLowerCase() === iss.epic.toLowerCase());
        lbl = foundEpic ? `${foundEpic.id} — ${foundEpic.title}` : iss.epic || t.noEpic;
      } else if (swimlaneMode === "priority") {
        k = iss.priority;
        lbl = iss.priority.toUpperCase();
      }
      if (!map.has(k)) {
        map.set(k, { key: k, label: lbl, issues: [] });
      }
      map.get(k)!.issues.push(iss);
    }

    const nonEmpty = Array.from(map.values()).filter((g) => g.issues.length > 0);
    return nonEmpty.length > 0 ? nonEmpty : [{ key: "empty", label: "—", issues: [] }];
  }, [boardIssues, swimlaneMode, epics, t.unassigned, t.noEpic]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: "16px 24px",
        gap: "14px",
      }}
    >
      <KanbanFilterBar
        t={t}
        boardScope={boardScope}
        activeSprint={activeSprint}
        sprints={sprints}
        jqlQuery={jqlQuery}
        swimlaneMode={swimlaneMode}
        onSetBoardScope={onSetBoardScope}
        onSetJqlQuery={onSetJqlQuery}
        onToggleQuickFilter={onToggleQuickFilter}
        onSetSwimlaneMode={onSetSwimlaneMode}
      />

      {/* Board Columns + Swimlanes Scroll Container */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Column Headers Sticky Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(220px, 1fr))",
            gap: "12px",
            minWidth: "1140px",
          }}
        >
          {BOARD_COLUMNS.map(({ status, color }) => {
            const colIssues = boardIssues.filter((i) => i.status === status);
            const colSp = colIssues.reduce((s, i) => s + (i.storyPoints || 0), 0);
            const limit = wipLimits[status] || 0;
            const exceeded = limit > 0 && colIssues.length > limit;

            return (
              <div
                key={status}
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  backgroundColor: exceeded
                    ? "rgba(239, 68, 68, 0.12)"
                    : "var(--bg-panel)",
                  border: exceeded
                    ? "1px solid var(--accent-red)"
                    : "1px solid var(--border-color)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: exceeded ? "var(--accent-red)" : color,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: exceeded ? "var(--accent-red)" : "var(--text-primary)",
                      }}
                    >
                      {t.columns[status]}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {editingWipCol === status ? (
                      <input
                        type="number"
                        min={0}
                        autoFocus
                        value={limit}
                        onChange={(e) => onWipLimitChange(status, Number(e.target.value))}
                        onBlur={() => onSetEditingWipCol(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onSetEditingWipCol(null);
                        }}
                        style={{
                          width: "48px",
                          padding: "2px 4px",
                          fontSize: "11px",
                          backgroundColor: "var(--bg-editor)",
                          border: "1px solid var(--accent-indigo)",
                          borderRadius: "4px",
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-mono)",
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSetEditingWipCol(status)}
                        title={t.wipLimitTitle}
                        style={{
                          padding: "2px 6px",
                          borderRadius: "999px",
                          border: "none",
                          backgroundColor: exceeded
                            ? "var(--accent-red)"
                            : "rgba(255,255,255,0.06)",
                          color: exceeded ? "#ffffff" : "var(--text-secondary)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {limit > 0 ? `${colIssues.length}/${limit}` : colIssues.length}
                      </button>
                    )}

                    <span
                      style={{
                        fontSize: "10px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {colSp} SP
                    </span>
                  </div>
                </div>

                {exceeded && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "var(--accent-red)",
                    }}
                  >
                    <AlertTriangle size={11} />
                    {t.wipExceeded} ({colIssues.length} &gt; {limit})
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Swimlanes & Column Drop Zones */}
        {swimlanes.map((lane) => (
          <div key={lane.key} style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "1140px" }}>
            {swimlaneMode !== "none" && (
              <div
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  backgroundColor: "var(--bg-active)",
                  border: "1px solid var(--border-color)",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{lane.label}</span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {lane.issues.length} Tickets •{" "}
                  {lane.issues.reduce((s, i) => s + (i.storyPoints || 0), 0)} SP
                </span>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(220px, 1fr))",
                gap: "12px",
                alignItems: "stretch",
              }}
            >
              {BOARD_COLUMNS.map(({ status }) => {
                const cellKey = `${lane.key}:${status}`;
                const cellIssues = lane.issues.filter((i) => i.status === status);
                const isOver = dragOverTarget === cellKey;
                const limit = wipLimits[status] || 0;
                const totalColCount = boardIssues.filter((i) => i.status === status).length;
                const exceeded = limit > 0 && totalColCount > limit;

                return (
                  <div
                    key={cellKey}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverTarget !== cellKey) onSetDragOverTarget(cellKey);
                    }}
                    onDragLeave={() => {
                      if (dragOverTarget === cellKey) onSetDragOverTarget(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      onDropOnColumn(status);
                    }}
                    style={{
                      minHeight: swimlaneMode === "none" ? "420px" : "150px",
                      padding: "10px",
                      borderRadius: "8px",
                      backgroundColor: isOver
                        ? "rgba(99, 102, 241, 0.09)"
                        : exceeded
                        ? "rgba(239, 68, 68, 0.04)"
                        : "var(--bg-panel)",
                      border: isOver
                        ? "1.5px dashed var(--accent-indigo)"
                        : exceeded
                        ? "1px solid rgba(239, 68, 68, 0.35)"
                        : "1px solid var(--border-color)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      transition: "background-color 0.12s ease, border-color 0.12s ease",
                    }}
                  >
                    {cellIssues.map((iss) => (
                      <KanbanIssueCard
                        key={iss.id}
                        issue={iss}
                        epics={epics}
                        draggedIssueId={draggedIssueId}
                        blockedBadgeLabel={t.blockedBadge}
                        onDragStart={(issueId, e) => {
                          onSetDraggedIssueId(issueId);
                          e.dataTransfer.setData("text/plain", issueId);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          onSetDraggedIssueId(null);
                          onSetDragOverTarget(null);
                        }}
                        onSelectIssue={onSelectIssue}
                      />
                    ))}

                    {cellIssues.length === 0 && (
                      <div
                        style={{
                          flex: 1,
                          minHeight: "70px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          border: "1px dashed rgba(255,255,255,0.05)",
                          borderRadius: "6px",
                        }}
                      >
                        {t.emptyColumn}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
