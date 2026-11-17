"use client";

import React, { useState, useEffect, useMemo } from "react";
import { RotateCcw, ShieldAlert, CheckCircle2, Rocket, ExternalLink, X } from "lucide-react";
import {
  type AgileIssue,
  type AgileSprint,
  type WorkspaceFile,
  FIBONACCI_POINTS,
  createBlankIssue,
  serializeIssueToMarkdown,
  serializeSprintToMarkdown,
} from "../../../utils/issueEngine";
import type {
  RetroStickyCard,
  RetroStickyCategory,
  ScrumPolicyConfig,
} from "../../../types/scrumPolicy";
import {
  extractSprintOverrideAudits,
  parseScrumPolicy,
} from "../../../utils/scrum-rules/scrumPolicyEngine";
import {
  loadRetroStickies,
  serializeRetroStickiesFile,
} from "../../../utils/scrum-rules/ceremonyIssueHelpers";
import { ceremoniesCopy } from "./ceremoniesI18n";
import { RetroStickyBoardSection } from "./RetroStickyBoardSection";

export interface SprintRetroWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: WorkspaceFile[];
  issues: AgileIssue[];
  sprints: AgileSprint[];
  activeSprint?: AgileSprint;
  policy?: ScrumPolicyConfig;
  currentUser: string;
  language: "de" | "en";
  onUpsertFile: (file: WorkspaceFile) => void;
  onUpsertMultipleFiles?: (files: WorkspaceFile[]) => void;
  onOpenIssue?: (issue: AgileIssue) => void;
}

function resolveNextSprint(sprints: AgileSprint[], currentSprint?: AgileSprint, durationDays = 14): { sprint: AgileSprint; isNew: boolean } {
  const existingPlanned = sprints.find(
    (s) => s.state === "planned" && (!currentSprint || s.id !== currentSprint.id)
  );
  if (existingPlanned) return { sprint: existingPlanned, isNew: false };

  const num = sprints.length + 1;
  const id = `sprint-${String(num).padStart(2, "0")}`;
  const baseEnd = Date.parse(currentSprint?.endDate || "");
  const startMs = Number.isFinite(baseEnd) ? baseEnd + 86400000 : Date.now();
  const startDate = new Date(startMs).toISOString().slice(0, 10);
  const endDate = new Date(startMs + Math.max(1, durationDays - 1) * 86400000).toISOString().slice(0, 10);

  return {
    isNew: true,
    sprint: {
      id,
      name: `Sprint ${String(num).padStart(2, "0")}`,
      goal: "",
      startDate,
      endDate,
      state: "planned",
      committedPoints: 0,
      filePath: `sprints/${id}.md`,
    },
  };
}

export function SprintRetroWizardModal({
  isOpen,
  onClose,
  files,
  issues,
  sprints,
  activeSprint,
  policy: policyProp,
  currentUser,
  language,
  onUpsertFile,
  onUpsertMultipleFiles,
  onOpenIssue,
}: SprintRetroWizardModalProps) {
  const t = ceremoniesCopy[language] || ceremoniesCopy.de;
  const effectivePolicy = useMemo(() => policyProp || parseScrumPolicy(files), [policyProp, files]);
  const sprintKey = activeSprint?.id || "sprint-01";

  const [cards, setCards] = useState<RetroStickyCard[]>([]);
  const [actionTitle, setActionTitle] = useState("");
  const [actionAssignee, setActionAssignee] = useState(currentUser || "@scrum-master");
  const [actionPoints, setActionPoints] = useState<number>(2);
  const [committedIssueId, setCommittedIssueId] = useState<string | null>(null);

  const overrideAudits = useMemo(
    () => extractSprintOverrideAudits(issues, activeSprint?.id),
    [issues, activeSprint?.id]
  );

  const { sprint: nextSprint, isNew: nextSprintIsNew } = useMemo(
    () => resolveNextSprint(sprints, activeSprint, effectivePolicy.sprintDurationDays),
    [sprints, activeSprint, effectivePolicy.sprintDurationDays]
  );

  const existingRetroActionsInNext = useMemo(
    () =>
      (issues || []).filter(
        (i) =>
          i.sprint.toLowerCase() === nextSprint.id.toLowerCase() &&
          i.labels.some((l) => l.toLowerCase() === "retro-action")
      ),
    [issues, nextSprint.id]
  );

  useEffect(() => {
    if (!isOpen) return;
    setCards(loadRetroStickies(files, sprintKey));
    setActionAssignee(currentUser || "@scrum-master");
    setCommittedIssueId(null);
  }, [isOpen, files, sprintKey, currentUser]);

  if (!isOpen) return null;

  const syncCards = (next: RetroStickyCard[]) => {
    setCards(next);
    onUpsertFile(serializeRetroStickiesFile(sprintKey, next));
  };

  const handleAddCard = (category: RetroStickyCategory, text: string) => {
    const next: RetroStickyCard[] = [
      ...cards,
      {
        id: `RETRO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category,
        text,
        author: currentUser || "@team",
        votes: 1,
        voters: [currentUser || "@team"],
        createdAt: new Date().toISOString(),
      },
    ];
    syncCards(next);
    if (!actionTitle && category !== "glad") {
      setActionTitle(text);
    }
  };

  const handleVoteCard = (cardId: string) => {
    const next = cards.map((c) => {
      if (c.id !== cardId) return c;
      return {
        ...c,
        votes: c.votes + 1,
        voters: [...c.voters, currentUser || "@team"],
      };
    });
    syncCards(next);
  };

  const handleDeleteCard = (cardId: string) => {
    syncCards(cards.filter((c) => c.id !== cardId));
  };

  const handleCommitImprovementAction = () => {
    const cleanTitle = actionTitle.trim();
    if (!cleanTitle) return;

    const actionIssue = createBlankIssue(files, currentUser, {
      title: cleanTitle,
      type: "task",
      status: "ready",
      priority: "high",
      storyPoints: actionPoints,
      sprint: nextSprint.id,
      assignee: actionAssignee.trim() || currentUser || "@scrum-master",
      labels: ["retro-action"],
      description: `Continuous improvement action committed in Sprint Retrospective (${activeSprint?.name || sprintKey}).`,
      acceptanceCriteria: [
        { text: `Process improvement verified in ${nextSprint.name}`, checked: false },
      ],
    });

    const batch: WorkspaceFile[] = [];
    if (nextSprintIsNew) {
      batch.push(
        serializeSprintToMarkdown({
          ...nextSprint,
          committedPoints: actionPoints,
        })
      );
    }
    batch.push(serializeIssueToMarkdown(actionIssue));
    batch.push(serializeRetroStickiesFile(sprintKey, cards));

    const summaryLines = [
      `# Sprint Retrospective — ${activeSprint?.name || sprintKey}`,
      "",
      `## Glad`,
      ...cards.filter((c) => c.category === "glad").map((c) => `- (+${c.votes}) ${c.text} *(${c.author})*`),
      "",
      `## Sad`,
      ...cards.filter((c) => c.category === "sad").map((c) => `- (+${c.votes}) ${c.text} *(${c.author})*`),
      "",
      `## Impediments`,
      ...cards.filter((c) => c.category === "impediment").map((c) => `- (+${c.votes}) ${c.text} *(${c.author})*`),
      "",
      `## Committed Improvement Action`,
      `- [${actionIssue.id}](issues/${actionIssue.id}.md): ${actionIssue.title} → **${nextSprint.name}** (${actionIssue.assignee})`,
      "",
    ];
    batch.push({
      path: `meetings/retro-${sprintKey}.md`,
      name: `retro-${sprintKey}.md`,
      category: "meetings",
      content: summaryLines.join("\n"),
    });

    if (onUpsertMultipleFiles) onUpsertMultipleFiles(batch);
    else batch.forEach((f) => onUpsertFile(f));

    setCommittedIssueId(actionIssue.id);
    setActionTitle("");
  };

  const hasActionSatisfied =
    !effectivePolicy.requireRetroActionItem ||
    Boolean(committedIssueId) ||
    existingRetroActionsInNext.length > 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(3px)",
        zIndex: 170,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && hasActionSatisfied) onClose();
      }}
    >
      <div
        style={{
          width: "min(980px, 96vw)",
          maxHeight: "92vh",
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "14px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "var(--text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-panel)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: 700 }}>
            <RotateCcw size={18} style={{ color: "var(--accent-yellow)" }} />
            {t.retro.title} {activeSprint ? `— ${activeSprint.name}` : ""}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* 1. Glad / Sad / Impediment + Dot-Voting */}
          <RetroStickyBoardSection
            t={t}
            cards={cards}
            currentUser={currentUser}
            onAddCard={handleAddCard}
            onVoteCard={handleVoteCard}
            onDeleteCard={handleDeleteCard}
            onPickForAction={(txt) => setActionTitle(txt)}
          />

          {/* 2. [SCRUM-OVERRIDE] Transparency Review */}
          <div style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", color: overrideAudits.length > 0 ? "var(--accent-yellow)" : "var(--accent-green)" }}>
              {overrideAudits.length > 0 ? <ShieldAlert size={15} /> : <CheckCircle2 size={15} />}
              {t.retro.overridesSectionTitle} ({overrideAudits.length})
            </div>
            {overrideAudits.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{t.retro.noOverridesMsg}</div>
            ) : (
              overrideAudits.map((entry, idx) => {
                const targetIssue = issues.find((i) => i.id === entry.issueId);
                return (
                  <div key={idx} style={{ padding: "8px 10px", borderRadius: "6px", backgroundColor: "var(--bg-sidebar)", border: "1px solid rgba(245, 158, 11, 0.3)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                    <div>
                      <strong style={{ fontFamily: "var(--font-mono)", color: "var(--accent-yellow)" }}>
                        [{entry.ruleCode}] {entry.issueId}
                      </strong>{" "}
                      ({entry.author}): {entry.reason}
                    </div>
                    {targetIssue && onOpenIssue && (
                      <button
                        type="button"
                        onClick={() => onOpenIssue(targetIssue)}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderRadius: "5px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-panel)", color: "var(--text-secondary)", fontSize: "11px", cursor: "pointer" }}
                      >
                        <ExternalLink size={11} />
                        {entry.issueId}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 3. Required Final Step: Commit Improvement Action Item into Next Sprint */}
          <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: "var(--bg-panel)", border: `1px solid ${hasActionSatisfied ? "rgba(16, 185, 129, 0.4)" : "rgba(99, 102, 241, 0.5)"}`, display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent-indigo)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Rocket size={15} />
                {t.retro.actionSectionTitle}
              </span>
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-green)" }}>
                {t.retro.actionTargetSprint} <strong>{nextSprint.name}</strong> ({nextSprint.id})
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {t.retro.actionRequiredHint}
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                value={actionTitle}
                onChange={(e) => setActionTitle(e.target.value)}
                placeholder={t.retro.actionTitlePlaceholder}
                style={{ flex: "1 1 280px", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-editor)", color: "var(--text-primary)", fontSize: "12px" }}
              />
              <input
                type="text"
                value={actionAssignee}
                onChange={(e) => setActionAssignee(e.target.value)}
                placeholder="@assignee"
                style={{ width: "130px", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-editor)", color: "var(--text-primary)", fontSize: "12px" }}
              />
              <select
                value={actionPoints}
                onChange={(e) => setActionPoints(Number(e.target.value))}
                style={{ padding: "7px 9px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-editor)", color: "var(--text-primary)", fontSize: "12px" }}
              >
                {FIBONACCI_POINTS.filter((p) => p > 0 && p <= 8).map((p) => (
                  <option key={p} value={p}>
                    {p} SP
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!actionTitle.trim()}
                onClick={handleCommitImprovementAction}
                style={{ padding: "7px 14px", borderRadius: "6px", border: "none", backgroundColor: actionTitle.trim() ? "var(--accent-green)" : "var(--bg-active)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: actionTitle.trim() ? "pointer" : "not-allowed" }}
              >
                {t.retro.commitActionBtn}
              </button>
            </div>

            {committedIssueId && (
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent-green)", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={14} />
                {t.retro.committedSuccess} {committedIssueId} (labels: [&quot;retro-action&quot;], sprint: {nextSprint.id})
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SprintRetroWizardModal;
