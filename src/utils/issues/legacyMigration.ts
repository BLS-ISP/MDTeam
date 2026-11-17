import type { WorkspaceFile } from "../../types/workspace";
import type { AgileIssue, IssueStatus } from "../../types/agile";
import { normalizePath } from "../frontmatter";
import {
  generateNextIssueId,
  parseIssueFromFile,
  serializeIssueToMarkdown,
} from "./issueSerializer";
import { parseSprints } from "./sprintSerializer";

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
