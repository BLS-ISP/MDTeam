import type { WorkspaceFile } from "../../types/workspace";
import { convertAdfToMarkdown } from "./adfConverter";
import {
  extractStringName,
  normalizeDateString,
  normalizeIssuePriority,
  normalizeIssueStatus,
  normalizeIssueType,
  normalizeSprintName,
  normalizeTimestampString,
  normalizeUserHandle,
  splitDescriptionAndAcceptanceCriteria,
  type RawNormalizedIssue,
} from "./importerNormalizers";
import { finalizeIssuesToWorkspaceFiles } from "./issueFinalizer";

export function importJiraJson(jsonContent: string, projectPrefix?: string): WorkspaceFile[] {
  const clean = jsonContent.replace(/^\uFEFF/, "").trim();
  if (!clean) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error("Invalid Jira JSON export: failed to parse JSON content.");
  }

  let issuesArray: Record<string, unknown>[] = [];
  let fieldNamesMap: Record<string, string> = {};

  if (Array.isArray(parsed)) {
    issuesArray = parsed.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  } else if (parsed && typeof parsed === "object") {
    const root = parsed as Record<string, unknown>;
    if (root.names && typeof root.names === "object") {
      fieldNamesMap = root.names as Record<string, string>;
    }
    if (Array.isArray(root.issues)) {
      issuesArray = root.issues.filter(
        (x): x is Record<string, unknown> => !!x && typeof x === "object"
      );
    } else if (root.key || root.fields || root.summary) {
      issuesArray = [root];
    }
  }

  // Locate dynamic customfield IDs via `names` metadata if present
  const findCustomFieldKey = (pattern: RegExp): string | undefined => {
    return Object.entries(fieldNamesMap).find(([, display]) =>
      pattern.test(String(display))
    )?.[0];
  };

  const spFieldKey = findCustomFieldKey(/story\s*point/i);
  const sprintFieldKey = findCustomFieldKey(/^sprint$/i);
  const epicFieldKey = findCustomFieldKey(/epic\s*link/i);

  const rawIssues: RawNormalizedIssue[] = [];

  for (const item of issuesArray) {
    const fields =
      item.fields && typeof item.fields === "object"
        ? (item.fields as Record<string, unknown>)
        : item;

    const rawKey = String(item.key || fields.key || item.id || "");
    const summary = String(fields.summary || fields.title || rawKey || "").trim();
    if (!summary && !rawKey) continue;

    const type = normalizeIssueType(
      extractStringName(fields.issuetype || fields.issueType || fields.type)
    );
    const status = normalizeIssueStatus(extractStringName(fields.status));
    const priority = normalizeIssuePriority(extractStringName(fields.priority));

    // Story Points resolution
    const spCandidates = [
      spFieldKey ? fields[spFieldKey] : undefined,
      fields.storyPoints,
      fields.story_points,
      fields["Story Points"],
      fields.customfield_10016,
      fields.customfield_10026,
      fields.customfield_10002,
    ];
    let storyPoints = 0;
    for (const cand of spCandidates) {
      if (typeof cand === "number" && Number.isFinite(cand) && cand >= 0) {
        storyPoints = Math.round(cand);
        break;
      }
      if (typeof cand === "string" && cand.trim() !== "") {
        const num = parseFloat(cand);
        if (Number.isFinite(num) && num >= 0) {
          storyPoints = Math.round(num);
          break;
        }
      }
    }

    // Sprint resolution
    const rawSprintVal =
      (sprintFieldKey ? fields[sprintFieldKey] : undefined) ??
      fields.sprint ??
      fields.sprints ??
      fields.customfield_10020;
    let sprint = "";
    if (Array.isArray(rawSprintVal) && rawSprintVal.length > 0) {
      const activeOrLast =
        rawSprintVal.find(
          (s) => s && typeof s === "object" && String((s as Record<string, unknown>).state).toLowerCase() === "active"
        ) || rawSprintVal[rawSprintVal.length - 1];
      sprint = normalizeSprintName(extractStringName(activeOrLast));
    } else if (rawSprintVal) {
      sprint = normalizeSprintName(extractStringName(rawSprintVal));
    }

    // Epic Link resolution
    let rawEpic = "";
    const epicCandidate =
      (epicFieldKey ? fields[epicFieldKey] : undefined) ??
      fields.epic ??
      fields.customfield_10014;
    if (epicCandidate) {
      rawEpic = extractStringName(epicCandidate);
    } else if (fields.parent && typeof fields.parent === "object") {
      const parentObj = fields.parent as Record<string, unknown>;
      rawEpic = String(parentObj.key || "");
    }

    const assignee = normalizeUserHandle(extractStringName(fields.assignee));
    const reporter = normalizeUserHandle(extractStringName(fields.reporter || fields.creator));

    const labels = Array.isArray(fields.labels)
      ? fields.labels.map((l) => String(l).trim()).filter(Boolean)
      : [];

    // Blocked by links from `issuelinks`
    const rawBlockedBy: string[] = [];
    if (Array.isArray(fields.issuelinks)) {
      for (const link of fields.issuelinks) {
        if (!link || typeof link !== "object") continue;
        const linkObj = link as Record<string, unknown>;
        const linkType = (linkObj.type as Record<string, unknown> | undefined) || {};
        const inwardDesc = String(linkType.inward || linkType.name || "").toLowerCase();
        const inwardIssue = linkObj.inwardIssue as Record<string, unknown> | undefined;
        if (inwardIssue?.key && (inwardDesc.includes("block") || inwardDesc === "")) {
          rawBlockedBy.push(String(inwardIssue.key));
        }
      }
    }
    if (Array.isArray(fields.blocked_by)) {
      fields.blocked_by.forEach((b) => rawBlockedBy.push(String(b)));
    }

    const createdAt = normalizeDateString(String(fields.created || fields.created_at || ""));
    const updatedAt = normalizeDateString(
      String(fields.updated || fields.updated_at || ""),
      createdAt
    );

    const renderedDescription = convertAdfToMarkdown(fields.description);
    const { cleanDescription, criteria } = splitDescriptionAndAcceptanceCriteria(
      renderedDescription,
      ""
    );

    // Comments (`fields.comment.comments[]` or `fields.comments[]`)
    const comments: { author: string; timestamp: string; text: string }[] = [];
    const commentContainer = fields.comment as Record<string, unknown> | undefined;
    const rawCommentsList = Array.isArray(commentContainer?.comments)
      ? commentContainer.comments
      : Array.isArray(fields.comments)
        ? fields.comments
        : [];

    for (const c of rawCommentsList) {
      if (!c || typeof c !== "object") continue;
      const cObj = c as Record<string, unknown>;
      const author =
        normalizeUserHandle(extractStringName(cObj.author || cObj.updateAuthor)) || "@jira-user";
      const timestamp = normalizeTimestampString(String(cObj.created || cObj.updated || ""));
      const bodyText = convertAdfToMarkdown(cObj.body || cObj.text)
        .replace(/\s*\n\s*/g, " ")
        .trim();
      if (bodyText) {
        comments.push({ author, timestamp, text: bodyText });
      }
    }

    rawIssues.push({
      rawKey,
      type,
      title: summary,
      description: cleanDescription,
      status,
      priority,
      storyPoints,
      sprint,
      rawEpic,
      assignee,
      reporter,
      labels,
      rawBlockedBy,
      branch: typeof fields.branch === "string" ? fields.branch : "",
      createdAt,
      updatedAt,
      acceptanceCriteria: criteria,
      comments,
    });
  }

  return finalizeIssuesToWorkspaceFiles(rawIssues, projectPrefix);
}
