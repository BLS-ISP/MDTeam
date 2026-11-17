"use client";

import React from "react";
import {
  Plus,
  GitBranch,
  Upload,
  FileText,
  CheckCircle,
  Download,
  Eye,
  BookOpen,
  Layers,
} from "lucide-react";
import {
  type WorkspaceFile,
  type WorkspaceRoleMode,
  parseMarkdownSummary,
  getStatusBadgeColors,
  getCategoryBadgeLabel,
} from "./modalTypesAndBadges";

export type PaletteFilterScope = "all" | "actions" | "issues" | "docs";

export interface PaletteEntry {
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

export interface BuildPaletteEntriesArgs {
  files: WorkspaceFile[];
  isEn: boolean;
  roleMode: WorkspaceRoleMode;
  closePalette: () => void;
  onSelectFile: (filePath: string) => void;
  onCreateIssue?: () => void;
  onOpenScrumBoard?: () => void;
  onOpenImportModal?: () => void;
  onOpenGitBranchModal?: () => void;
  onOpenTemplateGallery?: () => void;
  onExportDocx?: () => void;
  onToggleStakeholderMode?: () => void;
}

export function buildCommandPaletteEntries({
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
}: BuildPaletteEntriesArgs): PaletteEntry[] {
  const entries: PaletteEntry[] = [];

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
}

export function filterCommandPaletteEntries(
  allEntries: PaletteEntry[],
  query: string,
  filterScope: PaletteFilterScope
): PaletteEntry[] {
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
}
