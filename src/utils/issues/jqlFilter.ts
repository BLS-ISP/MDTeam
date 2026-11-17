import type { AgileIssue } from "../../types/agile";
import { unquoteYamlString } from "../frontmatter";
import { normalizeIssuePriority, normalizeIssueStatus } from "./issueSerializer";

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
