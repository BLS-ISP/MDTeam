"use client";

import React from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import {
  AgileIssue,
  AgileSprint,
  SprintMetrics,
  TeamCapacityMember,
} from "../../utils/issueEngine";
import type { ScrumPolicyConfig, ScrumUserRole } from "../../types/scrumPolicy";
import { normalizeScrumRole } from "../../utils/scrum-rules/scrumPolicyEngine";
import { ScrumCopy, renderIssueTypeIcon } from "./scrumI18nAndStyles";
import { BacklogCapacityToolbar } from "./BacklogCapacityToolbar";
import { SprintCardSection } from "./SprintCardSection";

export interface BacklogPlanningTabProps {
  t: ScrumCopy;
  allIssues: AgileIssue[];
  orderedBacklogItems?: AgileIssue[];
  sprints: AgileSprint[];
  activeSprint: AgileSprint | undefined;
  activeSprintMetrics: SprintMetrics;
  capacity: TeamCapacityMember[];
  totalCapacitySp: number;
  unmigratedLegacyCount: number;
  draggedIssueId?: string | null;
  dragOverTarget: string | null;
  policy?: ScrumPolicyConfig;
  userRole?: ScrumUserRole;
  onSetDraggedIssueId: (id: string | null) => void;
  onSetDragOverTarget: (target: string | null) => void;
  onDropOnSprint: (targetSprintId: string) => void;
  onReorderBacklog?: (sourceIssueId: string, targetIssueId: string) => void;
  onConvertLegacyBacklog: () => void;
  onOpenPoker: (issueId?: string) => void;
  onCreateNewSprint: () => void;
  onStartSprint: (sprint: AgileSprint) => void;
  onCompleteSprint: (sprint: AgileSprint) => void;
  onOpenCreateIssue: (defaults?: Partial<AgileIssue>) => void;
  onSelectIssue: (issue: AgileIssue) => void;
}

export function BacklogPlanningTab({
  t,
  allIssues,
  orderedBacklogItems,
  sprints,
  activeSprint,
  activeSprintMetrics,
  capacity,
  totalCapacitySp,
  unmigratedLegacyCount,
  draggedIssueId,
  dragOverTarget,
  userRole,
  onSetDraggedIssueId,
  onSetDragOverTarget,
  onDropOnSprint,
  onReorderBacklog,
  onConvertLegacyBacklog,
  onOpenPoker,
  onCreateNewSprint,
  onStartSprint,
  onCompleteSprint,
  onOpenCreateIssue,
  onSelectIssue,
}: BacklogPlanningTabProps) {
  const backlogItems = orderedBacklogItems || allIssues.filter((i) => !i.sprint && i.type !== "epic");
  const isOverBacklog = dragOverTarget === "product-backlog";
  const isStakeholder = normalizeScrumRole(userRole) === "stakeholder";

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "18px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <BacklogCapacityToolbar
        t={t}
        activeSprint={activeSprint}
        activeSprintMetrics={activeSprintMetrics}
        capacity={capacity}
        totalCapacitySp={totalCapacitySp}
        unmigratedLegacyCount={unmigratedLegacyCount}
        onConvertLegacyBacklog={onConvertLegacyBacklog}
        onOpenPoker={onOpenPoker}
        onCreateNewSprint={onCreateNewSprint}
      />

      {/* Split View: Sprints (Left) vs Product Backlog (Right) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
          gap: "18px",
          alignItems: "start",
        }}
      >
        {/* Left Pane: Sprints */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.6px",
              color: "var(--text-secondary)",
            }}
          >
            {t.sprintsHeading} ({sprints.length})
          </div>

          {sprints.map((sprint) => {
            const spIssues = allIssues.filter(
              (i) => i.sprint.toLowerCase() === sprint.id.toLowerCase() && i.type !== "epic"
            );
            return (
              <SprintCardSection
                key={sprint.id}
                t={t}
                sprint={sprint}
                sprintIssues={spIssues}
                dragOverTarget={dragOverTarget}
                onSetDraggedIssueId={onSetDraggedIssueId}
                onSetDragOverTarget={onSetDragOverTarget}
                onDropOnSprint={onDropOnSprint}
                onStartSprint={onStartSprint}
                onCompleteSprint={onCompleteSprint}
                onSelectIssue={onSelectIssue}
              />
            );
          })}
        </div>

        {/* Right Pane: Product Backlog */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (dragOverTarget !== "product-backlog") onSetDragOverTarget("product-backlog");
          }}
          onDragLeave={() => {
            if (dragOverTarget === "product-backlog") onSetDragOverTarget(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            onDropOnSprint("");
          }}
          style={{
            backgroundColor: isOverBacklog ? "rgba(99, 102, 241, 0.08)" : "var(--bg-panel)",
            border: isOverBacklog
              ? "1.5px dashed var(--accent-indigo)"
              : "1px solid var(--border-color)",
            borderRadius: "10px",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            minHeight: "360px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.6px",
                color: "var(--text-secondary)",
              }}
            >
              {t.productBacklogHeading} ({backlogItems.length})
            </span>
            {!isStakeholder && (
              <button
                type="button"
                onClick={() => onOpenCreateIssue({ sprint: "" })}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-sidebar)",
                  color: "var(--text-primary)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Plus size={12} /> {t.createIssue.replace("+ ", "")}
              </button>
            )}
          </div>

          {backlogItems.length === 0 ? (
            <div
              style={{
                padding: "28px 16px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--text-muted)",
                border: "1px dashed var(--border-color)",
                borderRadius: "8px",
              }}
            >
              {t.dropIntoBacklog}
            </div>
          ) : (
            backlogItems.map((iss, idx) => (
              <div
                key={iss.id}
                draggable={!isStakeholder}
                onDragStart={(e) => {
                  if (isStakeholder) {
                    e.preventDefault();
                    return;
                  }
                  onSetDraggedIssueId(iss.id);
                  e.dataTransfer.setData("text/plain", iss.id);
                }}
                onDragEnd={() => {
                  onSetDraggedIssueId(null);
                  onSetDragOverTarget(null);
                }}
                onDragOver={(e) => {
                  if (draggedIssueId && draggedIssueId !== iss.id) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onDrop={(e) => {
                  const sourceId = draggedIssueId || e.dataTransfer.getData("text/plain");
                  const sourceObj = allIssues.find((x) => x.id === sourceId);
                  if (sourceObj && !sourceObj.sprint && sourceId !== iss.id && onReorderBacklog) {
                    e.preventDefault();
                    e.stopPropagation();
                    onSetDraggedIssueId(null);
                    onSetDragOverTarget(null);
                    onReorderBacklog(sourceId, iss.id);
                  }
                }}
                onClick={() => onSelectIssue(iss)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  padding: "9px 12px",
                  backgroundColor: "var(--bg-sidebar)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  cursor: isStakeholder ? "pointer" : "grab",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  {renderIssueTypeIcon(iss.type, 12)}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: iss.isVirtualLegacy ? "var(--accent-yellow)" : "var(--accent-indigo)",
                    }}
                  >
                    {iss.id}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {iss.title}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                  {onReorderBacklog && !isStakeholder && (
                    <>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (idx > 0) onReorderBacklog(iss.id, backlogItems[idx - 1].id);
                        }}
                        title="Move Up (PO Backlog Priority)"
                        style={{
                          padding: "2px 4px",
                          borderRadius: "4px",
                          border: "1px solid var(--border-color)",
                          backgroundColor: "var(--bg-panel)",
                          color: "var(--text-secondary)",
                          cursor: idx === 0 ? "not-allowed" : "pointer",
                          opacity: idx === 0 ? 0.35 : 1,
                        }}
                      >
                        <ArrowUp size={10} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === backlogItems.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (idx < backlogItems.length - 1) {
                            onReorderBacklog(iss.id, backlogItems[idx + 1].id);
                          }
                        }}
                        title="Move Down (PO Backlog Priority)"
                        style={{
                          padding: "2px 4px",
                          borderRadius: "4px",
                          border: "1px solid var(--border-color)",
                          backgroundColor: "var(--bg-panel)",
                          color: "var(--text-secondary)",
                          cursor: idx === backlogItems.length - 1 ? "not-allowed" : "pointer",
                          opacity: idx === backlogItems.length - 1 ? 0.35 : 1,
                        }}
                      >
                        <ArrowDown size={10} />
                      </button>
                    </>
                  )}

                  {!isStakeholder && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPoker(iss.id);
                      }}
                      style={{
                        padding: "2px 7px",
                        borderRadius: "4px",
                        border: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-panel)",
                        color: "var(--text-secondary)",
                        fontSize: "10px",
                        cursor: "pointer",
                      }}
                    >
                      {t.estimateBtn}
                    </button>
                  )}

                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: "999px",
                      backgroundColor: "rgba(99, 102, 241, 0.14)",
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
    </div>
  );
}
