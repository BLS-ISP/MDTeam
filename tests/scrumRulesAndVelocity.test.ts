import test from "node:test";
import assert from "node:assert/strict";
import type { AgileIssue, AgileSprint } from "../src/utils/issueEngine";
import {
  DEFAULT_SCRUM_POLICY,
  SCRUM_POLICY_FILE_PATH,
  appendOverrideAuditComment,
  applyProcessModePreset,
  computeStrictSprintVelocity,
  evaluateBacklogReorder,
  evaluateMoveToDone,
  evaluatePullIntoSprint,
  evaluateStartSprint,
  evaluateStrictSprintVelocityBreakdown,
  extractSprintOverrideAudits,
  parseScrumPolicy,
  serializeScrumPolicyToMarkdown,
} from "../src/utils/scrum-rules/scrumPolicyEngine";

function makeSprint(overrides: Partial<AgileSprint> = {}): AgileSprint {
  return {
    id: "sprint-01",
    name: "Sprint 01",
    goal: "Deliver enterprise SSO authentication and audit trail",
    startDate: "2026-06-01",
    endDate: "2026-06-14",
    state: "planned",
    committedPoints: 13,
    filePath: "sprints/sprint-01.md",
    ...overrides,
  };
}

function makeReadyIssue(overrides: Partial<AgileIssue> = {}): AgileIssue {
  return {
    id: "MDT-101",
    title: "Implement OIDC PKCE callback",
    type: "story",
    status: "ready",
    priority: "high",
    storyPoints: 5,
    assignee: "@developer-a",
    reporter: "@product-owner",
    branch: "",
    sprint: "",
    epic: "MDT-100",
    blockedBy: [],
    labels: ["security"],
    description: "Support Keycloak and Entra ID authorization code PKCE exchange.",
    acceptanceCriteria: [
      { text: "Verify signed state cookie with timingSafeEqual", checked: true },
      { text: "Provision local Scrum role on first login", checked: true },
    ],
    subtasks: [
      { id: "SUB-1", title: "State cookie HMAC", done: true, estimatedHours: 3, remainingHours: 0 },
      { id: "SUB-2", title: "Token endpoint exchange", done: true, estimatedHours: 4, remainingHours: 0 },
    ],
    comments: [],
    createdAt: "2026-06-01",
    updatedAt: "2026-06-02",
    filePath: "issues/MDT-101.md",
    ...overrides,
  };
}

test("Scrum policy markdown round-trip and mode presets", () => {
  const strictPolicy = applyProcessModePreset(
    {
      ...DEFAULT_SCRUM_POLICY,
      productGoal: "Replace Atlassian Cloud with Git-native platform",
      productGoalTargetDate: "2026-09-30",
    },
    "strict"
  );
  assert.equal(strictPolicy.mode, "strict");
  assert.equal(strictPolicy.requireDorBeforeSprint, true);
  assert.equal(strictPolicy.requireDodBeforeDone, true);
  assert.equal(strictPolicy.enforcePoBacklogOrder, true);

  const file = serializeScrumPolicyToMarkdown(strictPolicy);
  assert.equal(file.path, SCRUM_POLICY_FILE_PATH);

  const parsed = parseScrumPolicy([file]);
  assert.equal(parsed.mode, "strict");
  assert.equal(parsed.productGoal, "Replace Atlassian Cloud with Git-native platform");
  assert.equal(parsed.productGoalTargetDate, "2026-09-30");
  assert.equal(parsed.enforcePoBacklogOrder, true);
});

test("DoR Sprint Pull Gate enforces points, AC, assignee, description & blockers across modes", () => {
  const sprint = makeSprint();
  const incompleteStory = makeReadyIssue({
    id: "MDT-102",
    storyPoints: 0,
    assignee: "",
    description: "",
    acceptanceCriteria: [],
    blockedBy: ["MDT-999"],
  });

  const strictPolicy = applyProcessModePreset(DEFAULT_SCRUM_POLICY, "strict");
  const pragmaticPolicy = applyProcessModePreset(DEFAULT_SCRUM_POLICY, "pragmatic");
  const kanbanPolicy = applyProcessModePreset(DEFAULT_SCRUM_POLICY, "kanban");

  const strictRes = evaluatePullIntoSprint(incompleteStory, sprint, strictPolicy, "developer", "en");
  assert.equal(strictRes.allowed, false);
  assert.equal(strictRes.canOverrideWithReason, false);
  assert.ok(strictRes.violations.length >= 4);

  const pragRes = evaluatePullIntoSprint(incompleteStory, sprint, pragmaticPolicy, "developer", "en");
  assert.equal(pragRes.allowed, false);
  assert.equal(pragRes.canOverrideWithReason, true);

  const kanbanRes = evaluatePullIntoSprint(incompleteStory, sprint, kanbanPolicy, "developer", "en");
  assert.equal(kanbanRes.allowed, true);

  const stakeholderRes = evaluatePullIntoSprint(makeReadyIssue(), sprint, kanbanPolicy, "stakeholder", "en");
  assert.equal(stakeholderRes.allowed, false);
  assert.equal(stakeholderRes.ruleCode, "STAKEHOLDER_READONLY");
});

test("DoD Move-to-Done Gate validates Acceptance Criteria, Subtasks, and Blockers", () => {
  const strictPolicy = applyProcessModePreset(DEFAULT_SCRUM_POLICY, "strict");
  const pragmaticPolicy = applyProcessModePreset(DEFAULT_SCRUM_POLICY, "pragmatic");

  const cleanIssue = makeReadyIssue({ status: "done" });
  assert.equal(evaluateMoveToDone(cleanIssue, strictPolicy, "en").allowed, true);

  const openSubtaskIssue = makeReadyIssue({
    subtasks: [
      { id: "SUB-1", title: "Write unit tests", done: true },
      { id: "SUB-2", title: "Security audit", done: false },
    ],
  });
  const subFailStrict = evaluateMoveToDone(openSubtaskIssue, strictPolicy, "en");
  assert.equal(subFailStrict.allowed, false);
  assert.equal(subFailStrict.canOverrideWithReason, false);
  assert.ok(subFailStrict.violations.some((v) => v.includes("Subtasks")));

  const uncheckedAcIssue = makeReadyIssue({
    acceptanceCriteria: [{ text: "All E2E checks pass", checked: false }],
  });
  const acFailPragmatic = evaluateMoveToDone(uncheckedAcIssue, pragmaticPolicy, "en");
  assert.equal(acFailPragmatic.allowed, false);
  assert.equal(acFailPragmatic.canOverrideWithReason, true);
  assert.ok(acFailPragmatic.violations.some((v) => v.includes("Acceptance Criteria")));
});

test("Sprint Start Gate and Product Owner Backlog Ordering Lock", () => {
  const strictPolicy = applyProcessModePreset(DEFAULT_SCRUM_POLICY, "strict");
  const pragmaticPolicy = applyProcessModePreset(DEFAULT_SCRUM_POLICY, "pragmatic");
  const kanbanPolicy = applyProcessModePreset(DEFAULT_SCRUM_POLICY, "kanban");

  const badSprint = makeSprint({ goal: "short", startDate: "2026-06-01", endDate: "2026-07-15" });
  const badStart = evaluateStartSprint(badSprint, [], strictPolicy, "scrum-master", "en");
  assert.equal(badStart.allowed, false);
  assert.equal(badStart.violations.length, 3);

  const validSprint = makeSprint();
  const validStart = evaluateStartSprint(
    validSprint,
    [makeReadyIssue({ sprint: "sprint-01" })],
    strictPolicy,
    "scrum-master",
    "en"
  );
  assert.equal(validStart.allowed, true);

  // PO Backlog Order authority
  assert.equal(evaluateBacklogReorder(strictPolicy, "product-owner", "en").allowed, true);
  assert.equal(evaluateBacklogReorder(strictPolicy, "admin", "en").allowed, true);

  const devStrict = evaluateBacklogReorder(strictPolicy, "developer", "en");
  assert.equal(devStrict.allowed, false);
  assert.equal(devStrict.canOverrideWithReason, false);

  const smPragmatic = evaluateBacklogReorder(pragmaticPolicy, "scrum-master", "en");
  assert.equal(smPragmatic.allowed, false);
  assert.equal(smPragmatic.canOverrideWithReason, true);

  assert.equal(evaluateBacklogReorder(kanbanPolicy, "developer", "en").allowed, true);
  assert.equal(evaluateBacklogReorder(kanbanPolicy, "stakeholder", "en").allowed, false);
});

test("[SCRUM-OVERRIDE] audit logging & 0-SP-for-undone Sprint Velocity enforcement", () => {
  const baseIssue = makeReadyIssue({ id: "MDT-105", sprint: "sprint-01" });
  const overridden = appendOverrideAuditComment(
    baseIssue,
    "@scrum-master",
    "DOR_PULL_SPRINT",
    "Customer hotfix escalated during emergency triage"
  );

  const audits = extractSprintOverrideAudits([overridden], "sprint-01");
  assert.equal(audits.length, 1);
  assert.equal(audits[0].issueId, "MDT-105");
  assert.equal(audits[0].ruleCode, "DOR_PULL_SPRINT");
  assert.match(audits[0].reason, /Customer hotfix/);

  // Scrum Guide 0-SP-for-undone velocity check:
  // 1. Fully Done & DoD-compliant: 8 SP -> counts!
  const doneValid = makeReadyIssue({ id: "MDT-201", status: "done", storyPoints: 8 });
  // 2. Marked Done, but 1 subtask still open (violates DoD): 5 SP -> 0 SP!
  const doneDodViolating = makeReadyIssue({
    id: "MDT-202",
    status: "done",
    storyPoints: 5,
    subtasks: [{ id: "SUB-1", title: "Unfinished migration", done: false }],
  });
  // 3. Still In Review at Sprint end: 13 SP -> 0 SP!
  const inReview = makeReadyIssue({ id: "MDT-203", status: "review", storyPoints: 13 });
  // 4. Epic container: 21 SP -> ignored as container
  const epicContainer = makeReadyIssue({ id: "MDT-200", type: "epic", status: "done", storyPoints: 21 });

  const sprintSet = [doneValid, doneDodViolating, inReview, epicContainer];
  const velocity = computeStrictSprintVelocity(sprintSet);
  const breakdown = evaluateStrictSprintVelocityBreakdown(sprintSet);

  assert.equal(velocity, 8);
  assert.equal(breakdown.velocityPoints, 8);
  assert.equal(breakdown.totalScopePoints, 26);
  assert.equal(breakdown.undonePointsZeroed, 18);
  assert.equal(breakdown.acceptedDoneIssues.length, 1);
  assert.equal(breakdown.dodViolatingDoneIssues.length, 1);
  assert.equal(breakdown.unfinishedIssues.length, 1);
});
