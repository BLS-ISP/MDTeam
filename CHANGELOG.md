# Changelog

All notable changes to **MDTeam Workspace** are documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-17

### Added
- **Multi-User Backend API & Git-Bridge (`server/`):** Self-hosted Node 20 API server committing browser-authored Markdown & binary assets directly to Git with authenticated user author attribution (`GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL`).
- **Enterprise SSO & Local Team Authentication:** Built-in `scrypt` local accounts plus OAuth2 / OIDC PKCE login for **Keycloak**, **Microsoft Entra ID**, **GitHub**, and **GitLab**.
- **Enforced Scrum Role Permissions (RBAC):** Dedicated permissions for `product-owner`, `scrum-master`, `developer`, `stakeholder` (strict Read-Only with comment/review feedback access), and `admin`.
- **Configurable Scrum Rules Engine:** Per-project process modes (**Strict Scrum Guide**, **Pragmatic Scrum with audited `[SCRUM-OVERRIDE]` justifications**, and **Kanban Flow**) enforcing Product Goal, Sprint Goal, DoR/DoD gates, and the **0-Story-Points-for-Undone-Work** velocity rule.
- **4 Guided Scrum Ceremony Modes:** Interactive workflows for **3-Step Sprint Planning**, **Daily Scrum ("Walk the Board" with 15:00 timer)**, **Sprint Review (PO Accept/Reject + Stakeholder Feedback)**, and **Sprint Retrospective (Dot-Voting + mandatory Sprint Action Item)**.
- **Jira-Grade Issue Mechanics:** Conflict-free atomic ticket files (`issues/MDT-*.md`), Drag-&-Drop Kanban with WIP limits & Swimlanes, JQL-Lite search, **Subtasks**, versioned **Ticket Attachments** (`assets/issues/*`), **Release (`FixVersion`) Management** with 1-Click Wiki Release Notes, **Yjs Planning Poker**, and dual **Story Point / Remaining Hours** Burndown & Burnup charts.
- **Confluence-Grade Knowledge Base:** Arbitrary-depth nested page tree with automatic workspace-wide link & `@[...]` transclusion refactoring on rename/move, **Visual WYSIWYG Table & Callout Editor**, **Live Query Macros (` ```query `)**, Inline Review Comments, Git Time-Machine history, **Approval Write-Lock** for `Approved` pages & `Accepted` ADRs, and native **Word (`.docx`)** & **PDF Book** export.
- **Atlassian Migration, 3-Way Conflict Resolver & Webhooks:** 1-click **Jira (CSV/JSON ADF)** & **Confluence (HTML/Markdown)** importer, guided 3-way Git conflict resolution modal, `Ctrl+K` Command Palette, and outgoing **MS Teams Adaptive Cards**, **Slack Block Kit**, and **Email/JSON Webhooks**.

### Changed
- **Modular Domain Architecture:** Refactored all frontend, server, Rust, stylesheet, and test modules into 219 focused files enforcing a strict `<= 500` lines modularity gate in CI.

### Security
- **Cryptographic & Git Hardening:** Password hashing via `crypto.scrypt` with 16-byte random salts and `timingSafeEqual`, `HttpOnly; SameSite=Lax` HMAC-SHA256 JWT cookies, OIDC PKCE + signed CSRF `state`, and strict argument/path sanitization (`execFile("git", ...)`) blocking flag injection and directory traversal in both Node and Rust backends.
