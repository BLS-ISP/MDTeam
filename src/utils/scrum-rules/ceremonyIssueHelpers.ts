import {
  type AgileIssue,
  type WorkspaceFile,
  serializeIssueToMarkdown,
} from "../issueEngine";
import { extractFrontmatter, normalizePath, upsertFrontmatter } from "../frontmatter";
import type {
  CeremonySubtaskItem,
  DailyParkingLotItem,
  RetroStickyCard,
} from "../../types/scrumPolicy";

type ExtendedCeremonyIssue = AgileIssue & {
  subtasks?: CeremonySubtaskItem[];
  reviewAccepted?: boolean;
};

export function parseSubtasksFromMarkdown(markdown: string): CeremonySubtaskItem[] {
  if (!markdown) return [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let inSubtasks = false;
  const items: CeremonySubtaskItem[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^##\s+(subtasks|teilaufgaben|technical\s+tasks)/i.test(trimmed)) {
      inSubtasks = true;
      continue;
    }
    if (inSubtasks && trimmed.startsWith("## ")) {
      break;
    }
    if (!inSubtasks) continue;

    const match = trimmed.match(/^[-*+]\s+\[([ xX])\]\s*(.+)$/);
    if (!match) continue;
    const done = match[1].toLowerCase() === "x";
    const segments = match[2].split("|").map((s) => s.trim());
    const head = segments[0] || "";
    const idColon = head.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
    const id = idColon ? idColon[1] : `SUB-${items.length + 1}`;
    const title = (idColon ? idColon[2] : head).trim();
    if (!title) continue;

    let assignee: string | undefined;
    let estimatedHours: number | undefined;
    let remainingHours: number | undefined;

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.startsWith("@")) {
        assignee = seg;
      } else if (/^est\s*:/i.test(seg)) {
        const val = parseFloat(seg.replace(/^est\s*:\s*/i, "").replace(/h$/i, ""));
        if (Number.isFinite(val) && val >= 0) estimatedHours = val;
      } else if (/^rem\s*:/i.test(seg)) {
        const val = parseFloat(seg.replace(/^rem\s*:\s*/i, "").replace(/h$/i, ""));
        if (Number.isFinite(val) && val >= 0) remainingHours = val;
      }
    }

    items.push({ id, title, done, assignee, estimatedHours, remainingHours });
  }

  return items;
}

export function getIssueSubtasks(
  issue: AgileIssue,
  files?: WorkspaceFile[]
): CeremonySubtaskItem[] {
  const ext = issue as ExtendedCeremonyIssue;
  if (Array.isArray(ext.subtasks)) {
    return ext.subtasks.map((st, idx) => ({
      id: st.id || `SUB-${idx + 1}`,
      title: String(st.title || "").trim(),
      done: Boolean(st.done),
      assignee: st.assignee,
      estimatedHours: st.estimatedHours,
      remainingHours: st.remainingHours,
    }));
  }

  if (files && issue.filePath) {
    const cleanTarget = normalizePath(issue.filePath);
    const found = files.find((f) => normalizePath(f.path) === cleanTarget);
    if (found) {
      return parseSubtasksFromMarkdown(found.content);
    }
  }
  return [];
}

export function withIssueSubtasks(
  issue: AgileIssue,
  subtasks: CeremonySubtaskItem[]
): AgileIssue {
  const clone: ExtendedCeremonyIssue = {
    ...issue,
    subtasks: subtasks.map((st, idx) => ({
      id: st.id || `SUB-${idx + 1}`,
      title: st.title.trim(),
      done: Boolean(st.done),
      assignee: st.assignee?.trim() || undefined,
      estimatedHours: st.estimatedHours,
      remainingHours: st.remainingHours,
    })),
  };
  return clone;
}

export function isIssueReviewAccepted(
  issue: AgileIssue,
  files?: WorkspaceFile[]
): boolean {
  const ext = issue as ExtendedCeremonyIssue;
  if (typeof ext.reviewAccepted === "boolean") {
    return ext.reviewAccepted;
  }
  if (files && issue.filePath) {
    const cleanTarget = normalizePath(issue.filePath);
    const found = files.find((f) => normalizePath(f.path) === cleanTarget);
    if (found) {
      const { scalars } = extractFrontmatter(found.content);
      if (scalars.review_accepted === "true") return true;
    }
  }
  return (issue.comments || []).some((c) =>
    /\[SPRINT-REVIEW:\s*ACCEPTED\]/i.test(c.text)
  );
}

export function withIssueReviewAccepted(
  issue: AgileIssue,
  accepted: boolean
): AgileIssue {
  const clone: ExtendedCeremonyIssue = {
    ...issue,
    reviewAccepted: accepted,
  };
  return clone;
}

export function serializeIssueWithCeremonyData(
  issue: AgileIssue,
  files?: WorkspaceFile[]
): WorkspaceFile {
  const baseFile = serializeIssueToMarkdown(issue);
  let content = baseFile.content;
  const subtasks = getIssueSubtasks(issue, files);

  if (subtasks.length > 0 && !/^##\s+Subtasks/im.test(content)) {
    const subtaskLines = subtasks.map((st, idx) => {
      const id = st.id || `SUB-${idx + 1}`;
      const parts = [`- [${st.done ? "x" : " "}] ${id}: ${st.title.replace(/\r?\n/g, " ").trim()}`];
      if (st.assignee) parts.push(st.assignee);
      if (st.estimatedHours !== undefined) parts.push(`est:${st.estimatedHours}h`);
      if (st.remainingHours !== undefined) parts.push(`rem:${st.remainingHours}h`);
      return parts.join(" | ");
    });
    const section = `## Subtasks\n\n${subtaskLines.join("\n")}\n\n`;
    if (content.includes("## Comments")) {
      content = content.replace("## Comments", `${section}## Comments`);
    } else {
      content = `${content.trimEnd()}\n\n${section}`;
    }
  }

  const ext = issue as ExtendedCeremonyIssue;
  if (typeof ext.reviewAccepted === "boolean" && !/^review_accepted:/im.test(content)) {
    content = upsertFrontmatter(content, { review_accepted: ext.reviewAccepted });
  }

  return { ...baseFile, content };
}

export const DAILY_PARKING_LOT_PATH = ".mdteam/daily-parking-lot.json";

export function loadParkingLotItems(files?: WorkspaceFile[]): DailyParkingLotItem[] {
  const found = (files || []).find(
    (f) => normalizePath(f.path) === DAILY_PARKING_LOT_PATH
  );
  if (found?.content) {
    try {
      const parsed = JSON.parse(found.content);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("mdteam_daily_parking_lot");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }
  return [];
}

export function serializeParkingLotFile(items: DailyParkingLotItem[]): WorkspaceFile {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("mdteam_daily_parking_lot", JSON.stringify(items));
    } catch {}
  }
  return {
    path: DAILY_PARKING_LOT_PATH,
    name: "daily-parking-lot.json",
    category: ".mdteam",
    content: JSON.stringify(items, null, 2) + "\n",
  };
}

export function getRetroStorePath(sprintId: string): string {
  const safe = (sprintId || "sprint-01").replace(/[^a-zA-Z0-9_-]/g, "-");
  return `.mdteam/retro-${safe}.json`;
}

export function loadRetroStickies(
  files: WorkspaceFile[] | undefined,
  sprintId: string
): RetroStickyCard[] {
  const storePath = getRetroStorePath(sprintId);
  const found = (files || []).find((f) => normalizePath(f.path) === storePath);
  if (found?.content) {
    try {
      const parsed = JSON.parse(found.content);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`mdteam_retro_${sprintId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }
  return [];
}

export function serializeRetroStickiesFile(
  sprintId: string,
  cards: RetroStickyCard[]
): WorkspaceFile {
  const storePath = getRetroStorePath(sprintId);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`mdteam_retro_${sprintId}`, JSON.stringify(cards));
    } catch {}
  }
  return {
    path: storePath,
    name: storePath.split("/").pop() || "retro.json",
    category: ".mdteam",
    content: JSON.stringify(cards, null, 2) + "\n",
  };
}
