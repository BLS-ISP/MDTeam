import React from "react";
import { Layers, Bug, Bookmark, Zap, BookOpen } from "lucide-react";
import { IssuePriority, IssueStatus, IssueType } from "../../utils/issueEngine";

export type SwimlaneMode = "none" | "assignee" | "epic" | "priority";

export const BOARD_COLUMNS: { status: IssueStatus; color: string }[] = [
  { status: "backlog", color: "var(--text-muted)" },
  { status: "ready", color: "#a855f7" },
  { status: "in-progress", color: "var(--accent-blue)" },
  { status: "review", color: "var(--accent-yellow)" },
  { status: "done", color: "var(--accent-green)" },
];

export const DEFAULT_WIP_LIMITS: Record<IssueStatus, number> = {
  backlog: 0,
  ready: 6,
  "in-progress": 3,
  review: 2,
  done: 0,
};

export const scrumCopy = {
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
    sprintCompletedToast:
      "Sprint abgeschlossen! Offene Tickets verschoben & Velocity in capacity.md protokolliert.",
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
    sprintCompletedToast:
      "Sprint completed! Unfinished issues rolled over & velocity logged to capacity.md.",
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

export type ScrumCopy = typeof scrumCopy.de;

export function renderIssueTypeIcon(type: IssueType, size = 12): React.ReactElement {
  switch (type) {
    case "epic":
      return React.createElement(Layers, { size, style: { color: "#a855f7" } });
    case "bug":
      return React.createElement(Bug, { size, style: { color: "var(--accent-red)" } });
    case "story":
      return React.createElement(Bookmark, { size, style: { color: "var(--accent-green)" } });
    case "spike":
      return React.createElement(Zap, { size, style: { color: "var(--accent-yellow)" } });
    default:
      return React.createElement(BookOpen, { size, style: { color: "var(--accent-blue)" } });
  }
}

export function priorityColor(priority: IssuePriority): string {
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
