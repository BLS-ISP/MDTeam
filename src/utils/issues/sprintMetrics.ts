import type {
  AgileIssue,
  AgileSprint,
  CumulativeFlowDayPoint,
  IssueStatus,
  SprintMetrics,
  SprintSeriesPoint,
} from "../../types/agile";
import { DAY_MS, formatShortDayLabel, formatUtcDate, parseDateMs } from "./dateHelpers";

export interface EffectiveIssueHours {
  estimatedHours: number;
  loggedHours: number;
  remainingHours: number;
  hasAnyHours: boolean;
}

/**
 * Computes effective Estimated, Logged, and Remaining hours for an issue across both
 * issue-level time tracking fields and subtask-level hour estimates.
 */
export function computeEffectiveIssueHours(issue: AgileIssue): EffectiveIssueHours {
  const subs = issue.subtasks || [];
  let subEstSum = 0;
  let subRemSum = 0;
  let hasSubHours = false;

  for (const s of subs) {
    const sEst =
      s.estimatedHours !== undefined && Number.isFinite(s.estimatedHours)
        ? Math.max(0, s.estimatedHours)
        : undefined;
    const sRem =
      s.remainingHours !== undefined && Number.isFinite(s.remainingHours)
        ? Math.max(0, s.remainingHours)
        : undefined;

    if (sEst !== undefined || sRem !== undefined) {
      hasSubHours = true;
    }
    subEstSum += sEst ?? sRem ?? 0;
    subRemSum += s.done ? 0 : sRem ?? sEst ?? 0;
  }

  const hasIssueHours =
    issue.estimatedHours !== undefined ||
    issue.loggedHours !== undefined ||
    issue.remainingHours !== undefined;

  const hasAnyHours = hasIssueHours || hasSubHours;
  const loggedHours =
    issue.loggedHours !== undefined && Number.isFinite(issue.loggedHours)
      ? Math.max(0, issue.loggedHours)
      : 0;

  let estimatedHours = 0;
  if (issue.estimatedHours !== undefined && Number.isFinite(issue.estimatedHours) && issue.estimatedHours > 0) {
    estimatedHours = issue.estimatedHours;
  } else if (subEstSum > 0) {
    estimatedHours = subEstSum;
  } else if (issue.remainingHours !== undefined || issue.loggedHours !== undefined) {
    estimatedHours = loggedHours + Math.max(0, issue.remainingHours ?? 0);
  }

  let remainingHours = 0;
  if (issue.status === "done") {
    remainingHours = 0;
  } else if (issue.remainingHours !== undefined && Number.isFinite(issue.remainingHours)) {
    remainingHours = Math.max(0, issue.remainingHours);
  } else if (hasSubHours) {
    remainingHours = Math.max(0, subRemSum);
  } else if (estimatedHours > 0) {
    remainingHours = Math.max(0, estimatedHours - loggedHours);
  }

  return {
    estimatedHours: Number(estimatedHours.toFixed(2)),
    loggedHours: Number(loggedHours.toFixed(2)),
    remainingHours: Number(remainingHours.toFixed(2)),
    hasAnyHours,
  };
}

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
  let totalEstimatedHours = 0;
  let totalLoggedHours = 0;
  let totalRemainingHours = 0;

  const perIssueHours = new Map<string, EffectiveIssueHours>();

  for (const issue of relevantIssues) {
    const pts = Number.isFinite(issue.storyPoints) ? issue.storyPoints : 0;
    pointsByStatus[issue.status] = (pointsByStatus[issue.status] || 0) + pts;
    statusCounts[issue.status] = (statusCounts[issue.status] || 0) + 1;

    const effH = computeEffectiveIssueHours(issue);
    perIssueHours.set(issue.id, effH);
    totalEstimatedHours += effH.estimatedHours;
    totalLoggedHours += effH.loggedHours;
    totalRemainingHours += effH.remainingHours;

    if (
      issue.blockedBy.length > 0 ||
      issue.labels.some((l) => l.toLowerCase() === "blocked") ||
      /\bBLOCKED\b/i.test(issue.title)
    ) {
      blockedIssues.push(issue);
    }
  }

  totalEstimatedHours = Number(totalEstimatedHours.toFixed(2));
  totalLoggedHours = Number(totalLoggedHours.toFixed(2));
  totalRemainingHours = Number(totalRemainingHours.toFixed(2));
  const totalCompletedHours = Number(
    Math.max(0, totalEstimatedHours - totalRemainingHours).toFixed(2)
  );

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

  // Build calendar range for Burndown, Burnup, Hours Burndown, and CFD
  const defaultStartMs = parseDateMs("2026-06-01")!;
  const sprintStartMs = parseDateMs(sprint?.startDate) ?? defaultStartMs;
  const sprintEndMs = parseDateMs(sprint?.endDate) ?? sprintStartMs + 13 * DAY_MS;

  const safeEndMs = sprintEndMs >= sprintStartMs ? sprintEndMs : sprintStartMs + 13 * DAY_MS;
  const rawDayCount = Math.round((safeEndMs - sprintStartMs) / DAY_MS) + 1;
  const totalDays = Math.max(2, Math.min(31, rawDayCount));

  const nowUtcMs = parseDateMs(new Date().toISOString().slice(0, 10)) ?? safeEndMs;
  let effectivePlotCutoffMs = safeEndMs;
  if (sprint?.state === "planned") {
    effectivePlotCutoffMs = sprintStartMs;
  } else if (sprint?.state === "active") {
    if (nowUtcMs >= sprintStartMs && nowUtcMs <= safeEndMs) {
      effectivePlotCutoffMs = nowUtcMs;
    } else {
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

  const cutoffDayIdx = Math.max(
    1,
    Math.min(totalDays - 1, Math.round((effectivePlotCutoffMs - sprintStartMs) / DAY_MS))
  );

  const burndownSeries: SprintSeriesPoint[] = [];
  const hoursBurndownSeries: SprintSeriesPoint[] = [];
  const cfdSeries: CumulativeFlowDayPoint[] = [];

  for (let d = 0; d < totalDays; d++) {
    const dayMs = sprintStartMs + d * DAY_MS;
    const dateStr = formatUtcDate(dayMs);
    const shortLabel = formatShortDayLabel(dayMs);

    const idealRemaining = Number(
      Math.max(0, committedPoints - (committedPoints * d) / Math.max(1, totalDays - 1)).toFixed(1)
    );
    const idealHoursRemaining = Number(
      Math.max(
        0,
        totalEstimatedHours - (totalEstimatedHours * d) / Math.max(1, totalDays - 1)
      ).toFixed(1)
    );

    let scopeOnDay = 0;
    let completedOnDay = 0;
    let hoursScopeOnDay = 0;
    let hoursDoneOnDay = 0;
    const dayCfd = { backlog: 0, ready: 0, inProgress: 0, review: 0, done: 0 };

    for (const iss of relevantIssues) {
      const pts = Number.isFinite(iss.storyPoints) ? iss.storyPoints : 0;
      const effH = perIssueHours.get(iss.id) || {
        estimatedHours: 0,
        loggedHours: 0,
        remainingHours: 0,
        hasAnyHours: false,
      };
      const createdMs = parseDateMs(iss.createdAt) ?? sprintStartMs;
      const updatedMs = parseDateMs(iss.updatedAt) ?? sprintStartMs;

      const existsOnDay = createdMs <= dayMs || d === totalDays - 1;
      if (!existsOnDay) continue;

      scopeOnDay += pts;
      hoursScopeOnDay += effH.estimatedHours;

      const issHoursDoneTotal = Math.max(0, effH.estimatedHours - effH.remainingHours);

      if (iss.status === "done" && updatedMs <= dayMs) {
        completedOnDay += pts;
        hoursDoneOnDay += effH.estimatedHours;
        dayCfd.done += pts;
      } else if (dayMs >= effectivePlotCutoffMs) {
        hoursDoneOnDay += issHoursDoneTotal;
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
        const progressRatio = d / Math.max(1, totalDays - 1);
        const partialHoursFactor = Math.min(1, d / cutoffDayIdx);
        hoursDoneOnDay += issHoursDoneTotal * partialHoursFactor;

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
    if (d === 0 && totalEstimatedHours > 0 && hoursScopeOnDay < totalEstimatedHours) {
      hoursScopeOnDay = totalEstimatedHours;
    }

    const isPlotted = sprint?.state === "planned" ? d === 0 : dayMs <= effectivePlotCutoffMs;
    const isCutoffDay =
      isPlotted && (d === totalDays - 1 || dayMs + DAY_MS > effectivePlotCutoffMs);

    const finalScope = isCutoffDay ? totalPoints : scopeOnDay;
    const finalCompleted = isCutoffDay ? completedPoints : completedOnDay;
    const actualRem = isPlotted ? Math.max(0, finalScope - finalCompleted) : null;

    const finalHoursScope = Number(
      (isCutoffDay ? totalEstimatedHours : hoursScopeOnDay).toFixed(1)
    );
    const finalHoursCompleted = Number(
      (isCutoffDay ? totalCompletedHours : hoursDoneOnDay).toFixed(1)
    );
    const actualHoursRem = isPlotted
      ? Number(
          (isCutoffDay
            ? totalRemainingHours
            : Math.max(0, finalHoursScope - finalHoursCompleted)
          ).toFixed(1)
        )
      : null;

    burndownSeries.push({
      dayIndex: d + 1,
      label: shortLabel,
      date: dateStr,
      idealRemaining,
      actualRemaining: actualRem,
      completedPoints: isPlotted ? finalCompleted : null,
      scopePoints: dayMs > effectivePlotCutoffMs ? totalPoints : finalScope,
    });

    hoursBurndownSeries.push({
      dayIndex: d + 1,
      label: shortLabel,
      date: dateStr,
      idealRemaining: idealHoursRemaining,
      actualRemaining: actualHoursRem,
      completedPoints: isPlotted ? finalHoursCompleted : null,
      scopePoints: dayMs > effectivePlotCutoffMs ? totalEstimatedHours : finalHoursScope,
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
    hoursBurndownSeries,
    totalEstimatedHours,
    totalLoggedHours,
    totalRemainingHours,
  };
}
