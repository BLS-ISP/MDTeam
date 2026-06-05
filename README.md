# MDTeam Workspace

A cutting-edge, collaborative desktop client designed for developer teams to efficiently edit, manage, and visualize software architecture and project management documentation (especially following the **arc42 standard**).

Built as a native desktop application (Windows, macOS, Linux) using **Tauri v2** and **Next.js**, it combines the power of a code-centric Markdown editor with the ease of visual forms and Agile project management boards.

---

## 🌟 Key Features

### 1. Code-Centric Markdown & Visual Form Editors
*   **Split-Pane Editor:** Edit files in a robust code editor (Monaco Editor) while viewing a high-fidelity rendering side-by-side.
*   **Visual Editor Mode ("Notion-Style"):** Seamlessly toggle between raw Markdown and an interactive, block-based or form-based WYSIWYG editor.
*   **Agile Forms:** Specialized visual forms for sprint backlogs, capacity planning, burn-down tables, and retrospectives. Edits are synced back to the markdown source file in real time.

### 2. Integrated Scrum Master & Agile Tools
*   **Visual Kanban Board:** Automatically parses, categorizes, and displays tasks (`TODO`, `IN-PROGRESS`, `DONE`) defined in `sprint-backlog.md`.
*   **Sprint Burn-Down Chart:** Dynamic SVG line chart showing ideal vs. actual remaining story points mapped from `burndown.md`.
*   **Sprint Capacity & Velocity Tracker:** Calculations for team availability (vacation, focus factors) and historical velocity tracking.
*   **Daily Standup Assistant:** Generates automated daily status reports (completed tasks, in-progress tasks, active blockers) based on files modified in the last 24 hours.
*   **Interactive Retrospective Board:** Renders retro bullet points as Glad (green), Sad (red), or Blocker (yellow) sticky notes that can be edited or deleted in-place.

### 3. Native Desktop Features (Tauri v2)
*   **Native Git Module:** Direct integration with local git repositories supporting Init, Status, Log, Commit, Push, Pull, and Diff operations.
*   **Auto-Pull & Sync:** Automatically pulls remote updates when opening a project to prevent conflicts and ensure synchronized states.
*   **Local File System Integration:** Direct read/write access to local directories without relying on cloud synchronization services.
*   **Multi-Format Export & PDF Printing:** Save documents as HTML or print them directly to high-fidelity PDFs via custom print stylesheet overlays.

### 4. Real-Time Collaboration (Yjs & WebSockets)
*   **Conflict-Free Editing (CRDTs):** Direct binding of Monaco editor instances to a Yjs WebSocket server for real-time collaboration.
*   **Connectivity Indicators:** Live connection status (`Connected` | `Connecting` | `Offline`) shown directly in the application footer.

### 5. Multi-Project & Multi-Language Support
*   **Multi-Project Switcher:** Manage and swap between the 5 most recently opened workspaces in the sidebar, executing clean state transitions (resetting open tabs, rescanning files, updating Git statuses).
*   **Bilingual Localization (DE/EN):** Toggle between German and English for all menus, forms, linters, and Markdown table structures.

---

## 🛠️ Technology Stack

*   **Frontend Framework:** [Next.js](https://nextjs.org/) (React, TypeScript)
*   **Styling:** Custom Vanilla CSS (Premium dark theme with VSCode & glassmorphism aesthetics)
*   **Core Desktop Bridge:** [Tauri v2](https://v2.tauri.app/) (Rust-Backend)
*   **Text Editor:** [Monaco Editor](https://microsoft.github.io/monaco-editor/) via `@monaco-editor/react`
*   **Collaboration:** [Yjs](https://yjs.dev/), `y-websocket` & `y-monaco`
*   **Diagrams:** [Mermaid.js](https://mermaid.js.org/) & [Draw.io](https://www.draw.io/) embeds

---

## 📂 Folder Structure

```
MDTeam/
├── src/                      # Next.js React Frontend
│   ├── app/
│   │   ├── layout.tsx        # Global page layout
│   │   ├── page.tsx          # Workspace & UI components
│   │   └── globals.css       # Core stylesheet
│   └── components/           # Panel overlays (DiffViewer, DocumentGraph, etc.)
├── src-tauri/                # Tauri Rust Backend
│   ├── src/
│   │   ├── main.rs           # Tauri entry point
│   │   └── lib.rs            # Native Git Rust Commands
│   └── tauri.conf.json       # App configuration & permissions
├── package.json              # NPM dependencies & scripts
└── README.md                 # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
Make sure your development machine has the following tools installed:
*   [Node.js](https://nodejs.org/) (v18+)
*   [Rust & Cargo](https://www.rust-lang.org/) (for compiling the Tauri app)
*   [Git](https://git-scm.com/) (for source control operations)

### 1. Clone the Repository & Install Dependencies
```bash
git clone https://github.com/your-team/MDTeam.git
cd MDTeam
npm install
```

### 2. Start the Development Server

#### A. Native Desktop Application (Recommended)
Launches the workspace inside the native Tauri window:
```bash
npx tauri dev
```

#### B. Web Browser Mode (Mock Sandbox)
Runs the Next.js development server in the browser with virtual simulated files:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 3. Build for Production
Compiles the optimized release version of the desktop application:
```bash
npx tauri build --no-bundle
```
The executable binary (`app.exe` on Windows) will be located at:
`src-tauri/target/release/app.exe`

### 4. CI/CD & Automated Releases (GitHub Actions)
An automated release pipeline is configured in `.github/workflows/build.yml`.
*   **Triggers:** Automatically runs on every push to the `main` or `master` branches, or when triggered manually via `workflow_dispatch`.
*   **Actions:** Compiles the application concurrently using Windows and Linux runners.
*   **Artifacts:** Creates a draft release on GitHub populated with build packages for multiple platforms:
    *   **Windows:** Installer binaries (`.exe`, `.msi`).
    *   **Linux (Debian/Ubuntu):** Debian package (`.deb`).
    *   **Linux (RedHat/Fedora):** Package manager file (`.rpm`).
    *   **Linux (Portable):** Portable bundle (`.AppImage`).

---

## 📖 Document & File Guidelines

The client expects a standard folder structure containing specific Markdown files to feed the dashboards and linters:

| File | Purpose |
| :--- | :--- |
| `management/roadmap.md` | Roadmap milestones containing YAML frontmatter cards. |
| `management/sprint-backlog.md` | Active sprint tasks (displayed on the Kanban board). |
| `management/burndown.md` | Burn-down data table (generates the burn-down SVG chart). |
| `management/capacity.md` | Team sprint capacities (holidays, focus factors). |
| `meetings/[Date]_retro.md` | Sprint retrospective notes (Glad/Sad/Impediment sticky board). |
| `management/definition-of-done.md` | Quality criteria for the sprint checked by the DoD Linter. |
| `management/definition-of-ready.md` | Criteria checklist validating backlog items in progress. |

### Real-Time Linter (`linter.ts`)
The application features a real-time linter which analyzes markdown files and displays diagnostics directly in Monaco:
*   **DoD Validation:** Flags unresolved blocker lines or unfinished backlog tasks.
*   **DoR Validation:** Warns if active backlog items lack assignee handles (`@name`) or remain blocked.
*   **ADR Verification:** Confirms that Architecture Decision Records include all mandatory sections (Status, Context, Decision, Consequences).

---

## 🤝 Setting Up Collaboration
To try the real-time multi-user synchronization, spin up a local Yjs WebSocket server:
```bash
npx y-websocket
```
Once active, navigate to **Settings** (gear icon) in the app, type `ws://localhost:1234` in the server URL field, and click connect.

---

## 🐳 Docker Deployment

You can host both the web client workspace and the Yjs collaboration server together using Docker and Docker Compose.

### Quick Start
To build the images and run the containers in the background, execute:
```bash
docker-compose up -d --build
```

### Services Launched
*   **workspace-web (Port 80):** Multi-stage build that compiles the Next.js static site and serves it via Nginx on port 80.
*   **yjs-server (Port 1234):** Runs the Yjs websocket collaboration server on port 1234.

Once active:
*   Open `http://localhost` in your browser to access the web application.
*   Navigate to **Settings** (gear icon) in the web app, and type `ws://localhost:1234` in the server URL field to establish the real-time syncing.

---

## 📄 License
This project is licensed for internal team use. Please refer to your project manager for licensing guidelines.
