export interface Diagnostic {
  filePath: string;
  line: number;
  severity: "error" | "warning" | "info";
  message: string;
  code?: string;
}

interface WorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

interface ParsedIssueLintMeta {
  filePath: string;
  id: string;
  type: string;
  title: string;
  status: string;
  sprint: string;
  assignee: string;
  storyPoints: number;
  blockedBy: string[];
  startDate: string;
  endDate: string;
  lines: {
    id: number;
    title: number;
    status: number;
    assignee: number;
    storyPoints: number;
    blockedBy: number;
    startDate: number;
    endDate: number;
  };
}

function extractYamlList(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]") return [];
  const inner = trimmed.replace(/^\[|\]$/g, "");
  return inner
    .split(",")
    .map(item => item.trim().replace(/^["']|["']$/g, "").trim())
    .filter(Boolean);
}

function parseIssueLintMetadata(file: WorkspaceFile): ParsedIssueLintMeta | null {
  if (!file.path.startsWith("issues/") || !file.path.endsWith(".md")) return null;
  const rawLines = file.content.split(/\r?\n/);
  if ((rawLines[0] || "").trim() !== "---") return null;

  let endIdx = -1;
  for (let i = 1; i < rawLines.length; i++) {
    if (rawLines[i].trim() === "---") {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) return null;

  const meta: ParsedIssueLintMeta = {
    filePath: file.path,
    id: "",
    type: "task",
    title: "",
    status: "backlog",
    sprint: "",
    assignee: "",
    storyPoints: 0,
    blockedBy: [],
    startDate: "",
    endDate: "",
    lines: {
      id: 2,
      title: 2,
      status: 2,
      assignee: 2,
      storyPoints: 2,
      blockedBy: 2,
      startDate: 2,
      endDate: 2,
    },
  };

  for (let i = 1; i < endIdx; i++) {
    const line = rawLines[i];
    const lineNum = i + 1;
    const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].trim().toLowerCase();
    const rawVal = kv[2].trim();
    const cleanVal = rawVal.replace(/^["']|["']$/g, "").trim();

    switch (key) {
      case "id":
        meta.id = cleanVal;
        meta.lines.id = lineNum;
        break;
      case "type":
        meta.type = cleanVal.toLowerCase();
        break;
      case "title":
        meta.title = cleanVal;
        meta.lines.title = lineNum;
        break;
      case "status":
        meta.status = cleanVal.toLowerCase();
        meta.lines.status = lineNum;
        break;
      case "sprint":
        meta.sprint = cleanVal;
        break;
      case "assignee":
        meta.assignee = cleanVal;
        meta.lines.assignee = lineNum;
        break;
      case "story_points":
        meta.storyPoints = parseFloat(cleanVal) || 0;
        meta.lines.storyPoints = lineNum;
        break;
      case "blocked_by":
        meta.blockedBy = extractYamlList(rawVal);
        meta.lines.blockedBy = lineNum;
        break;
      case "start_date":
        meta.startDate = cleanVal;
        meta.lines.startDate = lineNum;
        break;
      case "end_date":
        meta.endDate = cleanVal;
        meta.lines.endDate = lineNum;
        break;
    }
  }

  if (!meta.id) {
    meta.id = file.name.replace(/\.md$/i, "");
  }

  return meta;
}

function getActiveSprintIds(files: WorkspaceFile[]): Set<string> {
  const activeIds = new Set<string>();
  files.forEach(f => {
    if (!f.path.startsWith("sprints/") || !f.path.endsWith(".md")) return;
    const fm = f.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) return;
    let id = f.name.replace(/\.md$/i, "");
    let state = "";
    fm[1].split(/\r?\n/).forEach(l => {
      const kv = l.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
      if (!kv) return;
      const k = kv[1].trim().toLowerCase();
      const v = kv[2].trim().replace(/^["']|["']$/g, "").trim();
      if (k === "id" && v) id = v;
      if (k === "state") state = v.toLowerCase();
    });
    if (state === "active") {
      activeIds.add(id.toLowerCase());
    }
  });
  return activeIds;
}

export function lintWorkspaceFiles(files: WorkspaceFile[], lang: "de" | "en" = "de"): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const msg = (de: string, en: string) => lang === "de" ? de : en;

  const parsedIssues: ParsedIssueLintMeta[] = [];
  const issueById = new Map<string, ParsedIssueLintMeta>();
  files.forEach(f => {
    const meta = parseIssueLintMetadata(f);
    if (meta) {
      parsedIssues.push(meta);
      issueById.set(meta.id.toUpperCase(), meta);
    }
  });
  const activeSprintIds = getActiveSprintIds(files);

  files.forEach(file => {
    const lines = file.content.split("\n");

    // 1. Validate Invalid Transclusions or links in any markdown file
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNum = index + 1;

      // Check transclusions: @[path/to/file.md#L1-L10]
      const transclusionMatch = trimmed.match(/^@\[(.*?)(?:#(L\d+(?:-\d+)?))?\]$/i);
      if (transclusionMatch) {
        const refPath = transclusionMatch[1];
        const refFile = files.find(f => f.path === refPath);
        if (!refFile) {
          diagnostics.push({
            filePath: file.path,
            line: lineNum,
            severity: "error",
            message: msg(
              `Referenzierte Datei '${refPath}' existiert nicht im Workspace.`,
              `Referenced file '${refPath}' does not exist in the workspace.`
            ),
            code: "LINK_ERROR"
          });
        } else {
          // Check line range if specified
          const hash = transclusionMatch[2] || "";
          if (hash && hash.startsWith("L")) {
            const range = hash.substring(1).split("-");
            const startLine = parseInt(range[0]);
            const fileLinesCount = refFile.content.split("\n").length;
            if (startLine > fileLinesCount || startLine < 1) {
              diagnostics.push({
                filePath: file.path,
                line: lineNum,
                severity: "warning",
                message: msg(
                  `Referenzierte Zeile L${startLine} liegt außerhalb des Dateibereichs von '${refPath}' (${fileLinesCount} Zeilen).`,
                  `Referenced line L${startLine} is out of bounds for file '${refPath}' (${fileLinesCount} lines).`
                ),
                code: "LINE_OUT_OF_BOUNDS"
              });
            }
          }
        }
      }
    });

    // 2. Validate arc42 chapter content completeness
    if (file.path.startsWith("arc42/")) {
      let currentHeader = "";
      let currentHeaderLine = 1;
      let hasContentSinceHeader = false;

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        const lineNum = index + 1;

        if (trimmed.startsWith("# ") || trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
          // Check if previous header was left without content
          if (currentHeader && !hasContentSinceHeader) {
            diagnostics.push({
              filePath: file.path,
              line: currentHeaderLine,
              severity: "info",
              message: msg(
                `Abschnitt '${currentHeader.replace(/^#+\s*/, "")}' enthält noch keinen beschreibenden Inhalt.`,
                `Section '${currentHeader.replace(/^#+\s*/, "")}' does not contain any content yet.`
              ),
              code: "EMPTY_SECTION"
            });
          }
          currentHeader = trimmed;
          currentHeaderLine = lineNum;
          hasContentSinceHeader = false;
        } else if (trimmed !== "" && !trimmed.startsWith("<!--") && !trimmed.startsWith(">") && currentHeader) {
          hasContentSinceHeader = true;
        }
      });

      // Check final header
      if (currentHeader && !hasContentSinceHeader) {
        diagnostics.push({
          filePath: file.path,
          line: currentHeaderLine,
          severity: "info",
          message: msg(
            `Abschnitt '${currentHeader.replace(/^#+\s*/, "")}' enthält noch keinen beschreibenden Inhalt.`,
            `Section '${currentHeader.replace(/^#+\s*/, "")}' does not contain any content yet.`
          ),
          code: "EMPTY_SECTION"
        });
      }
    }

    // 3. Validate Architecture Decision Records (ADRs)
    if (file.path.startsWith("adrs/")) {
      const contentUpper = file.content.toUpperCase();
      const requiredSections = [
        { terms: ["STATUS"], labelDe: "## Status", labelEn: "## Status" },
        { terms: ["KONTEXT", "CONTEXT"], labelDe: "## Kontext", labelEn: "## Context" },
        { terms: ["ENTSCHEIDUNG", "DECISION"], labelDe: "## Entscheidung", labelEn: "## Decision" },
        { terms: ["KONSEQUENZEN", "CONSEQUENCES"], labelDe: "## Konsequenzen", labelEn: "## Consequences" }
      ];

      requiredSections.forEach(section => {
        const hasSection = section.terms.some(t => contentUpper.includes(t));
        if (!hasSection) {
          diagnostics.push({
            filePath: file.path,
            line: 1,
            severity: "warning",
            message: msg(
              `ADR entspricht nicht der Vorlage: Fehlender Pflichtabschnitt '${section.labelDe}'.`,
              `ADR does not match template: Missing required section '${section.labelEn}'.`
            ),
            code: "ADR_TEMPLATE_MISSING"
          });
        }
      });

      // Check for proposed/draft status vs accepted
      const isDraft = file.content.includes("Vorgeschlagen") || file.content.includes("Entwurf") || file.content.toLowerCase().includes("proposed") || file.content.toLowerCase().includes("draft");
      if (isDraft) {
        diagnostics.push({
          filePath: file.path,
          line: 3, // Usually status is at the top
          severity: "info",
          message: msg(
            `Architekturentscheidung '${file.name}' befindet sich noch im Entwurfsstatus (Vorgeschlagen).`,
            `Architecture Decision Record '${file.name}' is still in draft state (Proposed).`
          ),
          code: "ADR_DRAFT"
        });
      }
    }

    // 4. Validate Roadmaps (YAML date ordering & completeness)
    if (file.path === "management/roadmap.md") {
      const blocks = file.content.split("---");
      let currentLineTracker = 1;

      blocks.forEach(block => {
        const blockLines = block.split("\n");
        const blockLineCount = blockLines.length;

        if (block.includes("title:") || block.includes("status:")) {
          let startDateStr = "";
          let endDateStr = "";
          let title = "";
          let milestone = "";
          let status = "";
          let startLineOffset = 0;
          let endLineOffset = 0;

          blockLines.forEach((bLine, offset) => {
            const parts = bLine.split(":");
            if (parts.length < 2) return;
            const key = parts[0].trim();
            const val = parts.slice(1).join(":").trim().replace(/"/g, "").replace(/'/g, "");

            if (key === "title") title = val;
            if (key === "milestone") milestone = val;
            if (key === "status") status = val;
            if (key === "start_date") {
              startDateStr = val;
              startLineOffset = offset;
            }
            if (key === "end_date") {
              endDateStr = val;
              endLineOffset = offset;
            }
          });

          // Check title
          if (!title) {
            diagnostics.push({
              filePath: file.path,
              line: currentLineTracker + 1,
              severity: "warning",
              message: msg(
                "Roadmap-Eintrag fehlt das Pflichtfeld 'title'.",
                "Roadmap entry is missing the required 'title' field."
              ),
              code: "ROADMAP_TITLE_MISSING"
            });
          }

          // Check dates
          if (startDateStr && endDateStr) {
            const start = new Date(startDateStr);
            const end = new Date(endDateStr);
            if (isNaN(start.getTime())) {
              diagnostics.push({
                filePath: file.path,
                line: currentLineTracker + startLineOffset,
                severity: "error",
                message: msg(
                  `Ungültiges Startdatum: '${startDateStr}' (Format: YYYY-MM-DD).`,
                  `Invalid start date: '${startDateStr}' (Format: YYYY-MM-DD).`
                ),
                code: "INVALID_DATE"
              });
            }
            if (isNaN(end.getTime())) {
              diagnostics.push({
                filePath: file.path,
                line: currentLineTracker + endLineOffset,
                severity: "error",
                message: msg(
                  `Ungültiges Enddatum: '${endDateStr}' (Format: YYYY-MM-DD).`,
                  `Invalid end date: '${endDateStr}' (Format: YYYY-MM-DD).`
                ),
                code: "INVALID_DATE"
              });
            }
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
              diagnostics.push({
                filePath: file.path,
                line: currentLineTracker + endLineOffset,
                severity: "error",
                message: msg(
                  `Zeitraum-Fehler: Das Enddatum (${endDateStr}) liegt vor dem Startdatum (${startDateStr}).`,
                  `Date range error: End date (${endDateStr}) is before start date (${startDateStr}).`
                ),
                code: "DATE_ORDER_ERROR"
              });
            }
          }
        }

        currentLineTracker += blockLineCount + 1; // Account for split '---' separator
      });
    }

    // 5. Validate Definition of Done (DoD) compliance
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

      const draftADRs = files.filter(f => f.path.startsWith("adrs/") && (f.content.includes("Vorgeschlagen") || f.content.includes("Entwurf") || f.content.toLowerCase().includes("proposed") || f.content.toLowerCase().includes("draft")));
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

    // 6. Validate Definition of Ready (DoR) compliance
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
        const isCommitted = inActiveSprint || iss.status === "ready" || iss.status === "in-progress" || iss.status === "review";
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

    // 7. Validate Git-native Jira / Scrum Issues (issues/*.md)
    if (file.path.startsWith("issues/") && file.path.endsWith(".md")) {
      const issueMeta = parseIssueLintMetadata(file);
      if (!issueMeta) {
        diagnostics.push({
          filePath: file.path,
          line: 1,
          severity: "warning",
          message: msg(
            "Issue-Datei enthält keinen gültigen YAML-Frontmatter-Block (--- ... ---).",
            "Issue file is missing a valid YAML frontmatter block (--- ... ---)."
          ),
          code: "ISSUE_FRONTMATTER_MISSING"
        });
      } else {
        if (!issueMeta.title) {
          diagnostics.push({
            filePath: file.path,
            line: issueMeta.lines.title,
            severity: "warning",
            message: msg(
              `Ticket '${issueMeta.id}' hat keinen 'title' im YAML-Frontmatter.`,
              `Issue '${issueMeta.id}' is missing a 'title' in YAML frontmatter.`
            ),
            code: "ISSUE_TITLE_MISSING"
          });
        }

        const isActiveStatus = issueMeta.status === "in-progress" || issueMeta.status === "review";
        const inActiveSprint = Boolean(issueMeta.sprint && activeSprintIds.has(issueMeta.sprint.toLowerCase()));

        if (isActiveStatus && (!issueMeta.assignee || issueMeta.assignee.toLowerCase() === "unassigned")) {
          diagnostics.push({
            filePath: file.path,
            line: issueMeta.lines.assignee,
            severity: "warning",
            message: msg(
              `Ticket '${issueMeta.id}' im Status '${issueMeta.status}' hat keinen Bearbeiter ('assignee').`,
              `Issue '${issueMeta.id}' in '${issueMeta.status}' status is missing an 'assignee'.`
            ),
            code: "ISSUE_MISSING_ASSIGNEE"
          });
        }

        if ((isActiveStatus || (inActiveSprint && issueMeta.status === "ready")) && issueMeta.type !== "epic" && (!issueMeta.storyPoints || issueMeta.storyPoints <= 0)) {
          diagnostics.push({
            filePath: file.path,
            line: issueMeta.lines.storyPoints,
            severity: "warning",
            message: msg(
              `Ticket '${issueMeta.id}' (${issueMeta.status}) hat noch keine Story-Points-Schätzung (> 0).`,
              `Issue '${issueMeta.id}' (${issueMeta.status}) is missing Story Points (> 0).`
            ),
            code: "ISSUE_MISSING_POINTS"
          });
        }

        issueMeta.blockedBy.forEach(blockerId => {
          const blockerTarget = issueById.get(blockerId.toUpperCase());
          if (!blockerTarget) {
            diagnostics.push({
              filePath: file.path,
              line: issueMeta.lines.blockedBy,
              severity: "error",
              message: msg(
                `Unbekannte Blocker-Referenz: Ticket '${blockerId}' existiert nicht unter issues/*.md.`,
                `Unresolved blocker reference: Issue '${blockerId}' does not exist in issues/*.md.`
              ),
              code: "ISSUE_UNKNOWN_BLOCKER"
            });
          } else if (issueMeta.status !== "done" && blockerTarget.status !== "done") {
            diagnostics.push({
              filePath: file.path,
              line: issueMeta.lines.blockedBy,
              severity: "warning",
              message: msg(
                `Ticket '${issueMeta.id}' ist blockiert durch '${blockerTarget.id}' (aktueller Status: ${blockerTarget.status}).`,
                `Issue '${issueMeta.id}' is blocked by '${blockerTarget.id}' (current status: ${blockerTarget.status}).`
              ),
              code: "ISSUE_BLOCKED_UNRESOLVED"
            });
          }
        });

        if (issueMeta.startDate && issueMeta.endDate) {
          const start = new Date(issueMeta.startDate);
          const end = new Date(issueMeta.endDate);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
            diagnostics.push({
              filePath: file.path,
              line: issueMeta.lines.endDate,
              severity: "error",
              message: msg(
                `Zeitraum-Fehler in Ticket '${issueMeta.id}': Enddatum (${issueMeta.endDate}) liegt vor Startdatum (${issueMeta.startDate}).`,
                `Date range error in issue '${issueMeta.id}': End date (${issueMeta.endDate}) is before start date (${issueMeta.startDate}).`
              ),
              code: "DATE_ORDER_ERROR"
            });
          }
        }
      }
    }
  });

  return diagnostics;
}
