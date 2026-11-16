"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Filter,
  Sparkles,
  Play,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  GitBranch,
  Calendar,
  Layers,
  Bug,
  Bookmark,
  BookOpen,
  Zap,
  Users,
  TrendingDown,
  TrendingUp,
  BarChart3,
  GanttChart,
  Columns3,
  ListTodo,
  ExternalLink,
  CheckSquare,
  X,
  ArrowRight,
  Flag,
} from "lucide-react";
import {
  WorkspaceFile,
  AgileIssue,
  AgileSprint,
  IssueStatus,
  IssuePriority,
  IssueType,
  extractAllIssues,
  parseSprints,
  serializeIssueToMarkdown,
  serializeSprintToMarkdown,
  filterIssuesJql,
  computeSprintMetrics,
  computeGanttBars,
  migrateLegacyBacklogToIssues,
  generateNextIssueId,
  createBlankIssue,
  parseCapacityAndVelocity,
  appendCompletedSprintToCapacity,
  extractImpediments,
} from "../utils/issueEngine";
import IssueDrawer from "./IssueDrawer";
import PlanningPokerModal from "./PlanningPokerModal";

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
  initialTab?: "board" | "backlog" | "roadmap" | "metrics";
}

type SwimlaneMode = "none" | "assignee" | "epic" | "priority";

const BOARD_COLUMNS: { status: IssueStatus; color: string }[] = [
  { status: "backlog", color: "var(--text-muted)" },
  { status: "ready", color: "#a855f7" },
  { status: "in-progress", color: "var(--accent-blue)" },
  { status: "review", color: "var(--accent-yellow)" },
  { status: "done", color: "var(--accent-green)" },
];

const DEFAULT_WIP_LIMITS: Record<IssueStatus, number> = {
  backlog: 0,
  ready: 6,
  "in-progress": 3,
  review: 2,
  done: 0,
};

const copy = {
  de: {
    workspaceTitle: "Git-Native Scrum & Jira Engine",
    tabs: {
      board: "Kanban / Sprint-Board",
      backlog: "Backlog & Planung",
      roadmap: "Gantt-Roadmap",
      metrics: "Agile Metriken",
    },
    planningPoker: "Planning Poker",
    createIssue: "+ Ticket erstellen",
    boardScopeLabel: "Board-Fokus",
    allIssuesScope: "Alle Tickets (Gesamt-Kanban)",
    jqlPlaceholder: "JQL-Filter: z.B. type:bug status:in-progress assignee:@me is:blocked ...",
    quickMe: "@me",
    quickBlocked: "Blockiert",
    quickBugs: "Bugs",
    swimlaneLabel: "Swimlanes",
    swimlanes: {
      none: "Keine Gruppierung",
      assignee: "Nach Bearbeiter",
      epic: "Nach Epic",
      priority: "Nach Priorität",
    } as Record<SwimlaneMode, string>,
    wipLimitTitle: "WIP-Limit bearbeiten (0 = unbegrenzt)",
    wipExceeded: "WIP ÜBERSCHRITTEN",
    columns: {
      backlog: "Backlog",
      ready: "Ready",
      "in-progress": "In Progress",
      review: "In Review",
      done: "Done",
    } as Record<IssueStatus, string>,
    emptyColumn: "Ticket hierher ziehen",
    blockedBadge: "BLOCKIERT",
    unassigned: "Nicht zugewiesen",
    noEpic: "Ohne Epic",
    // Backlog & Sprint Planning
    teamCapacity: "Team-Kapazität (capacity.md)",
    sprintLoad: "Sprint-Last (Reale SP)",
    loadRatio: "Auslastung",
    overloadedAlert: "Überlastung! Geplante SP überschreiten Team-Kapazität.",
    convertLegacyBtn: "Legacy-Backlog konvertieren",
    legacyConvertedToast: "Legacy-Aufgaben in issues/MDT-*.md migriert!",
    noLegacyToast: "Keine unmigrierten Aufgaben in sprint-backlog.md.",
    newSprintBtn: "+ Neuer Sprint",
    startSprintBtn: "Sprint starten",
    completeSprintBtn: "Sprint abschließen",
    sprintCompletedToast: "Sprint abgeschlossen! Offene Tickets verschoben & Velocity in capacity.md protokolliert.",
    sprintsHeading: "Sprints",
    productBacklogHeading: "Product Backlog (Ungesprintet)",
    dropIntoSprint: "Tickets aus dem Backlog hierher ziehen, um sie dem Sprint zuzuweisen.",
    dropIntoBacklog: "Tickets hierher ziehen, um sie aus dem Sprint ins Product Backlog zu legen.",
    sprintStates: {
      planned: "GEPLANT",
      active: "AKTIV",
      closed: "ABGESCHLOSSEN",
    },
    estimateBtn: "Schätzen",
    // Roadmap
    roadmapHeading: "Dynamische Gantt-Roadmap (Epics & roadmap.md)",
    zoomMonth: "Monat",
    zoomQuarter: "Quartal",
    filterAll: "Alle",
    filterEpics: "Epics & Issues",
    filterMilestones: "Meilensteine (roadmap.md)",
    todayMarker: "HEUTE",
    daysUnit: "Tage",
    dependsOn: "Blockiert durch",
    openRoadmapMd: "roadmap.md öffnen",
    // Metrics
    metricsScope: "Metrik-Zeitraum",
    kpiTotalSp: "Gesamt-Scope (Reale SP)",
    kpiCompletedSp: "Abgeschlossen (Done)",
    kpiInProgressSp: "In Arbeit & Review",
    kpiImpediments: "Aktive Blocker / Impediments",
    burndownTitle: "Real Story Point Burndown",
    idealLine: "Idealverlauf",
    actualLine: "Restaufwand (SP)",
    burnupTitle: "Scope-Creep Burnup Chart",
    scopeLine: "Gesamt-Scope (inkl. Scope Creep)",
    completedLine: "Fertiggestellt (Done SP)",
    scopeCreepBadge: "Scope Creep",
    cfdTitle: "Cumulative Flow (CFD) & Status-Verteilung",
    impedimentsTitle: "Impediment & Blocker Tracker",
    noImpediments: "Keine offenen Blocker oder Impediments im Workspace!",
    openSourceBtn: "Öffnen",
  },
  en: {
    workspaceTitle: "Git-Native Scrum & Jira Engine",
    tabs: {
      board: "Kanban / Sprint Board",
      backlog: "Backlog & Planning",
      roadmap: "Gantt Roadmap",
      metrics: "Agile Metrics",
    },
    planningPoker: "Planning Poker",
    createIssue: "+ Create Issue",
    boardScopeLabel: "Board Scope",
    allIssuesScope: "All Issues (Full Kanban)",
    jqlPlaceholder: "JQL filter: e.g. type:bug status:in-progress assignee:@me is:blocked ...",
    quickMe: "@me",
    quickBlocked: "Blocked",
    quickBugs: "Bugs",
    swimlaneLabel: "Swimlanes",
    swimlanes: {
      none: "No Grouping",
      assignee: "By Assignee",
      epic: "By Epic",
      priority: "By Priority",
    } as Record<SwimlaneMode, string>,
    wipLimitTitle: "Edit column WIP limit (0 = unlimited)",
    wipExceeded: "WIP EXCEEDED",
    columns: {
      backlog: "Backlog",
      ready: "Ready",
      "in-progress": "In Progress",
      review: "In Review",
      done: "Done",
    } as Record<IssueStatus, string>,
    emptyColumn: "Drop issue here",
    blockedBadge: "BLOCKED",
    unassigned: "Unassigned",
    noEpic: "No Epic",
    // Backlog & Sprint Planning
    teamCapacity: "Team Capacity (capacity.md)",
    sprintLoad: "Sprint Load (Real SP)",
    loadRatio: "Load",
    overloadedAlert: "Overloaded! Planned Story Points exceed team capacity.",
    convertLegacyBtn: "Convert Legacy Backlog",
    legacyConvertedToast: "Migrated legacy tasks into atomic issues/MDT-*.md files!",
    noLegacyToast: "No unmigrated tasks remaining in sprint-backlog.md.",
    newSprintBtn: "+ New Sprint",
    startSprintBtn: "Start Sprint",
    completeSprintBtn: "Complete Sprint",
    sprintCompletedToast: "Sprint completed! Unfinished issues rolled over & velocity logged to capacity.md.",
    sprintsHeading: "Sprints",
    productBacklogHeading: "Product Backlog (Unassigned to Sprint)",
    dropIntoSprint: "Drag issues here to plan them into this sprint.",
    dropIntoBacklog: "Drag issues here to move them back to the Product Backlog.",
    sprintStates: {
      planned: "PLANNED",
      active: "ACTIVE",
      closed: "CLOSED",
    },
    estimateBtn: "Poker",
    // Roadmap
    roadmapHeading: "Dynamic Gantt Roadmap (Epics & roadmap.md)",
    zoomMonth: "Month",
    zoomQuarter: "Quarter",
    filterAll: "All",
    filterEpics: "Epics & Issues",
    filterMilestones: "Milestones (roadmap.md)",
    todayMarker: "TODAY",
    daysUnit: "days",
    dependsOn: "Blocked by",
    openRoadmapMd: "Open roadmap.md",
    // Metrics
    metricsScope: "Metrics Scope",
    kpiTotalSp: "Total Scope (Real SP)",
    kpiCompletedSp: "Completed (Done)",
    kpiInProgressSp: "In Progress & Review",
    kpiImpediments: "Active Blockers / Impediments",
    burndownTitle: "Real Story Point Burndown",
    idealLine: "Ideal Trend",
    actualLine: "Remaining (SP)",
    burnupTitle: "Scope-Creep Burnup Chart",
    scopeLine: "Total Scope (incl. Scope Creep)",
    completedLine: "Completed (Done SP)",
    scopeCreepBadge: "Scope Creep",
    cfdTitle: "Cumulative Flow (CFD) & Status Distribution",
    impedimentsTitle: "Impediment & Blocker Tracker",
    noImpediments: "Zero open blockers or impediments in workspace!",
    openSourceBtn: "Open",
  },
};

function typeBadgeIcon(type: IssueType) {
  switch (type) {
    case "epic":
      return <Layers size={12} style={{ color: "#a855f7" }} />;
    case "bug":
      return <Bug size={12} style={{ color: "var(--accent-red)" }} />;
    case "story":
      return <Bookmark size={12} style={{ color: "var(--accent-green)" }} />;
    case "spike":
      return <Zap size={12} style={{ color: "var(--accent-yellow)" }} />;
    default:
      return <BookOpen size={12} style={{ color: "var(--accent-blue)" }} />;
  }
}

function priorityColor(priority: IssuePriority): string {
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
  const t = copy[language] || copy.de;

  const [activeTab, setActiveTab] = useState<"board" | "backlog" | "roadmap" | "metrics">(
    initialTab
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Parse live issues, sprints, capacity & impediments from WorkspaceFile[]
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

  // Board states
  const [boardScope, setBoardScope] = useState<string>("active");
  const [jqlQuery, setJqlQuery] = useState<string>("");
  const [swimlaneMode, setSwimlaneMode] = useState<SwimlaneMode>("none");
  const [wipLimits, setWipLimits] = useState<Record<IssueStatus, number>>(DEFAULT_WIP_LIMITS);
  const [editingWipCol, setEditingWipCol] = useState<IssueStatus | null>(null);
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // Roadmap states
  const [roadmapZoom, setRoadmapZoom] = useState<"month" | "quarter">("month");
  const [roadmapFilter, setRoadmapFilter] = useState<"all" | "epics" | "roadmap">("all");

  // Metrics scope state
  const [metricsSprintId, setMetricsSprintId] = useState<string>("active");

  // Drawer & Planning Poker modal states
  const [drawerIssue, setDrawerIssue] = useState<AgileIssue | null>(null);
  const [drawerIsNew, setDrawerIsNew] = useState<boolean>(false);
  const [pokerOpen, setPokerOpen] = useState<boolean>(false);
  const [pokerIssueId, setPokerIssueId] = useState<string | undefined>(undefined);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Load persisted WIP limits on client
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

  const upsertBatch = (batch: WorkspaceFile[]) => {
    if (batch.length === 0) return;
    if (onUpsertMultipleFiles) {
      onUpsertMultipleFiles(batch);
    } else {
      batch.forEach((f) => onUpsertFile(f));
    }
  };

  // Persist single AgileIssue (automatically promoting virtual legacy issues to issues/MDT-XXX.md)
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
      setDrawerIssue(toPersist);
      setDrawerIsNew(false);
    }
  };

  const handleDeleteIssue = (issue: AgileIssue) => {
    if (!issue.isVirtualLegacy && onDeleteFile) {
      onDeleteFile(issue.filePath);
    }
  };

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

  // Filtered issues for Kanban / Sprint Board
  const boardIssues = useMemo(() => {
    let base = allIssues.filter((i) => i.type !== "epic");
    if (boardScope === "active" && activeSprint) {
      base = base.filter((i) => i.sprint.toLowerCase() === activeSprint.id.toLowerCase());
    } else if (boardScope !== "all" && boardScope !== "active") {
      base = base.filter((i) => i.sprint.toLowerCase() === boardScope.toLowerCase());
    }
    return filterIssuesJql(base, jqlQuery, currentUser);
  }, [allIssues, boardScope, activeSprint, jqlQuery, currentUser]);

  // Swimlane groups
  const swimlanes = useMemo(() => {
    if (swimlaneMode === "none") {
      return [{ key: "all", label: "", issues: boardIssues }];
    }
    const map = new Map<string, { key: string; label: string; issues: AgileIssue[] }>();

    if (swimlaneMode === "priority") {
      (["critical", "high", "medium", "low"] as IssuePriority[]).forEach((p) => {
        map.set(p, { key: p, label: p.toUpperCase(), issues: [] });
      });
    }

    for (const iss of boardIssues) {
      let k = "";
      let lbl = "";
      if (swimlaneMode === "assignee") {
        k = iss.assignee || "__unassigned";
        lbl = iss.assignee || t.unassigned;
      } else if (swimlaneMode === "epic") {
        k = iss.epic || "__no_epic";
        const foundEpic = epics.find((e) => e.id.toLowerCase() === iss.epic.toLowerCase());
        lbl = foundEpic ? `${foundEpic.id} — ${foundEpic.title}` : iss.epic || t.noEpic;
      } else if (swimlaneMode === "priority") {
        k = iss.priority;
        lbl = iss.priority.toUpperCase();
      }
      if (!map.has(k)) {
        map.set(k, { key: k, label: lbl, issues: [] });
      }
      map.get(k)!.issues.push(iss);
    }

    const nonEmpty = Array.from(map.values()).filter((g) => g.issues.length > 0);
    return nonEmpty.length > 0 ? nonEmpty : [{ key: "empty", label: "—", issues: [] }];
  }, [boardIssues, swimlaneMode, epics, t.unassigned, t.noEpic]);

  // Drag & Drop handlers for Board columns
  const handleDropOnColumn = (targetStatus: IssueStatus) => {
    setDragOverTarget(null);
    if (!draggedIssueId) return;
    const found = allIssues.find((i) => i.id === draggedIssueId);
    setDraggedIssueId(null);
    if (!found || found.status === targetStatus) return;
    handleSaveIssue({ ...found, status: targetStatus });
  };

  // Drag & Drop handlers for Backlog <-> Sprint
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

  // Sprint Lifecycle Actions
  const handleCreateNewSprint = () => {
    const num = sprints.length + 1;
    const id = `sprint-${String(num).padStart(2, "0")}`;
    const lastEnd = sprints[sprints.length - 1]?.endDate || "2026-06-14";
    const startMs = Date.parse(lastEnd) + 24 * 60 * 60 * 1000;
    const safeStartMs = Number.isFinite(startMs) ? startMs : Date.now();
    const startDate = new Date(safeStartMs).toISOString().slice(0, 10);
    const endDate = new Date(safeStartMs + 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const newSprint: AgileSprint = {
      id,
      name: `Sprint ${String(num).padStart(2, "0")}`,
      goal: language === "en" ? "Deliver prioritized backlog stories." : "Priorisierte User Stories liefern.",
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
    const doneSp = sprintTickets
      .filter((i) => i.status === "done")
      .reduce((s, i) => s + (i.storyPoints || 0), 0);
    const plannedSp =
      sprint.committedPoints > 0
        ? sprint.committedPoints
        : sprintTickets.reduce((s, i) => s + (i.storyPoints || 0), 0);

    // Find next planned sprint if available, otherwise roll back to Product Backlog ("")
    const nextPlanned = sprints.find(
      (s) => s.id !== sprint.id && s.state === "planned"
    );
    const rolloverSprintId = nextPlanned ? nextPlanned.id : "";

    const batch: WorkspaceFile[] = [];

    // 1. Close current sprint
    const closedSprint: AgileSprint = {
      ...sprint,
      state: "closed",
      completedPoints: doneSp,
    };
    batch.push(serializeSprintToMarkdown(closedSprint));

    // 2. Roll unfinished tickets to next sprint or backlog
    const nowIso = new Date().toISOString();
    sprintTickets
      .filter((i) => i.status !== "done" && !i.isVirtualLegacy)
      .forEach((unfinished) => {
        batch.push(
          serializeIssueToMarkdown({
            ...unfinished,
            sprint: rolloverSprintId,
            updatedAt: nowIso,
          })
        );
      });

    // 3. Log completed Story Points to management/capacity.md
    batch.push(appendCompletedSprintToCapacity(files, sprint.name, plannedSp, doneSp));

    upsertBatch(batch);
    showToast(t.sprintCompletedToast);
  };

  const handleConvertLegacyBacklog = () => {
    const migratedFiles = migrateLegacyBacklogToIssues(files, "MDT");
    if (migratedFiles.length === 0) {
      showToast(t.noLegacyToast);
      return;
    }
    upsertBatch(migratedFiles);
    showToast(t.legacyConvertedToast);
  };

  // Gantt calculation
  const ganttData = useMemo(
    () => computeGanttBars(allIssues, files, roadmapZoom),
    [allIssues, files, roadmapZoom]
  );

  const visibleGanttBars = useMemo(() => {
    if (roadmapFilter === "epics") {
      return ganttData.bars.filter((b) => b.source === "epic" || b.source === "issue");
    }
    if (roadmapFilter === "roadmap") {
      return ganttData.bars.filter((b) => b.source === "roadmap");
    }
    return ganttData.bars;
  }, [ganttData.bars, roadmapFilter]);

  // Metrics calculation
  const selectedMetricsSprint = useMemo(() => {
    if (metricsSprintId === "all") return undefined;
    if (metricsSprintId === "active") return activeSprint;
    return sprints.find((s) => s.id === metricsSprintId) || activeSprint;
  }, [metricsSprintId, activeSprint, sprints]);

  const metrics = useMemo(
    () => computeSprintMetrics(allIssues, selectedMetricsSprint),
    [allIssues, selectedMetricsSprint]
  );

  const activeSprintMetrics = useMemo(
    () => computeSprintMetrics(allIssues, activeSprint),
    [allIssues, activeSprint]
  );

  const unmigratedLegacyCount = useMemo(
    () => allIssues.filter((i) => i.isVirtualLegacy).length,
    [allIssues]
  );

  // Reusable Kanban Card Renderer
  const renderKanbanCard = (issue: AgileIssue) => {
    const isBlocked =
      issue.blockedBy.length > 0 ||
      issue.labels.some((l) => l.toLowerCase() === "blocked");
    const epicObj = issue.epic
      ? epics.find((e) => e.id.toLowerCase() === issue.epic.toLowerCase())
      : undefined;
    const acDone = issue.acceptanceCriteria.filter((a) => a.checked).length;
    const acTotal = issue.acceptanceCriteria.length;

    return (
      <div
        key={issue.id}
        draggable
        onDragStart={(e) => {
          setDraggedIssueId(issue.id);
          e.dataTransfer.setData("text/plain", issue.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          setDraggedIssueId(null);
          setDragOverTarget(null);
        }}
        onClick={() => {
          setDrawerIssue(issue);
          setDrawerIsNew(false);
        }}
        style={{
          backgroundColor: "var(--bg-sidebar)",
          border: isBlocked
            ? "1px solid rgba(239, 68, 68, 0.55)"
            : "1px solid var(--border-color)",
          borderLeft: `3px solid ${isBlocked ? "var(--accent-red)" : priorityColor(issue.priority)}`,
          borderRadius: "8px",
          padding: "11px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          cursor: "grab",
          boxShadow: "var(--shadow-sm)",
          opacity: draggedIssueId === issue.id ? 0.45 : 1,
          transition: "transform 0.12s ease, border-color 0.15s ease",
        }}
      >
        {/* Card Top Row: ID, Type, Blocked / Priority */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            {typeBadgeIcon(issue.type)}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--text-secondary)",
              }}
            >
              {issue.id}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            {isBlocked && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(239, 68, 68, 0.18)",
                  color: "var(--accent-red)",
                  fontSize: "9px",
                  fontWeight: 700,
                }}
                title={issue.blockedBy.join(", ")}
              >
                <AlertOctagon size={10} />
                {t.blockedBadge}
              </span>
            )}
            <Flag size={11} style={{ color: priorityColor(issue.priority) }} />
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: issue.status === "done" ? "var(--text-muted)" : "var(--text-primary)",
            textDecoration: issue.status === "done" ? "line-through" : "none",
            lineHeight: 1.38,
          }}
        >
          {issue.title}
        </div>

        {/* Epic & Labels */}
        {(epicObj || issue.epic || issue.labels.length > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {(epicObj || issue.epic) && (
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(168, 85, 247, 0.15)",
                  color: "#c084fc",
                  fontSize: "10px",
                  fontWeight: 600,
                  maxWidth: "170px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {epicObj ? epicObj.title : issue.epic}
              </span>
            )}
            {issue.labels.slice(0, 3).map((lbl) => (
              <span
                key={lbl}
                style={{
                  padding: "1px 6px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  color: "var(--text-muted)",
                  fontSize: "10px",
                }}
              >
                #{lbl}
              </span>
            ))}
          </div>
        )}

        {/* Footer: Assignee, AC count, Branch indicator, Story Points */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "2px",
            paddingTop: "6px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "11px",
                color: issue.assignee ? "var(--accent-indigo)" : "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              {issue.assignee || "—"}
            </span>

            {acTotal > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  fontSize: "10px",
                  color: acDone === acTotal ? "var(--accent-green)" : "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <CheckSquare size={10} />
                {acDone}/{acTotal}
              </span>
            )}

            {issue.branch && (
              <span title={issue.branch} style={{ color: "var(--accent-blue)", display: "inline-flex" }}>
                <GitBranch size={11} />
              </span>
            )}
          </div>

          <span
            style={{
              padding: "2px 7px",
              borderRadius: "999px",
              backgroundColor:
                issue.storyPoints > 0 ? "rgba(99, 102, 241, 0.16)" : "rgba(255,255,255,0.05)",
              color: issue.storyPoints > 0 ? "var(--accent-indigo)" : "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 700,
            }}
          >
            {issue.storyPoints} SP
          </span>
        </div>
      </div>
    );
  };

  const quickMeActive = /\bassignee:@me\b/i.test(jqlQuery);
  const quickBlockedActive = /\bis:blocked\b/i.test(jqlQuery);
  const quickBugsActive = /\btype:bug\b/i.test(jqlQuery);

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
      {/* Top Scrum Header & Sub-Navigation */}
      <div
        style={{
          padding: "14px 24px 0 24px",
          backgroundColor: "var(--bg-sidebar)",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "18px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <Sparkles size={19} style={{ color: "var(--accent-indigo)" }} />
              {t.workspaceTitle}
            </h1>

            {activeSprint && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "3px 10px",
                  borderRadius: "999px",
                  backgroundColor: "rgba(99, 102, 241, 0.12)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  fontSize: "11px",
                  color: "var(--text-primary)",
                }}
              >
                <strong style={{ color: "var(--accent-indigo)" }}>{activeSprint.name}</strong>
                <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {activeSprintMetrics.completedPoints}/{activeSprintMetrics.totalPoints} SP
                </span>
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => {
                setPokerIssueId(undefined);
                setPokerOpen(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-panel)",
                color: "var(--text-primary)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Users size={14} style={{ color: "var(--accent-indigo)" }} />
              {t.planningPoker}
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateIssue()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "var(--accent-indigo)",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t.createIssue}
            </button>
          </div>
        </div>

        {/* Toast Notification Banner */}
        {toastMsg && (
          <div
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              color: "var(--accent-green)",
              fontSize: "12px",
              fontWeight: 600,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{toastMsg}</span>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "6px" }}>
          {(
            [
              { id: "board", icon: <Columns3 size={14} />, label: t.tabs.board },
              { id: "backlog", icon: <ListTodo size={14} />, label: t.tabs.backlog },
              { id: "roadmap", icon: <GanttChart size={14} />, label: t.tabs.roadmap },
              { id: "metrics", icon: <BarChart3 size={14} />, label: t.tabs.metrics },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "9px 14px",
                  background: "none",
                  border: "none",
                  borderBottom: active
                    ? "2px solid var(--accent-indigo)"
                    : "2px solid transparent",
                  color: active ? "var(--accent-indigo)" : "var(--text-secondary)",
                  fontWeight: active ? 700 : 500,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          TAB 1: KANBAN / SPRINT BOARD
         ===================================================================== */}
      {activeTab === "board" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: "16px 24px",
            gap: "14px",
          }}
        >
          {/* Filter & Grouping Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              borderRadius: "10px",
              padding: "10px 14px",
            }}
          >
            {/* Left: Sprint Scope + JQL Input + Quick Chips */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, flexWrap: "wrap" }}>
              <select
                className="settings-select"
                style={{ width: "auto", minWidth: "180px", padding: "6px 10px", fontSize: "12px" }}
                value={boardScope}
                onChange={(e) => setBoardScope(e.target.value)}
              >
                {activeSprint && (
                  <option value="active">
                    {activeSprint.name} ({t.sprintStates[activeSprint.state]})
                  </option>
                )}
                <option value="all">{t.allIssuesScope}</option>
                {sprints
                  .filter((s) => s.id !== activeSprint?.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({t.sprintStates[s.state]})
                    </option>
                  ))}
              </select>

              {/* JQL-lite Input */}
              <div style={{ position: "relative", flex: 1, minWidth: "230px" }}>
                <Filter
                  size={13}
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  type="text"
                  className="settings-input"
                  style={{
                    paddingLeft: "30px",
                    paddingRight: jqlQuery ? "28px" : "10px",
                    paddingTop: "6px",
                    paddingBottom: "6px",
                    fontSize: "12px",
                    fontFamily: "var(--font-mono)",
                  }}
                  placeholder={t.jqlPlaceholder}
                  value={jqlQuery}
                  onChange={(e) => setJqlQuery(e.target.value)}
                />
                {jqlQuery && (
                  <button
                    type="button"
                    onClick={() => setJqlQuery("")}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      display: "flex",
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Quick Filter Chips */}
              <button
                type="button"
                onClick={() => toggleQuickFilter("assignee:@me")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "999px",
                  border: quickMeActive
                    ? "1px solid var(--accent-indigo)"
                    : "1px solid var(--border-color)",
                  backgroundColor: quickMeActive
                    ? "rgba(99, 102, 241, 0.2)"
                    : "var(--bg-sidebar)",
                  color: quickMeActive ? "#ffffff" : "var(--text-secondary)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t.quickMe}
              </button>

              <button
                type="button"
                onClick={() => toggleQuickFilter("is:blocked")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "999px",
                  border: quickBlockedActive
                    ? "1px solid var(--accent-red)"
                    : "1px solid var(--border-color)",
                  backgroundColor: quickBlockedActive
                    ? "rgba(239, 68, 68, 0.2)"
                    : "var(--bg-sidebar)",
                  color: quickBlockedActive ? "var(--accent-red)" : "var(--text-secondary)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t.quickBlocked}
              </button>

              <button
                type="button"
                onClick={() => toggleQuickFilter("type:bug")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "999px",
                  border: quickBugsActive
                    ? "1px solid var(--accent-red)"
                    : "1px solid var(--border-color)",
                  backgroundColor: quickBugsActive
                    ? "rgba(239, 68, 68, 0.16)"
                    : "var(--bg-sidebar)",
                  color: quickBugsActive ? "var(--accent-red)" : "var(--text-secondary)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t.quickBugs}
              </button>
            </div>

            {/* Right: Swimlane Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
                {t.swimlaneLabel}:
              </span>
              <select
                className="settings-select"
                style={{ width: "auto", padding: "6px 10px", fontSize: "12px" }}
                value={swimlaneMode}
                onChange={(e) => setSwimlaneMode(e.target.value as SwimlaneMode)}
              >
                {(["none", "assignee", "epic", "priority"] as SwimlaneMode[]).map((m) => (
                  <option key={m} value={m}>
                    {t.swimlanes[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Board Columns + Swimlanes Scroll Container */}
          <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Column Headers Sticky Bar */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(220px, 1fr))",
                gap: "12px",
                minWidth: "1140px",
              }}
            >
              {BOARD_COLUMNS.map(({ status, color }) => {
                const colIssues = boardIssues.filter((i) => i.status === status);
                const colSp = colIssues.reduce((s, i) => s + (i.storyPoints || 0), 0);
                const limit = wipLimits[status] || 0;
                const exceeded = limit > 0 && colIssues.length > limit;

                return (
                  <div
                    key={status}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: exceeded
                        ? "rgba(239, 68, 68, 0.12)"
                        : "var(--bg-panel)",
                      border: exceeded
                        ? "1px solid var(--accent-red)"
                        : "1px solid var(--border-color)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: exceeded ? "var(--accent-red)" : color,
                          }}
                        />
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            color: exceeded ? "var(--accent-red)" : "var(--text-primary)",
                          }}
                        >
                          {t.columns[status]}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {editingWipCol === status ? (
                          <input
                            type="number"
                            min={0}
                            autoFocus
                            value={limit}
                            onChange={(e) => handleWipLimitChange(status, Number(e.target.value))}
                            onBlur={() => setEditingWipCol(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setEditingWipCol(null);
                            }}
                            style={{
                              width: "48px",
                              padding: "2px 4px",
                              fontSize: "11px",
                              backgroundColor: "var(--bg-editor)",
                              border: "1px solid var(--accent-indigo)",
                              borderRadius: "4px",
                              color: "var(--text-primary)",
                              fontFamily: "var(--font-mono)",
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingWipCol(status)}
                            title={t.wipLimitTitle}
                            style={{
                              padding: "2px 6px",
                              borderRadius: "999px",
                              border: "none",
                              backgroundColor: exceeded
                                ? "var(--accent-red)"
                                : "rgba(255,255,255,0.06)",
                              color: exceeded ? "#ffffff" : "var(--text-secondary)",
                              fontFamily: "var(--font-mono)",
                              fontSize: "10px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {limit > 0 ? `${colIssues.length}/${limit}` : colIssues.length}
                          </button>
                        )}

                        <span
                          style={{
                            fontSize: "10px",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {colSp} SP
                        </span>
                      </div>
                    </div>

                    {exceeded && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "var(--accent-red)",
                        }}
                      >
                        <AlertTriangle size={11} />
                        {t.wipExceeded} ({colIssues.length} &gt; {limit})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Swimlanes & Column Drop Zones */}
            {swimlanes.map((lane) => (
              <div key={lane.key} style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "1140px" }}>
                {swimlaneMode !== "none" && (
                  <div
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-active)",
                      border: "1px solid var(--border-color)",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{lane.label}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {lane.issues.length} Tickets •{" "}
                      {lane.issues.reduce((s, i) => s + (i.storyPoints || 0), 0)} SP
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, minmax(220px, 1fr))",
                    gap: "12px",
                    alignItems: "stretch",
                  }}
                >
                  {BOARD_COLUMNS.map(({ status }) => {
                    const cellKey = `${lane.key}:${status}`;
                    const cellIssues = lane.issues.filter((i) => i.status === status);
                    const isOver = dragOverTarget === cellKey;
                    const limit = wipLimits[status] || 0;
                    const totalColCount = boardIssues.filter((i) => i.status === status).length;
                    const exceeded = limit > 0 && totalColCount > limit;

                    return (
                      <div
                        key={cellKey}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverTarget !== cellKey) setDragOverTarget(cellKey);
                        }}
                        onDragLeave={() => {
                          if (dragOverTarget === cellKey) setDragOverTarget(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDropOnColumn(status);
                        }}
                        style={{
                          minHeight: swimlaneMode === "none" ? "420px" : "150px",
                          padding: "10px",
                          borderRadius: "8px",
                          backgroundColor: isOver
                            ? "rgba(99, 102, 241, 0.09)"
                            : exceeded
                            ? "rgba(239, 68, 68, 0.04)"
                            : "var(--bg-panel)",
                          border: isOver
                            ? "1.5px dashed var(--accent-indigo)"
                            : exceeded
                            ? "1px solid rgba(239, 68, 68, 0.35)"
                            : "1px solid var(--border-color)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          transition: "background-color 0.12s ease, border-color 0.12s ease",
                        }}
                      >
                        {cellIssues.map((iss) => renderKanbanCard(iss))}

                        {cellIssues.length === 0 && (
                          <div
                            style={{
                              flex: 1,
                              minHeight: "70px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "11px",
                              color: "var(--text-muted)",
                              border: "1px dashed rgba(255,255,255,0.05)",
                              borderRadius: "6px",
                            }}
                          >
                            {t.emptyColumn}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: BACKLOG & SPRINT PLANNING
         ===================================================================== */}
      {activeTab === "backlog" && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* Top Capacity vs Load + Action Toolbar */}
          <div
            style={{
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              borderRadius: "10px",
              padding: "14px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            {/* Capacity vs Active Sprint Load */}
            {(() => {
              const activeLoadSp = activeSprintMetrics.totalPoints;
              const ratio =
                totalCapacitySp > 0 ? Math.round((activeLoadSp / totalCapacitySp) * 100) : 0;
              const overloaded = totalCapacitySp > 0 && activeLoadSp > totalCapacitySp;

              return (
                <div style={{ display: "flex", alignItems: "center", gap: "22px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      {t.teamCapacity}
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
                      {totalCapacitySp.toFixed(1)} SP
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      {t.sprintLoad} ({activeSprint?.id || "—"})
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        color: overloaded ? "var(--accent-red)" : "var(--accent-indigo)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {activeLoadSp} SP ({ratio}%)
                    </div>
                  </div>

                  <div style={{ minWidth: "180px" }}>
                    <div
                      style={{
                        width: "100%",
                        height: "8px",
                        backgroundColor: "var(--bg-sidebar)",
                        borderRadius: "999px",
                        overflow: "hidden",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, ratio)}%`,
                          height: "100%",
                          backgroundColor: overloaded ? "var(--accent-red)" : "var(--accent-indigo)",
                        }}
                      />
                    </div>
                    {overloaded ? (
                      <div style={{ fontSize: "10px", color: "var(--accent-red)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
                        <AlertTriangle size={11} />
                        {t.overloadedAlert}
                      </div>
                    ) : (
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                        {capacity.map((c) => `${c.member}: ${c.capacity} SP`).join(" • ")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Action Buttons: Planning Poker, Convert Legacy Backlog, New Sprint */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleConvertLegacyBacklog}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-sidebar)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <ArrowRight size={13} style={{ color: "var(--accent-yellow)" }} />
                {t.convertLegacyBtn}
                {unmigratedLegacyCount > 0 && (
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: "999px",
                      backgroundColor: "rgba(245, 158, 11, 0.2)",
                      color: "var(--accent-yellow)",
                      fontSize: "10px",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {unmigratedLegacyCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPokerIssueId(undefined);
                  setPokerOpen(true);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  borderRadius: "6px",
                  border: "1px solid rgba(99, 102, 241, 0.4)",
                  backgroundColor: "rgba(99, 102, 241, 0.12)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Users size={13} style={{ color: "var(--accent-indigo)" }} />
                {t.planningPoker}
              </button>

              <button
                type="button"
                onClick={handleCreateNewSprint}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-sidebar)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t.newSprintBtn}
              </button>
            </div>
          </div>

          {/* Split View: Sprints (Left) vs Product Backlog (Right) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
              gap: "18px",
              alignItems: "start",
            }}
          >
            {/* Left Pane: Sprints */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-secondary)" }}>
                {t.sprintsHeading} ({sprints.length})
              </div>

              {sprints.map((sprint) => {
                const spIssues = allIssues.filter(
                  (i) => i.sprint.toLowerCase() === sprint.id.toLowerCase() && i.type !== "epic"
                );
                const spTotal = spIssues.reduce((s, i) => s + (i.storyPoints || 0), 0);
                const spDone = spIssues
                  .filter((i) => i.status === "done")
                  .reduce((s, i) => s + (i.storyPoints || 0), 0);
                const dropKey = `sprint:${sprint.id}`;
                const isOver = dragOverTarget === dropKey;

                return (
                  <div
                    key={sprint.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverTarget !== dropKey) setDragOverTarget(dropKey);
                    }}
                    onDragLeave={() => {
                      if (dragOverTarget === dropKey) setDragOverTarget(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropOnSprint(sprint.id);
                    }}
                    style={{
                      backgroundColor: isOver ? "rgba(99, 102, 241, 0.08)" : "var(--bg-panel)",
                      border: isOver
                        ? "1.5px dashed var(--accent-indigo)"
                        : sprint.state === "active"
                        ? "1px solid rgba(99, 102, 241, 0.45)"
                        : "1px solid var(--border-color)",
                      borderRadius: "10px",
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {/* Sprint Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700 }}>{sprint.name}</span>
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 700,
                              backgroundColor:
                                sprint.state === "active"
                                  ? "rgba(16, 185, 129, 0.16)"
                                  : sprint.state === "closed"
                                  ? "rgba(107, 114, 128, 0.2)"
                                  : "rgba(99, 102, 241, 0.16)",
                              color:
                                sprint.state === "active"
                                  ? "var(--accent-green)"
                                  : sprint.state === "closed"
                                  ? "var(--text-muted)"
                                  : "var(--accent-indigo)",
                            }}
                          >
                            {t.sprintStates[sprint.state]}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            {sprint.startDate} → {sprint.endDate}
                          </span>
                        </div>
                        {sprint.goal && (
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px" }}>
                            {sprint.goal}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "6px",
                            backgroundColor: "var(--bg-sidebar)",
                            border: "1px solid var(--border-color)",
                            fontFamily: "var(--font-mono)",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                        >
                          {spDone}/{spTotal} SP
                        </span>

                        {sprint.state === "planned" && (
                          <button
                            type="button"
                            onClick={() => handleStartSprint(sprint)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              border: "none",
                              backgroundColor: "var(--accent-green)",
                              color: "#ffffff",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            <Play size={11} />
                            {t.startSprintBtn}
                          </button>
                        )}

                        {sprint.state === "active" && (
                          <button
                            type="button"
                            onClick={() => handleCompleteSprint(sprint)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              border: "1px solid rgba(16, 185, 129, 0.45)",
                              backgroundColor: "rgba(16, 185, 129, 0.15)",
                              color: "var(--accent-green)",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            <CheckCircle2 size={12} />
                            {t.completeSprintBtn}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sprint Issue Rows */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {spIssues.length === 0 ? (
                        <div
                          style={{
                            padding: "18px",
                            textAlign: "center",
                            fontSize: "12px",
                            color: "var(--text-muted)",
                            border: "1px dashed var(--border-color)",
                            borderRadius: "8px",
                          }}
                        >
                          {t.dropIntoSprint}
                        </div>
                      ) : (
                        spIssues.map((iss) => (
                          <div
                            key={iss.id}
                            draggable
                            onDragStart={(e) => {
                              setDraggedIssueId(iss.id);
                              e.dataTransfer.setData("text/plain", iss.id);
                            }}
                            onDragEnd={() => {
                              setDraggedIssueId(null);
                              setDragOverTarget(null);
                            }}
                            onClick={() => {
                              setDrawerIssue(iss);
                              setDrawerIsNew(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "10px",
                              padding: "8px 12px",
                              backgroundColor: "var(--bg-sidebar)",
                              border: "1px solid var(--border-color)",
                              borderRadius: "6px",
                              cursor: "grab",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                              {typeBadgeIcon(iss.type)}
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: "var(--accent-indigo)" }}>
                                {iss.id}
                              </span>
                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  textDecoration: iss.status === "done" ? "line-through" : "none",
                                  color: iss.status === "done" ? "var(--text-muted)" : "var(--text-primary)",
                                }}
                              >
                                {iss.title}
                              </span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                {iss.assignee || "—"}
                              </span>
                              <span
                                style={{
                                  fontSize: "9px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "var(--bg-active)",
                                  textTransform: "uppercase",
                                  fontWeight: 700,
                                }}
                              >
                                {iss.status}
                              </span>
                              <span
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: "999px",
                                  backgroundColor: "rgba(99, 102, 241, 0.15)",
                                  color: "var(--accent-indigo)",
                                }}
                              >
                                {iss.storyPoints} SP
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Pane: Product Backlog */}
            {(() => {
              const backlogItems = allIssues.filter(
                (i) => !i.sprint && i.type !== "epic"
              );
              const isOverBacklog = dragOverTarget === "product-backlog";

              return (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverTarget !== "product-backlog") setDragOverTarget("product-backlog");
                  }}
                  onDragLeave={() => {
                    if (dragOverTarget === "product-backlog") setDragOverTarget(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOnSprint("");
                  }}
                  style={{
                    backgroundColor: isOverBacklog ? "rgba(99, 102, 241, 0.08)" : "var(--bg-panel)",
                    border: isOverBacklog
                      ? "1.5px dashed var(--accent-indigo)"
                      : "1px solid var(--border-color)",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    minHeight: "360px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-secondary)" }}>
                      {t.productBacklogHeading} ({backlogItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateIssue({ sprint: "" })}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-sidebar)",
                        color: "var(--text-primary)",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={12} /> {t.createIssue.replace("+ ", "")}
                    </button>
                  </div>

                  {backlogItems.length === 0 ? (
                    <div
                      style={{
                        padding: "28px 16px",
                        textAlign: "center",
                        fontSize: "12px",
                        color: "var(--text-muted)",
                        border: "1px dashed var(--border-color)",
                        borderRadius: "8px",
                      }}
                    >
                      {t.dropIntoBacklog}
                    </div>
                  ) : (
                    backlogItems.map((iss) => (
                      <div
                        key={iss.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedIssueId(iss.id);
                          e.dataTransfer.setData("text/plain", iss.id);
                        }}
                        onDragEnd={() => {
                          setDraggedIssueId(null);
                          setDragOverTarget(null);
                        }}
                        onClick={() => {
                          setDrawerIssue(iss);
                          setDrawerIsNew(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          padding: "9px 12px",
                          backgroundColor: "var(--bg-sidebar)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "6px",
                          cursor: "grab",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                          {typeBadgeIcon(iss.type)}
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "11px",
                              fontWeight: 700,
                              color: iss.isVirtualLegacy ? "var(--accent-yellow)" : "var(--accent-indigo)",
                            }}
                          >
                            {iss.id}
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {iss.title}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPokerIssueId(iss.id);
                              setPokerOpen(true);
                            }}
                            style={{
                              padding: "2px 7px",
                              borderRadius: "4px",
                              border: "1px solid var(--border-color)",
                              backgroundColor: "var(--bg-panel)",
                              color: "var(--text-secondary)",
                              fontSize: "10px",
                              cursor: "pointer",
                            }}
                          >
                            {t.estimateBtn}
                          </button>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "2px 7px",
                              borderRadius: "999px",
                              backgroundColor: "rgba(99, 102, 241, 0.14)",
                              color: "var(--accent-indigo)",
                            }}
                          >
                            {iss.storyPoints} SP
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: DYNAMIC GANTT ROADMAP
         ===================================================================== */}
      {activeTab === "roadmap" && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Controls Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              borderRadius: "10px",
              padding: "12px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <Calendar size={16} style={{ color: "var(--accent-indigo)" }} />
              <span style={{ fontSize: "14px", fontWeight: 700 }}>{t.roadmapHeading}</span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                ({ganttData.rangeStart} → {ganttData.rangeEnd} • {ganttData.totalDays} {t.daysUnit})
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {/* Source Filter */}
              {(["all", "epics", "roadmap"] as const).map((fKey) => (
                <button
                  key={fKey}
                  type="button"
                  onClick={() => setRoadmapFilter(fKey)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: roadmapFilter === fKey ? "var(--bg-active)" : "var(--bg-sidebar)",
                    color: roadmapFilter === fKey ? "var(--text-primary)" : "var(--text-muted)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {fKey === "all"
                    ? t.filterAll
                    : fKey === "epics"
                    ? t.filterEpics
                    : t.filterMilestones}
                </button>
              ))}

              {/* Zoom Toggle: Month / Quarter */}
              <div
                style={{
                  display: "inline-flex",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setRoadmapZoom("month")}
                  style={{
                    padding: "5px 11px",
                    border: "none",
                    backgroundColor:
                      roadmapZoom === "month" ? "var(--accent-indigo)" : "var(--bg-sidebar)",
                    color: roadmapZoom === "month" ? "#ffffff" : "var(--text-secondary)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t.zoomMonth}
                </button>
                <button
                  type="button"
                  onClick={() => setRoadmapZoom("quarter")}
                  style={{
                    padding: "5px 11px",
                    border: "none",
                    backgroundColor:
                      roadmapZoom === "quarter" ? "var(--accent-indigo)" : "var(--bg-sidebar)",
                    color: roadmapZoom === "quarter" ? "#ffffff" : "var(--text-secondary)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t.zoomQuarter}
                </button>
              </div>

              <button
                type="button"
                onClick={() => onOpenFile("management/roadmap.md")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-sidebar)",
                  color: "var(--text-secondary)",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                <ExternalLink size={12} />
                {t.openRoadmapMd}
              </button>
            </div>
          </div>

          {/* Gantt Timeline Card */}
          <div
            style={{
              backgroundColor: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              padding: "18px",
              overflowX: "auto",
            }}
          >
            <div style={{ minWidth: "860px", display: "flex", flexDirection: "column" }}>
              {/* Date Axis Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "270px 1fr",
                  borderBottom: "1px solid var(--border-color)",
                  paddingBottom: "10px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Epic / Milestone
                </div>
                <div style={{ position: "relative", height: "22px" }}>
                  {ganttData.axisTicks.map((tick, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: "absolute",
                        left: `${tick.leftPercent}%`,
                        top: 0,
                        transform: "translateX(-20%)",
                        fontSize: "10px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tick.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows + Vertical Grid & Today Marker */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "10px" }}>
                {visibleGanttBars.map((bar) => {
                  const hasDeps = bar.blockedBy && bar.blockedBy.length > 0;
                  return (
                    <div
                      key={`${bar.source}-${bar.id}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "270px 1fr",
                        alignItems: "center",
                        gap: "12px",
                        minHeight: "42px",
                      }}
                    >
                      {/* Row Label & Dependency Badges */}
                      <div
                        onClick={() => {
                          if (bar.source === "roadmap") {
                            onOpenFile(bar.filePath);
                          } else {
                            const found = allIssues.find((i) => i.id === bar.id);
                            if (found) {
                              setDrawerIssue(found);
                              setDrawerIsNew(false);
                            }
                          }
                        }}
                        style={{
                          cursor: "pointer",
                          paddingRight: "10px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              padding: "1px 5px",
                              borderRadius: "4px",
                              fontSize: "9px",
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)",
                              backgroundColor:
                                bar.source === "epic"
                                  ? "rgba(168, 85, 247, 0.18)"
                                  : bar.source === "issue"
                                  ? "rgba(59, 130, 246, 0.16)"
                                  : "rgba(16, 185, 129, 0.16)",
                              color:
                                bar.source === "epic"
                                  ? "#c084fc"
                                  : bar.source === "issue"
                                  ? "var(--accent-blue)"
                                  : "var(--accent-green)",
                            }}
                          >
                            {bar.source === "epic" ? `EPIC ${bar.id}` : bar.id}
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {bar.title}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                            {bar.assignee} • {bar.startDate.slice(5)} → {bar.endDate.slice(5)}
                          </span>
                          {hasDeps && (
                            <span
                              style={{
                                padding: "0 5px",
                                borderRadius: "4px",
                                backgroundColor: "rgba(239, 68, 68, 0.16)",
                                color: "var(--accent-red)",
                                fontSize: "9px",
                                fontWeight: 700,
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              {t.dependsOn}: {bar.blockedBy.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Proportional Timeline Bar Track */}
                      <div
                        style={{
                          position: "relative",
                          height: "34px",
                          backgroundColor: "var(--bg-panel)",
                          borderRadius: "6px",
                          border: "1px solid var(--border-color)",
                          overflow: "hidden",
                        }}
                      >
                        {/* Vertical Axis Grid Lines */}
                        {ganttData.axisTicks.map((tick, tIdx) => (
                          <div
                            key={tIdx}
                            style={{
                              position: "absolute",
                              left: `${tick.leftPercent}%`,
                              top: 0,
                              bottom: 0,
                              width: "1px",
                              backgroundColor: "rgba(255,255,255,0.04)",
                            }}
                          />
                        ))}

                        {/* Today Vertical Marker */}
                        {ganttData.todayPercent !== null && (
                          <div
                            style={{
                              position: "absolute",
                              left: `${ganttData.todayPercent}%`,
                              top: 0,
                              bottom: 0,
                              width: "2px",
                              backgroundColor: "var(--accent-red)",
                              zIndex: 4,
                            }}
                            title={`${t.todayMarker}: ${ganttData.todayDate}`}
                          />
                        )}

                        {/* Gantt Bar */}
                        <div
                          onClick={() => {
                            if (bar.source === "roadmap") {
                              onOpenFile(bar.filePath);
                            } else {
                              const found = allIssues.find((i) => i.id === bar.id);
                              if (found) {
                                setDrawerIssue(found);
                                setDrawerIsNew(false);
                              }
                            }
                          }}
                          style={{
                            position: "absolute",
                            left: `${bar.leftPercent}%`,
                            width: `${bar.widthPercent}%`,
                            top: "6px",
                            height: "20px",
                            borderRadius: "5px",
                            backgroundColor: "var(--bg-active)",
                            border: hasDeps
                              ? "1px solid var(--accent-red)"
                              : `1px solid ${bar.color || "var(--accent-indigo)"}`,
                            overflow: "hidden",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            zIndex: 2,
                          }}
                          title={`${bar.title} (${bar.startDate} → ${bar.endDate}, ${bar.durationDays} ${t.daysUnit}, ${bar.progressPercent}%)`}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: `${bar.progressPercent}%`,
                              backgroundColor: bar.color || "var(--accent-indigo)",
                              opacity: 0.75,
                            }}
                          />
                          <span
                            style={{
                              position: "relative",
                              zIndex: 1,
                              padding: "0 8px",
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "#ffffff",
                              whiteSpace: "nowrap",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {bar.progressPercent}%
                            {bar.storyPoints ? ` • ${bar.storyPoints} SP` : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Today Marker Legend */}
              <div
                style={{
                  marginTop: "14px",
                  paddingTop: "10px",
                  borderTop: "1px solid var(--border-color)",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "10px", height: "2px", backgroundColor: "var(--accent-red)", display: "inline-block" }} />
                  {t.todayMarker}: {ganttData.todayDate}
                </span>
                <span>
                  {visibleGanttBars.length} Roadmap Bars
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: AGILE METRICS (BURNDOWN, SCOPE-CREEP BURNUP, CFD, IMPEDIMENTS)
         ===================================================================== */}
      {activeTab === "metrics" && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* Scope Selector */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
                {t.metricsScope}:
              </span>
              <select
                className="settings-select"
                style={{ width: "auto", minWidth: "220px", padding: "6px 12px" }}
                value={metricsSprintId}
                onChange={(e) => setMetricsSprintId(e.target.value)}
              >
                {activeSprint && (
                  <option value="active">
                    {activeSprint.name} ({t.sprintStates[activeSprint.state]})
                  </option>
                )}
                {sprints
                  .filter((s) => s.id !== activeSprint?.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({t.sprintStates[s.state]})
                    </option>
                  ))}
                <option value="all">{t.allIssuesScope}</option>
              </select>
            </div>
          </div>

          {/* KPI Summary Cards (Real Story Points!) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px",
            }}
          >
            <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                {t.kpiTotalSp}
              </div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                {metrics.totalPoints} SP
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                {metrics.totalIssues} Tickets • Committed: {metrics.committedPoints} SP
              </div>
            </div>

            <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                {t.kpiCompletedSp}
              </div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--accent-green)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                {metrics.completedPoints} SP ({metrics.completionRate}%)
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                {metrics.completedIssues} / {metrics.totalIssues} Done
              </div>
            </div>

            <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                {t.kpiInProgressSp}
              </div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--accent-blue)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                {metrics.inProgressPoints} SP
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Todo / Ready: {metrics.todoPoints} SP
              </div>
            </div>

            <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                {t.kpiImpediments}
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: impediments.length > 0 ? "var(--accent-red)" : "var(--accent-green)",
                  fontFamily: "var(--font-mono)",
                  marginTop: "4px",
                }}
              >
                {impediments.length}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                {metrics.scopeCreepPoints > 0
                  ? `+${metrics.scopeCreepPoints} SP ${t.scopeCreepBadge}`
                  : "0 SP Scope Creep"}
              </div>
            </div>
          </div>

          {/* Charts Row 1: Real SP Burndown + Scope-Creep Burnup */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
              gap: "18px",
            }}
          >
            {/* Chart 1: Burndown SVG */}
            <div
              style={{
                backgroundColor: "var(--bg-sidebar)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700 }}>
                  <TrendingDown size={16} style={{ color: "var(--accent-indigo)" }} />
                  {t.burndownTitle}
                </div>
                <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  Remaining: {metrics.remainingPoints} SP
                </span>
              </div>

              {(() => {
                const series = metrics.burndownSeries;
                const maxY = Math.max(
                  10,
                  metrics.totalPoints,
                  metrics.committedPoints,
                  ...series.map((p) => Math.max(p.idealRemaining, p.actualRemaining ?? 0))
                );
                const w = 440;
                const h = 190;
                const padL = 42;
                const padR = 16;
                const padT = 16;
                const padB = 28;
                const plotW = w - padL - padR;
                const plotH = h - padT - padB;

                const xAt = (idx: number) =>
                  padL + (idx / Math.max(1, series.length - 1)) * plotW;
                const yAt = (val: number) => padT + plotH - (val / maxY) * plotH;

                const idealPts = series
                  .map((p, idx) => `${xAt(idx).toFixed(1)},${yAt(p.idealRemaining).toFixed(1)}`)
                  .join(" ");
                const actualEntries = series
                  .map((p, idx) =>
                    p.actualRemaining !== null
                      ? { x: xAt(idx), y: yAt(p.actualRemaining), val: p.actualRemaining }
                      : null
                  )
                  .filter((v): v is { x: number; y: number; val: number } => v !== null);
                const actualPts = actualEntries
                  .map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
                  .join(" ");

                return (
                  <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "195px" }}>
                    {[0, 0.5, 1].map((ratio, i) => {
                      const val = Math.round(maxY * ratio);
                      const y = yAt(val);
                      return (
                        <g key={i}>
                          <line
                            x1={padL}
                            y1={y}
                            x2={w - padR}
                            y2={y}
                            stroke="var(--border-color)"
                            strokeDasharray={ratio === 0 ? undefined : "3 3"}
                          />
                          <text x={6} y={y + 3} fill="var(--text-muted)" fontSize="9">
                            {val} SP
                          </text>
                        </g>
                      );
                    })}

                    <polyline
                      points={idealPts}
                      fill="none"
                      stroke="var(--text-muted)"
                      strokeWidth="1.75"
                      strokeDasharray="5 4"
                    />

                    {actualEntries.length > 1 && (
                      <polyline
                        points={actualPts}
                        fill="none"
                        stroke="var(--accent-indigo)"
                        strokeWidth="2.6"
                      />
                    )}

                    {actualEntries.map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r="3.2"
                        fill="var(--accent-indigo)"
                        stroke="var(--bg-sidebar)"
                        strokeWidth="1.2"
                      />
                    ))}

                    {series.map((p, idx) => {
                      if (series.length > 8 && idx % 2 !== 0 && idx !== series.length - 1) {
                        return null;
                      }
                      return (
                        <text
                          key={idx}
                          x={xAt(idx)}
                          y={h - 8}
                          fill="var(--text-muted)"
                          fontSize="8.5"
                          textAnchor="middle"
                        >
                          {p.label}
                        </text>
                      );
                    })}
                  </svg>
                );
              })()}

              <div style={{ display: "flex", justifyContent: "center", gap: "18px", fontSize: "11px", color: "var(--text-secondary)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "14px", borderTop: "2px dashed var(--text-muted)", display: "inline-block" }} />
                  {t.idealLine}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "14px", borderTop: "2.5px solid var(--accent-indigo)", display: "inline-block" }} />
                  {t.actualLine}
                </span>
              </div>
            </div>

            {/* Chart 2: Scope-Creep Burnup SVG */}
            <div
              style={{
                backgroundColor: "var(--bg-sidebar)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700 }}>
                  <TrendingUp size={16} style={{ color: "var(--accent-green)" }} />
                  {t.burnupTitle}
                </div>
                {metrics.scopeCreepPoints > 0 && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "999px",
                      backgroundColor: "rgba(245, 158, 11, 0.16)",
                      color: "var(--accent-yellow)",
                      fontSize: "10px",
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    +{metrics.scopeCreepPoints} SP {t.scopeCreepBadge}
                  </span>
                )}
              </div>

              {(() => {
                const series = metrics.burnupSeries;
                const maxY = Math.max(
                  10,
                  metrics.totalPoints,
                  ...series.map((p) => p.scopePoints)
                );
                const w = 440;
                const h = 190;
                const padL = 42;
                const padR = 16;
                const padT = 16;
                const padB = 28;
                const plotW = w - padL - padR;
                const plotH = h - padT - padB;

                const xAt = (idx: number) =>
                  padL + (idx / Math.max(1, series.length - 1)) * plotW;
                const yAt = (val: number) => padT + plotH - (val / maxY) * plotH;

                const scopePts = series
                  .map((p, idx) => `${xAt(idx).toFixed(1)},${yAt(p.scopePoints).toFixed(1)}`)
                  .join(" ");

                const doneEntries = series
                  .map((p, idx) =>
                    p.completedPoints !== null
                      ? { x: xAt(idx), y: yAt(p.completedPoints) }
                      : null
                  )
                  .filter((v): v is { x: number; y: number } => v !== null);

                const donePts = doneEntries
                  .map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
                  .join(" ");

                const areaPts =
                  doneEntries.length > 1
                    ? `${doneEntries[0].x.toFixed(1)},${yAt(0).toFixed(1)} ${donePts} ${doneEntries[
                        doneEntries.length - 1
                      ].x.toFixed(1)},${yAt(0).toFixed(1)}`
                    : "";

                return (
                  <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "195px" }}>
                    {[0, 0.5, 1].map((ratio, i) => {
                      const val = Math.round(maxY * ratio);
                      const y = yAt(val);
                      return (
                        <g key={i}>
                          <line
                            x1={padL}
                            y1={y}
                            x2={w - padR}
                            y2={y}
                            stroke="var(--border-color)"
                            strokeDasharray={ratio === 0 ? undefined : "3 3"}
                          />
                          <text x={6} y={y + 3} fill="var(--text-muted)" fontSize="9">
                            {val} SP
                          </text>
                        </g>
                      );
                    })}

                    {/* Total Scope Line (reveals Scope Creep step-ups) */}
                    <polyline
                      points={scopePts}
                      fill="none"
                      stroke="var(--accent-yellow)"
                      strokeWidth="2"
                      strokeDasharray="6 3"
                    />

                    {/* Completed Area & Line */}
                    {areaPts && (
                      <polygon points={areaPts} fill="rgba(16, 185, 129, 0.14)" />
                    )}
                    {doneEntries.length > 1 && (
                      <polyline
                        points={donePts}
                        fill="none"
                        stroke="var(--accent-green)"
                        strokeWidth="2.6"
                      />
                    )}
                    {doneEntries.map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r="3"
                        fill="var(--accent-green)"
                      />
                    ))}

                    {series.map((p, idx) => {
                      if (series.length > 8 && idx % 2 !== 0 && idx !== series.length - 1) {
                        return null;
                      }
                      return (
                        <text
                          key={idx}
                          x={xAt(idx)}
                          y={h - 8}
                          fill="var(--text-muted)"
                          fontSize="8.5"
                          textAnchor="middle"
                        >
                          {p.label}
                        </text>
                      );
                    })}
                  </svg>
                );
              })()}

              <div style={{ display: "flex", justifyContent: "center", gap: "18px", fontSize: "11px", color: "var(--text-secondary)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "14px", borderTop: "2px dashed var(--accent-yellow)", display: "inline-block" }} />
                  {t.scopeLine}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "14px", borderTop: "2.5px solid var(--accent-green)", display: "inline-block" }} />
                  {t.completedLine}
                </span>
              </div>
            </div>
          </div>

          {/* Charts Row 2: Status Distribution / CFD + Impediment Tracker */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
              gap: "18px",
            }}
          >
            {/* Status Distribution & Cumulative Flow */}
            <div
              style={{
                backgroundColor: "var(--bg-sidebar)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                <BarChart3 size={16} style={{ color: "var(--accent-indigo)" }} />
                {t.cfdTitle}
              </div>

              {/* Stacked Horizontal Bar of Real SP */}
              <div
                style={{
                  width: "100%",
                  height: "18px",
                  borderRadius: "999px",
                  overflow: "hidden",
                  display: "flex",
                  backgroundColor: "var(--bg-panel)",
                  border: "1px solid var(--border-color)",
                }}
              >
                {BOARD_COLUMNS.slice()
                  .reverse()
                  .map(({ status, color }) => {
                    const sp = metrics.pointsByStatus[status] || 0;
                    const pct = metrics.totalPoints > 0 ? (sp / metrics.totalPoints) * 100 : 0;
                    if (pct <= 0) return null;
                    return (
                      <div
                        key={status}
                        style={{ width: `${pct}%`, height: "100%", backgroundColor: color }}
                        title={`${t.columns[status]}: ${sp} SP`}
                      />
                    );
                  })}
              </div>

              {/* Per-Status Breakdown Rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {BOARD_COLUMNS.map(({ status, color }) => {
                  const cnt = metrics.statusCounts[status] || 0;
                  const sp = metrics.pointsByStatus[status] || 0;
                  const pct =
                    metrics.totalPoints > 0 ? Math.round((sp / metrics.totalPoints) * 100) : 0;
                  return (
                    <div
                      key={status}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        backgroundColor: "var(--bg-panel)",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            width: "9px",
                            height: "9px",
                            borderRadius: "50%",
                            backgroundColor: color,
                          }}
                        />
                        <span style={{ fontWeight: 600 }}>{t.columns[status]}</span>
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)" }}>
                        {cnt} Tickets • <strong>{sp} SP</strong> ({pct}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Impediment & Blocker Tracker */}
            <div
              style={{
                backgroundColor: "var(--bg-sidebar)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertOctagon size={16} style={{ color: "var(--accent-red)" }} />
                {t.impedimentsTitle} ({impediments.length})
              </div>

              {impediments.length === 0 ? (
                <div
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    fontSize: "12px",
                    color: "var(--accent-green)",
                    backgroundColor: "rgba(16, 185, 129, 0.06)",
                    borderRadius: "8px",
                    border: "1px dashed rgba(16, 185, 129, 0.3)",
                  }}
                >
                  {t.noImpediments}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {impediments.map((imp) => (
                    <div
                      key={imp.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(239, 68, 68, 0.07)",
                        border: "1px solid rgba(239, 68, 68, 0.28)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {imp.title}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                          {imp.assignee}
                          {imp.blockedBy.length > 0 ? ` • Blocked by: ${imp.blockedBy.join(", ")}` : ""}
                          {` • ${imp.filePath}`}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (imp.source === "issue") {
                            const found = allIssues.find((i) => i.id === imp.id);
                            if (found) {
                              setDrawerIssue(found);
                              setDrawerIsNew(false);
                              return;
                            }
                          }
                          onOpenFile(imp.filePath);
                        }}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border-color)",
                          backgroundColor: "var(--bg-sidebar)",
                          color: "var(--text-primary)",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        {t.openSourceBtn}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Issue Drawer */}
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

      {/* Real-time Planning Poker Modal */}
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
