"use client";

import React, { useMemo } from "react";
import { AlertOctagon, BarChart3 } from "lucide-react";
import {
  AgileIssue,
  AgileSprint,
  WorkspaceImpediment,
  computeSprintMetrics,
} from "../../utils/issueEngine";
import { BOARD_COLUMNS, ScrumCopy } from "./scrumI18nAndStyles";
import { MetricsBurndownBurnupCharts } from "./MetricsBurndownBurnupCharts";

export interface AgileMetricsTabProps {
  t: ScrumCopy;
  allIssues: AgileIssue[];
  sprints: AgileSprint[];
  activeSprint: AgileSprint | undefined;
  impediments: WorkspaceImpediment[];
  metricsSprintId: string;
  onSetMetricsSprintId: (id: string) => void;
  onOpenFile: (path: string) => void;
  onSelectIssue: (issue: AgileIssue) => void;
}

export function AgileMetricsTab({
  t,
  allIssues,
  sprints,
  activeSprint,
  impediments,
  metricsSprintId,
  onSetMetricsSprintId,
  onOpenFile,
  onSelectIssue,
}: AgileMetricsTabProps) {
  const selectedMetricsSprint = useMemo(() => {
    if (metricsSprintId === "all") return undefined;
    if (metricsSprintId === "active") return activeSprint;
    return sprints.find((s) => s.id === metricsSprintId) || activeSprint;
  }, [metricsSprintId, activeSprint, sprints]);

  const metrics = useMemo(
    () => computeSprintMetrics(allIssues, selectedMetricsSprint),
    [allIssues, selectedMetricsSprint]
  );

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
      {/* Scope Selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
            {t.metricsScope}:
          </span>
          <select
            className="settings-select"
            style={{ width: "auto", minWidth: "220px", padding: "6px 12px" }}
            value={metricsSprintId}
            onChange={(e) => onSetMetricsSprintId(e.target.value)}
          >
            {activeSprint && (
              <option value="active">
                {activeSprint.name} ({t.sprintStates[activeSprint.state]})
              </option>
            )}
            {sprints
              .filter((s) => s.id !== activeSprint?.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({t.sprintStates[s.state]})
                </option>
              ))}
            <option value="all">{t.allIssuesScope}</option>
          </select>
        </div>
      </div>

      {/* KPI Summary Cards (Real Story Points!) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
        }}
      >
        <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            {t.kpiTotalSp}
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
            {metrics.totalPoints} SP
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {metrics.totalIssues} Tickets • Committed: {metrics.committedPoints} SP
          </div>
        </div>

        <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            {t.kpiCompletedSp}
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--accent-green)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
            {metrics.completedPoints} SP ({metrics.completionRate}%)
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {metrics.completedIssues} / {metrics.totalIssues} Done
          </div>
        </div>

        <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            {t.kpiInProgressSp}
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--accent-blue)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
            {metrics.inProgressPoints} SP
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Todo / Ready: {metrics.todoPoints} SP
          </div>
        </div>

        <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            {t.kpiImpediments}
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: impediments.length > 0 ? "var(--accent-red)" : "var(--accent-green)",
              fontFamily: "var(--font-mono)",
              marginTop: "4px",
            }}
          >
            {impediments.length}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {metrics.scopeCreepPoints > 0
              ? `+${metrics.scopeCreepPoints} SP ${t.scopeCreepBadge}`
              : "0 SP Scope Creep"}
          </div>
        </div>
      </div>

      {/* Charts Row 1: Real SP Burndown + Scope-Creep Burnup */}
      <MetricsBurndownBurnupCharts t={t} metrics={metrics} />

      {/* Charts Row 2: Status Distribution / CFD + Impediment Tracker */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: "18px",
        }}
      >
        {/* Status Distribution & Cumulative Flow */}
        <div
          style={{
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            padding: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart3 size={16} style={{ color: "var(--accent-indigo)" }} />
            {t.cfdTitle}
          </div>

          {/* Stacked Horizontal Bar of Real SP */}
          <div
            style={{
              width: "100%",
              height: "18px",
              borderRadius: "999px",
              overflow: "hidden",
              display: "flex",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
            }}
          >
            {BOARD_COLUMNS.slice()
              .reverse()
              .map(({ status, color }) => {
                const sp = metrics.pointsByStatus[status] || 0;
                const pct = metrics.totalPoints > 0 ? (sp / metrics.totalPoints) * 100 : 0;
                if (pct <= 0) return null;
                return (
                  <div
                    key={status}
                    style={{ width: `${pct}%`, height: "100%", backgroundColor: color }}
                    title={`${t.columns[status]}: ${sp} SP`}
                  />
                );
              })}
          </div>

          {/* Per-Status Breakdown Rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {BOARD_COLUMNS.map(({ status, color }) => {
              const cnt = metrics.statusCounts[status] || 0;
              const sp = metrics.pointsByStatus[status] || 0;
              const pct =
                metrics.totalPoints > 0 ? Math.round((sp / metrics.totalPoints) * 100) : 0;
              return (
                <div
                  key={status}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg-panel)",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "50%",
                        backgroundColor: color,
                      }}
                    />
                    <span style={{ fontWeight: 600 }}>{t.columns[status]}</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)" }}>
                    {cnt} Tickets • <strong>{sp} SP</strong> ({pct}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Impediment & Blocker Tracker */}
        <div
          style={{
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            padding: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertOctagon size={16} style={{ color: "var(--accent-red)" }} />
            {t.impedimentsTitle} ({impediments.length})
          </div>

          {impediments.length === 0 ? (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--accent-green)",
                backgroundColor: "rgba(16, 185, 129, 0.06)",
                borderRadius: "8px",
                border: "1px dashed rgba(16, 185, 129, 0.3)",
              }}
            >
              {t.noImpediments}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {impediments.map((imp) => (
                <div
                  key={imp.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(239, 68, 68, 0.07)",
                    border: "1px solid rgba(239, 68, 68, 0.28)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {imp.title}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {imp.assignee}
                      {imp.blockedBy.length > 0 ? ` • Blocked by: ${imp.blockedBy.join(", ")}` : ""}
                      {` • ${imp.filePath}`}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (imp.source === "issue") {
                        const found = allIssues.find((i) => i.id === imp.id);
                        if (found) {
                          onSelectIssue(found);
                          return;
                        }
                      }
                      onOpenFile(imp.filePath);
                    }}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--bg-sidebar)",
                      color: "var(--text-primary)",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {t.openSourceBtn}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
