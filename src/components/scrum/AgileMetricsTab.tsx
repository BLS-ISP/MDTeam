"use client";

import React, { useMemo, useState } from "react";
import { AlertOctagon, BarChart3, Clock, TrendingDown, TrendingUp } from "lucide-react";
import {
  AgileIssue,
  AgileSprint,
  SprintSeriesPoint,
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

function HoursBurndownBurnupCharts({
  t,
  series,
  estHours,
  loggedHours,
  remHours,
}: {
  t: ScrumCopy;
  series: SprintSeriesPoint[];
  estHours: number;
  loggedHours: number;
  remHours: number;
}) {
  const maxY = Math.max(
    8,
    estHours,
    ...series.map((p) => Math.max(p.idealRemaining, p.actualRemaining ?? 0, p.scopePoints))
  );
  const w = 440;
  const h = 190;
  const padL = 42;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const xAt = (idx: number) => padL + (idx / Math.max(1, series.length - 1)) * plotW;
  const yAt = (val: number) => padT + plotH - (val / maxY) * plotH;

  const idealPts = series.map((p, idx) => `${xAt(idx).toFixed(1)},${yAt(p.idealRemaining).toFixed(1)}`).join(" ");
  const actualEntries = series
    .map((p, idx) => (p.actualRemaining !== null ? { x: xAt(idx), y: yAt(p.actualRemaining) } : null))
    .filter((v): v is { x: number; y: number } => v !== null);
  const actualPts = actualEntries.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");

  const scopePts = series.map((p, idx) => `${xAt(idx).toFixed(1)},${yAt(p.scopePoints).toFixed(1)}`).join(" ");
  const doneEntries = series
    .map((p, idx) => (p.completedPoints !== null ? { x: xAt(idx), y: yAt(p.completedPoints) } : null))
    .filter((v): v is { x: number; y: number } => v !== null);
  const donePts = doneEntries.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
  const areaPts =
    doneEntries.length > 1
      ? `${doneEntries[0].x.toFixed(1)},${yAt(0).toFixed(1)} ${donePts} ${doneEntries[doneEntries.length - 1].x.toFixed(1)},${yAt(0).toFixed(1)}`
      : "";

  const renderGridAndLabels = () => (
    <>
      {[0, 0.5, 1].map((ratio, i) => {
        const val = Number((maxY * ratio).toFixed(1));
        const y = yAt(val);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border-color)" strokeDasharray={ratio === 0 ? undefined : "3 3"} />
            <text x={6} y={y + 3} fill="var(--text-muted)" fontSize="9">{val}h</text>
          </g>
        );
      })}
      {series.map((p, idx) => {
        if (series.length > 8 && idx % 2 !== 0 && idx !== series.length - 1) return null;
        return (
          <text key={idx} x={xAt(idx)} y={h - 8} fill="var(--text-muted)" fontSize="8.5" textAnchor="middle">
            {p.label}
          </text>
        );
      })}
    </>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "18px" }}>
      {/* Hours Burndown */}
      <div style={{ backgroundColor: "var(--bg-sidebar)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700 }}>
            <TrendingDown size={16} style={{ color: "var(--accent-blue)" }} />
            {t.hoursBurndownTitle}
          </div>
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-blue)", fontWeight: 600 }}>
            Rem: {remHours}h / Est: {estHours}h
          </span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "195px" }}>
          {renderGridAndLabels()}
          <polyline points={idealPts} fill="none" stroke="var(--text-muted)" strokeWidth="1.75" strokeDasharray="5 4" />
          {actualEntries.length > 1 && <polyline points={actualPts} fill="none" stroke="var(--accent-blue)" strokeWidth="2.6" />}
          {actualEntries.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r="3.2" fill="var(--accent-blue)" stroke="var(--bg-sidebar)" strokeWidth="1.2" />
          ))}
        </svg>
        <div style={{ display: "flex", justifyContent: "center", gap: "18px", fontSize: "11px", color: "var(--text-secondary)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "14px", borderTop: "2px dashed var(--text-muted)", display: "inline-block" }} />
            {t.idealLine}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "14px", borderTop: "2.5px solid var(--accent-blue)", display: "inline-block" }} />
            {t.actualHoursLine}
          </span>
        </div>
      </div>

      {/* Hours Burnup */}
      <div style={{ backgroundColor: "var(--bg-sidebar)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700 }}>
            <TrendingUp size={16} style={{ color: "var(--accent-green)" }} />
            {t.hoursBurnupTitle}
          </div>
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-green)", fontWeight: 600 }}>
            Logged: {loggedHours}h
          </span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "195px" }}>
          {renderGridAndLabels()}
          <polyline points={scopePts} fill="none" stroke="var(--accent-yellow)" strokeWidth="2" strokeDasharray="6 3" />
          {areaPts && <polygon points={areaPts} fill="rgba(16, 185, 129, 0.14)" />}
          {doneEntries.length > 1 && <polyline points={donePts} fill="none" stroke="var(--accent-green)" strokeWidth="2.6" />}
          {doneEntries.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="var(--accent-green)" />
          ))}
        </svg>
        <div style={{ display: "flex", justifyContent: "center", gap: "18px", fontSize: "11px", color: "var(--text-secondary)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "14px", borderTop: "2px dashed var(--accent-yellow)", display: "inline-block" }} />
            {t.hoursScopeLine}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "14px", borderTop: "2.5px solid var(--accent-green)", display: "inline-block" }} />
            {t.completedHoursLine}
          </span>
        </div>
      </div>
    </div>
  );
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
  const [burndownUnit, setBurndownUnit] = useState<"sp" | "hours">("sp");

  const selectedMetricsSprint = useMemo(() => {
    if (metricsSprintId === "all") return undefined;
    if (metricsSprintId === "active") return activeSprint;
    return sprints.find((s) => s.id === metricsSprintId) || activeSprint;
  }, [metricsSprintId, activeSprint, sprints]);

  const metrics = useMemo(
    () => computeSprintMetrics(allIssues, selectedMetricsSprint),
    [allIssues, selectedMetricsSprint]
  );

  const estHours = metrics.totalEstimatedHours ?? 0;
  const loggedHours = metrics.totalLoggedHours ?? 0;
  const remHours = metrics.totalRemainingHours ?? 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px", display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* Scope Selector + Burndown Unit Toggle (SP vs Remaining Hours) */}
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

        {/* Toggle Button: Story Points (SP) <-> Remaining Hours (h) */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
            {t.burndownModeLabel}:
          </span>
          <div style={{ display: "inline-flex", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-panel)", padding: "2px" }}>
            <button
              type="button"
              onClick={() => setBurndownUnit("sp")}
              style={{
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: burndownUnit === "sp" ? "var(--accent-indigo)" : "transparent",
                color: burndownUnit === "sp" ? "#ffffff" : "var(--text-secondary)",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t.burndownUnitSp}
            </button>
            <button
              type="button"
              onClick={() => setBurndownUnit("hours")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: burndownUnit === "hours" ? "var(--accent-blue)" : "transparent",
                color: burndownUnit === "hours" ? "#ffffff" : "var(--text-secondary)",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Clock size={12} />
              {t.burndownUnitHours}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
        <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{t.kpiTotalSp}</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
            {burndownUnit === "hours" ? `${estHours}h` : `${metrics.totalPoints} SP`}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {metrics.totalIssues} Tickets • {burndownUnit === "hours" ? `${metrics.totalPoints} SP` : `Committed: ${metrics.committedPoints} SP`}
          </div>
        </div>

        <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{t.kpiCompletedSp}</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--accent-green)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
            {burndownUnit === "hours" ? `${loggedHours}h` : `${metrics.completedPoints} SP (${metrics.completionRate}%)`}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {metrics.completedIssues} / {metrics.totalIssues} Done
          </div>
        </div>

        <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{t.kpiInProgressSp}</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--accent-blue)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
            {burndownUnit === "hours" ? `${remHours}h` : `${metrics.inProgressPoints} SP`}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {burndownUnit === "hours" ? `Remaining Hours` : `Todo / Ready: ${metrics.todoPoints} SP`}
          </div>
        </div>

        <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{t.kpiImpediments}</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: impediments.length > 0 ? "var(--accent-red)" : "var(--accent-green)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
            {impediments.length}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {metrics.scopeCreepPoints > 0 ? `+${metrics.scopeCreepPoints} SP ${t.scopeCreepBadge}` : "0 SP Scope Creep"}
          </div>
        </div>
      </div>

      {/* Charts Row 1: Story Points OR Remaining Hours Burndown */}
      {burndownUnit === "sp" ? (
        <MetricsBurndownBurnupCharts t={t} metrics={metrics} />
      ) : (
        <HoursBurndownBurnupCharts
          t={t}
          series={metrics.hoursBurndownSeries || []}
          estHours={estHours}
          loggedHours={loggedHours}
          remHours={remHours}
        />
      )}

      {/* Charts Row 2: Status Distribution / CFD + Impediment Tracker */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "18px" }}>
        <div style={{ backgroundColor: "var(--bg-sidebar)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart3 size={16} style={{ color: "var(--accent-indigo)" }} />
            {t.cfdTitle}
          </div>

          <div style={{ width: "100%", height: "18px", borderRadius: "999px", overflow: "hidden", display: "flex", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)" }}>
            {BOARD_COLUMNS.slice().reverse().map(({ status, color }) => {
              const sp = metrics.pointsByStatus[status] || 0;
              const pct = metrics.totalPoints > 0 ? (sp / metrics.totalPoints) * 100 : 0;
              if (pct <= 0) return null;
              return <div key={status} style={{ width: `${pct}%`, height: "100%", backgroundColor: color }} title={`${t.columns[status]}: ${sp} SP`} />;
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {BOARD_COLUMNS.map(({ status, color }) => {
              const cnt = metrics.statusCounts[status] || 0;
              const sp = metrics.pointsByStatus[status] || 0;
              const pct = metrics.totalPoints > 0 ? Math.round((sp / metrics.totalPoints) * 100) : 0;
              return (
                <div key={status} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: "6px", backgroundColor: "var(--bg-panel)", fontSize: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: color }} />
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

        <div style={{ backgroundColor: "var(--bg-sidebar)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertOctagon size={16} style={{ color: "var(--accent-red)" }} />
            {t.impedimentsTitle} ({impediments.length})
          </div>

          {impediments.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", fontSize: "12px", color: "var(--accent-green)", backgroundColor: "rgba(16, 185, 129, 0.06)", borderRadius: "8px", border: "1px dashed rgba(16, 185, 129, 0.3)" }}>
              {t.noImpediments}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {impediments.map((imp) => (
                <div key={imp.id} style={{ padding: "10px 12px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.07)", border: "1px solid rgba(239, 68, 68, 0.28)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{imp.title}</div>
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
                    style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-sidebar)", color: "var(--text-primary)", fontSize: "11px", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
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
