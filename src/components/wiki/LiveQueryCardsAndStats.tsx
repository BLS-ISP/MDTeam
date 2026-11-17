"use client";

import React from "react";
import { FileText } from "lucide-react";
import type { QueryRecord, QuerySummary } from "../../utils/query/queryTypes";
import {
  getStatusColors,
  QueryPriorityPill,
  QueryStatusPill,
} from "./LiveQueryPills";

export function LiveQueryCardsView({
  records,
  isEn,
  showPriorityColumn,
  onOpenFile,
}: {
  records: QueryRecord[];
  isEn: boolean;
  showPriorityColumn: boolean;
  onOpenFile: (path: string) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: "12px",
        padding: "14px",
      }}
    >
      {records.map((rec) => (
        <div
          key={`${rec.path}::${rec.id}`}
          onClick={() => onOpenFile(rec.path)}
          style={{
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "12px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "10px",
            transition: "border-color 0.15s",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "6px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#a5b4fc",
                }}
              >
                {rec.id}
              </span>
              <QueryStatusPill
                status={rec.status}
                isBlocked={rec.blockedBy.length > 0}
                isEn={isEn}
              />
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text-primary)",
                lineHeight: 1.35,
              }}
            >
              {rec.title}
            </div>
            {rec.excerpt && (
              <div
                style={{
                  fontSize: "11.5px",
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                {rec.excerpt}
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "8px",
              borderTop: "1px solid var(--border-color)",
              fontSize: "11px",
              color: "var(--text-secondary)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {showPriorityColumn && (
                <QueryPriorityPill priority={rec.priority} />
              )}
              <span>{rec.assignee || rec.category}</span>
            </div>
            {rec.storyPoints > 0 ? (
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: "999px",
                  backgroundColor: "rgba(99, 102, 241, 0.15)",
                  color: "#a5b4fc",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                }}
              >
                {rec.storyPoints} SP
              </span>
            ) : (
              <FileText size={12} style={{ color: "var(--text-muted)" }} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LiveQueryStatsView({
  records,
  summary,
  isEn,
}: {
  records: QueryRecord[];
  summary: QuerySummary;
  isEn: boolean;
}) {
  const statusBuckets = new Map<string, { count: number; points: number }>();
  for (const r of records) {
    const prev = statusBuckets.get(r.status) ?? { count: 0, points: 0 };
    statusBuckets.set(r.status, {
      count: prev.count + 1,
      points: prev.points + r.storyPoints,
    });
  }

  const kpiCardStyle: React.CSSProperties = {
    backgroundColor: "var(--bg-sidebar)",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  };

  return (
    <div
      style={{
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "10px",
        }}
      >
        <div style={kpiCardStyle}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {isEn ? "Matched Items" : "Einträge gesamt"}
          </span>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {summary.totalCount}
          </span>
        </div>
        <div style={kpiCardStyle}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {isEn ? "Completed" : "Abgeschlossen"}
          </span>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--accent-green)",
            }}
          >
            {summary.doneCount} ({summary.completionPct}%)
          </span>
        </div>
        <div style={kpiCardStyle}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Story Points
          </span>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#a5b4fc",
              fontFamily: "var(--font-mono)",
            }}
          >
            {summary.completedPoints} / {summary.totalPoints} SP
          </span>
        </div>
        <div style={kpiCardStyle}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {isEn ? "Blocked / Impediments" : "Blockiert"}
          </span>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color:
                summary.blockedCount > 0
                  ? "var(--accent-red)"
                  : "var(--text-secondary)",
            }}
          >
            {summary.blockedCount}
          </span>
        </div>
      </div>

      <div
        style={{
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          {isEn ? "Status Breakdown" : "Status-Verteilung"}
        </div>
        {Array.from(statusBuckets.entries()).map(([statusKey, bucket]) => {
          const pct =
            records.length > 0
              ? Math.round((bucket.count / records.length) * 100)
              : 0;
          const colors = getStatusColors(statusKey);
          return (
            <div
              key={statusKey}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "12px",
              }}
            >
              <div style={{ width: "120px" }}>
                <QueryStatusPill
                  status={statusKey}
                  isBlocked={false}
                  isEn={isEn}
                />
              </div>
              <div
                style={{
                  flex: 1,
                  height: "8px",
                  borderRadius: "999px",
                  backgroundColor: "var(--bg-panel)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    backgroundColor: colors.color,
                    borderRadius: "999px",
                  }}
                />
              </div>
              <span
                style={{
                  width: "95px",
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                }}
              >
                {bucket.points > 0
                  ? `${bucket.count} (${bucket.points} SP)`
                  : `${bucket.count} (${pct}%)`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
