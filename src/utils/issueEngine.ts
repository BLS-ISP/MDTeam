export interface WorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

export type IssueType = "epic" | "story" | "bug" | "task" | "spike";
export type IssueStatus = "backlog" | "ready" | "in-progress" | "review" | "done";
export type IssuePriority = "critical" | "high" | "medium" | "low";

export interface AgileIssue {
  id: string;
  type: IssueType;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  storyPoints: number;
  sprint: string;
  epic: string;
  assignee: string;
  reporter: string;
  labels: string[];
  blockedBy: string[];
  branch: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  acceptanceCriteria: { text: string; checked: boolean }[];
  comments: { author: string; timestamp: string; text: string }[];
  startDate?: string;
  endDate?: string;
  filePath: string;
  isVirtualLegacy?: boolean;
}

export interface AgileSprint {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  state: "planned" | "active" | "closed";
  committedPoints: number;
  completedPoints?: number;
  filePath: string;
}

export interface SprintSeriesPoint {
  dayIndex: number;
  label: string;
  date: string;
  idealRemaining: number;
  actualRemaining: number | null;
  completedPoints: number | null;
  scopePoints: number;
}

export interface CumulativeFlowDayPoint {
  dayIndex: number;
  label: string;
  date: string;
  backlog: number;
  ready: number;
  inProgress: number;
  review: number;
  done: number;
}

export interface SprintMetrics {
  // Concise Story Point sums
  total: number;
  completed: number;
  inProgress: number;
  review: number;
  ready: number;
  backlog: number;
  todo: number;
  remaining: number;
  committed: number;
  scopeCreep: number;

  // Explicit Story Point sums
  totalPoints: number;
  completedPoints: number;
  inProgressPoints: number;
  reviewPoints: number;
  readyPoints: number;
  backlogPoints: number;
  todoPoints: number;
  remainingPoints: number;
  committedPoints: number;
  scopeCreepPoints: number;
  completionRate: number;

  // Counts & distributions
  totalIssues: number;
  completedIssues: number;
  blockedIssues: AgileIssue[];
  cumulativeFlowCounts: Record<IssueStatus, number>;
  statusCounts: Record<IssueStatus, number>;
  pointsByStatus: Record<IssueStatus, number>;

  // Time-series charts
  burndownSeries: SprintSeriesPoint[];
  burnupSeries: SprintSeriesPoint[];
  cfdSeries: CumulativeFlowDayPoint[];
}

export interface GanttBar {
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
  durationDays: number;
  leftPercent: number;
  widthPercent: number;
  progressPercent: number;
  storyPoints?: number;
  completedPoints?: number;
  blockedBy: string[];
  epic?: string;
  color?: string;
  filePath: string;
}

export interface GanttTimelineResult {
  bars: GanttBar[];
  axisTicks: { label: string; subLabel?: string; date: string; leftPercent: number }[];
  rangeStart: string;
  rangeEnd: string;
  rangeStartMs: number;
  rangeEndMs: number;
  totalDays: number;
  todayDate: string;
  todayPercent: number | null;
}

export interface TeamCapacityMember {
  member: string;
  days: number;
  focus: number;
  capacity: number;
}

export interface VelocityRecord {
  sprint: string;
  planned: number;
  actual: number;
}

export interface WorkspaceImpediment {
  id: string;
  source: "issue" | "markdown";
  title: string;
  assignee: string;
  blockedBy: string[];
  filePath: string;
  line?: number;
}

export const FIBONACCI_POINTS = [0, 1, 2, 3, 5, 8, 13, 21] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizePath(p: string): string {
  return (p || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function unquoteYamlString(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\");
  }
  return trimmed;
}

function escapeYamlString(val: string): string {
  const clean = (val ?? "").replace(/\r?\n/g, " ").trim();
  const escaped = clean.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function parseYamlArray(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]" || trimmed === "none" || trimmed === "null") {
    return [];
  }
  const inner =
    trimmed.startsWith("[") && trimmed.endsWith("]")
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  if (!inner) return [];

  const items: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if ((ch === '"' || ch === "'") && inner[i - 1] !== "\\") {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = ch;
      } else if (ch === quoteChar) {
        inQuotes = false;
        quoteChar = "";
      }
      current += ch;
    } else if (ch === "," && !inQuotes) {
      const cleaned = unquoteYamlString(current);
      if (cleaned) items.push(cleaned);
      current = "";
    } else {
      current += ch;
    }
  }
  const last = unquoteYamlString(current);
  if (last) items.push(last);
  return items;
}

function serializeYamlArray(items: string[]): string {
  const valid = (items || []).map((s) => s.trim()).filter(Boolean);
  if (valid.length === 0) return "[]";
  return `[${valid.map((item) => escapeYamlString(item)).join(", ")}]`;
}

interface ParsedFrontmatter {
  scalars: Record<string, string>;
  arrays: Record<string, string[]>;
  body: string;
  hasFrontmatter: boolean;
}

function extractFrontmatter(markdown: string): ParsedFrontmatter {
  const normalized = (markdown || "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  let startIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const t = lines[i].trim();
    if (t === "---") {
      startIdx = i;
      break;
    }
    if (t !== "" && !t.startsWith("# ")) {
      break;
    }
  }

  if (startIdx === -1) {
    return { scalars: {}, arrays: {}, body: normalized, hasFrontmatter: false };
  }

  let endIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) {
    return { scalars: {}, arrays: {}, body: normalized, hasFrontmatter: false };
  }

  const scalars: Record<string, string> = {};
  const arrays: Record<string, string[]> = {};
  let activeListKey: string | null = null;

  for (let i = startIdx + 1; i < endIdx; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const listItemMatch = line.match(/^\s+-\s+(.*)$/);
    if (listItemMatch && activeListKey) {
      const itemVal = unquoteYamlString(listItemMatch[1]);
      if (itemVal) {
        if (!arrays[activeListKey]) arrays[activeListKey] = [];
        arrays[activeListKey].push(itemVal);
      }
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const rawVal = line.slice(colonIdx + 1).trim();
      if (rawVal === "") {
        activeListKey = key;
        if (!arrays[key]) arrays[key] = [];
        scalars[key] = "";
      } else {
        activeListKey = null;
        scalars[key] = unquoteYamlString(rawVal);
        if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
          arrays[key] = parseYamlArray(rawVal);
        }
      }
    }
  }

  const before = lines.slice(0, startIdx).join("\n").trim();
  const after = lines.slice(endIdx + 1).join("\n").trim();
  const body = [before, after].filter(Boolean).join("\n\n");

  return { scalars, arrays, body, hasFrontmatter: true };
}

export function normalizeIssueType(raw?: string): IssueType {
  const v = (raw || "").trim().toLowerCase();
  if (v === "epic") return "epic";
  if (v === "bug" || v === "defect") return "bug";
  if (v === "task" || v === "sub-task" || v === "subtask" || v === "chore") return "task";
  if (v === "spike" || v === "research") return "spike";
  return "story";
}

export function normalizeIssueStatus(raw?: string): IssueStatus {
  const v = (raw || "").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  if (v === "done" || v === "completed" || v === "closed" || v === "resolved") return "done";
  if (v === "review" || v === "in-review" || v === "qa" || v === "code-review") return "review";
  if (v === "in-progress" || v === "inprogress" || v === "active" || v === "doing") return "in-progress";
  if (v === "ready" || v === "selected" || v === "selected-for-development" || v === "to-do-ready") return "ready";
  return "backlog";
}

export function normalizeIssuePriority(raw?: string): IssuePriority {
  const v = (raw || "").trim().toLowerCase();
  if (v === "critical" || v === "highest" || v === "blocker" || v === "p0" || v === "urgent") {
    return "critical";
  }
  if (v === "high" || v === "major" || v === "p1") return "high";
  if (v === "low" || v === "lowest" || v === "minor" || v === "trivial" || v === "p3") return "low";
  return "medium";
}

function parseCommentsSection(lines: string[]): { author: string; timestamp: string; text: string }[] {
  const comments: { author: string; timestamp: string; text: string }[] = [];
  let current: { author: string; timestamp: string; text: string } | null = null;

  const flush = () => {
    if (current && current.text.trim()) {
      comments.push({
        author: current.author.trim() || "@user",
        timestamp: current.timestamp.trim() || new Date().toISOString().slice(0, 16).replace("T", " "),
        text: current.text.trim(),
      });
    }
    current = null;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (current) current.text += "\n";
      continue;
    }
    if (trimmed === "_No comments yet._" || trimmed === "_Noch keine Kommentare._") {
      continue;
    }

    // Format 1: - **@author** *(2026-06-01 10:15)*: Text  OR  - **@author** (2026-06-01): Text
    const bulletBoldMatch = trimmed.match(
      /^[-*]\s+\*\*(.+?)\*\*\s*(?:\*\((.+?)\)\*|\((.+?)\)|\[(.+?)\])?\s*:\s*(.*)$/
    );
    if (bulletBoldMatch) {
      flush();
      current = {
        author: bulletBoldMatch[1],
        timestamp: bulletBoldMatch[2] || bulletBoldMatch[3] || bulletBoldMatch[4] || "",
        text: bulletBoldMatch[5] || "",
      };
      continue;
    }

    // Format 2: ### @author - 2026-06-01 10:15  OR  ### @author (2026-06-01)
    const headingCommentMatch = trimmed.match(
      /^###\s+(.+?)(?:\s*[-|•]\s*|\s+\()(\d{4}[-./]\d{2}[-./]\d{2}[^)]*)\)?$/
    );
    if (headingCommentMatch) {
      flush();
      current = {
        author: headingCommentMatch[1].replace(/\*\*/g, "").trim(),
        timestamp: headingCommentMatch[2].trim(),
        text: "",
      };
      continue;
    }

    // Format 3: - [2026-06-01 10:15] @author: Text  OR  - @author (2026-06-01): Text
    const simpleBulletMatch = trimmed.match(
      /^[-*]\s+(?:\[([^\]]+)\]\s+)?(@?[a-zA-Z0-9_.-]+)(?:\s*\(([^)]+)\))?\s*:\s*(.+)$/
    );
    if (simpleBulletMatch) {
      flush();
      current = {
        author: simpleBulletMatch[2],
        timestamp: simpleBulletMatch[1] || simpleBulletMatch[3] || "",
        text: simpleBulletMatch[4],
      };
      continue;
    }

    if (current) {
      const cleanCont = rawLine.replace(/^\s{2,4}/, "");
      current.text = current.text ? `${current.text}\n${cleanCont}` : cleanCont;
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      comments.push({
        author: "@team",
        timestamp: "",
        text: trimmed.slice(2).trim(),
      });
    }
  }

  flush();
  return comments;
}

export function parseIssueFromFile(file: WorkspaceFile): AgileIssue | null {
  if (!file || typeof file.content !== "string") return null;
  const cleanPath = normalizePath(file.path);
  const isIssuePath = cleanPath.startsWith("issues/") && cleanPath.endsWith(".md");

  const { scalars, arrays, body, hasFrontmatter } = extractFrontmatter(file.content);

  const hasIssueFrontmatter =
    hasFrontmatter &&
    Boolean(scalars.id || scalars.story_points !== undefined || scalars.epic !== undefined);

  if (!isIssuePath && !hasIssueFrontmatter) {
    return null;
  }

  const fileStem = (file.name || cleanPath.split("/").pop() || "MDT-000").replace(/\.md$/i, "");
  const id = (scalars.id || fileStem).trim();

  const bodyLines = body.split("\n");
  let titleFromH1 = "";
  const descriptionLines: string[] = [];
  const acLines: string[] = [];
  const commentLines: string[] = [];

  let activeSection: "preamble" | "description" | "ac" | "comments" | "other" = "preamble";

  for (const line of bodyLines) {
    const trimmed = line.trim();

    if (activeSection === "preamble" && trimmed.startsWith("# ")) {
      const rawH1 = trimmed.replace(/^#\s+/, "").trim();
      titleFromH1 = rawH1.replace(new RegExp(`^\\[?${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]?\\s*[:\\-–—]?\\s*`, "i"), "").trim() || rawH1;
      continue;
    }

    const h2Match = trimmed.match(/^##\s+(.*)$/);
    if (h2Match) {
      const heading = h2Match[1].trim().toLowerCase();
      if (heading.includes("description") || heading.includes("beschreibung") || heading.includes("user story") || heading.includes("summary")) {
        activeSection = "description";
      } else if (heading.includes("acceptance") || heading.includes("akzeptanz") || heading.includes("criteria") || heading.includes("kriterien") || heading.includes("checklist")) {
        activeSection = "ac";
      } else if (heading.includes("comment") || heading.includes("kommentar") || heading.includes("discussion")) {
        activeSection = "comments";
      } else {
        activeSection = "other";
      }
      continue;
    }

    if (activeSection === "preamble" || activeSection === "description") {
      descriptionLines.push(line);
    } else if (activeSection === "ac") {
      acLines.push(line);
    } else if (activeSection === "comments") {
      commentLines.push(line);
    }
  }

  const acceptanceCriteria: { text: string; checked: boolean }[] = [];
  for (const line of acLines) {
    const checkMatch = line.match(/^\s*[-*+]\s+\[([ xX/])\]\s*(.+)$/);
    if (checkMatch) {
      acceptanceCriteria.push({
        checked: checkMatch[1].toLowerCase() === "x",
        text: checkMatch[2].trim(),
      });
    } else {
      const bulletMatch = line.match(/^\s*[-*+]\s+(.+)$/);
      if (bulletMatch && bulletMatch[1].trim() && !bulletMatch[1].trim().startsWith("_")) {
        acceptanceCriteria.push({
          checked: false,
          text: bulletMatch[1].trim(),
        });
      }
    }
  }

  const rawSp = scalars.story_points ?? scalars.storypoints ?? scalars.points ?? "0";
  const parsedSp = Number(rawSp);
  const storyPoints = Number.isFinite(parsedSp) && parsedSp >= 0 ? parsedSp : 0;

  const labels =
    arrays.labels ??
    (scalars.labels ? parseYamlArray(scalars.labels) : []);

  const blockedBy =
    arrays.blocked_by ??
    arrays.blockedby ??
    (scalars.blocked_by ? parseYamlArray(scalars.blocked_by) : []);

  const nowIso = new Date().toISOString();
  const createdAt = scalars.created_at || scalars.createdat || nowIso;
  const updatedAt = scalars.updated_at || scalars.updatedat || createdAt;

  const startDate = (scalars.start_date || scalars.startdate || "").trim() || undefined;
  const endDate = (scalars.end_date || scalars.enddate || "").trim() || undefined;

  const cleanDescription = descriptionLines.join("\n").trim();

  return {
    id,
    type: normalizeIssueType(scalars.type),
    title: (scalars.title || titleFromH1 || id).trim(),
    status: normalizeIssueStatus(scalars.status),
    priority: normalizeIssuePriority(scalars.priority),
    storyPoints,
    sprint: (scalars.sprint || "").trim(),
    epic: (scalars.epic || "").trim(),
    assignee: (scalars.assignee || "").trim(),
    reporter: (scalars.reporter || "").trim(),
    labels,
    blockedBy,
    branch: (scalars.branch || "").trim(),
    createdAt,
    updatedAt,
    description:
      cleanDescription === "_No description provided._" || cleanDescription === "_Keine Beschreibung vorhanden._"
        ? ""
        : cleanDescription,
    acceptanceCriteria,
    comments: parseCommentsSection(commentLines),
    startDate,
    endDate,
    filePath: cleanPath || `issues/${id}.md`,
  };
}

export function serializeIssueToMarkdown(issue: AgileIssue): WorkspaceFile {
  const cleanId = (issue.id || "MDT-101").trim();
  const filePath =
    issue.filePath && !issue.isVirtualLegacy && normalizePath(issue.filePath).startsWith("issues/")
      ? normalizePath(issue.filePath)
      : `issues/${cleanId}.md`;
  const fileName = filePath.split("/").pop() || `${cleanId}.md`;

  const nowIso = new Date().toISOString();
  const createdAt = issue.createdAt || nowIso;
  const updatedAt = issue.updatedAt || nowIso;

  const frontmatterLines = [
    "---",
    `id: ${escapeYamlString(cleanId)}`,
    `type: ${escapeYamlString(issue.type)}`,
    `title: ${escapeYamlString(issue.title)}`,
    `status: ${escapeYamlString(issue.status)}`,
    `priority: ${escapeYamlString(issue.priority)}`,
    `story_points: ${Number.isFinite(issue.storyPoints) ? issue.storyPoints : 0}`,
    `sprint: ${escapeYamlString(issue.sprint || "")}`,
    `epic: ${escapeYamlString(issue.epic || "")}`,
    `assignee: ${escapeYamlString(issue.assignee || "")}`,
    `reporter: ${escapeYamlString(issue.reporter || "")}`,
    `labels: ${serializeYamlArray(issue.labels || [])}`,
    `blocked_by: ${serializeYamlArray(issue.blockedBy || [])}`,
    `branch: ${escapeYamlString(issue.branch || "")}`,
    `start_date: ${escapeYamlString(issue.startDate || "")}`,
    `end_date: ${escapeYamlString(issue.endDate || "")}`,
    `created_at: ${escapeYamlString(createdAt)}`,
    `updated_at: ${escapeYamlString(updatedAt)}`,
    "---",
  ];

  const acBody =
    issue.acceptanceCriteria && issue.acceptanceCriteria.length > 0
      ? issue.acceptanceCriteria
          .map((ac) => `- [${ac.checked ? "x" : " "}] ${ac.text.replace(/\r?\n/g, " ").trim()}`)
          .join("\n")
      : "- [ ] Define acceptance criteria";

  const commentsBody =
    issue.comments && issue.comments.length > 0
      ? issue.comments
          .map((c) => {
            const singleLineText = c.text.replace(/\r?\n/g, " ").trim();
            return `- **${c.author || "@user"}** *(${c.timestamp || updatedAt.slice(0, 16).replace("T", " ")})*: ${singleLineText}`;
          })
          .join("\n")
      : "";

  const mdSections = [
    frontmatterLines.join("\n"),
    "",
    `# ${cleanId}: ${issue.title.trim()}`,
    "",
    "## Description",
    "",
    issue.description?.trim() || "_No description provided._",
    "",
    "## Acceptance Criteria",
    "",
    acBody,
    "",
    "## Comments",
    "",
    commentsBody,
  ];

  return {
    path: filePath,
    name: fileName,
    category: "issues",
    content: mdSections.join("\n").trimEnd() + "\n",
  };
}

interface LegacyTaskLine {
  lineIndex: number;
  rawLine: string;
  status: IssueStatus;
  title: string;
  assignee: string;
  isBlocked: boolean;
  alreadyMigratedRef: string | null;
}

function parseLegacyBacklogLines(backlogContent: string): LegacyTaskLine[] {
  const lines = (backlogContent || "").replace(/\r\n/g, "\n").split("\n");
  const results: LegacyTaskLine[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const match = trimmed.match(/^[-*]\s+\[([ xX/])\]\s*(.+)$/);
    if (!match) return;

    const checkChar = match[1].toLowerCase();
    let rest = match[2].trim();

    // Check if already migrated e.g. [Migrated -> MDT-106] or links to issues/MDT-...
    const migratedMatch = rest.match(/\[(?:Migrated\s*(?:->|→)\s*)?([A-Z]+-\d+)\]\(issues\/[^)]+\)/i);
    const alreadyMigratedRef = migratedMatch ? migratedMatch[1] : null;

    let status: IssueStatus = "backlog";
    if (checkChar === "x" || /^DONE\s*:/i.test(rest)) {
      status = "done";
    } else if (checkChar === "/" || /^IN[- ]PROGRESS\s*:/i.test(rest)) {
      status = "in-progress";
    } else if (/^READY\s*:/i.test(rest)) {
      status = "ready";
    } else if (/^TODO\s*:/i.test(rest)) {
      status = "backlog";
    } else {
      // Only treat lines inside sprint-backlog task list with TODO/IN-PROGRESS/DONE/BLOCKED or task syntax as legacy tasks
      if (!/@[a-zA-Z0-9_-]+/.test(rest) && !/^BLOCKED\s*:/i.test(rest)) {
        return;
      }
    }

    const isBlocked = /\bBLOCKED\b|\bBLOCKER\b/i.test(rest);
    rest = rest.replace(/^(?:TODO|IN[- ]PROGRESS|DONE|READY|BLOCKED|BLOCKER)\s*:\s*/i, "");

    let assignee = "";
    const assigneeMatch = rest.match(/(@[a-zA-Z0-9_.-]+)\s*$/);
    if (assigneeMatch) {
      assignee = assigneeMatch[1];
      rest = rest.slice(0, assigneeMatch.index).trim();
    } else {
      const anyHandle = rest.match(/(@[a-zA-Z0-9_.-]+)/);
      if (anyHandle) {
        assignee = anyHandle[1];
      }
    }

    const cleanTitle = rest.replace(/\s*\[(?:Migrated.*?)\]\(issues\/[^)]+\)\s*$/i, "").trim();
    if (!cleanTitle) return;

    results.push({
      lineIndex: idx,
      rawLine: line,
      status,
      title: cleanTitle,
      assignee,
      isBlocked,
      alreadyMigratedRef,
    });
  });

  return results;
}

export function generateNextIssueId(files: WorkspaceFile[], prefix: string = "MDT"): string {
  const cleanPrefix = (prefix || "MDT").trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "MDT";
  const regex = new RegExp(`^${cleanPrefix}-(\\d+)$`, "i");
  let maxNumber = 100;

  for (const file of files || []) {
    const cleanPath = normalizePath(file.path);
    if (cleanPath.startsWith("issues/") && cleanPath.endsWith(".md")) {
      const stem = (file.name || cleanPath.split("/").pop() || "").replace(/\.md$/i, "");
      const stemMatch = stem.match(regex);
      if (stemMatch) {
        const num = parseInt(stemMatch[1], 10);
        if (Number.isFinite(num) && num > maxNumber) maxNumber = num;
      }
      const parsed = parseIssueFromFile(file);
      if (parsed) {
        const idMatch = parsed.id.match(regex);
        if (idMatch) {
          const num = parseInt(idMatch[1], 10);
          if (Number.isFinite(num) && num > maxNumber) maxNumber = num;
        }
      }
    }
  }

  return `${cleanPrefix}-${maxNumber + 1}`;
}

export function extractAllIssues(files: WorkspaceFile[]): AgileIssue[] {
  const realIssues: AgileIssue[] = [];
  const existingTitles = new Set<string>();
  const existingIds = new Set<string>();

  for (const file of files || []) {
    const cleanPath = normalizePath(file.path);
    if (cleanPath.startsWith("issues/") && cleanPath.endsWith(".md")) {
      const issue = parseIssueFromFile(file);
      if (issue) {
        realIssues.push(issue);
        existingIds.add(issue.id.toUpperCase());
        existingTitles.add(issue.title.trim().toLowerCase());
      }
    }
  }

  realIssues.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  // Map unmigrated legacy lines from management/sprint-backlog.md as virtual issues
  const legacyFile = (files || []).find(
    (f) => normalizePath(f.path) === "management/sprint-backlog.md"
  );

  const virtualIssues: AgileIssue[] = [];
  if (legacyFile) {
    const legacyLines = parseLegacyBacklogLines(legacyFile.content);
    legacyLines.forEach((item, idx) => {
      if (item.alreadyMigratedRef && existingIds.has(item.alreadyMigratedRef.toUpperCase())) {
        return;
      }
      if (existingTitles.has(item.title.toLowerCase())) {
        return;
      }
      const virtualId = `LEGACY-${idx + 1}`;
      virtualIssues.push({
        id: virtualId,
        type: "task",
        title: item.title,
        status: item.status,
        priority: item.isBlocked ? "high" : "medium",
        storyPoints: 1,
        sprint: "",
        epic: "",
        assignee: item.assignee,
        reporter: "@scrummaster",
        labels: item.isBlocked ? ["legacy", "blocked"] : ["legacy"],
        blockedBy: item.isBlocked ? ["IMPEDIMENT"] : [],
        branch: "",
        createdAt: "2026-06-01T08:00:00Z",
        updatedAt: "2026-06-01T08:00:00Z",
        description: `Imported virtual task from \`management/sprint-backlog.md\` (Line ${item.lineIndex + 1}). Convert legacy backlog or edit this ticket to persist as an atomic \`issues/MDT-*.md\` file.`,
        acceptanceCriteria: [{ text: item.title, checked: item.status === "done" }],
        comments: [],
        filePath: "management/sprint-backlog.md",
        isVirtualLegacy: true,
      });
    });
  }

  return [...realIssues, ...virtualIssues];
}

export function migrateLegacyBacklogToIssues(
  files: WorkspaceFile[],
  prefix: string = "MDT"
): WorkspaceFile[] {
  const legacyFile = (files || []).find(
    (f) => normalizePath(f.path) === "management/sprint-backlog.md"
  );
  if (!legacyFile) return [];

  const existingIssues = extractAllIssues(files).filter((i) => !i.isVirtualLegacy);
  const existingTitles = new Set(existingIssues.map((i) => i.title.trim().toLowerCase()));
  const existingIds = new Set(existingIssues.map((i) => i.id.toUpperCase()));

  const parsedLines = parseLegacyBacklogLines(legacyFile.content);
  const toMigrate = parsedLines.filter((item) => {
    if (item.alreadyMigratedRef && existingIds.has(item.alreadyMigratedRef.toUpperCase())) {
      return false;
    }
    return !existingTitles.has(item.title.toLowerCase());
  });

  if (toMigrate.length === 0) return [];

  const workingFiles = [...files];
  const createdFiles: WorkspaceFile[] = [];
  const rawLines = legacyFile.content.replace(/\r\n/g, "\n").split("\n");
  const nowIso = new Date().toISOString();

  const activeSprints = parseSprints(files);
  const targetSprint = activeSprints.find((s) => s.state === "active")?.id || "";

  for (const item of toMigrate) {
    const newId = generateNextIssueId(workingFiles, prefix);
    const newIssue: AgileIssue = {
      id: newId,
      type: "task",
      title: item.title,
      status: item.status,
      priority: item.isBlocked ? "high" : "medium",
      storyPoints: 2,
      sprint: item.status === "in-progress" || item.status === "done" ? targetSprint : "",
      epic: "",
      assignee: item.assignee,
      reporter: "@scrummaster",
      labels: ["migrated-backlog", ...(item.isBlocked ? ["blocked"] : [])],
      blockedBy: item.isBlocked ? ["IMPEDIMENT"] : [],
      branch: "",
      createdAt: nowIso,
      updatedAt: nowIso,
      description: `Migrated from legacy \`management/sprint-backlog.md\`.\n\nOriginal entry: \`${item.rawLine.trim()}\``,
      acceptanceCriteria: [
        {
          text: item.title,
          checked: item.status === "done",
        },
      ],
      comments: [],
      filePath: `issues/${newId}.md`,
    };

    const issueFile = serializeIssueToMarkdown(newIssue);
    createdFiles.push(issueFile);
    workingFiles.push(issueFile);

    // Annotate legacy line with link to new issue file so it isn't migrated twice
    rawLines[item.lineIndex] = `${rawLines[item.lineIndex]} ([${newId}](issues/${newId}.md))`;
  }

  const updatedLegacyFile: WorkspaceFile = {
    ...legacyFile,
    content: rawLines.join("\n"),
  };

  return [...createdFiles, updatedLegacyFile];
}

export function parseSprints(files: WorkspaceFile[]): AgileSprint[] {
  const sprints: AgileSprint[] = [];

  for (const file of files || []) {
    const cleanPath = normalizePath(file.path);
    if (!cleanPath.startsWith("sprints/") || !cleanPath.endsWith(".md")) continue;

    const { scalars, body } = extractFrontmatter(file.content);
    const stem = (file.name || cleanPath.split("/").pop() || "sprint-01").replace(/\.md$/i, "");
    const id = (scalars.id || stem).trim();

    let goalFromBody = "";
    const lines = body.split("\n");
    let inGoal = false;
    for (const line of lines) {
      const t = line.trim();
      if (/^##\s+(sprint\s+goal|sprint-ziel|ziel|goal)/i.test(t)) {
        inGoal = true;
        continue;
      }
      if (inGoal && t.startsWith("## ")) {
        break;
      }
      if (inGoal && t) {
        goalFromBody += (goalFromBody ? " " : "") + t;
      }
    }

    const rawState = (scalars.state || scalars.status || "planned").toLowerCase();
    const state: "planned" | "active" | "closed" =
      rawState === "active" || rawState === "in-progress"
        ? "active"
        : rawState === "closed" || rawState === "completed" || rawState === "done"
        ? "closed"
        : "planned";

    const committedRaw = Number(scalars.committed_points ?? scalars.committedpoints ?? 0);
    const completedRaw =
      scalars.completed_points !== undefined ? Number(scalars.completed_points) : undefined;

    sprints.push({
      id,
      name: (scalars.name || scalars.title || id).trim(),
      goal: (scalars.goal || goalFromBody || "").trim(),
      startDate: (scalars.start_date || scalars.startdate || "2026-06-01").trim(),
      endDate: (scalars.end_date || scalars.enddate || "2026-06-14").trim(),
      state,
      committedPoints: Number.isFinite(committedRaw) ? committedRaw : 0,
      completedPoints: completedRaw !== undefined && Number.isFinite(completedRaw) ? completedRaw : undefined,
      filePath: cleanPath,
    });
  }

  sprints.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return sprints;
}

export function serializeSprintToMarkdown(sprint: AgileSprint): WorkspaceFile {
  const cleanId = (sprint.id || "sprint-01").trim();
  const filePath = sprint.filePath ? normalizePath(sprint.filePath) : `sprints/${cleanId}.md`;
  const fileName = filePath.split("/").pop() || `${cleanId}.md`;

  const lines = [
    "---",
    `id: ${escapeYamlString(cleanId)}`,
    `name: ${escapeYamlString(sprint.name || cleanId)}`,
    `goal: ${escapeYamlString(sprint.goal || "")}`,
    `state: ${escapeYamlString(sprint.state)}`,
    `start_date: ${escapeYamlString(sprint.startDate || "")}`,
    `end_date: ${escapeYamlString(sprint.endDate || "")}`,
    `committed_points: ${Number.isFinite(sprint.committedPoints) ? sprint.committedPoints : 0}`,
  ];

  if (sprint.completedPoints !== undefined && Number.isFinite(sprint.completedPoints)) {
    lines.push(`completed_points: ${sprint.completedPoints}`);
  }
  lines.push("---");
  lines.push("");
  lines.push(`# ${sprint.name || cleanId}`);
  lines.push("");
  lines.push("## Sprint Goal");
  lines.push("");
  lines.push(sprint.goal || "_Define sprint goal..._");
  lines.push("");

  return {
    path: filePath,
    name: fileName,
    category: "sprints",
    content: lines.join("\n"),
  };
}

function normalizeHandle(handle?: string): string {
  const clean = (handle || "").trim().toLowerCase();
  if (!clean) return "";
  return clean.startsWith("@") ? clean.slice(1) : clean;
}

function tokenizeQuery(query: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < query.length; i++) {
    const ch = query[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (/\s/.test(ch) && !inQuotes) {
      if (current.trim()) tokens.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

export function filterIssuesJql(
  issues: AgileIssue[],
  query: string,
  currentUser?: string
): AgileIssue[] {
  const trimmed = (query || "").trim();
  if (!trimmed) return issues;

  // Normalize classic JQL operators like "status != done" or "type = bug" into compact tokens
  const normalizedQuery = trimmed
    .replace(/\s*!=\s*/g, ":!")
    .replace(/\s*=\s*/g, ":");

  const rawTokens = tokenizeQuery(normalizedQuery);
  const meNorm = normalizeHandle(currentUser || "@developer-a");

  // Detect active sprint heuristic from issues if "sprint:active" is used
  const sprintCounts: Record<string, number> = {};
  issues.forEach((iss) => {
    if (iss.sprint) sprintCounts[iss.sprint.toLowerCase()] = (sprintCounts[iss.sprint.toLowerCase()] || 0) + 1;
  });
  const inferredActiveSprint = Object.keys(sprintCounts).sort()[0] || "sprint-01";

  return issues.filter((issue) => {
    for (const rawToken of rawTokens) {
      const upper = rawToken.toUpperCase();
      if (upper === "AND" || upper === "&&") continue;

      let negated = false;
      let token = rawToken;
      if (token.startsWith("-") || token.startsWith("!")) {
        negated = true;
        token = token.slice(1);
      }

      const colonIdx = token.indexOf(":");
      if (colonIdx > 0) {
        const key = token.slice(0, colonIdx).trim().toLowerCase();
        let valRaw = token.slice(colonIdx + 1).trim();
        if (valRaw.startsWith("!")) {
          negated = !negated;
          valRaw = valRaw.slice(1).trim();
        }
        valRaw = unquoteYamlString(valRaw);
        const vals = valRaw
          .split(",")
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean);

        let matched = true;

        if (key === "type" || key === "issuetype") {
          matched = vals.some((v) => issue.type.toLowerCase() === v);
        } else if (key === "status") {
          matched = vals.some((v) => {
            if (v === "open" || v === "unresolved") return issue.status !== "done";
            return issue.status.toLowerCase() === v || normalizeIssueStatus(v) === issue.status;
          });
        } else if (key === "priority") {
          matched = vals.some(
            (v) => issue.priority.toLowerCase() === v || normalizeIssuePriority(v) === issue.priority
          );
        } else if (key === "sprint") {
          matched = vals.some((v) => {
            if (v === "none" || v === "backlog" || v === "empty" || v === "unassigned") {
              return !issue.sprint;
            }
            if (v === "active" || v === "current") {
              return Boolean(issue.sprint) && (issue.sprint.toLowerCase() === inferredActiveSprint || Boolean(issue.sprint));
            }
            return issue.sprint.toLowerCase() === v;
          });
        } else if (key === "epic") {
          matched = vals.some((v) => {
            if (v === "none" || v === "empty") return !issue.epic;
            return issue.epic.toLowerCase() === v;
          });
        } else if (key === "assignee" || key === "owner") {
          matched = vals.some((v) => {
            if (v === "unassigned" || v === "none" || v === "empty") {
              return !issue.assignee || issue.assignee.toLowerCase() === "unassigned";
            }
            const target = v === "@me" || v === "me" ? meNorm : normalizeHandle(v);
            return normalizeHandle(issue.assignee) === target;
          });
        } else if (key === "reporter" || key === "author") {
          matched = vals.some((v) => {
            const target = v === "@me" || v === "me" ? meNorm : normalizeHandle(v);
            return normalizeHandle(issue.reporter) === target;
          });
        } else if (key === "label" || key === "labels" || key === "tag") {
          matched = vals.some((v) =>
            issue.labels.some((lbl) => lbl.toLowerCase() === v || lbl.toLowerCase().includes(v))
          );
        } else if (key === "is" || key === "has") {
          matched = vals.some((v) => {
            if (v === "blocked" || v === "impediment") {
              return (
                issue.blockedBy.length > 0 ||
                issue.labels.some((l) => l.toLowerCase() === "blocked") ||
                /\bBLOCKED\b/i.test(issue.title)
              );
            }
            if (v === "open" || v === "unresolved") return issue.status !== "done";
            if (v === "done" || v === "completed" || v === "closed") return issue.status === "done";
            if (v === "unassigned") return !issue.assignee || issue.assignee.toLowerCase() === "unassigned";
            if (v === "unestimated") return !issue.storyPoints || issue.storyPoints === 0;
            if (v === "branch") return Boolean(issue.branch);
            return false;
          });
        } else if (key === "id" || key === "key") {
          matched = vals.some((v) => issue.id.toLowerCase() === v || issue.id.toLowerCase().includes(v));
        } else {
          // Unknown prefix: fallback to full-text search
          const needle = token.toLowerCase();
          matched =
            issue.id.toLowerCase().includes(needle) ||
            issue.title.toLowerCase().includes(needle) ||
            issue.description.toLowerCase().includes(needle);
        }

        if (negated ? matched : !matched) return false;
      } else {
        const needle = unquoteYamlString(token).toLowerCase();
        if (!needle) continue;

        const textMatch =
          issue.id.toLowerCase().includes(needle) ||
          issue.title.toLowerCase().includes(needle) ||
          issue.description.toLowerCase().includes(needle) ||
          issue.assignee.toLowerCase().includes(needle) ||
          issue.epic.toLowerCase().includes(needle) ||
          issue.labels.some((l) => l.toLowerCase().includes(needle));

        if (negated ? textMatch : !textMatch) return false;
      }
    }
    return true;
  });
}

function parseDateMs(dateStr?: string): number | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const isoDay = trimmed.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) {
    const [y, m, d] = isoDay.split("-").map(Number);
    const ms = Date.UTC(y, m - 1, d);
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatUtcDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatShortDayLabel(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day}.${m}`;
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
          endMs: safeEnd,
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

export function suggestBranchName(issue: AgileIssue): string {
  const prefix =
    issue.type === "bug"
      ? "fix"
      : issue.type === "task"
      ? "chore"
      : issue.type === "spike"
      ? "spike"
      : "feat";
  const slug = (issue.title || "work")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36)
    .replace(/-+$/, "");
  return `${prefix}/${issue.id}-${slug || "implementation"}`;
}

export function createBlankIssue(
  files: WorkspaceFile[],
  currentUser: string,
  defaults?: Partial<AgileIssue>
): AgileIssue {
  const nextId = defaults?.id || generateNextIssueId(files, "MDT");
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  return {
    id: nextId,
    type: defaults?.type || "story",
    title: defaults?.title || "",
    status: defaults?.status || "backlog",
    priority: defaults?.priority || "medium",
    storyPoints: defaults?.storyPoints ?? 3,
    sprint: defaults?.sprint ?? "",
    epic: defaults?.epic ?? "",
    assignee: defaults?.assignee ?? currentUser ?? "@developer-a",
    reporter: defaults?.reporter || currentUser || "@product-owner",
    labels: defaults?.labels || [],
    blockedBy: defaults?.blockedBy || [],
    branch: defaults?.branch || "",
    createdAt: nowIso,
    updatedAt: nowIso,
    description: defaults?.description || "",
    acceptanceCriteria: defaults?.acceptanceCriteria || [
      { text: "Implementation reviewed & tested", checked: false },
    ],
    comments: defaults?.comments || [],
    startDate: defaults?.startDate || today,
    endDate: defaults?.endDate || formatUtcDate((parseDateMs(today) || Date.now()) + 7 * DAY_MS),
    filePath: `issues/${nextId}.md`,
  };
}

export function parseCapacityAndVelocity(files: WorkspaceFile[]): {
  capacity: TeamCapacityMember[];
  velocity: VelocityRecord[];
  totalCapacitySp: number;
} {
  const capFile = (files || []).find(
    (f) => normalizePath(f.path) === "management/capacity.md"
  );
  if (!capFile) {
    return { capacity: [], velocity: [], totalCapacitySp: 0 };
  }

  const capacity: TeamCapacityMember[] = [];
  const velocity: VelocityRecord[] = [];
  let section: "none" | "velocity" | "capacity" = "none";

  for (const rawLine of capFile.content.replace(/\r\n/g, "\n").split("\n")) {
    const t = rawLine.trim();
    if (/^##\s+(Historische Velocity|Historical Velocity)/i.test(t)) {
      section = "velocity";
      continue;
    }
    if (/^##\s+(Team-Kapazität|Team Capacity)/i.test(t)) {
      section = "capacity";
      continue;
    }
    if (t.startsWith("## ")) {
      section = "none";
      continue;
    }

    if (!t.startsWith("|") || t.includes("---")) continue;
    const cols = t
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);

    if (section === "velocity" && cols.length >= 3 && !/sprint/i.test(cols[1])) {
      const planned = parseFloat(cols[1]);
      const actual = parseFloat(cols[2]);
      if (Number.isFinite(planned) && Number.isFinite(actual)) {
        velocity.push({ sprint: cols[0], planned, actual });
      }
    } else if (section === "capacity" && cols.length >= 4 && !/tage|days/i.test(cols[1])) {
      const days = parseFloat(cols[1]);
      const focus = parseFloat(cols[2]);
      const cap = parseFloat(cols[3]);
      if (Number.isFinite(days) && Number.isFinite(focus) && Number.isFinite(cap)) {
        capacity.push({ member: cols[0], days, focus, capacity: cap });
      }
    }
  }

  const totalCapacitySp = Number(
    capacity.reduce((sum, m) => sum + m.capacity, 0).toFixed(1)
  );

  return { capacity, velocity, totalCapacitySp };
}

export function appendCompletedSprintToCapacity(
  files: WorkspaceFile[],
  sprintName: string,
  plannedSp: number,
  completedSp: number
): WorkspaceFile {
  const existing = (files || []).find(
    (f) => normalizePath(f.path) === "management/capacity.md"
  );
  const { capacity, velocity } = parseCapacityAndVelocity(files);

  const updatedVelocity = [...velocity];
  const existingIdx = updatedVelocity.findIndex(
    (v) => v.sprint.toLowerCase() === sprintName.toLowerCase()
  );
  if (existingIdx >= 0) {
    updatedVelocity[existingIdx] = {
      sprint: sprintName,
      planned: plannedSp,
      actual: completedSp,
    };
  } else {
    updatedVelocity.push({
      sprint: sprintName,
      planned: plannedSp,
      actual: completedSp,
    });
  }

  const defaultCapacity =
    capacity.length > 0
      ? capacity
      : [
          { member: "@developer-a", days: 10, focus: 0.8, capacity: 8.0 },
          { member: "@developer-b", days: 8, focus: 0.7, capacity: 5.6 },
          { member: "@scrummaster", days: 5, focus: 0.4, capacity: 2.0 },
        ];

  let content = `# Sprint-Kapazität & Velocity\n\nHistorische Velocity und aktuelle Teamberechnungen.\n\n## Historische Velocity\n\n| Sprint | Geplant (Story Points) | Erreicht (Story Points) |\n| :----- | :--------------------- | :---------------------- |\n`;
  for (const v of updatedVelocity) {
    content += `| ${v.sprint} | ${v.planned} | ${v.actual} |\n`;
  }
  content += `\n## Team-Kapazität (Aktueller Sprint)\n\n| Teammitglied | Verfügbare Tage | Fokus-Faktor | Kapazität (SP) |\n| :----------- | :-------------- | :----------- | :------------- |\n`;
  for (const c of defaultCapacity) {
    content += `| ${c.member} | ${c.days} | ${c.focus} | ${c.capacity.toFixed(1)} |\n`;
  }

  return {
    path: existing?.path || "management/capacity.md",
    name: existing?.name || "capacity.md",
    category: existing?.category || "management",
    content,
  };
}

export function extractImpediments(
  files: WorkspaceFile[],
  issues: AgileIssue[]
): WorkspaceImpediment[] {
  const items: WorkspaceImpediment[] = [];

  // 1. Blocked AgileIssues
  for (const issue of issues || []) {
    if (issue.status === "done") continue;
    const isBlocked =
      issue.blockedBy.length > 0 ||
      issue.labels.some((l) => l.toLowerCase() === "blocked") ||
      /\bBLOCKED\b/i.test(issue.title);
    if (isBlocked) {
      items.push({
        id: issue.id,
        source: "issue",
        title: `${issue.id}: ${issue.title}`,
        assignee: issue.assignee || "Unassigned",
        blockedBy: issue.blockedBy,
        filePath: issue.filePath,
      });
    }
  }

  // 2. Markdown - [ ] BLOCKED: lines in meetings/*.md or management/*.md
  for (const file of files || []) {
    const cleanPath = normalizePath(file.path);
    if (cleanPath.startsWith("issues/")) continue;
    const lines = file.content.replace(/\r\n/g, "\n").split("\n");
    lines.forEach((line, idx) => {
      const t = line.trim();
      const m = t.match(/^[-*]\s+\[\s\]\s*(?:BLOCKED|BLOCKER)\s*:\s*(.+)$/i);
      if (m) {
        let text = m[1].trim();
        let assignee = "@scrummaster";
        const handleMatch = text.match(/(@[a-zA-Z0-9_.-]+)/);
        if (handleMatch) {
          assignee = handleMatch[1];
          text = text.replace(handleMatch[1], "").trim();
        }
        items.push({
          id: `MD-${cleanPath}-${idx + 1}`,
          source: "markdown",
          title: text,
          assignee,
          blockedBy: [],
          filePath: cleanPath,
          line: idx + 1,
        });
      }
    });
  }

  return items;
}
