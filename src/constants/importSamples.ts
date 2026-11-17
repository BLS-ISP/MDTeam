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
