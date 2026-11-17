"use client";

import React, { useMemo } from "react";
import { Calendar, ExternalLink } from "lucide-react";
import {
  AgileIssue,
  GanttBar,
  WorkspaceFile,
  computeGanttBars,
} from "../../utils/issueEngine";
import { ScrumCopy } from "./scrumI18nAndStyles";
import { GanttTimelineRow } from "./GanttTimelineRow";

export interface GanttRoadmapTabProps {
  t: ScrumCopy;
  allIssues: AgileIssue[];
  files: WorkspaceFile[];
  roadmapZoom: "month" | "quarter";
  roadmapFilter: "all" | "epics" | "roadmap";
  onSetRoadmapZoom: (zoom: "month" | "quarter") => void;
  onSetRoadmapFilter: (filter: "all" | "epics" | "roadmap") => void;
  onOpenFile: (path: string) => void;
  onSelectIssue: (issue: AgileIssue) => void;
}

export function GanttRoadmapTab({
  t,
  allIssues,
  files,
  roadmapZoom,
  roadmapFilter,
  onSetRoadmapZoom,
  onSetRoadmapFilter,
  onOpenFile,
  onSelectIssue,
}: GanttRoadmapTabProps) {
  const ganttData = useMemo(
    () => computeGanttBars(allIssues, files, roadmapZoom),
    [allIssues, files, roadmapZoom]
  );

  const visibleGanttBars = useMemo(() => {
    if (roadmapFilter === "epics") {
      return ganttData.bars.filter((b) => b.source === "epic" || b.source === "issue");
    }
    if (roadmapFilter === "roadmap") {
      return ganttData.bars.filter((b) => b.source === "roadmap");
    }
    return ganttData.bars;
  }, [ganttData.bars, roadmapFilter]);

  const handleActivateBar = (bar: GanttBar) => {
    if (bar.source === "roadmap") {
      onOpenFile(bar.filePath);
    } else {
      const found = allIssues.find((i) => i.id === bar.id);
      if (found) {
        onSelectIssue(found);
      }
    }
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "18px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Controls Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          backgroundColor: "var(--bg-panel)",
          border: "1px solid var(--border-color)",
          borderRadius: "10px",
          padding: "12px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <Calendar size={16} style={{ color: "var(--accent-indigo)" }} />
          <span style={{ fontSize: "14px", fontWeight: 700 }}>{t.roadmapHeading}</span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            ({ganttData.rangeStart} → {ganttData.rangeEnd} • {ganttData.totalDays} {t.daysUnit})
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Source Filter */}
          {(["all", "epics", "roadmap"] as const).map((fKey) => (
            <button
              key={fKey}
              type="button"
              onClick={() => onSetRoadmapFilter(fKey)}
              style={{
                padding: "5px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                backgroundColor: roadmapFilter === fKey ? "var(--bg-active)" : "var(--bg-sidebar)",
                color: roadmapFilter === fKey ? "var(--text-primary)" : "var(--text-muted)",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {fKey === "all"
                ? t.filterAll
                : fKey === "epics"
                ? t.filterEpics
                : t.filterMilestones}
            </button>
          ))}

          {/* Zoom Toggle: Month / Quarter */}
          <div
            style={{
              display: "inline-flex",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => onSetRoadmapZoom("month")}
              style={{
                padding: "5px 11px",
                border: "none",
                backgroundColor:
                  roadmapZoom === "month" ? "var(--accent-indigo)" : "var(--bg-sidebar)",
                color: roadmapZoom === "month" ? "#ffffff" : "var(--text-secondary)",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t.zoomMonth}
            </button>
            <button
              type="button"
              onClick={() => onSetRoadmapZoom("quarter")}
              style={{
                padding: "5px 11px",
                border: "none",
                backgroundColor:
                  roadmapZoom === "quarter" ? "var(--accent-indigo)" : "var(--bg-sidebar)",
                color: roadmapZoom === "quarter" ? "#ffffff" : "var(--text-secondary)",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t.zoomQuarter}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onOpenFile("management/roadmap.md")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-sidebar)",
              color: "var(--text-secondary)",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            <ExternalLink size={12} />
            {t.openRoadmapMd}
          </button>
        </div>
      </div>

      {/* Gantt Timeline Card */}
      <div
        style={{
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "18px",
          overflowX: "auto",
        }}
      >
        <div style={{ minWidth: "860px", display: "flex", flexDirection: "column" }}>
          {/* Date Axis Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "270px 1fr",
              borderBottom: "1px solid var(--border-color)",
              paddingBottom: "10px",
              marginBottom: "12px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
              Epic / Milestone
            </div>
            <div style={{ position: "relative", height: "22px" }}>
              {ganttData.axisTicks.map((tick, idx) => (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    left: `${tick.leftPercent}%`,
                    top: 0,
                    transform: "translateX(-20%)",
                    fontSize: "10px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tick.label}
                </div>
              ))}
            </div>
          </div>

          {/* Rows + Vertical Grid & Today Marker */}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "10px" }}>
            {visibleGanttBars.map((bar) => (
              <GanttTimelineRow
                key={`${bar.source}-${bar.id}`}
                t={t}
                bar={bar}
                ganttData={ganttData}
                onActivateBar={handleActivateBar}
              />
            ))}
          </div>

          {/* Today Marker Legend */}
          <div
            style={{
              marginTop: "14px",
              paddingTop: "10px",
              borderTop: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11px",
              color: "var(--text-muted)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  width: "10px",
                  height: "2px",
                  backgroundColor: "var(--accent-red)",
                  display: "inline-block",
                }}
              />
              {t.todayMarker}: {ganttData.todayDate}
            </span>
            <span>{visibleGanttBars.length} Roadmap Bars</span>
          </div>
        </div>
      </div>
    </div>
  );
}
