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

export function lintWorkspaceFiles(files: WorkspaceFile[], lang: "de" | "en" = "de"): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const msg = (de: string, en: string) => lang === "de" ? de : en;

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
      if (backlogFile) {
        const hasOpenTasks = backlogFile.content.includes("- [ ]") || backlogFile.content.includes("- [/]");
        if (hasOpenTasks) {
          diagnostics.push({
            filePath: file.path,
            line: 8,
            severity: "warning",
            message: msg(
              "Definition of Done verletzt: Es gibt noch offene oder unfertige Aufgaben im Sprint-Backlog.",
              "Definition of Done violated: There are still open or incomplete tasks in the sprint backlog."
            ),
            code: "DOD_OPEN_TASKS"
          });
        }
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
      const backlogFile = files.find(f => f.path === "management/sprint-backlog.md");
      if (backlogFile) {
        const lines = backlogFile.content.split("\n");
        let missingAssigneesCount = 0;
        let blockedTasksCount = 0;

        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [/]")) {
            // Check if assignee is missing (no @...)
            if (!/@([a-zA-Z0-9_-]+)/.test(trimmed)) {
              missingAssigneesCount++;
            }
            // Check if task contains BLOCKED
            if (trimmed.toUpperCase().includes("BLOCKED") || trimmed.toUpperCase().includes("BLOCKER")) {
              blockedTasksCount++;
            }
          }
        });

        if (missingAssigneesCount > 0) {
          diagnostics.push({
            filePath: file.path,
            line: 7,
            severity: "warning",
            message: msg(
              `Definition of Ready verletzt: ${missingAssigneesCount} Aufgabe(n) im Sprint-Backlog haben keine Zuweisung (@name).`,
              `Definition of Ready violated: ${missingAssigneesCount} task(s) in the sprint backlog are missing assignees (@name).`
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
              `Definition of Ready verletzt: Es gibt ${blockedTasksCount} blockierte Aufgabe(n) im aktuellen Sprint.`,
              `Definition of Ready violated: There are ${blockedTasksCount} blocked task(s) in the current sprint.`
            ),
            code: "DOR_BLOCKED_TASKS"
          });
        }
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
  });

  return diagnostics;
}
