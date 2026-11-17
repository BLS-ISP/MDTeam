# Changelog

All notable changes to **MDTeam Workspace** are documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/).

## [1.3.0] - 2026-11-17

### Added
- **Per-Project FIFO Re-Entrant Git Mutex (`server/src/git/gitMutex.ts`):** Serializes concurrent Git mutations per normalized `projectId` in strict FIFO order while `AsyncLocalStorage` guarantees deadlock-free re-entrancy across nested repository calls (`ensureProjectRepository`, `commitWorkingProjectChanges` -> `syncProjectGitRemote`, `cloneRemoteProjectRepository` -> `listProjectFilesAndAssets`).
- **1-Click Pre-Clone SSH Deploy Key Generation & Safe Code Endpoint (`server/src/git/`, `src/components/git/`):** Added `POST /api/projects/git/ssh-key-preview`, pre-clone `sshPrivateKey` support in `POST /api/projects/git/test`, and `sshPublicKey` persistence in `POST /api/projects/clone` so teams can generate and test Ed25519 SSH Deploy Keys before cloning, alongside `GET /api/projects/:id/code` for safe read-only code inspection (`<= 512 KB`, whitelisted text extensions, `.env*`/secret/key/symlink blocking).
- **Server HEAD Diff & Shared Branch Guidance (`src/components/layout/WorkspaceModalsHost.tsx`, `src/components/modals/GitBranchModal.tsx`):** `DiffViewer` in online server mode now loads committed `HEAD` file contents via `/git/file-at-commit`, and `GitBranchModal` surfaces an informational notice when switching branches on shared team projects.

### Changed
- **Draft Auto-Save Without Commit Spam (`server/src/git/serverGitBridge.ts`, `src/hooks/useWorkspaceServerBridge.ts`):** `PUT/POST /api/projects/:id/files` now supports `autoCommit: false` so debounced editor auto-saves persist working-tree drafts to disk (`{ committed: false, commitSha }`) without creating intermediate Git commits on every keystroke pause.
- **Collision-Free Yjs Room Isolation & Real Awareness (`src/hooks/useYjsCollaboration.ts`, `src/context/WorkspaceContext.tsx`):** Upgraded Yjs room naming to injective `buildYjsRoomName(projectId, branch, filePath)` isolation, replaced simulated collaborator cursors with live `provider.awareness` peer state, gated WebSocket connections behind `canConnectWs`, and enforced `readOnly` collaboration for `stakeholder` accounts.

### Security
- **Markdown Stored-XSS, Mermaid & Draw.io Embed Hardening (`src/utils/workspace/markdownSecurity.ts`, `markdownInlineAndMermaid.tsx`, `markdownRenderer.tsx`):** Escapes HTML entities prior to inline Markdown formatting, enforces Mermaid `securityLevel: "strict"`, blocks `javascript:`, `vbscript:`, `file:`, percent-encoded scheme bypasses, `data:text/html`, and `data:image/svg+xml` URLs, and restricts both inline and fenced `drawio` iframes to official HTTPS `diagrams.net`/`draw.io` hosts with `sandbox="allow-scripts allow-same-origin"` and `referrerPolicy="no-referrer"`.
- **CORS Allowlist, Sliding-Window Login Rate Limiter & WebSocket Auth Gate (`server/src/httpHelpers.ts`, `loginRateLimiter.ts`, `index.ts`, `nginx.conf`):** Prevents arbitrary `Origin` or `*` reflection with `Access-Control-Allow-Credentials: true` (permitting only explicit `MDTEAM_CORS_ORIGINS`, same-origin `Host`, or non-production localhost), enforces a 15-minute sliding-window login rate limiter (`10` failures per IP+user, `30` per IP with trusted-proxy hop parsing and `429 Retry-After`), and gates Nginx `/ws` upgrades via `auth_request /_auth_ws` (`GET /api/auth/ws-verify`).
- **DNS-Rebinding SSRF Guards, Cookie-First Session Hygiene & CSPRNG NS8 Provisioning (`ssrfDnsGuard.ts`, `webhookDispatcher.ts`, `gitSanitizer.ts`, `useServerBackend.ts`, `ns8/`):** Resolves and validates `dns.promises.lookup(host, { all: true })` addresses on outgoing webhooks (`redirect: "error"`) and Git remotes to block loopback, `0.0.0.0/8`, link-local metadata (`169.254.0.0/16`, `fe80::/10`), `accountprovider`, and IPv4-mapped IPv6 rebinding while preserving RFC1918 LAN support; eliminates `localStorage` JWT storage on same-origin `HttpOnly` cookie deployments; and provisions NS8 `MDTEAM_INITIAL_PASSWORD` via `secrets.token_urlsafe(18)`.

## [1.2.0] - 2026-11-17

### Added
- **Online Git Repository Clone & Multi-Project Switcher (`server/src/git/`, `src/components/git/`):** Logged-in Developers, Scrum Masters, Product Owners, and Admins can now clone real external Git repositories (GitHub, GitLab, Gitea, Forgejo, Bitbucket, self-hosted Git) directly in the browser, test remote connectivity & discover branches live via `git ls-remote`, switch between multiple online projects in `ExplorerPanel`, and choose between **Shared Team Projects** and **Private Developer Workspaces**.
- **AES-256-GCM Encrypted HTTPS PAT & Ed25519 SSH Deploy Key Auth:** Built-in encrypted Git credential store (`DATA_DIR/git-projects.json`, `0600`) with automatic stripping of embedded `https://user:token@host` URLs, ephemeral `GIT_CONFIG_COUNT` HTTP Basic Auth headers (zero plaintext tokens in `.git/config` or process arguments), and 1-click pure-crypto **Ed25519 OpenSSH Deploy Key** generation + `openssh-client` support in `Dockerfile.api`.
- **Full Online Branch Management, Push/Pull & File Git History:** Wired `GitPanel`, `GitBranchModal` (including 1-click *Create Branch from Issue*), and `PageHistoryModal` to real Server Git-Bridge endpoints (`/git/branches`, `/git/checkout`, `/git/commit`, `/git/history`, `/git/file-at-commit`), plus automated Smart HTTP (`git http-backend`) E2E test suite (`tests/onlineGitIntegration.test.ts`).

### Security
- **Git Protocol & SSRF Hardening:** Enforced `-c protocol.allow=never` with explicit `https`/`ssh` allowlisting, disabled host `credential.helper` prompts (`GCM_INTERACTIVE=never`), blocked loopback/link-local metadata SSRF targets (`127.0.0.0/8`, `::1`, `169.254.0.0/16`, `accountprovider`), redacted secrets from Git `stderr` responses, and excluded symlinks in repository tree scans.

## [1.1.0] - 2026-11-17

### Added
- **NethServer 8 Rootless Module & Software Center Repository (`ns8/`, `ns8-repo/`, `ghcr.io/bls-isp/mdteam:1.1.0`):** Native NS8 Software Center repository feed (`https://raw.githubusercontent.com/BLS-ISP/MDTeam/master/ns8-repo/`) and one-command module (`add-module ghcr.io/bls-isp/mdteam:1.1.0 1`) enforcing strict SemVer image tags across `mdteam-web`, `mdteam-api`, and `mdteam-yjs` inside an isolated rootless Podman pod (`127.0.0.1:${TCP_PORT}:80`, `slirp4netns:allow_host_loopback=true`) with Traefik `set-route` & hostname collision validation, `Ldapproxy` credential reload (`ldap-provider-changed`), `update-module.d` image updates, and full Restic cluster Backup, Restore, and Clone lifecycle actions.
- **NethServer 8 Cluster-Admin Cockpit UI (`ns8/ui/`):** Carbon Design System + `@nethserver/ns8-ui-lib` module interface featuring live service/resource/backup `Status` cards, 1-click workspace launch, `Settings` form for FQDN, Let's Encrypt TLS, OpenLDAP/AD domain binding, Group-to-Scrum-Role RBAC mapping, local admin password management, and full English & German (`en`/`de`) localization.
- **Native RFC 4511 LDAPv3 & Active Directory Authentication (`server/src/auth/`):** Zero-dependency Node `Buffer` ASN.1 BER codec and LDAPv3 client supporting both **Samba Active Directory (`ad`)** and **OpenLDAP (`rfc2307`)** user search + DN bind verification, dynamic group-to-Scrum-role mapping (`admin`, `product-owner`, `scrum-master`, `stakeholder`, configurable default role), and an active NS8/LDAP domain indicator in `AuthLoginModal`.
- **Reverse-Proxy Auto-WSS Collaboration & Documentation:** Automatic browser `wss://<host>/ws` Yjs endpoint detection behind Traefik/Nginx, bilingual EN/DE [**NethServer 8 Installation & Administration Guide (`docs/NETHSERVER8_INSTALLATION.md`)**](docs/NETHSERVER8_INSTALLATION.md), automated strict-SemVer GHCR CI publishing for `ghcr.io/bls-isp/mdteam`, and automated NS8 structural + live TCP LDAPv3 test suites.

### Security
- **LDAPv3 Hardening & Secret Isolation:** Enforced RFC 4515 search filter escaping (`\2a`, `\28`, `\29`, `\5c`, `\00`) preventing wildcard/filter injection, strict non-empty password validation blocking anonymous bind bypasses (`RFC 4513 §5.1.2`), and `0600` file-mode isolation for NS8 `secrets.env`.

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
