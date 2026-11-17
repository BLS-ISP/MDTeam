"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search,
  Plus,
  GitBranch,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Bell,
  User,
  X,
  ArrowRight,
  Sparkles,
  Download,
  Code,
  Eye,
  Check,
  BookOpen,
  AtSign,
  Clock,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Layers,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import {
  WorkspaceFile,
  importJiraCsv,
  importJiraJson,
  importConfluencePages,
  extractImportedFilePreview,
  ImportedFilePreview,
  SAMPLE_JIRA_CSV,
  SAMPLE_JIRA_JSON,
  SAMPLE_CONFLUENCE_HTML,
} from "../utils/atlassianImporter";

export type { WorkspaceFile };

export type WorkspaceRoleMode = "developer" | "scrum" | "stakeholder";

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

// ============================================================================
// Frontmatter & Notification Scanning Helpers
// ============================================================================

interface ParsedDocSummary {
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

function parseMarkdownSummary(file: WorkspaceFile): ParsedDocSummary {
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

function normalizeHandleForMatch(handle: string): string {
  const clean = (handle || "").trim().toLowerCase();
  if (!clean) return "";
  return clean.startsWith("@") ? clean : `@${clean.replace(/\s+/g, "-")}`;
}

export function scanWorkspaceNotifications(
  files: WorkspaceFile[],
  currentUser: string,
  language: "de" | "en" = "de"
): WorkspaceNotificationItem[] {
  const isEn = language === "en";
  const normalizedUser = normalizeHandleForMatch(currentUser || "@developer-a");
  const bareUser = normalizedUser.slice(1);
  const notifications: WorkspaceNotificationItem[] = [];
  const seenIds = new Set<string>();

  const pushNotif = (item: WorkspaceNotificationItem) => {
    if (seenIds.has(item.id)) return;
    seenIds.add(item.id);
    notifications.push(item);
  };

  const mentionRegex = bareUser
    ? new RegExp(`@${bareUser.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9_-])`, "i")
    : null;

  for (const file of files) {
    const lowerPath = file.path.toLowerCase();

    // 1. Inline review threads in `.mdteam/inline-comments.json`
    if (lowerPath.endsWith("inline-comments.json")) {
      try {
        const rawJson = JSON.parse(file.content);
        const threads: Record<string, unknown>[] = [];

        if (Array.isArray(rawJson)) {
          rawJson.forEach((t) => {
            if (t && typeof t === "object") threads.push(t as Record<string, unknown>);
          });
        } else if (rawJson && typeof rawJson === "object") {
          const obj = rawJson as Record<string, unknown>;
          if (Array.isArray(obj.threads)) {
            obj.threads.forEach((t) => {
              if (t && typeof t === "object") threads.push(t as Record<string, unknown>);
            });
          } else {
            for (const [docKey, val] of Object.entries(obj)) {
              if (Array.isArray(val)) {
                val.forEach((t) => {
                  if (t && typeof t === "object") {
                    threads.push({ filePath: docKey, ...(t as Record<string, unknown>) });
                  }
                });
              }
            }
          }
        }

        threads.forEach((thread, idx) => {
          const isResolved =
            thread.resolved === true ||
            String(thread.status || "").toLowerCase() === "resolved";
          if (isResolved) return;

          const targetPath = String(
            thread.filePath || thread.path || thread.docPath || file.path
          );
          const threadId = String(thread.id || `${targetPath}-${idx}`);

          const allMessages: string[] = [];
          if (typeof thread.text === "string") allMessages.push(thread.text);
          if (typeof thread.comment === "string") allMessages.push(thread.comment);
          if (typeof thread.body === "string") allMessages.push(thread.body);

          const nestedLists = [thread.comments, thread.replies, thread.messages];
          for (const list of nestedLists) {
            if (Array.isArray(list)) {
              for (const msg of list) {
                if (msg && typeof msg === "object") {
                  const mObj = msg as Record<string, unknown>;
                  const txt = String(mObj.text || mObj.body || mObj.content || "");
                  if (txt) allMessages.push(txt);
                }
              }
            }
          }

          const combinedText = allMessages.join(" ");
          if (mentionRegex && mentionRegex.test(combinedText)) {
            pushNotif({
              id: `inline-mention-${threadId}`,
              kind: "mention",
              title: isEn
                ? `Mentioned in review thread`
                : `Erwähnung in Review-Kommentar`,
              subtitle: `${targetPath} — "${combinedText.slice(0, 72)}${combinedText.length > 72 ? "…" : ""}"`,
              filePath: targetPath,
              severity: "warning",
            });
          } else if (combinedText.trim()) {
            pushNotif({
              id: `inline-open-${threadId}`,
              kind: "review",
              title: isEn ? `Open inline comment` : `Offener Inline-Kommentar`,
              subtitle: `${targetPath} — "${combinedText.slice(0, 68)}${combinedText.length > 68 ? "…" : ""}"`,
              filePath: targetPath,
              severity: "info",
            });
          }
        });
      } catch {
        // Ignore malformed inline-comments.json while user is editing
      }
      continue;
    }

    if (!lowerPath.endsWith(".md")) continue;
    const summary = parseMarkdownSummary(file);

    // 2. Agile Issues (`issues/*.md`)
    if (lowerPath.startsWith("issues/")) {
      const isDone = summary.status === "done" || summary.status === "completed";
      const normalizedAssignee = normalizeHandleForMatch(summary.assignee);

      // Blocked check
      const isBlocked =
        !isDone &&
        (summary.blockedBy.length > 0 ||
          summary.status === "blocked" ||
          summary.labels.some((l) => l.toLowerCase() === "blocked") ||
          /\bBLOCKED\b/.test(summary.body));

      if (isBlocked) {
        const blockerHint =
          summary.blockedBy.length > 0 ? ` (${summary.blockedBy.join(", ")})` : "";
        pushNotif({
          id: `blocked-${file.path}`,
          kind: "blocked",
          title: `BLOCKED: ${summary.id} — ${summary.title}`,
          subtitle: isEn
            ? `Blocked issue requires attention${blockerHint}`
            : `Blockiertes Ticket erfordert Klärung${blockerHint}`,
          filePath: file.path,
          severity: "critical",
        });
      }

      // Assigned to currentUser
      if (!isDone && normalizedAssignee && normalizedAssignee === normalizedUser) {
        pushNotif({
          id: `assigned-${file.path}-${summary.status}`,
          kind: "assigned",
          title: `${summary.id}: ${summary.title}`,
          subtitle: isEn
            ? `Assigned to ${normalizedUser} • Status: ${summary.status || "backlog"}`
            : `Zugewiesen an ${normalizedUser} • Status: ${summary.status || "backlog"}`,
          filePath: file.path,
          severity: summary.priority === "critical" ? "critical" : "info",
        });
      }

      // Issue In Review
      if (summary.status === "review" || summary.status === "in-review") {
        pushNotif({
          id: `issue-review-${file.path}`,
          kind: "review",
          title: isEn
            ? `In Review: ${summary.id} — ${summary.title}`
            : `In Prüfung: ${summary.id} — ${summary.title}`,
          subtitle: isEn
            ? `Ready for peer review / QA sign-off`
            : `Bereit für Code-Review / Abnahme`,
          filePath: file.path,
          severity: "warning",
        });
      }

      // @currentUser mention in description or comments
      if (mentionRegex && mentionRegex.test(summary.body)) {
        pushNotif({
          id: `issue-mention-${file.path}`,
          kind: "mention",
          title: isEn
            ? `${normalizedUser} mentioned in ${summary.id}`
            : `${normalizedUser} erwähnt in ${summary.id}`,
          subtitle: summary.title,
          filePath: file.path,
          severity: "warning",
        });
      }
      continue;
    }

    // 3. Meeting notes (`meetings/*.md`) + legacy sprint backlog mentions
    if (lowerPath.startsWith("meetings/") || lowerPath.startsWith("management/")) {
      if (mentionRegex && mentionRegex.test(file.content)) {
        const matchingLine =
          file.content
            .split(/\r?\n/)
            .find((line) => mentionRegex.test(line) && !/^\s*-\s*\[x\]/i.test(line)) || "";
        if (matchingLine) {
          pushNotif({
            id: `doc-mention-${file.path}-${matchingLine.slice(0, 24)}`,
            kind: "mention",
            title: isEn
              ? `Action / Mention in ${summary.title}`
              : `Aufgabe / Erwähnung in ${summary.title}`,
            subtitle: matchingLine.replace(/^[-*\s[/\]]+/, "").trim().slice(0, 80),
            filePath: file.path,
            severity: "info",
          });
        }
      }
    }

    // 4. Documents in `In Review` lifecycle state (`review_status: in-review` / `review`)
    const isDocInReview =
      summary.reviewStatus === "in-review" ||
      summary.reviewStatus === "in_review" ||
      summary.reviewStatus === "review" ||
      summary.reviewStatus === "in review";

    if (isDocInReview) {
      pushNotif({
        id: `doc-review-${file.path}`,
        kind: "review",
        title: isEn ? `Doc In Review: ${summary.title}` : `Dokument in Prüfung: ${summary.title}`,
        subtitle: file.path,
        filePath: file.path,
        severity: "warning",
      });
    } else if (
      !lowerPath.startsWith("meetings/") &&
      !lowerPath.startsWith("management/") &&
      mentionRegex &&
      mentionRegex.test(summary.body)
    ) {
      pushNotif({
        id: `wiki-mention-${file.path}`,
        kind: "mention",
        title: isEn
          ? `${normalizedUser} mentioned in ${summary.title}`
          : `${normalizedUser} erwähnt in ${summary.title}`,
        subtitle: file.path,
        filePath: file.path,
        severity: "info",
      });
    }
  }

  // Sort critical -> warning -> info
  const weight: Record<WorkspaceNotificationItem["severity"], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  return notifications.sort((a, b) => weight[a.severity] - weight[b.severity]);
}

// ============================================================================
// Status & Badge Color Helpers
// ============================================================================

function getStatusBadgeColors(status: string): { bg: string; fg: string; label: string } {
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

function getCategoryBadgeLabel(file: WorkspaceFile): { label: string; color: string } {
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

// ============================================================================
// 1. <CommandPaletteModal /> (Ctrl+K / Cmd+K Omnibox)
// ============================================================================

export interface CommandPaletteModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onOpen?: () => void;
  files: WorkspaceFile[];
  onSelectFile: (filePath: string) => void;
  language?: "de" | "en";
  roleMode?: WorkspaceRoleMode;
  enableGlobalShortcut?: boolean;
  onCreateIssue?: () => void;
  onOpenScrumBoard?: () => void;
  onOpenImportModal?: () => void;
  onOpenGitBranchModal?: () => void;
  onOpenTemplateGallery?: () => void;
  onExportDocx?: () => void;
  onToggleStakeholderMode?: () => void;
}

interface PaletteEntry {
  id: string;
  group: "action" | "issue" | "doc";
  title: string;
  subtitle: string;
  badgeText?: string;
  badgeColors?: { bg: string; fg: string };
  secondaryBadge?: string;
  icon: React.ReactNode;
  keywords: string;
  onTrigger: () => void;
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  onOpen,
  files,
  onSelectFile,
  language = "de",
  roleMode = "developer",
  enableGlobalShortcut = true,
  onCreateIssue,
  onOpenScrumBoard,
  onOpenImportModal,
  onOpenGitBranchModal,
  onOpenTemplateGallery,
  onExportDocx,
  onToggleStakeholderMode,
}: CommandPaletteModalProps) {
  const isEn = language === "en";
  const isControlled = typeof isOpen === "boolean";
  const [internalOpen, setInternalOpen] = useState(false);
  const effectiveOpen = isControlled ? Boolean(isOpen) : internalOpen;

  const [query, setQuery] = useState("");
  const [filterScope, setFilterScope] = useState<"all" | "actions" | "issues" | "docs">("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const closePalette = useCallback(() => {
    if (!isControlled) setInternalOpen(false);
    onClose();
  }, [isControlled, onClose]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    if (!enableGlobalShortcut) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (effectiveOpen) {
          closePalette();
        } else if (isControlled) {
          onOpen?.();
        } else {
          setInternalOpen(true);
        }
      } else if (e.key === "Escape" && effectiveOpen) {
        e.preventDefault();
        closePalette();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableGlobalShortcut, effectiveOpen, isControlled, onOpen, closePalette]);

  // Reset & focus when opened
  useEffect(() => {
    if (effectiveOpen) {
      setQuery("");
      setFilterScope("all");
      setActiveIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(timer);
    }
  }, [effectiveOpen]);

  const allEntries = useMemo<PaletteEntry[]>(() => {
    const entries: PaletteEntry[] = [];

    // 7 Quick Actions
    const quickActions: {
      id: string;
      title: string;
      subtitle: string;
      badge: string;
      icon: React.ReactNode;
      keywords: string;
      cb?: () => void;
    }[] = [
      {
        id: "act-create-issue",
        title: isEn ? "Create Issue" : "Neues Issue erstellen",
        subtitle: isEn
          ? "Create a new Git-tracked Scrum story, bug, task, or epic"
          : "Neues Git-versioniertes Ticket (Story, Bug, Task, Epic) anlegen",
        badge: "SCRUM",
        icon: <Plus size={15} style={{ color: "var(--accent-indigo)" }} />,
        keywords: "create new issue ticket story bug task epic jira neu",
        cb: onCreateIssue,
      },
      {
        id: "act-open-scrum",
        title: isEn ? "Open Scrum Board" : "Scrum Board öffnen",
        subtitle: isEn
          ? "Switch to Kanban Sprint Board, Backlog, Roadmap & Burnup"
          : "Zu Sprint-Board, Product Backlog, Gantt-Roadmap & Metriken wechseln",
        badge: "BOARD",
        icon: <Layers size={15} style={{ color: "var(--accent-blue)" }} />,
        keywords: "open scrum board kanban sprint backlog agile",
        cb: onOpenScrumBoard,
      },
      {
        id: "act-import-atlassian",
        title: isEn ? "Import from Jira / Confluence" : "Aus Jira / Confluence importieren",
        subtitle: isEn
          ? "Migrate Jira CSV/JSON exports and Confluence HTML/MD pages"
          : "Jira CSV/JSON-Exporte und Confluence HTML/MD-Seiten migrieren",
        badge: "MIGRATE",
        icon: <Upload size={15} style={{ color: "var(--accent-green)" }} />,
        keywords: "import jira confluence csv json html migration atlassian",
        cb: onOpenImportModal,
      },
      {
        id: "act-git-branch",
        title: isEn ? "Switch / Create Git Branch" : "Git-Branch wechseln / erstellen",
        subtitle: isEn
          ? "Checkout existing branch or create feat/MDT-XXX branch"
          : "Aktiven Git-Branch wechseln oder neuen Feature-Branch anlegen",
        badge: "GITOPS",
        icon: <GitBranch size={15} style={{ color: "var(--accent-yellow)" }} />,
        keywords: "git branch switch checkout create feature gitops",
        cb: onOpenGitBranchModal,
      },
      {
        id: "act-template-gallery",
        title: isEn ? "New Page from Template" : "Neue Seite aus Vorlage",
        subtitle: isEn
          ? "Create PRD, RFC, Post-Mortem, Release Notes, or Story Map"
          : "PRD, RFC, Incident Post-Mortem, Release Notes oder Story Map anlegen",
        badge: "WIKI",
        icon: <BookOpen size={15} style={{ color: "var(--accent-indigo)" }} />,
        keywords: "new page template wiki confluence prd rfc release notes vorlage",
        cb: onOpenTemplateGallery,
      },
      {
        id: "act-export-docx",
        title: isEn ? "Export DOCX" : "Als Word (DOCX) exportieren",
        subtitle: isEn
          ? "Download active Markdown document as formatted Microsoft Word .docx"
          : "Aktuelles Dokument als formatierte Microsoft Word (.docx) Datei speichern",
        badge: "DOCX",
        icon: <Download size={15} style={{ color: "var(--accent-blue)" }} />,
        keywords: "export word docx download document bericht",
        cb: onExportDocx,
      },
      {
        id: "act-toggle-stakeholder",
        title: isEn ? "Toggle Stakeholder Clean Mode" : "Stakeholder Clean Mode umschalten",
        subtitle:
          roleMode === "stakeholder"
            ? isEn
              ? "Currently in Stakeholder Mode — switch back to Developer Mode"
              : "Aktuell im Stakeholder-Modus — zurück zum Entwickler-Modus wechseln"
            : isEn
              ? "Hide raw Markdown/linter chrome for clean Confluence/PM presentation"
              : "Code-Editor & Linter ausblenden für aufgeräumte PM-/Kunden-Ansicht",
        badge: roleMode === "stakeholder" ? "ON" : "CLEAN",
        icon: <Eye size={15} style={{ color: "var(--accent-green)" }} />,
        keywords: "toggle stakeholder clean mode pm view confluence presentation modus",
        cb: onToggleStakeholderMode,
      },
    ];

    for (const act of quickActions) {
      entries.push({
        id: act.id,
        group: "action",
        title: act.title,
        subtitle: act.subtitle,
        badgeText: act.badge,
        badgeColors: { bg: "rgba(99, 102, 241, 0.14)", fg: "var(--accent-indigo)" },
        icon: act.icon,
        keywords: act.keywords,
        onTrigger: () => {
          closePalette();
          act.cb?.();
        },
      });
    }

    // Workspace Files (Issues + Wiki/arc42/ADRs/Docs)
    for (const file of files) {
      if (file.path.startsWith(".mdteam/")) continue;
      const isIssue = file.path.toLowerCase().startsWith("issues/");
      const summary = parseMarkdownSummary(file);

      if (isIssue) {
        const statusBadge = getStatusBadgeColors(summary.status || "backlog");
        entries.push({
          id: `file-${file.path}`,
          group: "issue",
          title: `${summary.id}: ${summary.title}`,
          subtitle: `${file.path}${summary.assignee ? ` • ${summary.assignee}` : ""}${
            summary.storyPoints ? ` • ${summary.storyPoints} SP` : ""
          }`,
          badgeText: statusBadge.label.toUpperCase(),
          badgeColors: { bg: statusBadge.bg, fg: statusBadge.fg },
          secondaryBadge: summary.id,
          icon: <CheckCircle size={15} style={{ color: statusBadge.fg }} />,
          keywords: `${summary.id} ${summary.title} ${summary.status} ${summary.priority} ${summary.assignee} ${summary.labels.join(" ")} ${summary.body.slice(0, 600)}`,
          onTrigger: () => {
            closePalette();
            onSelectFile(file.path);
          },
        });
      } else {
        const cat = getCategoryBadgeLabel(file);
        const revColors = summary.reviewStatus
          ? getStatusBadgeColors(summary.reviewStatus)
          : undefined;
        entries.push({
          id: `file-${file.path}`,
          group: "doc",
          title: summary.title || file.name,
          subtitle: file.path,
          badgeText: revColors ? summary.reviewStatus.toUpperCase() : cat.label,
          badgeColors: revColors
            ? { bg: revColors.bg, fg: revColors.fg }
            : { bg: "rgba(255, 255, 255, 0.06)", fg: cat.color },
          secondaryBadge: revColors ? cat.label : undefined,
          icon: <FileText size={15} style={{ color: cat.color }} />,
          keywords: `${file.path} ${file.name} ${summary.title} ${cat.label} ${summary.body.slice(0, 800)}`,
          onTrigger: () => {
            closePalette();
            onSelectFile(file.path);
          },
        });
      }
    }

    return entries;
  }, [
    files,
    isEn,
    roleMode,
    closePalette,
    onSelectFile,
    onCreateIssue,
    onOpenScrumBoard,
    onOpenImportModal,
    onOpenGitBranchModal,
    onOpenTemplateGallery,
    onExportDocx,
    onToggleStakeholderMode,
  ]);

  const filteredEntries = useMemo(() => {
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return allEntries.filter((entry) => {
      if (filterScope === "actions" && entry.group !== "action") return false;
      if (filterScope === "issues" && entry.group !== "issue") return false;
      if (filterScope === "docs" && entry.group !== "doc") return false;
      if (terms.length === 0) return true;

      const haystack = `${entry.title} ${entry.subtitle} ${entry.keywords}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [allEntries, query, filterScope]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filterScope]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filteredEntries.length === 0 ? 0 : (prev + 1) % filteredEntries.length
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filteredEntries.length === 0
          ? 0
          : (prev - 1 + filteredEntries.length) % filteredEntries.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = filteredEntries[activeIndex];
      if (chosen) {
        chosen.onTrigger();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
    }
  };

  if (!effectiveOpen) return null;

  const renderGroupHeader = (label: string) => (
    <div
      style={{
        padding: "8px 14px 4px",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.7px",
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}
    >
      {label}
    </div>
  );

  let lastGroup: string | null = null;

  return (
    <div
      onClick={closePalette}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
        zIndex: 1000,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(660px, 92vw)",
          maxHeight: "76vh",
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Omnibox Search Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <Search size={17} style={{ color: "var(--accent-indigo)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={
              isEn
                ? "Search issues (MDT-...), Wiki/arc42/ADR docs, or run a command..."
                : "Issues (MDT-...), Wiki/arc42/ADR-Dokumente suchen oder Befehl ausführen..."
            }
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "14px",
              fontFamily: "var(--font-sans)",
            }}
          />
          <kbd
            style={{
              fontSize: "10px",
              fontFamily: "var(--font-mono)",
              padding: "2px 6px",
              borderRadius: "4px",
              backgroundColor: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Scope Filter Pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-sidebar)",
            fontSize: "11px",
          }}
        >
          {(
            [
              { id: "all", label: isEn ? "All" : "Alle" },
              { id: "actions", label: isEn ? "Quick Actions" : "Schnellaktionen" },
              { id: "issues", label: isEn ? "Issues (MDT-*)" : "Issues (MDT-*)" },
              { id: "docs", label: isEn ? "Wiki / arc42 / ADR" : "Wiki / arc42 / ADR" },
            ] as const
          ).map((tab) => {
            const active = filterScope === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterScope(tab.id)}
                style={{
                  border: `1px solid ${active ? "var(--accent-indigo)" : "var(--border-color)"}`,
                  backgroundColor: active ? "rgba(99, 102, 241, 0.16)" : "var(--bg-panel)",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  borderRadius: "6px",
                  padding: "3px 9px",
                  fontSize: "11px",
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            );
          })}
          <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "11px" }}>
            {filteredEntries.length} {isEn ? "items" : "Einträge"}
          </span>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "6px 0 10px",
          }}
        >
          {filteredEntries.length === 0 ? (
            <div
              style={{
                padding: "32px 20px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              {isEn
                ? "No matching commands, issues, or documents found."
                : "Keine passenden Befehle, Issues oder Dokumente gefunden."}
            </div>
          ) : (
            filteredEntries.map((entry, idx) => {
              const showHeader = entry.group !== lastGroup;
              lastGroup = entry.group;
              const isSelected = idx === activeIndex;

              const groupTitle =
                entry.group === "action"
                  ? isEn
                    ? "Quick Actions"
                    : "Schnellaktionen"
                  : entry.group === "issue"
                    ? isEn
                      ? "Agile Issues"
                      : "Agile Issues & Tickets"
                    : isEn
                      ? "Knowledge Base (Wiki, arc42, ADRs)"
                      : "Wissensdatenbank (Wiki, arc42, ADRs)";

              return (
                <React.Fragment key={entry.id}>
                  {showHeader && renderGroupHeader(groupTitle)}
                  <div
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => entry.onTrigger()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      margin: "2px 8px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor: isSelected ? "var(--bg-active)" : "transparent",
                      borderLeft: isSelected
                        ? "2px solid var(--accent-indigo)"
                        : "2px solid transparent",
                      transition: "background-color 0.1s",
                    }}
                  >
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        backgroundColor: "var(--bg-panel)",
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {entry.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "var(--text-primary)",
                        }}
                      >
                        {entry.secondaryBadge && (
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "10px",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              backgroundColor: "rgba(99, 102, 241, 0.14)",
                              color: "var(--accent-indigo)",
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {entry.secondaryBadge}
                          </span>
                        )}
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {entry.title}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.subtitle}
                      </div>
                    </div>

                    {entry.badgeText && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: "999px",
                          backgroundColor:
                            entry.badgeColors?.bg || "rgba(255, 255, 255, 0.06)",
                          color: entry.badgeColors?.fg || "var(--text-secondary)",
                          flexShrink: 0,
                        }}
                      >
                        {entry.badgeText}
                      </span>
                    )}

                    <ArrowRight
                      size={13}
                      style={{
                        color: isSelected ? "var(--accent-indigo)" : "transparent",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            borderTop: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          <span>
            <strong style={{ color: "var(--text-secondary)" }}>↑↓</strong>{" "}
            {isEn ? "Navigate" : "Navigieren"} &nbsp;•&nbsp;{" "}
            <strong style={{ color: "var(--text-secondary)" }}>↵</strong>{" "}
            {isEn ? "Open / Run" : "Öffnen / Ausführen"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}>Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. <AtlassianImportModal /> (Jira CSV / Jira JSON / Confluence Wizard)
// ============================================================================

export type AtlassianSourceType = "jira-csv" | "jira-json" | "confluence";

export interface AtlassianImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportFiles: (newFiles: WorkspaceFile[]) => void;
  existingFiles?: WorkspaceFile[];
  language?: "de" | "en";
}

export function AtlassianImportModal({
  isOpen,
  onClose,
  onImportFiles,
  existingFiles = [],
  language = "de",
}: AtlassianImportModalProps) {
  const isEn = language === "en";
  const [sourceType, setSourceType] = useState<AtlassianSourceType>("jira-csv");
  const [projectPrefix, setProjectPrefix] = useState("");
  const [loadedPayloads, setLoadedPayloads] = useState<{ name: string; content: string }[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Record<string, boolean>>({});
  const [inspectedPath, setInspectedPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInspectedPath(null);
    }
  }, [isOpen]);

  const { parsedPreviews, parseError } = useMemo<{
    parsedPreviews: ImportedFilePreview[];
    parseError: string;
  }>(() => {
    if (loadedPayloads.length === 0) {
      return { parsedPreviews: [], parseError: "" };
    }
    try {
      let generated: WorkspaceFile[] = [];
      if (sourceType === "jira-csv") {
        generated = loadedPayloads.flatMap((p) =>
          importJiraCsv(p.content, projectPrefix || undefined)
        );
      } else if (sourceType === "jira-json") {
        generated = loadedPayloads.flatMap((p) =>
          importJiraJson(p.content, projectPrefix || undefined)
        );
      } else {
        generated = importConfluencePages(loadedPayloads);
      }
      return {
        parsedPreviews: generated.map(extractImportedFilePreview),
        parseError: "",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { parsedPreviews: [], parseError: msg };
    }
  }, [loadedPayloads, sourceType, projectPrefix]);

  // Select all newly parsed rows by default
  useEffect(() => {
    const nextSel: Record<string, boolean> = {};
    for (const p of parsedPreviews) {
      nextSel[p.file.path] = true;
    }
    setSelectedPaths(nextSel);
  }, [parsedPreviews]);

  if (!isOpen) return null;

  const existingPathSet = new Set(existingFiles.map((f) => f.path));

  const handleSwitchSource = (nextSource: AtlassianSourceType) => {
    setSourceType(nextSource);
    setLoadedPayloads([]);
    setInspectedPath(null);
  };

  const handleLoadSampleJira = () => {
    if (sourceType === "confluence") {
      setSourceType("jira-csv");
      setLoadedPayloads([{ name: "sample-jira-export.csv", content: SAMPLE_JIRA_CSV }]);
    } else if (sourceType === "jira-json") {
      setLoadedPayloads([{ name: "sample-jira-rest.json", content: SAMPLE_JIRA_JSON }]);
    } else {
      setLoadedPayloads([{ name: "sample-jira-export.csv", content: SAMPLE_JIRA_CSV }]);
    }
    setInspectedPath(null);
  };

  const handleLoadSampleConfluence = () => {
    setSourceType("confluence");
    setLoadedPayloads([
      {
        name: "system-architecture-runbook.html",
        content: SAMPLE_CONFLUENCE_HTML,
      },
    ]);
    setInspectedPath(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const uploaded: { name: string; content: string }[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const content = await f.text();
      uploaded.push({ name: f.name, content });
    }
    setLoadedPayloads(uploaded);
    setInspectedPath(null);
    e.target.value = "";
  };

  const selectedFilesToImport = parsedPreviews
    .filter((p) => selectedPaths[p.file.path])
    .map((p) => p.file);

  const handleConfirmImport = () => {
    if (selectedFilesToImport.length === 0) return;
    onImportFiles(selectedFilesToImport);
    setLoadedPayloads([]);
    onClose();
  };

  const inspectedFile = parsedPreviews.find((p) => p.file.path === inspectedPath)?.file;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(860px, 94vw)",
          maxHeight: "88vh",
          backgroundColor: "var(--bg-sidebar)",
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Upload size={18} style={{ color: "var(--accent-indigo)" }} />
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                {isEn
                  ? "Atlassian (Jira & Confluence) Migration Wizard"
                  : "Atlassian (Jira & Confluence) Migrations-Assistent"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {isEn
                  ? "Convert Jira CSV/JSON tickets into issues/*.md and Confluence exports into wiki/*.md"
                  : "Jira CSV/JSON-Tickets nach issues/*.md und Confluence-Seiten nach wiki/*.md migrieren"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Step 1: Choose Source */}
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.6px",
                color: "var(--text-muted)",
                marginBottom: "8px",
              }}
            >
              {isEn ? "Step 1 — Select Export Format" : "Schritt 1 — Export-Format wählen"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {(
                [
                  {
                    id: "jira-csv",
                    title: "Jira CSV (.csv)",
                    desc: isEn
                      ? "RFC-4180 CSV export with Epics, Story Points & Comments"
                      : "RFC-4180 CSV-Export inkl. Epics, Story Points & Kommentaren",
                    icon: <FileSpreadsheet size={18} style={{ color: "var(--accent-blue)" }} />,
                  },
                  {
                    id: "jira-json",
                    title: "Jira REST JSON (.json)",
                    desc: isEn
                      ? "REST search export including Atlassian Document Format (ADF)"
                      : "Jira REST-Export inkl. Atlassian Document Format (ADF)",
                    icon: <Code size={18} style={{ color: "var(--accent-indigo)" }} />,
                  },
                  {
                    id: "confluence",
                    title: "Confluence (.html / .md)",
                    desc: isEn
                      ? "HTML or Markdown pages with macros, tables & code blocks"
                      : "HTML- oder Markdown-Seiten inkl. Makros, Tabellen & Code",
                    icon: <BookOpen size={18} style={{ color: "var(--accent-green)" }} />,
                  },
                ] as const
              ).map((opt) => {
                const active = sourceType === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => handleSwitchSource(opt.id)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: `1px solid ${active ? "var(--accent-indigo)" : "var(--border-color)"}`,
                      backgroundColor: active ? "rgba(99, 102, 241, 0.1)" : "var(--bg-panel)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
                      {opt.icon}
                      <span>{opt.title}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.35 }}>
                      {opt.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Upload or 1-Click Sample */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "14px 16px",
              borderRadius: "8px",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple={sourceType === "confluence"}
                accept={
                  sourceType === "jira-csv"
                    ? ".csv,text/csv"
                    : sourceType === "jira-json"
                      ? ".json,application/json"
                      : ".html,.htm,.xhtml,.md,.markdown"
                }
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "7px 13px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-sidebar)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Upload size={14} style={{ color: "var(--accent-indigo)" }} />
                {isEn ? "Choose File(s) from Disk" : "Datei(en) von Festplatte wählen"}
              </button>

              <button
                type="button"
                onClick={handleLoadSampleJira}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  borderRadius: "6px",
                  border: "1px solid rgba(59, 130, 246, 0.35)",
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  color: "var(--accent-blue)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Sparkles size={13} />
                {isEn ? "Load Sample Jira Export" : "Beispiel-Jira-Export laden"}
              </button>

              <button
                type="button"
                onClick={handleLoadSampleConfluence}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  borderRadius: "6px",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  color: "var(--accent-green)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <BookOpen size={13} />
                {isEn ? "Load Sample Confluence Page" : "Beispiel-Confluence-Seite laden"}
              </button>
            </div>

            {sourceType !== "confluence" && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
                  {isEn ? "Key Prefix:" : "Key-Präfix:"}
                </label>
                <input
                  type="text"
                  value={projectPrefix}
                  onChange={(e) => setProjectPrefix(e.target.value)}
                  placeholder={isEn ? "Keep original (or e.g. MDT)" : "Original (oder z.B. MDT)"}
                  style={{
                    width: "165px",
                    padding: "5px 8px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-sidebar)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              </div>
            )}
          </div>

          {parseError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid var(--accent-red)",
                backgroundColor: "rgba(239, 68, 68, 0.08)",
                color: "var(--accent-red)",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={15} />
              <span>{parseError}</span>
            </div>
          )}

          {/* Step 3: Preview Table */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  color: "var(--text-muted)",
                }}
              >
                {isEn
                  ? `Step 2 — Preview Parsed Workspace Files (${parsedPreviews.length})`
                  : `Schritt 2 — Vorschau konvertierter Dateien (${parsedPreviews.length})`}
              </span>
              {parsedPreviews.length > 0 && (
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  {isEn ? "Click any row to inspect generated Markdown" : "Zeile anklicken für Markdown-Vorschau"}
                </span>
              )}
            </div>

            {parsedPreviews.length === 0 ? (
              <div
                style={{
                  padding: "34px 20px",
                  borderRadius: "8px",
                  border: "1px dashed var(--border-color)",
                  backgroundColor: "var(--bg-panel)",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                {isEn
                  ? "Upload a Jira CSV/JSON or Confluence HTML/MD export above, or click a Sample button for an instant demo."
                  : "Laden Sie oben eine Jira- oder Confluence-Datei hoch oder klicken Sie auf einen der Sample-Buttons."}
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor: "var(--bg-panel)",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "var(--bg-sidebar)",
                        borderBottom: "1px solid var(--border-color)",
                        color: "var(--text-muted)",
                        fontSize: "11px",
                        textAlign: "left",
                      }}
                    >
                      <th style={{ padding: "8px 10px", width: "32px" }}>
                        <input
                          type="checkbox"
                          checked={
                            parsedPreviews.length > 0 &&
                            parsedPreviews.every((p) => selectedPaths[p.file.path])
                          }
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const next: Record<string, boolean> = {};
                            parsedPreviews.forEach((p) => {
                              next[p.file.path] = checked;
                            });
                            setSelectedPaths(next);
                          }}
                        />
                      </th>
                      <th style={{ padding: "8px 10px" }}>{isEn ? "ID / Type" : "ID / Typ"}</th>
                      <th style={{ padding: "8px 10px" }}>{isEn ? "Title" : "Titel"}</th>
                      <th style={{ padding: "8px 10px" }}>Status</th>
                      {sourceType !== "confluence" && (
                        <>
                          <th style={{ padding: "8px 10px" }}>SP</th>
                          <th style={{ padding: "8px 10px" }}>{isEn ? "Assignee" : "Bearbeiter"}</th>
                        </>
                      )}
                      <th style={{ padding: "8px 10px" }}>{isEn ? "Target Path" : "Zielpfad"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedPreviews.map((item) => {
                      const statusColors = getStatusBadgeColors(item.status);
                      const willOverwrite = existingPathSet.has(item.file.path);
                      const isInspected = inspectedPath === item.file.path;

                      return (
                        <tr
                          key={item.file.path}
                          onClick={() =>
                            setInspectedPath(isInspected ? null : item.file.path)
                          }
                          style={{
                            borderBottom: "1px solid var(--border-color)",
                            backgroundColor: isInspected
                              ? "rgba(99, 102, 241, 0.08)"
                              : "transparent",
                            cursor: "pointer",
                          }}
                        >
                          <td
                            style={{ padding: "8px 10px" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(selectedPaths[item.file.path])}
                              onChange={(e) =>
                                setSelectedPaths((prev) => ({
                                  ...prev,
                                  [item.file.path]: e.target.checked,
                                }))
                              }
                            />
                          </td>
                          <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "11px",
                                color: "var(--accent-indigo)",
                                fontWeight: 600,
                              }}
                            >
                              {item.id}
                            </span>
                            <span
                              style={{
                                marginLeft: "6px",
                                fontSize: "10px",
                                textTransform: "uppercase",
                                color: "var(--text-muted)",
                              }}
                            >
                              {item.type}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              color: "var(--text-primary)",
                              fontWeight: 500,
                              maxWidth: "260px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.title}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: "999px",
                                fontSize: "10px",
                                fontWeight: 600,
                                backgroundColor: statusColors.bg,
                                color: statusColors.fg,
                              }}
                            >
                              {item.status}
                            </span>
                          </td>
                          {sourceType !== "confluence" && (
                            <>
                              <td
                                style={{
                                  padding: "8px 10px",
                                  fontFamily: "var(--font-mono)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {item.storyPoints || "-"}
                              </td>
                              <td
                                style={{
                                  padding: "8px 10px",
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "11px",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {item.assignee}
                              </td>
                            </>
                          )}
                          <td
                            style={{
                              padding: "8px 10px",
                              fontFamily: "var(--font-mono)",
                              fontSize: "11px",
                              color: "var(--text-muted)",
                            }}
                          >
                            {item.file.path}
                            {willOverwrite && (
                              <span
                                style={{
                                  marginLeft: "6px",
                                  color: "var(--accent-yellow)",
                                  fontSize: "10px",
                                }}
                              >
                                ({isEn ? "update" : "Update"})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {inspectedFile && (
                  <div
                    style={{
                      borderTop: "1px solid var(--border-color)",
                      padding: "12px 14px",
                      backgroundColor: "var(--bg-editor)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--accent-indigo)",
                        marginBottom: "6px",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {inspectedFile.path}
                    </div>
                    <pre
                      style={{
                        maxHeight: "170px",
                        overflowY: "auto",
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-secondary)",
                        whiteSpace: "pre-wrap",
                        margin: 0,
                      }}
                    >
                      {inspectedFile.content}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderTop: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {selectedFilesToImport.length}{" "}
            {isEn ? "file(s) selected for Git workspace import" : "Datei(en) für den Import ausgewählt"}
          </span>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isEn ? "Cancel" : "Abbrechen"}
            </button>
            <button
              type="button"
              disabled={selectedFilesToImport.length === 0}
              onClick={handleConfirmImport}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor:
                  selectedFilesToImport.length > 0
                    ? "var(--accent-indigo)"
                    : "var(--bg-active)",
                color:
                  selectedFilesToImport.length > 0 ? "#ffffff" : "var(--text-muted)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: selectedFilesToImport.length > 0 ? "pointer" : "not-allowed",
              }}
            >
              <Check size={14} />
              {isEn
                ? `Import into Workspace (${selectedFilesToImport.length})`
                : `In Workspace importieren (${selectedFilesToImport.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. <GitBranchModal /> (Native Tauri Git Bridge + Browser Sandbox Fallback)
// ============================================================================

const SANDBOX_BRANCHES_STORAGE_KEY = "mdteam_sandbox_branches";
const SANDBOX_CURRENT_BRANCH_KEY = "mdteam_sandbox_current_branch";

function sanitizeClientBranchName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._/-]+/g, "-")
    .replace(/\.{2,}/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^[-./]+|[-./]+$/g, "");
}

export interface GitBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTauri?: boolean;
  tauriRootFolder?: string | null;
  initialNewBranchName?: string;
  currentBranch?: string;
  activeBranch?: string;
  onBranchChange?: (branchName: string) => void;
  onBranchChanged?: (branchName: string) => void;
  language?: "de" | "en";
}

export function GitBranchModal({
  isOpen,
  onClose,
  isTauri = false,
  tauriRootFolder = null,
  initialNewBranchName = "",
  currentBranch: externalBranch,
  activeBranch: externalActiveBranch,
  onBranchChange,
  onBranchChanged,
  language = "de",
}: GitBranchModalProps) {
  const isEn = language === "en";
  const useNativeGit = Boolean(isTauri && tauriRootFolder);
  const resolvedExternalBranch = externalBranch || externalActiveBranch;

  const notifyBranchChange = useCallback(
    (name: string) => {
      onBranchChange?.(name);
      onBranchChanged?.(name);
    },
    [onBranchChange, onBranchChanged]
  );

  const [branches, setBranches] = useState<GitBranchEntry[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>(resolvedExternalBranch || "main");
  const [newBranchName, setNewBranchName] = useState<string>(initialNewBranchName || "");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const loadBranches = useCallback(async () => {
    setErrorMsg("");
    if (useNativeGit && tauriRootFolder) {
      setIsLoading(true);
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const [currRaw, listRaw] = await Promise.all([
          invoke<string>("git_current_branch", { repoPath: tauriRootFolder }).catch(() => "HEAD"),
          invoke<string>("git_list_branches", { repoPath: tauriRootFolder }).catch(() => ""),
        ]);

        const curr = (currRaw || "").trim() || "main";
        const parsed: GitBranchEntry[] = listRaw
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .map((line) => {
            const [namePart, headFlag] = line.split("|");
            const cleanName = (namePart || "").trim();
            return {
              name: cleanName,
              isCurrent: (headFlag || "").trim() === "*" || cleanName === curr,
            };
          })
          .filter((b) => Boolean(b.name));

        if (parsed.length === 0 && curr) {
          parsed.push({ name: curr, isCurrent: true });
        }

        setActiveBranch(curr);
        setBranches(parsed);
        notifyBranchChange(curr);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    } else {
      // Browser Sandbox Mode persisted in localStorage
      let savedList = ["main", "develop", "feat/MDT-101-platform-architecture"];
      let savedCurrent = resolvedExternalBranch || "main";
      if (typeof window !== "undefined") {
        try {
          const rawList = localStorage.getItem(SANDBOX_BRANCHES_STORAGE_KEY);
          if (rawList) {
            const arr = JSON.parse(rawList);
            if (Array.isArray(arr) && arr.length > 0) {
              savedList = arr.map(String);
            }
          }
          const rawCurr = localStorage.getItem(SANDBOX_CURRENT_BRANCH_KEY);
          if (rawCurr) savedCurrent = rawCurr;
        } catch {
          // ignore storage errors
        }
      }
      if (!savedList.includes(savedCurrent)) {
        savedList = [savedCurrent, ...savedList];
      }
      setActiveBranch(savedCurrent);
      setBranches(
        savedList.map((name) => ({
          name,
          isCurrent: name === savedCurrent,
        }))
      );
    }
  }, [useNativeGit, tauriRootFolder, resolvedExternalBranch, notifyBranchChange]);

  useEffect(() => {
    if (isOpen) {
      setStatusMsg("");
      setErrorMsg("");
      setNewBranchName(initialNewBranchName || "");
      loadBranches();
    }
  }, [isOpen, initialNewBranchName, loadBranches]);

  if (!isOpen) return null;

  const persistSandboxState = (list: string[], current: string) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(SANDBOX_BRANCHES_STORAGE_KEY, JSON.stringify(list));
        localStorage.setItem(SANDBOX_CURRENT_BRANCH_KEY, current);
      } catch {
        // ignore
      }
    }
  };

  const handleCheckout = async (targetBranch: string, createNew: boolean) => {
    setErrorMsg("");
    setStatusMsg("");
    const safeName = sanitizeClientBranchName(targetBranch);

    if (!safeName || safeName.startsWith("-")) {
      setErrorMsg(
        isEn
          ? "Please enter a valid Git branch name (cannot start with '-')."
          : "Bitte einen gültigen Git-Branch-Namen eingeben (darf nicht mit '-' beginnen)."
      );
      return;
    }

    if (useNativeGit && tauriRootFolder) {
      setIsLoading(true);
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke<string>("git_checkout_branch", {
          repoPath: tauriRootFolder,
          branchName: safeName,
          create: createNew,
        });
        setNewBranchName("");
        setStatusMsg(
          isEn
            ? `Switched to branch '${safeName}'`
            : `Auf Branch '${safeName}' gewechselt`
        );
        await loadBranches();
        notifyBranchChange(safeName);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    } else {
      // Browser Sandbox Mode
      const names = branches.map((b) => b.name);
      if (createNew && names.includes(safeName)) {
        setErrorMsg(
          isEn
            ? `Branch '${safeName}' already exists.`
            : `Branch '${safeName}' existiert bereits.`
        );
        return;
      }
      const updatedNames = names.includes(safeName) ? names : [safeName, ...names];
      persistSandboxState(updatedNames, safeName);
      setActiveBranch(safeName);
      setBranches(
        updatedNames.map((n) => ({
          name: n,
          isCurrent: n === safeName,
        }))
      );
      setNewBranchName("");
      setStatusMsg(
        isEn
          ? `Checked out '${safeName}' (Browser Sandbox)`
          : `Branch '${safeName}' aktiviert (Browser-Sandbox)`
      );
      notifyBranchChange(safeName);
    }
  };

  const applyBranchPrefix = (prefix: string) => {
    const stripped = newBranchName.replace(/^(feat|fix|docs|chore|spike)\//, "");
    setNewBranchName(`${prefix}${stripped}`);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(540px, 92vw)",
          maxHeight: "82vh",
          backgroundColor: "var(--bg-sidebar)",
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "15px 18px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <GitBranch size={18} style={{ color: "var(--accent-indigo)" }} />
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                {isEn ? "GitOps Branch Manager" : "GitOps Branch-Verwaltung"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {useNativeGit
                  ? isEn
                    ? "Connected to local Git repository via Tauri"
                    : "Verbunden mit lokalem Git-Repository (Tauri)"
                  : isEn
                    ? "Browser Sandbox Mode (open folder in Tauri for native Git CLI)"
                    : "Browser-Sandbox-Modus (in Tauri Ordner öffnen für natives Git)"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {useNativeGit && (
              <button
                type="button"
                onClick={loadBranches}
                title={isEn ? "Refresh branches" : "Branches aktualisieren"}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <RefreshCw size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Create Branch Box */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "8px",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                }}
              >
                {initialNewBranchName
                  ? isEn
                    ? "Create Branch from Issue"
                    : "Branch aus Issue erstellen"
                  : isEn
                    ? "Create & Checkout New Branch"
                    : "Neuen Branch erstellen & auschecken"}
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                {["feat/", "fix/", "docs/", "chore/"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyBranchPrefix(p)}
                    style={{
                      fontSize: "10px",
                      fontFamily: "var(--font-mono)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--bg-sidebar)",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newBranchName.trim()) {
                    handleCheckout(newBranchName, true);
                  }
                }}
                placeholder="feat/MDT-102-keycloak-sso"
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-sidebar)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
              />
              <button
                type="button"
                disabled={!newBranchName.trim() || isLoading}
                onClick={() => handleCheckout(newBranchName, true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: newBranchName.trim()
                    ? "var(--accent-indigo)"
                    : "var(--bg-active)",
                  color: newBranchName.trim() ? "#ffffff" : "var(--text-muted)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: newBranchName.trim() ? "pointer" : "not-allowed",
                  whiteSpace: "nowrap",
                }}
              >
                <Plus size={14} />
                {isEn ? "Create Branch" : "Branch anlegen"}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--accent-red)",
                backgroundColor: "rgba(239, 68, 68, 0.08)",
                color: "var(--accent-red)",
                fontSize: "12px",
              }}
            >
              {errorMsg}
            </div>
          )}

          {statusMsg && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--accent-green)",
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                color: "var(--accent-green)",
                fontSize: "12px",
              }}
            >
              {statusMsg}
            </div>
          )}

          {/* Existing Branches List */}
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: "8px",
              }}
            >
              {isEn
                ? `Local Branches (${branches.length}) — Active: ${activeBranch}`
                : `Lokale Branches (${branches.length}) — Aktiv: ${activeBranch}`}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                maxHeight: "260px",
                overflowY: "auto",
              }}
            >
              {branches.map((b) => (
                <div
                  key={b.name}
                  onClick={() => {
                    if (!b.isCurrent && !isLoading) {
                      handleCheckout(b.name, false);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${
                      b.isCurrent ? "var(--accent-indigo)" : "var(--border-color)"
                    }`,
                    backgroundColor: b.isCurrent
                      ? "rgba(99, 102, 241, 0.1)"
                      : "var(--bg-panel)",
                    cursor: b.isCurrent ? "default" : "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <GitBranch
                      size={14}
                      style={{
                        color: b.isCurrent ? "var(--accent-green)" : "var(--text-muted)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "12px",
                        fontWeight: b.isCurrent ? 600 : 400,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b.name}
                    </span>
                  </div>

                  {b.isCurrent ? (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "999px",
                        backgroundColor: "rgba(16, 185, 129, 0.16)",
                        color: "var(--accent-green)",
                      }}
                    >
                      {isEn ? "ACTIVE" : "AKTIV"}
                    </span>
                  ) : (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {isEn ? "Switch" : "Wechseln"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. <WorkspaceHeaderControls /> (Role Mode + @Handle Selector + Inbox Bell)
// ============================================================================

const USER_HANDLE_STORAGE_KEY = "mdteam_current_user";
const ROLE_MODE_STORAGE_KEY = "mdteam_role_mode";
const READ_NOTIFS_STORAGE_KEY = "mdteam_read_notifications";

export const PRESET_TEAM_HANDLES: { handle: string; labelDe: string; labelEn: string }[] = [
  { handle: "@developer-a", labelDe: "Developer A (Tech Lead)", labelEn: "Developer A (Tech Lead)" },
  { handle: "@developer-b", labelDe: "Developer B (Backend/Sync)", labelEn: "Developer B (Backend/Sync)" },
  { handle: "@scrum-master", labelDe: "Scrum Master", labelEn: "Scrum Master" },
  { handle: "@product-owner", labelDe: "Product Owner (PM)", labelEn: "Product Owner (PM)" },
];

export interface WorkspaceHeaderControlsProps {
  roleMode: WorkspaceRoleMode;
  onRoleModeChange: (mode: WorkspaceRoleMode) => void;
  currentUser: string;
  onCurrentUserChange: (userHandle: string) => void;
  files: WorkspaceFile[];
  onOpenFile?: (filePath: string) => void;
  language?: "de" | "en";
  currentBranch?: string;
  onOpenGitBranchModal?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenImportModal?: () => void;
}

export function WorkspaceHeaderControls({
  roleMode,
  onRoleModeChange,
  currentUser,
  onCurrentUserChange,
  files,
  onOpenFile,
  language = "de",
  currentBranch,
  onOpenGitBranchModal,
  onOpenCommandPalette,
  onOpenImportModal,
}: WorkspaceHeaderControlsProps) {
  const isEn = language === "en";
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<"all" | "unread">("all");
  const [customHandleInput, setCustomHandleInput] = useState("");
  const [readIds, setReadIds] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Hydrate persisted currentUser, roleMode & read notification IDs from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedUser = localStorage.getItem(USER_HANDLE_STORAGE_KEY);
      if (savedUser && savedUser.startsWith("@") && savedUser !== currentUser) {
        onCurrentUserChange(savedUser);
      }
      const savedRole = localStorage.getItem(ROLE_MODE_STORAGE_KEY) as WorkspaceRoleMode | null;
      if (
        savedRole &&
        (savedRole === "developer" || savedRole === "scrum" || savedRole === "stakeholder") &&
        savedRole !== roleMode
      ) {
        onRoleModeChange(savedRole);
      }
      const savedRead = localStorage.getItem(READ_NOTIFS_STORAGE_KEY);
      if (savedRead) {
        const parsed = JSON.parse(savedRead);
        if (parsed && typeof parsed === "object") {
          setReadIds(parsed);
        }
      }
    } catch {
      // ignore storage access issues
    }
    // Hydrate once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsInboxOpen(false);
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleSelectRole = (nextMode: WorkspaceRoleMode) => {
    onRoleModeChange(nextMode);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(ROLE_MODE_STORAGE_KEY, nextMode);
      } catch {
        // ignore
      }
    }
  };

  const handleSelectUser = (rawHandle: string) => {
    const normalized = normalizeHandleForMatch(rawHandle) || "@developer-a";
    onCurrentUserChange(normalized);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(USER_HANDLE_STORAGE_KEY, normalized);
      } catch {
        // ignore
      }
    }
    setIsUserMenuOpen(false);
  };

  const notifications = useMemo(
    () => scanWorkspaceNotifications(files, currentUser, language),
    [files, currentUser, language]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds[n.id]).length,
    [notifications, readIds]
  );

  const visibleNotifications = useMemo(
    () =>
      inboxFilter === "unread"
        ? notifications.filter((n) => !readIds[n.id])
        : notifications,
    [notifications, inboxFilter, readIds]
  );

  const persistReadIds = (next: Record<string, boolean>) => {
    setReadIds(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(READ_NOTIFS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
  };

  const markSingleRead = (id: string) => {
    if (readIds[id]) return;
    persistReadIds({ ...readIds, [id]: true });
  };

  const markAllRead = () => {
    const next = { ...readIds };
    notifications.forEach((n) => {
      next[n.id] = true;
    });
    persistReadIds(next);
  };

  const getNotifIcon = (kind: WorkspaceNotificationItem["kind"]) => {
    switch (kind) {
      case "blocked":
        return <AlertCircle size={14} style={{ color: "var(--accent-red)", flexShrink: 0 }} />;
      case "mention":
        return <AtSign size={14} style={{ color: "var(--accent-indigo)", flexShrink: 0 }} />;
      case "review":
        return <Clock size={14} style={{ color: "var(--accent-yellow)", flexShrink: 0 }} />;
      default:
        return <CheckCircle size={14} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />;
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        position: "relative",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Optional Ctrl+K Omnibox Pill */}
      {onOpenCommandPalette && (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          title={isEn ? "Search & Commands (Ctrl+K)" : "Suche & Befehle (Strg+K)"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            height: "28px",
            padding: "0 10px",
            borderRadius: "6px",
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
            color: "var(--text-secondary)",
            fontSize: "11px",
            cursor: "pointer",
          }}
        >
          <Search size={12} style={{ color: "var(--accent-indigo)" }} />
          <span>{isEn ? "Search..." : "Suche..."}</span>
          <kbd
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              padding: "1px 4px",
              borderRadius: "3px",
              backgroundColor: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            Ctrl+K
          </kbd>
        </button>
      )}

      {/* Optional Active Git Branch Pill */}
      {onOpenGitBranchModal && (
        <button
          type="button"
          onClick={onOpenGitBranchModal}
          title={isEn ? "Switch or create Git branch" : "Git-Branch wechseln oder anlegen"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            height: "28px",
            padding: "0 9px",
            borderRadius: "6px",
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
            color: "var(--text-secondary)",
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            cursor: "pointer",
          }}
        >
          <GitBranch size={12} style={{ color: "var(--accent-green)" }} />
          <span style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {currentBranch || "main"}
          </span>
        </button>
      )}

      {/* Optional Atlassian Import Quick Trigger */}
      {onOpenImportModal && (
        <button
          type="button"
          onClick={onOpenImportModal}
          title={isEn ? "Import from Jira / Confluence" : "Aus Jira / Confluence importieren"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            height: "28px",
            padding: "0 8px",
            borderRadius: "6px",
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
            color: "var(--text-secondary)",
            fontSize: "11px",
            cursor: "pointer",
          }}
        >
          <Upload size={12} style={{ color: "var(--accent-blue)" }} />
          <span>{isEn ? "Import" : "Import"}</span>
        </button>
      )}

      {/* 1. Workspace Role Mode Switcher ("developer" | "scrum" | "stakeholder") */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2px",
          padding: "2px",
          height: "28px",
          borderRadius: "6px",
          backgroundColor: "var(--bg-panel)",
          border: "1px solid var(--border-color)",
        }}
        title={
          isEn
            ? "Switch Workspace Role Mode (Developer / Scrum / Stakeholder Clean Mode)"
            : "Workspace-Rollenmodus wechseln (Entwickler / Scrum / Stakeholder Clean Mode)"
        }
      >
        {(
          [
            {
              id: "developer",
              label: "Dev",
              icon: <Code size={11} />,
            },
            {
              id: "scrum",
              label: "Scrum",
              icon: <Layers size={11} />,
            },
            {
              id: "stakeholder",
              label: isEn ? "Stakeholder" : "PM / Clean",
              icon: <Eye size={11} />,
            },
          ] as const
        ).map((m) => {
          const active = roleMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSelectRole(m.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                height: "22px",
                padding: "0 7px",
                border: "none",
                borderRadius: "4px",
                backgroundColor: active
                  ? m.id === "stakeholder"
                    ? "var(--accent-green)"
                    : "var(--accent-indigo)"
                  : "transparent",
                color: active ? "#ffffff" : "var(--text-muted)",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Current User Handle Selector (@developer-a, etc.) */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => {
            setIsUserMenuOpen((v) => !v);
            setIsInboxOpen(false);
          }}
          title={isEn ? "Active @handle (persisted locally)" : "Aktives @Handle (lokal gespeichert)"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            height: "28px",
            padding: "0 9px",
            borderRadius: "6px",
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
            color: "var(--text-primary)",
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            cursor: "pointer",
          }}
        >
          <User size={12} style={{ color: "var(--accent-indigo)" }} />
          <span>{currentUser || "@developer-a"}</span>
          <ChevronDown size={11} style={{ color: "var(--text-muted)" }} />
        </button>

        {isUserMenuOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "34px",
              width: "250px",
              backgroundColor: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              borderRadius: "10px",
              boxShadow: "var(--shadow-lg)",
              padding: "8px",
              zIndex: 400,
            }}
          >
            <div
              style={{
                padding: "4px 8px 6px",
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              {isEn ? "Switch Active Team Identity" : "Aktive Team-Identität wählen"}
            </div>
            {PRESET_TEAM_HANDLES.map((item) => {
              const active = normalizeHandleForMatch(currentUser) === item.handle;
              return (
                <button
                  key={item.handle}
                  type="button"
                  onClick={() => handleSelectUser(item.handle)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 8px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: active ? "rgba(99, 102, 241, 0.14)" : "transparent",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600, color: "var(--accent-indigo)" }}>
                      {item.handle}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                      {isEn ? item.labelEn : item.labelDe}
                    </div>
                  </div>
                  {active && <Check size={13} style={{ color: "var(--accent-green)" }} />}
                </button>
              );
            })}

            <div
              style={{
                borderTop: "1px solid var(--border-color)",
                marginTop: "6px",
                paddingTop: "6px",
                display: "flex",
                gap: "4px",
              }}
            >
              <input
                type="text"
                value={customHandleInput}
                onChange={(e) => setCustomHandleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customHandleInput.trim()) {
                    handleSelectUser(customHandleInput);
                    setCustomHandleInput("");
                  }
                }}
                placeholder="@custom-handle"
                style={{
                  flex: 1,
                  padding: "4px 7px",
                  borderRadius: "5px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-panel)",
                  color: "var(--text-primary)",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (customHandleInput.trim()) {
                    handleSelectUser(customHandleInput);
                    setCustomHandleInput("");
                  }
                }}
                style={{
                  padding: "4px 8px",
                  borderRadius: "5px",
                  border: "none",
                  backgroundColor: "var(--accent-indigo)",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Notification Inbox Bell */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => {
            setIsInboxOpen((v) => !v);
            setIsUserMenuOpen(false);
          }}
          title={
            isEn
              ? `Workspace Notifications (${unreadCount} unread)`
              : `Benachrichtigungen (${unreadCount} ungelesen)`
          }
          style={{
            position: "relative",
            width: "30px",
            height: "28px",
            borderRadius: "6px",
            border: "1px solid var(--border-color)",
            backgroundColor: isInboxOpen ? "var(--bg-active)" : "var(--bg-panel)",
            color: unreadCount > 0 ? "var(--text-primary)" : "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Bell size={14} />
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "-4px",
                right: "-4px",
                minWidth: "16px",
                height: "16px",
                padding: "0 4px",
                borderRadius: "999px",
                backgroundColor: "var(--accent-red)",
                color: "#ffffff",
                fontSize: "9px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 2px var(--bg-sidebar)",
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {isInboxOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "34px",
              width: "360px",
              maxHeight: "430px",
              backgroundColor: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              borderRadius: "10px",
              boxShadow: "var(--shadow-lg)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              zIndex: 400,
            }}
          >
            {/* Inbox Header */}
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-panel)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
                {isEn ? "Inbox" : "Posteingang"}{" "}
                <span style={{ color: "var(--accent-indigo)", fontFamily: "var(--font-mono)" }}>
                  {currentUser}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setInboxFilter(inboxFilter === "all" ? "unread" : "all")}
                  style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-sidebar)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  {inboxFilter === "all"
                    ? isEn
                      ? "Unread only"
                      : "Nur ungelesene"
                    : isEn
                      ? "Show all"
                      : "Alle zeigen"}
                </button>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      border: "none",
                      backgroundColor: "rgba(99, 102, 241, 0.16)",
                      color: "var(--accent-indigo)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {isEn ? "Mark all read" : "Alle gelesen"}
                  </button>
                )}
              </div>
            </div>

            {/* Notification List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
              {visibleNotifications.length === 0 ? (
                <div
                  style={{
                    padding: "28px 16px",
                    textAlign: "center",
                    fontSize: "12px",
                    color: "var(--text-muted)",
                  }}
                >
                  {isEn
                    ? `All caught up for ${currentUser}!`
                    : `Keine offenen Meldungen für ${currentUser}!`}
                </div>
              ) : (
                visibleNotifications.map((item) => {
                  const isUnread = !readIds[item.id];
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        markSingleRead(item.id);
                        onOpenFile?.(item.filePath);
                        setIsInboxOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "9px 10px",
                        marginBottom: "3px",
                        borderRadius: "8px",
                        backgroundColor: isUnread
                          ? "rgba(99, 102, 241, 0.08)"
                          : "transparent",
                        border: `1px solid ${
                          isUnread ? "rgba(99, 102, 241, 0.22)" : "transparent"
                        }`,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ marginTop: "2px" }}>{getNotifIcon(item.kind)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: isUnread ? 600 : 500,
                            color: "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.title}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.subtitle}
                        </div>
                      </div>
                      <ChevronRight
                        size={13}
                        style={{ color: "var(--text-muted)", marginTop: "3px", flexShrink: 0 }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
