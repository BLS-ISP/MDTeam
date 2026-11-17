# MDTeam Workspace

A collaborative, **Git-native Jira + Confluence + arc42 Desktop & Web Platform** built for engineering teams, Scrum Masters, Product Owners, and non-technical Stakeholders.

Built as a native desktop application (Windows, macOS, Linux) using **Tauri v2 (Rust)** and **Next.js 16 (React 19, TypeScript)**, MDTeam Workspace stores every ticket, sprint, Confluence knowledge page, Architecture Decision Record (ADR), and arc42 chapter as human-readable Markdown + YAML files directly inside your Git repository—zero external relational database required.

---

## 🌟 Key Features

### 1. Git-Native Jira & Scrum Engine (`issues/*.md`, `sprints/*.md`)
*   **Structured Agile Issue Hierarchy:** First-class **Epics, User Stories, Bugs, and Tasks** stored as `issues/MDT-*.md` with round-trip YAML frontmatter (`id`, `type`, `status`, `priority`, `story_points`, `sprint`, `epic`, `assignee`, `blocked_by`, `branch`, `start_date`, `end_date`) and Markdown sections (`Description`, `Acceptance Criteria`, `Comments`).
*   **5-Column Interactive Kanban Board:** HTML5 drag-and-drop across `Backlog` → `Ready` → `In Progress` → `In Review` → `Done`, configurable **WIP Limits** with red capacity alerts, **Swimlanes** (`None`, `By Assignee`, `By Epic`, `By Priority`), and JQL-style live filtering (`type:bug status:in-progress assignee:@me is:blocked`).
*   **Backlog & Sprint Planning:** Create sprints (`sprints/sprint-*.md`), assign issues, inspect Story Point load vs. team capacity (`management/capacity.md`), **Start / Complete Sprints** (rolling over unfinished work and appending velocity history automatically), and **1-click migrate** legacy `management/sprint-backlog.md` checklists into structured `issues/MDT-*.md` files.
*   **Real-Time Planning Poker:** Interactive Fibonacci estimation (`0, 1, 2, 3, 5, 8, 13, 21, ?`) synchronized live via **Yjs WebSocket** awareness rooms, with an instant offline team-consensus simulation mode when working locally.
*   **Date-Driven Gantt Roadmap:** Real date-math timeline (`Month` / `Quarter` zoom) plotting Epics, Stories, and `management/roadmap.md` milestones with progress bars, a live `Today` marker, and SVG dependency arrows for `blocked_by` relationships.
*   **Real Agile Metrics:** Dynamic SVG **Sprint Burndown**, **Sprint Burnup** (with mid-sprint scope-creep detection), **Cumulative Flow Diagram (CFD)**, and historical **Velocity** bar charts computed directly from Story Points.

### 2. Confluence-Grade Wiki, Live Query Macros & DOCX Export
*   **Live Query Macro (`LiveQueryBlock`):** Embed dynamic, Confluence-style database views inside any Markdown page using fenced ```` ```query ```` blocks:
    ````markdown
    ```query
    FROM issues
    WHERE sprint = sprint-01
    SORT priority desc
    VIEW table
    ```
    ````
    Supports `FROM issues | adrs | pages | roadmap | arc42 | wiki | sprints | all`, `WHERE` filters (`=`, `!=`, `~`, `in`, `>`), `SORT`, and instant interactive toggling between **Table**, **Cards**, and **Stats** views.
*   **Document Lifecycle Governance (`PageGovernanceBar`):** Manage page review states (`Draft` → `In Review` → `Approved`), record `@approver` & timestamp metadata in YAML frontmatter, view word count & estimated reading time, and launch templates or page history in one click.
*   **Inline Review Comments (`InlineCommentsDrawer`):** Highlight quotes or lines to open anchored review threads with `@mentions`, reply history, and `Resolve / Reopen` tracking persisted in `.mdteam/inline-comments.json`.
*   **Page Version History & Time Machine (`PageHistoryModal`):** Inspect native Git commit history (`git log --follow` & `git show <hash>:<path>`) or browser session snapshots side-by-side in Monaco `DiffEditor` and restore any prior version in one click.
*   **Template Gallery (`TemplateGalleryModal`):** Scaffold **arc42 Chapters**, **ADRs**, **RFC / Tech Specs**, **Sprint Retrospectives**, **Product Requirements (PRDs)**, and **Post-Mortem / Incident Reports** with pre-wired Live Query blocks.
*   **Clipboard & Drag-and-Drop Screenshots:** Paste (`Ctrl+V`) or drag-and-drop images directly into the editor—automatically saved to `assets/<timestamp>-<name>.png` in Tauri mode or compressed inline Data-URLs in browser mode.
*   **Zero-Dependency Word (`.docx`) & PDF Book Export:** Native PKZIP + CRC32 OpenXML `.docx` generator (`docxExporter.ts`) exporting single pages or compiled multi-chapter **arc42 Manuals** with styled headings, runs, tables, checklists, and blockquotes alongside print-ready PDF & HTML exports.

### 3. Role Modes, Command Palette (`Ctrl+K`), Atlassian Importer & GitOps
*   **Three Tailored Workspace Modes (`WorkspaceHeaderControls`):**
    *   **Developer Mode:** Full VSCode-style Monaco Split Editor, Live Preview, Git Source Control, Syntax Cheatsheet, and Real-Time Linter.
    *   **Scrum Mode:** Launches straight into the Git-Native Jira & Scrum Workspace alongside Retrospectives and the Daily Standup Assistant.
    *   **Stakeholder / PM Clean Mode:** Hides raw code, Git, and developer clutter—presenting a distraction-free **Confluence Wiki Reader**, **Visual Form Editor**, and **Jira Board** for Product Managers and Stakeholders.
*   **Global Command Palette (`Ctrl+K` / `Cmd+K`):** Instant fuzzy-search omnibox across all Jira issues, Wiki pages, arc42 docs, ADRs, and workspace quick actions.
*   **Notification Inbox & Identity Switcher:** Switch active `@handle` (`@developer-a`, `@developer-b`, `@scrum-master`, `@product-owner`, or custom) and receive live unread badges for assigned issues, `@mentions`, blocked sprint items, and documents `In Review`.
*   **Atlassian Migration Wizard (`AtlassianImportModal`):** Import **Jira CSV** exports, **Jira REST JSON** (including Atlassian Document Format / ADF rich text), and **Confluence HTML** exports (converting Confluence info/warning/code macros and tables into clean Markdown) with built-in 1-click sample datasets.
*   **Issue-to-Branch GitOps Bridge (`GitBranchModal`):** Create and check out sanitized `feat/<ID>-<slug>` or `fix/<ID>-<slug>` branches directly from any Jira issue via native Tauri Rust Git commands (`git_current_branch`, `git_list_branches`, `git_checkout_branch`, `git_file_history`, `git_show_file_at_commit`) and automatically link `branch:` in the issue's frontmatter.

### 4. Unified Knowledge Graph & Real-Time Quality Linter
*   **Interactive Force-Directed Graph (`DocumentGraph`):** Visualizes `arc42`, `ADRs`, `Issues`, `Sprints`, `Wiki`, `Roadmap`, and `Meetings` with directed edges for Markdown links, `@[file#L1-L10]` transclusions, `epic:` parent links, and red dashed `blocked_by:` dependency links.
*   **Real-Time Governance Linter (`linter.ts`):** Validates broken transclusions, empty arc42 sections, mandatory ADR sections, date ranges, `issues/*.md` assignee/Story Point readiness, unresolved `blocked_by` IDs, and **Definition of Done (DoD)** / **Definition of Ready (DoR)** compliance in both German and English.

---

## 🛠️ Technology Stack

*   **Frontend Framework:** [Next.js 16](https://nextjs.org/) (`output: "export"`, React 19, TypeScript)
*   **Desktop Runtime:** [Tauri v2](https://v2.tauri.app/) (Rust backend with `@tauri-apps/plugin-fs` & `@tauri-apps/plugin-dialog`)
*   **Code & Diff Editor:** [Monaco Editor](https://microsoft.github.io/monaco-editor/) (`@monaco-editor/react`)
*   **Real-Time Collaboration:** [Yjs](https://yjs.dev/), `y-websocket`, and `y-monaco` CRDTs
*   **Diagrams:** [Mermaid.js](https://mermaid.js.org/) & interactive [diagrams.net / Draw.io](https://www.draw.io/) embeds

---

## 📂 Folder Structure

```text
MDTeam/
├── issues/                   # Git-native Jira tickets (MDT-101.md .. MDT-105.md)
├── sprints/                  # Active & planned Scrum sprints (sprint-01.md)
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root Next.js layout
│   │   ├── page.tsx          # Unified Developer / Scrum / Stakeholder Workspace
│   │   └── globals.css       # Core dark-theme & layout styles
│   ├── components/
│   │   ├── ScrumWorkspace.tsx          # Kanban, Backlog, Gantt Roadmap & Agile Metrics
│   │   ├── IssueDrawer.tsx             # Full Jira Issue Slide-Over Editor
│   │   ├── PlanningPokerModal.tsx      # Yjs & Offline Fibonacci Planning Poker
│   │   ├── WikiEnhancements.tsx        # Governance Bar, Inline Comments, History & Templates
│   │   ├── CommandPaletteAndModals.tsx # Ctrl+K Omnibox, Atlassian Importer, Git Branch & Inbox
│   │   ├── DocumentGraph.tsx           # Force-directed Knowledge & Dependency Graph
│   │   ├── GlobalSearch.tsx            # Full-text repository search
│   │   ├── ProblemsPanel.tsx           # Real-time DoD/DoR/ADR/Issue diagnostics
│   │   └── DiffViewer.tsx              # Working-copy diff overlay
│   └── utils/
│       ├── issueEngine.ts              # Issue/Sprint parser, JQL engine, Burndown/CFD & Gantt math
│       ├── queryMacro.ts               # Declarative ```query``` macro parser & LiveQueryBlock UI
│       ├── docxExporter.ts             # Zero-dependency PKZIP/CRC32 OpenXML .docx builder
│       ├── atlassianImporter.ts        # Jira CSV/JSON (ADF) & Confluence HTML converter
│       ├── linter.ts                   # Bilingual governance & Scrum readiness linter
│       └── graphParser.ts              # Markdown, transclusion & frontmatter graph builder
├── src-tauri/
│   ├── src/lib.rs            # Native Git CLI & GitOps branch/history Rust commands
│   └── tauri.conf.json       # Tauri v2 configuration & capabilities
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18+)
*   [Rust & Cargo](https://www.rust-lang.org/) (for building the native Tauri desktop binary)
*   [Git](https://git-scm.com/) (for native repository & branch operations)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development

#### A. Native Desktop Application (Tauri v2)
```bash
npx tauri dev
```

#### B. Web Browser Sandbox
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. All Scrum, Confluence, DOCX export, Live Query, Planning Poker, and Atlassian Import features work seamlessly in both Tauri desktop mode and browser sandbox mode.

### 3. Production Build
Build the static Next.js export (`out/`):
```bash
npm run build
```
Compile the native release desktop executable (`src-tauri/target/release/app.exe` on Windows):
```bash
npx tauri build --no-bundle
```

---

## 🤝 Real-Time Collaboration (Yjs)
Start a local Yjs WebSocket server for multi-user Monaco editing and live Planning Poker rooms:
```bash
npx y-websocket
```
Open **Settings** in MDTeam Workspace and connect to `ws://localhost:1234` (or launch both web + Yjs containers via `docker-compose up -d --build`).

---

## 📄 License
Licensed for internal team and enterprise use.
