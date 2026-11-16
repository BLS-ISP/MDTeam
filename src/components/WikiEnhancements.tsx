"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  CornerDownRight,
  Download,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  GitCommit,
  History,
  LayoutTemplate,
  Map as MapIcon,
  MessageSquare,
  MessageSquarePlus,
  Quote,
  RotateCcw,
  Rocket,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { exportDocumentToDocx } from "../utils/docxExporter";
import { extractFrontmatter } from "../utils/queryMacro";

export interface WorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

export type ReviewStatus = "draft" | "in-review" | "approved";

export interface InlineCommentMessage {
  id: string;
  author: string;
  text: string;
  mentions: string[];
  createdAt: string;
}

export interface InlineCommentThread {
  id: string;
  filePath: string;
  quote: string;
  lineNumber?: number;
  status: "open" | "resolved";
  resolved: boolean;
  createdAt: string;
  createdBy: string;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  comments: InlineCommentMessage[];
}

export interface InlineCommentsStore {
  version: number;
  threads: InlineCommentThread[];
}

export interface PageGovernanceBarProps {
  activeFile: WorkspaceFile;
  files?: WorkspaceFile[];
  currentUser: string;
  commentCount?: number;
  isTauri?: boolean;
  language?: "de" | "en";
  onUpdateContent: (newContent: string) => void;
  onOpenComments: () => void;
  onOpenHistory: () => void;
  onOpenTemplates: () => void;
  onExportDocx?: () => void;
}

export interface InlineCommentsDrawerProps {
  isOpen: boolean;
  activeFile: WorkspaceFile;
  files: WorkspaceFile[];
  currentUser: string;
  selectedQuote?: string;
  selectedLineNumber?: number;
  language?: "de" | "en";
  onClose: () => void;
  onUpsertFile: (file: WorkspaceFile) => void;
  onJumpToLine?: (lineNumber: number) => void;
}

export interface WikiTemplateDefinition {
  id: string;
  name: string;
  nameDe: string;
  badge: string;
  defaultFolder: string;
  slugPrefix: string;
  descriptionEn: string;
  descriptionDe: string;
  buildContent: (
    title: string,
    author: string,
    dateIso: string,
    language: "de" | "en"
  ) => string;
}

export interface TemplateGalleryModalProps {
  isOpen: boolean;
  currentUser?: string;
  existingFiles?: WorkspaceFile[];
  language?: "de" | "en";
  onClose: () => void;
  onCreateFile: (newFile: WorkspaceFile) => void;
}

export interface PageVersionEntry {
  id: string;
  commitHash: string;
  message: string;
  author: string;
  date: string;
  source: "git" | "session";
  snapshotContent?: string;
}

export interface PageHistoryModalProps {
  isOpen: boolean;
  activeFile: WorkspaceFile;
  isTauri: boolean;
  tauriRootFolder?: string;
  currentUser?: string;
  language?: "de" | "en";
  onClose: () => void;
  onRestoreVersion: (restoredContent: string, versionLabel?: string) => void;
}

export const INLINE_COMMENTS_FILE_PATH = ".mdteam/inline-comments.json";
const SESSION_SNAPSHOT_PREFIX = "mdteam_page_snapshots_v1:";
const MAX_SESSION_SNAPSHOTS = 20;

const MENTION_HANDLES = [
  "@developer-a",
  "@developer-b",
  "@scrum-master",
  "@product-owner",
];

function normalizeReviewStatus(raw: string): ReviewStatus {
  const s = raw.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (s === "approved" || s === "freigegeben" || s === "accepted") {
    return "approved";
  }
  if (s === "in-review" || s === "review" || s === "in-prüfung") {
    return "in-review";
  }
  return "draft";
}

function extractDocTitle(file: WorkspaceFile): string {
  const { frontmatter } = extractFrontmatter(file.content);
  const fmTitle =
    typeof frontmatter.title === "string" ? frontmatter.title.trim() : "";
  if (fmTitle) return fmTitle;
  const h1 = file.content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return file.name.replace(/\.md$/i, "");
}

function estimateReadingStats(markdown: string): {
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

  const formatLine = (k: string, v: string) => `${k}: "${v.replace(/"/g, '\\"')}"`;

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
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item) => {
        const resolvedBool =
          Boolean(item.resolved) || item.status === "resolved";
        const rawComments = Array.isArray(item.comments) ? item.comments : [];
        const comments: InlineCommentMessage[] = rawComments
          .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === "object"))
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

function serializeInlineCommentsFile(
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

function extractMentions(text: string): string[] {
  const matches = text.match(/@[a-zA-Z0-9_-]+/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

interface SessionSnapshotRecord {
  id: string;
  commitHash: string;
  message: string;
  author: string;
  date: string;
  content: string;
}

function loadSessionSnapshots(filePath: string): SessionSnapshotRecord[] {
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

/**
 * 1. <PageGovernanceBar />
 * Confluence-style document status, reading time, and action toolbar above the editor/preview.
 */
export function PageGovernanceBar({
  activeFile,
  files,
  currentUser,
  commentCount,
  isTauri = false,
  language = "de",
  onUpdateContent,
  onOpenComments,
  onOpenHistory,
  onOpenTemplates,
  onExportDocx,
}: PageGovernanceBarProps) {
  const isEn = language === "en";
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportedDone, setExportedDone] = useState(false);

  // Record session snapshots automatically so PageHistoryModal always has Time Machine points
  useEffect(() => {
    const timer = setTimeout(() => {
      recordPageSessionSnapshot(activeFile, currentUser || "@editor");
    }, 650);
    return () => clearTimeout(timer);
  }, [activeFile.path, activeFile.content, currentUser]);

  const { frontmatter } = useMemo(
    () => extractFrontmatter(activeFile.content),
    [activeFile.content]
  );

  const reviewStatus: ReviewStatus = useMemo(() => {
    const raw =
      (typeof frontmatter.review_status === "string"
        ? frontmatter.review_status
        : "") ||
      (typeof frontmatter.status === "string" ? frontmatter.status : "draft");
    return normalizeReviewStatus(raw);
  }, [frontmatter]);

  const approvedBy =
    typeof frontmatter.approved_by === "string"
      ? frontmatter.approved_by
      : "";

  const readingStats = useMemo(
    () => estimateReadingStats(activeFile.content),
    [activeFile.content]
  );

  const resolvedCommentCount = useMemo(() => {
    if (typeof commentCount === "number") return commentCount;
    if (files) return countOpenInlineComments(files, activeFile.path);
    return 0;
  }, [commentCount, files, activeFile.path]);

  const handleSetReviewStatus = (nextStatus: ReviewStatus) => {
    const today = new Date().toISOString().slice(0, 10);
    const updates: Record<string, string | null> = {
      review_status: nextStatus,
      updated_at: today,
      approved_by:
        nextStatus === "approved" ? currentUser || "@product-owner" : null,
    };
    const nextMarkdown = upsertDocumentFrontmatter(activeFile.content, updates);
    recordPageSessionSnapshot(
      { ...activeFile, content: nextMarkdown },
      currentUser,
      `Lifecycle -> ${nextStatus}`
    );
    onUpdateContent(nextMarkdown);
    setStatusMenuOpen(false);
  };

  const handleDocxClick = async () => {
    if (onExportDocx) {
      onExportDocx();
      return;
    }
    setExportingDocx(true);
    try {
      const ok = await exportDocumentToDocx(
        activeFile.name,
        extractDocTitle(activeFile),
        activeFile.content,
        isTauri
      );
      if (ok) {
        setExportedDone(true);
        setTimeout(() => setExportedDone(false), 2000);
      }
    } finally {
      setExportingDocx(false);
    }
  };

  const statusConfig: Record<
    ReviewStatus,
    { labelEn: string; labelDe: string; bg: string; color: string; border: string }
  > = {
    draft: {
      labelEn: "Draft",
      labelDe: "Entwurf",
      bg: "rgba(245, 158, 11, 0.14)",
      color: "var(--accent-yellow)",
      border: "rgba(245, 158, 11, 0.35)",
    },
    "in-review": {
      labelEn: "In Review",
      labelDe: "In Prüfung",
      bg: "rgba(99, 102, 241, 0.16)",
      color: "#a5b4fc",
      border: "rgba(99, 102, 241, 0.45)",
    },
    approved: {
      labelEn: "Approved",
      labelDe: "Freigegeben",
      bg: "rgba(16, 185, 129, 0.15)",
      color: "var(--accent-green)",
      border: "rgba(16, 185, 129, 0.4)",
    },
  };

  const currentCfg = statusConfig[reviewStatus];

  const actionBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 500,
    backgroundColor: "var(--bg-sidebar)",
    border: "1px solid var(--border-color)",
    color: "var(--text-secondary)",
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        padding: "6px 14px",
        backgroundColor: "var(--bg-panel)",
        borderBottom: "1px solid var(--border-color)",
        fontSize: "12px",
        position: "relative",
        zIndex: 20,
      }}
    >
      {/* Left: Governance Status Badge + Approved By + Reading Time */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setStatusMenuOpen((prev) => !prev)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              borderRadius: "999px",
              fontSize: "11.5px",
              fontWeight: 600,
              backgroundColor: currentCfg.bg,
              color: currentCfg.color,
              border: `1px solid ${currentCfg.border}`,
              cursor: "pointer",
            }}
            title={
              isEn
                ? "Change document review lifecycle status"
                : "Dokument-Freigabestatus ändern"
            }
          >
            <ShieldCheck size={13} />
            <span>{isEn ? currentCfg.labelEn : currentCfg.labelDe}</span>
            <ChevronDown size={12} />
          </button>

          {statusMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                minWidth: "185px",
                backgroundColor: "var(--bg-sidebar)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                boxShadow: "var(--shadow-lg)",
                padding: "4px",
                zIndex: 60,
              }}
            >
              {(["draft", "in-review", "approved"] as ReviewStatus[]).map(
                (st) => {
                  const cfg = statusConfig[st];
                  const selected = reviewStatus === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleSetReviewStatus(st)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        padding: "7px 10px",
                        border: "none",
                        borderRadius: "6px",
                        backgroundColor: selected
                          ? "var(--bg-active)"
                          : "transparent",
                        color: cfg.color,
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span>{isEn ? cfg.labelEn : cfg.labelDe}</span>
                      {selected && <Check size={13} />}
                    </button>
                  );
                }
              )}
            </div>
          )}
        </div>

        {reviewStatus === "approved" && approvedBy && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11.5px",
              color: "var(--text-secondary)",
            }}
          >
            <UserCheck size={13} style={{ color: "var(--accent-green)" }} />
            <span>
              {isEn ? "Approved by" : "Freigegeben von"}{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {approvedBy}
              </strong>
            </span>
          </span>
        )}

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            color: "var(--text-muted)",
            fontSize: "11.5px",
          }}
          title={`${readingStats.words} ${isEn ? "words" : "Wörter"}`}
        >
          <BookOpen size={13} />
          <span>
            ~{readingStats.minutes}{" "}
            {isEn ? "min read" : "Min. Lesezeit"} ({readingStats.words}{" "}
            {isEn ? "words" : "Wörter"})
          </span>
        </span>
      </div>

      {/* Right: Confluence Parity Action Buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onOpenComments}
          style={{
            ...actionBtnStyle,
            borderColor:
              resolvedCommentCount > 0
                ? "rgba(99, 102, 241, 0.5)"
                : "var(--border-color)",
            color:
              resolvedCommentCount > 0
                ? "#c7d2fe"
                : "var(--text-secondary)",
          }}
        >
          <MessageSquare size={13} />
          <span>{isEn ? "Comments" : "Kommentare"}</span>
          <span
            style={{
              padding: "0 6px",
              borderRadius: "999px",
              fontSize: "10.5px",
              fontWeight: 700,
              backgroundColor:
                resolvedCommentCount > 0
                  ? "var(--accent-indigo)"
                  : "var(--bg-active)",
              color:
                resolvedCommentCount > 0 ? "#ffffff" : "var(--text-muted)",
            }}
          >
            {resolvedCommentCount}
          </span>
        </button>

        <button type="button" onClick={onOpenHistory} style={actionBtnStyle}>
          <History size={13} />
          <span>{isEn ? "Page History" : "Versionshistorie"}</span>
        </button>

        <button type="button" onClick={onOpenTemplates} style={actionBtnStyle}>
          <LayoutTemplate size={13} />
          <span>{isEn ? "Templates" : "Vorlagen"}</span>
        </button>

        <button
          type="button"
          onClick={handleDocxClick}
          disabled={exportingDocx}
          style={{
            ...actionBtnStyle,
            backgroundColor: exportedDone
              ? "rgba(16, 185, 129, 0.16)"
              : "rgba(99, 102, 241, 0.14)",
            borderColor: exportedDone
              ? "rgba(16, 185, 129, 0.45)"
              : "rgba(99, 102, 241, 0.4)",
            color: exportedDone ? "var(--accent-green)" : "#c7d2fe",
          }}
        >
          {exportedDone ? <Check size={13} /> : <Download size={13} />}
          <span>
            {exportedDone
              ? isEn
                ? "DOCX Saved"
                : "DOCX gespeichert"
              : exportingDocx
              ? "DOCX..."
              : isEn
              ? "Export DOCX"
              : "DOCX Export"}
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * 2. <InlineCommentsDrawer />
 * Git-backed threaded document review comments stored in `.mdteam/inline-comments.json`.
 */
export function InlineCommentsDrawer({
  isOpen,
  activeFile,
  files,
  currentUser,
  selectedQuote = "",
  selectedLineNumber,
  language = "de",
  onClose,
  onUpsertFile,
  onJumpToLine,
}: InlineCommentsDrawerProps) {
  const isEn = language === "en";
  const [quoteText, setQuoteText] = useState<string>(selectedQuote);
  const [lineNumber, setLineNumber] = useState<string>(
    selectedLineNumber ? String(selectedLineNumber) : ""
  );
  const [newCommentText, setNewCommentText] = useState<string>("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [filterTab, setFilterTab] = useState<"open" | "resolved" | "all">(
    "open"
  );

  useEffect(() => {
    if (selectedQuote) setQuoteText(selectedQuote);
  }, [selectedQuote]);

  useEffect(() => {
    if (selectedLineNumber) setLineNumber(String(selectedLineNumber));
  }, [selectedLineNumber]);

  const allThreads = useMemo(() => parseInlineCommentsStore(files), [files]);

  const fileThreads = useMemo(
    () => allThreads.filter((t) => t.filePath === activeFile.path),
    [allThreads, activeFile.path]
  );

  const visibleThreads = useMemo(() => {
    if (filterTab === "open") return fileThreads.filter((t) => !t.resolved);
    if (filterTab === "resolved") return fileThreads.filter((t) => t.resolved);
    return fileThreads;
  }, [fileThreads, filterTab]);

  const documentLines = useMemo(
    () => activeFile.content.replace(/\r\n/g, "\n").split("\n"),
    [activeFile.content]
  );

  if (!isOpen) return null;

  const persistThreads = (nextThreads: InlineCommentThread[]) => {
    onUpsertFile(serializeInlineCommentsFile(nextThreads));
  };

  const handleCaptureSelection = () => {
    if (typeof window === "undefined") return;
    const sel = window.getSelection()?.toString().trim() || "";
    if (sel) {
      setQuoteText(sel.slice(0, 280));
      const idx = documentLines.findIndex((l) =>
        l.includes(sel.split("\n")[0].trim())
      );
      if (idx !== -1) {
        setLineNumber(String(idx + 1));
      }
    }
  };

  const handleLinePickerChange = (lineStr: string) => {
    setLineNumber(lineStr);
    const num = Number.parseInt(lineStr, 10);
    if (Number.isFinite(num) && num >= 1 && num <= documentLines.length) {
      const picked = documentLines[num - 1].trim();
      if (picked && !quoteText.trim()) {
        setQuoteText(picked.slice(0, 240));
      }
    }
  };

  const handleCreateThread = () => {
    const trimmedComment = newCommentText.trim();
    if (!trimmedComment) return;

    const nowIso = new Date().toISOString();
    const parsedLine = Number.parseInt(lineNumber, 10);
    const author = currentUser || "@developer-a";

    const newThread: InlineCommentThread = {
      id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      filePath: activeFile.path,
      quote: quoteText.trim(),
      lineNumber:
        Number.isFinite(parsedLine) && parsedLine > 0 ? parsedLine : undefined,
      status: "open",
      resolved: false,
      createdAt: nowIso,
      createdBy: author,
      resolvedBy: null,
      resolvedAt: null,
      comments: [
        {
          id: `msg-${Date.now()}`,
          author,
          text: trimmedComment,
          mentions: extractMentions(trimmedComment),
          createdAt: nowIso,
        },
      ],
    };

    persistThreads([newThread, ...allThreads]);
    setNewCommentText("");
    setQuoteText("");
    setLineNumber("");
  };

  const handleAddReply = (threadId: string) => {
    const draft = (replyDrafts[threadId] || "").trim();
    if (!draft) return;

    const nowIso = new Date().toISOString();
    const author = currentUser || "@developer-a";
    const nextThreads = allThreads.map((t) => {
      if (t.id !== threadId) return t;
      return {
        ...t,
        comments: [
          ...t.comments,
          {
            id: `msg-${Date.now()}`,
            author,
            text: draft,
            mentions: extractMentions(draft),
            createdAt: nowIso,
          },
        ],
      };
    });

    persistThreads(nextThreads);
    setReplyDrafts((prev) => ({ ...prev, [threadId]: "" }));
  };

  const handleToggleResolve = (threadId: string) => {
    const nowIso = new Date().toISOString();
    const nextThreads: InlineCommentThread[] = allThreads.map((t) => {
      if (t.id !== threadId) return t;
      const nextResolved = !t.resolved;
      return {
        ...t,
        resolved: nextResolved,
        status: nextResolved ? "resolved" : "open",
        resolvedBy: nextResolved ? currentUser || "@developer-a" : null,
        resolvedAt: nextResolved ? nowIso : null,
      };
    });
    persistThreads(nextThreads);
  };

  const handleDeleteThread = (threadId: string) => {
    persistThreads(allThreads.filter((t) => t.id !== threadId));
  };

  const renderCommentBodyWithMentions = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_-]+)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("@")) {
        return (
          <span
            key={idx}
            style={{
              backgroundColor: "rgba(99, 102, 241, 0.2)",
              color: "#a5b4fc",
              padding: "1px 5px",
              borderRadius: "4px",
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              fontSize: "11.5px",
            }}
          >
            {part}
          </span>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const openCount = fileThreads.filter((t) => !t.resolved).length;
  const resolvedCount = fileThreads.filter((t) => t.resolved).length;

  return (
    <div
      style={{
        position: "fixed",
        top: "48px",
        right: 0,
        bottom: 0,
        width: "400px",
        maxWidth: "95vw",
        backgroundColor: "var(--bg-sidebar)",
        borderLeft: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-lg)",
        display: "flex",
        flexDirection: "column",
        zIndex: 900,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-panel)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <MessageSquare size={16} style={{ color: "var(--accent-indigo)" }} />
          <div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {isEn ? "Inline Review Threads" : "Inline-Review-Kommentare"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {activeFile.path}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="action-icon-btn"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "4px",
          }}
        >
          <X size={17} />
        </button>
      </div>

      {/* New Comment Composer */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-editor)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "6px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {isEn ? "New Review Thread" : "Neuer Kommentar-Thread"}
          </span>
          <button
            type="button"
            onClick={handleCaptureSelection}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              backgroundColor: "rgba(99, 102, 241, 0.14)",
              border: "1px solid rgba(99, 102, 241, 0.35)",
              color: "#a5b4fc",
              cursor: "pointer",
            }}
          >
            <Quote size={11} />
            {isEn ? "Quote Selection" : "Auswahl zitieren"}
          </button>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <input
            type="text"
            value={quoteText}
            onChange={(e) => setQuoteText(e.target.value)}
            placeholder={
              isEn
                ? "Quoted text or section (optional)..."
                : "Zitierte Textstelle (optional)..."
            }
            style={{
              flex: 1,
              backgroundColor: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "6px 8px",
              fontSize: "12px",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <select
            value={lineNumber}
            onChange={(e) => handleLinePickerChange(e.target.value)}
            style={{
              width: "92px",
              backgroundColor: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "6px 6px",
              fontSize: "11.5px",
              color: "var(--text-secondary)",
              outline: "none",
            }}
            title={isEn ? "Anchor to line" : "Zeile verknüpfen"}
          >
            <option value="">{isEn ? "Line..." : "Zeile..."}</option>
            {documentLines.map((ln, idx) =>
              ln.trim() ? (
                <option key={idx + 1} value={String(idx + 1)}>
                  L{idx + 1}: {ln.trim().slice(0, 24)}
                </option>
              ) : null
            )}
          </select>
        </div>

        <textarea
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder={
            isEn
              ? `Comment as ${currentUser || "@developer-a"} (use @handle to notify)...`
              : `Kommentar als ${currentUser || "@developer-a"} (@handle für Erwähnung)...`
          }
          style={{
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            padding: "8px",
            fontSize: "12.5px",
            color: "var(--text-primary)",
            fontFamily: "var(--font-sans)",
            resize: "vertical",
            minHeight: "62px",
            outline: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "6px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {MENTION_HANDLES.map((handle) => (
              <button
                key={handle}
                type="button"
                onClick={() =>
                  setNewCommentText((prev) =>
                    prev.endsWith(" ") || !prev
                      ? `${prev}${handle} `
                      : `${prev} ${handle} `
                  )
                }
                style={{
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "10.5px",
                  fontFamily: "var(--font-mono)",
                  backgroundColor: "var(--bg-panel)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                {handle}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCreateThread}
            disabled={!newCommentText.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              border: "none",
              backgroundColor: newCommentText.trim()
                ? "var(--accent-indigo)"
                : "var(--bg-active)",
              color: newCommentText.trim() ? "#ffffff" : "var(--text-muted)",
              cursor: newCommentText.trim() ? "pointer" : "not-allowed",
            }}
          >
            <MessageSquarePlus size={13} />
            {isEn ? "Post" : "Senden"}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          padding: "8px 16px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-panel)",
        }}
      >
        {(
          [
            {
              key: "open",
              label: isEn ? `Open (${openCount})` : `Offen (${openCount})`,
            },
            {
              key: "resolved",
              label: isEn
                ? `Resolved (${resolvedCount})`
                : `Erledigt (${resolvedCount})`,
            },
            {
              key: "all",
              label: isEn
                ? `All (${fileThreads.length})`
                : `Alle (${fileThreads.length})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilterTab(tab.key)}
            style={{
              flex: 1,
              padding: "5px 8px",
              borderRadius: "5px",
              fontSize: "11.5px",
              fontWeight: 600,
              border:
                filterTab === tab.key
                  ? "1px solid rgba(99, 102, 241, 0.45)"
                  : "1px solid transparent",
              backgroundColor:
                filterTab === tab.key
                  ? "rgba(99, 102, 241, 0.16)"
                  : "transparent",
              color:
                filterTab === tab.key ? "#c7d2fe" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Threads List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {visibleThreads.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "12.5px",
            }}
          >
            {isEn
              ? "No inline review threads in this view yet."
              : "Noch keine Inline-Kommentare in dieser Ansicht vorhanden."}
          </div>
        ) : (
          visibleThreads.map((thread) => (
            <div
              key={thread.id}
              style={{
                backgroundColor: "var(--bg-panel)",
                border: `1px solid ${
                  thread.resolved
                    ? "rgba(16, 185, 129, 0.3)"
                    : "var(--border-color)"
                }`,
                borderRadius: "8px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {/* Quoted text & line badge */}
              {(thread.quote || thread.lineNumber) && (
                <div
                  onClick={() => {
                    if (thread.lineNumber && onJumpToLine) {
                      onJumpToLine(thread.lineNumber);
                    }
                  }}
                  style={{
                    borderLeft: "3px solid var(--accent-indigo)",
                    backgroundColor: "rgba(99, 102, 241, 0.08)",
                    padding: "6px 10px",
                    borderRadius: "0 6px 6px 0",
                    fontSize: "11.5px",
                    color: "var(--text-secondary)",
                    cursor:
                      thread.lineNumber && onJumpToLine ? "pointer" : "default",
                  }}
                >
                  {thread.lineNumber && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "10.5px",
                        fontWeight: 700,
                        color: "#a5b4fc",
                        marginRight: "6px",
                      }}
                    >
                      #L{thread.lineNumber}
                    </span>
                  )}
                  <span style={{ fontStyle: "italic" }}>
                    {thread.quote ? `“${thread.quote}”` : ""}
                  </span>
                </div>
              )}

              {/* Comments in thread */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {thread.comments.map((msg, idx) => (
                  <div
                    key={msg.id}
                    style={{
                      paddingLeft: idx > 0 ? "12px" : 0,
                      borderLeft:
                        idx > 0 ? "2px solid var(--border-color)" : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        marginBottom: "3px",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {idx > 0 && (
                          <CornerDownRight
                            size={10}
                            style={{
                              display: "inline",
                              marginRight: "4px",
                              color: "var(--text-muted)",
                            }}
                          />
                        )}
                        {msg.author}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontSize: "10.5px" }}>
                        {msg.createdAt.slice(0, 16).replace("T", " ")}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12.5px",
                        color: "var(--text-primary)",
                        lineHeight: 1.45,
                      }}
                    >
                      {renderCommentBodyWithMentions(msg.text)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Input + Thread Actions */}
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  paddingTop: "6px",
                  borderTop: "1px solid var(--border-color)",
                }}
              >
                <input
                  type="text"
                  value={replyDrafts[thread.id] || ""}
                  onChange={(e) =>
                    setReplyDrafts((prev) => ({
                      ...prev,
                      [thread.id]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddReply(thread.id);
                    }
                  }}
                  placeholder={
                    isEn ? "Reply to thread..." : "Antwort schreiben..."
                  }
                  style={{
                    flex: 1,
                    backgroundColor: "var(--bg-sidebar)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "5px",
                    padding: "5px 8px",
                    fontSize: "11.5px",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddReply(thread.id)}
                  style={{
                    padding: "5px 8px",
                    borderRadius: "5px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-sidebar)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                  title={isEn ? "Send reply" : "Antwort senden"}
                >
                  <Send size={12} />
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "11px",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleToggleResolve(thread.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: thread.resolved
                      ? "rgba(245, 158, 11, 0.12)"
                      : "rgba(16, 185, 129, 0.14)",
                    color: thread.resolved
                      ? "var(--accent-yellow)"
                      : "var(--accent-green)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <CheckCircle2 size={12} />
                  {thread.resolved
                    ? isEn
                      ? "Reopen Thread"
                      : "Wieder öffnen"
                    : isEn
                    ? "Resolve"
                    : "Als erledigt markieren"}
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteThread(thread.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: "3px",
                  }}
                  title={isEn ? "Delete thread" : "Thread löschen"}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer note */}
      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-panel)",
          fontSize: "10.5px",
          color: "var(--text-muted)",
        }}
      >
        {isEn
          ? `Version-controlled in Git via ${INLINE_COMMENTS_FILE_PATH}`
          : `Git-versioniert in ${INLINE_COMMENTS_FILE_PATH}`}
      </div>
    </div>
  );
}

/**
 * 6 Rich Confluence Knowledge Base Templates
 */
export const WIKI_TEMPLATES: WikiTemplateDefinition[] = [
  {
    id: "prd",
    name: "PRD - Product Requirements",
    nameDe: "PRD - Produktanforderungen",
    badge: "Product",
    defaultFolder: "wiki",
    slugPrefix: "prd",
    descriptionEn:
      "Structured Product Requirements Document with problem statement, KPIs, user stories, and scope matrix.",
    descriptionDe:
      "Strukturiertes Product Requirements Document mit Zielsetzung, Erfolgsmetriken, User Stories und Abgrenzung.",
    buildContent: (title, author, dateIso, lang) =>
      lang === "en"
        ? `---
title: "${title}"
author: "${author}"
review_status: "draft"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [prd, product, specification]
---

# ${title}

## 1. Executive Summary & Problem Statement
Describe the user pain point, strategic context, and business impact solved by this initiative.

## 2. Goals & Success Metrics (KPIs)
| Metric | Baseline | Target | Measurement Window |
| :--- | :---: | :---: | :--- |
| User Adoption Rate | 0% | > 65% | 30 days post-launch |
| Task Completion Time | 8 min | < 2 min | Sprint Review |

## 3. Target Personas & User Stories
- [ ] **As a Product Manager**, I want live status rollups inside documentation so stakeholder updates stay accurate.
- [ ] **As a Developer**, I want Markdown-first specs stored in Git alongside code and ADRs.

## 4. Functional Scope
### In Scope
* Core workflow implementation and keyboard navigation
* Bilingual UI (\`de\` / \`en\`) and offline-capable desktop support

### Out of Scope
* Legacy third-party proprietary plugins

## 5. Risks & Open Questions
> **Open Decision:** Confirm SSO group mapping with Security Architecture before GA release.
`
        : `---
title: "${title}"
author: "${author}"
review_status: "draft"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [prd, produkt, spezifikation]
---

# ${title}

## 1. Management Summary & Problemstellung
Beschreiben Sie das Nutzerproblem, den geschäftlichen Nutzen und warum dieses Vorhaben jetzt priorisiert wird.

## 2. Ziele & Erfolgsmetriken (KPIs)
| Kennzahl (KPI) | Ist-Wert | Ziel-Wert | Messzeitraum |
| :--- | :---: | :---: | :--- |
| Aktive Nutzungsrate | 0% | > 65% | 30 Tage nach Go-Live |
| Durchlaufzeit pro Review | 15 Min | < 4 Min | Nächster Sprint |

## 3. Zielgruppen & User Stories
- [ ] **Als Product Owner** möchte ich Live-Abfragen direkt im Dokument einbetten, um jederzeit den echten Sprint-Stand zu sehen.
- [ ] **Als Entwickler:in** möchte ich Anforderungen als sauberes Markdown im Git-Repository versionieren.

## 4. Funktionsumfang & Abgrenzung
### Im Scope (Must-Have)
* Vollständige Tastaturbedienbarkeit und Git-Versionierung
* Zweisprachige Oberfläche (\`de\` / \`en\`)

### Nicht im Scope (Out-of-Scope)
* Proprietäre Drittanbieter-Datenbankabhängigkeiten

## 5. Risiken & Offene Fragen
> **Offener Punkt:** Abstimmung der Berechtigungsrollen mit dem Security-Team bis zum Sprint Planning.
`,
  },
  {
    id: "rfc",
    name: "RFC - Technical Design",
    nameDe: "RFC - Technisches Design",
    badge: "Engineering",
    defaultFolder: "adrs",
    slugPrefix: "rfc",
    descriptionEn:
      "Engineering Request for Comments with architecture diagram, trade-off analysis, and rollout plan.",
    descriptionDe:
      "Technischer Design-Entwurf (RFC) inkl. Mermaid-Architekturdiagramm, Alternativenbewertung und Rollout-Plan.",
    buildContent: (title, author, dateIso, lang) =>
      lang === "en"
        ? `---
title: "${title}"
author: "${author}"
status: "proposed"
review_status: "in-review"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [rfc, architecture, engineering]
---

# ${title}

## 1. Context & Motivation
Explain the technical constraints, scaling bottlenecks, or architectural drivers behind this RFC.

## 2. Proposed Architecture
\`\`\`mermaid
flowchart LR
  Client["MDTeam Client (React 19)"] --> Bridge["Tauri Rust Git Bridge"]
  Client --> Yjs["Yjs CRDT Sync"]
  Bridge --> Repo[("Local & Remote Git Repo")]
\`\`\`

## 3. Design Alternatives Considered
| Option | Pros | Cons | Verdict |
| :--- | :--- | :--- | :---: |
| **Option A: Git-Native Markdown** | Zero DB lock-in, full offline diffing | Requires fast client parser | **Selected** |
| Option B: External SQL Service | Relational joins | Breaks offline-first Git workflow | Rejected |

## 4. Security, Performance & Rollout Plan
- [ ] Sanitize all CLI & file path inputs
- [ ] Add automated verification tests
- [ ] Staged rollout behind workspace role toggle
`
        : `---
title: "${title}"
author: "${author}"
status: "proposed"
review_status: "in-review"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [rfc, architektur, engineering]
---

# ${title}

## 1. Ausgangslage & Motivation
Welche technischen Randbedingungen oder Skalierungsanforderungen machen diesen Entwurf erforderlich?

## 2. Vorgeschlagene Zielarchitektur
\`\`\`mermaid
flowchart LR
  Client["MDTeam Client (React 19)"] --> Bridge["Tauri Rust Git Bridge"]
  Client --> Yjs["Yjs CRDT Sync"]
  Bridge --> Repo[("Lokales & Remote Git-Repo")]
\`\`\`

## 3. Bewertete Handlungsoptionen
| Variante | Vorteile | Nachteile | Entscheidung |
| :--- | :--- | :--- | :---: |
| **Option A: Git-Natives Markdown** | Kein Vendor-Lock-in, volle Offline-Fähigkeit | Client-seitiges Indexing nötig | **Gewählt** |
| Option B: Externe SQL-Datenbank | Komplexe SQL-Joins | Bricht Single-Source-of-Truth in Git | Verworfen |

## 4. Security, Performance & Rollout-Checkliste
- [ ] Strikte Input-Validierung aller Pfade und Parameter
- [ ] Abwärtskompatibilität für bestehende Dokumente sicherstellen
- [ ] Architektur-Review im Team abschließen
`,
  },
  {
    id: "postmortem",
    name: "Incident Post-Mortem",
    nameDe: "Incident Post-Mortem",
    badge: "SRE / Ops",
    defaultFolder: "wiki",
    slugPrefix: "postmortem",
    descriptionEn:
      "Blameless incident retrospective with severity summary, minute-by-minute timeline, 5 Whys root cause, and CAPA actions.",
    descriptionDe:
      "Blameless Incident-Analyse mit Auswirkungsprofil, Minuten-Timeline, 5-Why-Ursachenanalyse und Maßnahmenplan.",
    buildContent: (title, author, dateIso, lang) =>
      lang === "en"
        ? `---
title: "${title}"
author: "${author}"
review_status: "draft"
severity: "SEV-2"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [incident, postmortem, reliability]
---

# ${title}

## 1. Incident Summary
| Field | Value |
| :--- | :--- |
| **Date** | ${dateIso} |
| **Severity** | SEV-2 (Partial Degradation) |
| **Incident Lead** | ${author} |
| **Time to Mitigate (TTM)** | 28 minutes |

## 2. Minute-by-Minute Timeline (UTC)
* **09:12** — Automated alert triggered on elevated WebSocket reconnect latency.
* **09:19** — On-call engineer identified memory spike on sync worker container.
* **09:40** — Rolled back config change and verified healthy sync state.

## 3. Root Cause Analysis (5 Whys)
1. **Why did sync stall?** Connection pool reached max open descriptors.
2. **Why were descriptors exhausted?** Idle rooms were not garbage-collected on disconnect.

## 4. Corrective & Preventive Actions (CAPA)
- [ ] Add room TTL eviction & memory circuit breaker @developer-b
- [ ] Add synthetic reconnect load test to CI pipeline @developer-a
`
        : `---
title: "${title}"
author: "${author}"
review_status: "draft"
severity: "SEV-2"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [incident, postmortem, betrieb]
---

# ${title}

## 1. Vorfalls-Übersicht
| Merkmal | Wert |
| :--- | :--- |
| **Datum** | ${dateIso} |
| **Schweregrad** | SEV-2 (Teilbeeinträchtigung) |
| **Incident Commander** | ${author} |
| **Dauer bis Entstörung** | 28 Minuten |

## 2. Chronologischer Ablauf
* **09:12** — Monitoring meldet erhöhte Reconnect-Zeiten am Sync-Service.
* **09:19** — Bereitschaft identifiziert erschöpftes Connection-Limit im Container.
* **09:40** — Rollback der Konfiguration durchgeführt; Normalbetrieb wiederhergestellt.

## 3. Ursachenanalyse (Blameless 5-Whys)
1. **Warum schlugen Verbindungen fehl?** Das Dateideskriptor-Limit des Containers war erreicht.
2. **Warum wurden Verbindungen nicht freigegeben?** Inaktive Sessions hatten kein Idle-Timeout.

## 4. Korrektur- & Präventionsmaßnahmen
- [ ] Automatisches Idle-Timeout für verwaiste WebSocket-Räume einbauen @developer-b
- [ ] Lasttest für Reconnect-Spitzen in die CI-Pipeline aufnehmen @developer-a
`,
  },
  {
    id: "release-notes",
    name: "Release Notes",
    nameDe: "Release Notes",
    badge: "Live Query",
    defaultFolder: "wiki",
    slugPrefix: "release-notes",
    descriptionEn:
      "Customer & stakeholder Release Notes featuring embedded live ```query``` blocks pulling completed & open issues automatically!",
    descriptionDe:
      "Release Notes mit eingebetteter Live-Datenbankabfrage (```query```), die erledigte Tickets automatisch aus dem Workspace zieht!",
    buildContent: (title, author, dateIso, lang) =>
      lang === "en"
        ? `---
title: "${title}"
author: "${author}"
review_status: "in-review"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [release, changelog]
---

# ${title}

> **Release Highlights:** Summary of shipped features, architectural improvements, and resolved bugs for this milestone.

## 1. Key Highlights
* **Git-Native Jira & Confluence Workspace:** Unified Sprint Boards, Live Queries, and OpenXML Word exports directly over Git Markdown files.
* **Zero-Lock-In Collaboration:** Full offline & real-time Yjs editing parity.

## 2. Shipped Issues (Live Query)
\`\`\`query
FROM issues
WHERE status = done
SORT priority DESC
VIEW table
\`\`\`

## 3. Remaining Open Items in Active Scope
\`\`\`query
FROM issues
WHERE status != done
SORT priority DESC
VIEW cards
\`\`\`

## 4. Upgrade & Verification Checklist
- [x] Zero TypeScript or linter errors
- [ ] Stakeholder sign-off via Page Governance Bar (\`Approved\`)
`
        : `---
title: "${title}"
author: "${author}"
review_status: "in-review"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [release, changelog]
---

# ${title}

> **Release-Überblick:** Zusammenfassung aller ausgelieferten Funktionen, Verbesserungen und behobenen Fehler dieser Version.

## 1. Wichtigste Neuerungen
* **Git-Nativer Jira- & Confluence-Workspace:** Interaktive Sprint-Boards, Live-Datenbankabfragen und direkter Microsoft Word (\`.docx\`) Export.
* **Volle Datenhoheit:** Alle Tickets, Reviews und Architekturentscheidungen liegen als sauberes Markdown in Git.

## 2. Ausgelieferte Tickets (Live-Abfrage)
\`\`\`query
FROM issues
WHERE status = done
SORT priority DESC
VIEW table
\`\`\`

## 3. Offene Punkte für das Folge-Release
\`\`\`query
FROM issues
WHERE status != done
SORT priority DESC
VIEW cards
\`\`\`

## 4. Freigabe-Checkliste
- [x] Alle Qualitäts- und Build-Prüfungen erfolgreich bestanden
- [ ] Formale Freigabe oben in der Governance-Leiste (\`Freigegeben\`) erteilt
`,
  },
  {
    id: "story-map",
    name: "User Story Map",
    nameDe: "User Story Map",
    badge: "Agile",
    defaultFolder: "management",
    slugPrefix: "story-map",
    descriptionEn:
      "Jeff Patton-style User Story Map organizing backbone user activities across MVP, Release 1.1, and Future slices.",
    descriptionDe:
      "User Story Map nach Jeff Patton: Nutzeraktivitäten horizontal und Release-Slices (MVP, R1.1, Zukunft) vertikal geplant.",
    buildContent: (title, author, dateIso, lang) =>
      lang === "en"
        ? `---
title: "${title}"
author: "${author}"
review_status: "draft"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [story-map, agile, discovery]
---

# ${title}

## 1. User Journey Backbone
| Step 1: Onboard & Import | Step 2: Plan & Estimate | Step 3: Author & Review | Step 4: Ship & Export |
| :--- | :--- | :--- | :--- |
| Connect Git repository | Groom backlog & Epics | Write specs & ADRs | Export DOCX / PDF |
| Import Jira / Confluence | Run Planning Poker | Resolve inline comments | Complete Sprint metrics |

## 2. Release Slices
### Slice 1 — Walking Skeleton (MVP)
- [x] Git workspace explorer + live Markdown split preview
- [ ] Kanban Sprint Board with Fibonacci Story Points

### Slice 2 — Team Collaboration (v1.1)
- [ ] Threaded inline review comments & page approval workflow
- [ ] Live \`\`\`query\`\`\` blocks inside Wiki & Release Notes

### Slice 3 — Enterprise Governance (v1.2)
- [ ] Stakeholder clean reading mode & automated release bundles
`
        : `---
title: "${title}"
author: "${author}"
review_status: "draft"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [story-map, agile, discovery]
---

# ${title}

## 1. User Journey Backbone (Nutzerfluss)
| Phase 1: Onboarding & Import | Phase 2: Sprint-Planung | Phase 3: Dokumentation & Review | Phase 4: Release & Export |
| :--- | :--- | :--- | :--- |
| Git-Repository verbinden | Epics & Stories schneiden | Konzepte & ADRs verfassen | DOCX / PDF Bericht exportieren |
| Jira & Confluence importieren | Planning Poker schätzen | Inline-Kommentare klären | Sprint-Metriken abschließen |

## 2. Vertikale Release-Schnitte (Slices)
### Slice 1 — Kernprodukt (MVP)
- [x] Git-basierter Editor mit Split-Screen-Vorschau
- [ ] Kanban-Board mit Drag & Drop und Story Points

### Slice 2 — Team-Kollaboration (v1.1)
- [ ] Inline-Review-Threads & Dokument-Freigabestatus
- [ ] Dynamische \`\`\`query\`\`\` Makros in Wiki-Seiten

### Slice 3 — Stakeholder-Reporting (v1.2)
- [ ] Aufgeräumter Stakeholder-Modus & Management-Exporte
`,
  },
  {
    id: "onboarding",
    name: "Onboarding Guide",
    nameDe: "Onboarding-Leitfaden",
    badge: "People",
    defaultFolder: "wiki",
    slugPrefix: "onboarding",
    descriptionEn:
      "First-week engineering & PM onboarding playbook with environment setup, key architecture links, and 30-60-90 day milestones.",
    descriptionDe:
      "Strukturierter Einarbeitungsplan für neue Teammitglieder inkl. Setup-Checkliste, Architektur-Links und 30-60-90-Tage-Zielen.",
    buildContent: (title, author, dateIso, lang) =>
      lang === "en"
        ? `---
title: "${title}"
author: "${author}"
review_status: "approved"
approved_by: "${author}"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [onboarding, handbook, team]
---

# ${title}

Welcome to the team! This guide walks you through your local setup, architecture conventions, and first sprint milestones.

## 1. Day 1 Environment Checklist
- [ ] Clone the project repository and verify Git SSH/HTTPS credentials
- [ ] Read [Introduction & Goals](arc42/01_introduction_goals.md) and [System Constraints](arc42/02_constraints.md)
- [ ] Review accepted decisions in [ADR-0001 Auth Strategy](adrs/ADR-0001-auth-strategy.md)
- [ ] Pick your starter ticket on the Scrum Board

## 2. Team Rituals & Contacts
| Ceremony | Cadence | Owner |
| :--- | :--- | :--- |
| Daily Standup | Daily 09:30 | \`@scrum-master\` |
| Sprint Planning & Poker | Bi-weekly Monday | \`@product-owner\` |
| Architecture Guild | Thursday 14:00 | \`@developer-a\` |

## 3. 30 / 60 / 90 Day Milestones
1. **First 30 Days:** Ship your first Story & participate in inline doc reviews.
2. **First 60 Days:** Author an RFC/ADR and lead a feature demo in Sprint Review.
3. **First 90 Days:** Own an Epic end-to-end from PRD to Release Notes.
`
        : `---
title: "${title}"
author: "${author}"
review_status: "approved"
approved_by: "${author}"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [onboarding, handbuch, team]
---

# ${title}

Willkommen im Team! Dieser Leitfaden begleitet dich durch das technische Setup, unsere Architektur-Dokumentation und deine ersten Wochen.

## 1. Tag-1 Setup-Checkliste
- [ ] Git-Repository klonen und Zugangsdaten prüfen
- [ ] [Einführung und Ziele](arc42/01_introduction_goals.md) sowie [Randbedingungen](arc42/02_constraints.md) lesen
- [ ] Aktuelle Architekturentscheidungen prüfen: [ADR-0001 Authentifizierung](adrs/ADR-0001-auth-strategy.md)
- [ ] Erstes Starter-Ticket im Sprint-Board übernehmen

## 2. Team-Termine & Ansprechpersonen
| Regeltermin | Rhythmus | Moderation |
| :--- | :--- | :--- |
| Daily Standup | Täglich 09:30 Uhr | \`@scrum-master\` |
| Sprint Planning & Poker | Alle 2 Wochen montags | \`@product-owner\` |
| Architektur-Runde | Donnerstags 14:00 Uhr | \`@developer-a\` |

## 3. 30 / 60 / 90 Tage Fahrplan
1. **Tag 1–30:** Erstes Feature-Ticket abschließen & Inline-Reviews durchführen.
2. **Tag 31–60:** Eigenen RFC/ADR entwerfen und im Sprint Review präsentieren.
3. **Tag 61–90:** Ein Epic Ende-zu-Ende von PRD bis Release Notes verantworten.
`,
  },
];

function slugifyFileName(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "new-page"
  );
}

/**
 * 3. <TemplateGalleryModal />
 * Confluence-style modal to create new pages from 6 rich knowledge-base templates.
 */
export function TemplateGalleryModal({
  isOpen,
  currentUser = "@developer-a",
  existingFiles = [],
  language = "de",
  onClose,
  onCreateFile,
}: TemplateGalleryModalProps) {
  const isEn = language === "en";
  const [selectedId, setSelectedId] = useState<string>(WIKI_TEMPLATES[0].id);
  const [pageTitle, setPageTitle] = useState<string>("");
  const [targetFolder, setTargetFolder] = useState<string>(
    WIKI_TEMPLATES[0].defaultFolder
  );

  const selectedTemplate = useMemo(
    () =>
      WIKI_TEMPLATES.find((t) => t.id === selectedId) || WIKI_TEMPLATES[0],
    [selectedId]
  );

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const effectiveTitle =
    pageTitle.trim() ||
    (isEn ? selectedTemplate.name : selectedTemplate.nameDe);

  const targetPath = useMemo(() => {
    const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, "") || "wiki";
    const baseSlug = pageTitle.trim()
      ? slugifyFileName(pageTitle)
      : `${selectedTemplate.slugPrefix}-${todayIso}`;
    let candidate = `${cleanFolder}/${baseSlug}.md`;
    let suffix = 2;
    while (existingFiles.some((f) => f.path === candidate)) {
      candidate = `${cleanFolder}/${baseSlug}-${suffix}.md`;
      suffix++;
    }
    return candidate;
  }, [targetFolder, pageTitle, selectedTemplate, todayIso, existingFiles]);

  const previewMarkdown = useMemo(
    () =>
      selectedTemplate.buildContent(
        effectiveTitle,
        currentUser,
        todayIso,
        language
      ),
    [selectedTemplate, effectiveTitle, currentUser, todayIso, language]
  );

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl: WikiTemplateDefinition) => {
    setSelectedId(tpl.id);
    setTargetFolder(tpl.defaultFolder);
  };

  const handleCreate = () => {
    const parts = targetPath.split("/");
    const fileName = parts[parts.length - 1];
    const category = parts[0] || "wiki";
    onCreateFile({
      path: targetPath,
      name: fileName,
      category,
      content: previewMarkdown,
    });
    setPageTitle("");
    onClose();
  };

  const renderTemplateIcon = (id: string) => {
    switch (id) {
      case "prd":
        return <FileText size={16} style={{ color: "var(--accent-indigo)" }} />;
      case "rfc":
        return <Sparkles size={16} style={{ color: "var(--accent-blue)" }} />;
      case "postmortem":
        return <AlertTriangle size={16} style={{ color: "var(--accent-yellow)" }} />;
      case "release-notes":
        return <Rocket size={16} style={{ color: "var(--accent-green)" }} />;
      case "story-map":
        return <MapIcon size={16} style={{ color: "#c084fc" }} />;
      default:
        return <Users size={16} style={{ color: "#38bdf8" }} />;
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "920px",
          maxWidth: "96vw",
          height: "82vh",
          backgroundColor: "var(--bg-editor)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 20px",
            backgroundColor: "var(--bg-panel)",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <LayoutTemplate
              size={18}
              style={{ color: "var(--accent-indigo)" }}
            />
            <div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {isEn
                  ? "Confluence Knowledge Base Templates"
                  : "Wissensdatenbank-Vorlagen (Templates)"}
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                {isEn
                  ? "Choose one of 6 structured engineering & product templates"
                  : "6 strukturierte Vorlagen für Produkt, Architektur & Betrieb"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Split Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left: 6 Templates List */}
          <div
            style={{
              width: "340px",
              borderRight: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-sidebar)",
              overflowY: "auto",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {WIKI_TEMPLATES.map((tpl) => {
              const active = tpl.id === selectedId;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  style={{
                    textAlign: "left",
                    padding: "11px 12px",
                    borderRadius: "8px",
                    border: active
                      ? "1px solid var(--accent-indigo)"
                      : "1px solid var(--border-color)",
                    backgroundColor: active
                      ? "rgba(99, 102, 241, 0.14)"
                      : "var(--bg-panel)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "7px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {renderTemplateIcon(tpl.id)}
                      {isEn ? tpl.name : tpl.nameDe}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "4px",
                        backgroundColor: "var(--bg-active)",
                        color: "#a5b4fc",
                        textTransform: "uppercase",
                      }}
                    >
                      {tpl.badge}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "11.5px",
                      color: "var(--text-secondary)",
                      lineHeight: 1.4,
                    }}
                  >
                    {isEn ? tpl.descriptionEn : tpl.descriptionDe}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Configuration & Live Markdown Preview */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              padding: "16px 20px",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 165px",
                gap: "12px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "5px",
                  }}
                >
                  {isEn ? "Document Title" : "Seitentitel"}
                </label>
                <input
                  type="text"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder={
                    isEn ? selectedTemplate.name : selectedTemplate.nameDe
                  }
                  style={{
                    width: "100%",
                    backgroundColor: "var(--bg-sidebar)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    fontSize: "13px",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "5px",
                  }}
                >
                  {isEn ? "Space / Folder" : "Bereich / Ordner"}
                </label>
                <select
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: "var(--bg-sidebar)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    fontSize: "13px",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                >
                  <option value="wiki">wiki/</option>
                  <option value="arc42">arc42/</option>
                  <option value="adrs">adrs/</option>
                  <option value="management">management/</option>
                  <option value="meetings">meetings/</option>
                </select>
              </div>
            </div>

            <div
              style={{
                fontSize: "11.5px",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {isEn ? "Target path:" : "Zielpfad:"}{" "}
              <span style={{ color: "#a5b4fc" }}>{targetPath}</span>
            </div>

            <div
              style={{
                flex: 1,
                backgroundColor: "var(--bg-sidebar)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "14px",
                overflowY: "auto",
              }}
            >
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  color: "var(--text-secondary)",
                }}
              >
                {previewMarkdown}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            backgroundColor: "var(--bg-panel)",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "transparent",
              color: "var(--text-secondary)",
              fontSize: "12.5px",
              cursor: "pointer",
            }}
          >
            {isEn ? "Cancel" : "Abbrechen"}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--accent-indigo)",
              color: "#ffffff",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <FilePlus2 size={14} />
            {isEn ? "Create Page from Template" : "Seite aus Vorlage erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseGitHistoryOutput(rawOutput: string): PageVersionEntry[] {
  const entries: PageVersionEntry[] = [];
  const lines = rawOutput
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Format from Rust git_file_history: %h|%s|%an|%ad
    // Parse first pipe from left and last two pipes from right so `%s` containing `|` never breaks!
    const firstPipe = line.indexOf("|");
    const lastPipe = line.lastIndexOf("|");
    if (firstPipe === -1 || lastPipe === -1 || firstPipe === lastPipe) continue;

    const commitHash = line.slice(0, firstPipe).trim();
    const date = line.slice(lastPipe + 1).trim();
    const middle = line.slice(firstPipe + 1, lastPipe);
    const secondLastPipe = middle.lastIndexOf("|");

    let message = middle.trim();
    let author = "Git Author";
    if (secondLastPipe !== -1) {
      message = middle.slice(0, secondLastPipe).trim();
      author = middle.slice(secondLastPipe + 1).trim() || "Git Author";
    }

    if (commitHash) {
      entries.push({
        id: `git-${commitHash}`,
        commitHash,
        message: message || "Commit",
        author,
        date,
        source: "git",
      });
    }
  }

  return entries;
}

/**
 * 4. <PageHistoryModal />
 * Confluence-style Page Version History & Time Machine with Monaco Side-by-Side DiffEditor
 * and 1-click "Restore this version" button.
 */
export function PageHistoryModal({
  isOpen,
  activeFile,
  isTauri,
  tauriRootFolder,
  currentUser = "@developer-a",
  language = "de",
  onClose,
  onRestoreVersion,
}: PageHistoryModalProps) {
  const isEn = language === "en";
  const [versions, setVersions] = useState<PageVersionEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [historicalContent, setHistoricalContent] = useState<string>("");
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [loadingDiff, setLoadingDiff] = useState<boolean>(false);
  const [sideBySide, setSideBySide] = useState<boolean>(true);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);

  // Load version history when opened
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadHistory = async () => {
      setLoadingList(true);
      const combined: PageVersionEntry[] = [];

      // 1. Try native Git history when running inside Tauri with an open repository
      if (isTauri && tauriRootFolder) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const rawLog = await invoke<string>("git_file_history", {
            repoPath: tauriRootFolder,
            filePath: activeFile.path,
            limit: 20,
          });
          if (rawLog && rawLog.trim()) {
            combined.push(...parseGitHistoryOutput(rawLog));
          }
        } catch (err) {
          console.warn(
            "git_file_history unavailable or file untracked, falling back to session snapshots:",
            err
          );
        }
      }

      // 2. Load browser / session snapshots (used directly in browser mode or appended for uncommitted edits)
      recordPageSessionSnapshot(activeFile, currentUser);
      const sessionSnaps = loadSessionSnapshots(activeFile.path).map(
        (snap): PageVersionEntry => ({
          id: `session-${snap.id}`,
          commitHash: snap.commitHash,
          message: snap.message,
          author: snap.author,
          date: snap.date,
          source: "session",
          snapshotContent: snap.content,
        })
      );

      if (combined.length === 0) {
        combined.push(...sessionSnaps);
      } else {
        // Include latest session checkpoints if uncommitted local changes exist
        for (const snap of sessionSnaps.slice(0, 5)) {
          combined.push(snap);
        }
      }

      if (!cancelled) {
        setVersions(combined);
        setSelectedId(combined[0]?.id || "");
        setLoadingList(false);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    activeFile.path,
    isTauri,
    tauriRootFolder,
    currentUser,
    refreshCounter,
  ]);

  const selectedEntry = useMemo(
    () => versions.find((v) => v.id === selectedId) || null,
    [versions, selectedId]
  );

  // Fetch file content for the selected historical commit / snapshot
  useEffect(() => {
    if (!isOpen || !selectedEntry) {
      setHistoricalContent("");
      return;
    }

    if (selectedEntry.source === "session") {
      setHistoricalContent(selectedEntry.snapshotContent ?? "");
      return;
    }

    if (isTauri && tauriRootFolder) {
      let cancelled = false;
      setLoadingDiff(true);
      import("@tauri-apps/api/core")
        .then(({ invoke }) =>
          invoke<string>("git_show_file_at_commit", {
            repoPath: tauriRootFolder,
            commitHash: selectedEntry.commitHash,
            filePath: activeFile.path,
          })
        )
        .then((content) => {
          if (!cancelled) {
            setHistoricalContent(content);
            setLoadingDiff(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load commit content:", err);
          if (!cancelled) {
            setHistoricalContent(activeFile.content);
            setLoadingDiff(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, selectedEntry, isTauri, tauriRootFolder, activeFile.path, activeFile.content]);

  if (!isOpen) return null;

  const handleSaveManualSnapshot = () => {
    const label = isEn ? "Manual checkpoint" : "Manueller Sicherungspunkt";
    recordPageSessionSnapshot(activeFile, currentUser, label);
    setRefreshCounter((c) => c + 1);
  };

  const handleRestoreClick = () => {
    if (!selectedEntry) return;
    recordPageSessionSnapshot(
      activeFile,
      currentUser,
      isEn ? "Backup before restore" : "Backup vor Wiederherstellung"
    );
    onRestoreVersion(historicalContent, selectedEntry.commitHash);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1150,
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "94vw",
          height: "86vh",
          backgroundColor: "var(--bg-editor)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 20px",
            backgroundColor: "var(--bg-panel)",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <History size={18} style={{ color: "var(--accent-indigo)" }} />
            <div>
              <div
                style={{
                  fontSize: "14.5px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {isEn
                  ? `Page Version History — ${activeFile.name}`
                  : `Versionshistorie & Zeitmaschine — ${activeFile.name}`}
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                {isTauri && tauriRootFolder
                  ? isEn
                    ? "Git commit history + local session checkpoints"
                    : "Git-Commit-Historie + lokale Sitzungs-Snapshots"
                  : isEn
                  ? "Browser mode: local sessionStorage Time Machine snapshots"
                  : "Browser-Modus: lokale sessionStorage Zeitmaschinen-Snapshots"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setSideBySide((s) => !s)}
              style={{
                padding: "5px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-sidebar)",
                color: "var(--text-secondary)",
                fontSize: "11.5px",
                cursor: "pointer",
              }}
            >
              {sideBySide
                ? isEn
                  ? "Side-by-Side Diff"
                  : "Nebeneinander-Diff"
                : isEn
                ? "Inline Diff"
                : "Inline-Diff"}
            </button>

            <button
              type="button"
              onClick={handleSaveManualSnapshot}
              style={{
                padding: "5px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-sidebar)",
                color: "var(--text-secondary)",
                fontSize: "11.5px",
                cursor: "pointer",
              }}
            >
              {isEn ? "+ Save Snapshot" : "+ Snapshot sichern"}
            </button>

            <button
              type="button"
              onClick={handleRestoreClick}
              disabled={!selectedEntry || loadingDiff}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: selectedEntry
                  ? "var(--accent-indigo)"
                  : "var(--bg-active)",
                color: selectedEntry ? "#ffffff" : "var(--text-muted)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: selectedEntry ? "pointer" : "not-allowed",
              }}
            >
              <RotateCcw size={13} />
              {isEn ? "Restore this version" : "Diese Version wiederherstellen"}
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body: Left Timeline + Right Monaco DiffEditor */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div
            style={{
              width: "300px",
              borderRight: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-sidebar)",
              overflowY: "auto",
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {loadingList ? (
              <div
                style={{
                  padding: "20px",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                }}
              >
                {isEn ? "Loading history..." : "Lade Versionsverlauf..."}
              </div>
            ) : versions.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                }}
              >
                {isEn
                  ? "No snapshots recorded yet."
                  : "Noch keine Versionen aufgezeichnet."}
              </div>
            ) : (
              versions.map((ver) => {
                const active = ver.id === selectedId;
                return (
                  <button
                    key={ver.id}
                    type="button"
                    onClick={() => setSelectedId(ver.id)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: active
                        ? "1px solid var(--accent-indigo)"
                        : "1px solid var(--border-color)",
                      backgroundColor: active
                        ? "rgba(99, 102, 241, 0.14)"
                        : "var(--bg-panel)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          fontWeight: 700,
                          color:
                            ver.source === "git"
                              ? "#a5b4fc"
                              : "var(--accent-green)",
                        }}
                      >
                        <GitCommit size={12} />
                        {ver.commitHash}
                      </span>
                      <span
                        style={{
                          fontSize: "9.5px",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: "4px",
                          backgroundColor: "var(--bg-active)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {ver.source}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ver.message}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "10.5px",
                        color: "var(--text-muted)",
                      }}
                    >
                      <span>{ver.author}</span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        <Clock size={10} />
                        {ver.date}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Diff Pane */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                padding: "6px 16px",
                backgroundColor: "var(--bg-sidebar)",
                borderBottom: "1px solid var(--border-color)",
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              <div>
                {selectedEntry
                  ? `${
                      isEn ? "Selected Version" : "Ausgewählte Version"
                    } (${selectedEntry.commitHash})`
                  : isEn
                  ? "Historical Version"
                  : "Historische Version"}
              </div>
              <div style={{ paddingLeft: "12px" }}>
                {isEn
                  ? "Current Working Document"
                  : "Aktuelle Arbeitsversion"}
              </div>
            </div>

            <div style={{ flex: 1, position: "relative" }}>
              {loadingDiff ? (
                <div
                  style={{
                    padding: "24px",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                  }}
                >
                  {isEn
                    ? "Loading commit snapshot..."
                    : "Lade Dateiinhalt aus Git-Historie..."}
                </div>
              ) : (
                <DiffEditor
                  original={historicalContent}
                  modified={activeFile.content}
                  language="markdown"
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "var(--font-mono)",
                    automaticLayout: true,
                    renderSideBySide: sideBySide,
                    originalEditable: false,
                    ignoreTrimWhitespace: false,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function inferImageExtension(mimeType: string, rawName: string): string {
  const existingMatch = rawName.match(/\.(png|jpe?g|gif|webp|svg|bmp)$/i);
  if (existingMatch) return existingMatch[1].toLowerCase();
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/svg+xml") return "svg";
  return "png";
}

function sanitizeImageFileName(blob: File): string {
  const ext = inferImageExtension(blob.type, blob.name || "");
  const baseRaw = (blob.name || "screenshot")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `${baseRaw || "screenshot"}.${ext}`;
}

async function compressImageToDataUrl(blob: File): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "";
  }

  // SVG or tiny files (< 35 KB): read directly as Data-URL without lossy rasterization
  if (blob.type === "image/svg+xml" || blob.size < 35_000) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = (err) => reject(err);
      el.src = objectUrl;
    });

    const maxDim = 1280;
    let width = img.naturalWidth || img.width || 800;
    let height = img.naturalHeight || img.height || 600;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context unavailable");
    }
    ctx.drawImage(img, 0, 0, width, height);

    const webpUrl = canvas.toDataURL("image/webp", 0.82);
    if (webpUrl.startsWith("data:image/webp")) {
      return webpUrl;
    }
    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * 5. handlePasteOrDropImage
 * Handles Ctrl+V clipboard screenshots or dropped image files:
 * - In Tauri (`isTauri && tauriRootFolder`): writes binary file to `${tauriRootFolder}/assets/<timestamp>-<safeName>`
 *   via `@tauri-apps/plugin-fs` (`mkdir` + `writeFile`) and returns `{ markdown: "![screenshot](assets/...)" }`.
 * - In Browser mode: compresses onto an offscreen canvas and returns `{ markdown: "![screenshot](data:image/...)" }`.
 */
export async function handlePasteOrDropImage(
  blob: File,
  isTauri: boolean,
  tauriRootFolder: string
): Promise<{ markdown: string } | null> {
  if (!blob) return null;

  const isImage =
    blob.type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(blob.name || "");
  if (!isImage) {
    return null;
  }

  const safeName = sanitizeImageFileName(blob);
  const stampedName = `${Date.now()}-${safeName}`;

  if (isTauri && tauriRootFolder.trim()) {
    try {
      const { mkdir, writeFile } = await import("@tauri-apps/plugin-fs");
      const cleanRoot = tauriRootFolder.trim().replace(/[\\/]+$/, "");
      const assetsDir = `${cleanRoot}/assets`;
      await mkdir(assetsDir, { recursive: true });

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const fullPath = `${assetsDir}/${stampedName}`;
      await writeFile(fullPath, bytes);

      return {
        markdown: `![screenshot](assets/${stampedName})`,
      };
    } catch (err) {
      console.warn(
        "Tauri asset write failed, falling back to compressed Data-URL:",
        err
      );
    }
  }

  try {
    const dataUrl = await compressImageToDataUrl(blob);
    if (!dataUrl) return null;
    return {
      markdown: `![screenshot](${dataUrl})`,
    };
  } catch (err) {
    console.error("Failed to process pasted/dropped image:", err);
    return null;
  }
}
