export type IssueType = "epic" | "story" | "bug" | "task" | "spike";
export type IssueStatus = "backlog" | "ready" | "in-progress" | "review" | "done";
export type IssuePriority = "critical" | "high" | "medium" | "low";
export type ReleaseState = "planned" | "unreleased" | "released";

export interface IssueSubtask {
  id: string;
  title: string;
  done: boolean;
  assignee?: string;
  estimatedHours?: number;
  remainingHours?: number;
}

export interface IssueAttachment {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  sizeBytes?: number;
  addedAt: string;
  dataUrl?: string;
}

export interface AgileRelease {
  id: string;
  version: string;
  name: string;
  targetDate: string;
  state: ReleaseState;
  description: string;
}

export interface ReleaseProgress {
  version: string;
  totalIssues: number;
  doneIssues: number;
  inProgressIssues: number;
  openIssues: number;
  issueProgressPercent: number;
  totalPoints: number;
  donePoints: number;
  pointsProgressPercent: number;
}

export interface AgileIssue {
  id: string;
  type: IssueType;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  storyPoints: number;
  sprint: string;
  epic: string;
  assignee: string;
  reporter: string;
  labels: string[];
  blockedBy: string[];
  branch: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  acceptanceCriteria: { text: string; checked: boolean }[];
  comments: { author: string; timestamp: string; text: string }[];
  startDate?: string;
  endDate?: string;
  filePath: string;
  isVirtualLegacy?: boolean;
  // Deep Jira Ticket Mechanics (optional for 100% backward compatibility)
  subtasks?: IssueSubtask[];
  attachments?: IssueAttachment[];
  fixVersion?: string;
  estimatedHours?: number;
  loggedHours?: number;
  remainingHours?: number;
  reviewAccepted?: boolean;
}

export interface AgileSprint {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  state: "planned" | "active" | "closed";
  committedPoints: number;
  completedPoints?: number;
  filePath: string;
}

export interface SprintSeriesPoint {
  dayIndex: number;
  label: string;
  date: string;
  idealRemaining: number;
  actualRemaining: number | null;
  completedPoints: number | null;
  scopePoints: number;
}

export interface CumulativeFlowDayPoint {
  dayIndex: number;
  label: string;
  date: string;
  backlog: number;
  ready: number;
  inProgress: number;
  review: number;
  done: number;
}

export interface SprintMetrics {
  // Concise Story Point sums
  total: number;
  completed: number;
  inProgress: number;
  review: number;
  ready: number;
  backlog: number;
  todo: number;
  remaining: number;
  committed: number;
  scopeCreep: number;

  // Explicit Story Point sums
  totalPoints: number;
  completedPoints: number;
  inProgressPoints: number;
  reviewPoints: number;
  readyPoints: number;
  backlogPoints: number;
  todoPoints: number;
  remainingPoints: number;
  committedPoints: number;
  scopeCreepPoints: number;
  completionRate: number;

  // Counts & distributions
  totalIssues: number;
  completedIssues: number;
  blockedIssues: AgileIssue[];
  cumulativeFlowCounts: Record<IssueStatus, number>;
  statusCounts: Record<IssueStatus, number>;
  pointsByStatus: Record<IssueStatus, number>;

  // Time-series charts
  burndownSeries: SprintSeriesPoint[];
  burnupSeries: SprintSeriesPoint[];
  cfdSeries: CumulativeFlowDayPoint[];
  hoursBurndownSeries?: SprintSeriesPoint[];
  totalEstimatedHours?: number;
  totalLoggedHours?: number;
  totalRemainingHours?: number;
}

export interface GanttBar {
  id: string;
  title: string;
  source: "epic" | "issue" | "roadmap";
  status: IssueStatus | "completed" | "pending";
  assignee: string;
  milestone?: string;
  startDate: string;
  endDate: string;
  startMs: number;
  endMs: number;
  durationDays: number;
  leftPercent: number;
  widthPercent: number;
  progressPercent: number;
  storyPoints?: number;
  completedPoints?: number;
  blockedBy: string[];
  epic?: string;
  color?: string;
  filePath: string;
}

export interface GanttTimelineResult {
  bars: GanttBar[];
  axisTicks: { label: string; subLabel?: string; date: string; leftPercent: number }[];
  rangeStart: string;
  rangeEnd: string;
  rangeStartMs: number;
  rangeEndMs: number;
  totalDays: number;
  todayDate: string;
  todayPercent: number | null;
}

export interface TeamCapacityMember {
  member: string;
  days: number;
  focus: number;
  capacity: number;
}

export interface VelocityRecord {
  sprint: string;
  planned: number;
  actual: number;
}

export interface WorkspaceImpediment {
  id: string;
  source: "issue" | "markdown";
  title: string;
  assignee: string;
  blockedBy: string[];
  filePath: string;
  line?: number;
}

export const FIBONACCI_POINTS = [0, 1, 2, 3, 5, 8, 13, 21] as const;
