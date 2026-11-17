import { extractFrontmatter } from "../../utils/query/queryFrontmatterExtractor";
import type {
  InlineCommentMessage,
  InlineCommentsStore,
  InlineCommentThread,
  ReviewStatus,
  SessionSnapshotRecord,
  WorkspaceFile,
} from "./wikiTypes";

export const INLINE_COMMENTS_FILE_PATH = ".mdteam/inline-comments.json";
const SESSION_SNAPSHOT_PREFIX = "mdteam_page_snapshots_v1:";
const MAX_SESSION_SNAPSHOTS = 20;

export const MENTION_HANDLES = [
  "@developer-a",
  "@developer-b",
  "@scrum-master",
  "@product-owner",
];

export function normalizeReviewStatus(raw: string): ReviewStatus {
  const s = raw.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (s === "approved" || s === "freigegeben" || s === "accepted") {
    return "approved";
  }
  if (s === "in-review" || s === "review" || s === "in-prüfung") {
    return "in-review";
  }
  return "draft";
}

export function extractDocTitle(file: WorkspaceFile): string {
  const { frontmatter } = extractFrontmatter(file.content);
  const fmTitle =
    typeof frontmatter.title === "string" ? frontmatter.title.trim() : "";
  if (fmTitle) return fmTitle;
  const h1 = file.content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return file.name.replace(/\.md$/i, "");
}

export function estimateReadingStats(markdown: string): {
  words: number;
  minutes: number;
} {
  const { body } = extractFrontmatter(markdown);
  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*`|~_-]/g, " ")
    .trim();
  if (!plain) return { words: 0, minutes: 1 };
  const words = plain.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return { words, minutes };
}

/**
 * Updates or inserts YAML frontmatter keys (`review_status`, `approved_by`, `updated_at`)
 * while preserving all existing frontmatter entries and Markdown content.
 */
export function upsertDocumentFrontmatter(
  markdown: string,
  updates: Record<string, string | null>
): string {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  let startIdx = -1;
  let endIdx = -1;

  if (lines[0]?.trim() === "---") {
    startIdx = 0;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        endIdx = i;
        break;
      }
    }
  } else {
    // Also support frontmatter placed right below an H1 heading (e.g. ADRs)
    let cursor = 0;
    while (cursor < lines.length && lines[cursor].trim() === "") cursor++;
    if (cursor < lines.length && /^#\s+/.test(lines[cursor])) {
      cursor++;
      while (cursor < lines.length && lines[cursor].trim() === "") cursor++;
      if (cursor < lines.length && lines[cursor].trim() === "---") {
        startIdx = cursor;
        for (let i = cursor + 1; i < lines.length; i++) {
          if (lines[i].trim() === "---") {
            endIdx = i;
            break;
          }
        }
      }
    }
  }

  const formatLine = (k: string, v: string) =>
    `${k}: "${v.replace(/"/g, '\\"')}"`;

  if (startIdx === -1 || endIdx === -1) {
    const newFmLines: string[] = ["---"];
    for (const [key, val] of Object.entries(updates)) {
      if (val !== null && val !== undefined) {
        newFmLines.push(formatLine(key, val));
      }
    }
    newFmLines.push("---", "");
    return `${newFmLines.join("\n")}${normalized}`;
  }

  const fmBody = lines.slice(startIdx + 1, endIdx);
  const handledKeys = new Set<string>();
  const updatedFmBody: string[] = [];

  for (const line of fmBody) {
    const colonIdx = line.indexOf(":");
    if (colonIdx !== -1 && !line.trim().startsWith("-")) {
      const k = line.slice(0, colonIdx).trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(updates, k)) {
        handledKeys.add(k);
        const nextVal = updates[k];
        if (nextVal !== null && nextVal !== undefined) {
          updatedFmBody.push(formatLine(k, nextVal));
        }
        continue;
      }
    }
    updatedFmBody.push(line);
  }

  for (const [key, val] of Object.entries(updates)) {
    const lowerKey = key.toLowerCase();
    if (!handledKeys.has(lowerKey) && val !== null && val !== undefined) {
      updatedFmBody.push(formatLine(lowerKey, val));
    }
  }

  return [
    ...lines.slice(0, startIdx + 1),
    ...updatedFmBody,
    ...lines.slice(endIdx),
  ].join("\n");
}

export function extractMentions(text: string): string[] {
  const matches = text.match(/@[a-zA-Z0-9_-]+/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

export function parseInlineCommentsStore(
  files: WorkspaceFile[]
): InlineCommentThread[] {
  const storeFile = files.find((f) => f.path === INLINE_COMMENTS_FILE_PATH);
  if (!storeFile || !storeFile.content.trim()) return [];

  try {
    const parsed: unknown = JSON.parse(storeFile.content);
    const rawThreads = Array.isArray(parsed)
      ? parsed
      : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { threads?: unknown }).threads)
      ? (parsed as { threads: unknown[] }).threads
      : [];

    return rawThreads
      .filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object")
      )
      .map((item) => {
        const resolvedBool =
          Boolean(item.resolved) || item.status === "resolved";
        const rawComments = Array.isArray(item.comments) ? item.comments : [];
        const comments: InlineCommentMessage[] = rawComments
          .filter((c): c is Record<string, unknown> =>
            Boolean(c && typeof c === "object")
          )
          .map((c, idx) => ({
            id: typeof c.id === "string" ? c.id : `msg-${idx}`,
            author: typeof c.author === "string" ? c.author : "@developer-a",
            text: typeof c.text === "string" ? c.text : "",
            mentions: Array.isArray(c.mentions)
              ? c.mentions.filter((m): m is string => typeof m === "string")
              : extractMentions(typeof c.text === "string" ? c.text : ""),
            createdAt:
              typeof c.createdAt === "string"
                ? c.createdAt
                : new Date().toISOString(),
          }));

        return {
          id:
            typeof item.id === "string"
              ? item.id
              : `thread-${Math.random().toString(36).slice(2, 8)}`,
          filePath: typeof item.filePath === "string" ? item.filePath : "",
          quote: typeof item.quote === "string" ? item.quote : "",
          lineNumber:
            typeof item.lineNumber === "number" ? item.lineNumber : undefined,
          status: resolvedBool ? "resolved" : "open",
          resolved: resolvedBool,
          createdAt:
            typeof item.createdAt === "string"
              ? item.createdAt
              : new Date().toISOString(),
          createdBy:
            typeof item.createdBy === "string"
              ? item.createdBy
              : comments[0]?.author || "@developer-a",
          resolvedBy:
            typeof item.resolvedBy === "string" ? item.resolvedBy : null,
          resolvedAt:
            typeof item.resolvedAt === "string" ? item.resolvedAt : null,
          comments,
        };
      });
  } catch {
    return [];
  }
}

export function countOpenInlineComments(
  files: WorkspaceFile[],
  filePath?: string
): number {
  const threads = parseInlineCommentsStore(files);
  return threads.filter(
    (t) => !t.resolved && (!filePath || t.filePath === filePath)
  ).length;
}

export function serializeInlineCommentsFile(
  threads: InlineCommentThread[]
): WorkspaceFile {
  const payload: InlineCommentsStore = {
    version: 1,
    threads,
  };
  return {
    path: INLINE_COMMENTS_FILE_PATH,
    name: "inline-comments.json",
    category: ".mdteam",
    content: JSON.stringify(payload, null, 2),
  };
}

export function loadSessionSnapshots(
  filePath: string
): SessionSnapshotRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(
      `${SESSION_SNAPSHOT_PREFIX}${filePath}`
    );
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is SessionSnapshotRecord =>
        Boolean(
          x &&
            typeof x === "object" &&
            typeof (x as SessionSnapshotRecord).content === "string"
        )
    );
  } catch {
    return [];
  }
}

export function recordPageSessionSnapshot(
  file: WorkspaceFile,
  author = "@local-session",
  customMessage?: string
): void {
  if (typeof window === "undefined" || !file.path) return;
  try {
    const existing = loadSessionSnapshots(file.path);
    if (existing.length > 0 && existing[0].content === file.content) {
      return;
    }

    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, "0")}.${String(
      now.getMonth() + 1
    ).padStart(2, "0")}.${now.getFullYear()} ${String(now.getHours()).padStart(
      2,
      "0"
    )}:${String(now.getMinutes()).padStart(2, "0")}:${String(
      now.getSeconds()
    ).padStart(2, "0")}`;

    const shortId = `snap-${now.getTime().toString(36).slice(-6)}`;
    const message =
      customMessage ||
      (existing.length === 0
        ? "Initial session baseline"
        : `Session checkpoint (${file.content.length} chars)`);

    const nextList: SessionSnapshotRecord[] = [
      {
        id: shortId,
        commitHash: shortId,
        message,
        author,
        date: formattedDate,
        content: file.content,
      },
      ...existing,
    ].slice(0, MAX_SESSION_SNAPSHOTS);

    window.sessionStorage.setItem(
      `${SESSION_SNAPSHOT_PREFIX}${file.path}`,
      JSON.stringify(nextList)
    );
  } catch {
    // Ignore sessionStorage quota errors safely
  }
}
