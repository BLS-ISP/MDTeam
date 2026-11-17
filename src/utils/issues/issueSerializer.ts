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
import {
  parseAttachmentsSection,
  parseCommentsSection,
  parseOptionalBoolean,
  parseOptionalHours,
  parseSubtasksSection,
  serializeAttachmentsSection,
  serializeSubtasksSection,
} from "./subtaskAndAttachmentParser";

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
  const subtaskLines: string[] = [];
  const attachmentLines: string[] = [];
  const commentLines: string[] = [];

  let activeSection:
    | "preamble"
    | "description"
    | "ac"
    | "subtasks"
    | "attachments"
    | "comments"
    | "other" = "preamble";

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
        heading.includes("subtask") ||
        heading.includes("sub-task") ||
        heading.includes("unteraufgabe") ||
        heading.includes("teilaufgabe")
      ) {
        activeSection = "subtasks";
      } else if (
        heading.includes("attachment") ||
        heading.includes("anhang") ||
        heading.includes("anhänge") ||
        heading.includes("dateien")
      ) {
        activeSection = "attachments";
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
    } else if (activeSection === "subtasks") {
      subtaskLines.push(line);
    } else if (activeSection === "attachments") {
      attachmentLines.push(line);
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

  const labels = arrays.labels ?? (scalars.labels ? parseYamlArray(scalars.labels) : []);
  const blockedBy =
    arrays.blocked_by ??
    arrays.blockedby ??
    (scalars.blocked_by ? parseYamlArray(scalars.blocked_by) : []);

  const nowIso = new Date().toISOString();
  const createdAt = scalars.created_at || scalars.createdat || nowIso;
  const updatedAt = scalars.updated_at || scalars.updatedat || createdAt;

  const startDate = (scalars.start_date || scalars.startdate || "").trim() || undefined;
  const endDate = (scalars.end_date || scalars.enddate || "").trim() || undefined;
  const fixVersion = (scalars.fix_version || scalars.fixversion || "").trim() || undefined;
  const estimatedHours = parseOptionalHours(scalars.estimated_hours ?? scalars.estimatedhours);
  const loggedHours = parseOptionalHours(scalars.logged_hours ?? scalars.loggedhours);
  const remainingHours = parseOptionalHours(scalars.remaining_hours ?? scalars.remaininghours);
  const reviewAccepted = parseOptionalBoolean(scalars.review_accepted ?? scalars.reviewaccepted);

  const subtasks = parseSubtasksSection(subtaskLines);
  const attachments = parseAttachmentsSection(attachmentLines, updatedAt);

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
    subtasks,
    attachments,
    ...(fixVersion ? { fixVersion } : {}),
    ...(estimatedHours !== undefined ? { estimatedHours } : {}),
    ...(loggedHours !== undefined ? { loggedHours } : {}),
    ...(remainingHours !== undefined ? { remainingHours } : {}),
    ...(reviewAccepted !== undefined ? { reviewAccepted } : {}),
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
  ];

  if (issue.fixVersion !== undefined && issue.fixVersion.trim() !== "") {
    frontmatterLines.push(`fix_version: ${escapeYamlString(issue.fixVersion.trim())}`);
  }
  if (issue.estimatedHours !== undefined && Number.isFinite(issue.estimatedHours)) {
    frontmatterLines.push(`estimated_hours: ${Number(issue.estimatedHours.toFixed(2))}`);
  }
  if (issue.loggedHours !== undefined && Number.isFinite(issue.loggedHours)) {
    frontmatterLines.push(`logged_hours: ${Number(issue.loggedHours.toFixed(2))}`);
  }
  if (issue.remainingHours !== undefined && Number.isFinite(issue.remainingHours)) {
    frontmatterLines.push(`remaining_hours: ${Number(issue.remainingHours.toFixed(2))}`);
  }
  if (issue.reviewAccepted !== undefined) {
    frontmatterLines.push(`review_accepted: ${issue.reviewAccepted}`);
  }

  frontmatterLines.push(`created_at: ${escapeYamlString(createdAt)}`);
  frontmatterLines.push(`updated_at: ${escapeYamlString(updatedAt)}`);
  frontmatterLines.push("---");

  const acBody =
    issue.acceptanceCriteria && issue.acceptanceCriteria.length > 0
      ? issue.acceptanceCriteria
          .map((ac) => `- [${ac.checked ? "x" : " "}] ${ac.text.replace(/\r?\n/g, " ").trim()}`)
          .join("\n")
      : "- [ ] Define acceptance criteria";

  const subtasksBody = serializeSubtasksSection(issue.subtasks);
  const attachmentsBody = serializeAttachmentsSection(issue.attachments);

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
  ];

  if (subtasksBody) {
    mdSections.push("", "## Subtasks", "", subtasksBody);
  }
  if (attachmentsBody) {
    mdSections.push("", "## Attachments", "", attachmentsBody);
  }

  mdSections.push("", "## Comments", "", commentsBody);

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
    issue.type === "bug" ? "fix" : issue.type === "task" ? "chore" : issue.type === "spike" ? "spike" : "feat";
  const slug = (issue.title || "work")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
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
    subtasks: defaults?.subtasks || [],
    attachments: defaults?.attachments || [],
    ...(defaults?.fixVersion ? { fixVersion: defaults.fixVersion } : {}),
    ...(defaults?.estimatedHours !== undefined ? { estimatedHours: defaults.estimatedHours } : {}),
    ...(defaults?.loggedHours !== undefined ? { loggedHours: defaults.loggedHours } : {}),
    ...(defaults?.remainingHours !== undefined ? { remainingHours: defaults.remainingHours } : {}),
    ...(defaults?.reviewAccepted !== undefined ? { reviewAccepted: defaults.reviewAccepted } : {}),
  };
}
