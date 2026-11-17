import type { WorkspaceFile } from "../../types/workspace";
import type { AgileIssue, IssuePriority, IssueStatus, IssueType } from "../../types/agile";
import {
  escapeYamlString,
  extractFrontmatter,
  normalizePath,
  parseYamlArray,
  serializeYamlArray,
} from "../frontmatter";
import { DAY_MS, formatUtcDate, parseDateMs } from "./dateHelpers";

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
      titleFromH1 =
        rawH1
          .replace(
            new RegExp(`^\\[?${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]?\\s*[:\\-–—]?\\s*`, "i"),
            ""
          )
          .trim() || rawH1;
      continue;
    }

    const h2Match = trimmed.match(/^##\s+(.*)$/);
    if (h2Match) {
      const heading = h2Match[1].trim().toLowerCase();
      if (
        heading.includes("description") ||
        heading.includes("beschreibung") ||
        heading.includes("user story") ||
        heading.includes("summary")
      ) {
        activeSection = "description";
      } else if (
        heading.includes("acceptance") ||
        heading.includes("akzeptanz") ||
        heading.includes("criteria") ||
        heading.includes("kriterien") ||
        heading.includes("checklist")
      ) {
        activeSection = "ac";
      } else if (
        heading.includes("comment") ||
        heading.includes("kommentar") ||
        heading.includes("discussion")
      ) {
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
      cleanDescription === "_No description provided._" ||
      cleanDescription === "_Keine Beschreibung vorhanden._"
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
