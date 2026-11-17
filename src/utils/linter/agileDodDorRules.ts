import type { WorkspaceFile } from "../../types/workspace";
import type { Diagnostic, MsgFormatter, ParsedIssueLintMeta } from "./issueLinterRules";

export function lintAgileGovernanceFile(
  file: WorkspaceFile,
  files: WorkspaceFile[],
  parsedIssues: ParsedIssueLintMeta[],
  issueById: Map<string, ParsedIssueLintMeta>,
  activeSprintIds: Set<string>,
  msg: MsgFormatter,
  diagnostics: Diagnostic[]
): void {
  // Validate Definition of Done (DoD) compliance
  if (file.path === "management/definition-of-done.md") {
    const backlogFile = files.find(f => f.path === "management/sprint-backlog.md");
    const hasLegacyOpenTasks = backlogFile
      ? backlogFile.content.includes("- [ ]") || backlogFile.content.includes("- [/]")
      : false;
    const openSprintIssues = parsedIssues.filter(iss => {
      const inActiveSprint = iss.sprint && activeSprintIds.has(iss.sprint.toLowerCase());
      return (inActiveSprint || iss.status === "in-progress" || iss.status === "review") && iss.status !== "done";
    });

    if (hasLegacyOpenTasks || openSprintIssues.length > 0) {
      diagnostics.push({
        filePath: file.path,
        line: 8,
        severity: "warning",
        message: msg(
          `Definition of Done verletzt: Es gibt noch offene Sprint-Aufgaben (${openSprintIssues.length} Ticket(s) unter issues/*${hasLegacyOpenTasks ? " + Sprint-Backlog" : ""}).`,
          `Definition of Done violated: There are still open sprint tasks (${openSprintIssues.length} issue(s) in issues/*${hasLegacyOpenTasks ? " + sprint backlog" : ""}).`
        ),
        code: "DOD_OPEN_TASKS"
      });
    }

    const draftADRs = files.filter(
      f =>
        f.path.startsWith("adrs/") &&
        (f.content.includes("Vorgeschlagen") ||
          f.content.includes("Entwurf") ||
          f.content.toLowerCase().includes("proposed") ||
          f.content.toLowerCase().includes("draft"))
    );
    if (draftADRs.length > 0) {
      diagnostics.push({
        filePath: file.path,
        line: 9,
        severity: "warning",
        message: msg(
          `Definition of Done verletzt: ${draftADRs.length} ADRs befinden sich noch im Entwurfsstatus (Vorgeschlagen).`,
          `Definition of Done violated: ${draftADRs.length} ADRs are still in draft state (Proposed).`
        ),
        code: "DOD_DRAFT_ADRS"
      });
    }

    let blockerCount = 0;
    files.forEach(f => {
      if (f.category === "meetings" || f.path.startsWith("meetings/")) {
        const fileLines = f.content.split("\n");
        fileLines.forEach(l => {
          if (l.trim().startsWith("- [ ] BLOCKED:") || l.trim().startsWith("- [ ] BLOCKER:")) {
            blockerCount++;
          }
        });
      }
    });

    parsedIssues.forEach(iss => {
      if (iss.status === "done") return;
      const hasUnresolvedBlocker = iss.blockedBy.some(bId => {
        const target = issueById.get(bId.toUpperCase());
        return !target || target.status !== "done";
      });
      if (hasUnresolvedBlocker) {
        blockerCount++;
      }
    });

    if (blockerCount > 0) {
      diagnostics.push({
        filePath: file.path,
        line: 10,
        severity: "error",
        message: msg(
          `Definition of Done verletzt: Es gibt noch ${blockerCount} offene Blocker/Impediments im Projekt.`,
          `Definition of Done violated: There are still ${blockerCount} open blockers/impediments in the project.`
        ),
        code: "DOD_OPEN_BLOCKERS"
      });
    }
  }

  // Validate Definition of Ready (DoR) compliance
  if (file.path === "management/definition-of-ready.md") {
    let missingAssigneesCount = 0;
    let blockedTasksCount = 0;
    let unestimatedSprintIssuesCount = 0;

    const backlogFile = files.find(f => f.path === "management/sprint-backlog.md");
    if (backlogFile) {
      const bLines = backlogFile.content.split("\n");
      bLines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [/]")) {
          if (!/@([a-zA-Z0-9_-]+)/.test(trimmed)) {
            missingAssigneesCount++;
          }
          if (trimmed.toUpperCase().includes("BLOCKED") || trimmed.toUpperCase().includes("BLOCKER")) {
            blockedTasksCount++;
          }
        }
      });
    }

    parsedIssues.forEach(iss => {
      const inActiveSprint = iss.sprint && activeSprintIds.has(iss.sprint.toLowerCase());
      const isCommitted =
        inActiveSprint ||
        iss.status === "ready" ||
        iss.status === "in-progress" ||
        iss.status === "review";
      if (!isCommitted || iss.status === "done") return;

      if (!iss.assignee || iss.assignee.toLowerCase() === "unassigned") {
        missingAssigneesCount++;
      }
      if (iss.type !== "epic" && (!iss.storyPoints || iss.storyPoints <= 0)) {
        unestimatedSprintIssuesCount++;
      }
      const isBlocked = iss.blockedBy.some(bId => {
        const target = issueById.get(bId.toUpperCase());
        return !target || target.status !== "done";
      });
      if (isBlocked) {
        blockedTasksCount++;
      }
    });

    if (missingAssigneesCount > 0) {
      diagnostics.push({
        filePath: file.path,
        line: 7,
        severity: "warning",
        message: msg(
          `Definition of Ready verletzt: ${missingAssigneesCount} Aufgabe(n)/Ticket(s) haben keine Zuweisung (@name).`,
          `Definition of Ready violated: ${missingAssigneesCount} task(s)/issue(s) are missing assignees (@name).`
        ),
        code: "DOR_MISSING_ASSIGNEE"
      });
    }

    if (blockedTasksCount > 0) {
      diagnostics.push({
        filePath: file.path,
        line: 8,
        severity: "warning",
        message: msg(
          `Definition of Ready verletzt: Es gibt ${blockedTasksCount} blockierte Aufgabe(n)/Ticket(s) im aktuellen Sprint.`,
          `Definition of Ready violated: There are ${blockedTasksCount} blocked task(s)/issue(s) in the current sprint.`
        ),
        code: "DOR_BLOCKED_TASKS"
      });
    }

    if (unestimatedSprintIssuesCount > 0) {
      diagnostics.push({
        filePath: file.path,
        line: 9,
        severity: "warning",
        message: msg(
          `Definition of Ready verletzt: ${unestimatedSprintIssuesCount} Sprint-Ticket(s) haben noch keine Story-Point-Schätzung.`,
          `Definition of Ready violated: ${unestimatedSprintIssuesCount} sprint issue(s) are missing Story Point estimates.`
        ),
        code: "DOR_MISSING_ESTIMATE"
      });
    }
  }

  // DoR Checks directly on sprint-backlog.md tasks
  if (file.path === "management/sprint-backlog.md") {
    const lines = file.content.split("\n");
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNum = index + 1;

      if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [/]")) {
        // 1. Zuweisung fehlt
        if (!/@([a-zA-Z0-9_-]+)/.test(trimmed)) {
          diagnostics.push({
            filePath: file.path,
            line: lineNum,
            severity: "warning",
            message: msg(
              "Definition of Ready verletzt: Diese Aufgabe hat kein Zuweisungs-Handle (z.B. @developer-a).",
              "Definition of Ready violated: This task is missing an assignee handle (e.g. @developer-a)."
            ),
            code: "DOR_LINE_MISSING_ASSIGNEE"
          });
        }
        // 2. Enthält Blocker
        if (trimmed.toUpperCase().includes("BLOCKED") || trimmed.toUpperCase().includes("BLOCKER")) {
          diagnostics.push({
            filePath: file.path,
            line: lineNum,
            severity: "warning",
            message: msg(
              "Aufgabe ist blockiert und kann nicht fortgeführt werden.",
              "Task is blocked and cannot be worked on."
            ),
            code: "DOR_LINE_BLOCKED"
          });
        }
      }
    });
  }
}
