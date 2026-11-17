export type ScrumRole =
  | "admin"
  | "product-owner"
  | "scrum-master"
  | "developer"
  | "stakeholder";

export type AuthProviderType = "local" | "oidc" | "ldap";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  handle: string;
  role: ScrumRole;
  authProvider: AuthProviderType;
  createdAt?: string;
  lastLoginAt?: string;
}

export type WebhookEventType =
  | "mention"
  | "blocker"
  | "review"
  | "sprint"
  | "assignment";

export interface WebhookConfig {
  teamsWebhookUrl: string;
  slackWebhookUrl: string;
  emailWebhookUrl: string;
  events: WebhookEventType[];
}

export type ScrumAction =
  | "reorder_product_backlog"
  | "edit_product_goal"
  | "accept_sprint_review"
  | "manage_scrum_policy"
  | "pull_to_sprint"
  | "edit_issue"
  | "edit_wiki"
  | "approve_wiki"
  | "comment_or_feedback"
  | "manage_users";

export type OidcProviderPreset =
  | "keycloak"
  | "entra-id"
  | "github"
  | "gitlab"
  | "custom";

export interface OidcClientConfig {
  enabled: boolean;
  provider: OidcProviderPreset;
  issuerUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  clientId: string;
  clientSecret?: string;
  hasClientSecret?: boolean;
  redirectUri: string;
  scopes: string;
  defaultRole: ScrumRole;
}

export interface WebhookDispatchInput {
  event: WebhookEventType;
  title: string;
  summary: string;
  projectId?: string;
  targetPath?: string;
  url?: string;
  severity?: "info" | "warning" | "critical";
  recipientHandle?: string;
}

export interface WebhookDeliveryChannelResult {
  channel: "teams" | "slack" | "email";
  ok: boolean;
  status?: number;
  error?: string;
}

export interface ServerConflictEntry {
  path: string;
  base: string;
  ours: string;
  theirs: string;
  working: string;
}

export interface ServerGitStatusSummary {
  projectId: string;
  branch: string;
  headSha: string;
  remoteUrl: string;
  ahead: number;
  behind: number;
  modified: string[];
  untracked: string[];
  conflicts: string[];
}

const SCRUM_PERMISSIONS: Record<ScrumRole, ReadonlySet<ScrumAction>> = {
  admin: new Set<ScrumAction>([
    "reorder_product_backlog",
    "edit_product_goal",
    "accept_sprint_review",
    "manage_scrum_policy",
    "pull_to_sprint",
    "edit_issue",
    "edit_wiki",
    "approve_wiki",
    "comment_or_feedback",
    "manage_users",
  ]),
  "product-owner": new Set<ScrumAction>([
    "reorder_product_backlog",
    "edit_product_goal",
    "accept_sprint_review",
    "pull_to_sprint",
    "edit_issue",
    "edit_wiki",
    "approve_wiki",
    "comment_or_feedback",
  ]),
  "scrum-master": new Set<ScrumAction>([
    "manage_scrum_policy",
    "pull_to_sprint",
    "edit_issue",
    "edit_wiki",
    "approve_wiki",
    "comment_or_feedback",
  ]),
  developer: new Set<ScrumAction>([
    "pull_to_sprint",
    "edit_issue",
    "edit_wiki",
    "comment_or_feedback",
  ]),
  stakeholder: new Set<ScrumAction>(["comment_or_feedback"]),
};

export function canRolePerform(role: ScrumRole, action: ScrumAction): boolean {
  const allowed = SCRUM_PERMISSIONS[role];
  return allowed ? allowed.has(action) : false;
}

export function mapScrumRoleToWorkspaceMode(
  role: ScrumRole
): "developer" | "scrum" | "stakeholder" {
  if (role === "stakeholder") return "stakeholder";
  if (role === "product-owner" || role === "scrum-master") return "scrum";
  return "developer";
}
