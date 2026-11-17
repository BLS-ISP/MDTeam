import type { AgileIssue } from "./agile";

export type ScrumProcessMode = "strict" | "pragmatic" | "kanban";

export type ScrumUserRole =
  | "admin"
  | "product-owner"
  | "scrum-master"
  | "developer"
  | "stakeholder"
  | (string & {});

export type ScrumCeremonyId = "planning" | "daily" | "review" | "retro";

export interface ScrumPolicyConfig {
  mode: ScrumProcessMode;
  productGoal: string;
  productGoalTargetDate?: string;
  sprintDurationDays: number;
  requireDorBeforeSprint: boolean;
  requireDodBeforeDone: boolean;
  enforcePoBacklogOrder: boolean;
  requireRetroActionItem: boolean;
}

export interface GateCheckResult {
  allowed: boolean;
  canOverrideWithReason: boolean;
  ruleCode: string;
  title: string;
  violations: string[];
}

export interface CeremonySubtaskItem {
  id: string;
  title: string;
  done: boolean;
  assignee?: string;
  estimatedHours?: number;
  remainingHours?: number;
}

export interface StrictVelocityBreakdown {
  velocityPoints: number;
  totalScopePoints: number;
  undonePointsZeroed: number;
  acceptedDoneIssues: AgileIssue[];
  dodViolatingDoneIssues: AgileIssue[];
  unfinishedIssues: AgileIssue[];
}

export interface OverrideAuditEntry {
  issueId: string;
  issueTitle: string;
  author: string;
  timestamp: string;
  ruleCode: string;
  reason: string;
}

export type RetroStickyCategory = "glad" | "sad" | "impediment";

export interface RetroStickyCard {
  id: string;
  category: RetroStickyCategory;
  text: string;
  author: string;
  votes: number;
  voters: string[];
  createdAt: string;
}

export interface DailyParkingLotItem {
  id: string;
  topic: string;
  participants: string;
  resolved: boolean;
  createdAt: string;
}
