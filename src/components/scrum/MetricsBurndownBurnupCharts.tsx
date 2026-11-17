"use client";

import React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { SprintMetrics } from "../../utils/issueEngine";
import { ScrumCopy } from "./scrumI18nAndStyles";

export interface MetricsBurndownBurnupChartsProps {
  t: ScrumCopy;
  metrics: SprintMetrics;
}

export function MetricsBurndownBurnupCharts({
  t,
  metrics,
}: MetricsBurndownBurnupChartsProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
        gap: "18px",
      }}
    >
      {/* Chart 1: Burndown SVG */}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700 }}>
            <TrendingDown size={16} style={{ color: "var(--accent-indigo)" }} />
            {t.burndownTitle}
          </div>
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            Remaining: {metrics.remainingPoints} SP
          </span>
        </div>

        {(() => {
          const series = metrics.burndownSeries;
          const maxY = Math.max(
            10,
            metrics.totalPoints,
            metrics.committedPoints,
            ...series.map((p) => Math.max(p.idealRemaining, p.actualRemaining ?? 0))
          );
          const w = 440;
          const h = 190;
          const padL = 42;
          const padR = 16;
          const padT = 16;
          const padB = 28;
          const plotW = w - padL - padR;
          const plotH = h - padT - padB;

          const xAt = (idx: number) =>
            padL + (idx / Math.max(1, series.length - 1)) * plotW;
          const yAt = (val: number) => padT + plotH - (val / maxY) * plotH;

          const idealPts = series
            .map((p, idx) => `${xAt(idx).toFixed(1)},${yAt(p.idealRemaining).toFixed(1)}`)
            .join(" ");
          const actualEntries = series
            .map((p, idx) =>
              p.actualRemaining !== null
                ? { x: xAt(idx), y: yAt(p.actualRemaining), val: p.actualRemaining }
                : null
            )
            .filter((v): v is { x: number; y: number; val: number } => v !== null);
          const actualPts = actualEntries
            .map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
            .join(" ");

          return (
            <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "195px" }}>
              {[0, 0.5, 1].map((ratio, i) => {
                const val = Math.round(maxY * ratio);
                const y = yAt(val);
                return (
                  <g key={i}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={w - padR}
                      y2={y}
                      stroke="var(--border-color)"
                      strokeDasharray={ratio === 0 ? undefined : "3 3"}
                    />
                    <text x={6} y={y + 3} fill="var(--text-muted)" fontSize="9">
                      {val} SP
                    </text>
                  </g>
                );
              })}

              <polyline
                points={idealPts}
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.75"
                strokeDasharray="5 4"
              />

              {actualEntries.length > 1 && (
                <polyline
                  points={actualPts}
                  fill="none"
                  stroke="var(--accent-indigo)"
                  strokeWidth="2.6"
                />
              )}

              {actualEntries.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r="3.2"
                  fill="var(--accent-indigo)"
                  stroke="var(--bg-sidebar)"
                  strokeWidth="1.2"
                />
              ))}

              {series.map((p, idx) => {
                if (series.length > 8 && idx % 2 !== 0 && idx !== series.length - 1) {
                  return null;
                }
                return (
                  <text
                    key={idx}
                    x={xAt(idx)}
                    y={h - 8}
                    fill="var(--text-muted)"
                    fontSize="8.5"
                    textAnchor="middle"
                  >
                    {p.label}
                  </text>
                );
              })}
            </svg>
          );
        })()}

        <div style={{ display: "flex", justifyContent: "center", gap: "18px", fontSize: "11px", color: "var(--text-secondary)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "14px", borderTop: "2px dashed var(--text-muted)", display: "inline-block" }} />
            {t.idealLine}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "14px", borderTop: "2.5px solid var(--accent-indigo)", display: "inline-block" }} />
            {t.actualLine}
          </span>
        </div>
      </div>

      {/* Chart 2: Scope-Creep Burnup SVG */}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700 }}>
            <TrendingUp size={16} style={{ color: "var(--accent-green)" }} />
            {t.burnupTitle}
          </div>
          {metrics.scopeCreepPoints > 0 && (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "999px",
                backgroundColor: "rgba(245, 158, 11, 0.16)",
                color: "var(--accent-yellow)",
                fontSize: "10px",
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
              }}
            >
              +{metrics.scopeCreepPoints} SP {t.scopeCreepBadge}
            </span>
          )}
        </div>

        {(() => {
          const series = metrics.burnupSeries;
          const maxY = Math.max(
            10,
            metrics.totalPoints,
            ...series.map((p) => p.scopePoints)
          );
          const w = 440;
          const h = 190;
          const padL = 42;
          const padR = 16;
          const padT = 16;
          const padB = 28;
          const plotW = w - padL - padR;
          const plotH = h - padT - padB;

          const xAt = (idx: number) =>
            padL + (idx / Math.max(1, series.length - 1)) * plotW;
          const yAt = (val: number) => padT + plotH - (val / maxY) * plotH;

          const scopePts = series
            .map((p, idx) => `${xAt(idx).toFixed(1)},${yAt(p.scopePoints).toFixed(1)}`)
            .join(" ");

          const doneEntries = series
            .map((p, idx) =>
              p.completedPoints !== null
                ? { x: xAt(idx), y: yAt(p.completedPoints) }
                : null
            )
            .filter((v): v is { x: number; y: number } => v !== null);

          const donePts = doneEntries
            .map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
            .join(" ");

          const areaPts =
            doneEntries.length > 1
              ? `${doneEntries[0].x.toFixed(1)},${yAt(0).toFixed(1)} ${donePts} ${doneEntries[
                  doneEntries.length - 1
                ].x.toFixed(1)},${yAt(0).toFixed(1)}`
              : "";

          return (
            <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "195px" }}>
              {[0, 0.5, 1].map((ratio, i) => {
                const val = Math.round(maxY * ratio);
                const y = yAt(val);
                return (
                  <g key={i}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={w - padR}
                      y2={y}
                      stroke="var(--border-color)"
                      strokeDasharray={ratio === 0 ? undefined : "3 3"}
                    />
                    <text x={6} y={y + 3} fill="var(--text-muted)" fontSize="9">
                      {val} SP
                    </text>
                  </g>
                );
              })}

              {/* Total Scope Line (reveals Scope Creep step-ups) */}
              <polyline
                points={scopePts}
                fill="none"
                stroke="var(--accent-yellow)"
                strokeWidth="2"
                strokeDasharray="6 3"
              />

              {/* Completed Area & Line */}
              {areaPts && <polygon points={areaPts} fill="rgba(16, 185, 129, 0.14)" />}
              {doneEntries.length > 1 && (
                <polyline
                  points={donePts}
                  fill="none"
                  stroke="var(--accent-green)"
                  strokeWidth="2.6"
                />
              )}
              {doneEntries.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r="3"
                  fill="var(--accent-green)"
                />
              ))}

              {series.map((p, idx) => {
                if (series.length > 8 && idx % 2 !== 0 && idx !== series.length - 1) {
                  return null;
                }
                return (
                  <text
                    key={idx}
                    x={xAt(idx)}
                    y={h - 8}
                    fill="var(--text-muted)"
                    fontSize="8.5"
                    textAnchor="middle"
                  >
                    {p.label}
                  </text>
                );
              })}
            </svg>
          );
        })()}

        <div style={{ display: "flex", justifyContent: "center", gap: "18px", fontSize: "11px", color: "var(--text-secondary)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "14px", borderTop: "2px dashed var(--accent-yellow)", display: "inline-block" }} />
            {t.scopeLine}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "14px", borderTop: "2.5px solid var(--accent-green)", display: "inline-block" }} />
            {t.completedLine}
          </span>
        </div>
      </div>
    </div>
  );
}
