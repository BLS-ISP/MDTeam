import type { WorkspaceFile } from "../../utils/issueEngine";

export const SEED_ISSUES_AND_WIKI: WorkspaceFile[] = [
  {
    path: "issues/MDT-101.md",
    name: "MDT-101.md",
    category: "issues",
    content: `---
id: "MDT-101"
type: "epic"
title: "Enterprise Security, SSO & Collaborative Architecture"
status: "in-progress"
priority: "critical"
story_points: 21
sprint: ""
epic: ""
assignee: "@product-owner"
reporter: "@product-owner"
labels: ["architecture", "security", "sso", "q2-roadmap"]
blocked_by: []
branch: "feat/MDT-101-enterprise-security-epic"
start_date: "2026-06-01"
end_date: "2026-06-21"
created_at: "2026-06-01T08:30:00Z"
updated_at: "2026-06-08T16:00:00Z"
---

# MDT-101: Enterprise Security, SSO & Collaborative Architecture

## Description

Deliver the core enterprise security and real-time collaboration foundation for **MDTeam Workspace** as specified in [ADR-0001: Modulare Authentifizierung](adrs/ADR-0001-auth-strategy.md) and [arc42 §2 Randbedingungen](arc42/02_constraints.md).

Key outcomes for this Epic:
- Seamless **Keycloak OIDC / OAuth2** Single Sign-On and **LDAP/AD** role mapping (\`developer\`, \`scrum-master\`, \`stakeholder\`).
- Resilient **Yjs WebSocket** real-time document & Planning Poker synchronization across corporate firewalls.
- Automated **Definition of Done (DoD)** & **Definition of Ready (DoR)** validation across Git-native Scrum tickets.

## Acceptance Criteria

- [x] Architecture strategy documented and accepted in ADR-0001
- [x] Keycloak OIDC PKCE login & token validation shipped (MDT-102)
- [ ] LDAP group-to-role mapping for Stakeholder Clean Mode completed (MDT-103)
- [ ] Yjs WebSocket reconnection race condition resolved under restricted firewall rules (MDT-104)
- [ ] Automated DoD/DoR linter checks integrated with Sprint issues (MDT-105)

## Comments

- **@product-owner** *(2026-06-01 09:00)*: Anchor Epic for our Q2 on-premises enterprise rollout. Target completion by June 21.
- **@scrummaster** *(2026-06-05 11:30)*: MDT-102 is complete (8 SP); tracking firewall blocker on MDT-103 via MDT-104.
`,
  },
  {
    path: "issues/MDT-102.md",
    name: "MDT-102.md",
    category: "issues",
    content: `---
id: "MDT-102"
type: "story"
title: "Implement Keycloak OAuth2 / OIDC Single Sign-On Flow"
status: "done"
priority: "high"
story_points: 8
sprint: "sprint-01"
epic: "MDT-101"
assignee: "@developer-a"
reporter: "@product-owner"
labels: ["auth", "sso", "keycloak"]
blocked_by: []
branch: "feat/MDT-102-oauth-sso"
start_date: "2026-06-01"
end_date: "2026-06-05"
created_at: "2026-06-01T09:00:00Z"
updated_at: "2026-06-05T16:30:00Z"
---

# MDT-102: Implement Keycloak OAuth2 / OIDC Single Sign-On Flow

## Description

As an enterprise developer, I want to authenticate via **Keycloak OpenID Connect (OIDC)** using Authorization Code + PKCE so that my Git commits and Yjs collaborative sessions are tied to my verified corporate identity without managing separate credentials.

See [ADR-0001](adrs/ADR-0001-auth-strategy.md) for the modular authentication gateway design.

## Acceptance Criteria

- [x] Configure OIDC discovery endpoint (\`.well-known/openid-configuration\`) and PKCE challenge
- [x] Validate JWT access & refresh tokens with automatic silent renewal
- [x] Propagate authenticated \`@handle\` into Git commit author metadata and Yjs awareness state
- [x] Verify fallback to local test identities in air-gapped developer mode

## Comments

- **@developer-a** *(2026-06-03 14:20)*: PKCE exchange and token refresh verified against local Keycloak 25 container.
- **@product-owner** *(2026-06-05 16:30)*: Demo approved in Sprint Review preview — marking Done (8 SP).
`,
  },
  {
    path: "issues/MDT-103.md",
    name: "MDT-103.md",
    category: "issues",
    content: `---
id: "MDT-103"
type: "story"
title: "LDAP Directory Role Sync & Stakeholder Clean Mode Mapping"
status: "in-progress"
priority: "high"
story_points: 5
sprint: "sprint-01"
epic: "MDT-101"
assignee: "@developer-a"
reporter: "@scrummaster"
labels: ["auth", "ldap", "rbac", "blocked"]
blocked_by: ["MDT-104"]
branch: "feat/MDT-103-ldap-role-mapping"
start_date: "2026-06-05"
end_date: "2026-06-11"
created_at: "2026-06-01T09:15:00Z"
updated_at: "2026-06-07T11:20:00Z"
---

# MDT-103: LDAP Directory Role Sync & Stakeholder Clean Mode Mapping

## Description

Synchronize Active Directory / LDAP organizational groups (\`CN=Engineering\`, \`CN=ProductManagement\`, \`CN=Stakeholders\`) to MDTeam workspace roles (\`developer\`, \`scrum\`, \`stakeholder\`) so Project Managers and Stakeholders automatically launch in distraction-free Confluence/Jira Clean Mode.

## Acceptance Criteria

- [x] Define role mapping schema for \`developer\`, \`scrum\`, and \`stakeholder\` workspace modes
- [x] Persist active role mode and user handle in client session state
- [ ] Verify live sync of role changes across Yjs collaborative rooms (blocked by MDT-104 reconnect race)
- [ ] Document LDAPS port 636 / 389 firewall requirements in \`arc42/02_constraints.md\`

## Comments

- **@developer-a** *(2026-06-06 10:05)*: Role schema and Stakeholder Clean Mode UI toggle are working locally.
- **@scrummaster** *(2026-06-07 11:20)*: Flagged as blocked by \`MDT-104\` until WebSocket session recovery on network switch is merged.
`,
  },
  {
    path: "issues/MDT-104.md",
    name: "MDT-104.md",
    category: "issues",
    content: `---
id: "MDT-104"
type: "bug"
title: "Fix Yjs WebSocket Reconnection Race Condition & Firewall Timeout"
status: "review"
priority: "critical"
story_points: 3
sprint: "sprint-01"
epic: "MDT-101"
assignee: "@developer-b"
reporter: "@developer-a"
labels: ["bug", "yjs", "sync", "network"]
blocked_by: []
branch: "fix/MDT-104-yjs-reconnect-race"
start_date: "2026-06-04"
end_date: "2026-06-09"
created_at: "2026-06-04T10:00:00Z"
updated_at: "2026-06-08T15:45:00Z"
---

# MDT-104: Fix Yjs WebSocket Reconnection Race Condition & Firewall Timeout

## Description

When a client switches VPN / corporate Wi-Fi or when the Yjs WebSocket server (\`ws://localhost:1234\`) drops idle connections after 60 seconds, \`WebsocketProvider\` occasionally duplicates initial document insertion or stalls in \`connecting\` state without falling back cleanly to offline mode.

*(Added mid-sprint as urgent critical bug fix — +3 SP scope addition to \`sprint-01\`.)*

## Acceptance Criteria

- [x] Guard initial \`ytext.insert\` inside \`provider.on('sync')\` transaction so reconnects never duplicate Markdown content
- [x] Add fast WebSocket reachability probe and clean offline fallback for Planning Poker & Editor rooms
- [x] Cleanly destroy \`MonacoBinding\`, \`WebsocketProvider\`, and \`Y.Doc\` instances on component unmount
- [ ] Final peer code review by \`@developer-a\`

## Comments

- **@developer-a** *(2026-06-04 10:05)*: Reproduced during VPN reconnect while testing OIDC session renewal.
- **@developer-b** *(2026-06-08 15:45)*: Fix pushed to \`fix/MDT-104-yjs-reconnect-race\` with bounded backoff and clean offline fallback. Ready for review!
`,
  },
  {
    path: "issues/MDT-105.md",
    name: "MDT-105.md",
    category: "issues",
    content: `---
id: "MDT-105"
type: "task"
title: "Automate DoD/DoR Linter Validation for Git-Native Sprint Issues"
status: "ready"
priority: "medium"
story_points: 5
sprint: "sprint-01"
epic: "MDT-101"
assignee: "@developer-b"
reporter: "@scrummaster"
labels: ["quality", "linter", "scrum"]
blocked_by: []
branch: ""
start_date: "2026-06-08"
end_date: "2026-06-14"
created_at: "2026-06-01T09:30:00Z"
updated_at: "2026-06-07T09:00:00Z"
---

# MDT-105: Automate DoD/DoR Linter Validation for Git-Native Sprint Issues

## Description

Extend MDTeam's quality governance workflow so Sprint tickets in \`issues/MDT-*.md\` adhere to our [Definition of Ready](management/definition-of-ready.md) and [Definition of Done](management/definition-of-done.md):
- Every issue planned into an active sprint should have a Fibonacci Story Point estimate (\`> 0\`), an \`@assignee\`, and at least one Acceptance Criterion.
- Blocked tickets (\`blocked_by\` non-empty) surface immediately in Agile Metrics and Kanban red alerts.

## Acceptance Criteria

- [x] Define YAML frontmatter schema for \`issues/MDT-*.md\` and \`sprints/sprint-*.md\`
- [ ] Verify unestimated tickets can be estimated directly in Scrum Planning Poker
- [ ] Verify completed Sprint velocity writes back to \`management/capacity.md\`

## Comments

- **@scrummaster** *(2026-06-02 13:10)*: Estimated at 5 SP during Sprint 01 Planning Poker session (full consensus).
`,
  },
  {
    path: "sprints/sprint-01.md",
    name: "sprint-01.md",
    category: "sprints",
    content: `---
id: "sprint-01"
name: "Sprint 01 — Enterprise Auth & Collab Core"
goal: "Deliver Keycloak OIDC Single Sign-On, harden Yjs WebSocket sync reconnection, and ship Git-native Scrum tracking."
state: "active"
start_date: "2026-06-01"
end_date: "2026-06-14"
committed_points: 18
---

# Sprint 01 — Enterprise Auth & Collab Core

## Sprint Goal

Deliver Keycloak OIDC Single Sign-On, harden Yjs WebSocket sync reconnection, and ship Git-native Scrum tracking across \`issues/MDT-*.md\`.

## Planned Scope & Notes

- **Committed Baseline:** 18 SP (\`MDT-102\` 8 SP, \`MDT-103\` 5 SP, \`MDT-105\` 5 SP)
- **Mid-Sprint Scope Addition:** \`MDT-104\` (+3 SP critical Yjs reconnection bug fix added 2026-06-04)
- **Linked Epic:** [MDT-101: Enterprise Security, SSO & Collaborative Architecture](issues/MDT-101.md)
`,
  },
  {
    path: "wiki/confluence-hub.md",
    name: "confluence-hub.md",
    category: "wiki",
    content: `---
title: "Engineering & Product Knowledge Hub"
review_status: "approved"
approved_by: "@product-owner"
updated_at: "2026-06-08"
---

# Engineering & Product Knowledge Hub

Willkommen im **Git-nativen Confluence & Jira Hub** von MDTeam Workspace. Alle Architekturentscheidungen ([ADR-0001](adrs/ADR-0001-auth-strategy.md)), [arc42-Kapitel](arc42/01_introduction_goals.md) und Sprint-Tickets ([Epic MDT-101](issues/MDT-101.md)) leben versioniert im selben Git-Repository.

## Live Sprint 01 Jira Macro

\`\`\`query
FROM issues
WHERE sprint = sprint-01
SORT priority desc
VIEW table
\`\`\`

## Architektur-Entscheidungen (ADRs)

\`\`\`query
FROM adrs
VIEW cards
\`\`\`
`,
  },
];
