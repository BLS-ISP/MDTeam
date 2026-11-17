"use client";

import React from "react";
import { GanttBar, GanttTimelineResult } from "../../utils/issueEngine";
import { ScrumCopy } from "./scrumI18nAndStyles";

export interface GanttTimelineRowProps {
  t: ScrumCopy;
  bar: GanttBar;
  ganttData: GanttTimelineResult;
  onActivateBar: (bar: GanttBar) => void;
}

export function GanttTimelineRow({
  t,
  bar,
  ganttData,
  onActivateBar,
}: GanttTimelineRowProps) {
  const hasDeps = bar.blockedBy && bar.blockedBy.length > 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "270px 1fr",
        alignItems: "center",
        gap: "12px",
        minHeight: "42px",
      }}
    >
      {/* Row Label & Dependency Badges */}
      <div
        onClick={() => onActivateBar(bar)}
        style={{
          cursor: "pointer",
          paddingRight: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              padding: "1px 5px",
              borderRadius: "4px",
              fontSize: "9px",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              backgroundColor:
                bar.source === "epic"
                  ? "rgba(168, 85, 247, 0.18)"
                  : bar.source === "issue"
                  ? "rgba(59, 130, 246, 0.16)"
                  : "rgba(16, 185, 129, 0.16)",
              color:
                bar.source === "epic"
                  ? "#c084fc"
                  : bar.source === "issue"
                  ? "var(--accent-blue)"
                  : "var(--accent-green)",
            }}
          >
            {bar.source === "epic" ? `EPIC ${bar.id}` : bar.id}
          </span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {bar.title}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
            {bar.assignee} • {bar.startDate.slice(5)} → {bar.endDate.slice(5)}
          </span>
          {hasDeps && (
            <span
              style={{
                padding: "0 5px",
                borderRadius: "4px",
                backgroundColor: "rgba(239, 68, 68, 0.16)",
                color: "var(--accent-red)",
                fontSize: "9px",
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
              }}
            >
              {t.dependsOn}: {bar.blockedBy.join(", ")}
            </span>
          )}
        </div>
      </div>

      {/* Proportional Timeline Bar Track */}
      <div
        style={{
          position: "relative",
          height: "34px",
          backgroundColor: "var(--bg-panel)",
          borderRadius: "6px",
          border: "1px solid var(--border-color)",
          overflow: "hidden",
        }}
      >
        {/* Vertical Axis Grid Lines */}
        {ganttData.axisTicks.map((tick, tIdx) => (
          <div
            key={tIdx}
            style={{
              position: "absolute",
              left: `${tick.leftPercent}%`,
              top: 0,
              bottom: 0,
              width: "1px",
              backgroundColor: "rgba(255,255,255,0.04)",
            }}
          />
        ))}

        {/* Today Vertical Marker */}
        {ganttData.todayPercent !== null && (
          <div
            style={{
              position: "absolute",
              left: `${ganttData.todayPercent}%`,
              top: 0,
              bottom: 0,
              width: "2px",
              backgroundColor: "var(--accent-red)",
              zIndex: 4,
            }}
            title={`${t.todayMarker}: ${ganttData.todayDate}`}
          />
        )}

        {/* Gantt Bar */}
        <div
          onClick={() => onActivateBar(bar)}
          style={{
            position: "absolute",
            left: `${bar.leftPercent}%`,
            width: `${bar.widthPercent}%`,
            top: "6px",
            height: "20px",
            borderRadius: "5px",
            backgroundColor: "var(--bg-active)",
            border: hasDeps
              ? "1px solid var(--accent-red)"
              : `1px solid ${bar.color || "var(--accent-indigo)"}`,
            overflow: "hidden",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            zIndex: 2,
          }}
          title={`${bar.title} (${bar.startDate} → ${bar.endDate}, ${bar.durationDays} ${t.daysUnit}, ${bar.progressPercent}%)`}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${bar.progressPercent}%`,
              backgroundColor: bar.color || "var(--accent-indigo)",
              opacity: 0.75,
            }}
          />
          <span
            style={{
              position: "relative",
              zIndex: 1,
              padding: "0 8px",
              fontSize: "10px",
              fontWeight: 700,
              color: "#ffffff",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-mono)",
            }}
          >
            {bar.progressPercent}%
            {bar.storyPoints ? ` • ${bar.storyPoints} SP` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
