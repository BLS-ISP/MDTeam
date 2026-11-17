"use client";

import {
  WorkspaceFile,
  AgileIssue,
  AgileSprint,
  serializeIssueToMarkdown,
  serializeSprintToMarkdown,
  migrateLegacyBacklogToIssues,
  generateNextIssueId,
  appendCompletedSprintToCapacity,
} from "../../utils/issueEngine";
import {
  computeStrictSprintVelocity,
  evaluateStrictSprintVelocityBreakdown,
} from "../../utils/scrum-rules/scrumPolicyEngine";
import type { ScrumPolicyConfig } from "../../types/scrumPolicy";
import { ScrumCopy } from "./scrumI18nAndStyles";

export interface UseScrumSprintActionsParams {
  files: WorkspaceFile[];
  allIssues: AgileIssue[];
  sprints: AgileSprint[];
  policy?: ScrumPolicyConfig;
  language: "de" | "en";
  t: ScrumCopy;
  drawerIssue: AgileIssue | null;
  onUpsertFile: (file: WorkspaceFile) => void;
  onUpsertMultipleFiles?: (files: WorkspaceFile[]) => void;
  onDeleteFile?: (path: string) => void;
  onSetDrawerIssue: (issue: AgileIssue | null) => void;
  onSetDrawerIsNew: (isNew: boolean) => void;
  onShowToast: (msg: string) => void;
}

export function useScrumSprintActions({
  files,
  allIssues,
  sprints,
  policy,
  language,
  t,
  drawerIssue,
  onUpsertFile,
  onUpsertMultipleFiles,
  onDeleteFile,
  onSetDrawerIssue,
  onSetDrawerIsNew,
  onShowToast,
}: UseScrumSprintActionsParams) {
  const upsertBatch = (batch: WorkspaceFile[]) => {
    if (batch.length === 0) return;
    if (onUpsertMultipleFiles) {
      onUpsertMultipleFiles(batch);
    } else {
      batch.forEach((f) => onUpsertFile(f));
    }
  };

  const handleSaveIssue = (updated: AgileIssue) => {
    let toPersist = { ...updated, updatedAt: new Date().toISOString() };
    if (toPersist.isVirtualLegacy || toPersist.id.startsWith("LEGACY-")) {
      const nextId = generateNextIssueId(files, "MDT");
      toPersist = {
        ...toPersist,
        id: nextId,
        filePath: `issues/${nextId}.md`,
        isVirtualLegacy: false,
      };
    }
    const serialized = serializeIssueToMarkdown(toPersist);
    onUpsertFile(serialized);
    if (drawerIssue && (drawerIssue.id === updated.id || drawerIssue.id === toPersist.id)) {
      onSetDrawerIssue(toPersist);
      onSetDrawerIsNew(false);
    }
  };

  const handleDeleteIssue = (issue: AgileIssue) => {
    if (!issue.isVirtualLegacy && onDeleteFile) {
      onDeleteFile(issue.filePath);
    }
  };

  const handleCreateNewSprint = () => {
    const num = sprints.length + 1;
    const id = `sprint-${String(num).padStart(2, "0")}`;
    const lastEnd = sprints[sprints.length - 1]?.endDate || "2026-06-14";
    const startMs = Date.parse(lastEnd) + 24 * 60 * 60 * 1000;
    const safeStartMs = Number.isFinite(startMs) ? startMs : Date.now();
    const durationDays = Math.max(1, Math.min(31, policy?.sprintDurationDays || 14));
    const startDate = new Date(safeStartMs).toISOString().slice(0, 10);
    const endDate = new Date(safeStartMs + (durationDays - 1) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const newSprint: AgileSprint = {
      id,
      name: `Sprint ${String(num).padStart(2, "0")}`,
      goal:
        language === "en"
          ? "Deliver prioritized backlog stories."
          : "Priorisierte User Stories liefern.",
      startDate,
      endDate,
      state: "planned",
      committedPoints: 0,
      filePath: `sprints/${id}.md`,
    };
    onUpsertFile(serializeSprintToMarkdown(newSprint));
  };

  const handleStartSprint = (sprint: AgileSprint) => {
    const sprintTickets = allIssues.filter(
      (i) => i.sprint.toLowerCase() === sprint.id.toLowerCase() && i.type !== "epic"
    );
    const sumSp = sprintTickets.reduce((s, i) => s + (i.storyPoints || 0), 0);
    const updatedSprint: AgileSprint = {
      ...sprint,
      state: "active",
      committedPoints: sumSp || sprint.committedPoints,
    };
    onUpsertFile(serializeSprintToMarkdown(updatedSprint));
  };

  const handleCompleteSprint = (sprint: AgileSprint) => {
    const sprintTickets = allIssues.filter(
      (i) => i.sprint.toLowerCase() === sprint.id.toLowerCase() && i.type !== "epic"
    );

    // Scrum Guide 0-SP-for-undone rule: only DoD-compliant Done items count toward velocity!
    const strictBreakdown = evaluateStrictSprintVelocityBreakdown(sprintTickets);
    const strictDoneSp = computeStrictSprintVelocity(sprintTickets);

    const plannedSp =
      sprint.committedPoints > 0
        ? sprint.committedPoints
        : sprintTickets.reduce((s, i) => s + (i.storyPoints || 0), 0);

    const nextPlanned = sprints.find(
      (s) => s.id !== sprint.id && s.state === "planned"
    );
    const rolloverSprintId = nextPlanned ? nextPlanned.id : "";

    const batch: WorkspaceFile[] = [];
    batch.push(
      serializeSprintToMarkdown({
        ...sprint,
        state: "closed",
        completedPoints: strictDoneSp,
      })
    );

    const nowIso = new Date().toISOString();
    for (const unfinished of strictBreakdown.unfinishedIssues) {
      if (!unfinished.isVirtualLegacy) {
        batch.push(
          serializeIssueToMarkdown({
            ...unfinished,
            sprint: rolloverSprintId,
            updatedAt: nowIso,
          })
        );
      }
    }
    for (const dodFailed of strictBreakdown.dodViolatingDoneIssues) {
      if (!dodFailed.isVirtualLegacy) {
        batch.push(
          serializeIssueToMarkdown({
            ...dodFailed,
            status: "review",
            sprint: rolloverSprintId,
            updatedAt: nowIso,
          })
        );
      }
    }

    batch.push(appendCompletedSprintToCapacity(files, sprint.name, plannedSp, strictDoneSp));

    upsertBatch(batch);
    const zeroedInfo =
      strictBreakdown.undonePointsZeroed > 0
        ? language === "en"
          ? ` (Velocity: ${strictDoneSp} SP • ${strictBreakdown.undonePointsZeroed} undone SP = 0)`
          : ` (Velocity: ${strictDoneSp} SP • ${strictBreakdown.undonePointsZeroed} unfertige SP = 0)`
        : ` (${strictDoneSp} SP)`;
    onShowToast(`${t.sprintCompletedToast}${zeroedInfo}`);
  };

  const handleConvertLegacyBacklog = () => {
    const migratedFiles = migrateLegacyBacklogToIssues(files, "MDT");
    if (migratedFiles.length === 0) {
      onShowToast(t.noLegacyToast);
      return;
    }
    upsertBatch(migratedFiles);
    onShowToast(t.legacyConvertedToast);
  };

  return {
    handleSaveIssue,
    handleDeleteIssue,
    handleCreateNewSprint,
    handleStartSprint,
    handleCompleteSprint,
    handleConvertLegacyBacklog,
  };
}
