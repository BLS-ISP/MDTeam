import type { WorkspaceFile } from "../../types/workspace";
import type { AgileIssue, GanttBar, GanttTimelineResult, IssueStatus } from "../../types/agile";
import { normalizePath, parseYamlArray, unquoteYamlString } from "../frontmatter";
import { DAY_MS, formatUtcDate, parseDateMs } from "./dateHelpers";

export function computeGanttBars(
  issues: AgileIssue[],
  files: WorkspaceFile[] = [],
  zoom: "month" | "quarter" = "month"
): GanttTimelineResult {
  interface RawBar {
    id: string;
    title: string;
    source: "epic" | "issue" | "roadmap";
    status: IssueStatus | "completed" | "pending";
    assignee: string;
    milestone?: string;
    startDate: string;
    endDate: string;
    startMs: number;
    endMs: number;
    progressPercent: number;
    storyPoints?: number;
    completedPoints?: number;
    blockedBy: string[];
    epic?: string;
    color?: string;
    filePath: string;
  }

  const rawBars: RawBar[] = [];

  // 1. Epics and dated issues
  for (const issue of issues || []) {
    if (issue.isVirtualLegacy) continue;

    let startStr = issue.startDate;
    let endStr = issue.endDate;

    if (issue.type === "epic") {
      const children = issues.filter((c) => c.epic.toLowerCase() === issue.id.toLowerCase());
      if (!startStr || !endStr) {
        const childStarts = children.map((c) => parseDateMs(c.startDate)).filter((v): v is number => v !== null);
        const childEnds = children.map((c) => parseDateMs(c.endDate)).filter((v): v is number => v !== null);
        if (!startStr && childStarts.length > 0) startStr = formatUtcDate(Math.min(...childStarts));
        if (!endStr && childEnds.length > 0) endStr = formatUtcDate(Math.max(...childEnds));
      }
      const startMs = parseDateMs(startStr);
      const endMs = parseDateMs(endStr);
      if (startMs !== null && endMs !== null) {
        const safeEnd = Math.max(startMs, endMs);
        const childTotalSp = children.reduce((s, c) => s + (c.storyPoints || 0), 0);
        const childDoneSp = children
          .filter((c) => c.status === "done")
          .reduce((s, c) => s + (c.storyPoints || 0), 0);
        const progressPercent =
          childTotalSp > 0
            ? Math.round((childDoneSp / childTotalSp) * 100)
            : issue.status === "done"
            ? 100
            : issue.status === "in-progress"
            ? 45
            : 0;

        // Collect blockers across epic and its children
        const childBlockers = children.flatMap((c) => c.blockedBy);
        const allBlockers = Array.from(new Set([...issue.blockedBy, ...childBlockers]));

        rawBars.push({
          id: issue.id,
          title: issue.title,
          source: "epic",
          status: issue.status,
          assignee: issue.assignee || "@product-owner",
          milestone: "Epic",
          startDate: formatUtcDate(startMs),
          endDate: formatUtcDate(safeEnd),
          startMs,
          endMs,
          progressPercent,
          storyPoints: childTotalSp || issue.storyPoints,
          completedPoints: childDoneSp,
          blockedBy: allBlockers,
          color: "#6366f1",
          filePath: issue.filePath,
        });
      }
    } else if (startStr && endStr) {
      const startMs = parseDateMs(startStr);
      const endMs = parseDateMs(endStr);
      if (startMs !== null && endMs !== null) {
        const safeEnd = Math.max(startMs, endMs);
        const progressPercent =
          issue.status === "done"
            ? 100
            : issue.status === "review"
            ? 85
            : issue.status === "in-progress"
            ? 50
            : issue.status === "ready"
            ? 15
            : 0;
        rawBars.push({
          id: issue.id,
          title: issue.title,
          source: "issue",
          status: issue.status,
          assignee: issue.assignee || "Unassigned",
          milestone: issue.epic || issue.sprint || undefined,
          startDate: formatUtcDate(startMs),
          endDate: formatUtcDate(safeEnd),
          startMs,
          endMs: safeEnd,
          progressPercent,
          storyPoints: issue.storyPoints,
          completedPoints: issue.status === "done" ? issue.storyPoints : 0,
          blockedBy: issue.blockedBy,
          epic: issue.epic || undefined,
          color:
            issue.type === "bug"
              ? "#ef4444"
              : issue.status === "done"
              ? "#10b981"
              : "#3b82f6",
          filePath: issue.filePath,
        });
      }
    }
  }

  // 2. Parse YAML milestone blocks from management/roadmap.md
  const roadmapFile = (files || []).find(
    (f) => normalizePath(f.path) === "management/roadmap.md"
  );
  if (roadmapFile) {
    const blocks = roadmapFile.content.replace(/\r\n/g, "\n").split("---");
    let idx = 1;
    for (const block of blocks) {
      if (!block.includes("title:") || !block.includes("start_date:")) continue;
      const data: Record<string, string> = {};
      for (const line of block.split("\n")) {
        const cIdx = line.indexOf(":");
        if (cIdx === -1) continue;
        const k = line.slice(0, cIdx).trim().toLowerCase();
        const v = unquoteYamlString(line.slice(cIdx + 1));
        data[k] = v;
      }
      const startMs = parseDateMs(data.start_date);
      const endMs = parseDateMs(data.end_date);
      if (data.title && startMs !== null && endMs !== null) {
        const safeEnd = Math.max(startMs, endMs);
        const rawStatus = (data.status || "pending").toLowerCase();
        const status: "completed" | "in-progress" | "pending" =
          rawStatus === "completed" || rawStatus === "done"
            ? "completed"
            : rawStatus === "in-progress"
            ? "in-progress"
            : "pending";
        const progressPercent = status === "completed" ? 100 : status === "in-progress" ? 55 : 0;

        rawBars.push({
          id: `RM-${idx++}`,
          title: data.title,
          source: "roadmap",
          status,
          assignee: data.assignee || "PM",
          milestone: data.milestone || "Roadmap",
          startDate: formatUtcDate(startMs),
          endDate: formatUtcDate(safeEnd),
          startMs,
          endMs: safeEnd,
          progressPercent,
          blockedBy: data.depends_on ? parseYamlArray(data.depends_on) : [],
          color: data.color || undefined,
          filePath: "management/roadmap.md",
        });
      }
    }
  }

  const nowDateStr = new Date().toISOString().slice(0, 10);
  const nowMs = parseDateMs(nowDateStr) ?? parseDateMs("2026-06-08")!;

  let minMs = rawBars.length > 0 ? Math.min(...rawBars.map((b) => b.startMs)) : nowMs - 7 * DAY_MS;
  let maxMs = rawBars.length > 0 ? Math.max(...rawBars.map((b) => b.endMs)) : nowMs + 21 * DAY_MS;

  if (zoom === "month") {
    // Pad by 2 days on start and at least 30 days span
    minMs -= 2 * DAY_MS;
    maxMs = Math.max(maxMs + 3 * DAY_MS, minMs + 29 * DAY_MS);
  } else {
    // Quarter zoom: pad to ~90 days span starting from start of month
    const startD = new Date(minMs);
    minMs = Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), 1);
    const minQuarterEnd = Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth() + 3, 0);
    maxMs = Math.max(maxMs + 7 * DAY_MS, minQuarterEnd);
  }

  const totalRangeMs = Math.max(DAY_MS, maxMs - minMs + DAY_MS);
  const totalDays = Math.max(1, Math.round(totalRangeMs / DAY_MS));

  const bars: GanttBar[] = rawBars.map((b) => {
    const durationDays = Math.max(1, Math.round((b.endMs - b.startMs) / DAY_MS) + 1);
    const leftPercent = Math.max(0, Math.min(98, ((b.startMs - minMs) / totalRangeMs) * 100));
    const widthPercent = Math.max(
      2.5,
      Math.min(100 - leftPercent, ((b.endMs - b.startMs + DAY_MS) / totalRangeMs) * 100)
    );
    return {
      ...b,
      durationDays,
      leftPercent: Number(leftPercent.toFixed(2)),
      widthPercent: Number(widthPercent.toFixed(2)),
    };
  });

  // Build calendar axis ticks
  const axisTicks: { label: string; subLabel?: string; date: string; leftPercent: number }[] = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (zoom === "month") {
    const stepDays = totalDays <= 35 ? 5 : 7;
    for (let offset = 0; offset < totalDays; offset += stepDays) {
      const tickMs = minMs + offset * DAY_MS;
      const d = new Date(tickMs);
      const dayNum = String(d.getUTCDate()).padStart(2, "0");
      const mName = monthNames[d.getUTCMonth()];
      axisTicks.push({
        label: `${dayNum} ${mName}`,
        date: formatUtcDate(tickMs),
        leftPercent: Number(((offset * DAY_MS) / totalRangeMs * 100).toFixed(2)),
      });
    }
  } else {
    // Tick on 1st and 15th of each month within range
    let cursor = new Date(minMs);
    let safety = 0;
    while (cursor.getTime() <= maxMs && safety++ < 36) {
      const tMs = cursor.getTime();
      if (tMs >= minMs) {
        axisTicks.push({
          label: `${String(cursor.getUTCDate()).padStart(2, "0")} ${monthNames[cursor.getUTCMonth()]}`,
          subLabel: cursor.getUTCDate() === 1 ? String(cursor.getUTCFullYear()) : undefined,
          date: formatUtcDate(tMs),
          leftPercent: Number((((tMs - minMs) / totalRangeMs) * 100).toFixed(2)),
        });
      }
      if (cursor.getUTCDate() === 1) {
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 15));
      } else {
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      }
    }
  }

  let todayPercent: number | null = null;
  if (nowMs >= minMs && nowMs <= maxMs + DAY_MS) {
    todayPercent = Number((((nowMs - minMs) / totalRangeMs) * 100).toFixed(2));
  }

  return {
    bars,
    axisTicks,
    rangeStart: formatUtcDate(minMs),
    rangeEnd: formatUtcDate(maxMs),
    rangeStartMs: minMs,
    rangeEndMs: maxMs,
    totalDays,
    todayDate: nowDateStr,
    todayPercent,
  };
}
