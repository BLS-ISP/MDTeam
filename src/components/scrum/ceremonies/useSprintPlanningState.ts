"use client";

import { useState, useEffect, useMemo } from "react";
import {
  type AgileIssue,
  type AgileSprint,
  type WorkspaceFile,
  parseCapacityAndVelocity,
  serializeSprintToMarkdown,
} from "../../../utils/issueEngine";
import type {
  CeremonySubtaskItem,
  ScrumPolicyConfig,
  ScrumUserRole,
} from "../../../types/scrumPolicy";
import {
  appendOverrideAuditComment,
  evaluatePullIntoSprint,
  evaluateStartSprint,
  parseScrumPolicy,
} from "../../../utils/scrum-rules/scrumPolicyEngine";
import {
  getIssueSubtasks,
  serializeIssueWithCeremonyData,
  withIssueSubtasks,
} from "../../../utils/scrum-rules/ceremonyIssueHelpers";

export function buildDefaultSprintDraft(sprints: AgileSprint[], durationDays: number): AgileSprint {
  const existing =
    sprints.find((s) => s.state === "planned") || sprints.find((s) => s.state === "active");
  if (existing) return { ...existing };

  const num = sprints.length + 1;
  const id = `sprint-${String(num).padStart(2, "0")}`;
  const todayMs = Date.now();
  const startDate = new Date(todayMs).toISOString().slice(0, 10);
  const endDate = new Date(todayMs + Math.max(1, durationDays - 1) * 86400000)
    .toISOString()
    .slice(0, 10);
  return {
    id,
    name: `Sprint ${String(num).padStart(2, "0")}`,
    goal: "",
    startDate,
    endDate,
    state: "planned",
    committedPoints: 0,
    filePath: `sprints/${id}.md`,
  };
}

export interface UseSprintPlanningParams {
  isOpen: boolean;
  onClose: () => void;
  files: WorkspaceFile[];
  issues: AgileIssue[];
  sprints: AgileSprint[];
  policyProp?: ScrumPolicyConfig;
  currentUser: string;
  userRole?: ScrumUserRole;
  language: "de" | "en";
  onUpsertFile: (file: WorkspaceFile) => void;
  onUpsertMultipleFiles?: (files: WorkspaceFile[]) => void;
}

export function useSprintPlanningState({
  isOpen,
  onClose,
  files,
  issues,
  sprints,
  policyProp,
  currentUser,
  userRole,
  language,
  onUpsertFile,
  onUpsertMultipleFiles,
}: UseSprintPlanningParams) {
  const effectivePolicy = useMemo(() => policyProp || parseScrumPolicy(files), [policyProp, files]);
  const roleKey = userRole || currentUser;
  const { capacity, velocity, totalCapacitySp } = useMemo(
    () => parseCapacityAndVelocity(files),
    [files]
  );

  const avgVelocitySp = useMemo(() => {
    if (velocity.length > 0) {
      return velocity.reduce((acc, v) => acc + v.actual, 0) / velocity.length;
    }
    const closed = sprints.filter((s) => s.state === "closed" && typeof s.completedPoints === "number");
    if (closed.length > 0) {
      return closed.reduce((acc, s) => acc + (s.completedPoints || 0), 0) / closed.length;
    }
    return totalCapacitySp || 0;
  }, [velocity, sprints, totalCapacitySp]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draftSprint, setDraftSprint] = useState<AgileSprint>(() =>
    buildDefaultSprintDraft(sprints, effectivePolicy.sprintDurationDays)
  );
  const [workingIssues, setWorkingIssues] = useState<AgileIssue[]>(issues);
  const [subtaskMap, setSubtaskMap] = useState<Record<string, CeremonySubtaskItem[]>>({});
  const [newSubtaskTitles, setNewSubtaskTitles] = useState<Record<string, string>>({});
  const [newSubtaskHours, setNewSubtaskHours] = useState<Record<string, string>>({});
  const [newSubtaskAssignees, setNewSubtaskAssignees] = useState<Record<string, string>>({});
  const [pendingOverrideIssueId, setPendingOverrideIssueId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [startGateOverrideOpen, setStartGateOverrideOpen] = useState(false);
  const [startGateReason, setStartGateReason] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setDraftSprint(buildDefaultSprintDraft(sprints, effectivePolicy.sprintDurationDays));
    setWorkingIssues(issues);
    const map: Record<string, CeremonySubtaskItem[]> = {};
    for (const iss of issues) map[iss.id] = getIssueSubtasks(iss, files);
    setSubtaskMap(map);
    setPendingOverrideIssueId(null);
    setOverrideReason("");
    setStartGateOverrideOpen(false);
    setStartGateReason("");
  }, [isOpen, sprints, issues, files, effectivePolicy.sprintDurationDays]);

  const selectedIssues = workingIssues.filter(
    (i) => i.type !== "epic" && i.sprint.toLowerCase() === draftSprint.id.toLowerCase()
  );
  const backlogCandidates = workingIssues.filter(
    (i) => i.type !== "epic" && !i.sprint && i.status !== "done"
  );
  const selectedSp = selectedIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
  const startGate = evaluateStartSprint(draftSprint, selectedIssues, effectivePolicy, roleKey, language);

  const handleSelectTargetSprintId = (sprintId: string) => {
    const found = sprints.find((s) => s.id === sprintId);
    if (found) setDraftSprint({ ...found });
  };

  const handleUpdateSprintField = (patch: Partial<AgileSprint>) => {
    setDraftSprint((prev) => {
      const next = { ...prev, ...patch };
      if (patch.startDate && !patch.endDate) {
        const ms = Date.parse(patch.startDate);
        if (Number.isFinite(ms)) {
          next.endDate = new Date(ms + Math.max(1, effectivePolicy.sprintDurationDays - 1) * 86400000)
            .toISOString()
            .slice(0, 10);
        }
      }
      return next;
    });
  };

  const handlePullIssue = (issue: AgileIssue) => {
    const gate = evaluatePullIntoSprint(issue, draftSprint, effectivePolicy, roleKey, workingIssues, language);
    if (!gate.allowed) {
      if (gate.canOverrideWithReason) {
        setPendingOverrideIssueId(issue.id);
        setOverrideReason("");
      }
      return;
    }
    setWorkingIssues((prev) =>
      prev.map((item) =>
        item.id === issue.id
          ? { ...item, sprint: draftSprint.id, status: item.status === "backlog" ? "ready" : item.status }
          : item
      )
    );
  };

  const handleConfirmOverridePull = (issue: AgileIssue) => {
    const audited = appendOverrideAuditComment(issue, currentUser, "DOR_PULL_SPRINT", overrideReason);
    setWorkingIssues((prev) =>
      prev.map((item) =>
        item.id === issue.id
          ? { ...audited, sprint: draftSprint.id, status: item.status === "backlog" ? "ready" : item.status }
          : item
      )
    );
    setPendingOverrideIssueId(null);
    setOverrideReason("");
  };

  const handleRemoveIssueFromSprint = (issueId: string) => {
    setWorkingIssues((prev) =>
      prev.map((item) =>
        item.id === issueId
          ? { ...item, sprint: "", status: item.status === "ready" ? "backlog" : item.status }
          : item
      )
    );
  };

  const handleAddSubtask = (issueId: string) => {
    const title = (newSubtaskTitles[issueId] || "").trim();
    if (!title) return;
    const current = subtaskMap[issueId] || [];
    const hrsRaw = parseFloat(newSubtaskHours[issueId] || "");
    const hrs = Number.isFinite(hrsRaw) && hrsRaw >= 0 ? hrsRaw : undefined;
    const assignee = (newSubtaskAssignees[issueId] || "").trim() || undefined;
    setSubtaskMap((prev) => ({
      ...prev,
      [issueId]: [
        ...current,
        { id: `SUB-${current.length + 1}`, title, done: false, assignee, estimatedHours: hrs, remainingHours: hrs },
      ],
    }));
    setNewSubtaskTitles((prev) => ({ ...prev, [issueId]: "" }));
    setNewSubtaskHours((prev) => ({ ...prev, [issueId]: "" }));
  };

  const handleToggleSubtask = (issueId: string, subtaskId: string) => {
    setSubtaskMap((prev) => ({
      ...prev,
      [issueId]: (prev[issueId] || []).map((s) =>
        s.id === subtaskId ? { ...s, done: !s.done, remainingHours: !s.done ? 0 : s.estimatedHours } : s
      ),
    }));
  };

  const handleDeleteSubtask = (issueId: string, subtaskId: string) => {
    setSubtaskMap((prev) => ({
      ...prev,
      [issueId]: (prev[issueId] || []).filter((s) => s.id !== subtaskId),
    }));
  };

  const finalizePlanning = (activateSprint: boolean, startOverrideReason?: string) => {
    const nowIso = new Date().toISOString();
    const batch: WorkspaceFile[] = [
      serializeSprintToMarkdown({
        ...draftSprint,
        state: activateSprint ? "active" : draftSprint.state,
        committedPoints: selectedSp,
      }),
    ];

    let auditAttached = false;
    for (const nextIss of workingIssues) {
      const orig = issues.find((x) => x.id === nextIss.id);
      const nextSubs = subtaskMap[nextIss.id] || [];
      const origSubs = orig ? getIssueSubtasks(orig, files) : [];
      const changed =
        !orig ||
        orig.sprint !== nextIss.sprint ||
        orig.status !== nextIss.status ||
        orig.comments.length !== nextIss.comments.length ||
        JSON.stringify(origSubs) !== JSON.stringify(nextSubs);

      if (changed || (startOverrideReason && !auditAttached && nextIss.sprint === draftSprint.id)) {
        let enriched = withIssueSubtasks({ ...nextIss, updatedAt: nowIso }, nextSubs);
        if (startOverrideReason && !auditAttached && nextIss.sprint === draftSprint.id) {
          enriched = appendOverrideAuditComment(enriched, currentUser, "SPRINT_START_GATE", startOverrideReason);
          auditAttached = true;
        }
        batch.push(serializeIssueWithCeremonyData(enriched, files));
      }
    }

    if (onUpsertMultipleFiles) onUpsertMultipleFiles(batch);
    else batch.forEach((f) => onUpsertFile(f));
    onClose();
  };

  return {
    effectivePolicy,
    roleKey,
    capacity,
    totalCapacitySp,
    avgVelocitySp,
    step,
    setStep,
    draftSprint,
    workingIssues,
    selectedIssues,
    backlogCandidates,
    selectedSp,
    startGate,
    subtaskMap,
    newSubtaskTitles,
    setNewSubtaskTitles,
    newSubtaskHours,
    setNewSubtaskHours,
    newSubtaskAssignees,
    setNewSubtaskAssignees,
    pendingOverrideIssueId,
    setPendingOverrideIssueId,
    overrideReason,
    setOverrideReason,
    startGateOverrideOpen,
    setStartGateOverrideOpen,
    startGateReason,
    setStartGateReason,
    handleSelectTargetSprintId,
    handleUpdateSprintField,
    handlePullIssue,
    handleConfirmOverridePull,
    handleRemoveIssueFromSprint,
    handleAddSubtask,
    handleToggleSubtask,
    handleDeleteSubtask,
    finalizePlanning,
  };
}
