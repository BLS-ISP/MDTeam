import test from "node:test";
import assert from "node:assert/strict";
import {
  type AgileIssue,
  type AgileSprint,
  type WorkspaceFile,
  computeEffectiveIssueHours,
  computeReleaseProgress,
  computeSprintMetrics,
  filterIssuesJql,
  generateReleaseNotesMarkdown,
  parseIssueFromFile,
  parseReleases,
  sanitizeAttachmentFileName,
  serializeIssueToMarkdown,
  serializeReleasesToMarkdown,
} from "../src/utils/issueEngine";

test("AgileIssue round-trip serialization with subtasks, attachments, fixVersion & hours", () => {
  const richIssue: AgileIssue = {
    id: "MDT-301",
    title: "Implement binary attachment store & hours burndown",
    type: "story",
    status: "in-progress",
    priority: "critical",
    storyPoints: 8,
    assignee: "@developer-a",
    reporter: "@product-owner",
    sprint: "sprint-02",
    epic: "MDT-300",
    blockedBy: ["MDT-299"],
    branch: "feat/MDT-301-attachments",
    startDate: "2026-06-02",
    endDate: "2026-06-10",
    labels: ["jira", "attachments"],
    fixVersion: "v1.2.0",
    estimatedHours: 16,
    loggedHours: 6.5,
    remainingHours: 9.5,
    reviewAccepted: true,
    subtasks: [
      {
        id: "SUB-1",
        title: "Build parser & serializer",
        done: true,
        assignee: "@developer-a",
        estimatedHours: 6,
        remainingHours: 0,
      },
      {
        id: "SUB-2",
        title: "Wire drag-and-drop upload",
        done: false,
        assignee: "@developer-b",
        estimatedHours: 10,
        remainingHours: 9.5,
      },
    ],
    attachments: [
      {
        id: "att-1",
        name: "board-wireframe.png",
        path: "assets/issues/MDT-301/board-wireframe.png",
        mimeType: "image/png",
        sizeBytes: 4096,
        addedAt: "2026-06-03",
      },
    ],
    description: "Support versioned binary attachments and subtask hours tracking.",
    acceptanceCriteria: [
      { text: "Round-trip Markdown serialization without data loss", checked: true },
      { text: "Hours burndown chart toggle", checked: false },
    ],
    comments: [
      { author: "@product-owner", timestamp: "2026-06-03 10:15", text: "Target v1.2.0 release!" },
    ],
    createdAt: "2026-06-02",
    updatedAt: "2026-06-03",
    filePath: "issues/MDT-301.md",
  };

  const file = serializeIssueToMarkdown(richIssue);
  assert.equal(file.path, "issues/MDT-301.md");
  assert.match(file.content, /fix_version:\s*"v1\.2\.0"/);
  assert.match(file.content, /## Subtasks/);
  assert.match(file.content, /## Attachments/);

  const reparsed = parseIssueFromFile(file);
  assert.ok(reparsed);
  assert.equal(reparsed.fixVersion, "v1.2.0");
  assert.equal(reparsed.estimatedHours, 16);
  assert.equal(reparsed.loggedHours, 6.5);
  assert.equal(reparsed.remainingHours, 9.5);
  assert.equal(reparsed.reviewAccepted, true);
  assert.equal(reparsed.subtasks?.length, 2);
  assert.equal(reparsed.subtasks?.[0].done, true);
  assert.equal(reparsed.subtasks?.[1].assignee, "@developer-b");
  assert.equal(reparsed.subtasks?.[1].remainingHours, 9.5);
  assert.equal(reparsed.attachments?.length, 1);
  assert.equal(reparsed.attachments?.[0].path, "assets/issues/MDT-301/board-wireframe.png");

  // Sanitizer & JQL extensions
  assert.equal(sanitizeAttachmentFileName("../evil file(1).PNG"), "evil_file_1_.PNG");
  assert.equal(filterIssuesJql([reparsed], "fixversion:v1.2.0 has:subtasks has:attachments has:hours").length, 1);
  assert.equal(filterIssuesJql([reparsed], "fixversion:v9.9.9").length, 0);
});

test("Hours burndown math & subtask rollup in computeSprintMetrics", () => {
  const sprint: AgileSprint = {
    id: "sprint-02",
    name: "Sprint 02",
    goal: "Deliver time tracking & burndown",
    startDate: "2026-06-01",
    endDate: "2026-06-05",
    state: "active",
    committedPoints: 13,
    filePath: "sprints/sprint-02.md",
  };

  const subtaskDrivenIssue: AgileIssue = {
    id: "MDT-302",
    title: "Subtask-driven hours calculation",
    type: "task",
    status: "in-progress",
    priority: "medium",
    storyPoints: 5,
    assignee: "@developer-a",
    reporter: "@product-owner",
    sprint: "sprint-02",
    epic: "",
    branch: "",
    blockedBy: [],
    labels: [],
    loggedHours: 4,
    subtasks: [
      { id: "SUB-1", title: "Step A", done: true, estimatedHours: 4, remainingHours: 2 },
      { id: "SUB-2", title: "Step B", done: false, estimatedHours: 8, remainingHours: 6 },
    ],
    description: "Derive hours from subtasks.",
    acceptanceCriteria: [],
    comments: [],
    createdAt: "2026-06-01",
    updatedAt: "2026-06-02",
    filePath: "issues/MDT-302.md",
  };

  const doneIssue: AgileIssue = {
    ...subtaskDrivenIssue,
    id: "MDT-303",
    status: "done",
    storyPoints: 8,
    estimatedHours: 10,
    loggedHours: 9,
    remainingHours: 5, // Must zero out because status === "done"
    subtasks: [],
    updatedAt: "2026-06-03",
    filePath: "issues/MDT-303.md",
  };

  const effActive = computeEffectiveIssueHours(subtaskDrivenIssue);
  assert.equal(effActive.estimatedHours, 12);
  assert.equal(effActive.loggedHours, 4);
  assert.equal(effActive.remainingHours, 6);

  const effDone = computeEffectiveIssueHours(doneIssue);
  assert.equal(effDone.estimatedHours, 10);
  assert.equal(effDone.remainingHours, 0);

  const metrics = computeSprintMetrics([subtaskDrivenIssue, doneIssue], sprint);
  assert.equal(metrics.totalEstimatedHours, 22);
  assert.equal(metrics.totalLoggedHours, 13);
  assert.equal(metrics.totalRemainingHours, 6);
  assert.ok(Array.isArray(metrics.hoursBurndownSeries));
  assert.equal(metrics.hoursBurndownSeries?.length, 5);
  assert.equal(metrics.hoursBurndownSeries?.[0].idealRemaining, 22);
  assert.equal(metrics.hoursBurndownSeries?.[4].idealRemaining, 0);
});

test("Release manager round-trip, progress math & 1-click Wiki Release Notes generation", () => {
  const issues: AgileIssue[] = [
    {
      id: "MDT-401",
      title: "Keycloak OIDC SSO Login",
      type: "story",
      status: "done",
      priority: "high",
      storyPoints: 8,
      assignee: "@developer-a",
      sprint: "sprint-01",
      epic: "",
      reporter: "@product-owner",
      branch: "",
      blockedBy: [],
      labels: [],
      fixVersion: "v2.0.0",
      description: "Implemented in [ADR-0001](adrs/ADR-0001-auth.md).",
      acceptanceCriteria: [{ text: "PKCE verified", checked: true }],
      comments: [],
      createdAt: "2026-06-01",
      updatedAt: "2026-06-04",
      filePath: "issues/MDT-401.md",
    },
    {
      id: "MDT-402",
      title: "Fix Safari cookie SameSite handling",
      type: "bug",
      status: "done",
      priority: "critical",
      storyPoints: 3,
      assignee: "@developer-b",
      sprint: "sprint-01",
      epic: "",
      reporter: "@product-owner",
      branch: "",
      blockedBy: [],
      labels: [],
      fixVersion: "v2.0.0",
      description: "Fixed cookie header attributes.",
      acceptanceCriteria: [{ text: "Verified", checked: true }],
      comments: [],
      createdAt: "2026-06-02",
      updatedAt: "2026-06-05",
      filePath: "issues/MDT-402.md",
    },
  ];

  const releasesFile = serializeReleasesToMarkdown([
    {
      id: "rel-v2-0-0",
      version: "v2.0.0",
      name: "Enterprise Production Launch",
      targetDate: "2026-06-30",
      state: "released",
      description: "Multi-user backend, RBAC, and Scrum ceremonies.",
    },
  ]);

  const parsedReleases = parseReleases([releasesFile], issues);
  assert.equal(parsedReleases.length, 1);
  assert.equal(parsedReleases[0].version, "v2.0.0");

  const progress = computeReleaseProgress(parsedReleases[0], issues);
  assert.equal(progress.totalIssues, 2);
  assert.equal(progress.doneIssues, 2);
  assert.equal(progress.totalPoints, 11);
  assert.equal(progress.donePoints, 11);
  assert.equal(progress.pointsProgressPercent, 100);

  const adrFile: WorkspaceFile = {
    path: "adrs/ADR-0001-auth.md",
    name: "ADR-0001-auth.md",
    category: "adrs",
    content: "# ADR-0001: OIDC Auth\n\n## Status\nAccepted\n",
  };

  const notesFile = generateReleaseNotesMarkdown(parsedReleases[0], issues, [adrFile], "en");
  assert.equal(notesFile.path, "wiki/releases/v2-0-0.md");
  assert.match(notesFile.content, /MDT-401/);
  assert.match(notesFile.content, /MDT-402/);
  assert.match(notesFile.content, /ADR-0001/);
  assert.match(notesFile.content, /```query/);
});
