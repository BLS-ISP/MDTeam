"use client";

import React from "react";
import type { AgileIssue, AgileSprint, WorkspaceFile } from "../../utils/issueEngine";
import type {
  ScrumCeremonyId,
  ScrumPolicyConfig,
  ScrumUserRole,
} from "../../types/scrumPolicy";
import {
  DailyScrumWalkModal,
  ScrumGateModal,
  SprintPlanningWizardModal,
  SprintRetroWizardModal,
  SprintReviewModal,
} from "./ceremonies";
import type { GatePromptState } from "./useScrumPolicyGates";

export interface ScrumCeremoniesHostProps {
  files: WorkspaceFile[];
  allIssues: AgileIssue[];
  sprints: AgileSprint[];
  activeSprint?: AgileSprint;
  policy: ScrumPolicyConfig;
  currentUser: string;
  userRole?: ScrumUserRole;
  language: "de" | "en";
  activeCeremony: ScrumCeremonyId | null;
  gatePrompt: GatePromptState | null;
  onCloseCeremony: () => void;
  onCloseGatePrompt: () => void;
  onOpenIssue: (issue: AgileIssue) => void;
  onUpsertFile: (file: WorkspaceFile) => void;
  onUpsertMultipleFiles?: (files: WorkspaceFile[]) => void;
}

export function ScrumCeremoniesHost({
  files,
  allIssues,
  sprints,
  activeSprint,
  policy,
  currentUser,
  userRole,
  language,
  activeCeremony,
  gatePrompt,
  onCloseCeremony,
  onCloseGatePrompt,
  onOpenIssue,
  onUpsertFile,
  onUpsertMultipleFiles,
}: ScrumCeremoniesHostProps) {
  return (
    <>
      <ScrumGateModal
        isOpen={Boolean(gatePrompt)}
        gateResult={gatePrompt?.gateResult || null}
        mode={policy.mode}
        issue={gatePrompt?.issue || null}
        currentUser={currentUser}
        language={language}
        onClose={onCloseGatePrompt}
        onOpenIssueToFix={
          gatePrompt?.issue
            ? (iss) => {
                onCloseGatePrompt();
                onOpenIssue(iss);
              }
            : undefined
        }
        onOverrideWithReason={gatePrompt?.onOverride}
      />

      <SprintPlanningWizardModal
        isOpen={activeCeremony === "planning"}
        onClose={onCloseCeremony}
        files={files}
        issues={allIssues}
        sprints={sprints}
        policy={policy}
        currentUser={currentUser}
        userRole={userRole}
        language={language}
        onUpsertFile={onUpsertFile}
        onUpsertMultipleFiles={onUpsertMultipleFiles}
        onOpenIssueToFix={(iss) => {
          onCloseCeremony();
          onOpenIssue(iss);
        }}
      />

      <DailyScrumWalkModal
        isOpen={activeCeremony === "daily"}
        onClose={onCloseCeremony}
        files={files}
        issues={allIssues}
        activeSprint={activeSprint}
        currentUser={currentUser}
        language={language}
        onUpsertFile={onUpsertFile}
        onOpenIssue={(iss) => {
          onCloseCeremony();
          onOpenIssue(iss);
        }}
      />

      <SprintReviewModal
        isOpen={activeCeremony === "review"}
        onClose={onCloseCeremony}
        files={files}
        issues={allIssues}
        activeSprint={activeSprint}
        policy={policy}
        currentUser={currentUser}
        userRole={userRole}
        language={language}
        onUpsertFile={onUpsertFile}
      />

      <SprintRetroWizardModal
        isOpen={activeCeremony === "retro"}
        onClose={onCloseCeremony}
        files={files}
        issues={allIssues}
        sprints={sprints}
        activeSprint={activeSprint}
        policy={policy}
        currentUser={currentUser}
        language={language}
        onUpsertFile={onUpsertFile}
        onUpsertMultipleFiles={onUpsertMultipleFiles}
        onOpenIssue={(iss) => {
          onCloseCeremony();
          onOpenIssue(iss);
        }}
      />
    </>
  );
}
