"use client";

import React from "react";
import { isDoneStatus } from "../../utils/query/queryExecutor";

export function getStatusColors(status: string): {
  bg: string;
  color: string;
  border: string;
} {
  const s = status.toLowerCase();
  if (isDoneStatus(s)) {
    return {
      bg: "rgba(16, 185, 129, 0.14)",
      color: "#34d399",
      border: "rgba(16, 185, 129, 0.35)",
    };
  }
  if (s === "in-progress") {
    return {
      bg: "rgba(59, 130, 246, 0.15)",
      color: "#60a5fa",
      border: "rgba(59, 130, 246, 0.35)",
    };
  }
  if (s === "review" || s === "in-review") {
    return {
      bg: "rgba(99, 102, 241, 0.16)",
      color: "#a5b4fc",
      border: "rgba(99, 102, 241, 0.4)",
    };
  }
  if (s === "blocked") {
    return {
      bg: "rgba(239, 68, 68, 0.15)",
      color: "#f87171",
      border: "rgba(239, 68, 68, 0.4)",
    };
  }
  if (s === "ready") {
    return {
      bg: "rgba(245, 158, 11, 0.15)",
      color: "#fbbf24",
      border: "rgba(245, 158, 11, 0.35)",
    };
  }
  return {
    bg: "rgba(148, 163, 184, 0.12)",
    color: "var(--text-secondary)",
    border: "var(--border-color)",
  };
}

export function getPriorityColors(priority: string): {
  bg: string;
  color: string;
} {
  const p = priority.toLowerCase();
  if (p === "critical" || p === "blocker" || p === "urgent") {
    return { bg: "rgba(239, 68, 68, 0.16)", color: "#f87171" };
  }
  if (p === "high") {
    return { bg: "rgba(245, 158, 11, 0.16)", color: "#fbbf24" };
  }
  if (p === "medium" || p === "normal") {
    return { bg: "rgba(59, 130, 246, 0.14)", color: "#93c5fd" };
  }
  return { bg: "rgba(107, 114, 128, 0.16)", color: "var(--text-muted)" };
}

export function formatStatusLabel(status: string, isEn: boolean): string {
  const mapDe: Record<string, string> = {
    backlog: "Backlog",
    ready: "Bereit",
    "in-progress": "In Arbeit",
    review: "In Review",
    "in-review": "In Prüfung",
    done: "Erledigt",
    completed: "Abgeschlossen",
    approved: "Freigegeben",
    accepted: "Akzeptiert",
    draft: "Entwurf",
    pending: "Geplant",
    proposed: "Vorgeschlagen",
    blocked: "Blockiert",
  };
  const mapEn: Record<string, string> = {
    backlog: "Backlog",
    ready: "Ready",
    "in-progress": "In Progress",
    review: "In Review",
    "in-review": "In Review",
    done: "Done",
    completed: "Completed",
    approved: "Approved",
    accepted: "Accepted",
    draft: "Draft",
    pending: "Planned",
    proposed: "Proposed",
    blocked: "Blocked",
  };
  return (isEn ? mapEn[status] : mapDe[status]) || status;
}

export function QueryStatusPill({
  status,
  isBlocked,
  isEn,
}: {
  status: string;
  isBlocked: boolean;
  isEn: boolean;
}) {
  const effective = isBlocked && !isDoneStatus(status) ? "blocked" : status;
  const styleColors = getStatusColors(effective);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        backgroundColor: styleColors.bg,
        color: styleColors.color,
        border: `1px solid ${styleColors.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {formatStatusLabel(effective, isEn)}
    </span>
  );
}

export function QueryPriorityPill({ priority }: { priority: string }) {
  const pColors = getPriorityColors(priority);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: "4px",
        fontSize: "10px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.4px",
        backgroundColor: pColors.bg,
        color: pColors.color,
      }}
    >
      {priority || "-"}
    </span>
  );
}
