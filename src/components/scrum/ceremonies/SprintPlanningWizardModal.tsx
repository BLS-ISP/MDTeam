"use client";

import React from "react";
import { CalendarRange, Rocket, Save, X, AlertTriangle } from "lucide-react";
import type { AgileIssue, AgileSprint, WorkspaceFile } from "../../../utils/issueEngine";
import type { ScrumPolicyConfig, ScrumUserRole } from "../../../types/scrumPolicy";
import { evaluatePullIntoSprint } from "../../../utils/scrum-rules/scrumPolicyEngine";
import { ceremoniesCopy } from "./ceremoniesI18n";
import { SprintPlanningStepsView } from "./SprintPlanningStepsView";
import { useSprintPlanningState } from "./useSprintPlanningState";

export interface SprintPlanningWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: WorkspaceFile[];
  issues: AgileIssue[];
  sprints: AgileSprint[];
  policy?: ScrumPolicyConfig;
  currentUser: string;
  userRole?: ScrumUserRole;
  language: "de" | "en";
  onUpsertFile: (file: WorkspaceFile) => void;
  onUpsertMultipleFiles?: (files: WorkspaceFile[]) => void;
  onOpenIssueToFix?: (issue: AgileIssue) => void;
}

export function SprintPlanningWizardModal({
  isOpen,
  onClose,
  files,
  issues,
  sprints,
  policy: policyProp,
  currentUser,
  userRole,
  language,
  onUpsertFile,
  onUpsertMultipleFiles,
  onOpenIssueToFix,
}: SprintPlanningWizardModalProps) {
  const t = ceremoniesCopy[language] || ceremoniesCopy.de;
  const st = useSprintPlanningState({
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
  });

  if (!isOpen) return null;

  const { step, setStep, startGate } = st;
  const hardBlockedStart = !startGate.allowed && !startGate.canOverrideWithReason;

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
        if (e.target === e.currentTarget) onClose();
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
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: 700 }}>
              <CalendarRange size={18} style={{ color: "var(--accent-indigo)" }} />
              {t.planning.title}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(
              [
                [1, t.planning.step1Tab],
                [2, t.planning.step2Tab],
                [3, t.planning.step3Tab],
              ] as const
            ).map(([num, label]) => (
              <button
                key={num}
                type="button"
                onClick={() => setStep(num)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: step === num ? "1px solid var(--accent-indigo)" : "1px solid var(--border-color)",
                  backgroundColor: step === num ? "rgba(99, 102, 241, 0.16)" : "var(--bg-sidebar)",
                  color: step === num ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: step === num ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
          <SprintPlanningStepsView
            step={step}
            t={t}
            policy={st.effectivePolicy}
            sprints={sprints}
            draftSprint={st.draftSprint}
            capacity={st.capacity}
            totalCapacitySp={st.totalCapacitySp}
            avgVelocitySp={st.avgVelocitySp}
            selectedIssues={st.selectedIssues}
            backlogCandidates={st.backlogCandidates}
            selectedSp={st.selectedSp}
            pendingOverrideIssueId={st.pendingOverrideIssueId}
            overrideReason={st.overrideReason}
            subtaskMap={st.subtaskMap}
            newSubtaskTitles={st.newSubtaskTitles}
            newSubtaskHours={st.newSubtaskHours}
            newSubtaskAssignees={st.newSubtaskAssignees}
            evaluateDor={(iss) =>
              evaluatePullIntoSprint(
                iss,
                st.draftSprint,
                st.effectivePolicy,
                st.roleKey,
                st.workingIssues,
                language
              )
            }
            onSelectTargetSprintId={st.handleSelectTargetSprintId}
            onUpdateSprintField={st.handleUpdateSprintField}
            onPullIssue={st.handlePullIssue}
            onConfirmOverridePull={st.handleConfirmOverridePull}
            onCancelOverridePull={() => st.setPendingOverrideIssueId(null)}
            onSetOverrideReason={st.setOverrideReason}
            onRemoveIssueFromSprint={st.handleRemoveIssueFromSprint}
            onOpenIssueToFix={onOpenIssueToFix}
            onSetNewSubtaskTitle={(id, v) => st.setNewSubtaskTitles((p) => ({ ...p, [id]: v }))}
            onSetNewSubtaskHours={(id, v) => st.setNewSubtaskHours((p) => ({ ...p, [id]: v }))}
            onSetNewSubtaskAssignee={(id, v) => st.setNewSubtaskAssignees((p) => ({ ...p, [id]: v }))}
            onAddSubtask={st.handleAddSubtask}
            onToggleSubtask={st.handleToggleSubtask}
            onDeleteSubtask={st.handleDeleteSubtask}
          />

          {step === 3 && !startGate.allowed && (
            <div
              style={{
                marginTop: "14px",
                padding: "10px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                fontSize: "12px",
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--accent-red)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <AlertTriangle size={14} />
                {startGate.title}
              </div>
              <div>{startGate.violations.join(" • ")}</div>
              {st.startGateOverrideOpen && startGate.canOverrideWithReason && (
                <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                  <input
                    type="text"
                    value={st.startGateReason}
                    onChange={(e) => st.setStartGateReason(e.target.value)}
                    placeholder={t.gate.overridePlaceholder}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--bg-editor)",
                      color: "var(--text-primary)",
                      fontSize: "12px",
                    }}
                  />
                  <button
                    type="button"
                    disabled={st.startGateReason.trim().length < 5}
                    onClick={() => st.finalizePlanning(true, st.startGateReason.trim())}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: "var(--accent-yellow)",
                      color: "#111827",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {t.gate.overrideSubmitBtn}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-sidebar)",
              color: step === 1 ? "var(--text-muted)" : "var(--text-primary)",
              fontSize: "12px",
              cursor: step === 1 ? "default" : "pointer",
            }}
          >
            {t.planning.prevStep}
          </button>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => st.finalizePlanning(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
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
              <Save size={13} />
              {t.planning.saveDraftBtn}
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => ((s + 1) as 1 | 2 | 3))}
                style={{
                  padding: "7px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "var(--accent-indigo)",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t.planning.nextStep}
              </button>
            ) : (
              <button
                type="button"
                disabled={hardBlockedStart}
                onClick={() => {
                  if (startGate.allowed) st.finalizePlanning(true);
                  else if (startGate.canOverrideWithReason) st.setStartGateOverrideOpen(true);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: hardBlockedStart ? "var(--bg-active)" : "var(--accent-green)",
                  color: hardBlockedStart ? "var(--text-muted)" : "#fff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: hardBlockedStart ? "not-allowed" : "pointer",
                }}
              >
                <Rocket size={14} />
                {t.planning.startSprintCta}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SprintPlanningWizardModal;
