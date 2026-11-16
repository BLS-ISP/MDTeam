"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  GitBranch,
  Plus,
  Trash2,
  CheckSquare,
  MessageSquare,
  Calendar,
  Tag,
  AlertOctagon,
  ExternalLink,
  User,
  Layers,
  Zap,
  Bug,
  BookOpen,
  Bookmark,
  Flag,
  Check,
  Copy,
  Save,
  Eye,
  Edit3,
} from "lucide-react";
import {
  AgileIssue,
  AgileSprint,
  IssuePriority,
  IssueStatus,
  IssueType,
  FIBONACCI_POINTS,
  suggestBranchName,
} from "../utils/issueEngine";

export interface IssueDrawerProps {
  issue: AgileIssue | null;
  isOpen: boolean;
  isNew?: boolean;
  epics: AgileIssue[];
  sprints: AgileSprint[];
  allIssues?: AgileIssue[];
  currentUser: string;
  language: "de" | "en";
  onClose: () => void;
  onSave: (issue: AgileIssue) => void;
  onDelete?: (issue: AgileIssue) => void;
  onOpenMarkdownFile?: (filePath: string) => void;
  onCreateBranch?: (issue: AgileIssue, suggestedBranchName: string) => void;
}

const TEAM_HANDLES = [
  "@developer-a",
  "@developer-b",
  "@scrummaster",
  "@product-owner",
];

const copy = {
  de: {
    newIssueHeader: "Neues Ticket erstellen",
    editIssueHeader: "Ticket-Details",
    openMarkdown: ".md öffnen",
    createBranch: "Git-Branch erstellen",
    branchCreated: "Branch verknüpft",
    saveIssue: "Speichern",
    createIssueBtn: "Ticket anlegen",
    savedBadge: "Gespeichert",
    deleteIssue: "Löschen",
    confirmDelete: "Dieses Ticket wirklich löschen?",
    cancel: "Abbrechen",
    titlePlaceholder: "Prägnanter Ticket-Titel (z.B. OAuth2 SSO Flow implementieren)...",
    titleRequired: "Bitte geben Sie einen Titel ein.",
    blockedBanner: "Dieses Ticket wird blockiert durch:",
    description: "Beschreibung",
    writeTab: "Bearbeiten",
    previewTab: "Vorschau",
    descriptionPlaceholder: "Kontext, technische Details, Architekturentscheidungen (Markdown unterstützt)...",
    noDescription: "Keine Beschreibung hinterlegt.",
    acceptanceCriteria: "Akzeptanzkriterien (DoD)",
    addCriterionPlaceholder: "Neues Akzeptanzkriterium hinzufügen (Enter)...",
    addBtn: "Hinzufügen",
    noCriteria: "Noch keine Akzeptanzkriterien definiert.",
    comments: "Kommentare & Diskussion",
    commentPlaceholder: "Kommentar schreiben als",
    postComment: "Kommentieren",
    noComments: "Noch keine Kommentare zu diesem Ticket.",
    properties: "Eigenschaften",
    type: "Typ",
    status: "Status",
    priority: "Priorität",
    storyPoints: "Story Points (Fibonacci)",
    sprint: "Sprint",
    noSprint: "Product Backlog (Kein Sprint)",
    epic: "Epic",
    noEpic: "Kein Epic",
    assignee: "Zugewiesen an",
    assignToMe: "Mir zuweisen",
    unassigned: "Nicht zugewiesen",
    reporter: "Ersteller (Reporter)",
    labels: "Labels / Tags",
    addLabelPlaceholder: "Label + Enter...",
    blockedBy: "Blockiert durch (Ticket-IDs)",
    addBlockerPlaceholder: "z.B. MDT-104",
    startDate: "Startdatum",
    endDate: "Enddatum (Fällig)",
    gitBranch: "Git-Branch",
    copyBranchCmd: "git checkout Befehl kopieren",
    copied: "Kopiert!",
    createdAt: "Erstellt",
    updatedAt: "Aktualisiert",
    types: {
      epic: "Epic",
      story: "User Story",
      bug: "Bug",
      task: "Task",
      spike: "Spike",
    } as Record<IssueType, string>,
    statuses: {
      backlog: "Backlog",
      ready: "Bereit (Ready)",
      "in-progress": "In Arbeit",
      review: "In Review",
      done: "Erledigt (Done)",
    } as Record<IssueStatus, string>,
    priorities: {
      critical: "Kritisch",
      high: "Hoch",
      medium: "Mittel",
      low: "Niedrig",
    } as Record<IssuePriority, string>,
  },
  en: {
    newIssueHeader: "Create New Issue",
    editIssueHeader: "Issue Details",
    openMarkdown: "Open .md",
    createBranch: "Create Git Branch",
    branchCreated: "Branch Linked",
    saveIssue: "Save",
    createIssueBtn: "Create Issue",
    savedBadge: "Saved",
    deleteIssue: "Delete",
    confirmDelete: "Are you sure you want to delete this issue?",
    cancel: "Cancel",
    titlePlaceholder: "Concise issue summary (e.g. Implement OAuth2 SSO Flow)...",
    titleRequired: "Please enter an issue title.",
    blockedBanner: "This issue is blocked by:",
    description: "Description",
    writeTab: "Write",
    previewTab: "Preview",
    descriptionPlaceholder: "Context, technical notes, architecture links (Markdown supported)...",
    noDescription: "No description provided.",
    acceptanceCriteria: "Acceptance Criteria",
    addCriterionPlaceholder: "Add acceptance criterion (press Enter)...",
    addBtn: "Add",
    noCriteria: "No acceptance criteria defined yet.",
    comments: "Comments & Activity",
    commentPlaceholder: "Write a comment as",
    postComment: "Post Comment",
    noComments: "No comments on this issue yet.",
    properties: "Properties",
    type: "Type",
    status: "Status",
    priority: "Priority",
    storyPoints: "Story Points (Fibonacci)",
    sprint: "Sprint",
    noSprint: "Product Backlog (No Sprint)",
    epic: "Epic",
    noEpic: "No Epic",
    assignee: "Assignee",
    assignToMe: "Assign to me",
    unassigned: "Unassigned",
    reporter: "Reporter",
    labels: "Labels",
    addLabelPlaceholder: "Add label + Enter...",
    blockedBy: "Blocked By (Issue IDs)",
    addBlockerPlaceholder: "e.g. MDT-104",
    startDate: "Start Date",
    endDate: "Target End Date",
    gitBranch: "Git Branch",
    copyBranchCmd: "Copy git checkout command",
    copied: "Copied!",
    createdAt: "Created",
    updatedAt: "Updated",
    types: {
      epic: "Epic",
      story: "Story",
      bug: "Bug",
      task: "Task",
      spike: "Spike",
    } as Record<IssueType, string>,
    statuses: {
      backlog: "Backlog",
      ready: "Ready",
      "in-progress": "In Progress",
      review: "In Review",
      done: "Done",
    } as Record<IssueStatus, string>,
    priorities: {
      critical: "Critical",
      high: "High",
      medium: "Medium",
      low: "Low",
    } as Record<IssuePriority, string>,
  },
};

function renderTypeIcon(type: IssueType) {
  switch (type) {
    case "epic":
      return <Layers size={14} style={{ color: "#a855f7" }} />;
    case "bug":
      return <Bug size={14} style={{ color: "var(--accent-red)" }} />;
    case "story":
      return <Bookmark size={14} style={{ color: "var(--accent-green)" }} />;
    case "spike":
      return <Zap size={14} style={{ color: "var(--accent-yellow)" }} />;
    default:
      return <BookOpen size={14} style={{ color: "var(--accent-blue)" }} />;
  }
}

function getPriorityColor(priority: IssuePriority): string {
  switch (priority) {
    case "critical":
      return "var(--accent-red)";
    case "high":
      return "#f97316";
    case "medium":
      return "var(--accent-yellow)";
    case "low":
      return "var(--accent-blue)";
  }
}

export function IssueDrawer({
  issue,
  isOpen,
  isNew = false,
  epics,
  sprints,
  allIssues = [],
  currentUser,
  language,
  onClose,
  onSave,
  onDelete,
  onOpenMarkdownFile,
  onCreateBranch,
}: IssueDrawerProps) {
  const t = copy[language] || copy.de;
  const [draft, setDraft] = useState<AgileIssue | null>(issue);
  const [descMode, setDescMode] = useState<"write" | "preview">("write");
  const [newCriterion, setNewCriterion] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newBlocker, setNewBlocker] = useState("");
  const [commentText, setCommentText] = useState("");
  const [titleError, setTitleError] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [copiedBranch, setCopiedBranch] = useState(false);

  useEffect(() => {
    setDraft(issue ? { ...issue } : null);
    setTitleError(false);
    setNewCriterion("");
    setNewLabel("");
    setNewBlocker("");
    setCommentText("");
    setDescMode("write");
  }, [issue?.id, issue?.updatedAt, isOpen, isNew]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const assigneeOptions = useMemo(() => {
    const set = new Set<string>(TEAM_HANDLES);
    if (currentUser) set.add(currentUser.startsWith("@") ? currentUser : `@${currentUser}`);
    allIssues.forEach((i) => {
      if (i.assignee) set.add(i.assignee);
    });
    return Array.from(set);
  }, [allIssues, currentUser]);

  if (!isOpen || !draft) return null;

  const persistIfEditing = (next: AgileIssue) => {
    const stamped = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    setDraft(stamped);
    if (!isNew && stamped.title.trim()) {
      onSave(stamped);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1400);
    }
  };

  const handleExplicitSave = () => {
    if (!draft.title.trim()) {
      setTitleError(true);
      return;
    }
    const stamped: AgileIssue = {
      ...draft,
      title: draft.title.trim(),
      updatedAt: new Date().toISOString(),
    };
    setDraft(stamped);
    onSave(stamped);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
    if (isNew) {
      onClose();
    }
  };

  const handleAddCriterion = () => {
    const text = newCriterion.trim();
    if (!text) return;
    const updatedAc = [...draft.acceptanceCriteria, { text, checked: false }];
    setNewCriterion("");
    persistIfEditing({ ...draft, acceptanceCriteria: updatedAc });
  };

  const handleToggleCriterion = (idx: number) => {
    const updatedAc = draft.acceptanceCriteria.map((item, i) =>
      i === idx ? { ...item, checked: !item.checked } : item
    );
    persistIfEditing({ ...draft, acceptanceCriteria: updatedAc });
  };

  const handleUpdateCriterionText = (idx: number, text: string) => {
    const updatedAc = draft.acceptanceCriteria.map((item, i) =>
      i === idx ? { ...item, text } : item
    );
    setDraft({ ...draft, acceptanceCriteria: updatedAc });
  };

  const handleDeleteCriterion = (idx: number) => {
    const updatedAc = draft.acceptanceCriteria.filter((_, i) => i !== idx);
    persistIfEditing({ ...draft, acceptanceCriteria: updatedAc });
  };

  const handleAddLabel = () => {
    const clean = newLabel.trim().toLowerCase().replace(/^#/, "");
    if (!clean) return;
    if (!draft.labels.includes(clean)) {
      persistIfEditing({ ...draft, labels: [...draft.labels, clean] });
    }
    setNewLabel("");
  };

  const handleRemoveLabel = (lbl: string) => {
    persistIfEditing({
      ...draft,
      labels: draft.labels.filter((l) => l !== lbl),
    });
  };

  const handleAddBlocker = (blockerIdRaw?: string) => {
    const clean = (blockerIdRaw ?? newBlocker).trim().toUpperCase();
    if (!clean || clean === draft.id.toUpperCase()) return;
    if (!draft.blockedBy.includes(clean)) {
      persistIfEditing({ ...draft, blockedBy: [...draft.blockedBy, clean] });
    }
    setNewBlocker("");
  };

  const handleRemoveBlocker = (bId: string) => {
    persistIfEditing({
      ...draft,
      blockedBy: draft.blockedBy.filter((b) => b !== bId),
    });
  };

  const handlePostComment = () => {
    const text = commentText.trim();
    if (!text) return;
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    const authorHandle = currentUser
      ? currentUser.startsWith("@")
        ? currentUser
        : `@${currentUser}`
      : "@developer-a";

    const updatedComments = [
      ...draft.comments,
      { author: authorHandle, timestamp: ts, text },
    ];
    setCommentText("");
    persistIfEditing({ ...draft, comments: updatedComments });
  };

  const handleDeleteComment = (idx: number) => {
    const updatedComments = draft.comments.filter((_, i) => i !== idx);
    persistIfEditing({ ...draft, comments: updatedComments });
  };

  const handleCreateBranchClick = () => {
    const suggested = draft.branch.trim() || suggestBranchName(draft);
    const updated: AgileIssue = {
      ...draft,
      branch: suggested,
      updatedAt: new Date().toISOString(),
    };
    setDraft(updated);
    if (!isNew && updated.title.trim()) {
      onSave(updated);
    }
    onCreateBranch?.(updated, suggested);
  };

  const handleCopyBranchCmd = () => {
    const branchName = draft.branch.trim() || suggestBranchName(draft);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`git checkout -b ${branchName}`).catch(() => {});
    }
    setCopiedBranch(true);
    setTimeout(() => setCopiedBranch(false), 1500);
  };

  const acDoneCount = draft.acceptanceCriteria.filter((c) => c.checked).length;
  const acTotalCount = draft.acceptanceCriteria.length;
  const acPercent = acTotalCount > 0 ? Math.round((acDoneCount / acTotalCount) * 100) : 0;

  const suggestedBranch = draft.branch || suggestBranchName(draft);
  const candidateBlockers = allIssues.filter(
    (i) => i.id !== draft.id && !draft.blockedBy.includes(i.id)
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(2px)",
        zIndex: 150,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (!isNew && draft.title.trim() && draft !== issue) {
            onSave({ ...draft, updatedAt: new Date().toISOString() });
          }
          onClose();
        }
      }}
    >
      <div
        style={{
          width: "min(860px, 96vw)",
          height: "100vh",
          backgroundColor: "var(--bg-sidebar)",
          borderLeft: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          color: "var(--text-primary)",
          fontFamily: "var(--font-sans)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Action Header */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "6px",
                backgroundColor: "var(--bg-active)",
                border: "1px solid var(--border-color)",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--accent-indigo)",
              }}
            >
              {renderTypeIcon(draft.type)}
              {draft.id}
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
              {isNew ? t.newIssueHeader : t.editIssueHeader}
            </span>
            {justSaved && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  color: "var(--accent-green)",
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontWeight: 600,
                }}
              >
                <Check size={11} /> {t.savedBadge}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {!isNew && onOpenMarkdownFile && !draft.isVirtualLegacy && (
              <button
                type="button"
                onClick={() => onOpenMarkdownFile(draft.filePath)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-sidebar)",
                  color: "var(--text-secondary)",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
                title={draft.filePath}
              >
                <ExternalLink size={13} />
                {t.openMarkdown}
              </button>
            )}

            <button
              type="button"
              onClick={handleCreateBranchClick}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(99, 102, 241, 0.45)",
                backgroundColor: "rgba(99, 102, 241, 0.14)",
                color: "var(--text-primary)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
              title={suggestedBranch}
            >
              <GitBranch size={13} style={{ color: "var(--accent-indigo)" }} />
              {t.createBranch}
            </button>

            <button
              type="button"
              onClick={handleExplicitSave}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "var(--accent-indigo)",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Save size={13} />
              {isNew ? t.createIssueBtn : t.saveIssue}
            </button>

            {!isNew && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t.confirmDelete)) {
                    onDelete(draft);
                    onClose();
                  }
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  color: "var(--accent-red)",
                  cursor: "pointer",
                }}
                title={t.deleteIssue}
              >
                <Trash2 size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Blocked Alert Banner */}
        {draft.blockedBy.length > 0 && (
          <div
            style={{
              padding: "8px 20px",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              borderBottom: "1px solid rgba(239, 68, 68, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: "var(--accent-red)",
              fontWeight: 600,
            }}
          >
            <AlertOctagon size={15} />
            <span>{t.blockedBanner}</span>
            {draft.blockedBy.map((b) => (
              <span
                key={b}
                style={{
                  padding: "2px 7px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                }}
              >
                {b}
              </span>
            ))}
          </div>
        )}

        {/* Drawer Main Split Content */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.45fr) minmax(260px, 0.95fr)",
            overflow: "hidden",
          }}
        >
          {/* Left Column: Title, Description, AC Checklist, Comments */}
          <div
            style={{
              padding: "20px 24px",
              overflowY: "auto",
              borderRight: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: "22px",
            }}
          >
            {/* Title */}
            <div>
              <input
                type="text"
                value={draft.title}
                autoFocus={isNew}
                placeholder={t.titlePlaceholder}
                onChange={(e) => {
                  setTitleError(false);
                  setDraft({ ...draft, title: e.target.value });
                }}
                onBlur={() => {
                  if (!isNew && draft.title.trim()) {
                    persistIfEditing(draft);
                  }
                }}
                style={{
                  width: "100%",
                  backgroundColor: "var(--bg-editor)",
                  border: `1px solid ${titleError ? "var(--accent-red)" : "var(--border-color)"}`,
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              {titleError && (
                <div style={{ color: "var(--accent-red)", fontSize: "11px", marginTop: "4px" }}>
                  {t.titleRequired}
                </div>
              )}
            </div>

            {/* Description */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--text-secondary)",
                  }}
                >
                  {t.description}
                </label>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setDescMode("write")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "3px 8px",
                      fontSize: "11px",
                      borderRadius: "4px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: descMode === "write" ? "var(--bg-active)" : "transparent",
                      color: descMode === "write" ? "var(--text-primary)" : "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <Edit3 size={11} /> {t.writeTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescMode("preview")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "3px 8px",
                      fontSize: "11px",
                      borderRadius: "4px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: descMode === "preview" ? "var(--bg-active)" : "transparent",
                      color: descMode === "preview" ? "var(--text-primary)" : "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <Eye size={11} /> {t.previewTab}
                  </button>
                </div>
              </div>

              {descMode === "write" ? (
                <textarea
                  value={draft.description}
                  placeholder={t.descriptionPlaceholder}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  onBlur={() => {
                    if (!isNew && draft.title.trim()) {
                      persistIfEditing(draft);
                    }
                  }}
                  rows={6}
                  style={{
                    width: "100%",
                    backgroundColor: "var(--bg-editor)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    lineHeight: 1.55,
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-sans)",
                    resize: "vertical",
                    outline: "none",
                  }}
                />
              ) : (
                <div
                  style={{
                    backgroundColor: "var(--bg-panel)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    fontSize: "13px",
                    lineHeight: 1.6,
                    color: draft.description ? "var(--text-primary)" : "var(--text-muted)",
                    whiteSpace: "pre-wrap",
                    minHeight: "100px",
                  }}
                >
                  {draft.description || t.noDescription}
                </div>
              )}
            </div>

            {/* Acceptance Criteria Checklist */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--text-secondary)",
                  }}
                >
                  <CheckSquare size={14} style={{ color: "var(--accent-green)" }} />
                  {t.acceptanceCriteria}
                </label>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {acDoneCount}/{acTotalCount} ({acPercent}%)
                </span>
              </div>

              {/* AC Progress Bar */}
              <div
                style={{
                  width: "100%",
                  height: "6px",
                  backgroundColor: "var(--bg-panel)",
                  borderRadius: "999px",
                  overflow: "hidden",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div
                  style={{
                    width: `${acPercent}%`,
                    height: "100%",
                    backgroundColor: acPercent === 100 ? "var(--accent-green)" : "var(--accent-indigo)",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {draft.acceptanceCriteria.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                    {t.noCriteria}
                  </div>
                ) : (
                  draft.acceptanceCriteria.map((ac, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 10px",
                        backgroundColor: "var(--bg-panel)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "6px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={ac.checked}
                        onChange={() => handleToggleCriterion(idx)}
                        style={{
                          width: "15px",
                          height: "15px",
                          accentColor: "var(--accent-green)",
                          cursor: "pointer",
                        }}
                      />
                      <input
                        type="text"
                        value={ac.text}
                        onChange={(e) => handleUpdateCriterionText(idx, e.target.value)}
                        onBlur={() => {
                          if (!isNew && draft.title.trim()) persistIfEditing(draft);
                        }}
                        style={{
                          flex: 1,
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          fontSize: "13px",
                          color: ac.checked ? "var(--text-muted)" : "var(--text-primary)",
                          textDecoration: ac.checked ? "line-through" : "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteCriterion(idx)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          display: "flex",
                          padding: "2px",
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add new AC item */}
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={newCriterion}
                  placeholder={t.addCriterionPlaceholder}
                  onChange={(e) => setNewCriterion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCriterion();
                    }
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: "var(--bg-editor)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    padding: "7px 10px",
                    fontSize: "12px",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCriterion}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "7px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-active)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={13} /> {t.addBtn}
                </button>
              </div>
            </div>

            {/* Comment Thread */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "var(--text-secondary)",
                }}
              >
                <MessageSquare size={14} style={{ color: "var(--accent-indigo)" }} />
                {t.comments} ({draft.comments.length})
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {draft.comments.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                    {t.noComments}
                  </div>
                ) : (
                  draft.comments.map((c, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "10px 12px",
                        backgroundColor: "var(--bg-panel)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              backgroundColor: "rgba(99, 102, 241, 0.25)",
                              color: "var(--accent-indigo)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              fontWeight: 700,
                            }}
                          >
                            {c.author.replace(/^@/, "").slice(0, 2).toUpperCase()}
                          </span>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-indigo)" }}>
                            {c.author}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            {c.timestamp}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(idx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "2px",
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {c.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* New Comment Composer */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  backgroundColor: "var(--bg-panel)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "10px",
                }}
              >
                <textarea
                  value={commentText}
                  placeholder={`${t.commentPlaceholder} ${currentUser || "@developer-a"}...`}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      handlePostComment();
                    }
                  }}
                  rows={2}
                  style={{
                    width: "100%",
                    backgroundColor: "var(--bg-editor)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-sans)",
                    resize: "vertical",
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handlePostComment}
                    disabled={!commentText.trim()}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: commentText.trim() ? "var(--accent-indigo)" : "var(--bg-active)",
                      color: commentText.trim() ? "#ffffff" : "var(--text-muted)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: commentText.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    {t.postComment}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Structured Agile Metadata Sidebar */}
          <div
            style={{
              padding: "18px 18px",
              overflowY: "auto",
              backgroundColor: "var(--bg-panel)",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.7px",
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "6px",
              }}
            >
              {t.properties}
            </div>

            {/* Type & Status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label className="settings-label">{t.type}</label>
                <select
                  className="settings-select"
                  value={draft.type}
                  onChange={(e) =>
                    persistIfEditing({ ...draft, type: e.target.value as IssueType })
                  }
                >
                  {(["epic", "story", "bug", "task", "spike"] as IssueType[]).map((tp) => (
                    <option key={tp} value={tp}>
                      {t.types[tp]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="settings-label">{t.status}</label>
                <select
                  className="settings-select"
                  value={draft.status}
                  onChange={(e) =>
                    persistIfEditing({ ...draft, status: e.target.value as IssueStatus })
                  }
                >
                  {(["backlog", "ready", "in-progress", "review", "done"] as IssueStatus[]).map((st) => (
                    <option key={st} value={st}>
                      {t.statuses[st]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="settings-label" style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <Flag size={11} style={{ color: getPriorityColor(draft.priority) }} />
                {t.priority}
              </label>
              <select
                className="settings-select"
                value={draft.priority}
                onChange={(e) =>
                  persistIfEditing({ ...draft, priority: e.target.value as IssuePriority })
                }
              >
                {(["critical", "high", "medium", "low"] as IssuePriority[]).map((pr) => (
                  <option key={pr} value={pr}>
                    {t.priorities[pr]}
                  </option>
                ))}
              </select>
            </div>

            {/* Fibonacci Story Points */}
            <div>
              <label className="settings-label">{t.storyPoints}</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {FIBONACCI_POINTS.map((pts) => {
                  const selected = draft.storyPoints === pts;
                  return (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => persistIfEditing({ ...draft, storyPoints: pts })}
                      style={{
                        minWidth: "32px",
                        height: "28px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: selected
                          ? "1px solid var(--accent-indigo)"
                          : "1px solid var(--border-color)",
                        backgroundColor: selected
                          ? "var(--accent-indigo)"
                          : "var(--bg-sidebar)",
                        color: selected ? "#ffffff" : "var(--text-secondary)",
                        fontSize: "12px",
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        cursor: "pointer",
                      }}
                    >
                      {pts}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sprint & Epic */}
            <div>
              <label className="settings-label">{t.sprint}</label>
              <select
                className="settings-select"
                value={draft.sprint}
                onChange={(e) => persistIfEditing({ ...draft, sprint: e.target.value })}
              >
                <option value="">{t.noSprint}</option>
                {sprints.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} ({sp.state.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {draft.type !== "epic" && (
              <div>
                <label className="settings-label">{t.epic}</label>
                <select
                  className="settings-select"
                  value={draft.epic}
                  onChange={(e) => persistIfEditing({ ...draft, epic: e.target.value })}
                >
                  <option value="">{t.noEpic}</option>
                  {epics.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.id}: {ep.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Assignee & Reporter */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label className="settings-label" style={{ marginBottom: 0 }}>
                  <User size={11} style={{ display: "inline", marginRight: "4px" }} />
                  {t.assignee}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const me = currentUser
                      ? currentUser.startsWith("@")
                        ? currentUser
                        : `@${currentUser}`
                      : "@developer-a";
                    persistIfEditing({ ...draft, assignee: me });
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent-indigo)",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {t.assignToMe}
                </button>
              </div>
              <select
                className="settings-select"
                value={draft.assignee}
                onChange={(e) => persistIfEditing({ ...draft, assignee: e.target.value })}
              >
                <option value="">{t.unassigned}</option>
                {assigneeOptions.map((handle) => (
                  <option key={handle} value={handle}>
                    {handle}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="settings-label">{t.reporter}</label>
              <input
                type="text"
                className="settings-input"
                value={draft.reporter}
                onChange={(e) => setDraft({ ...draft, reporter: e.target.value })}
                onBlur={() => {
                  if (!isNew && draft.title.trim()) persistIfEditing(draft);
                }}
              />
            </div>

            {/* Start / End Dates */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <label className="settings-label">
                  <Calendar size={10} style={{ display: "inline", marginRight: "4px" }} />
                  {t.startDate}
                </label>
                <input
                  type="date"
                  className="settings-input"
                  value={draft.startDate || ""}
                  onChange={(e) =>
                    persistIfEditing({ ...draft, startDate: e.target.value || undefined })
                  }
                />
              </div>
              <div>
                <label className="settings-label">
                  <Calendar size={10} style={{ display: "inline", marginRight: "4px" }} />
                  {t.endDate}
                </label>
                <input
                  type="date"
                  className="settings-input"
                  value={draft.endDate || ""}
                  onChange={(e) =>
                    persistIfEditing({ ...draft, endDate: e.target.value || undefined })
                  }
                />
              </div>
            </div>

            {/* Labels */}
            <div>
              <label className="settings-label">
                <Tag size={11} style={{ display: "inline", marginRight: "4px" }} />
                {t.labels}
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "6px" }}>
                {draft.labels.map((lbl) => (
                  <span
                    key={lbl}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      backgroundColor: "rgba(99, 102, 241, 0.14)",
                      border: "1px solid rgba(99, 102, 241, 0.3)",
                      color: "var(--text-primary)",
                      fontSize: "11px",
                    }}
                  >
                    #{lbl}
                    <button
                      type="button"
                      onClick={() => handleRemoveLabel(lbl)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        display: "flex",
                        padding: 0,
                      }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="text"
                  className="settings-input"
                  placeholder={t.addLabelPlaceholder}
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddLabel();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddLabel}
                  style={{
                    padding: "0 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-sidebar)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            {/* BlockedBy IDs */}
            <div>
              <label className="settings-label" style={{ color: draft.blockedBy.length > 0 ? "var(--accent-red)" : undefined }}>
                <AlertOctagon size={11} style={{ display: "inline", marginRight: "4px" }} />
                {t.blockedBy}
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "6px" }}>
                {draft.blockedBy.map((bId) => (
                  <span
                    key={bId}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      backgroundColor: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.35)",
                      color: "var(--accent-red)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {bId}
                    <button
                      type="button"
                      onClick={() => handleRemoveBlocker(bId)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent-red)",
                        cursor: "pointer",
                        display: "flex",
                        padding: 0,
                      }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="text"
                  list="mdteam-blocker-candidates"
                  className="settings-input"
                  placeholder={t.addBlockerPlaceholder}
                  value={newBlocker}
                  onChange={(e) => setNewBlocker(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddBlocker();
                    }
                  }}
                />
                <datalist id="mdteam-blocker-candidates">
                  {candidateBlockers.map((cand) => (
                    <option key={cand.id} value={cand.id}>
                      {cand.title}
                    </option>
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={() => handleAddBlocker()}
                  style={{
                    padding: "0 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-sidebar)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            {/* Git Branch */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label className="settings-label" style={{ marginBottom: 0 }}>
                  <GitBranch size={11} style={{ display: "inline", marginRight: "4px" }} />
                  {t.gitBranch}
                </label>
                <button
                  type="button"
                  onClick={handleCopyBranchCmd}
                  style={{
                    background: "none",
                    border: "none",
                    color: copiedBranch ? "var(--accent-green)" : "var(--text-muted)",
                    fontSize: "10px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                  title={t.copyBranchCmd}
                >
                  <Copy size={10} /> {copiedBranch ? t.copied : "git checkout -b"}
                </button>
              </div>
              <input
                type="text"
                className="settings-input"
                style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}
                placeholder={suggestedBranch}
                value={draft.branch}
                onChange={(e) => setDraft({ ...draft, branch: e.target.value })}
                onBlur={() => {
                  if (!isNew && draft.title.trim()) persistIfEditing(draft);
                }}
              />
            </div>

            {/* Audit Timestamps */}
            <div
              style={{
                marginTop: "6px",
                paddingTop: "10px",
                borderTop: "1px solid var(--border-color)",
                fontSize: "11px",
                color: "var(--text-muted)",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{t.createdAt}:</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  {draft.createdAt.slice(0, 16).replace("T", " ")}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{t.updatedAt}:</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  {draft.updatedAt.slice(0, 16).replace("T", " ")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IssueDrawer;
