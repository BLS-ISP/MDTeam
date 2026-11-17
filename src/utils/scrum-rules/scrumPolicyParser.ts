import type { WorkspaceFile } from "../issueEngine";
import { escapeYamlString, extractFrontmatter, normalizePath } from "../frontmatter";
import type {
  ScrumPolicyConfig,
  ScrumProcessMode,
  ScrumUserRole,
} from "../../types/scrumPolicy";

export const SCRUM_POLICY_FILE_PATH = ".mdteam/scrum-policy.md";

export const DEFAULT_SCRUM_POLICY: ScrumPolicyConfig = {
  mode: "pragmatic",
  productGoal:
    "Deliver an enterprise-ready, Git-native Scrum & Confluence workspace with transparent quality governance.",
  productGoalTargetDate: "",
  sprintDurationDays: 14,
  requireDorBeforeSprint: true,
  requireDodBeforeDone: true,
  enforcePoBacklogOrder: true,
  requireRetroActionItem: true,
};

export function normalizeScrumRole(
  rawRole?: ScrumUserRole | null
): "admin" | "product-owner" | "scrum-master" | "developer" | "stakeholder" {
  const clean = (rawRole || "").trim().toLowerCase().replace(/^@+/, "");
  if (clean === "admin" || clean === "administrator") return "admin";
  if (clean === "product-owner" || clean === "productowner" || clean === "po") {
    return "product-owner";
  }
  if (
    clean === "scrum-master" ||
    clean === "scrummaster" ||
    clean === "sm" ||
    clean === "scrum"
  ) {
    return "scrum-master";
  }
  if (clean === "stakeholder" || clean === "viewer" || clean === "guest") {
    return "stakeholder";
  }
  return "developer";
}

export function isProductOwnerOrAdmin(role?: ScrumUserRole | null): boolean {
  const r = normalizeScrumRole(role);
  return r === "product-owner" || r === "admin";
}

export function canManageScrumPolicy(role?: ScrumUserRole | null): boolean {
  const r = normalizeScrumRole(role);
  return r === "scrum-master" || r === "product-owner" || r === "admin";
}

function parseBoolScalar(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "yes" || v === "1") return true;
  if (v === "false" || v === "no" || v === "0") return false;
  return fallback;
}

export function applyProcessModePreset(
  current: ScrumPolicyConfig,
  mode: ScrumProcessMode
): ScrumPolicyConfig {
  if (mode === "kanban") {
    return {
      ...current,
      mode: "kanban",
      requireDorBeforeSprint: false,
      requireDodBeforeDone: false,
      enforcePoBacklogOrder: false,
      requireRetroActionItem: false,
    };
  }
  return {
    ...current,
    mode,
    requireDorBeforeSprint: true,
    requireDodBeforeDone: true,
    enforcePoBacklogOrder: true,
    requireRetroActionItem: true,
  };
}

export function parseScrumPolicy(
  input?: WorkspaceFile[] | WorkspaceFile | string | null
): ScrumPolicyConfig {
  let rawMarkdown = "";
  if (typeof input === "string") {
    rawMarkdown = input;
  } else if (Array.isArray(input)) {
    const found = input.find(
      (f) => normalizePath(f.path) === SCRUM_POLICY_FILE_PATH
    );
    if (!found) return { ...DEFAULT_SCRUM_POLICY };
    rawMarkdown = found.content || "";
  } else if (input && typeof input === "object" && "content" in input) {
    rawMarkdown = input.content || "";
  } else {
    return { ...DEFAULT_SCRUM_POLICY };
  }

  if (!rawMarkdown.trim()) return { ...DEFAULT_SCRUM_POLICY };

  const { scalars, body } = extractFrontmatter(rawMarkdown);
  const rawMode = (scalars.mode || "pragmatic").trim().toLowerCase();
  const mode: ScrumProcessMode =
    rawMode === "strict" || rawMode === "kanban" ? rawMode : "pragmatic";

  let goalFromBody = "";
  let inProductGoal = false;
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (/^##\s+(product\s+goal|produkt-?ziel)/i.test(trimmed)) {
      inProductGoal = true;
      continue;
    }
    if (inProductGoal && trimmed.startsWith("## ")) break;
    if (inProductGoal && trimmed && !trimmed.startsWith("_Define")) {
      goalFromBody += (goalFromBody ? "\n" : "") + trimmed;
    }
  }

  const parsedDays = Number(scalars.sprint_duration_days ?? scalars.sprintdurationdays ?? 14);
  const sprintDurationDays =
    Number.isFinite(parsedDays) && parsedDays >= 1 && parsedDays <= 31
      ? Math.round(parsedDays)
      : 14;

  const isKanban = mode === "kanban";
  const productGoal =
    (goalFromBody || scalars.product_goal || DEFAULT_SCRUM_POLICY.productGoal).trim();
  const targetDate = (scalars.product_goal_target_date || "").trim() || undefined;

  return {
    mode,
    productGoal,
    productGoalTargetDate: targetDate,
    sprintDurationDays,
    requireDorBeforeSprint: parseBoolScalar(scalars.require_dor_before_sprint, !isKanban),
    requireDodBeforeDone: parseBoolScalar(scalars.require_dod_before_done, !isKanban),
    enforcePoBacklogOrder: parseBoolScalar(scalars.enforce_po_backlog_order, !isKanban),
    requireRetroActionItem: parseBoolScalar(scalars.require_retro_action_item, !isKanban),
  };
}

export function serializeScrumPolicyToMarkdown(
  policy: ScrumPolicyConfig
): WorkspaceFile {
  const cleanGoal = (policy.productGoal || DEFAULT_SCRUM_POLICY.productGoal).trim();
  const lines = [
    "---",
    `mode: ${escapeYamlString(policy.mode)}`,
    `product_goal: ${escapeYamlString(cleanGoal)}`,
    `product_goal_target_date: ${escapeYamlString(policy.productGoalTargetDate || "")}`,
    `sprint_duration_days: ${Math.max(1, Math.min(31, Math.round(policy.sprintDurationDays || 14)))}`,
    `require_dor_before_sprint: ${Boolean(policy.requireDorBeforeSprint)}`,
    `require_dod_before_done: ${Boolean(policy.requireDodBeforeDone)}`,
    `enforce_po_backlog_order: ${Boolean(policy.enforcePoBacklogOrder)}`,
    `require_retro_action_item: ${Boolean(policy.requireRetroActionItem)}`,
    "---",
    "",
    "# Scrum Process Policy & Product Goal",
    "",
    "## Product Goal",
    "",
    cleanGoal,
    "",
    "## Governance Rules",
    "",
    `- **Process Mode:** \`${policy.mode}\``,
    `- **Sprint Duration:** ${policy.sprintDurationDays} days`,
    `- **Definition of Ready Gate:** ${policy.requireDorBeforeSprint ? "Enabled" : "Disabled"}`,
    `- **Definition of Done Gate:** ${policy.requireDodBeforeDone ? "Enabled" : "Disabled"}`,
    `- **PO Backlog Ordering:** ${policy.enforcePoBacklogOrder ? "Enforced" : "Flexible"}`,
    `- **Retro Action Commitment:** ${policy.requireRetroActionItem ? "Required" : "Optional"}`,
    "",
  ];

  return {
    path: SCRUM_POLICY_FILE_PATH,
    name: "scrum-policy.md",
    category: ".mdteam",
    content: lines.join("\n"),
  };
}
