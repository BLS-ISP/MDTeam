import type { WorkspaceFile } from "../../types/workspace";

export interface Diagnostic {
  filePath: string;
  line: number;
  severity: "error" | "warning" | "info";
  message: string;
  code?: string;
}

export type MsgFormatter = (de: string, en: string) => string;

export interface ParsedIssueLintMeta {
  filePath: string;
  id: string;
  type: string;
  title: string;
  status: string;
  sprint: string;
  assignee: string;
  storyPoints: number;
  blockedBy: string[];
  startDate: string;
  endDate: string;
  lines: {
    id: number;
    title: number;
    status: number;
    assignee: number;
    storyPoints: number;
    blockedBy: number;
    startDate: number;
    endDate: number;
  };
}

function extractYamlList(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]") return [];
  const inner = trimmed.replace(/^\[|\]$/g, "");
  return inner
    .split(",")
    .map(item => item.trim().replace(/^["']|["']$/g, "").trim())
    .filter(Boolean);
}

export function parseIssueLintMetadata(file: WorkspaceFile): ParsedIssueLintMeta | null {
  if (!file.path.startsWith("issues/") || !file.path.endsWith(".md")) return null;
  const rawLines = file.content.split(/\r?\n/);
  if ((rawLines[0] || "").trim() !== "---") return null;

  let endIdx = -1;
  for (let i = 1; i < rawLines.length; i++) {
    if (rawLines[i].trim() === "---") {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) return null;

  const meta: ParsedIssueLintMeta = {
    filePath: file.path,
    id: "",
    type: "task",
    title: "",
    status: "backlog",
    sprint: "",
    assignee: "",
    storyPoints: 0,
    blockedBy: [],
    startDate: "",
    endDate: "",
    lines: {
      id: 2,
      title: 2,
      status: 2,
      assignee: 2,
      storyPoints: 2,
      blockedBy: 2,
      startDate: 2,
      endDate: 2,
    },
  };

  for (let i = 1; i < endIdx; i++) {
    const line = rawLines[i];
    const lineNum = i + 1;
    const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].trim().toLowerCase();
    const rawVal = kv[2].trim();
    const cleanVal = rawVal.replace(/^["']|["']$/g, "").trim();

    switch (key) {
      case "id":
        meta.id = cleanVal;
        meta.lines.id = lineNum;
        break;
      case "type":
        meta.type = cleanVal.toLowerCase();
        break;
      case "title":
        meta.title = cleanVal;
        meta.lines.title = lineNum;
        break;
      case "status":
        meta.status = cleanVal.toLowerCase();
        meta.lines.status = lineNum;
        break;
      case "sprint":
        meta.sprint = cleanVal;
        break;
      case "assignee":
        meta.assignee = cleanVal;
        meta.lines.assignee = lineNum;
        break;
      case "story_points":
        meta.storyPoints = parseFloat(cleanVal) || 0;
        meta.lines.storyPoints = lineNum;
        break;
      case "blocked_by":
        meta.blockedBy = extractYamlList(rawVal);
        meta.lines.blockedBy = lineNum;
        break;
      case "start_date":
        meta.startDate = cleanVal;
        meta.lines.startDate = lineNum;
        break;
      case "end_date":
        meta.endDate = cleanVal;
        meta.lines.endDate = lineNum;
        break;
    }
  }

  if (!meta.id) {
    meta.id = file.name.replace(/\.md$/i, "");
  }

  return meta;
}

export function getActiveSprintIds(files: WorkspaceFile[]): Set<string> {
  const activeIds = new Set<string>();
  files.forEach(f => {
    if (!f.path.startsWith("sprints/") || !f.path.endsWith(".md")) return;
    const fm = f.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) return;
    let id = f.name.replace(/\.md$/i, "");
    let state = "";
    fm[1].split(/\r?\n/).forEach(l => {
      const kv = l.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
      if (!kv) return;
      const k = kv[1].trim().toLowerCase();
      const v = kv[2].trim().replace(/^["']|["']$/g, "").trim();
      if (k === "id" && v) id = v;
      if (k === "state") state = v.toLowerCase();
    });
    if (state === "active") {
      activeIds.add(id.toLowerCase());
    }
  });
  return activeIds;
}

export function lintIssueFile(
  file: WorkspaceFile,
  activeSprintIds: Set<string>,
  issueById: Map<string, ParsedIssueLintMeta>,
  msg: MsgFormatter,
  diagnostics: Diagnostic[]
): void {
  if (!file.path.startsWith("issues/") || !file.path.endsWith(".md")) return;

  const issueMeta = parseIssueLintMetadata(file);
  if (!issueMeta) {
    diagnostics.push({
      filePath: file.path,
      line: 1,
      severity: "warning",
      message: msg(
        "Issue-Datei enthält keinen gültigen YAML-Frontmatter-Block (--- ... ---).",
        "Issue file is missing a valid YAML frontmatter block (--- ... ---)."
      ),
      code: "ISSUE_FRONTMATTER_MISSING"
    });
    return;
  }

  if (!issueMeta.title) {
    diagnostics.push({
      filePath: file.path,
      line: issueMeta.lines.title,
      severity: "warning",
      message: msg(
        `Ticket '${issueMeta.id}' hat keinen 'title' im YAML-Frontmatter.`,
        `Issue '${issueMeta.id}' is missing a 'title' in YAML frontmatter.`
      ),
      code: "ISSUE_TITLE_MISSING"
    });
  }

  const isActiveStatus = issueMeta.status === "in-progress" || issueMeta.status === "review";
  const inActiveSprint = Boolean(issueMeta.sprint && activeSprintIds.has(issueMeta.sprint.toLowerCase()));

  if (isActiveStatus && (!issueMeta.assignee || issueMeta.assignee.toLowerCase() === "unassigned")) {
    diagnostics.push({
      filePath: file.path,
      line: issueMeta.lines.assignee,
      severity: "warning",
      message: msg(
        `Ticket '${issueMeta.id}' im Status '${issueMeta.status}' hat keinen Bearbeiter ('assignee').`,
        `Issue '${issueMeta.id}' in '${issueMeta.status}' status is missing an 'assignee'.`
      ),
      code: "ISSUE_MISSING_ASSIGNEE"
    });
  }

  if ((isActiveStatus || (inActiveSprint && issueMeta.status === "ready")) && issueMeta.type !== "epic" && (!issueMeta.storyPoints || issueMeta.storyPoints <= 0)) {
    diagnostics.push({
      filePath: file.path,
      line: issueMeta.lines.storyPoints,
      severity: "warning",
      message: msg(
        `Ticket '${issueMeta.id}' (${issueMeta.status}) hat noch keine Story-Points-Schätzung (> 0).`,
        `Issue '${issueMeta.id}' (${issueMeta.status}) is missing Story Points (> 0).`
      ),
      code: "ISSUE_MISSING_POINTS"
    });
  }

  issueMeta.blockedBy.forEach(blockerId => {
    const blockerTarget = issueById.get(blockerId.toUpperCase());
    if (!blockerTarget) {
      diagnostics.push({
        filePath: file.path,
        line: issueMeta.lines.blockedBy,
        severity: "error",
        message: msg(
          `Unbekannte Blocker-Referenz: Ticket '${blockerId}' existiert nicht unter issues/*.md.`,
          `Unresolved blocker reference: Issue '${blockerId}' does not exist in issues/*.md.`
        ),
        code: "ISSUE_UNKNOWN_BLOCKER"
      });
    } else if (issueMeta.status !== "done" && blockerTarget.status !== "done") {
      diagnostics.push({
        filePath: file.path,
        line: issueMeta.lines.blockedBy,
        severity: "warning",
        message: msg(
          `Ticket '${issueMeta.id}' ist blockiert durch '${blockerTarget.id}' (aktueller Status: ${blockerTarget.status}).`,
          `Issue '${issueMeta.id}' is blocked by '${blockerTarget.id}' (current status: ${blockerTarget.status}).`
        ),
        code: "ISSUE_BLOCKED_UNRESOLVED"
      });
    }
  });

  if (issueMeta.startDate && issueMeta.endDate) {
    const start = new Date(issueMeta.startDate);
    const end = new Date(issueMeta.endDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
      diagnostics.push({
        filePath: file.path,
        line: issueMeta.lines.endDate,
        severity: "error",
        message: msg(
          `Zeitraum-Fehler in Ticket '${issueMeta.id}': Enddatum (${issueMeta.endDate}) liegt vor Startdatum (${issueMeta.startDate}).`,
          `Date range error in issue '${issueMeta.id}': End date (${issueMeta.endDate}) is before start date (${issueMeta.startDate}).`
        ),
        code: "DATE_ORDER_ERROR"
      });
    }
  }
}
