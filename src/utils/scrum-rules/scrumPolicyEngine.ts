import type { AgileIssue, AgileSprint } from "../issueEngine";
import type {
  GateCheckResult,
  OverrideAuditEntry,
  ScrumPolicyConfig,
  ScrumProcessMode,
  ScrumUserRole,
  StrictVelocityBreakdown,
} from "../../types/scrumPolicy";
import { getIssueSubtasks } from "./ceremonyIssueHelpers";
import { normalizeScrumRole } from "./scrumPolicyParser";

export {
  SCRUM_POLICY_FILE_PATH,
  DEFAULT_SCRUM_POLICY,
  normalizeScrumRole,
  isProductOwnerOrAdmin,
  canManageScrumPolicy,
  applyProcessModePreset,
  parseScrumPolicy,
  serializeScrumPolicyToMarkdown,
} from "./scrumPolicyParser";

function buildGateOutcome(
  policyMode: ScrumProcessMode,
  gateEnabled: boolean,
  ruleCode: string,
  title: string,
  violations: string[]
): GateCheckResult {
  if (!gateEnabled || policyMode === "kanban" || violations.length === 0) {
    return {
      allowed: true,
      canOverrideWithReason: false,
      ruleCode,
      title,
      violations: gateEnabled && policyMode !== "kanban" ? [] : violations,
    };
  }
  return {
    allowed: false,
    canOverrideWithReason: policyMode !== "strict",
    ruleCode,
    title,
    violations,
  };
}

function buildStakeholderBlock(title: string, isEn: boolean, msgEn: string, msgDe: string): GateCheckResult {
  return {
    allowed: false,
    canOverrideWithReason: false,
    ruleCode: "STAKEHOLDER_READONLY",
    title,
    violations: [isEn ? msgEn : msgDe],
  };
}

export function inspectIssueDorViolations(
  issue: AgileIssue,
  allIssues?: AgileIssue[],
  language: "de" | "en" = "de"
): string[] {
  const isEn = language === "en";
  const violations: string[] = [];

  if (
    (issue.type === "story" || issue.type === "task") &&
    (!Number.isFinite(issue.storyPoints) || issue.storyPoints <= 0)
  ) {
    violations.push(
      isEn
        ? `${issue.id}: Story Points (> 0) estimate is missing for ${issue.type}.`
        : `${issue.id}: Story-Points-Schätzung (> 0) fehlt für Typ „${issue.type}“.`
    );
  }

  const validAcCount = (issue.acceptanceCriteria || []).filter((ac) => {
    const t = (ac.text || "").trim();
    return t.length > 0 && t.toLowerCase() !== "define acceptance criteria";
  }).length;
  if (validAcCount < 1) {
    violations.push(
      isEn
        ? `${issue.id}: At least 1 Acceptance Criterion is required (DoR).`
        : `${issue.id}: Mindestens 1 Akzeptanzkriterium erforderlich (DoR).`
    );
  }

  const openBlockers = (issue.blockedBy || [])
    .map((id) => id.trim())
    .filter((bId) => {
      if (!bId) return false;
      if (!allIssues) return true;
      const blocker = allIssues.find((x) => x.id.toLowerCase() === bId.toLowerCase());
      return !blocker || blocker.status !== "done";
    });
  if (openBlockers.length > 0) {
    violations.push(
      isEn
        ? `${issue.id}: Blocked by unresolved issue(s): ${openBlockers.join(", ")}.`
        : `${issue.id}: Blockiert durch offene Tickets: ${openBlockers.join(", ")}.`
    );
  }

  if (!issue.assignee || !issue.assignee.trim()) {
    violations.push(
      isEn
        ? `${issue.id}: Assignee (@handle) is missing.`
        : `${issue.id}: Verantwortliche Person (Assignee) fehlt.`
    );
  }

  if (!issue.description || !issue.description.trim()) {
    violations.push(
      isEn
        ? `${issue.id}: Clear issue description is missing.`
        : `${issue.id}: Fachliche Beschreibung (Description) fehlt.`
    );
  }

  return violations;
}

export function evaluatePullIntoSprint(
  issue: AgileIssue,
  sprint: AgileSprint | undefined | null,
  policy: ScrumPolicyConfig,
  userRole?: ScrumUserRole,
  languageOrAllIssues?: "de" | "en" | AgileIssue[],
  maybeLanguage?: "de" | "en"
): GateCheckResult {
  const allIssues = Array.isArray(languageOrAllIssues) ? languageOrAllIssues : undefined;
  const lang: "de" | "en" =
    (typeof languageOrAllIssues === "string" ? languageOrAllIssues : maybeLanguage) || "de";
  const isEn = lang === "en";
  const title = isEn
    ? "Definition of Ready (DoR) — Sprint Pull Gate"
    : "Definition of Ready (DoR) — Sprint-Aufnahme-Prüfung";

  if (normalizeScrumRole(userRole) === "stakeholder") {
    return buildStakeholderBlock(
      title,
      isEn,
      "Stakeholders have read-only access to Sprint Backlog commitments.",
      "Stakeholder haben reinen Lesezugriff auf Sprint-Backlog-Zuordnungen."
    );
  }

  if (sprint?.state === "closed") {
    return {
      allowed: false,
      canOverrideWithReason: false,
      ruleCode: "SPRINT_CLOSED",
      title,
      violations: [isEn ? `Sprint "${sprint.name}" is already closed.` : `Sprint „${sprint.name}“ ist bereits abgeschlossen.`],
    };
  }

  const violations = inspectIssueDorViolations(issue, allIssues, lang);
  return buildGateOutcome(policy.mode, policy.requireDorBeforeSprint, "DOR_PULL_SPRINT", title, violations);
}

export function inspectIssueDodViolations(
  issue: AgileIssue,
  language: "de" | "en" = "de"
): string[] {
  const isEn = language === "en";
  const violations: string[] = [];

  const acList = issue.acceptanceCriteria || [];
  const uncheckedAc = acList.filter((ac) => !ac.checked);
  if (uncheckedAc.length > 0) {
    violations.push(
      isEn
        ? `${issue.id}: ${uncheckedAc.length}/${acList.length} Acceptance Criteria are still unchecked.`
        : `${issue.id}: ${uncheckedAc.length}/${acList.length} Akzeptanzkriterien sind noch nicht abgehakt.`
    );
  }

  const subtasks = getIssueSubtasks(issue);
  const openSubtasks = subtasks.filter((st) => !st.done);
  if (openSubtasks.length > 0) {
    violations.push(
      isEn
        ? `${issue.id}: ${openSubtasks.length}/${subtasks.length} Subtasks are not marked Done.`
        : `${issue.id}: ${openSubtasks.length}/${subtasks.length} Subtasks sind noch nicht erledigt.`
    );
  }

  const blockers = (issue.blockedBy || []).map((b) => b.trim()).filter(Boolean);
  if (blockers.length > 0) {
    violations.push(
      isEn
        ? `${issue.id}: blockedBy is not empty (${blockers.join(", ")}).`
        : `${issue.id}: Ticket hat noch offene Blocker (${blockers.join(", ")}).`
    );
  }

  return violations;
}

export function evaluateMoveToDone(
  issue: AgileIssue,
  policy: ScrumPolicyConfig,
  language: "de" | "en" = "de"
): GateCheckResult {
  const isEn = language === "en";
  const title = isEn
    ? "Definition of Done (DoD) — Increment Quality Gate"
    : "Definition of Done (DoD) — Inkrement-Qualitätsprüfung";
  const violations = inspectIssueDodViolations(issue, language);
  return buildGateOutcome(
    policy.mode,
    policy.requireDodBeforeDone,
    "DOD_MOVE_DONE",
    title,
    violations
  );
}

export function evaluateStartSprint(
  sprint: AgileSprint,
  sprintIssues: AgileIssue[],
  policy: ScrumPolicyConfig,
  userRole?: ScrumUserRole,
  language: "de" | "en" = "de"
): GateCheckResult {
  const isEn = language === "en";
  const title = isEn
    ? "Scrum Guide — Sprint Start Commitment Gate"
    : "Scrum Guide — Sprint-Start-Prüfung";

  if (normalizeScrumRole(userRole) === "stakeholder") {
    return buildStakeholderBlock(title, isEn, "Stakeholders cannot start a Sprint.", "Stakeholder können keinen Sprint starten.");
  }

  const violations: string[] = [];
  const cleanGoal = (sprint.goal || "").replace(/^_Define sprint goal\.\.\._$/i, "").trim();
  if (cleanGoal.length < 10) {
    violations.push(
      isEn
        ? "Binding Sprint Goal is missing or too short (minimum 10 characters)."
        : "Verbindliches Sprint-Ziel fehlt oder ist zu kurz (mind. 10 Zeichen)."
    );
  }

  const startMs = Date.parse(sprint.startDate || "");
  const endMs = Date.parse(sprint.endDate || "");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    violations.push(
      isEn
        ? "Sprint startDate and endDate must be valid dates with endDate after startDate."
        : "Start- und Enddatum des Sprints müssen gültig sein (Ende nach Start)."
    );
  } else {
    const durationDays = Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
    if (durationDays > 31) {
      violations.push(
        isEn
          ? `Sprint duration (${durationDays} days) exceeds the Scrum Guide 1-month maximum.`
          : `Sprint-Dauer (${durationDays} Tage) überschreitet das Scrum-Guide-Maximum von 1 Monat.`
      );
    }
  }

  const nonEpicIssues = (sprintIssues || []).filter((i) => i.type !== "epic");
  const readyCandidates = nonEpicIssues.filter(
    (i) =>
      i.status !== "backlog" &&
      (!policy.requireDorBeforeSprint ||
        inspectIssueDorViolations(i, sprintIssues, language).length === 0)
  );

  if (nonEpicIssues.length === 0 || readyCandidates.length < 1) {
    violations.push(
      isEn
        ? "At least 1 Ready issue meeting DoR must be selected for the Sprint."
        : "Mindestens 1 Ready-Ticket (gemäß DoR) muss im Sprint eingeplant sein."
    );
  }

  return buildGateOutcome(policy.mode, true, "SPRINT_START_GATE", title, violations);
}

export function evaluateBacklogReorder(
  policy: ScrumPolicyConfig,
  userRole?: ScrumUserRole,
  language: "de" | "en" = "de"
): GateCheckResult {
  const isEn = language === "en";
  const title = isEn
    ? "Product Backlog Ordering Authority"
    : "Product-Backlog-Priorisierungshoheit";

  const role = normalizeScrumRole(userRole);
  if (role === "stakeholder") {
    return buildStakeholderBlock(
      title,
      isEn,
      "Stakeholders cannot reorder the Product Backlog.",
      "Stakeholder dürfen das Product Backlog nicht umsortieren."
    );
  }

  if (
    policy.mode === "kanban" ||
    (!policy.enforcePoBacklogOrder && policy.mode !== "strict") ||
    role === "product-owner" ||
    role === "admin"
  ) {
    return { allowed: true, canOverrideWithReason: false, ruleCode: "PO_BACKLOG_ORDER", title, violations: [] };
  }

  const violations = [
    isEn
      ? `Only the Product Owner (or Admin) is accountable for ordering the Product Backlog (current role: ${role}).`
      : `Gemäß Scrum Guide verantwortet nur der Product Owner (oder Admin) die Reihenfolge des Product Backlogs (aktuelle Rolle: ${role}).`,
  ];

  return buildGateOutcome(policy.mode, true, "PO_BACKLOG_ORDER", title, violations);
}

export function evaluateStrictSprintVelocityBreakdown(
  sprintIssues: AgileIssue[]
): StrictVelocityBreakdown {
  const workItems = (sprintIssues || []).filter((i) => i.type !== "epic");
  const acceptedDoneIssues: AgileIssue[] = [];
  const dodViolatingDoneIssues: AgileIssue[] = [];
  const unfinishedIssues: AgileIssue[] = [];

  for (const issue of workItems) {
    if (issue.status === "done") {
      if (inspectIssueDodViolations(issue, "en").length === 0) {
        acceptedDoneIssues.push(issue);
      } else {
        dodViolatingDoneIssues.push(issue);
      }
    } else {
      unfinishedIssues.push(issue);
    }
  }

  const sumSp = (list: AgileIssue[]) =>
    list.reduce((acc, item) => acc + (Number.isFinite(item.storyPoints) ? item.storyPoints : 0), 0);

  return {
    velocityPoints: sumSp(acceptedDoneIssues),
    totalScopePoints: sumSp(workItems),
    undonePointsZeroed: sumSp(dodViolatingDoneIssues) + sumSp(unfinishedIssues),
    acceptedDoneIssues,
    dodViolatingDoneIssues,
    unfinishedIssues,
  };
}

export function computeStrictSprintVelocity(sprintIssues: AgileIssue[]): number {
  return evaluateStrictSprintVelocityBreakdown(sprintIssues).velocityPoints;
}

export function appendOverrideAuditComment(
  issue: AgileIssue,
  author: string,
  ruleCode: string,
  reason: string
): AgileIssue {
  const nowIso = new Date().toISOString();
  const timestamp = nowIso.slice(0, 16).replace("T", " ");
  const cleanAuthor = (author || "@team").trim();
  const cleanRule = (ruleCode || "SCRUM_GATE").trim().toUpperCase();
  const cleanReason = (reason || "").replace(/\r?\n/g, " ").trim();

  return {
    ...issue,
    updatedAt: nowIso,
    comments: [
      ...(issue.comments || []),
      {
        author: cleanAuthor,
        timestamp,
        text: `[SCRUM-OVERRIDE: ${cleanRule}] ${cleanReason}`,
      },
    ],
  };
}

export function extractSprintOverrideAudits(
  issues: AgileIssue[],
  sprintId?: string
): OverrideAuditEntry[] {
  const entries: OverrideAuditEntry[] = [];
  for (const issue of issues || []) {
    if (sprintId && issue.sprint.toLowerCase() !== sprintId.toLowerCase()) continue;
    for (const comment of issue.comments || []) {
      const match = (comment.text || "").match(/\[SCRUM-OVERRIDE:\s*([^\]]+)\]\s*(.+)/i);
      if (match) {
        entries.push({
          issueId: issue.id,
          issueTitle: issue.title,
          author: comment.author || "@team",
          timestamp: comment.timestamp || "",
          ruleCode: match[1].trim(),
          reason: match[2].trim(),
        });
      }
    }
  }
  return entries;
}
