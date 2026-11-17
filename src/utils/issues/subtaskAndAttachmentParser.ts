import type { IssueAttachment, IssueSubtask } from "../../types/agile";
import { normalizePath } from "../frontmatter";

const attachmentPreviewMemoryCache = new Map<string, string>();
const STORAGE_PREFIX = "mdteam_asset_preview:";

export function cacheAttachmentDataUrl(assetPath: string, dataUrl: string): void {
  const key = normalizePath(assetPath);
  if (!key || !dataUrl) return;
  attachmentPreviewMemoryCache.set(key, dataUrl);
  if (typeof window !== "undefined") {
    try {
      if (dataUrl.length <= 750_000) {
        localStorage.setItem(`${STORAGE_PREFIX}${key}`, dataUrl);
      }
    } catch {
      // Ignore browser storage quota limits; memory cache still serves current session
    }
  }
}

export function getCachedAttachmentDataUrl(assetPath: string): string | undefined {
  const key = normalizePath(assetPath);
  if (!key) return undefined;
  const mem = attachmentPreviewMemoryCache.get(key);
  if (mem) return mem;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (stored) {
        attachmentPreviewMemoryCache.set(key, stored);
        return stored;
      }
    } catch {}
  }
  return undefined;
}

export function removeCachedAttachmentDataUrl(assetPath: string): void {
  const key = normalizePath(assetPath);
  if (!key) return;
  attachmentPreviewMemoryCache.delete(key);
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch {}
  }
}

export function sanitizeAttachmentFileName(rawName: string): string {
  const base = (rawName || "attachment.bin")
    .replace(/\\/g, "/")
    .split("/")
    .pop() || "attachment.bin";
  const cleaned = base
    .replace(/\.\.+/g, ".")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[_.-]+/, "");
  return cleaned || "attachment.bin";
}

export function inferMimeTypeFromName(fileName: string): string {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    case "json":
      return "application/json";
    case "zip":
      return "application/zip";
    case "log":
    case "txt":
    case "md":
    case "csv":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

export function parseOptionalHours(raw?: string): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const cleaned = raw.trim().replace(/h$/i, "").trim();
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return Number(num.toFixed(2));
}

export function parseOptionalBoolean(raw?: string): boolean | undefined {
  if (raw === undefined || raw === null) return undefined;
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return undefined;
}

/**
 * Parses `## Subtasks` lines such as:
 * `- [x] SUB-1: Implement PKCE challenge | @dev | est:4h | rem:0h`
 */
export function parseSubtasksSection(lines: string[]): IssueSubtask[] {
  const subtasks: IssueSubtask[] = [];
  let autoIndex = 1;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("_")) continue;

    const checkMatch = trimmed.match(/^[-*+]\s+\[([ xX/])\]\s*(.+)$/);
    const bulletMatch = !checkMatch ? trimmed.match(/^[-*+]\s+(.+)$/) : null;
    if (!checkMatch && !bulletMatch) continue;

    const done = checkMatch ? checkMatch[1].toLowerCase() === "x" : false;
    const content = (checkMatch ? checkMatch[2] : bulletMatch![1]).trim();
    if (!content) continue;

    const segments = content.split("|").map((s) => s.trim()).filter(Boolean);
    const head = segments[0] || "";

    let id = `SUB-${autoIndex}`;
    let title = head;
    const idPrefixMatch = head.match(/^([A-Za-z]+-\d+)\s*:\s*(.+)$/);
    if (idPrefixMatch) {
      id = idPrefixMatch[1].toUpperCase();
      title = idPrefixMatch[2].trim();
      const numMatch = id.match(/-(\d+)$/);
      if (numMatch) {
        const n = parseInt(numMatch[1], 10);
        if (Number.isFinite(n) && n >= autoIndex) autoIndex = n + 1;
      }
    } else {
      autoIndex++;
    }

    let assignee: string | undefined;
    let estimatedHours: number | undefined;
    let remainingHours: number | undefined;

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      const estMatch = seg.match(/^est\s*:\s*([0-9.]+)\s*h?$/i);
      if (estMatch) {
        estimatedHours = parseOptionalHours(estMatch[1]);
        continue;
      }
      const remMatch = seg.match(/^rem\s*:\s*([0-9.]+)\s*h?$/i);
      if (remMatch) {
        remainingHours = parseOptionalHours(remMatch[1]);
        continue;
      }
      if (seg.startsWith("@") || /^[a-zA-Z0-9_.-]+$/.test(seg)) {
        assignee = seg.startsWith("@") ? seg : `@${seg}`;
      }
    }

    subtasks.push({
      id,
      title: title || id,
      done,
      ...(assignee ? { assignee } : {}),
      ...(estimatedHours !== undefined ? { estimatedHours } : {}),
      ...(remainingHours !== undefined ? { remainingHours } : {}),
    });
  }

  return subtasks;
}

export function serializeSubtasksSection(subtasks?: IssueSubtask[]): string {
  if (!subtasks || subtasks.length === 0) return "";
  return subtasks
    .map((sub, idx) => {
      const cleanId = (sub.id || `SUB-${idx + 1}`).trim();
      const cleanTitle = (sub.title || "Subtask").replace(/\r?\n/g, " ").replace(/\|/g, "-").trim();
      const parts = [`- [${sub.done ? "x" : " "}] ${cleanId}: ${cleanTitle}`];
      if (sub.assignee?.trim()) {
        const handle = sub.assignee.trim();
        parts.push(handle.startsWith("@") ? handle : `@${handle}`);
      }
      if (sub.estimatedHours !== undefined && Number.isFinite(sub.estimatedHours)) {
        parts.push(`est:${Number(sub.estimatedHours.toFixed(2))}h`);
      }
      if (sub.remainingHours !== undefined && Number.isFinite(sub.remainingHours)) {
        parts.push(`rem:${Number(sub.remainingHours.toFixed(2))}h`);
      }
      return parts.join(" | ");
    })
    .join("\n");
}

/**
 * Parses `## Attachments` lines such as:
 * `- [filename.png](assets/issues/MDT-102/filename.png)`
 */
export function parseAttachmentsSection(
  lines: string[],
  defaultAddedAt: string
): IssueAttachment[] {
  const attachments: IssueAttachment[] = [];
  let autoIdx = 1;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("_")) continue;

    const linkMatch = trimmed.match(/^[-*+]\s+!?\[([^\]]+)\]\(([^)]+)\)(.*)$/);
    if (!linkMatch) continue;

    const name = linkMatch[1].trim();
    const path = normalizePath(linkMatch[2].trim());
    const trailing = (linkMatch[3] || "").trim();

    let id = `att-${autoIdx++}`;
    let mimeType = inferMimeTypeFromName(name || path);
    let sizeBytes: number | undefined;
    let addedAt = defaultAddedAt;

    const metaCommentMatch = trailing.match(/<!--\s*att:([^-]+?)\s*-->/i);
    if (metaCommentMatch) {
      const pairs = metaCommentMatch[1].split(";").map((p) => p.trim());
      for (const pair of pairs) {
        const eqIdx = pair.indexOf("=");
        if (eqIdx <= 0) continue;
        const k = pair.slice(0, eqIdx).trim().toLowerCase();
        const v = pair.slice(eqIdx + 1).trim();
        if (k === "id" && v) id = v;
        else if (k === "mime" && v) mimeType = v;
        else if (k === "size") {
          const parsedSize = parseInt(v, 10);
          if (Number.isFinite(parsedSize) && parsedSize >= 0) sizeBytes = parsedSize;
        } else if (k === "added" && v) {
          addedAt = v;
        }
      }
    }

    const dataUrl = getCachedAttachmentDataUrl(path);
    attachments.push({
      id,
      name: name || path.split("/").pop() || "attachment",
      path,
      mimeType,
      ...(sizeBytes !== undefined ? { sizeBytes } : {}),
      addedAt,
      ...(dataUrl ? { dataUrl } : {}),
    });
  }

  return attachments;
}

export function serializeAttachmentsSection(attachments?: IssueAttachment[]): string {
  if (!attachments || attachments.length === 0) return "";
  return attachments
    .map((att, idx) => {
      const cleanName = (att.name || "attachment").replace(/[\[\]\r\n]/g, "").trim();
      const cleanPath = normalizePath(att.path);
      if (att.dataUrl) {
        cacheAttachmentDataUrl(cleanPath, att.dataUrl);
      }
      const metaParts = [
        `id=${(att.id || `att-${idx + 1}`).replace(/[;\s]/g, "_")}`,
        `mime=${(att.mimeType || inferMimeTypeFromName(cleanName)).replace(/[;\s]/g, "")}`,
      ];
      if (att.sizeBytes !== undefined && Number.isFinite(att.sizeBytes)) {
        metaParts.push(`size=${Math.round(att.sizeBytes)}`);
      }
      if (att.addedAt) {
        metaParts.push(`added=${att.addedAt.replace(/[;\s]/g, "")}`);
      }
      return `- [${cleanName}](${cleanPath}) <!-- att:${metaParts.join(";")} -->`;
    })
    .join("\n");
}

export function parseCommentsSection(
  lines: string[]
): { author: string; timestamp: string; text: string }[] {
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
    if (trimmed === "_No comments yet._" || trimmed === "_Noch keine Kommentare._") continue;

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
      comments.push({ author: "@team", timestamp: "", text: trimmed.slice(2).trim() });
    }
  }

  flush();
  return comments;
}
