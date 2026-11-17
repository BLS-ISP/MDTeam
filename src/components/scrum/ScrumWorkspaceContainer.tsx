"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  WorkspaceFile,
  AgileIssue,
  IssueStatus,
  extractAllIssues,
  parseSprints,
  computeSprintMetrics,
  createBlankIssue,
  parseCapacityAndVelocity,
  extractImpediments,
} from "../../utils/issueEngine";
import IssueDrawer from "../IssueDrawer";
import PlanningPokerModal from "../PlanningPokerModal";
import {
  DEFAULT_WIP_LIMITS,
  SwimlaneMode,
  scrumCopy,
} from "./scrumI18nAndStyles";
import { ScrumTabId, ScrumWorkspaceHeader } from "./ScrumWorkspaceHeader";
import { KanbanBoardTab } from "./KanbanBoardTab";
import { BacklogPlanningTab } from "./BacklogPlanningTab";
import { GanttRoadmapTab } from "./GanttRoadmapTab";
import { AgileMetricsTab } from "./AgileMetricsTab";
import { useScrumSprintActions } from "./useScrumSprintActions";

export interface ScrumWorkspaceProps {
  files: WorkspaceFile[];
  onUpsertFile: (file: WorkspaceFile) => void;
  onUpsertMultipleFiles?: (files: WorkspaceFile[]) => void;
  onDeleteFile?: (path: string) => void;
  onOpenFile: (path: string) => void;
  onCreateBranchFromIssue?: (issue: AgileIssue, branchName: string) => void;
  yjsUrl?: string;
  currentUser: string;
  language: "de" | "en";
  initialTab?: ScrumTabId;
}

export function ScrumWorkspace({
  files,
  onUpsertFile,
  onUpsertMultipleFiles,
  onDeleteFile,
  onOpenFile,
  onCreateBranchFromIssue,
  yjsUrl,
  currentUser,
  language,
  initialTab = "board",
}: ScrumWorkspaceProps) {
  const t = scrumCopy[language] || scrumCopy.de;
  const [activeTab, setActiveTab] = useState<ScrumTabId>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const allIssues = useMemo(() => extractAllIssues(files), [files]);
  const sprints = useMemo(() => parseSprints(files), [files]);
  const epics = useMemo(() => allIssues.filter((i) => i.type === "epic"), [allIssues]);
  const activeSprint = useMemo(
    () => sprints.find((s) => s.state === "active") || sprints[0],
    [sprints]
  );

  const { capacity, totalCapacitySp } = useMemo(
    () => parseCapacityAndVelocity(files),
    [files]
  );
  const impediments = useMemo(
    () => extractImpediments(files, allIssues),
    [files, allIssues]
  );
  const activeSprintMetrics = useMemo(
    () => computeSprintMetrics(allIssues, activeSprint),
    [allIssues, activeSprint]
  );
  const unmigratedLegacyCount = useMemo(
    () => allIssues.filter((i) => i.isVirtualLegacy).length,
    [allIssues]
  );

  // Board, Roadmap, Metrics & Modal states
  const [boardScope, setBoardScope] = useState<string>("active");
  const [jqlQuery, setJqlQuery] = useState<string>("");
  const [swimlaneMode, setSwimlaneMode] = useState<SwimlaneMode>("none");
  const [wipLimits, setWipLimits] = useState<Record<IssueStatus, number>>(DEFAULT_WIP_LIMITS);
  const [editingWipCol, setEditingWipCol] = useState<IssueStatus | null>(null);
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const [roadmapZoom, setRoadmapZoom] = useState<"month" | "quarter">("month");
  const [roadmapFilter, setRoadmapFilter] = useState<"all" | "epics" | "roadmap">("all");
  const [metricsSprintId, setMetricsSprintId] = useState<string>("active");

  const [drawerIssue, setDrawerIssue] = useState<AgileIssue | null>(null);
  const [drawerIsNew, setDrawerIsNew] = useState<boolean>(false);
  const [pokerOpen, setPokerOpen] = useState<boolean>(false);
  const [pokerIssueId, setPokerIssueId] = useState<string | undefined>(undefined);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("mdteam_wip_limits");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            setWipLimits({ ...DEFAULT_WIP_LIMITS, ...parsed });
          }
        }
      } catch {}
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const {
    handleSaveIssue,
    handleDeleteIssue,
    handleCreateNewSprint,
    handleStartSprint,
    handleCompleteSprint,
    handleConvertLegacyBacklog,
  } = useScrumSprintActions({
    files,
    allIssues,
    sprints,
    language,
    t,
    drawerIssue,
    onUpsertFile,
    onUpsertMultipleFiles,
    onDeleteFile,
    onSetDrawerIssue: setDrawerIssue,
    onSetDrawerIsNew: setDrawerIsNew,
    onShowToast: showToast,
  });

  const handleOpenCreateIssue = (defaults?: Partial<AgileIssue>) => {
    const defaultSprint =
      defaults?.sprint !== undefined
        ? defaults.sprint
        : activeTab === "board" && activeSprint
        ? activeSprint.id
        : "";
    const blank = createBlankIssue(files, currentUser, {
      ...defaults,
      sprint: defaultSprint,
    });
    setDrawerIssue(blank);
    setDrawerIsNew(true);
  };

  const handleSelectIssue = (issue: AgileIssue) => {
    setDrawerIssue(issue);
    setDrawerIsNew(false);
  };

  const toggleQuickFilter = (token: string) => {
    const parts = jqlQuery.trim().split(/\s+/).filter(Boolean);
    if (parts.some((p) => p.toLowerCase() === token.toLowerCase())) {
      setJqlQuery(parts.filter((p) => p.toLowerCase() !== token.toLowerCase()).join(" "));
    } else {
      setJqlQuery([...parts, token].join(" "));
    }
  };

  const handleWipLimitChange = (col: IssueStatus, val: number) => {
    const clean = Math.max(0, Math.floor(val || 0));
    const next = { ...wipLimits, [col]: clean };
    setWipLimits(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("mdteam_wip_limits", JSON.stringify(next));
      } catch {}
    }
  };

  const handleDropOnColumn = (targetStatus: IssueStatus) => {
    setDragOverTarget(null);
    if (!draggedIssueId) return;
    const found = allIssues.find((i) => i.id === draggedIssueId);
    setDraggedIssueId(null);
    if (!found || found.status === targetStatus) return;
    handleSaveIssue({ ...found, status: targetStatus });
  };

  const handleDropOnSprint = (targetSprintId: string) => {
    setDragOverTarget(null);
    if (!draggedIssueId) return;
    const found = allIssues.find((i) => i.id === draggedIssueId);
    setDraggedIssueId(null);
    if (!found || found.sprint === targetSprintId) return;
    const nextStatus: IssueStatus =
      targetSprintId && found.status === "backlog" ? "ready" : found.status;
    handleSaveIssue({ ...found, sprint: targetSprintId, status: nextStatus });
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--bg-editor)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <ScrumWorkspaceHeader
        t={t}
        activeTab={activeTab}
        activeSprint={activeSprint}
        activeSprintMetrics={activeSprintMetrics}
        toastMsg={toastMsg}
        onSelectTab={setActiveTab}
        onOpenPoker={() => {
          setPokerIssueId(undefined);
          setPokerOpen(true);
        }}
        onOpenCreateIssue={() => handleOpenCreateIssue()}
        onDismissToast={() => setToastMsg(null)}
      />

      {activeTab === "board" && (
        <KanbanBoardTab
          t={t}
          allIssues={allIssues}
          epics={epics}
          sprints={sprints}
          activeSprint={activeSprint}
          currentUser={currentUser}
          boardScope={boardScope}
          jqlQuery={jqlQuery}
          swimlaneMode={swimlaneMode}
          wipLimits={wipLimits}
          editingWipCol={editingWipCol}
          draggedIssueId={draggedIssueId}
          dragOverTarget={dragOverTarget}
          onSetBoardScope={setBoardScope}
          onSetJqlQuery={setJqlQuery}
          onToggleQuickFilter={toggleQuickFilter}
          onSetSwimlaneMode={setSwimlaneMode}
          onSetEditingWipCol={setEditingWipCol}
          onWipLimitChange={handleWipLimitChange}
          onSetDraggedIssueId={setDraggedIssueId}
          onSetDragOverTarget={setDragOverTarget}
          onDropOnColumn={handleDropOnColumn}
          onSelectIssue={handleSelectIssue}
        />
      )}

      {activeTab === "backlog" && (
        <BacklogPlanningTab
          t={t}
          allIssues={allIssues}
          sprints={sprints}
          activeSprint={activeSprint}
          activeSprintMetrics={activeSprintMetrics}
          capacity={capacity}
          totalCapacitySp={totalCapacitySp}
          unmigratedLegacyCount={unmigratedLegacyCount}
          dragOverTarget={dragOverTarget}
          onSetDraggedIssueId={setDraggedIssueId}
          onSetDragOverTarget={setDragOverTarget}
          onDropOnSprint={handleDropOnSprint}
          onConvertLegacyBacklog={handleConvertLegacyBacklog}
          onOpenPoker={(issueId) => {
            setPokerIssueId(issueId);
            setPokerOpen(true);
          }}
          onCreateNewSprint={handleCreateNewSprint}
          onStartSprint={handleStartSprint}
          onCompleteSprint={handleCompleteSprint}
          onOpenCreateIssue={handleOpenCreateIssue}
          onSelectIssue={handleSelectIssue}
        />
      )}

      {activeTab === "roadmap" && (
        <GanttRoadmapTab
          t={t}
          allIssues={allIssues}
          files={files}
          roadmapZoom={roadmapZoom}
          roadmapFilter={roadmapFilter}
          onSetRoadmapZoom={setRoadmapZoom}
          onSetRoadmapFilter={setRoadmapFilter}
          onOpenFile={onOpenFile}
          onSelectIssue={handleSelectIssue}
        />
      )}

      {activeTab === "metrics" && (
        <AgileMetricsTab
          t={t}
          allIssues={allIssues}
          sprints={sprints}
          activeSprint={activeSprint}
          impediments={impediments}
          metricsSprintId={metricsSprintId}
          onSetMetricsSprintId={setMetricsSprintId}
          onOpenFile={onOpenFile}
          onSelectIssue={handleSelectIssue}
        />
      )}

      <IssueDrawer
        issue={drawerIssue}
        isOpen={Boolean(drawerIssue)}
        isNew={drawerIsNew}
        epics={epics}
        sprints={sprints}
        allIssues={allIssues}
        currentUser={currentUser}
        language={language}
        onClose={() => {
          setDrawerIssue(null);
          setDrawerIsNew(false);
        }}
        onSave={handleSaveIssue}
        onDelete={onDeleteFile ? handleDeleteIssue : undefined}
        onOpenMarkdownFile={(path) => {
          setDrawerIssue(null);
          onOpenFile(path);
        }}
        onCreateBranch={(iss, branchName) => {
          onCreateBranchFromIssue?.(iss, branchName);
        }}
      />

      <PlanningPokerModal
        isOpen={pokerOpen}
        onClose={() => setPokerOpen(false)}
        issues={allIssues}
        initialIssueId={pokerIssueId}
        currentUser={currentUser}
        yjsUrl={yjsUrl}
        language={language}
        onApplyEstimate={(iss, points) => {
          handleSaveIssue({ ...iss, storyPoints: points });
        }}
      />
    </div>
  );
}

export default ScrumWorkspace;
