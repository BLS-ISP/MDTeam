# MDTeam Workspace — User & Administrator Guide

This guide explains how to deploy, configure, and run **MDTeam Workspace** in day-to-day product engineering—replacing **Jira**, **Confluence**, and disconnected Scrum boards with a single Git-native platform.

---

## 1. Deployment Modes: Choosing Your Setup

MDTeam supports two fully compatible operating modes that work on the **same Git repository structure**:

1. **Multi-User Docker Server Mode (Recommended for Cross-Functional Teams):**
   * Product Owners, Scrum Masters, Developers, and Stakeholders access MDTeam directly in their web browser (`http://<your-host>`).
   * The `api-server` container authenticates users (Local or SSO), enforces Scrum role permissions, writes Markdown & binary `assets/` into `/data/repos/<projectId>`, commits changes with the logged-in user's real Git author (`Display Name <email>`), and synchronizes with your remote GitHub/GitLab repository.
2. **Native Tauri Desktop Mode (Ideal for Developers & Offline Work):**
   * Developers open local Git clones via **Open Local Folder** in the Explorer sidebar (with a quick switcher for the 5 most recent projects).
   * Changes auto-save to disk, pull/commit/push via native Git, and optionally connect to the shared Yjs WebSocket server (`ws://<your-host>:1234`) for live multi-cursor editing and Planning Poker.

---

## 2. Authentication, Roles & Enterprise SSO Setup

### 2.1 Seeded Accounts & Production Security
On first boot, `api-server` initializes `/data/users.json` with starter accounts for every Scrum role (`admin`, `po`, `sm`, `dev-a`, `dev-b`, `stakeholder`) using the password in `MDTEAM_INITIAL_PASSWORD`.

**Production Checklist:**
* Set a strong random `JWT_SECRET` (32+ bytes) and `MDTEAM_INITIAL_PASSWORD` in `docker-compose.yml`.
* Set `MDTEAM_COOKIE_SECURE=true` when serving behind an HTTPS reverse proxy / Ingress.
* Sign in as `admin`, open **Team & Webhook Admin** in the top bar, rotate default passwords, and create accounts for your team.

### 2.2 Configuring Keycloak, Microsoft Entra ID, GitHub, or GitLab SSO
1. Sign in as `admin` and open **Team & Webhook Admin → OIDC / Enterprise SSO**.
2. Select your provider preset:
   * **Keycloak:** Set *Issuer URL* to `https://keycloak.example.com/realms/<realm>` (auto-discovers `.well-known/openid-configuration`).
   * **Microsoft Entra ID:** Set *Issuer URL* to `https://login.microsoftonline.com/<tenant-id>/v2.0`.
   * **GitHub / GitLab:** Select the preset (and self-hosted GitLab base URL if applicable).
3. Enter your **Client ID**, **Client Secret**, and register the callback URL in your Identity Provider:
   ```text
   https://<your-mdteam-domain>/api/auth/oidc/callback
   ```
4. Choose the **Default Role for New SSO Users** (e.g., `stakeholder` for safe read-only onboarding, promoting engineers to `developer` as needed) and save.

---

## 3. Running Classic Scrum in MDTeam

### 3.1 Choosing Your Project's Scrum Enforcement Mode
In the **Scrum Workspace** top banner (`ScrumPolicyAndGoalBar`), the Scrum Master or Admin can switch the project's policy stored in `.mdteam/scrum-policy.md`:

* **Strict Scrum Guide (`strict`):**
  * Requires a defined **Product Goal** and a binding **Sprint Goal** (min. 10 characters) before starting a Sprint.
  * Only the **Product Owner** (or Admin) can reorder the Product Backlog.
  * **Hard DoR Gate:** Blocks pulling a ticket into a Sprint if Story Points are `0`, Acceptance Criteria are missing, or open `blocked_by` tickets exist.
  * **Hard DoD Gate:** Blocks moving a ticket to `Done` until **100% of Acceptance Criteria and Subtasks** are checked and blockers are cleared.
  * **0-SP Velocity Rule:** Partially completed stories at Sprint close contribute **0 Story Points** to historical velocity and roll over cleanly.
* **Pragmatic Scrum (`pragmatic`):**
  * Checks every rule above, but offers an **Override with Reason** option. Submitting an override records `[SCRUM-OVERRIDE: <RULE_CODE>] <reason>` in the ticket's comment log so the team can inspect process friction during the Sprint Retrospective.
* **Kanban Flow (`kanban`):**
  * Disables Sprint ceremony gates for continuous delivery teams while keeping column **WIP Limits**, Swimlanes, and Cycle Time metrics active.

### 3.2 Executing the 4 Guided Scrum Ceremonies
Launch each ceremony directly from the Scrum Policy bar:
1. **Sprint Planning (3-Step Wizard):**
   * *Step 1 (Why):* Review the overarching Product Goal, inspect available Team Capacity (`management/capacity.md`) vs. historical Velocity, and write the Sprint Goal.
   * *Step 2 (What):* Pull DoR-ready Backlog items into the Sprint while watching the live capacity load bar (use **Planning Poker** for unestimated items).
   * *Step 3 (How):* Break selected User Stories down into technical **Subtasks** and optional **Estimated / Remaining Hours**, then start the Sprint.
2. **Daily Scrum ("Walk the Board"):**
   * Starts a **15:00 countdown timer** (turning amber at 3:00 and red at 1:00) and walks active Sprint cards **Right-to-Left** (`In Review → In Progress → Ready`) to prioritize finishing work in flight. Flag blockers in one click or park deep-dive topics in the *Parking Lot*.
3. **Sprint Review:**
   * Inspects `Done` stories against the Sprint Goal. The **Product Owner** marks each story **Accepted** or returns it to `In Progress` with feedback notes, and captures Stakeholder feature ideas straight into the Product Backlog.
4. **Sprint Retrospective:**
   * Collect **Glad**, **Sad**, and **Impediment** notes, run team **Dot-Voting**, inspect any `[SCRUM-OVERRIDE]` exceptions from the sprint, and create at least **one concrete Action Item ticket** (`retro-action`) directly into the next Sprint Backlog.

---

## 4. Confluence Wiki, WYSIWYG Editing & Governance

### 4.1 Nested Pages & Refactor-Safe Renaming
* In the **Explorer** sidebar, hover any folder or page to create nested subpages (`+`) or **Rename / Move** a document.
* Moving or renaming a page automatically scans the entire workspace and updates all Markdown links `[text](path#section)` and transclusions `@[path#L1-L20]`—preventing broken wiki links.

### 4.2 Visual WYSIWYG Mode & Stakeholder Clean Mode
* Switch any Markdown document from **Code** to **Visual** in the top-right editor bar to edit **Tables** (insert/delete rows & columns, align cells), **Callout Boxes** (`Info`, `Tip`, `Important`, `Warning`, `Caution`), checklists, and `@Page / @Ticket` links without Markdown syntax.
* Switching the header mode to **Stakeholder** hides all developer IDE chrome (Monaco raw code, Git staging, Linter panel) for a pure Confluence/Jira reader experience.

### 4.3 Approval Lock & ADR Lifecycle
* Set a page's status in the **Page Governance Bar** from `Draft` → `In Review` → `Approved`.
* Once `Approved` (or once an ADR's status is `Accepted`), MDTeam **write-locks** the file. To make further changes, click **Unlock as New Revision (`In Review`)** (which increments the frontmatter `revision` counter) or **Supersede with New ADR** (which generates a linked `ADR-000X` and marks the old ADR superseded).

---

## 5. Outgoing Webhooks, Migration & Conflict Resolution

* **MS Teams, Slack & Email Webhooks:** Open **Team & Webhook Admin → Outgoing Webhooks**, paste your Microsoft Teams Incoming Webhook URL (sends **Adaptive Cards v1.4**), Slack Webhook URL (sends **Block Kit** messages), or generic JSON/Email endpoint, select event triggers (`mention`, `blocker`, `assignment`, `review`, `sprint`), and click **Send Test Notification**.
* **Importing from Jira & Confluence:** Press `Ctrl+K` → **Import from Jira / Confluence** (or click the import icon in the header), upload a **Jira CSV**, **Jira REST JSON**, or **Confluence HTML/Markdown** export, preview the mapped tickets/pages, and import in one click.
* **Resolving Git Sync Conflicts:** Whenever parallel edits collide during a Git pull/sync, a warning badge appears in the Status Bar and Git Panel. Click it to open the **Guided Conflict Resolver**, where you can resolve each file via **Keep My Changes**, **Accept Team Version**, **Keep Both**, or the visual side-by-side Merge Editor.
