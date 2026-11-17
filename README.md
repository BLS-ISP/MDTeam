# MDTeam Workspace

A collaborative, **Git-native Jira + Confluence + arc42 Desktop & Multi-User Web Platform** built for engineering teams, Scrum Masters, Product Owners, and non-technical Stakeholders.

Built as both a native desktop application (**Tauri v2 / Rust**) and a self-hosted multi-user web platform (**Next.js 16 + Zero-Dependency Node 20 Git-Bridge API**), MDTeam Workspace stores every ticket, sprint, release, Confluence knowledge page, Architecture Decision Record (ADR), and arc42 chapter as human-readable Markdown + YAML files directly inside your Git repository—zero external relational database required.

---

## 🌟 Key Features

### 1. Multi-User Backend API, Enterprise SSO & Scrum RBAC (`server/`)
*   **Zero-Dependency Node 20 Git-Bridge (`server/src/`):** Multi-project Git repository engine (`${DATA_DIR}/repos/<projectId>`) committing every Markdown & binary asset mutation with authenticated user `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` attribution and strict path/flag sanitization (`execFile("git", ...)`).
*   **Local & Enterprise OIDC SSO Authentication (`AuthLoginModal`):**
    *   Local accounts hashed with `crypto.scrypt` + random 16-byte salt + `timingSafeEqual` and signed `HttpOnly; SameSite=Lax` HMAC-SHA256 JWT session cookies.
    *   Built-in OAuth2 / OIDC PKCE + signed CSRF `state` flow for **Keycloak**, **Microsoft Entra ID**, **GitHub**, and **GitLab**.
*   **Role-Based Access Control (`TeamAndWebhookAdminModal`):**
    *   Five first-class Scrum roles: `admin`, `product-owner`, `scrum-master`, `developer`, and `stakeholder`.
    *   **Stakeholder Read-Only Enforcement:** Stakeholders are strictly blocked (`403`) from mutating wiki pages, tickets, sprints, or backlog priority while permitted to post inline review comments and feedback (`.mdteam/inline-comments.json`).
    *   **Product Owner Authority:** Enforces PO/Admin accountability on Product Backlog ordering, Product Goal updates, and Sprint Review acceptance.
*   **Outgoing Team Webhooks:** Dispatches **Microsoft Teams Adaptive Cards v1.4**, **Slack Block Kit**, and generic JSON/Email notifications on blockers, `@mentions`, ticket assignments, reviews, and sprint transitions.

### 2. Scrum Guide Policy Engine & 4 Guided Ceremonies (`src/utils/scrum-rules/`, `ceremonies/`)
*   **Configurable Process Modes (`.mdteam/scrum-policy.md`):** Switch per project between **Strict Scrum**, **Pragmatic Scrum** (allows justified overrides logged as `[SCRUM-OVERRIDE: <RULE>]` comments), and **Kanban Flow**.
*   **Automated Scrum Quality Gates (`ScrumGateModal`):**
    *   **Definition of Ready (DoR):** Validates Story Points (`> 0`), Acceptance Criteria, Assignee, Description, and open `blocked_by` dependencies before pulling into a Sprint.
    *   **Definition of Done (DoD):** Blocks moving to `Done` when any Acceptance Criterion or **Subtask** is unchecked or blockers remain open.
    *   **0-SP-for-Undone Velocity Rule:** On Sprint Completion, only 100% DoD-compliant `Done` items contribute to velocity (`computeStrictSprintVelocity`); unfinished work contributes `0 SP` and rolls over cleanly.
*   **4 Interactive Ceremony Wizards (`ScrumPolicyAndGoalBar`):**
    *   **Sprint Planning Wizard:** 3-step capacity check, Sprint Goal commitment, and DoR-checked backlog pull.
    *   **Daily Scrum Board-Walk:** 15:00 timebox timer walking Right-to-Left (`Review → In Progress → Ready`), quick blocker flagging, and Parking Lot notes.
    *   **Sprint Review Modal:** Live Velocity breakdown, PO 1-click `Accept / Return to In Progress`, and Stakeholder feedback capture into new backlog tickets.
    *   **Sprint Retrospective Wizard:** Glad / Sad / Impediments sticky board with dot-voting, `[SCRUM-OVERRIDE]` audit review, and mandatory Sprint Improvement Action Ticket creation.

### 3. Deep Jira Mechanics: Subtasks, Releases, Attachments & Hours (`src/utils/issues/`)
*   **Subtasks & Time Tracking:** Inline `## Subtasks` checklists (`- [x] SUB-1: Title | @dev | est:4h | rem:0h`) and YAML time fields (`estimated_hours`, `logged_hours`, `remaining_hours`) with `+1h / +2h / +4h` quick work-log buttons.
*   **Versioned Ticket Attachments:** Drag-and-drop screenshots & files onto any issue—stored under `assets/issues/<ID>/<filename>` (Tauri FS / Server Git-Bridge) with image lightbox previews.
*   **Release Management & 1-Click Release Notes (`ReleasesTab`):** Manage `.mdteam/releases.md` (`planned | unreleased | released`), filter board via `fixversion:v1.0.0`, track release progress bars, and generate Confluence Release Notes (`wiki/releases/<version>.md`) with live ```` ```query ```` blocks in one click.
*   **Kanban, Gantt, Planning Poker & Dual Burndown:** 5-column Kanban board with WIP limits & swimlanes, SVG Gantt dependency roadmap, Yjs Planning Poker, and **Story Points (`SP`) / Remaining Hours (`h`)** Burndown & Burnup charts.

### 4. Confluence-Grade Nested Wiki, WYSIWYG Blocks & Approval Lock (`src/utils/wiki/`)
*   **Arbitrary-Depth Page Tree & Link-Safe Refactoring (`ExplorerPanel`):** Unlimited nested page hierarchy (`wiki/architecture/security/oidc.md`) with drag-and-drop move/rename that automatically rewrites `[label](path#anchor)` links and `@[path#L1-L10]` transclusions across the entire workspace.
*   **Write-Protection Governance (`ApprovalLockBanner`):** Approved Wiki pages (`review_status: approved`) and Accepted ADRs (`## Status: Accepted`) automatically lock Monaco (`readOnly: true`), toolbar actions, and visual forms—offering 1-click **"Unlock as New Revision (In Review)"** (`revision` bump) or **"Supersede with New ADR"** (`ADR-000X`).
*   **Visual Table & Callout WYSIWYG (`GenericBlockEditor`):** Interactive Markdown table row/column/alignment editor, GitHub/Confluence Callout cards (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`), Live Query Macros, Inline Comments, Git Time Machine, and zero-dependency `.docx` export.

### 5. Guided 3-Way Git Merge Conflict Resolver (`GitConflictResolverModal`)
*   Detects Git merge conflicts across **Tauri Desktop** (`git status --porcelain`, `:1:path` base, `:2:path` ours, `:3:path` theirs), **Multi-User Server Mode** (`/api/projects/:id/git/conflicts`), and in-memory conflict markers (`<<<<<<<` / `|||||||` / `=======` / `>>>>>>>`).
*   Provides status bar & Git panel conflict alerts, 1-click **Keep Ours / Keep Theirs / Keep Both** hunk resolution, side-by-side Monaco `DiffEditor`, and zero-marker validation before staging & committing.

---

## 📂 Folder Structure

Every source and test file across `src/`, `server/src/`, `src-tauri/src/`, and `tests/` enforces a strict `<= 500` lines modularity gate (`scripts/check-file-sizes.mjs`):

```text
MDTeam/
├── issues/                     # Git-native Jira tickets (MDT-*.md)
├── sprints/                    # Active & planned Scrum sprints (sprint-*.md)
├── server/                     # Zero-dependency Node 20 Multi-User API & Git-Bridge
│   ├── src/
│   │   ├── auth/               # scrypt user store, HMAC-SHA256 JWT cookies & OIDC PKCE
│   │   ├── git/                # Sanitized execFile("git") bridge, sync & 3-stage conflicts
│   │   ├── notifications/      # MS Teams Adaptive Cards, Slack Block Kit & Email webhooks
│   │   ├── routes/             # Multi-project REST file/asset/git endpoints
│   │   └── index.ts            # HTTP server entrypoint (port 4000)
│   └── tsconfig.json
├── src/
│   ├── app/                    # Next.js 16 App Router shell (output: "export")
│   ├── components/
│   │   ├── auth/               # AuthLoginModal & TeamAndWebhookAdminModal
│   │   ├── editor/             # Split Monaco/Preview, ApprovalLockBanner & visual-editors/
│   │   ├── layout/             # AppTopBar, ActivityStrip, AppStatusBar & ModalsHost
│   │   ├── modals/             # Command Palette, Atlassian Importer & GitConflictResolverModal
│   │   ├── panels/             # Nested Explorer tree, GitPanel, PM Dashboard & Settings
│   │   ├── scrum/              # Kanban, Backlog, Releases, Gantt, Metrics & ceremonies/
│   │   └── wiki/               # PageGovernanceBar, ApprovalLockBanner, LiveQuery & Comments
│   ├── context/                # WorkspaceContext provider
│   ├── hooks/                  # Server sync/RBAC bridge, Tauri FS/Git, Yjs & DOCX export
│   ├── types/                  # Agile, Auth/RBAC, ScrumPolicy & Workspace interfaces
│   └── utils/                  # Scrum policy engine, issue/release/wiki/conflict/DOCX engines
├── src-tauri/                  # Tauri v2 Rust desktop backend & sanitized Git conflict commands
├── tests/                      # Automated unit & live multi-user server E2E test suites
├── scripts/check-file-sizes.mjs
├── docker-compose.yml          # Full-stack Nginx + Web + Node API + Yjs deployment
└── package.json
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development
*   **Web Frontend (`http://localhost:3000`):**
    ```bash
    npm run dev
    ```
*   **Multi-User Backend API (`http://localhost:4000`):**
    ```bash
    npx tsc -p server/tsconfig.json && node server/dist/index.js
    ```
    *(Localhost seeds demo accounts `admin`, `po`, `sm`, `dev-a`, `dev-b`, and `stakeholder` — set `MDTEAM_INITIAL_PASSWORD` and `JWT_SECRET` in production.)*
*   **Native Desktop App (Tauri v2):**
    ```bash
    npx tauri dev
    ```
*   **Docker Compose (Nginx + Static Web + Multi-User API + Yjs WebSocket):**
    ```bash
    docker compose up -d --build
    ```

### 3. Automated Quality Gates, Tests & Production Builds
```bash
# 1. Enforce <= 500 lines modularity rule across src/, server/src/, src-tauri/src/, tests/
node scripts/check-file-sizes.mjs

# 2. Typecheck Frontend & Multi-User Server Backend
npx tsc --noEmit
npx tsc -p server/tsconfig.json

# 3. Run Unit & Live Server E2E Test Suite (Scrum rules, Jira/Releases, Wiki/Conflicts, Auth/RBAC/Git)
npm test

# 4. Run Rust Unit Tests & Build Production Artifacts
cargo test --lib --manifest-path src-tauri/Cargo.toml
npm run build
npx tauri build --no-bundle
```

---

## 📄 License
Licensed for internal team and enterprise use.
