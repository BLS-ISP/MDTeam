export type ScrumRole =
  | "admin"
  | "product-owner"
  | "scrum-master"
  | "developer"
  | "stakeholder";

export type AuthProviderType = "local" | "oidc";

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

export interface StoredUserRecord extends AuthUser {
  passwordHash?: string;
  passwordSalt?: string;
  oidcSubject?: string;
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

export type OidcProviderPreset =
  | "keycloak"
  | "entra-id"
  | "github"
  | "gitlab"
  | "custom";

export interface OidcServerConfig {
  enabled: boolean;
  provider: OidcProviderPreset;
  issuerUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  defaultRole: ScrumRole;
}

export interface PersistedStoreData {
  version: number;
  users: StoredUserRecord[];
  webhooks: WebhookConfig;
  oidc: OidcServerConfig;
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

const ROLE_ACTIONS: Record<ScrumRole, ReadonlySet<ScrumAction>> = {
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

export function isValidScrumRole(value: unknown): value is ScrumRole {
  return (
    value === "admin" ||
    value === "product-owner" ||
    value === "scrum-master" ||
    value === "developer" ||
    value === "stakeholder"
  );
}

export function isValidScrumAction(value: unknown): value is ScrumAction {
  return (
    value === "reorder_product_backlog" ||
    value === "edit_product_goal" ||
    value === "accept_sprint_review" ||
    value === "manage_scrum_policy" ||
    value === "pull_to_sprint" ||
    value === "edit_issue" ||
    value === "edit_wiki" ||
    value === "approve_wiki" ||
    value === "comment_or_feedback" ||
    value === "manage_users"
  );
}

export function canRolePerform(role: ScrumRole, action: ScrumAction): boolean {
  const set = ROLE_ACTIONS[role];
  return set ? set.has(action) : false;
}
