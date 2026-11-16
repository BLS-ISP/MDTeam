export interface WorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

export type ImportedIssueType = "epic" | "story" | "bug" | "task" | "spike";
export type ImportedIssueStatus = "backlog" | "ready" | "in-progress" | "review" | "done";
export type ImportedIssuePriority = "critical" | "high" | "medium" | "low";

export interface ImportedFilePreview {
  file: WorkspaceFile;
  kind: "issue" | "wiki";
  id: string;
  type: string;
  title: string;
  status: string;
  priority: string;
  storyPoints: number;
  sprint: string;
  assignee: string;
}

interface RawNormalizedIssue {
  rawKey: string;
  type: ImportedIssueType;
  title: string;
  description: string;
  status: ImportedIssueStatus;
  priority: ImportedIssuePriority;
  storyPoints: number;
  sprint: string;
  rawEpic: string;
  assignee: string;
  reporter: string;
  labels: string[];
  rawBlockedBy: string[];
  branch: string;
  createdAt: string;
  updatedAt: string;
  acceptanceCriteria: { text: string; checked: boolean }[];
  comments: { author: string; timestamp: string; text: string }[];
}

// ============================================================================
// Sample Demo Constants for 1-Click Wizard Testing
// ============================================================================

export const SAMPLE_JIRA_CSV = `Issue key,Issue Type,Summary,Description,Status,Priority,Custom field (Story Points),Assignee,Reporter,Labels,Labels,Sprint,Epic Link,Inward issue link (Blocks),Created,Updated,Comment,Comment
MDT-201,Epic,"Zero-Trust API Gateway & SSO Rollout","h2. Context
Consolidate external OAuth2/OIDC authentication flows with enterprise Keycloak and enforce token rotation across microservices.

* Support PKCE for desktop Tauri clients
* Enforce 15-minute access token TTL",In Progress,Highest,13,Developer A,Product Owner,security,sso,Sprint 01,,,2026-06-01T09:00:00.000+0000,2026-06-06T14:30:00.000+0000,"02/Jun/26 10:15 AM;Product Owner;Architecture board approved ADR-0001 for this epic.","04/Jun/26 03:40 PM;Developer A;Keycloak realm staging config is live."
MDT-202,Story,"Implement PKCE OAuth2 PKI Handshake in Desktop Shell","Allow Tauri desktop users to sign in via system browser loopback without embedding client secrets.

Acceptance Criteria:
- [x] Loopback listener binds ephemeral localhost port
- [ ] Code verifier uses SHA-256 S256 challenge
- [ ] Refresh token stored in OS keychain",In Progress,High,5,Developer A,Scrum Master,auth,tauri,Sprint 01,MDT-201,,2026-06-02T10:00:00.000+0000,2026-06-07T11:20:00.000+0000,"05/Jun/26 09:12 AM;Scrum Master;Confirmed scope for Sprint 01.",
MDT-203,Bug,"Race condition when refreshing expired JWT during Git push","When two background sync jobs trigger {{git_push}} simultaneously with an expired bearer token, the second request revokes the newly issued refresh token.

{code:ts}
if (tokenExpired(session)) {
  await mutex.runExclusive(() => refreshSessionToken());
}
{code}",Review,Critical,3,Developer B,Developer A,bugfix,gitops,Sprint 01,MDT-201,MDT-202,2026-06-03T08:30:00.000+0000,2026-06-08T16:45:00.000+0000,"06/Jun/26 02:00 PM;Developer B;Added async mutex around token refresh; ready for code review @developer-a.",
MDT-204,Task,"Write Confluence Migration Runbook & Stakeholder Guide","Document step-by-step CSV/JSON/HTML export steps from Atlassian Cloud into MDTeam Git repository, including field mappings and clean mode usage.",Ready,Medium,2,Scrum Master,Product Owner,documentation,migration,Sprint 01,MDT-201,,2026-06-04T11:00:00.000+0000,2026-06-07T09:15:00.000+0000,,
`;

export const SAMPLE_JIRA_JSON = JSON.stringify(
  {
    expand: "names,schema",
    total: 3,
    names: {
      customfield_10016: "Story Points",
      customfield_10020: "Sprint",
      customfield_10014: "Epic Link",
    },
    issues: [
      {
        key: "MDT-205",
        fields: {
          issuetype: { name: "Story" },
          summary: "Offline-First Yjs CRDT Snapshot Compaction",
          status: { name: "In Progress" },
          priority: { name: "High" },
          customfield_10016: 8,
          customfield_10020: [{ name: "Sprint 01", state: "active" }],
          customfield_10014: "MDT-101",
          assignee: { displayName: "Developer B" },
          reporter: { displayName: "Product Owner" },
          labels: ["crdt", "yjs", "performance"],
          created: "2026-06-02T08:15:00.000+0000",
          updated: "2026-06-08T12:00:00.000+0000",
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Compact incremental Yjs update vectors before auto-committing Markdown snapshots to Git so repository history stays lean.",
                  },
                ],
              },
              {
                type: "panel",
                attrs: { panelType: "info" },
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "Target < 50ms merge time for documents up to 5,000 lines.",
                        marks: [{ type: "strong" }],
                      },
                    ],
                  },
                ],
              },
              {
                type: "taskList",
                content: [
                  {
                    type: "taskItem",
                    attrs: { state: "DONE" },
                    content: [{ type: "text", text: "Benchmark Y.encodeStateAsUpdate on arc42 docs" }],
                  },
                  {
                    type: "taskItem",
                    attrs: { state: "TODO" },
                    content: [{ type: "text", text: "Persist compacted state vector on clean disconnect" }],
                  },
                ],
              },
            ],
          },
          comment: {
            comments: [
              {
                author: { displayName: "Developer A" },
                created: "2026-06-06T15:30:00.000+0000",
                body: {
                  type: "doc",
                  version: 1,
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Benchmarks look great — memory footprint dropped by " },
                        { type: "text", text: "64%", marks: [{ type: "strong" }] },
                        { type: "text", text: "!" },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      },
      {
        key: "MDT-206",
        fields: {
          issuetype: { name: "Bug" },
          summary: "Mermaid Sequence Diagram Overflow in Split View",
          status: { name: "Review" },
          priority: { name: "Medium" },
          customfield_10016: 3,
          customfield_10020: [{ name: "Sprint 01", state: "active" }],
          customfield_10014: "MDT-101",
          assignee: { displayName: "Developer A" },
          reporter: { displayName: "Scrum Master" },
          labels: ["ui", "mermaid"],
          issuelinks: [
            {
              type: { inward: "is blocked by" },
              inwardIssue: { key: "MDT-205" },
            },
          ],
          created: "2026-06-04T09:00:00.000+0000",
          updated: "2026-06-08T17:10:00.000+0000",
          description: "Wide sequence diagrams clip horizontally on 13-inch viewports unless `overflow-x: auto` container padding is preserved.",
          comment: {
            comments: [],
          },
        },
      },
    ],
  },
  null,
  2
);

export const SAMPLE_CONFLUENCE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Platform Engineering : System Architecture &amp; Deployment Runbook</title>
</head>
<body>
  <div id="main-content" class="wiki-content">
    <h1 id="title-text">System Architecture &amp; Deployment Runbook</h1>
    <div class="confluence-information-macro confluence-information-macro-information">
      <div class="confluence-information-macro-body">
        <p><strong>Single Source of Truth:</strong> Migrated from Atlassian Confluence Cloud to MDTeam Git-backed Knowledge Base.</p>
      </div>
    </div>

    <h2>1. Service Topology</h2>
    <p>MDTeam combines a <strong>Next.js 16 static frontend</strong> with a native <em>Tauri Rust GitOps bridge</em> and a real-time <code>y-websocket</code> collaboration tier.</p>

    <table>
      <thead>
        <tr>
          <th>Component</th>
          <th>Runtime</th>
          <th>SLA Target</th>
          <th>Owner</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Desktop Client</td>
          <td>Tauri 2 + Rust</td>
          <td>Local-First (0ms offline)</td>
          <td>@developer-a</td>
        </tr>
        <tr>
          <td>Collab Relay</td>
          <td>Node.js + Yjs</td>
          <td>99.95%</td>
          <td>@developer-b</td>
        </tr>
        <tr>
          <td>Git Remote</td>
          <td>GitLab Self-Hosted</td>
          <td>99.99%</td>
          <td>@scrum-master</td>
        </tr>
      </tbody>
    </table>

    <h2>2. Production Release Checklist</h2>
    <ul class="inline-task-list">
      <li data-inline-task-id="1" class="checked">Verify zero TypeScript &amp; Cargo compiler warnings</li>
      <li data-inline-task-id="2" class="checked">Tag release commit with signed GPG key</li>
      <li data-inline-task-id="3">Publish DOCX architecture release bundle for stakeholders</li>
    </ul>

    <div class="confluence-information-macro confluence-information-macro-warning">
      <div class="confluence-information-macro-body">
        <p><strong>Security Policy:</strong> Never pass unsanitized user strings starting with <code>-</code> to Git CLI subprocesses.</p>
      </div>
    </div>

    <h2>3. Healthcheck Command</h2>
    <pre><code class="language-bash">curl -fsSL https://collab.internal.example/healthz | jq .status</code></pre>

    <p>Related architecture decision: <a href="adrs/ADR-0001-auth-strategy.md">ADR-0001 Modular Authentication</a>.</p>
  </div>
</body>
</html>`;

// ============================================================================
// RFC-4180 CSV Parser
// ============================================================================

export function parseRfc4180Csv(csvContent: string): string[][] {
  const clean = csvContent.replace(/^\uFEFF/, "");
  if (!clean.trim()) return [];

  // Detect delimiter on first logical header line outside quotes (comma default, semicolon fallback)
  let commaCount = 0;
  let semicolonCount = 0;
  let scanQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"') {
      scanQuotes = !scanQuotes;
    } else if (!scanQuotes) {
      if (ch === ",") commaCount++;
      else if (ch === ";") semicolonCount++;
      else if (ch === "\n" || ch === "\r") break;
    }
  }
  const delimiter = commaCount === 0 && semicolonCount >= 2 ? ";" : ",";

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < clean.length && clean[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (ch === "\r") {
        if (i + 1 < clean.length && clean[i + 1] === "\n") {
          i++;
        }
        currentField += "\n";
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"' && currentField.length === 0) {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(currentField);
        currentField = "";
      } else if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && i + 1 < clean.length && clean[i + 1] === "\n") {
          i++;
        }
        currentRow.push(currentField);
        currentField = "";
        if (currentRow.some((cell) => cell.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((cell) => cell.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// ============================================================================
// Normalization & Conversion Helpers
// ============================================================================

function normalizeIssueType(raw: string): ImportedIssueType {
  const val = (raw || "").trim().toLowerCase();
  if (val.includes("epic")) return "epic";
  if (val.includes("bug") || val.includes("defect") || val.includes("incident") || val.includes("fehler")) {
    return "bug";
  }
  if (val.includes("spike") || val.includes("research") || val.includes("investigation")) {
    return "spike";
  }
  if (val.includes("story") || val.includes("feature") || val.includes("improvement")) {
    return "story";
  }
  return "task";
}

function normalizeIssueStatus(raw: string): ImportedIssueStatus {
  const val = (raw || "").trim().toLowerCase();
  if (
    val === "done" ||
    val === "closed" ||
    val === "resolved" ||
    val === "completed" ||
    val.includes("erledigt") ||
    val.includes("abgeschlossen") ||
    val.includes("fertig")
  ) {
    return "done";
  }
  if (
    val.includes("review") ||
    val === "qa" ||
    val.includes("testing") ||
    val.includes("prüfung") ||
    val.includes("freigabe")
  ) {
    return "review";
  }
  if (
    val.includes("progress") ||
    val === "active" ||
    val.includes("arbeit") ||
    val.includes("implement") ||
    val.includes("dev")
  ) {
    return "in-progress";
  }
  if (
    val === "ready" ||
    val.includes("selected for development") ||
    val.includes("ready for") ||
    val.includes("bereit")
  ) {
    return "ready";
  }
  return "backlog";
}

function normalizeIssuePriority(raw: string): ImportedIssuePriority {
  const val = (raw || "").trim().toLowerCase();
  if (
    val.includes("highest") ||
    val.includes("critical") ||
    val.includes("blocker") ||
    val.includes("urgent") ||
    val === "p0" ||
    val === "p1" ||
    val.includes("kritisch") ||
    val.includes("höchste")
  ) {
    return "critical";
  }
  if (val.includes("high") || val.includes("major") || val === "p2" || val.includes("hoch")) {
    return "high";
  }
  if (
    val.includes("low") ||
    val.includes("minor") ||
    val.includes("trivial") ||
    val === "p4" ||
    val.includes("niedrig") ||
    val.includes("gering")
  ) {
    return "low";
  }
  return "medium";
}

function normalizeUserHandle(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed || trimmed.toLowerCase() === "unassigned" || trimmed.toLowerCase() === "nicht zugewiesen") {
    return "";
  }
  if (trimmed.startsWith("@")) {
    return `@${trimmed
      .slice(1)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")}`;
  }
  // Convert email or display name into clean @handle
  const base = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
  const slug = base
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `@${slug}` : "";
}

function normalizeSprintName(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";

  // Handle Jira GreenHopper serialized sprint objects: com.atlassian.greenhopper...Sprint@[...,name=Sprint 1,...]
  const ghMatch = trimmed.match(/name=([^,\]]+)/i);
  const candidate = ghMatch ? ghMatch[1].trim() : trimmed;

  // Normalize "Sprint 1" or "Sprint 01" -> "sprint-01" to align with MDTeam sprint files
  const numMatch = candidate.match(/^sprint[\s_-]*(\d+)$/i);
  if (numMatch) {
    const num = numMatch[1].padStart(2, "0");
    return `sprint-${num}`;
  }

  return candidate
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const MONTH_MAP: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  mär: "03",
  apr: "04",
  may: "05",
  mai: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  okt: "10",
  nov: "11",
  dec: "12",
  dez: "12",
};

function normalizeDateString(raw: string, fallbackDate?: string): string {
  const today = fallbackDate || new Date().toISOString().slice(0, 10);
  const trimmed = (raw || "").trim();
  if (!trimmed) return today;

  // ISO format 2026-06-01...
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // German dd.mm.yyyy
  const deMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (deMatch) {
    const day = deMatch[1].padStart(2, "0");
    const month = deMatch[2].padStart(2, "0");
    const year = deMatch[3].length === 2 ? `20${deMatch[3]}` : deMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Jira CSV format e.g. 02/Jun/26 10:15 AM or 02/Jun/2026
  const jiraMatch = trimmed.match(/^(\d{1,2})\/([A-Za-zäöüÄÖÜ]{3})\/(\d{2,4})/);
  if (jiraMatch) {
    const day = jiraMatch[1].padStart(2, "0");
    const monKey = jiraMatch[2].toLowerCase().slice(0, 3);
    const month = MONTH_MAP[monKey] || "01";
    const year = jiraMatch[3].length === 2 ? `20${jiraMatch[3]}` : jiraMatch[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return today;
}

function normalizeTimestampString(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return new Date().toISOString().slice(0, 16).replace("T", " ");

  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]} ${isoMatch[2]}`;
  }

  const datePart = normalizeDateString(trimmed);
  const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const mins = timeMatch[2];
    const meridiem = (timeMatch[3] || "").toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return `${datePart} ${String(hours).padStart(2, "0")}:${mins}`;
  }

  return datePart;
}

function slugifyText(input: string, maxLen = 48): string {
  const slug = (input || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug || "untitled").slice(0, maxLen).replace(/-+$/g, "");
}

function buildSuggestedBranch(id: string, type: ImportedIssueType, title: string): string {
  const prefix = type === "bug" ? "fix" : type === "epic" || type === "story" ? "feat" : "chore";
  const slug = slugifyText(title, 34);
  return `${prefix}/${id}-${slug}`;
}

function convertJiraWikiToMarkdown(input: string): string {
  if (!input) return "";
  let text = input.replace(/\r\n/g, "\n");

  // {code:lang} ... {code}
  text = text.replace(/\{code(?::([a-zA-Z0-9_+-]+))?\}([\s\S]*?)\{code\}/g, (_m, lang, body) => {
    const cleanBody = String(body).replace(/^\n+|\n+$/g, "");
    return `\n\`\`\`${lang || ""}\n${cleanBody}\n\`\`\`\n`;
  });

  // {noformat} ... {noformat}
  text = text.replace(/\{noformat\}([\s\S]*?)\{noformat\}/g, (_m, body) => {
    const cleanBody = String(body).replace(/^\n+|\n+$/g, "");
    return `\n\`\`\`\n${cleanBody}\n\`\`\`\n`;
  });

  // {quote} / {panel}
  text = text.replace(/\{(?:quote|panel(?::[^}]*)?)\}([\s\S]*?)\{(?:quote|panel)\}/g, (_m, body) => {
    const lines = String(body)
      .trim()
      .split("\n")
      .map((l) => `> ${l}`);
    return `\n${lines.join("\n")}\n`;
  });

  // Headings h1. .. h6.
  text = text.replace(/^h([1-6])\.\s+(.*)$/gm, (_m, level, heading) => {
    return `${"#".repeat(Number(level))} ${heading.trim()}`;
  });

  // Monospace {{text}}
  text = text.replace(/\{\{([^}\n]+)\}\}/g, "`$1`");

  // Jira links [label|https://...]
  text = text.replace(/\[([^\]|\n]+)\|((?:https?:\/\/|mailto:|\/|[a-zA-Z0-9_.-]+\/)[^\]\n]+)\]/g, "[$1]($2)");

  return text.trim();
}

function splitDescriptionAndAcceptanceCriteria(
  rawDescription: string,
  explicitAc: string
): {
  cleanDescription: string;
  criteria: { text: string; checked: boolean }[];
} {
  const criteria: { text: string; checked: boolean }[] = [];

  const collectChecklistLines = (source: string) => {
    for (const line of source.split("\n")) {
      const checkMatch = line.match(/^\s*[-*]\s*\[([ xX])\]\s+(.+)$/);
      if (checkMatch) {
        criteria.push({
          checked: checkMatch[1].toLowerCase() === "x",
          text: checkMatch[2].trim(),
        });
      } else {
        const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
        if (bulletMatch && bulletMatch[1].trim()) {
          criteria.push({
            checked: false,
            text: bulletMatch[1].trim(),
          });
        }
      }
    }
  };

  if (explicitAc.trim()) {
    collectChecklistLines(explicitAc);
    if (criteria.length === 0) {
      explicitAc
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((l) => criteria.push({ checked: false, text: l }));
    }
  }

  let desc = rawDescription;
  // Extract inline "Acceptance Criteria:" / "Akzeptanzkriterien:" section if present
  const acHeaderRegex = /(?:^|\n)(?:#{1,4}\s*)?(?:Acceptance Criteria|Akzeptanzkriterien)\s*:?\s*\n([\s\S]*)$/i;
  const acMatch = desc.match(acHeaderRegex);
  if (acMatch) {
    collectChecklistLines(acMatch[1]);
    desc = desc.slice(0, acMatch.index).trim();
  } else if (criteria.length === 0) {
    // Extract standalone markdown task items from description without removing prose paragraphs
    const remainingLines: string[] = [];
    for (const line of desc.split("\n")) {
      const taskMatch = line.match(/^\s*[-*]\s*\[([ xX])\]\s+(.+)$/);
      if (taskMatch) {
        criteria.push({
          checked: taskMatch[1].toLowerCase() === "x",
          text: taskMatch[2].trim(),
        });
      } else {
        remainingLines.push(line);
      }
    }
    if (criteria.length > 0) {
      desc = remainingLines.join("\n").trim();
    }
  }

  return {
    cleanDescription: desc.trim(),
    criteria,
  };
}

function escapeYamlDoubleQuoted(val: string): string {
  return (val || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ")
    .trim();
}

function formatYamlStringArray(items: string[]): string {
  const unique = Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
  if (unique.length === 0) return "[]";
  return `[${unique.map((item) => `"${escapeYamlDoubleQuoted(item)}"`).join(", ")}]`;
}

function parseJiraCsvComment(rawCell: string): { author: string; timestamp: string; text: string } | null {
  const trimmed = (rawCell || "").trim();
  if (!trimmed) return null;

  // Standard Jira CSV format: "02/Jun/26 10:15 AM;username;Comment body..."
  const parts = trimmed.split(";");
  if (parts.length >= 3) {
    const maybeDate = parts[0].trim();
    const maybeAuthor = parts[1].trim();
    const body = parts.slice(2).join(";").trim();
    if (body && /\d/.test(maybeDate)) {
      return {
        timestamp: normalizeTimestampString(maybeDate),
        author: normalizeUserHandle(maybeAuthor) || "@jira-user",
        text: convertJiraWikiToMarkdown(body).replace(/\n+/g, " "),
      };
    }
  }

  return {
    timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
    author: "@jira-import",
    text: convertJiraWikiToMarkdown(trimmed).replace(/\n+/g, " "),
  };
}

function finalizeIssuesToWorkspaceFiles(
  rawIssues: RawNormalizedIssue[],
  projectPrefix?: string
): WorkspaceFile[] {
  const cleanPrefix = (projectPrefix || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  // First pass: assign final IDs and record rawKey -> finalId map so Epic/BlockedBy links stay intact
  const keyMap = new Map<string, string>();
  const usedIds = new Set<string>();

  const assignedIds = rawIssues.map((item, idx) => {
    const trimmedRawKey = (item.rawKey || "").trim().toUpperCase();
    let candidateId = "";

    if (cleanPrefix) {
      const numMatch = trimmedRawKey.match(/-(\d+)$/);
      const numPart = numMatch ? numMatch[1] : String(201 + idx);
      candidateId = `${cleanPrefix}-${numPart}`;
    } else if (trimmedRawKey) {
      candidateId = trimmedRawKey.replace(/[^A-Z0-9_-]/g, "-");
    } else {
      candidateId = `MDT-${201 + idx}`;
    }

    let uniqueId = candidateId;
    let suffix = 2;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${candidateId}-${suffix++}`;
    }
    usedIds.add(uniqueId);

    if (trimmedRawKey) {
      keyMap.set(trimmedRawKey, uniqueId);
    }
    return uniqueId;
  });

  // Second pass: serialize each issue into atomic `issues/<ID>.md` WorkspaceFile
  return rawIssues.map((issue, idx) => {
    const id = assignedIds[idx];
    const rawEpicUpper = issue.rawEpic.trim().toUpperCase();
    const epic = rawEpicUpper
      ? keyMap.get(rawEpicUpper) || rawEpicUpper.replace(/[^A-Z0-9_-]/g, "-")
      : "";

    const blockedBy = issue.rawBlockedBy
      .map((b) => b.trim().toUpperCase())
      .filter(Boolean)
      .map((b) => keyMap.get(b) || b.replace(/[^A-Z0-9_-]/g, "-"));

    const branch = issue.branch.trim() || buildSuggestedBranch(id, issue.type, issue.title);

    const frontmatterLines = [
      "---",
      `id: "${escapeYamlDoubleQuoted(id)}"`,
      `type: "${issue.type}"`,
      `title: "${escapeYamlDoubleQuoted(issue.title)}"`,
      `status: "${issue.status}"`,
      `priority: "${issue.priority}"`,
      `story_points: ${Number.isFinite(issue.storyPoints) && issue.storyPoints >= 0 ? issue.storyPoints : 0}`,
      `sprint: "${escapeYamlDoubleQuoted(issue.sprint)}"`,
      `epic: "${escapeYamlDoubleQuoted(epic)}"`,
      `assignee: "${escapeYamlDoubleQuoted(issue.assignee)}"`,
      `reporter: "${escapeYamlDoubleQuoted(issue.reporter)}"`,
      `labels: ${formatYamlStringArray(issue.labels)}`,
      `blocked_by: ${formatYamlStringArray(blockedBy)}`,
      `branch: "${escapeYamlDoubleQuoted(branch)}"`,
      `created_at: "${escapeYamlDoubleQuoted(issue.createdAt)}"`,
      `updated_at: "${escapeYamlDoubleQuoted(issue.updatedAt)}"`,
      "---",
    ];

    const acLines =
      issue.acceptanceCriteria.length > 0
        ? issue.acceptanceCriteria.map((ac) => `- [${ac.checked ? "x" : " "}] ${ac.text}`).join("\n")
        : `- [ ] Verify implementation and Definition of Done for ${id}`;

    const commentLines =
      issue.comments.length > 0
        ? issue.comments
            .map((c) => `- **${c.author || "@team"}** (${c.timestamp}): ${c.text}`)
            .join("\n")
        : "";

    const bodySections = [
      frontmatterLines.join("\n"),
      "",
      `# ${id}: ${issue.title.trim()}`,
      "",
      "## Description",
      "",
      issue.description || "_No description provided in Jira export._",
      "",
      "## Acceptance Criteria",
      "",
      acLines,
      "",
      "## Comments",
      "",
      commentLines,
    ];

    return {
      path: `issues/${id}.md`,
      name: `${id}.md`,
      category: "issues",
      content: `${bodySections.join("\n").trimEnd()}\n`,
    };
  });
}

// ============================================================================
// 1. Jira CSV Importer
// ============================================================================

export function importJiraCsv(csvContent: string, projectPrefix?: string): WorkspaceFile[] {
  const rows = parseRfc4180Csv(csvContent);
  if (rows.length < 2) return [];

  const rawHeaders = rows[0].map((h) => h.trim().toLowerCase());

  const getAllByHeader = (row: string[], ...candidates: string[]): string[] => {
    const normalizedCandidates = candidates.map((c) => c.toLowerCase());
    const values: string[] = [];
    for (let colIdx = 0; colIdx < rawHeaders.length; colIdx++) {
      const header = rawHeaders[colIdx];
      if (normalizedCandidates.some((cand) => header === cand || header.startsWith(`${cand} (`))) {
        const cell = (row[colIdx] || "").trim();
        if (cell) values.push(cell);
      }
    }
    return values;
  };

  const getFirstByHeader = (row: string[], ...candidates: string[]): string => {
    const vals = getAllByHeader(row, ...candidates);
    return vals[0] || "";
  };

  const rawIssues: RawNormalizedIssue[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const summary = getFirstByHeader(row, "summary", "title", "zusammenfassung", "titel");
    const rawKey = getFirstByHeader(row, "issue key", "key", "issue id", "vorgangsschlüssel", "id");

    if (!summary && !rawKey) continue;

    const title = summary || rawKey;
    const type = normalizeIssueType(
      getFirstByHeader(row, "issue type", "issuetype", "type", "vorgangstyp", "typ")
    );
    const status = normalizeIssueStatus(getFirstByHeader(row, "status"));
    const priority = normalizeIssuePriority(getFirstByHeader(row, "priority", "priorität"));

    const spRaw = getFirstByHeader(
      row,
      "story points",
      "custom field (story points)",
      "custom field (story point estimate)",
      "story point estimate",
      "story_points",
      "aufwand"
    );
    const parsedSp = parseFloat(spRaw.replace(",", "."));
    const storyPoints = Number.isFinite(parsedSp) && parsedSp >= 0 ? Math.round(parsedSp) : 0;

    const assignee = normalizeUserHandle(getFirstByHeader(row, "assignee", "bearbeiter"));
    const reporter = normalizeUserHandle(getFirstByHeader(row, "reporter", "autor", "creator"));

    const labelCells = getAllByHeader(row, "labels", "label", "stichwörter");
    const labels = labelCells
      .flatMap((cell) => cell.split(/[,;\s]+/))
      .map((l) => l.trim())
      .filter(Boolean);

    const sprintCells = getAllByHeader(row, "sprint", "custom field (sprint)");
    const sprint = sprintCells.length > 0 ? normalizeSprintName(sprintCells[sprintCells.length - 1]) : "";

    const rawEpic = getFirstByHeader(
      row,
      "epic link",
      "custom field (epic link)",
      "parent key",
      "parent",
      "epic"
    );

    const blockedCells = getAllByHeader(
      row,
      "blocked by",
      "inward issue link (blocks)",
      "custom field (flagged)",
      "blocks"
    );
    const rawBlockedBy = blockedCells
      .flatMap((cell) => cell.split(/[,;\s]+/))
      .map((s) => s.trim())
      .filter((s) => /^[A-Za-z]+-\d+$/.test(s));

    const createdAt = normalizeDateString(getFirstByHeader(row, "created", "created_at", "erstellt"));
    const updatedAt = normalizeDateString(
      getFirstByHeader(row, "updated", "updated_at", "aktualisiert"),
      createdAt
    );

    const rawDescription = convertJiraWikiToMarkdown(
      getFirstByHeader(row, "description", "beschreibung")
    );
    const explicitAc = convertJiraWikiToMarkdown(
      getFirstByHeader(
        row,
        "acceptance criteria",
        "custom field (acceptance criteria)",
        "akzeptanzkriterien"
      )
    );
    const { cleanDescription, criteria } = splitDescriptionAndAcceptanceCriteria(
      rawDescription,
      explicitAc
    );

    const commentCells = getAllByHeader(row, "comment", "comments", "kommentar");
    const comments = commentCells
      .map((cell) => parseJiraCsvComment(cell))
      .filter((c): c is { author: string; timestamp: string; text: string } => c !== null);

    const explicitBranch = getFirstByHeader(row, "branch", "git branch");

    rawIssues.push({
      rawKey,
      type,
      title,
      description: cleanDescription,
      status,
      priority,
      storyPoints,
      sprint,
      rawEpic,
      assignee,
      reporter,
      labels,
      rawBlockedBy,
      branch: explicitBranch,
      createdAt,
      updatedAt,
      acceptanceCriteria: criteria,
      comments,
    });
  }

  return finalizeIssuesToWorkspaceFiles(rawIssues, projectPrefix);
}

// ============================================================================
// 2. Jira JSON + Atlassian Document Format (ADF) Importer
// ============================================================================

interface AdfMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface AdfNode {
  type?: string;
  text?: string;
  marks?: AdfMark[];
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
}

export function convertAdfToMarkdown(adfInput: unknown): string {
  if (!adfInput) return "";
  if (typeof adfInput === "string") {
    return convertJiraWikiToMarkdown(adfInput);
  }
  if (typeof adfInput !== "object") {
    return String(adfInput);
  }

  const renderInlineMarks = (text: string, marks?: AdfMark[]): string => {
    if (!marks || marks.length === 0) return text;
    let out = text;
    for (const mark of marks) {
      switch (mark.type) {
        case "code":
          out = `\`${out}\``;
          break;
        case "strong":
          out = `**${out}**`;
          break;
        case "em":
          out = `*${out}*`;
          break;
        case "strike":
          out = `~~${out}~~`;
          break;
        case "link": {
          const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "#";
          out = `[${out}](${href})`;
          break;
        }
        default:
          break;
      }
    }
    return out;
  };

  const walk = (node: AdfNode, listDepth = 0): string => {
    if (!node || typeof node !== "object") return "";
    const children = Array.isArray(node.content) ? node.content : [];

    switch (node.type) {
      case "doc":
        return children
          .map((child) => walk(child, listDepth))
          .filter(Boolean)
          .join("\n\n")
          .trim();

      case "paragraph":
        return children.map((child) => walk(child, listDepth)).join("");

      case "text":
        return renderInlineMarks(node.text || "", node.marks);

      case "hardBreak":
        return "\n";

      case "mention": {
        const mentionText =
          typeof node.attrs?.text === "string"
            ? node.attrs.text
            : typeof node.attrs?.id === "string"
              ? `@${node.attrs.id}`
              : "@user";
        return normalizeUserHandle(mentionText) || mentionText;
      }

      case "emoji":
        return typeof node.attrs?.text === "string"
          ? node.attrs.text
          : typeof node.attrs?.shortName === "string"
            ? node.attrs.shortName
            : "";

      case "status": {
        const label = typeof node.attrs?.text === "string" ? node.attrs.text : "STATUS";
        return `\`[${label.toUpperCase()}]\``;
      }

      case "inlineCard":
      case "blockCard": {
        const url = typeof node.attrs?.url === "string" ? node.attrs.url : "";
        return url ? `[${url}](${url})` : "";
      }

      case "heading": {
        const rawLevel = Number(node.attrs?.level) || 2;
        const level = Math.min(6, Math.max(1, rawLevel));
        const headingText = children.map((c) => walk(c, listDepth)).join("").trim();
        return `${"#".repeat(level)} ${headingText}`;
      }

      case "bulletList": {
        return children
          .map((item) => {
            const indent = "  ".repeat(listDepth);
            const itemContent = (item.content || [])
              .map((sub) => {
                if (sub.type === "bulletList" || sub.type === "orderedList") {
                  return `\n${walk(sub, listDepth + 1)}`;
                }
                return walk(sub, listDepth + 1);
              })
              .join(" ");
            return `${indent}- ${itemContent.trimStart()}`;
          })
          .join("\n");
      }

      case "orderedList": {
        return children
          .map((item, idx) => {
            const indent = "  ".repeat(listDepth);
            const itemContent = (item.content || [])
              .map((sub) => {
                if (sub.type === "bulletList" || sub.type === "orderedList") {
                  return `\n${walk(sub, listDepth + 1)}`;
                }
                return walk(sub, listDepth + 1);
              })
              .join(" ");
            return `${indent}${idx + 1}. ${itemContent.trimStart()}`;
          })
          .join("\n");
      }

      case "taskList": {
        return children
          .map((item) => {
            const isDone = String(item.attrs?.state || "").toUpperCase() === "DONE";
            const itemText = (item.content || []).map((c) => walk(c, listDepth)).join("").trim();
            return `- [${isDone ? "x" : " "}] ${itemText}`;
          })
          .join("\n");
      }

      case "taskItem": {
        const isDone = String(node.attrs?.state || "").toUpperCase() === "DONE";
        const itemText = children.map((c) => walk(c, listDepth)).join("").trim();
        return `- [${isDone ? "x" : " "}] ${itemText}`;
      }

      case "codeBlock": {
        const lang = typeof node.attrs?.language === "string" ? node.attrs.language : "";
        const codeText = children.map((c) => c.text || walk(c, listDepth)).join("");
        return `\`\`\`${lang}\n${codeText.replace(/\n+$/, "")}\n\`\`\``;
      }

      case "blockquote": {
        const inner = children
          .map((c) => walk(c, listDepth))
          .join("\n")
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");
        return inner;
      }

      case "panel": {
        const panelType = String(node.attrs?.panelType || "info").toUpperCase();
        const innerText = children
          .map((c) => walk(c, listDepth))
          .join("\n")
          .trim();
        const lines = innerText.split("\n");
        lines[0] = `**[${panelType}]** ${lines[0] || ""}`.trim();
        return lines.map((l) => `> ${l}`).join("\n");
      }

      case "rule":
        return "---";

      case "table": {
        const tableRows = children
          .filter((r) => r.type === "tableRow")
          .map((row) =>
            (row.content || []).map((cell) =>
              (cell.content || [])
                .map((c) => walk(c, listDepth))
                .join(" ")
                .replace(/\|/g, "\\|")
                .replace(/\s*\n\s*/g, " ")
                .trim()
            )
          );
        if (tableRows.length === 0) return "";
        const colCount = Math.max(...tableRows.map((r) => r.length), 1);
        const padRow = (r: string[]) => {
          const padded = [...r];
          while (padded.length < colCount) padded.push("");
          return `| ${padded.join(" | ")} |`;
        };
        const headerLine = padRow(tableRows[0]);
        const sepLine = `| ${Array(colCount).fill("---").join(" | ")} |`;
        const bodyLines = tableRows.slice(1).map(padRow);
        return [headerLine, sepLine, ...bodyLines].join("\n");
      }

      default:
        return children.map((c) => walk(c, listDepth)).join("");
    }
  };

  return walk(adfInput as AdfNode);
}

function extractStringName(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    const rec = val as Record<string, unknown>;
    if (typeof rec.displayName === "string") return rec.displayName;
    if (typeof rec.name === "string") return rec.name;
    if (typeof rec.key === "string") return rec.key;
    if (typeof rec.value === "string") return rec.value;
    if (typeof rec.emailAddress === "string") return rec.emailAddress;
  }
  return "";
}

export function importJiraJson(jsonContent: string, projectPrefix?: string): WorkspaceFile[] {
  const clean = jsonContent.replace(/^\uFEFF/, "").trim();
  if (!clean) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error("Invalid Jira JSON export: failed to parse JSON content.");
  }

  let issuesArray: Record<string, unknown>[] = [];
  let fieldNamesMap: Record<string, string> = {};

  if (Array.isArray(parsed)) {
    issuesArray = parsed.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  } else if (parsed && typeof parsed === "object") {
    const root = parsed as Record<string, unknown>;
    if (root.names && typeof root.names === "object") {
      fieldNamesMap = root.names as Record<string, string>;
    }
    if (Array.isArray(root.issues)) {
      issuesArray = root.issues.filter(
        (x): x is Record<string, unknown> => !!x && typeof x === "object"
      );
    } else if (root.key || root.fields || root.summary) {
      issuesArray = [root];
    }
  }

  // Locate dynamic customfield IDs via `names` metadata if present
  const findCustomFieldKey = (pattern: RegExp): string | undefined => {
    return Object.entries(fieldNamesMap).find(([, display]) =>
      pattern.test(String(display))
    )?.[0];
  };

  const spFieldKey = findCustomFieldKey(/story\s*point/i);
  const sprintFieldKey = findCustomFieldKey(/^sprint$/i);
  const epicFieldKey = findCustomFieldKey(/epic\s*link/i);

  const rawIssues: RawNormalizedIssue[] = [];

  for (const item of issuesArray) {
    const fields =
      item.fields && typeof item.fields === "object"
        ? (item.fields as Record<string, unknown>)
        : item;

    const rawKey = String(item.key || fields.key || item.id || "");
    const summary = String(fields.summary || fields.title || rawKey || "").trim();
    if (!summary && !rawKey) continue;

    const type = normalizeIssueType(
      extractStringName(fields.issuetype || fields.issueType || fields.type)
    );
    const status = normalizeIssueStatus(extractStringName(fields.status));
    const priority = normalizeIssuePriority(extractStringName(fields.priority));

    // Story Points resolution
    const spCandidates = [
      spFieldKey ? fields[spFieldKey] : undefined,
      fields.storyPoints,
      fields.story_points,
      fields["Story Points"],
      fields.customfield_10016,
      fields.customfield_10026,
      fields.customfield_10002,
    ];
    let storyPoints = 0;
    for (const cand of spCandidates) {
      if (typeof cand === "number" && Number.isFinite(cand) && cand >= 0) {
        storyPoints = Math.round(cand);
        break;
      }
      if (typeof cand === "string" && cand.trim() !== "") {
        const num = parseFloat(cand);
        if (Number.isFinite(num) && num >= 0) {
          storyPoints = Math.round(num);
          break;
        }
      }
    }

    // Sprint resolution
    const rawSprintVal =
      (sprintFieldKey ? fields[sprintFieldKey] : undefined) ??
      fields.sprint ??
      fields.sprints ??
      fields.customfield_10020;
    let sprint = "";
    if (Array.isArray(rawSprintVal) && rawSprintVal.length > 0) {
      const activeOrLast =
        rawSprintVal.find(
          (s) => s && typeof s === "object" && String((s as Record<string, unknown>).state).toLowerCase() === "active"
        ) || rawSprintVal[rawSprintVal.length - 1];
      sprint = normalizeSprintName(extractStringName(activeOrLast));
    } else if (rawSprintVal) {
      sprint = normalizeSprintName(extractStringName(rawSprintVal));
    }

    // Epic Link resolution
    let rawEpic = "";
    const epicCandidate =
      (epicFieldKey ? fields[epicFieldKey] : undefined) ??
      fields.epic ??
      fields.customfield_10014;
    if (epicCandidate) {
      rawEpic = extractStringName(epicCandidate);
    } else if (fields.parent && typeof fields.parent === "object") {
      const parentObj = fields.parent as Record<string, unknown>;
      rawEpic = String(parentObj.key || "");
    }

    const assignee = normalizeUserHandle(extractStringName(fields.assignee));
    const reporter = normalizeUserHandle(extractStringName(fields.reporter || fields.creator));

    const labels = Array.isArray(fields.labels)
      ? fields.labels.map((l) => String(l).trim()).filter(Boolean)
      : [];

    // Blocked by links from `issuelinks`
    const rawBlockedBy: string[] = [];
    if (Array.isArray(fields.issuelinks)) {
      for (const link of fields.issuelinks) {
        if (!link || typeof link !== "object") continue;
        const linkObj = link as Record<string, unknown>;
        const linkType = (linkObj.type as Record<string, unknown> | undefined) || {};
        const inwardDesc = String(linkType.inward || linkType.name || "").toLowerCase();
        const inwardIssue = linkObj.inwardIssue as Record<string, unknown> | undefined;
        if (inwardIssue?.key && (inwardDesc.includes("block") || inwardDesc === "")) {
          rawBlockedBy.push(String(inwardIssue.key));
        }
      }
    }
    if (Array.isArray(fields.blocked_by)) {
      fields.blocked_by.forEach((b) => rawBlockedBy.push(String(b)));
    }

    const createdAt = normalizeDateString(String(fields.created || fields.created_at || ""));
    const updatedAt = normalizeDateString(
      String(fields.updated || fields.updated_at || ""),
      createdAt
    );

    const renderedDescription = convertAdfToMarkdown(fields.description);
    const { cleanDescription, criteria } = splitDescriptionAndAcceptanceCriteria(
      renderedDescription,
      ""
    );

    // Comments (`fields.comment.comments[]` or `fields.comments[]`)
    const comments: { author: string; timestamp: string; text: string }[] = [];
    const commentContainer = fields.comment as Record<string, unknown> | undefined;
    const rawCommentsList = Array.isArray(commentContainer?.comments)
      ? commentContainer.comments
      : Array.isArray(fields.comments)
        ? fields.comments
        : [];

    for (const c of rawCommentsList) {
      if (!c || typeof c !== "object") continue;
      const cObj = c as Record<string, unknown>;
      const author =
        normalizeUserHandle(extractStringName(cObj.author || cObj.updateAuthor)) || "@jira-user";
      const timestamp = normalizeTimestampString(String(cObj.created || cObj.updated || ""));
      const bodyText = convertAdfToMarkdown(cObj.body || cObj.text)
        .replace(/\s*\n\s*/g, " ")
        .trim();
      if (bodyText) {
        comments.push({ author, timestamp, text: bodyText });
      }
    }

    rawIssues.push({
      rawKey,
      type,
      title: summary,
      description: cleanDescription,
      status,
      priority,
      storyPoints,
      sprint,
      rawEpic,
      assignee,
      reporter,
      labels,
      rawBlockedBy,
      branch: typeof fields.branch === "string" ? fields.branch : "",
      createdAt,
      updatedAt,
      acceptanceCriteria: criteria,
      comments,
    });
  }

  return finalizeIssuesToWorkspaceFiles(rawIssues, projectPrefix);
}

// ============================================================================
// 3. Confluence HTML / Markdown Importer
// ============================================================================

function decodeHtmlEntities(input: string): string {
  if (!input) return "";
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    "#39": "'",
    nbsp: " ",
    mdash: "—",
    ndash: "–",
    rarr: "→",
    larr: "←",
    hellip: "…",
    copy: "©",
  };
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z0-9]+);/g, (full, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (entity.startsWith("#")) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return named[entity] ?? full;
  });
}

function stripTagsToInlineMarkdown(fragment: string): string {
  let s = fragment;

  // Confluence status lozenge <span class="status-macro ...">APPROVED</span>
  s = s.replace(/<span[^>]*class="[^"]*status-macro[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, (_m, txt) => {
    return `\`[${decodeHtmlEntities(txt.replace(/<[^>]+>/g, "").trim())}]\``;
  });

  // Inline code
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, txt) => {
    return `\`${decodeHtmlEntities(txt.replace(/<[^>]+>/g, "").trim())}\``;
  });

  // Links
  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
    const cleanLabel = stripTagsToInlineMarkdown(label).trim() || href;
    return `[${cleanLabel}](${decodeHtmlEntities(href.trim())})`;
  });

  // Images
  s = s.replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi, (full, src) => {
    const altMatch = full.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]) : "image";
    return `![${alt}](${decodeHtmlEntities(src.trim())})`;
  });

  // Strong / Bold
  s = s.replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, (_m, inner) => {
    const clean = stripTagsToInlineMarkdown(inner).trim();
    return clean ? `**${clean}**` : "";
  });

  // Emphasis / Italic
  s = s.replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, (_m, inner) => {
    const clean = stripTagsToInlineMarkdown(inner).trim();
    return clean ? `*${clean}*` : "";
  });

  // Strikethrough
  s = s.replace(/<(?:del|s|strike)\b[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, (_m, inner) => {
    const clean = stripTagsToInlineMarkdown(inner).trim();
    return clean ? `~~${clean}~~` : "";
  });

  // Line breaks
  s = s.replace(/<br\s*\/?>/gi, " ");

  // Strip remaining HTML/XML tags
  s = s.replace(/<[^>]+>/g, "");

  return decodeHtmlEntities(s).replace(/[ \t]+/g, " ");
}

function convertHtmlTableToMarkdown(tableHtml: string): string {
  const rowMatches = Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
  if (rowMatches.length === 0) return "";

  const parsedRows: string[][] = [];
  for (const rMatch of rowMatches) {
    const rowInner = rMatch[1];
    const cells = Array.from(rowInner.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)).map(
      (cMatch) =>
        stripTagsToInlineMarkdown(cMatch[1])
          .replace(/\|/g, "\\|")
          .replace(/\s*\n\s*/g, " ")
          .trim()
    );
    if (cells.length > 0) {
      parsedRows.push(cells);
    }
  }

  if (parsedRows.length === 0) return "";
  const colCount = Math.max(...parsedRows.map((r) => r.length), 1);

  const formatRow = (row: string[]) => {
    const padded = [...row];
    while (padded.length < colCount) padded.push("");
    return `| ${padded.join(" | ")} |`;
  };

  const header = formatRow(parsedRows[0]);
  const separator = `| ${Array(colCount).fill("---").join(" | ")} |`;
  const body = parsedRows.slice(1).map(formatRow);

  return `\n\n${[header, separator, ...body].join("\n")}\n\n`;
}

export function convertConfluenceHtmlToMarkdown(
  html: string,
  fallbackTitle = "Imported Confluence Page"
): { title: string; markdown: string } {
  let work = html.replace(/\r\n/g, "\n");

  // Extract page title from <h1 id="title-text"> or <title> or first <h1>
  let rawTitle = "";
  const titleTextMatch = work.match(/<h1[^>]*id=["']title-text["'][^>]*>([\s\S]*?)<\/h1>/i);
  const headTitleMatch = work.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const firstH1Match = work.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

  if (titleTextMatch) {
    rawTitle = stripTagsToInlineMarkdown(titleTextMatch[1]).trim();
  } else if (headTitleMatch) {
    rawTitle = stripTagsToInlineMarkdown(headTitleMatch[1]).trim();
    // Strip Confluence "Space Name : Page Title" prefix
    if (rawTitle.includes(" : ")) {
      rawTitle = rawTitle.split(" : ").slice(1).join(" : ").trim();
    }
  } else if (firstH1Match) {
    rawTitle = stripTagsToInlineMarkdown(firstH1Match[1]).trim();
  }

  const pageTitle = rawTitle || fallbackTitle;

  // Remove <head>, <script>, <style>, breadcrumbs & Confluence footer chrome
  work = work.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "");
  work = work.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  work = work.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  work = work.replace(/<div[^>]*id=["'](?:breadcrumb-section|footer)["'][^>]*>[\s\S]*?<\/div>/gi, "");

  // Protect code blocks via placeholders so inner HTML/newlines remain untouched
  const codePlaceholders: string[] = [];
  const stashCodeBlock = (lang: string, rawCode: string): string => {
    const decoded = decodeHtmlEntities(rawCode.replace(/<[^>]+>/g, "")).replace(/^\n+|\n+$/g, "");
    const idx = codePlaceholders.length;
    codePlaceholders.push(`\n\n\`\`\`${lang}\n${decoded}\n\`\`\`\n\n`);
    return `@@MDTEAM_CODE_BLOCK_${idx}@@`;
  };

  // Confluence storage-format <ac:structured-macro ac:name="code">
  work = work.replace(
    /<ac:structured-macro[^>]*ac:name=["']code["'][^>]*>([\s\S]*?)<\/ac:structured-macro>/gi,
    (_m, inner) => {
      const langMatch = inner.match(/<ac:parameter[^>]*ac:name=["']language["'][^>]*>([\s\S]*?)<\/ac:parameter>/i);
      const bodyMatch = inner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
      const lang = langMatch ? langMatch[1].trim() : "";
      const code = bodyMatch ? bodyMatch[1] : inner;
      return stashCodeBlock(lang, code);
    }
  );

  // Standard <pre><code class="language-...">...</code></pre> or <pre ...>...</pre>
  work = work.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (_m, preAttrs, inner) => {
    const codeLangMatch =
      String(inner).match(/class=["'][^"']*language-([a-zA-Z0-9_+-]+)/i) ||
      String(preAttrs).match(/brush:\s*([a-zA-Z0-9_+-]+)/i);
    const lang = codeLangMatch ? codeLangMatch[1] : "";
    return stashCodeBlock(lang, inner);
  });

  // Confluence Storage Format info/warning/note/tip macros
  work = work.replace(
    /<ac:structured-macro[^>]*ac:name=["'](info|warning|note|tip)["'][^>]*>([\s\S]*?)<\/ac:structured-macro>/gi,
    (_m, macroType, inner) => {
      const label = String(macroType).charAt(0).toUpperCase() + String(macroType).slice(1).toLowerCase();
      const bodyText = stripTagsToInlineMarkdown(inner).trim();
      return `\n\n> **${label}:** ${bodyText}\n\n`;
    }
  );

  // Confluence HTML export info/warning/note/tip macro divs
  work = work.replace(
    /<div[^>]*class=["'][^"']*confluence-information-macro-(information|warning|note|tip)[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>)?/gi,
    (_m, kind, inner) => {
      const labelMap: Record<string, string> = {
        information: "Info",
        warning: "Warning",
        note: "Note",
        tip: "Tip",
      };
      const label = labelMap[String(kind).toLowerCase()] || "Note";
      const cleanText = stripTagsToInlineMarkdown(inner).trim();
      return `\n\n> **${label}:** ${cleanText}\n\n`;
    }
  );

  // Tables
  work = work.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_m, inner) => {
    return convertHtmlTableToMarkdown(`<table>${inner}</table>`);
  });

  // Blockquotes
  work = work.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner) => {
    const text = stripTagsToInlineMarkdown(inner).trim();
    if (!text) return "";
    return `\n\n${text
      .split("\n")
      .map((l) => `> ${l.trim()}`)
      .join("\n")}\n\n`;
  });

  // Lists (<ul> and <ol>, including Confluence inline-task-list)
  work = work.replace(/<(ul|ol)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (_m, tag, attrs, inner) => {
    const isOrdered = String(tag).toLowerCase() === "ol";
    const isTaskList = /inline-task-list/i.test(String(attrs));
    const items = Array.from(String(inner).matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi));
    const lines = items.map((itemMatch, idx) => {
      const liAttrs = itemMatch[1] || "";
      const liBody = stripTagsToInlineMarkdown(itemMatch[2]).trim();
      const hasTaskAttr = isTaskList || /data-inline-task-id/i.test(liAttrs);
      if (hasTaskAttr) {
        const isChecked = /\bchecked\b/i.test(liAttrs);
        return `- [${isChecked ? "x" : " "}] ${liBody}`;
      }
      return isOrdered ? `${idx + 1}. ${liBody}` : `- ${liBody}`;
    });
    return `\n\n${lines.join("\n")}\n\n`;
  });

  // Headings h1..h6
  work = work.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, inner) => {
    const headingText = stripTagsToInlineMarkdown(inner).trim();
    if (!headingText) return "";
    return `\n\n${"#".repeat(Number(level))} ${headingText}\n\n`;
  });

  // Horizontal rules
  work = work.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

  // Paragraphs & divs
  work = work.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_m, inner) => {
    const txt = stripTagsToInlineMarkdown(inner).trim();
    return txt ? `\n\n${txt}\n\n` : "\n";
  });
  work = work.replace(/<\/div>/gi, "\n");

  // Remaining inline markup & tags
  work = stripTagsToInlineMarkdown(work);

  // Restore stashed code blocks
  work = work.replace(/@@MDTEAM_CODE_BLOCK_(\d+)@@/g, (_m, idxStr) => {
    return codePlaceholders[Number(idxStr)] || "";
  });

  // Clean whitespace and ensure single `# Title` header at top
  let markdown = work
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const escapedTitleRegex = new RegExp(
    `^#\\s+${pageTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:\\n+|$)`,
    "i"
  );
  if (!escapedTitleRegex.test(markdown)) {
    markdown = `# ${pageTitle}\n\n${markdown}`.trim();
  }

  return { title: pageTitle, markdown };
}

function normalizeConfluenceMarkdownInput(
  rawMd: string,
  fallbackTitle: string
): { title: string; body: string } {
  let content = rawMd.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  let extractedTitle = "";

  // Strip existing YAML frontmatter if present, capturing title if available
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n*/);
  if (fmMatch) {
    const titleLine = fmMatch[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
    if (titleLine) extractedTitle = titleLine[1].trim();
    content = content.slice(fmMatch[0].length).trim();
  }

  // Convert Confluence wiki macro shortcodes ({info}, {warning}, {note}, {code}) if present
  content = content.replace(
    /\{(info|warning|note|tip)\}([\s\S]*?)\{\1\}/gi,
    (_m, kind, inner) => {
      const label = String(kind).charAt(0).toUpperCase() + String(kind).slice(1).toLowerCase();
      const text = String(inner).trim().replace(/\n+/g, " ");
      return `> **${label}:** ${text}`;
    }
  );
  content = convertJiraWikiToMarkdown(content);

  if (!extractedTitle) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      extractedTitle = h1Match[1].trim();
    }
  }

  const finalTitle = extractedTitle || fallbackTitle;
  if (!/^#\s+/m.test(content)) {
    content = `# ${finalTitle}\n\n${content}`.trim();
  }

  return { title: finalTitle, body: content };
}

export function importConfluencePages(
  filesInput: { name: string; content: string }[]
): WorkspaceFile[] {
  const usedSlugs = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  const results: WorkspaceFile[] = [];

  for (const input of filesInput) {
    if (!input || !input.content.trim()) continue;

    const baseFileName = (input.name || "confluence-page")
      .replace(/^.*[\\/]/, "")
      .replace(/\.(html?|xhtml|md|markdown)$/i, "");
    const fallbackTitle =
      baseFileName
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim() || "Confluence Page";

    const isHtml =
      /\.(html?|xhtml)$/i.test(input.name) ||
      /<(?:!DOCTYPE|html|body|div|h1|table|ac:structured-macro)\b/i.test(input.content);

    const { title, markdown } = isHtml
      ? convertConfluenceHtmlToMarkdown(input.content, fallbackTitle)
      : (() => {
          const res = normalizeConfluenceMarkdownInput(input.content, fallbackTitle);
          return { title: res.title, markdown: res.body };
        })();

    const baseSlug = slugifyText(title || baseFileName, 56);
    let slug = baseSlug;
    let counter = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${counter++}`;
    }
    usedSlugs.add(slug);

    const fileContent = [
      "---",
      `title: "${escapeYamlDoubleQuoted(title)}"`,
      `review_status: "approved"`,
      `updated_at: "${today}"`,
      "---",
      "",
      markdown,
      "",
    ].join("\n");

    results.push({
      path: `wiki/${slug}.md`,
      name: `${slug}.md`,
      category: "wiki",
      content: fileContent,
    });
  }

  return results;
}

// ============================================================================
// Preview Metadata Extractor for Import Wizard Table
// ============================================================================

export function extractImportedFilePreview(file: WorkspaceFile): ImportedFilePreview {
  const fmMatch = file.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const meta: Record<string, string> = {};
  if (fmMatch) {
    for (const line of fmMatch[1].split(/\r?\n/)) {
      const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
      if (kv) {
        meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }

  const isIssue = file.path.startsWith("issues/");
  return {
    file,
    kind: isIssue ? "issue" : "wiki",
    id: meta.id || file.name.replace(/\.md$/i, ""),
    type: meta.type || (isIssue ? "task" : "page"),
    title: meta.title || file.name,
    status: meta.status || meta.review_status || "approved",
    priority: meta.priority || "-",
    storyPoints: Number(meta.story_points) || 0,
    sprint: meta.sprint || "-",
    assignee: meta.assignee || "-",
  };
}
