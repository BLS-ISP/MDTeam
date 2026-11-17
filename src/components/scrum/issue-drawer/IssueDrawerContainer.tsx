"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  AgileIssue,
  AgileRelease,
  AgileSprint,
  suggestBranchName,
} from "../../../utils/issueEngine";
import { TEAM_HANDLES, issueDrawerCopy } from "./issueDrawerI18n";
import { IssueDrawerHeader } from "./IssueDrawerHeader";
import { IssueDescriptionSection } from "./IssueDescriptionSection";
import { IssueAcceptanceCriteriaSection } from "./IssueAcceptanceCriteriaSection";
import { IssueSubtasksAndTimeSection } from "./IssueSubtasksAndTimeSection";
import { IssueAttachmentsSection } from "./IssueAttachmentsSection";
import { IssueCommentsSection } from "./IssueCommentsSection";
import { IssueMetadataSidebar } from "./IssueMetadataSidebar";

export interface IssueDrawerProps {
  issue: AgileIssue | null;
  isOpen: boolean;
  isNew?: boolean;
  epics: AgileIssue[];
  sprints: AgileSprint[];
  releases?: AgileRelease[];
  allIssues?: AgileIssue[];
  currentUser: string;
  language: "de" | "en";
  onClose: () => void;
  onSave: (issue: AgileIssue) => void;
  onDelete?: (issue: AgileIssue) => void;
  onOpenMarkdownFile?: (filePath: string) => void;
  onCreateBranch?: (issue: AgileIssue, suggestedBranchName: string) => void;
}

export function IssueDrawer({
  issue,
  isOpen,
  isNew = false,
  epics,
  sprints,
  releases = [],
  allIssues = [],
  currentUser,
  language,
  onClose,
  onSave,
  onDelete,
  onOpenMarkdownFile,
  onCreateBranch,
}: IssueDrawerProps) {
  const t = issueDrawerCopy[language] || issueDrawerCopy.de;
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
      if (e.key === "Escape") onClose();
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
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setDraft(stamped);
    if (!isNew && stamped.title.trim()) {
      onSave(stamped);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1400);
    }
  };

  const persistDraftOnBlur = () => {
    if (!isNew && draft.title.trim()) {
      persistIfEditing(draft);
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
    if (isNew) onClose();
  };

  const handleAddCriterion = () => {
    const text = newCriterion.trim();
    if (!text) return;
    setNewCriterion("");
    persistIfEditing({
      ...draft,
      acceptanceCriteria: [...draft.acceptanceCriteria, { text, checked: false }],
    });
  };

  const handleToggleCriterion = (idx: number) => {
    persistIfEditing({
      ...draft,
      acceptanceCriteria: draft.acceptanceCriteria.map((item, i) =>
        i === idx ? { ...item, checked: !item.checked } : item
      ),
    });
  };

  const handleUpdateCriterionText = (idx: number, text: string) => {
    setDraft({
      ...draft,
      acceptanceCriteria: draft.acceptanceCriteria.map((item, i) =>
        i === idx ? { ...item, text } : item
      ),
    });
  };

  const handleDeleteCriterion = (idx: number) => {
    persistIfEditing({
      ...draft,
      acceptanceCriteria: draft.acceptanceCriteria.filter((_, i) => i !== idx),
    });
  };

  const handleAddLabel = () => {
    const clean = newLabel.trim().toLowerCase().replace(/^#/, "");
    if (clean && !draft.labels.includes(clean)) {
      persistIfEditing({ ...draft, labels: [...draft.labels, clean] });
    }
    setNewLabel("");
  };

  const handleRemoveLabel = (lbl: string) => {
    persistIfEditing({ ...draft, labels: draft.labels.filter((l) => l !== lbl) });
  };

  const handleAddBlocker = (blockerIdRaw?: string) => {
    const clean = (blockerIdRaw ?? newBlocker).trim().toUpperCase();
    if (clean && clean !== draft.id.toUpperCase() && !draft.blockedBy.includes(clean)) {
      persistIfEditing({ ...draft, blockedBy: [...draft.blockedBy, clean] });
    }
    setNewBlocker("");
  };

  const handleRemoveBlocker = (bId: string) => {
    persistIfEditing({ ...draft, blockedBy: draft.blockedBy.filter((b) => b !== bId) });
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
    setCommentText("");
    persistIfEditing({
      ...draft,
      comments: [...draft.comments, { author: authorHandle, timestamp: ts, text }],
    });
  };

  const handleDeleteComment = (idx: number) => {
    persistIfEditing({
      ...draft,
      comments: draft.comments.filter((_, i) => i !== idx),
    });
  };

  const handleCreateBranchClick = () => {
    const suggested = draft.branch.trim() || suggestBranchName(draft);
    const updated: AgileIssue = {
      ...draft,
      branch: suggested,
      updatedAt: new Date().toISOString(),
    };
    setDraft(updated);
    if (!isNew && updated.title.trim()) onSave(updated);
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
          width: "min(900px, 96vw)",
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
        <IssueDrawerHeader
          draft={draft}
          isNew={isNew}
          justSaved={justSaved}
          suggestedBranch={suggestedBranch}
          t={t}
          onOpenMarkdownFile={onOpenMarkdownFile}
          onCreateBranchClick={handleCreateBranchClick}
          onExplicitSave={handleExplicitSave}
          onDelete={onDelete}
          onClose={onClose}
        />

        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.5fr) minmax(265px, 0.95fr)",
            overflow: "hidden",
          }}
        >
          {/* Left Column: Title, Description, AC, Subtasks & Time, Attachments, Comments */}
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
            <IssueDescriptionSection
              draft={draft}
              isNew={isNew}
              descMode={descMode}
              titleError={titleError}
              t={t}
              onSetDescMode={setDescMode}
              onTitleChange={(title) => {
                setTitleError(false);
                setDraft({ ...draft, title });
              }}
              onDescriptionChange={(description) => setDraft({ ...draft, description })}
              onPersistDraftOnBlur={persistDraftOnBlur}
            />

            <IssueAcceptanceCriteriaSection
              draft={draft}
              isNew={isNew}
              newCriterion={newCriterion}
              t={t}
              onSetNewCriterion={setNewCriterion}
              onAddCriterion={handleAddCriterion}
              onToggleCriterion={handleToggleCriterion}
              onUpdateCriterionText={handleUpdateCriterionText}
              onPersistDraftOnBlur={persistDraftOnBlur}
              onDeleteCriterion={handleDeleteCriterion}
            />

            <IssueSubtasksAndTimeSection
              draft={draft}
              assigneeOptions={assigneeOptions}
              currentUser={currentUser}
              t={t}
              onPersistIfEditing={persistIfEditing}
              onSetDraft={setDraft}
              onPersistDraftOnBlur={persistDraftOnBlur}
            />

            <IssueAttachmentsSection
              draft={draft}
              t={t}
              onPersistIfEditing={persistIfEditing}
            />

            <IssueCommentsSection
              draft={draft}
              currentUser={currentUser}
              commentText={commentText}
              t={t}
              onSetCommentText={setCommentText}
              onPostComment={handlePostComment}
              onDeleteComment={handleDeleteComment}
            />
          </div>

          {/* Right Column: Structured Agile Metadata Sidebar */}
          <IssueMetadataSidebar
            draft={draft}
            epics={epics}
            sprints={sprints}
            releases={releases}
            assigneeOptions={assigneeOptions}
            candidateBlockers={candidateBlockers}
            currentUser={currentUser}
            suggestedBranch={suggestedBranch}
            newLabel={newLabel}
            newBlocker={newBlocker}
            copiedBranch={copiedBranch}
            t={t}
            onPersistIfEditing={persistIfEditing}
            onSetDraft={setDraft}
            onPersistDraftOnBlur={persistDraftOnBlur}
            onSetNewLabel={setNewLabel}
            onAddLabel={handleAddLabel}
            onRemoveLabel={handleRemoveLabel}
            onSetNewBlocker={setNewBlocker}
            onAddBlocker={handleAddBlocker}
            onRemoveBlocker={handleRemoveBlocker}
            onCopyBranchCmd={handleCopyBranchCmd}
          />
        </div>
      </div>
    </div>
  );
}

export default IssueDrawer;
