"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  Filter,
  LayoutGrid,
  Search,
  Sparkles,
  Table as TableIcon,
  AlertCircle,
} from "lucide-react";

export interface WorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

export type QuerySource =
  | "issues"
  | "adrs"
  | "pages"
  | "roadmap"
  | "arc42"
  | "wiki"
  | "meetings"
  | "sprints"
  | "all";

export type QueryOperator =
  | "="
  | "!="
  | "~"
  | "!~"
  | ">"
  | ">="
  | "<"
  | "<="
  | "in"
  | "contains";

export interface QueryCondition {
  field: string;
  operator: QueryOperator;
  value: string;
}

export type QueryViewMode = "table" | "cards" | "stats";

export interface ParsedQuery {
  source: QuerySource;
  conditions: QueryCondition[];
  sortField: string;
  sortDirection: "asc" | "desc";
  view: QueryViewMode;
  limit?: number;
  columns?: string[];
  raw: string;
  parseError?: string;
}

export interface QueryRecord {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  storyPoints: number;
  sprint: string;
  epic: string;
  assignee: string;
  reporter: string;
  labels: string[];
  blockedBy: string[];
  reviewStatus: string;
  approvedBy: string;
  milestone: string;
  startDate: string;
  endDate: string;
  updatedAt: string;
  createdAt: string;
  category: string;
  path: string;
  excerpt: string;
  rawFrontmatter: Record<string, string | string[]>;
}

export interface QuerySummary {
  totalCount: number;
  doneCount: number;
  inProgressCount: number;
  blockedCount: number;
  totalPoints: number;
  completedPoints: number;
  inProgressPoints: number;
  completionPct: number;
}

export interface QueryExecutionResult {
  parsed: ParsedQuery;
  records: QueryRecord[];
  summary: QuerySummary;
}

export interface LiveQueryBlockProps {
  queryText: string;
  files: WorkspaceFile[];
  onOpenFile: (path: string) => void;
  language?: "de" | "en";
}

const h = React.createElement;

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

function stripQuotes(val: string): string {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseYamlValue(rawVal: string): string | string[] {
  const trimmed = rawVal.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(",")
      .map((item) => stripQuotes(item))
      .filter(Boolean);
  }
  return stripQuotes(trimmed);
}

/**
 * Self-contained YAML frontmatter & markdown metadata extractor.
 * Supports both top-of-file YAML frontmatter and frontmatter blocks placed right below an H1 heading.
 */
export function extractFrontmatter(markdown: string): {
  frontmatter: Record<string, string | string[]>;
  body: string;
} {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  let startIdx = -1;
  let endIdx = -1;

  // Case 1: Standard frontmatter on line 0
  if (lines[0]?.trim() === "---") {
    startIdx = 0;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        endIdx = i;
        break;
      }
    }
  } else {
    // Case 2: H1 title followed by blank lines and a --- frontmatter block (e.g. ADR files)
    let cursor = 0;
    while (cursor < lines.length && lines[cursor].trim() === "") cursor++;
    if (cursor < lines.length && /^#\s+/.test(lines[cursor])) {
      cursor++;
      while (cursor < lines.length && lines[cursor].trim() === "") cursor++;
      if (cursor < lines.length && lines[cursor].trim() === "---") {
        startIdx = cursor;
        for (let i = cursor + 1; i < lines.length; i++) {
          if (lines[i].trim() === "---") {
            endIdx = i;
            break;
          }
        }
      }
    }
  }

  if (startIdx === -1 || endIdx === -1) {
    return { frontmatter: {}, body: normalized };
  }

  const fmLines = lines.slice(startIdx + 1, endIdx);
  const frontmatter = parseYamlLines(fmLines);
  const remaining = [
    ...lines.slice(0, startIdx),
    ...lines.slice(endIdx + 1),
  ].join("\n");

  return { frontmatter, body: remaining.trim() };
}

function parseYamlLines(fmLines: string[]): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  let currentListKey: string | null = null;

  for (const rawLine of fmLines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("- ") && currentListKey) {
      const itemVal = stripQuotes(trimmed.slice(2));
      const existing = result[currentListKey];
      if (Array.isArray(existing)) {
        existing.push(itemVal);
      } else {
        result[currentListKey] = itemVal ? [itemVal] : [];
      }
      continue;
    }

    const colonIdx = rawLine.indexOf(":");
    if (colonIdx === -1) {
      currentListKey = null;
      continue;
    }

    const key = rawLine
      .slice(0, colonIdx)
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    const valPart = rawLine.slice(colonIdx + 1).trim();

    if (valPart === "") {
      currentListKey = key;
      result[key] = [];
    } else {
      currentListKey = null;
      result[key] = parseYamlValue(valPart);
    }
  }

  return result;
}

function asString(val: string | string[] | undefined, fallback = ""): string {
  if (val === undefined) return fallback;
  if (Array.isArray(val)) return val.join(", ");
  return val;
}

function asStringArray(val: string | string[] | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((v) => v.trim()).filter(Boolean);
  return val
    .split(",")
    .map((v) => stripQuotes(v))
    .filter(Boolean);
}

function normalizeStatus(raw: string): string {
  const clean = raw
    .trim()
    .toLowerCase()
    .replace(/==/g, "")
    .replace(/\s+/g, "-");
  if (!clean) return "draft";
  if (clean === "in_progress" || clean === "inprogress" || clean === "doing") {
    return "in-progress";
  }
  if (clean === "in_review" || clean === "inreview") {
    return "in-review";
  }
  if (clean === "akzeptiert" || clean === "accepted") {
    return "accepted";
  }
  if (clean === "abgeschlossen" || clean === "erledigt") {
    return "done";
  }
  if (clean === "vorgeschlagen") {
    return "proposed";
  }
  return clean;
}

function extractFirstHeading(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

function extractExcerpt(body: string): string {
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !l.startsWith("#") &&
        !l.startsWith("---") &&
        !l.startsWith("|") &&
        !l.startsWith("```")
    );
  const first = lines[0] || "";
  const stripped = first
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/==(.*?)==/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1");
  return stripped.length > 140 ? `${stripped.slice(0, 137)}...` : stripped;
}

function extractAdrBodyStatus(body: string): string {
  const statusSec = body.match(/##\s+Status\s*\n+([^\n#]+)/i);
  if (!statusSec) return "";
  const rawLine = statusSec[1]
    .replace(/\(.*?\)/g, "")
    .replace(/==/g, "")
    .replace(/\*\*/g, "")
    .trim();
  return normalizeStatus(rawLine.split(/\s+/)[0] || "");
}

function extractFileRecord(file: WorkspaceFile): QueryRecord {
  const { frontmatter: fm, body } = extractFrontmatter(file.content);
  const headingTitle = extractFirstHeading(file.content);
  const fallbackTitle = file.name.replace(/\.md$/i, "").replace(/_/g, " ");

  const isIssue = file.path.startsWith("issues/");
  const isAdr = file.path.startsWith("adrs/");
  const isArc42 = file.path.startsWith("arc42/");
  const isWiki = file.path.startsWith("wiki/");
  const isMeeting = file.path.startsWith("meetings/");
  const isSprint = file.path.startsWith("sprints/");

  const defaultId = isIssue || isAdr
    ? file.name.replace(/\.md$/i, "")
    : isArc42
    ? (file.name.match(/^(\d+)/)?.[1] ? `ARC-${file.name.match(/^(\d+)/)?.[1]}` : file.name.replace(/\.md$/i, ""))
    : file.name.replace(/\.md$/i, "").toUpperCase().slice(0, 14);

  const defaultType = isIssue
    ? "story"
    : isAdr
    ? "adr"
    : isArc42
    ? "arc42"
    : isWiki
    ? "wiki"
    : isMeeting
    ? "meeting"
    : isSprint
    ? "sprint"
    : "page";

  const rawStatus =
    asString(fm.status) ||
    asString(fm.state) ||
    asString(fm.review_status) ||
    (isAdr ? extractAdrBodyStatus(body) : "") ||
    (isIssue ? "backlog" : "draft");

  const blockedBy = asStringArray(fm.blocked_by);
  const normalizedStatus =
    blockedBy.length > 0 && rawStatus !== "done" && rawStatus !== "completed"
      ? normalizeStatus(rawStatus)
      : normalizeStatus(rawStatus);

  const pointsRaw =
    asString(fm.story_points) ||
    asString(fm.points) ||
    asString(fm.committed_points) ||
    "0";
  const parsedPoints = Number.parseFloat(pointsRaw);

  return {
    id: asString(fm.id, defaultId),
    title: asString(fm.title) || headingTitle || fallbackTitle,
    type: asString(fm.type, defaultType).toLowerCase(),
    status: normalizedStatus,
    priority: asString(fm.priority, isIssue ? "medium" : "normal").toLowerCase(),
    storyPoints: Number.isFinite(parsedPoints) ? parsedPoints : 0,
    sprint: asString(fm.sprint),
    epic: asString(fm.epic),
    assignee: asString(fm.assignee) || asString(fm.author),
    reporter: asString(fm.reporter) || asString(fm.author),
    labels: asStringArray(fm.labels ?? fm.tags),
    blockedBy,
    reviewStatus: normalizeStatus(
      asString(fm.review_status, asString(fm.status, "draft"))
    ),
    approvedBy: asString(fm.approved_by),
    milestone: asString(fm.milestone),
    startDate: asString(fm.start_date),
    endDate: asString(fm.end_date),
    updatedAt: asString(fm.updated_at) || asString(fm.date) || asString(fm.end_date),
    createdAt: asString(fm.created_at) || asString(fm.start_date),
    category: file.category || file.path.split("/")[0] || "root",
    path: file.path,
    excerpt: extractExcerpt(body),
    rawFrontmatter: fm,
  };
}

function extractRoadmapRecords(files: WorkspaceFile[]): QueryRecord[] {
  const records: QueryRecord[] = [];
  const roadmapFile = files.find((f) => f.path === "management/roadmap.md");

  if (roadmapFile) {
    const normalized = roadmapFile.content.replace(/\r\n/g, "\n");
    const blockRegex = /^---\n([\s\S]*?)\n---/gm;
    let match: RegExpExecArray | null;
    let idx = 1;
    while ((match = blockRegex.exec(normalized)) !== null) {
      const fm = parseYamlLines(match[1].split("\n"));
      if (Object.keys(fm).length === 0) continue;
      const status = normalizeStatus(asString(fm.status, "pending"));
      const points = Number.parseFloat(asString(fm.story_points, "0"));
      records.push({
        id: asString(fm.id, `RM-${String(idx).padStart(2, "0")}`),
        title: asString(fm.title, `Milestone ${idx}`),
        type: "milestone",
        status,
        priority: asString(fm.priority, "high").toLowerCase(),
        storyPoints: Number.isFinite(points) ? points : 0,
        sprint: asString(fm.sprint),
        epic: asString(fm.epic),
        assignee: asString(fm.assignee),
        reporter: "",
        labels: asStringArray(fm.labels),
        blockedBy: [],
        reviewStatus: status,
        approvedBy: "",
        milestone: asString(fm.milestone),
        startDate: asString(fm.start_date),
        endDate: asString(fm.end_date),
        updatedAt: asString(fm.end_date) || asString(fm.start_date),
        createdAt: asString(fm.start_date),
        category: "roadmap",
        path: roadmapFile.path,
        excerpt: asString(fm.milestone),
        rawFrontmatter: fm,
      });
      idx++;
    }
  }

  // Also include Epic issues that define roadmap start/end dates
  const epicFiles = files.filter((f) => f.path.startsWith("issues/"));
  for (const ef of epicFiles) {
    const rec = extractFileRecord(ef);
    if (rec.type === "epic") {
      records.push(rec);
    }
  }

  return records;
}

function extractLegacyBacklogRecords(files: WorkspaceFile[]): QueryRecord[] {
  const backlogFile = files.find((f) => f.path === "management/sprint-backlog.md");
  if (!backlogFile) return [];

  const records: QueryRecord[] = [];
  const lines = backlogFile.content.replace(/\r\n/g, "\n").split("\n");
  let idx = 1;

  for (const line of lines) {
    const match = line.match(
      /^[-*]\s+\[([ xX/])\]\s+(?:(TODO|IN-PROGRESS|DONE|BLOCKED):\s*)?(.+)$/i
    );
    if (!match) continue;
    const checkChar = match[1];
    const explicitTag = (match[2] || "").toUpperCase();
    let rest = match[3].trim();

    let assignee = "";
    const mentionMatch = rest.match(/(@[a-zA-Z0-9_-]+)/);
    if (mentionMatch) {
      assignee = mentionMatch[1];
      rest = rest.replace(mentionMatch[1], "").trim();
    }

    let status = "backlog";
    if (checkChar.toLowerCase() === "x" || explicitTag === "DONE") {
      status = "done";
    } else if (checkChar === "/" || explicitTag === "IN-PROGRESS") {
      status = "in-progress";
    } else if (explicitTag === "BLOCKED") {
      status = "blocked";
    }

    records.push({
      id: `BKL-${String(idx).padStart(2, "0")}`,
      title: rest,
      type: "task",
      status,
      priority: status === "blocked" ? "high" : "medium",
      storyPoints: 3,
      sprint: "sprint-01",
      epic: "",
      assignee,
      reporter: "",
      labels: ["legacy"],
      blockedBy: status === "blocked" ? ["impediment"] : [],
      reviewStatus: status,
      approvedBy: "",
      milestone: "",
      startDate: "",
      endDate: "",
      updatedAt: "",
      createdAt: "",
      category: "issues",
      path: backlogFile.path,
      excerpt: rest,
      rawFrontmatter: {},
    });
    idx++;
  }

  return records;
}

/**
 * Extracts normalized records for a requested source across WorkspaceFile[].
 */
export function extractWorkspaceRecords(
  files: WorkspaceFile[],
  source: QuerySource
): QueryRecord[] {
  const visibleFiles = files.filter(
    (f) => !f.path.startsWith(".mdteam/") && f.path.endsWith(".md")
  );

  if (source === "roadmap") {
    return extractRoadmapRecords(files);
  }

  if (source === "issues") {
    const issueFiles = visibleFiles.filter((f) => f.path.startsWith("issues/"));
    if (issueFiles.length > 0) {
      return issueFiles.map(extractFileRecord);
    }
    return extractLegacyBacklogRecords(files);
  }

  if (source === "adrs") {
    return visibleFiles
      .filter((f) => f.path.startsWith("adrs/"))
      .map(extractFileRecord);
  }

  if (source === "arc42") {
    return visibleFiles
      .filter((f) => f.path.startsWith("arc42/"))
      .map(extractFileRecord);
  }

  if (source === "wiki") {
    return visibleFiles
      .filter((f) => f.path.startsWith("wiki/"))
      .map(extractFileRecord);
  }

  if (source === "meetings") {
    return visibleFiles
      .filter((f) => f.path.startsWith("meetings/"))
      .map(extractFileRecord);
  }

  if (source === "sprints") {
    return visibleFiles
      .filter((f) => f.path.startsWith("sprints/"))
      .map(extractFileRecord);
  }

  if (source === "pages") {
    return visibleFiles
      .filter(
        (f) =>
          !f.path.startsWith("issues/") &&
          !f.path.startsWith("sprints/")
      )
      .map(extractFileRecord);
  }

  // source === "all"
  return visibleFiles.map(extractFileRecord);
}

function normalizeSourceToken(token: string): QuerySource | null {
  const t = token.trim().toLowerCase();
  if (t === "issue" || t === "issues" || t === "tickets" || t === "backlog") {
    return "issues";
  }
  if (t === "adr" || t === "adrs" || t === "decisions") {
    return "adrs";
  }
  if (t === "page" || t === "pages" || t === "docs" || t === "documents") {
    return "pages";
  }
  if (t === "roadmap" || t === "milestones") {
    return "roadmap";
  }
  if (t === "arc42") return "arc42";
  if (t === "wiki") return "wiki";
  if (t === "meeting" || t === "meetings") return "meetings";
  if (t === "sprint" || t === "sprints") return "sprints";
  if (t === "all" || t === "*") return "all";
  return null;
}

function parseWhereClause(whereExpr: string): QueryCondition[] {
  const conditions: QueryCondition[] = [];
  if (!whereExpr.trim()) return conditions;

  // Split by case-insensitive AND
  const parts = whereExpr.split(/\s+AND\s+/i);

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;

    // Handle `field IN (a, b, c)`
    const inMatch = part.match(/^([a-zA-Z0-9_.-]+)\s+IN\s*\(([^)]+)\)$/i);
    if (inMatch) {
      conditions.push({
        field: inMatch[1].trim().toLowerCase(),
        operator: "in",
        value: inMatch[2].trim(),
      });
      continue;
    }

    // Handle `field CONTAINS val`
    const containsMatch = part.match(
      /^([a-zA-Z0-9_.-]+)\s+CONTAINS\s+(.+)$/i
    );
    if (containsMatch) {
      conditions.push({
        field: containsMatch[1].trim().toLowerCase(),
        operator: "contains",
        value: stripQuotes(containsMatch[2]),
      });
      continue;
    }

    // Handle standard comparison operators: !=, !~, >=, <=, =, ~, >, <, :
    const opMatch = part.match(
      /^([a-zA-Z0-9_.-]+)\s*(!=|!~|>=|<=|=|~|>|<|:)\s*(.+)$/
    );
    if (opMatch) {
      const rawOp = opMatch[2] === ":" ? "=" : (opMatch[2] as QueryOperator);
      conditions.push({
        field: opMatch[1].trim().toLowerCase(),
        operator: rawOp,
        value: stripQuotes(opMatch[3]),
      });
    }
  }

  return conditions;
}

function defaultSortDirectionForField(field: string): "asc" | "desc" {
  const f = field.toLowerCase();
  if (
    f === "priority" ||
    f === "updated_at" ||
    f === "updatedat" ||
    f === "updated" ||
    f === "created_at" ||
    f === "story_points" ||
    f === "points"
  ) {
    return "desc";
  }
  return "asc";
}

/**
 * Parses declarative multi-line ```query``` blocks as well as single-line shorthand
 * such as `issues where status=in-progress` or `FROM issues WHERE status != done AND epic = MDT-101`.
 */
export function parseQueryMacro(queryText: string): ParsedQuery {
  const cleaned = queryText
    .replace(/^```query\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const result: ParsedQuery = {
    source: "issues",
    conditions: [],
    sortField: "id",
    sortDirection: "asc",
    view: "table",
    raw: cleaned,
  };

  if (!cleaned) {
    return result;
  }

  const lines = cleaned
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));

  // Single-line shorthand detector (e.g., `issues where status=in-progress` or `FROM issues WHERE ... SORT ... VIEW ...`)
  if (lines.length === 1) {
    const single = lines[0];
    const clauseTokens = single.match(
      /^(?:FROM\s+)?([a-zA-Z*]+)(?:\s+WHERE\s+(.+?))?(?:\s+(?:SORT|ORDER\s+BY)\s+([a-zA-Z0-9_.-]+)(?:\s+(ASC|DESC))?)?(?:\s+VIEW\s+(table|cards|stats))?(?:\s+LIMIT\s+(\d+))?$/i
    );
    if (clauseTokens) {
      const src = normalizeSourceToken(clauseTokens[1]);
      if (src) {
        result.source = src;
        if (clauseTokens[2]) {
          result.conditions.push(...parseWhereClause(clauseTokens[2]));
        }
        if (clauseTokens[3]) {
          result.sortField = clauseTokens[3].toLowerCase();
          result.sortDirection = clauseTokens[4]
            ? (clauseTokens[4].toLowerCase() as "asc" | "desc")
            : defaultSortDirectionForField(result.sortField);
        }
        if (clauseTokens[5]) {
          result.view = clauseTokens[5].toLowerCase() as QueryViewMode;
        }
        if (clauseTokens[6]) {
          result.limit = Number.parseInt(clauseTokens[6], 10);
        }
        return result;
      }
    }

    // JQL-style single-line shorthand e.g. `issues status:in-progress type:bug`
    const spaceParts = single.split(/\s+/);
    const maybeSrc = normalizeSourceToken(spaceParts[0] || "");
    if (maybeSrc && spaceParts.length > 1) {
      result.source = maybeSrc;
      for (const tok of spaceParts.slice(1)) {
        result.conditions.push(...parseWhereClause(tok));
      }
      return result;
    }
  }

  // Multi-line declarative parser
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith("FROM ")) {
      const srcToken = line.slice(5).trim().split(/\s+/)[0] || "issues";
      const parsedSrc = normalizeSourceToken(srcToken);
      if (parsedSrc) {
        result.source = parsedSrc;
      } else {
        result.parseError = `Unknown source "${srcToken}"`;
      }
    } else if (upper.startsWith("WHERE ")) {
      result.conditions.push(...parseWhereClause(line.slice(6)));
    } else if (upper.startsWith("AND ")) {
      result.conditions.push(...parseWhereClause(line.slice(4)));
    } else if (upper.startsWith("SORT ") || upper.startsWith("ORDER BY ")) {
      const rest = upper.startsWith("ORDER BY ")
        ? line.slice(9).trim()
        : line.slice(5).trim();
      const parts = rest.split(/\s+/);
      if (parts[0]) {
        result.sortField = parts[0].toLowerCase();
        result.sortDirection =
          parts[1]?.toLowerCase() === "asc"
            ? "asc"
            : parts[1]?.toLowerCase() === "desc"
            ? "desc"
            : defaultSortDirectionForField(result.sortField);
      }
    } else if (upper.startsWith("VIEW ")) {
      const v = line.slice(5).trim().toLowerCase();
      if (v === "table" || v === "cards" || v === "stats") {
        result.view = v;
      }
    } else if (upper.startsWith("LIMIT ")) {
      const n = Number.parseInt(line.slice(6).trim(), 10);
      if (Number.isFinite(n) && n > 0) {
        result.limit = n;
      }
    } else if (upper.startsWith("COLUMNS ") || upper.startsWith("SELECT ")) {
      const rest = upper.startsWith("COLUMNS ")
        ? line.slice(8)
        : line.slice(7);
      result.columns = rest
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
    } else {
      // Bare source name on first line (e.g. `issues`)
      const bareSrc = normalizeSourceToken(line);
      if (bareSrc) {
        result.source = bareSrc;
      } else {
        const fallbackConds = parseWhereClause(line);
        if (fallbackConds.length > 0) {
          result.conditions.push(...fallbackConds);
        }
      }
    }
  }

  return result;
}

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
    return va.localeCompare(vb, undefined, { numeric: true, sensitivity: "base" }) * dir;
  });
}

function isDoneStatus(status: string): boolean {
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
    } else if (r.status === "in-progress" || r.status === "review" || r.status === "in-review") {
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

function getStatusColors(status: string): {
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

function getPriorityColors(priority: string): {
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

function formatStatusLabel(status: string, isEn: boolean): string {
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

export function LiveQueryBlock({
  queryText,
  files,
  onOpenFile,
  language = "de",
}: LiveQueryBlockProps): React.ReactElement {
  const isEn = language === "en";
  const baseExecution = useMemo(
    () => executeQueryMacro(queryText, files),
    [queryText, files]
  );

  const [viewOverride, setViewOverride] = useState<QueryViewMode | null>(null);
  const [sortOverride, setSortOverride] = useState<{
    field: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>("");

  const activeView = viewOverride ?? baseExecution.parsed.view;
  const activeSortField = sortOverride?.field ?? baseExecution.parsed.sortField;
  const activeSortDir =
    sortOverride?.direction ?? baseExecution.parsed.sortDirection;

  const displayedRecords = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    const filtered = q
      ? baseExecution.records.filter(
          (r) =>
            r.id.toLowerCase().includes(q) ||
            r.title.toLowerCase().includes(q) ||
            r.status.toLowerCase().includes(q) ||
            r.assignee.toLowerCase().includes(q) ||
            r.epic.toLowerCase().includes(q) ||
            r.milestone.toLowerCase().includes(q) ||
            r.labels.some((l) => l.toLowerCase().includes(q))
        )
      : baseExecution.records;

    return sortQueryRecords(filtered, activeSortField, activeSortDir);
  }, [baseExecution.records, searchFilter, activeSortField, activeSortDir]);

  const showPointsColumn =
    baseExecution.parsed.source === "issues" ||
    baseExecution.summary.totalPoints > 0;
  const showPriorityColumn =
    baseExecution.parsed.source === "issues" ||
    baseExecution.parsed.source === "roadmap";

  const handleToggleSort = (field: string) => {
    if (activeSortField === field) {
      setSortOverride({
        field,
        direction: activeSortDir === "asc" ? "desc" : "asc",
      });
    } else {
      setSortOverride({
        field,
        direction: defaultSortDirectionForField(field),
      });
    }
  };

  const renderSortIcon = (field: string) => {
    if (activeSortField !== field) {
      return h(ArrowUpDown, {
        size: 11,
        style: { opacity: 0.45, flexShrink: 0 },
      });
    }
    return activeSortDir === "asc"
      ? h(ArrowUp, {
          size: 11,
          style: { color: "var(--accent-indigo)", flexShrink: 0 },
        })
      : h(ArrowDown, {
          size: 11,
          style: { color: "var(--accent-indigo)", flexShrink: 0 },
        });
  };

  const renderStatusPill = (status: string, isBlocked: boolean) => {
    const effective = isBlocked && !isDoneStatus(status) ? "blocked" : status;
    const styleColors = getStatusColors(effective);
    return h(
      "span",
      {
        style: {
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
        },
      },
      formatStatusLabel(effective, isEn)
    );
  };

  const renderPriorityPill = (priority: string) => {
    const pColors = getPriorityColors(priority);
    return h(
      "span",
      {
        style: {
          display: "inline-block",
          padding: "2px 7px",
          borderRadius: "4px",
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.4px",
          backgroundColor: pColors.bg,
          color: pColors.color,
        },
      },
      priority || "-"
    );
  };

  const renderTableView = () => {
    const thStyle: React.CSSProperties = {
      padding: "8px 10px",
      fontSize: "11px",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      color: "var(--text-muted)",
      backgroundColor: "var(--bg-sidebar)",
      borderBottom: "1px solid var(--border-color)",
      cursor: "pointer",
      userSelect: "none",
      whiteSpace: "nowrap",
    };

    const tdStyle: React.CSSProperties = {
      padding: "8px 10px",
      fontSize: "12.5px",
      borderBottom: "1px solid var(--border-color)",
      verticalAlign: "middle",
    };

    return h(
      "div",
      { style: { overflowX: "auto" } },
      h(
        "table",
        {
          style: {
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: 0,
          },
        },
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            h(
              "th",
              { style: thStyle, onClick: () => handleToggleSort("id") },
              h(
                "span",
                { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
                "ID",
                renderSortIcon("id")
              )
            ),
            h(
              "th",
              { style: thStyle, onClick: () => handleToggleSort("title") },
              h(
                "span",
                { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
                isEn ? "Title" : "Titel",
                renderSortIcon("title")
              )
            ),
            h(
              "th",
              { style: thStyle, onClick: () => handleToggleSort("type") },
              h(
                "span",
                { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
                isEn ? "Type" : "Typ",
                renderSortIcon("type")
              )
            ),
            h(
              "th",
              { style: thStyle, onClick: () => handleToggleSort("status") },
              h(
                "span",
                { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
                "Status",
                renderSortIcon("status")
              )
            ),
            showPriorityColumn
              ? h(
                  "th",
                  { style: thStyle, onClick: () => handleToggleSort("priority") },
                  h(
                    "span",
                    {
                      style: {
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      },
                    },
                    isEn ? "Priority" : "Priorität",
                    renderSortIcon("priority")
                  )
                )
              : null,
            showPointsColumn
              ? h(
                  "th",
                  {
                    style: { ...thStyle, textAlign: "right" },
                    onClick: () => handleToggleSort("story_points"),
                  },
                  h(
                    "span",
                    {
                      style: {
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      },
                    },
                    "SP",
                    renderSortIcon("story_points")
                  )
                )
              : null,
            h(
              "th",
              { style: thStyle, onClick: () => handleToggleSort("assignee") },
              h(
                "span",
                { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
                isEn ? "Owner" : "Verantwortlich",
                renderSortIcon("assignee")
              )
            ),
            h(
              "th",
              { style: thStyle, onClick: () => handleToggleSort("updated_at") },
              h(
                "span",
                { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
                isEn ? "Context / Date" : "Kontext / Datum",
                renderSortIcon("updated_at")
              )
            )
          )
        ),
        h(
          "tbody",
          null,
          ...displayedRecords.map((rec) =>
            h(
              "tr",
              {
                key: `${rec.path}::${rec.id}`,
                style: {
                  backgroundColor: "transparent",
                  transition: "background-color 0.15s",
                },
              },
              h(
                "td",
                { style: { ...tdStyle, whiteSpace: "nowrap" } },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: () => onOpenFile(rec.path),
                    style: {
                      background: "rgba(99, 102, 241, 0.12)",
                      border: "1px solid rgba(99, 102, 241, 0.3)",
                      color: "#a5b4fc",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    },
                    title: rec.path,
                  },
                  rec.id,
                  h(ExternalLink, { size: 10 })
                )
              ),
              h(
                "td",
                { style: tdStyle },
                h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    },
                  },
                  h(
                    "span",
                    {
                      onClick: () => onOpenFile(rec.path),
                      style: {
                        color: "var(--text-primary)",
                        fontWeight: 500,
                        cursor: "pointer",
                      },
                    },
                    rec.title
                  ),
                  rec.labels.length > 0
                    ? h(
                        "div",
                        { style: { display: "flex", gap: "4px", flexWrap: "wrap" } },
                        ...rec.labels.map((lbl) =>
                          h(
                            "span",
                            {
                              key: lbl,
                              style: {
                                fontSize: "10px",
                                padding: "1px 5px",
                                borderRadius: "3px",
                                backgroundColor: "var(--bg-active)",
                                color: "var(--text-secondary)",
                              },
                            },
                            `#${lbl}`
                          )
                        )
                      )
                    : null
                )
              ),
              h(
                "td",
                { style: tdStyle },
                h(
                  "span",
                  {
                    style: {
                      fontSize: "11px",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    },
                  },
                  rec.type
                )
              ),
              h(
                "td",
                { style: tdStyle },
                renderStatusPill(rec.status, rec.blockedBy.length > 0)
              ),
              showPriorityColumn
                ? h("td", { style: tdStyle }, renderPriorityPill(rec.priority))
                : null,
              showPointsColumn
                ? h(
                    "td",
                    {
                      style: {
                        ...tdStyle,
                        textAlign: "right",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        color:
                          rec.storyPoints > 0
                            ? "var(--text-primary)"
                            : "var(--text-muted)",
                      },
                    },
                    rec.storyPoints > 0 ? String(rec.storyPoints) : "–"
                  )
                : null,
              h(
                "td",
                {
                  style: {
                    ...tdStyle,
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                  },
                },
                rec.assignee || "–"
              ),
              h(
                "td",
                {
                  style: {
                    ...tdStyle,
                    color: "var(--text-muted)",
                    fontSize: "11.5px",
                    whiteSpace: "nowrap",
                  },
                },
                rec.epic || rec.milestone || rec.sprint || rec.updatedAt || "–"
              )
            )
          )
        )
      )
    );
  };

  const renderCardsView = () =>
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "12px",
          padding: "14px",
        },
      },
      ...displayedRecords.map((rec) =>
        h(
          "div",
          {
            key: `${rec.path}::${rec.id}`,
            onClick: () => onOpenFile(rec.path),
            style: {
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
            },
          },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "6px",
                },
              },
              h(
                "span",
                {
                  style: {
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#a5b4fc",
                  },
                },
                rec.id
              ),
              renderStatusPill(rec.status, rec.blockedBy.length > 0)
            ),
            h(
              "div",
              {
                style: {
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  lineHeight: 1.35,
                },
              },
              rec.title
            ),
            rec.excerpt
              ? h(
                  "div",
                  {
                    style: {
                      fontSize: "11.5px",
                      color: "var(--text-muted)",
                      lineHeight: 1.4,
                    },
                  },
                  rec.excerpt
                )
              : null
          ),
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "8px",
                borderTop: "1px solid var(--border-color)",
                fontSize: "11px",
                color: "var(--text-secondary)",
              },
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px" } },
              showPriorityColumn ? renderPriorityPill(rec.priority) : null,
              h("span", null, rec.assignee || rec.category)
            ),
            rec.storyPoints > 0
              ? h(
                  "span",
                  {
                    style: {
                      padding: "1px 6px",
                      borderRadius: "999px",
                      backgroundColor: "rgba(99, 102, 241, 0.15)",
                      color: "#a5b4fc",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                    },
                  },
                  `${rec.storyPoints} SP`
                )
              : h(FileText, { size: 12, style: { color: "var(--text-muted)" } })
          )
        )
      )
    );

  const renderStatsView = () => {
    const statusBuckets = new Map<string, { count: number; points: number }>();
    for (const r of displayedRecords) {
      const prev = statusBuckets.get(r.status) ?? { count: 0, points: 0 };
      statusBuckets.set(r.status, {
        count: prev.count + 1,
        points: prev.points + r.storyPoints,
      });
    }

    const { summary } = baseExecution;
    const kpiCardStyle: React.CSSProperties = {
      backgroundColor: "var(--bg-sidebar)",
      border: "1px solid var(--border-color)",
      borderRadius: "8px",
      padding: "12px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    };

    return h(
      "div",
      {
        style: {
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        },
      },
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "10px",
          },
        },
        h(
          "div",
          { style: kpiCardStyle },
          h(
            "span",
            { style: { fontSize: "11px", color: "var(--text-muted)" } },
            isEn ? "Matched Items" : "Einträge gesamt"
          ),
          h(
            "span",
            {
              style: {
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--text-primary)",
              },
            },
            String(summary.totalCount)
          )
        ),
        h(
          "div",
          { style: kpiCardStyle },
          h(
            "span",
            { style: { fontSize: "11px", color: "var(--text-muted)" } },
            isEn ? "Completed" : "Abgeschlossen"
          ),
          h(
            "span",
            {
              style: {
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--accent-green)",
              },
            },
            `${summary.doneCount} (${summary.completionPct}%)`
          )
        ),
        h(
          "div",
          { style: kpiCardStyle },
          h(
            "span",
            { style: { fontSize: "11px", color: "var(--text-muted)" } },
            "Story Points"
          ),
          h(
            "span",
            {
              style: {
                fontSize: "20px",
                fontWeight: 700,
                color: "#a5b4fc",
                fontFamily: "var(--font-mono)",
              },
            },
            `${summary.completedPoints} / ${summary.totalPoints} SP`
          )
        ),
        h(
          "div",
          { style: kpiCardStyle },
          h(
            "span",
            { style: { fontSize: "11px", color: "var(--text-muted)" } },
            isEn ? "Blocked / Impediments" : "Blockiert"
          ),
          h(
            "span",
            {
              style: {
                fontSize: "20px",
                fontWeight: 700,
                color:
                  summary.blockedCount > 0
                    ? "var(--accent-red)"
                    : "var(--text-secondary)",
              },
            },
            String(summary.blockedCount)
          )
        )
      ),
      h(
        "div",
        {
          style: {
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          },
        },
        h(
          "div",
          {
            style: {
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              color: "var(--text-muted)",
            },
          },
          isEn ? "Status Breakdown" : "Status-Verteilung"
        ),
        ...Array.from(statusBuckets.entries()).map(([statusKey, bucket]) => {
          const pct =
            displayedRecords.length > 0
              ? Math.round((bucket.count / displayedRecords.length) * 100)
              : 0;
          const colors = getStatusColors(statusKey);
          return h(
            "div",
            {
              key: statusKey,
              style: {
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "12px",
              },
            },
            h(
              "div",
              { style: { width: "120px" } },
              renderStatusPill(statusKey, false)
            ),
            h(
              "div",
              {
                style: {
                  flex: 1,
                  height: "8px",
                  borderRadius: "999px",
                  backgroundColor: "var(--bg-panel)",
                  overflow: "hidden",
                },
              },
              h("div", {
                style: {
                  width: `${pct}%`,
                  height: "100%",
                  backgroundColor: colors.color,
                  borderRadius: "999px",
                },
              })
            ),
            h(
              "span",
              {
                style: {
                  width: "95px",
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                },
              },
              bucket.points > 0
                ? `${bucket.count} (${bucket.points} SP)`
                : `${bucket.count} (${pct}%)`
            )
          );
        })
      )
    );
  };

  const viewBtn = (mode: QueryViewMode, label: string, IconComp: React.ElementType) => {
    const active = activeView === mode;
    return h(
      "button",
      {
        type: "button",
        onClick: () => setViewOverride(mode),
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 8px",
          borderRadius: "5px",
          fontSize: "11px",
          fontWeight: 600,
          cursor: "pointer",
          border: active
            ? "1px solid rgba(99, 102, 241, 0.5)"
            : "1px solid transparent",
          backgroundColor: active
            ? "rgba(99, 102, 241, 0.18)"
            : "transparent",
          color: active ? "#c7d2fe" : "var(--text-muted)",
        },
      },
      h(IconComp, { size: 12 }),
      label
    );
  };

  return h(
    "div",
    {
      style: {
        margin: "16px 0",
        border: "1px solid var(--border-color)",
        borderRadius: "10px",
        backgroundColor: "var(--bg-editor)",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      },
    },
    // Top Macro Header Bar
    h(
      "div",
      {
        style: {
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "10px 14px",
          backgroundColor: "var(--bg-sidebar)",
          borderBottom: "1px solid var(--border-color)",
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
        h(
          "span",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "2px 8px",
              borderRadius: "4px",
              backgroundColor: "rgba(99, 102, 241, 0.16)",
              color: "#a5b4fc",
              fontSize: "10.5px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            },
          },
          h(Database, { size: 11 }),
          isEn ? "Live Query" : "Live-Abfrage"
        ),
        h(
          "span",
          {
            style: {
              fontSize: "11.5px",
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
              fontWeight: 600,
            },
          },
          `FROM ${baseExecution.parsed.source.toUpperCase()}`
        ),
        ...baseExecution.parsed.conditions.map((c, idx) =>
          h(
            "span",
            {
              key: `${c.field}-${idx}`,
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                padding: "1px 6px",
                borderRadius: "4px",
                backgroundColor: "var(--bg-panel)",
                border: "1px solid var(--border-color)",
                fontSize: "10.5px",
                fontFamily: "var(--font-mono)",
                color: "var(--text-secondary)",
              },
            },
            h(Filter, { size: 9 }),
            `${c.field} ${c.operator} ${c.value}`
          )
        )
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
        // Quick filter input
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 8px",
              borderRadius: "5px",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
            },
          },
          h(Search, { size: 11, style: { color: "var(--text-muted)" } }),
          h("input", {
            type: "text",
            value: searchFilter,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchFilter(e.target.value),
            placeholder: isEn ? "Filter rows..." : "Zeilen filtern...",
            style: {
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "11px",
              width: "105px",
            },
          })
        ),
        // View switcher
        h(
          "div",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
              padding: "2px",
              borderRadius: "6px",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
            },
          },
          viewBtn("table", isEn ? "Table" : "Tabelle", TableIcon),
          viewBtn("cards", isEn ? "Cards" : "Karten", LayoutGrid),
          viewBtn("stats", isEn ? "Stats" : "Statistik", BarChart3)
        )
      )
    ),

    // Parse warning if any
    baseExecution.parsed.parseError
      ? h(
          "div",
          {
            style: {
              padding: "8px 14px",
              backgroundColor: "rgba(245, 158, 11, 0.1)",
              borderBottom: "1px solid var(--border-color)",
              color: "var(--accent-yellow)",
              fontSize: "11.5px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            },
          },
          h(AlertCircle, { size: 13 }),
          baseExecution.parsed.parseError
        )
      : null,

    // Body content
    displayedRecords.length === 0
      ? h(
          "div",
          {
            style: {
              padding: "24px 16px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "12.5px",
            },
          },
          isEn
            ? "No workspace documents or issues match this query."
            : "Keine Dokumente oder Tickets entsprechen dieser Abfrage."
        )
      : activeView === "cards"
      ? renderCardsView()
      : activeView === "stats"
      ? renderStatsView()
      : renderTableView(),

    // Footer Progress & Totals Bar
    h(
      "div",
      {
        style: {
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "8px 14px",
          backgroundColor: "var(--bg-panel)",
          borderTop: "1px solid var(--border-color)",
          fontSize: "11.5px",
          color: "var(--text-secondary)",
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" } },
        h(
          "span",
          { style: { display: "inline-flex", alignItems: "center", gap: "5px" } },
          h(Sparkles, { size: 12, style: { color: "var(--accent-indigo)" } }),
          `${displayedRecords.length} ${isEn ? "items" : "Einträge"}`
        ),
        h(
          "span",
          { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
          h(CheckCircle2, { size: 12, style: { color: "var(--accent-green)" } }),
          `${baseExecution.summary.doneCount}/${baseExecution.summary.totalCount} ${
            isEn ? "done" : "erledigt"
          }`
        ),
        showPointsColumn
          ? h(
              "span",
              {
                style: {
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  color: "#a5b4fc",
                },
              },
              `${baseExecution.summary.completedPoints} / ${baseExecution.summary.totalPoints} SP`
            )
          : null
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", minWidth: "160px" } },
        h(
          "div",
          {
            style: {
              flex: 1,
              height: "6px",
              borderRadius: "999px",
              backgroundColor: "var(--bg-active)",
              overflow: "hidden",
            },
          },
          h("div", {
            style: {
              width: `${baseExecution.summary.completionPct}%`,
              height: "100%",
              background:
                "linear-gradient(90deg, var(--accent-indigo), var(--accent-green))",
              borderRadius: "999px",
              transition: "width 0.25s ease",
            },
          })
        ),
        h(
          "span",
          {
            style: {
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-primary)",
            },
          },
          `${baseExecution.summary.completionPct}%`
        )
      )
    )
  );
}

export default LiveQueryBlock;
