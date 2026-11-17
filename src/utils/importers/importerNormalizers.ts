import type { WorkspaceFile } from "../../types/workspace";

export type ImportedIssueType = "epic" | "story" | "bug" | "task" | "spike";
export type ImportedIssueStatus = "backlog" | "ready" | "in-progress" | "review" | "done";
export type ImportedIssuePriority = "critical" | "high" | "medium" | "low";

export interface ImportedFilePreview {
  file: WorkspaceFile;
  kind: "issue" | "wiki";
  id: string;
  type: string;
  title: string;
  status: string;
  priority: string;
  storyPoints: number;
  sprint: string;
  assignee: string;
}

export interface RawNormalizedIssue {
  rawKey: string;
  type: ImportedIssueType;
  title: string;
  description: string;
  status: ImportedIssueStatus;
  priority: ImportedIssuePriority;
  storyPoints: number;
  sprint: string;
  rawEpic: string;
  assignee: string;
  reporter: string;
  labels: string[];
  rawBlockedBy: string[];
  branch: string;
  createdAt: string;
  updatedAt: string;
  acceptanceCriteria: { text: string; checked: boolean }[];
  comments: { author: string; timestamp: string; text: string }[];
}

export function normalizeIssueType(raw: string): ImportedIssueType {
  const val = (raw || "").trim().toLowerCase();
  if (val.includes("epic")) return "epic";
  if (val.includes("bug") || val.includes("defect") || val.includes("incident") || val.includes("fehler")) {
    return "bug";
  }
  if (val.includes("spike") || val.includes("research") || val.includes("investigation")) {
    return "spike";
  }
  if (val.includes("story") || val.includes("feature") || val.includes("improvement")) {
    return "story";
  }
  return "task";
}

export function normalizeIssueStatus(raw: string): ImportedIssueStatus {
  const val = (raw || "").trim().toLowerCase();
  if (
    val === "done" ||
    val === "closed" ||
    val === "resolved" ||
    val === "completed" ||
    val.includes("erledigt") ||
    val.includes("abgeschlossen") ||
    val.includes("fertig")
  ) {
    return "done";
  }
  if (
    val.includes("review") ||
    val === "qa" ||
    val.includes("testing") ||
    val.includes("prüfung") ||
    val.includes("freigabe")
  ) {
    return "review";
  }
  if (
    val.includes("progress") ||
    val === "active" ||
    val.includes("arbeit") ||
    val.includes("implement") ||
    val.includes("dev")
  ) {
    return "in-progress";
  }
  if (
    val === "ready" ||
    val.includes("selected for development") ||
    val.includes("ready for") ||
    val.includes("bereit")
  ) {
    return "ready";
  }
  return "backlog";
}

export function normalizeIssuePriority(raw: string): ImportedIssuePriority {
  const val = (raw || "").trim().toLowerCase();
  if (
    val.includes("highest") ||
    val.includes("critical") ||
    val.includes("blocker") ||
    val.includes("urgent") ||
    val === "p0" ||
    val === "p1" ||
    val.includes("kritisch") ||
    val.includes("höchste")
  ) {
    return "critical";
  }
  if (val.includes("high") || val.includes("major") || val === "p2" || val.includes("hoch")) {
    return "high";
  }
  if (
    val.includes("low") ||
    val.includes("minor") ||
    val.includes("trivial") ||
    val === "p4" ||
    val.includes("niedrig") ||
    val.includes("gering")
  ) {
    return "low";
  }
  return "medium";
}

export function normalizeUserHandle(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed || trimmed.toLowerCase() === "unassigned" || trimmed.toLowerCase() === "nicht zugewiesen") {
    return "";
  }
  if (trimmed.startsWith("@")) {
    return `@${trimmed
      .slice(1)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")}`;
  }
  // Convert email or display name into clean @handle
  const base = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
  const slug = base
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `@${slug}` : "";
}

export function normalizeSprintName(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";

  // Handle Jira GreenHopper serialized sprint objects: com.atlassian.greenhopper...Sprint@[...,name=Sprint 1,...]
  const ghMatch = trimmed.match(/name=([^,\]]+)/i);
  const candidate = ghMatch ? ghMatch[1].trim() : trimmed;

  // Normalize "Sprint 1" or "Sprint 01" -> "sprint-01" to align with MDTeam sprint files
  const numMatch = candidate.match(/^sprint[\s_-]*(\d+)$/i);
  if (numMatch) {
    const num = numMatch[1].padStart(2, "0");
    return `sprint-${num}`;
  }

  return candidate
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const MONTH_MAP: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  mär: "03",
  apr: "04",
  may: "05",
  mai: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  okt: "10",
  nov: "11",
  dec: "12",
  dez: "12",
};

export function normalizeDateString(raw: string, fallbackDate?: string): string {
  const today = fallbackDate || new Date().toISOString().slice(0, 10);
  const trimmed = (raw || "").trim();
  if (!trimmed) return today;

  // ISO format 2026-06-01...
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // German dd.mm.yyyy
  const deMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (deMatch) {
    const day = deMatch[1].padStart(2, "0");
    const month = deMatch[2].padStart(2, "0");
    const year = deMatch[3].length === 2 ? `20${deMatch[3]}` : deMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Jira CSV format e.g. 02/Jun/26 10:15 AM or 02/Jun/2026
  const jiraMatch = trimmed.match(/^(\d{1,2})\/([A-Za-zäöüÄÖÜ]{3})\/(\d{2,4})/);
  if (jiraMatch) {
    const day = jiraMatch[1].padStart(2, "0");
    const monKey = jiraMatch[2].toLowerCase().slice(0, 3);
    const month = MONTH_MAP[monKey] || "01";
    const year = jiraMatch[3].length === 2 ? `20${jiraMatch[3]}` : jiraMatch[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return today;
}

export function normalizeTimestampString(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return new Date().toISOString().slice(0, 16).replace("T", " ");

  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]} ${isoMatch[2]}`;
  }

  const datePart = normalizeDateString(trimmed);
  const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const mins = timeMatch[2];
    const meridiem = (timeMatch[3] || "").toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return `${datePart} ${String(hours).padStart(2, "0")}:${mins}`;
  }

  return datePart;
}

export function slugifyText(input: string, maxLen = 48): string {
  const slug = (input || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug || "untitled").slice(0, maxLen).replace(/-+$/g, "");
}

export function buildSuggestedBranch(id: string, type: ImportedIssueType, title: string): string {
  const prefix = type === "bug" ? "fix" : type === "epic" || type === "story" ? "feat" : "chore";
  const slug = slugifyText(title, 34);
  return `${prefix}/${id}-${slug}`;
}

export function convertJiraWikiToMarkdown(input: string): string {
  if (!input) return "";
  let text = input.replace(/\r\n/g, "\n");

  // {code:lang} ... {code}
  text = text.replace(/\{code(?::([a-zA-Z0-9_+-]+))?\}([\s\S]*?)\{code\}/g, (_m, lang, body) => {
    const cleanBody = String(body).replace(/^\n+|\n+$/g, "");
    return `\n\`\`\`${lang || ""}\n${cleanBody}\n\`\`\`\n`;
  });

  // {noformat} ... {noformat}
  text = text.replace(/\{noformat\}([\s\S]*?)\{noformat\}/g, (_m, body) => {
    const cleanBody = String(body).replace(/^\n+|\n+$/g, "");
    return `\n\`\`\`\n${cleanBody}\n\`\`\`\n`;
  });

  // {quote} / {panel}
  text = text.replace(/\{(?:quote|panel(?::[^}]*)?)\}([\s\S]*?)\{(?:quote|panel)\}/g, (_m, body) => {
    const lines = String(body)
      .trim()
      .split("\n")
      .map((l) => `> ${l}`);
    return `\n${lines.join("\n")}\n`;
  });

  // Headings h1. .. h6.
  text = text.replace(/^h([1-6])\.\s+(.*)$/gm, (_m, level, heading) => {
    return `${"#".repeat(Number(level))} ${heading.trim()}`;
  });

  // Monospace {{text}}
  text = text.replace(/\{\{([^}\n]+)\}\}/g, "`$1`");

  // Jira links [label|https://...]
  text = text.replace(/\[([^\]|\n]+)\|((?:https?:\/\/|mailto:|\/|[a-zA-Z0-9_.-]+\/)[^\]\n]+)\]/g, "[$1]($2)");

  return text.trim();
}

export function splitDescriptionAndAcceptanceCriteria(
  rawDescription: string,
  explicitAc: string
): {
  cleanDescription: string;
  criteria: { text: string; checked: boolean }[];
} {
  const criteria: { text: string; checked: boolean }[] = [];

  const collectChecklistLines = (source: string) => {
    for (const line of source.split("\n")) {
      const checkMatch = line.match(/^\s*[-*]\s*\[([ xX])\]\s+(.+)$/);
      if (checkMatch) {
        criteria.push({
          checked: checkMatch[1].toLowerCase() === "x",
          text: checkMatch[2].trim(),
        });
      } else {
        const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
        if (bulletMatch && bulletMatch[1].trim()) {
          criteria.push({
            checked: false,
            text: bulletMatch[1].trim(),
          });
        }
      }
    }
  };

  if (explicitAc.trim()) {
    collectChecklistLines(explicitAc);
    if (criteria.length === 0) {
      explicitAc
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((l) => criteria.push({ checked: false, text: l }));
    }
  }

  let desc = rawDescription;
  // Extract inline "Acceptance Criteria:" / "Akzeptanzkriterien:" section if present
  const acHeaderRegex = /(?:^|\n)(?:#{1,4}\s*)?(?:Acceptance Criteria|Akzeptanzkriterien)\s*:?\s*\n([\s\S]*)$/i;
  const acMatch = desc.match(acHeaderRegex);
  if (acMatch) {
    collectChecklistLines(acMatch[1]);
    desc = desc.slice(0, acMatch.index).trim();
  } else if (criteria.length === 0) {
    // Extract standalone markdown task items from description without removing prose paragraphs
    const remainingLines: string[] = [];
    for (const line of desc.split("\n")) {
      const taskMatch = line.match(/^\s*[-*]\s*\[([ xX])\]\s+(.+)$/);
      if (taskMatch) {
        criteria.push({
          checked: taskMatch[1].toLowerCase() === "x",
          text: taskMatch[2].trim(),
        });
      } else {
        remainingLines.push(line);
      }
    }
    if (criteria.length > 0) {
      desc = remainingLines.join("\n").trim();
    }
  }

  return {
    cleanDescription: desc.trim(),
    criteria,
  };
}

export function extractStringName(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    const rec = val as Record<string, unknown>;
    if (typeof rec.displayName === "string") return rec.displayName;
    if (typeof rec.name === "string") return rec.name;
    if (typeof rec.key === "string") return rec.key;
    if (typeof rec.value === "string") return rec.value;
    if (typeof rec.emailAddress === "string") return rec.emailAddress;
  }
  return "";
}
