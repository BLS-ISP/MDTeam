import type { WorkspaceFile } from "../../types/workspace";
import { escapeYamlDoubleQuoted } from "../frontmatter";
import {
  buildSuggestedBranch,
  convertJiraWikiToMarkdown,
  normalizeTimestampString,
  normalizeUserHandle,
  type ImportedFilePreview,
  type RawNormalizedIssue,
} from "./importerNormalizers";

export { escapeYamlDoubleQuoted };

export function formatYamlStringArray(items: string[]): string {
  const unique = Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
  if (unique.length === 0) return "[]";
  return `[${unique.map((item) => `"${escapeYamlDoubleQuoted(item)}"`).join(", ")}]`;
}

export function parseJiraCsvComment(
  rawCell: string
): { author: string; timestamp: string; text: string } | null {
  const trimmed = (rawCell || "").trim();
  if (!trimmed) return null;

  // Standard Jira CSV format: "02/Jun/26 10:15 AM;username;Comment body..."
  const parts = trimmed.split(";");
  if (parts.length >= 3) {
    const maybeDate = parts[0].trim();
    const maybeAuthor = parts[1].trim();
    const body = parts.slice(2).join(";").trim();
    if (body && /\d/.test(maybeDate)) {
      return {
        timestamp: normalizeTimestampString(maybeDate),
        author: normalizeUserHandle(maybeAuthor) || "@jira-user",
        text: convertJiraWikiToMarkdown(body).replace(/\n+/g, " "),
      };
    }
  }

  return {
    timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
    author: "@jira-import",
    text: convertJiraWikiToMarkdown(trimmed).replace(/\n+/g, " "),
  };
}

export function finalizeIssuesToWorkspaceFiles(
  rawIssues: RawNormalizedIssue[],
  projectPrefix?: string
): WorkspaceFile[] {
  const cleanPrefix = (projectPrefix || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  // First pass: assign final IDs and record rawKey -> finalId map so Epic/BlockedBy links stay intact
  const keyMap = new Map<string, string>();
  const usedIds = new Set<string>();

  const assignedIds = rawIssues.map((item, idx) => {
    const trimmedRawKey = (item.rawKey || "").trim().toUpperCase();
    let candidateId = "";

    if (cleanPrefix) {
      const numMatch = trimmedRawKey.match(/-(\d+)$/);
      const numPart = numMatch ? numMatch[1] : String(201 + idx);
      candidateId = `${cleanPrefix}-${numPart}`;
    } else if (trimmedRawKey) {
      candidateId = trimmedRawKey.replace(/[^A-Z0-9_-]/g, "-");
    } else {
      candidateId = `MDT-${201 + idx}`;
    }

    let uniqueId = candidateId;
    let suffix = 2;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${candidateId}-${suffix++}`;
    }
    usedIds.add(uniqueId);

    if (trimmedRawKey) {
      keyMap.set(trimmedRawKey, uniqueId);
    }
    return uniqueId;
  });

  // Second pass: serialize each issue into atomic `issues/<ID>.md` WorkspaceFile
  return rawIssues.map((issue, idx) => {
    const id = assignedIds[idx];
    const rawEpicUpper = issue.rawEpic.trim().toUpperCase();
    const epic = rawEpicUpper
      ? keyMap.get(rawEpicUpper) || rawEpicUpper.replace(/[^A-Z0-9_-]/g, "-")
      : "";

    const blockedBy = issue.rawBlockedBy
      .map((b) => b.trim().toUpperCase())
      .filter(Boolean)
      .map((b) => keyMap.get(b) || b.replace(/[^A-Z0-9_-]/g, "-"));

    const branch = issue.branch.trim() || buildSuggestedBranch(id, issue.type, issue.title);

    const frontmatterLines = [
      "---",
      `id: "${escapeYamlDoubleQuoted(id)}"`,
      `type: "${issue.type}"`,
      `title: "${escapeYamlDoubleQuoted(issue.title)}"`,
      `status: "${issue.status}"`,
      `priority: "${issue.priority}"`,
      `story_points: ${Number.isFinite(issue.storyPoints) && issue.storyPoints >= 0 ? issue.storyPoints : 0}`,
      `sprint: "${escapeYamlDoubleQuoted(issue.sprint)}"`,
      `epic: "${escapeYamlDoubleQuoted(epic)}"`,
      `assignee: "${escapeYamlDoubleQuoted(issue.assignee)}"`,
      `reporter: "${escapeYamlDoubleQuoted(issue.reporter)}"`,
      `labels: ${formatYamlStringArray(issue.labels)}`,
      `blocked_by: ${formatYamlStringArray(blockedBy)}`,
      `branch: "${escapeYamlDoubleQuoted(branch)}"`,
      `created_at: "${escapeYamlDoubleQuoted(issue.createdAt)}"`,
      `updated_at: "${escapeYamlDoubleQuoted(issue.updatedAt)}"`,
      "---",
    ];

    const acLines =
      issue.acceptanceCriteria.length > 0
        ? issue.acceptanceCriteria.map((ac) => `- [${ac.checked ? "x" : " "}] ${ac.text}`).join("\n")
        : `- [ ] Verify implementation and Definition of Done for ${id}`;

    const commentLines =
      issue.comments.length > 0
        ? issue.comments
            .map((c) => `- **${c.author || "@team"}** (${c.timestamp}): ${c.text}`)
            .join("\n")
        : "";

    const bodySections = [
      frontmatterLines.join("\n"),
      "",
      `# ${id}: ${issue.title.trim()}`,
      "",
      "## Description",
      "",
      issue.description || "_No description provided in Jira export._",
      "",
      "## Acceptance Criteria",
      "",
      acLines,
      "",
      "## Comments",
      "",
      commentLines,
    ];

    return {
      path: `issues/${id}.md`,
      name: `${id}.md`,
      category: "issues",
      content: `${bodySections.join("\n").trimEnd()}\n`,
    };
  });
}

export function extractImportedFilePreview(file: WorkspaceFile): ImportedFilePreview {
  const fmMatch = file.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const meta: Record<string, string> = {};
  if (fmMatch) {
    for (const line of fmMatch[1].split(/\r?\n/)) {
      const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
      if (kv) {
        meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }

  const isIssue = file.path.startsWith("issues/");
  return {
    file,
    kind: isIssue ? "issue" : "wiki",
    id: meta.id || file.name.replace(/\.md$/i, ""),
    type: meta.type || (isIssue ? "task" : "page"),
    title: meta.title || file.name,
    status: meta.status || meta.review_status || "approved",
    priority: meta.priority || "-",
    storyPoints: Number(meta.story_points) || 0,
    sprint: meta.sprint || "-",
    assignee: meta.assignee || "-",
  };
}
