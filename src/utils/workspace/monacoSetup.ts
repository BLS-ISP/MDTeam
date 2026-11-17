import type React from "react";
import type { Diagnostic } from "../linter";
import type { WorkspaceFile } from "../issueEngine";

export function getTemplateBlockSnippet(type: string): string | null {
  switch (type) {
    case "query":
      return `\n\`\`\`query\nFROM issues\nWHERE sprint = sprint-01\nSORT priority desc\nVIEW table\n\`\`\`\n`;
    case "adr":
      return `\n# ADR-XXXX: [Titel der Entscheidung]\n\n---\ntitle: "ADR-XXXX: [Titel]"\nstatus: "accepted"\nmilestone: "Architektur-Entscheidungen"\nstart_date: "${new Date().toISOString().split("T")[0]}"\nend_date: "${new Date().toISOString().split("T")[0]}"\nassignee: "Lead Architect"\ncolor: "#10b981"\n---\n\n## Status\n==Akzeptiert== (Zuvor: ~~vorgeschlagen~~)\n\n## Kontext\n[Kontext beschreiben...]\n\n## Entscheidung\n[Entscheidung beschreiben...]\n\n## Konsequenzen\n* [x] [Konsequenz 1]\n* [ ] [Konsequenz 2]\n\n<details>\n<summary>Weitere Diskussionspunkte & Notizen</summary>\n\n*   Alternative A wurde wegen Latenz verworfen.\n*   Alternative B war zu teuer.\n</details>\n`;
    case "table":
      return `\n| Header 1 | Header 2 | Header 3 |\n| :--- | :--- | :--- |\n| Zelle 1 | Zelle 2 | Zelle 3 |\n`;
    case "mermaid":
      return `\n\`\`\`mermaid\ngraph TD\n    A[Start] --> B(Prozess)\n    B --> C{Entscheidung}\n    C -->|Ja| D[Ergebnis A]\n    C -->|Nein| E[Ergebnis B]\n\`\`\`\n`;
    case "drawio":
      return `\n\`\`\`drawio\nhttps://viewer.diagrams.net/?chrome=0&lightbox=1#Uhttps%3A%2F%2Fraw.githubusercontent.com%2Fjgraph%2Fdrawio-diagrams%2Fmaster%2Fdocs%2F3d.xml\n\`\`\`\n`;
    case "todo":
      return `\n- [ ] Offene Aufgabe (Zuständig: @name, Fälligkeit: YYYY-MM-DD)\n`;
    case "backlog":
      return `\n- [ ] TODO: OAuth2-Verbindung in Keycloak testen @developer-a\n- [/] IN-PROGRESS: Yjs-Kollaborationsserver deployen @developer-b\n- [x] DONE: Monaco Autocomplete-Provider einrichten @developer-b\n`;
    case "blocker":
      return `\n- [ ] BLOCKED: LDAP-Port 389 ist in der Firewall gesperrt @scrummaster\n`;
    case "burndown":
      return `\n| Tag | Ideal-Linie | Restaufwand (Tatsächlich) |\n| :-- | :---------- | :------------------------ |\n| 1   | 60          | 60                        |\n| 2   | 50          | 55                        |\n| 3   | 40          | 42                        |\n| 4   | 30          | 38                        |\n| 5   | 20          | 20                        |\n| 6   | 10          | 12                        |\n| 7   | 0           | 0                         |\n`;
    case "roadmap-item":
      return `\n---\ntitle: "Neues Feature / Task"\nstatus: "pending"\nmilestone: "M2: Core Features"\nstart_date: "${new Date().toISOString().split("T")[0]}"\nend_date: "${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}"\nassignee: "Developer A"\ncolor: "#3b82f6"\n---\n`;
    case "bold":
      return `**fett gedruckter Text**`;
    case "italic":
      return `*kursiver Text*`;
    case "bullet-list":
      return `\n- Listenpunkt 1\n- Listenpunkt 2\n`;
    case "ordered-list":
      return `\n1. Erster Punkt\n2. Zweiter Punkt\n`;
    case "code-block":
      return `\n\`\`\`javascript\n// Code hier einfügen\nconsole.log("Hello World");\n\`\`\`\n`;
    case "quote":
      return `\n> Hier steht ein Zitat oder Hinweis-Block\n`;
    case "horizontal-rule":
      return `\n---\n`;
    case "link":
      return `[Link Beschreibung](https://example.com)`;
    case "image":
      return `![Bildbeschreibung](https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop)`;
    case "details":
      return `\n<details>\n<summary>Details einblenden</summary>\n\nZusätzlicher Inhalt...\n</details>\n`;
    case "reference":
      return `\n@[arc42/02_constraints.md#L4-L8]\n`;
    case "highlight":
      return `==Hervorgehobener Text==`;
    case "strikethrough":
      return `~~Durchgestrichener Text~~`;
    default:
      return null;
  }
}

export function insertTemplateBlock(type: string, insertTextFn: (text: string) => void): void {
  const snippet = getTemplateBlockSnippet(type);
  if (snippet !== null) {
    insertTextFn(snippet);
  }
}

export function registerCustomCompletions(monaco: any, filesRef: React.MutableRefObject<WorkspaceFile[]>): void {
  if ((monaco as any).__customCompletionsRegistered) return;
  (monaco as any).__customCompletionsRegistered = true;

  monaco.languages.registerCompletionItemProvider("markdown", {
    triggerCharacters: ["@", "[", ":", "-", " "],
    provideCompletionItems: (model: any, position: any) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const suggestions: any[] = [];

      // 1. Transclusion links (e.g. typing '@' or '@[')
      if (textUntilPosition.endsWith("@") || textUntilPosition.endsWith("@[") || textUntilPosition.includes("@")) {
        const openBracketIdx = textUntilPosition.lastIndexOf("@[");
        const simpleAtIdx = textUntilPosition.lastIndexOf("@");

        if (openBracketIdx !== -1 || simpleAtIdx !== -1) {
          filesRef.current.forEach((file) => {
            suggestions.push({
              label: `@[${file.path}]`,
              kind: monaco.languages.CompletionItemKind.Reference,
              insertText: openBracketIdx !== -1 ? file.path + "]" : `[${file.path}]`,
              detail: `Transklusion: Inhalt von ${file.name} einbetten`,
              documentation: {
                value: `Fügt eine Quoting-Referenz auf die Datei \`${file.path}\` ein.`,
              },
            });
          });
        }
      }

      // 2. YAML frontmatter keys & values inside '---' blocks
      const lines = model.getLinesContent();
      let inYaml = false;
      for (let i = 0; i < position.lineNumber - 1; i++) {
        if (lines[i] && lines[i].trim() === "---") {
          inYaml = !inYaml;
        }
      }

      if (inYaml) {
        const currentLine = lines[position.lineNumber - 1].trim();

        if (currentLine.includes("status:")) {
          suggestions.push(
            {
              label: '"completed"',
              kind: monaco.languages.CompletionItemKind.EnumMember,
              insertText: ' "completed"',
              detail: "Meilenstein abgeschlossen",
            },
            {
              label: '"in-progress"',
              kind: monaco.languages.CompletionItemKind.EnumMember,
              insertText: ' "in-progress"',
              detail: "Meilenstein in Bearbeitung",
            },
            {
              label: '"pending"',
              kind: monaco.languages.CompletionItemKind.EnumMember,
              insertText: ' "pending"',
              detail: "Meilenstein ausstehend",
            }
          );
        } else {
          const rule = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
          const kind = monaco.languages.CompletionItemKind.Property;
          suggestions.push(
            { label: "title", kind, insertText: 'title: "${1:Titel}"', insertTextRules: rule, detail: "Titel des Meilensteins" },
            { label: "status", kind, insertText: 'status: "${1:pending}"', insertTextRules: rule, detail: "completed | in-progress | pending" },
            { label: "milestone", kind, insertText: 'milestone: "${1:M1: Konzept}"', insertTextRules: rule, detail: "Meilenstein-Gruppe" },
            { label: "start_date", kind, insertText: 'start_date: "${1:2026-06-01}"', insertTextRules: rule, detail: "Startdatum (YYYY-MM-DD)" },
            { label: "end_date", kind, insertText: 'end_date: "${1:2026-06-15}"', insertTextRules: rule, detail: "Enddatum (YYYY-MM-DD)" },
            { label: "assignee", kind, insertText: 'assignee: "${1:Name}"', insertTextRules: rule, detail: "Zuständige Person / Team" },
            { label: "color", kind, insertText: 'color: "${1:#10b981}"', insertTextRules: rule, detail: "Eigene Statusfarbe (Hex)" }
          );
        }
      }

      // 3. Code block template suggestions
      if (textUntilPosition.endsWith("```")) {
        const rule = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
        const kind = monaco.languages.CompletionItemKind.Snippet;
        suggestions.push(
          {
            label: "query",
            kind,
            insertText: "query\nFROM ${1:issues}\nWHERE ${2:sprint = sprint-01}\nSORT ${3:priority desc}\nVIEW ${4:table}\n```",
            insertTextRules: rule,
            detail: "Confluence Live Query Macro (Issues / ADRs / Pages)",
          },
          {
            label: "drawio",
            kind,
            insertText: "drawio\n${1:https://embed.diagrams.net/?embed=1&ui=atlas&spin=1}\n```",
            insertTextRules: rule,
            detail: "Draw.io Diagramm einbetten",
          },
          {
            label: "mermaid",
            kind,
            insertText: "mermaid\ngraph TD\n    A[Start] --> B[Ziel]\n```",
            insertTextRules: rule,
            detail: "Mermaid Diagramm",
          }
        );
      }

      // 4. Agile Backlog and Blocker Prefix suggestions
      if (textUntilPosition.endsWith("-") || textUntilPosition.endsWith("- ")) {
        const rule = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
        const kind = monaco.languages.CompletionItemKind.Snippet;
        suggestions.push(
          { label: "[ ] TODO: ...", kind, insertText: "[ ] TODO: ${1:Aufgabe} @${2:assignee}", insertTextRules: rule, detail: "Neue offene Backlog-Aufgabe" },
          { label: "[/] IN-PROGRESS: ...", kind, insertText: "[/] IN-PROGRESS: ${1:Aufgabe} @${2:assignee}", insertTextRules: rule, detail: "Aufgabe in Bearbeitung" },
          { label: "[x] DONE: ...", kind, insertText: "[x] DONE: ${1:Aufgabe} @${2:assignee}", insertTextRules: rule, detail: "Erledigte Aufgabe" },
          { label: "[ ] BLOCKED: ...", kind, insertText: "[ ] BLOCKED: ${1:Blocker-Beschreibung} @scrummaster", insertTextRules: rule, detail: "Neuer Blocker (Impediment)" }
        );
      }

      return { suggestions };
    },
  });
}

export function applyMonacoDiagnosticsMarkers(
  editor: any,
  monaco: any,
  filePath: string,
  diagnostics: Diagnostic[]
): void {
  if (!editor || !monaco || !filePath) return;
  const model = editor.getModel();
  if (!model) return;
  const fileDiags = diagnostics.filter((d) => d.filePath === filePath);
  const markers = fileDiags.map((d) => ({
    startLineNumber: d.line,
    startColumn: 1,
    endLineNumber: d.line,
    endColumn: 100,
    message: d.message,
    severity:
      d.severity === "error"
        ? monaco.MarkerSeverity.Error
        : d.severity === "warning"
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Info,
  }));
  monaco.editor.setModelMarkers(model, "linter", markers);
}
