"use client";

import { useMemo, useState } from "react";
import type { AgileIssue, AgileSprint, WorkspaceFile } from "../../utils/issueEngine";
import type {
  GateCheckResult,
  ScrumCeremonyId,
  ScrumPolicyConfig,
  ScrumUserRole,
} from "../../types/scrumPolicy";
import {
  appendOverrideAuditComment,
  evaluateBacklogReorder,
  evaluateMoveToDone,
  evaluatePullIntoSprint,
  evaluateStartSprint,
  normalizeScrumRole,
  parseScrumPolicy,
  serializeScrumPolicyToMarkdown,
} from "../../utils/scrum-rules/scrumPolicyEngine";

export const BACKLOG_ORDER_FILE_PATH = ".mdteam/backlog-order.json";

export interface GatePromptState {
  gateResult: GateCheckResult;
  issue: AgileIssue | null;
  onOverride?: (reason: string) => void;
}

export interface UseScrumPolicyGatesParams {
  files: WorkspaceFile[];
  allIssues: AgileIssue[];
  sprints: AgileSprint[];
  currentUser: string;
  userRole?: ScrumUserRole;
  language: "de" | "en";
  rawSaveIssue: (issue: AgileIssue) => void;
  rawStartSprint: (sprint: AgileSprint) => void;
  onUpsertFile: (file: WorkspaceFile) => void;
  onShowToast: (msg: string) => void;
}

function readBacklogOrderIds(files: WorkspaceFile[]): string[] {
  const found = files.find((f) => f.path.replace(/\\/g, "/") === BACKLOG_ORDER_FILE_PATH);
  if (!found?.content) return [];
  try {
    const parsed = JSON.parse(found.content);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
  } catch {
    // ignore malformed json
  }
  return [];
}

function serializeBacklogOrderFile(ids: string[]): WorkspaceFile {
  return {
    path: BACKLOG_ORDER_FILE_PATH,
    name: "backlog-order.json",
    category: ".mdteam",
    content: JSON.stringify(ids, null, 2) + "\n",
  };
}

export function useScrumPolicyGates({
  files,
  allIssues,
  sprints,
  currentUser,
  userRole,
  language,
  rawSaveIssue,
  rawStartSprint,
  onUpsertFile,
  onShowToast,
}: UseScrumPolicyGatesParams) {
  const policy = useMemo(() => parseScrumPolicy(files), [files]);
  const [activeCeremony, setActiveCeremony] = useState<ScrumCeremonyId | null>(null);
  const [gatePrompt, setGatePrompt] = useState<GatePromptState | null>(null);

  const orderedBacklogItems = useMemo(() => {
    const rawBacklog = allIssues.filter((i) => !i.sprint && i.type !== "epic");
    const orderIds = readBacklogOrderIds(files);
    if (orderIds.length === 0) return rawBacklog;
    const rankMap = new Map<string, number>();
    orderIds.forEach((id, idx) => rankMap.set(id.toUpperCase(), idx));
    return [...rawBacklog].sort((a, b) => {
      const ra = rankMap.get(a.id.toUpperCase());
      const rb = rankMap.get(b.id.toUpperCase());
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return 0;
    });
  }, [allIssues, files]);

  const handleUpdatePolicy = (nextPolicy: ScrumPolicyConfig) => {
    onUpsertFile(serializeScrumPolicyToMarkdown(nextPolicy));
    onShowToast(
      language === "en"
        ? `Scrum Policy updated (${nextPolicy.mode.toUpperCase()})`
        : `Scrum-Regelwerk gespeichert (${nextPolicy.mode.toUpperCase()})`
    );
  };

  const handleGatedSaveIssue = (updated: AgileIssue) => {
    const prev = allIssues.find((i) => i.id === updated.id);
    const prevSprint = (prev?.sprint || "").trim();
    const nextSprint = (updated.sprint || "").trim();

    // 1. Definition of Ready (DoR) gate when pulling an issue into a Sprint
    if (nextSprint && nextSprint.toLowerCase() !== prevSprint.toLowerCase()) {
      const targetSprint = sprints.find((s) => s.id.toLowerCase() === nextSprint.toLowerCase());
      const pullCheck = evaluatePullIntoSprint(
        updated,
        targetSprint,
        policy,
        userRole,
        allIssues,
        language
      );
      if (!pullCheck.allowed) {
        setGatePrompt({
          gateResult: pullCheck,
          issue: updated,
          onOverride:
            pullCheck.canOverrideWithReason && policy.mode !== "strict"
              ? (reason) => {
                  const audited = appendOverrideAuditComment(
                    updated,
                    currentUser,
                    pullCheck.ruleCode,
                    reason
                  );
                  rawSaveIssue(audited);
                  setGatePrompt(null);
                }
              : undefined,
        });
        return;
      }
    }

    // 2. Definition of Done (DoD) gate checking Acceptance Criteria, Subtasks & Blockers
    if (updated.status === "done" && prev?.status !== "done") {
      if (normalizeScrumRole(userRole) === "stakeholder") {
        setGatePrompt({
          gateResult: {
            allowed: false,
            canOverrideWithReason: false,
            ruleCode: "STAKEHOLDER_READONLY",
            title: language === "en" ? "Read-Only Role" : "Schreibgeschützte Rolle",
            violations: [
              language === "en"
                ? "Stakeholders cannot change issue workflow status."
                : "Stakeholder können den Ticket-Status nicht ändern.",
            ],
          },
          issue: updated,
        });
        return;
      }
      const dodCheck = evaluateMoveToDone(updated, policy, language);
      if (!dodCheck.allowed) {
        setGatePrompt({
          gateResult: dodCheck,
          issue: updated,
          onOverride:
            dodCheck.canOverrideWithReason && policy.mode !== "strict"
              ? (reason) => {
                  const audited = appendOverrideAuditComment(
                    updated,
                    currentUser,
                    dodCheck.ruleCode,
                    reason
                  );
                  rawSaveIssue(audited);
                  setGatePrompt(null);
                }
              : undefined,
        });
        return;
      }
    }

    rawSaveIssue(updated);
  };

  const handleGatedStartSprint = (sprint: AgileSprint) => {
    const sprintIssues = allIssues.filter(
      (i) => i.sprint.toLowerCase() === sprint.id.toLowerCase() && i.type !== "epic"
    );
    const startCheck = evaluateStartSprint(sprint, sprintIssues, policy, userRole, language);
    if (!startCheck.allowed) {
      const firstIssue = sprintIssues[0] || null;
      setGatePrompt({
        gateResult: startCheck,
        issue: firstIssue,
        onOverride:
          startCheck.canOverrideWithReason && policy.mode !== "strict"
            ? (reason) => {
                if (firstIssue) {
                  rawSaveIssue(
                    appendOverrideAuditComment(firstIssue, currentUser, startCheck.ruleCode, reason)
                  );
                }
                rawStartSprint(sprint);
                setGatePrompt(null);
              }
            : undefined,
      });
      return;
    }
    rawStartSprint(sprint);
  };

  const applyBacklogReorder = (sourceId: string, targetId: string) => {
    const ids = orderedBacklogItems.map((i) => i.id);
    const fromIdx = ids.findIndex((x) => x === sourceId);
    const toIdx = ids.findIndex((x) => x === targetId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const nextIds = [...ids];
    const [moved] = nextIds.splice(fromIdx, 1);
    nextIds.splice(toIdx, 0, moved);
    onUpsertFile(serializeBacklogOrderFile(nextIds));
  };

  const handleGatedReorderBacklog = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const check = evaluateBacklogReorder(policy, userRole, language);
    if (!check.allowed) {
      const sourceIssue = allIssues.find((i) => i.id === sourceId) || null;
      setGatePrompt({
        gateResult: check,
        issue: sourceIssue,
        onOverride:
          check.canOverrideWithReason && policy.mode !== "strict"
            ? (reason) => {
                if (sourceIssue) {
                  rawSaveIssue(
                    appendOverrideAuditComment(sourceIssue, currentUser, check.ruleCode, reason)
                  );
                }
                applyBacklogReorder(sourceId, targetId);
                setGatePrompt(null);
              }
            : undefined,
      });
      return;
    }
    applyBacklogReorder(sourceId, targetId);
  };

  return {
    policy,
    orderedBacklogItems,
    activeCeremony,
    setActiveCeremony,
    gatePrompt,
    setGatePrompt,
    handleUpdatePolicy,
    handleGatedSaveIssue,
    handleGatedStartSprint,
    handleGatedReorderBacklog,
  };
}
