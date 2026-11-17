import type {
  ParsedQuery,
  QueryCondition,
  QueryExecutionResult,
  QueryRecord,
  WorkspaceFile,
} from "./queryTypes";
import {
  asString,
  normalizeStatus,
  stripQuotes,
} from "./queryFrontmatterExtractor";
import { extractWorkspaceRecords } from "./queryRecordExtractor";
import { parseQueryMacro } from "./queryParser";

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 4,
  blocker: 4,
  urgent: 4,
  high: 3,
  medium: 2,
  normal: 2,
  low: 1,
  none: 0,
};

const STATUS_WEIGHT: Record<string, number> = {
  blocked: 6,
  "in-progress": 5,
  review: 4,
  "in-review": 4,
  ready: 3,
  backlog: 2,
  draft: 2,
  pending: 2,
  proposed: 2,
  done: 1,
  completed: 1,
  approved: 1,
  accepted: 1,
};

function getRecordFieldValue(record: QueryRecord, rawField: string): string {
  const f = rawField.toLowerCase().replace(/[\s-]+/g, "_");
  switch (f) {
    case "id":
    case "key":
      return record.id;
    case "title":
    case "name":
    case "summary":
      return record.title;
    case "type":
    case "kind":
      return record.type;
    case "status":
    case "state":
      return record.status;
    case "review_status":
    case "review":
      return record.reviewStatus;
    case "approved_by":
      return record.approvedBy;
    case "priority":
      return record.priority;
    case "story_points":
    case "storypoints":
    case "points":
    case "sp":
      return String(record.storyPoints);
    case "sprint":
      return record.sprint;
    case "epic":
      return record.epic;
    case "assignee":
    case "owner":
    case "author":
      return record.assignee;
    case "reporter":
      return record.reporter;
    case "label":
    case "labels":
    case "tag":
    case "tags":
      return record.labels.join(", ");
    case "milestone":
      return record.milestone;
    case "updated_at":
    case "updatedat":
    case "updated":
      return record.updatedAt;
    case "created_at":
    case "createdat":
    case "created":
      return record.createdAt;
    case "start_date":
    case "startdate":
      return record.startDate;
    case "end_date":
    case "enddate":
      return record.endDate;
    case "category":
    case "folder":
      return record.category;
    case "path":
      return record.path;
    case "is":
      return record.blockedBy.length > 0 || record.status === "blocked"
        ? "blocked"
        : "open";
    default: {
      const fmVal = record.rawFrontmatter[f];
      return asString(fmVal);
    }
  }
}

function matchesCondition(record: QueryRecord, cond: QueryCondition): boolean {
  const field = cond.field.toLowerCase();
  const rawLeft = getRecordFieldValue(record, field);
  const left =
    field === "status" || field === "review_status"
      ? normalizeStatus(rawLeft)
      : rawLeft.trim().toLowerCase();
  const right =
    field === "status" || field === "review_status"
      ? normalizeStatus(cond.value)
      : cond.value.trim().toLowerCase();

  // Array membership for labels / tags
  if (
    (field === "label" ||
      field === "labels" ||
      field === "tag" ||
      field === "tags") &&
    cond.operator === "="
  ) {
    return record.labels.some((l) => l.toLowerCase() === right);
  }

  // Handle assignee with or without leading @
  if (field === "assignee" || field === "owner") {
    const cleanLeft = left.replace(/^@/, "");
    const cleanRight = right.replace(/^@/, "");
    if (cond.operator === "=") return cleanLeft === cleanRight;
    if (cond.operator === "!=") return cleanLeft !== cleanRight;
    if (cond.operator === "~" || cond.operator === "contains") {
      return cleanLeft.includes(cleanRight);
    }
  }

  switch (cond.operator) {
    case "=":
      if (right === "done") {
        return (
          left === "done" ||
          left === "completed" ||
          left === "accepted" ||
          left === "approved"
        );
      }
      return left === right;
    case "!=":
      if (right === "done") {
        return (
          left !== "done" &&
          left !== "completed" &&
          left !== "accepted" &&
          left !== "approved"
        );
      }
      return left !== right;
    case "~":
    case "contains":
      return left.includes(right);
    case "!~":
      return !left.includes(right);
    case "in": {
      const allowed = cond.value
        .split(",")
        .map((s) => stripQuotes(s).toLowerCase())
        .map((s) =>
          field === "status" || field === "review_status"
            ? normalizeStatus(s)
            : s
        );
      return allowed.includes(left);
    }
    case ">":
    case ">=":
    case "<":
    case "<=": {
      const numL = Number.parseFloat(rawLeft);
      const numR = Number.parseFloat(cond.value);
      if (Number.isFinite(numL) && Number.isFinite(numR)) {
        if (cond.operator === ">") return numL > numR;
        if (cond.operator === ">=") return numL >= numR;
        if (cond.operator === "<") return numL < numR;
        return numL <= numR;
      }
      if (cond.operator === ">") return left > right;
      if (cond.operator === ">=") return left >= right;
      if (cond.operator === "<") return left < right;
      return left <= right;
    }
    default:
      return true;
  }
}

export function sortQueryRecords(
  records: QueryRecord[],
  sortField: string,
  sortDirection: "asc" | "desc"
): QueryRecord[] {
  const dir = sortDirection === "asc" ? 1 : -1;
  const f = sortField.toLowerCase().replace(/[\s-]+/g, "_");

  return [...records].sort((a, b) => {
    if (f === "priority") {
      const wa = PRIORITY_WEIGHT[a.priority] ?? 0;
      const wb = PRIORITY_WEIGHT[b.priority] ?? 0;
      if (wa !== wb) return (wa - wb) * dir;
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    }

    if (f === "status" || f === "review_status") {
      const sa = f === "review_status" ? a.reviewStatus : a.status;
      const sb = f === "review_status" ? b.reviewStatus : b.status;
      const wa = STATUS_WEIGHT[sa] ?? 0;
      const wb = STATUS_WEIGHT[sb] ?? 0;
      if (wa !== wb) return (wa - wb) * dir;
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    }

    if (f === "story_points" || f === "points" || f === "sp") {
      if (a.storyPoints !== b.storyPoints) {
        return (a.storyPoints - b.storyPoints) * dir;
      }
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    }

    const va = getRecordFieldValue(a, f);
    const vb = getRecordFieldValue(b, f);
    return (
      va.localeCompare(vb, undefined, { numeric: true, sensitivity: "base" }) *
      dir
    );
  });
}

export function isDoneStatus(status: string): boolean {
  return (
    status === "done" ||
    status === "completed" ||
    status === "accepted" ||
    status === "approved"
  );
}

export function executeQueryMacro(
  queryInput: string | ParsedQuery,
  files: WorkspaceFile[]
): QueryExecutionResult {
  const parsed =
    typeof queryInput === "string" ? parseQueryMacro(queryInput) : queryInput;
  const baseRecords = extractWorkspaceRecords(files, parsed.source);

  const filtered = baseRecords.filter((rec) =>
    parsed.conditions.every((cond) => matchesCondition(rec, cond))
  );

  const sorted = sortQueryRecords(
    filtered,
    parsed.sortField,
    parsed.sortDirection
  );
  const limited =
    parsed.limit && parsed.limit > 0 ? sorted.slice(0, parsed.limit) : sorted;

  let doneCount = 0;
  let inProgressCount = 0;
  let blockedCount = 0;
  let totalPoints = 0;
  let completedPoints = 0;
  let inProgressPoints = 0;

  for (const r of limited) {
    totalPoints += r.storyPoints;
    if (isDoneStatus(r.status)) {
      doneCount++;
      completedPoints += r.storyPoints;
    } else if (
      r.status === "in-progress" ||
      r.status === "review" ||
      r.status === "in-review"
    ) {
      inProgressCount++;
      inProgressPoints += r.storyPoints;
    }
    if (r.status === "blocked" || r.blockedBy.length > 0) {
      blockedCount++;
    }
  }

  const completionPct =
    totalPoints > 0
      ? Math.round((completedPoints / totalPoints) * 100)
      : limited.length > 0
      ? Math.round((doneCount / limited.length) * 100)
      : 0;

  return {
    parsed,
    records: limited,
    summary: {
      totalCount: limited.length,
      doneCount,
      inProgressCount,
      blockedCount,
      totalPoints,
      completedPoints,
      inProgressPoints,
      completionPct,
    },
  };
}
