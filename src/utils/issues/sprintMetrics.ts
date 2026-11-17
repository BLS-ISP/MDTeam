import type {
  AgileIssue,
  AgileSprint,
  CumulativeFlowDayPoint,
  IssueStatus,
  SprintMetrics,
  SprintSeriesPoint,
} from "../../types/agile";
import { DAY_MS, formatShortDayLabel, formatUtcDate, parseDateMs } from "./dateHelpers";

export function computeSprintMetrics(
  issues: AgileIssue[],
  sprint?: AgileSprint
): SprintMetrics {
  const relevantIssues = sprint
    ? issues.filter(
        (i) =>
          i.sprint.toLowerCase() === sprint.id.toLowerCase() &&
          (i.type !== "epic" || !issues.some((child) => child.epic === i.id && child.sprint === sprint.id))
      )
    : issues.filter((i) => i.type !== "epic");

  const pointsByStatus: Record<IssueStatus, number> = {
    backlog: 0,
    ready: 0,
    "in-progress": 0,
    review: 0,
    done: 0,
  };

  const statusCounts: Record<IssueStatus, number> = {
    backlog: 0,
    ready: 0,
    "in-progress": 0,
    review: 0,
    done: 0,
  };

  const blockedIssues: AgileIssue[] = [];

  for (const issue of relevantIssues) {
    const pts = Number.isFinite(issue.storyPoints) ? issue.storyPoints : 0;
    pointsByStatus[issue.status] = (pointsByStatus[issue.status] || 0) + pts;
    statusCounts[issue.status] = (statusCounts[issue.status] || 0) + 1;

    if (
      issue.blockedBy.length > 0 ||
      issue.labels.some((l) => l.toLowerCase() === "blocked") ||
      /\bBLOCKED\b/i.test(issue.title)
    ) {
      blockedIssues.push(issue);
    }
  }

  const totalPoints =
    pointsByStatus.backlog +
    pointsByStatus.ready +
    pointsByStatus["in-progress"] +
    pointsByStatus.review +
    pointsByStatus.done;

  const completedPoints = pointsByStatus.done;
  const inProgressPoints = pointsByStatus["in-progress"] + pointsByStatus.review;
  const todoPoints = pointsByStatus.backlog + pointsByStatus.ready;
  const remainingPoints = Math.max(0, totalPoints - completedPoints);

  const committedPoints =
    sprint && sprint.committedPoints > 0 ? sprint.committedPoints : totalPoints;
  const scopeCreepPoints = Math.max(0, totalPoints - committedPoints);
  const completionRate = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

  // Build calendar range for Burndown, Burnup, and CFD
  const defaultStartMs = parseDateMs("2026-06-01")!;
  const sprintStartMs = parseDateMs(sprint?.startDate) ?? defaultStartMs;
  const sprintEndMs =
    parseDateMs(sprint?.endDate) ?? sprintStartMs + 13 * DAY_MS;

  const safeEndMs = sprintEndMs >= sprintStartMs ? sprintEndMs : sprintStartMs + 13 * DAY_MS;
  const rawDayCount = Math.round((safeEndMs - sprintStartMs) / DAY_MS) + 1;
  const totalDays = Math.max(2, Math.min(31, rawDayCount));

  // Determine the latest activity date within the sprint so active sprints plot meaningfully
  const nowUtcMs = parseDateMs(new Date().toISOString().slice(0, 10)) ?? safeEndMs;
  let effectivePlotCutoffMs = safeEndMs;
  if (sprint?.state === "planned") {
    effectivePlotCutoffMs = sprintStartMs;
  } else if (sprint?.state === "active") {
    if (nowUtcMs >= sprintStartMs && nowUtcMs <= safeEndMs) {
      effectivePlotCutoffMs = nowUtcMs;
    } else {
      // Derive current sprint progress point from latest issue updatedAt inside sprint window
      let maxIssueUpdateMs = sprintStartMs + Math.floor(totalDays * 0.55) * DAY_MS;
      for (const iss of relevantIssues) {
        const uMs = parseDateMs(iss.updatedAt);
        if (uMs && uMs >= sprintStartMs && uMs <= safeEndMs && uMs > maxIssueUpdateMs) {
          maxIssueUpdateMs = uMs;
        }
      }
      effectivePlotCutoffMs = Math.min(safeEndMs, maxIssueUpdateMs);
    }
  }

  const burndownSeries: SprintSeriesPoint[] = [];
  const cfdSeries: CumulativeFlowDayPoint[] = [];

  for (let d = 0; d < totalDays; d++) {
    const dayMs = sprintStartMs + d * DAY_MS;
    const dateStr = formatUtcDate(dayMs);
    const shortLabel = formatShortDayLabel(dayMs);

    const idealRemaining = Number(
      Math.max(0, committedPoints - (committedPoints * d) / Math.max(1, totalDays - 1)).toFixed(1)
    );

    // Scope on day d: issues created on or before dayMs (or committed baseline on day 0)
    let scopeOnDay = 0;
    let completedOnDay = 0;
    const dayCfd = { backlog: 0, ready: 0, inProgress: 0, review: 0, done: 0 };

    for (const iss of relevantIssues) {
      const pts = Number.isFinite(iss.storyPoints) ? iss.storyPoints : 0;
      const createdMs = parseDateMs(iss.createdAt) ?? sprintStartMs;
      const updatedMs = parseDateMs(iss.updatedAt) ?? sprintStartMs;

      const existsOnDay = createdMs <= dayMs || d === totalDays - 1;
      if (!existsOnDay) continue;

      scopeOnDay += pts;

      if (iss.status === "done" && updatedMs <= dayMs) {
        completedOnDay += pts;
        dayCfd.done += pts;
      } else if (dayMs >= effectivePlotCutoffMs) {
        // Reflect exact live status at/after current cutoff
        if (iss.status === "done") {
          completedOnDay += pts;
          dayCfd.done += pts;
        } else if (iss.status === "review") {
          dayCfd.review += pts;
        } else if (iss.status === "in-progress") {
          dayCfd.inProgress += pts;
        } else if (iss.status === "ready") {
          dayCfd.ready += pts;
        } else {
          dayCfd.backlog += pts;
        }
      } else {
        // Historical progression before cutoff
        const progressRatio = d / Math.max(1, totalDays - 1);
        if (iss.status === "done") {
          if (progressRatio > 0.5) dayCfd.inProgress += pts;
          else dayCfd.ready += pts;
        } else if (iss.status === "review") {
          if (progressRatio > 0.4) dayCfd.inProgress += pts;
          else dayCfd.ready += pts;
        } else if (iss.status === "in-progress") {
          if (progressRatio > 0.25) dayCfd.inProgress += pts;
          else dayCfd.ready += pts;
        } else if (iss.status === "ready") {
          dayCfd.ready += pts;
        } else {
          dayCfd.backlog += pts;
        }
      }
    }

    if (d === 0 && committedPoints > 0 && scopeOnDay < committedPoints) {
      scopeOnDay = committedPoints;
    }

    const isPlotted = sprint?.state === "planned" ? d === 0 : dayMs <= effectivePlotCutoffMs;
    const isCutoffDay =
      isPlotted && (d === totalDays - 1 || dayMs + DAY_MS > effectivePlotCutoffMs);

    const finalScope = isCutoffDay ? totalPoints : scopeOnDay;
    const finalCompleted = isCutoffDay ? completedPoints : completedOnDay;
    const actualRem = isPlotted ? Math.max(0, finalScope - finalCompleted) : null;

    burndownSeries.push({
      dayIndex: d + 1,
      label: shortLabel,
      date: dateStr,
      idealRemaining,
      actualRemaining: actualRem,
      completedPoints: isPlotted ? finalCompleted : null,
      scopePoints: dayMs > effectivePlotCutoffMs ? totalPoints : finalScope,
    });

    cfdSeries.push({
      dayIndex: d + 1,
      label: shortLabel,
      date: dateStr,
      backlog: dayCfd.backlog,
      ready: dayCfd.ready,
      inProgress: dayCfd.inProgress,
      review: dayCfd.review,
      done: dayCfd.done,
    });
  }

  return {
    total: totalPoints,
    completed: completedPoints,
    inProgress: inProgressPoints,
    review: pointsByStatus.review,
    ready: pointsByStatus.ready,
    backlog: pointsByStatus.backlog,
    todo: todoPoints,
    remaining: remainingPoints,
    committed: committedPoints,
    scopeCreep: scopeCreepPoints,

    totalPoints,
    completedPoints,
    inProgressPoints,
    reviewPoints: pointsByStatus.review,
    readyPoints: pointsByStatus.ready,
    backlogPoints: pointsByStatus.backlog,
    todoPoints,
    remainingPoints,
    committedPoints,
    scopeCreepPoints,
    completionRate,

    totalIssues: relevantIssues.length,
    completedIssues: statusCounts.done,
    blockedIssues,
    cumulativeFlowCounts: { ...statusCounts },
    statusCounts,
    pointsByStatus,

    burndownSeries,
    burnupSeries: burndownSeries,
    cfdSeries,
  };
}
