import type { WorkspaceFile } from "../../utils/atlassianImporter";

export type { WorkspaceFile };

export type WorkspaceRoleMode = "developer" | "scrum" | "stakeholder";

export type AtlassianSourceType = "jira-csv" | "jira-json" | "confluence";

export interface GitBranchEntry {
  name: string;
  isCurrent: boolean;
}

export interface WorkspaceNotificationItem {
  id: string;
  kind: "assigned" | "mention" | "blocked" | "review";
  title: string;
  subtitle: string;
  filePath: string;
  severity: "info" | "warning" | "critical";
}

export const PRESET_TEAM_HANDLES: { handle: string; labelDe: string; labelEn: string }[] = [
  { handle: "@developer-a", labelDe: "Developer A (Tech Lead)", labelEn: "Developer A (Tech Lead)" },
  { handle: "@developer-b", labelDe: "Developer B (Backend/Sync)", labelEn: "Developer B (Backend/Sync)" },
  { handle: "@scrum-master", labelDe: "Scrum Master", labelEn: "Scrum Master" },
  { handle: "@product-owner", labelDe: "Product Owner (PM)", labelEn: "Product Owner (PM)" },
];

export interface ParsedDocSummary {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  assignee: string;
  storyPoints: number;
  reviewStatus: string;
  blockedBy: string[];
  labels: string[];
  body: string;
}

export function parseMarkdownSummary(file: WorkspaceFile): ParsedDocSummary {
  const fmMatch = file.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const meta: Record<string, string> = {};
  let body = file.content;

  if (fmMatch) {
    body = file.content.slice(fmMatch[0].length).trim();
    for (const line of fmMatch[1].split(/\r?\n/)) {
      const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
      if (kv) {
        meta[kv[1]] = kv[2].trim();
      }
    }
  }

  const unquote = (val?: string) => (val || "").replace(/^["']|["']$/g, "").trim();

  const parseArrayField = (raw?: string): string[] => {
    if (!raw) return [];
    const trimmed = raw.trim();
    if (trimmed === "[]") return [];
    const inner = trimmed.replace(/^\[|\]$/g, "");
    return inner
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, "").trim())
      .filter(Boolean);
  };

  let headingTitle = "";
  const h1Match = body.match(/^#\s+(.+)$/m);
  if (h1Match) {
    headingTitle = h1Match[1].trim();
  }

  const cleanId = unquote(meta.id) || file.name.replace(/\.md$/i, "");
  const cleanTitle =
    unquote(meta.title) ||
    headingTitle.replace(new RegExp(`^${cleanId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*`, "i"), "") ||
    file.name;

  return {
    id: cleanId,
    title: cleanTitle,
    type: unquote(meta.type).toLowerCase(),
    status: unquote(meta.status).toLowerCase(),
    priority: unquote(meta.priority).toLowerCase(),
    assignee: unquote(meta.assignee),
    storyPoints: Number(unquote(meta.story_points)) || 0,
    reviewStatus: unquote(meta.review_status).toLowerCase(),
    blockedBy: parseArrayField(meta.blocked_by),
    labels: parseArrayField(meta.labels),
    body,
  };
}

export function normalizeHandleForMatch(handle: string): string {
  const clean = (handle || "").trim().toLowerCase();
  if (!clean) return "";
  return clean.startsWith("@") ? clean : `@${clean.replace(/\s+/g, "-")}`;
}

export function getStatusBadgeColors(status: string): { bg: string; fg: string; label: string } {
  const s = (status || "").toLowerCase();
  if (s === "done" || s === "completed" || s === "approved") {
    return { bg: "rgba(16, 185, 129, 0.15)", fg: "var(--accent-green)", label: status || "done" };
  }
  if (s === "in-progress" || s === "active") {
    return { bg: "rgba(59, 130, 246, 0.15)", fg: "var(--accent-blue)", label: status };
  }
  if (s === "review" || s === "in-review" || s === "in_review") {
    return { bg: "rgba(245, 158, 11, 0.16)", fg: "var(--accent-yellow)", label: status };
  }
  if (s === "ready") {
    return { bg: "rgba(99, 102, 241, 0.16)", fg: "var(--accent-indigo)", label: status };
  }
  if (s === "blocked" || s === "critical") {
    return { bg: "rgba(239, 68, 68, 0.16)", fg: "var(--accent-red)", label: status };
  }
  return { bg: "rgba(255, 255, 255, 0.06)", fg: "var(--text-secondary)", label: status || "backlog" };
}

export function getCategoryBadgeLabel(file: WorkspaceFile): { label: string; color: string } {
  const p = file.path.toLowerCase();
  if (p.startsWith("issues/")) return { label: "ISSUE", color: "var(--accent-blue)" };
  if (p.startsWith("wiki/")) return { label: "WIKI", color: "var(--accent-green)" };
  if (p.startsWith("arc42/")) return { label: "ARC42", color: "var(--accent-indigo)" };
  if (p.startsWith("adrs/")) return { label: "ADR", color: "var(--accent-yellow)" };
  if (p.startsWith("sprints/")) return { label: "SPRINT", color: "var(--accent-blue)" };
  if (p.startsWith("meetings/")) return { label: "MEETING", color: "var(--text-secondary)" };
  if (p.startsWith("management/")) return { label: "PM", color: "var(--accent-indigo)" };
  return { label: (file.category || "DOC").toUpperCase(), color: "var(--text-muted)" };
}
