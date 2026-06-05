"use client";

import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import mermaid from "mermaid";
import { Diagnostic, lintWorkspaceFiles } from "../utils/linter";
import { findBacklinks } from "../utils/graphParser";
import DocumentGraph from "../components/DocumentGraph";
import DiffViewer from "../components/DiffViewer";
import GlobalSearch from "../components/GlobalSearch";
import ProblemsPanel from "../components/ProblemsPanel";

// Initialize mermaid on client side
if (typeof window !== "undefined") {
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "loose",
    fontFamily: "var(--font-sans)",
  });
}

const MermaidElement = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const cleanChart = chart.trim();
        const { svg: renderedSvg } = await mermaid.render(id, cleanChart);
        if (isMounted) {
          setSvg(renderedSvg);
          setError("");
        }
      } catch (err: any) {
        console.error("Mermaid render error:", err);
        if (isMounted) {
          setError("Fehler beim Rendern des Diagramms.");
        }
        // Remove bad nodes
        const badElements = document.querySelectorAll('[id^="dmermaid-"]');
        badElements.forEach(el => el.remove());
      }
    };

    renderChart();
    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (error) {
    return (
      <div style={{ padding: '8px 12px', border: '1px solid var(--accent-red)', borderRadius: '6px', fontSize: '12px', color: 'var(--accent-red)', backgroundColor: 'rgba(239, 68, 68, 0.05)', margin: '12px 0' }}>
        <span>{error}</span>
        <pre style={{ fontSize: '10px', marginTop: '4px', background: 'transparent', border: 'none', padding: 0 }}>{chart}</pre>
      </div>
    );
  }

  if (!svg) {
    return <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rendere Diagramm...</div>;
  }

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: svg }} style={{ margin: '16px 0', overflowX: 'auto' }} />;
};

import { 
  Folder, 
  FileText, 
  GitBranch, 
  Calendar, 
  Settings, 
  Eye, 
  FileDown, 
  Plus, 
  Trash2,
  Play, 
  CheckSquare, 
  List, 
  Table as TableIcon, 
  Code as CodeIcon,
  Bold,
  Italic,
  Users,
  Key,
  Database,
  ArrowRight,
  Sparkles,
  Download,
  CheckCircle,
  Clock,
  X,
  Link,
  Image as ImageIcon,
  Quote,
  Minus,
  ListOrdered,
  ChevronUp,
  ChevronDown,
  FolderPlus,
  FilePlus,
  Box,
  Search,
  Share2,
  Split,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  HelpCircle,
  TrendingDown
} from "lucide-react";

// Preloaded files in our workspace
interface WorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

const INITIAL_FILES: WorkspaceFile[] = [
  {
    path: "arc42/01_introduction_goals.md",
    name: "01_introduction_goals.md",
    category: "arc42",
    content: `# 1. Einführung und Ziele

Dieses Dokument beschreibt die Architektur und Ziele des **MDTeam Workspace**-Projekts. Die Plattform soll Entwicklern eine VSCode-ähnliche Umgebung zur Bearbeitung von arc42-Dokumenten bieten.

## 1.1 Aufgabenstellung
*   Entwicklerzentriertes Tool zur Verwaltung von Dokumentationen.
*   Single Source of Truth im Git-Repository.
*   Visuelle Aufbereitung für Projektmanager (PMs).

## 1.2 Qualitätsziele
| Priorität | Qualitätsziel | Beschreibung |
| :---: | :--- | :--- |
| 1 | Entwicklerzufriedenheit | Die Oberfläche fühlt sich wie VSCode an und stört den Workflow nicht. |
| 2 | Echtzeit-Synchronisation | Konfliktfreie Live-Bearbeitung mehrerer Autoren. |
| 3 | PM-Transparenz | Automatisierte Roadmaps direkt aus Markdown-Dokumenten. |

## 1.3 Referenzen & Entscheidungen
*   Siehe auch die technischen [Randbedingungen](arc42/02_constraints.md) des Systems.
*   Die Authentifizierungsstrategie ist in [ADR-0001 modulare Authentifizierung](adrs/ADR-0001-auth-strategy.md) definiert.
`
  },
  {
    path: "arc42/02_constraints.md",
    name: "02_constraints.md",
    category: "arc42",
    content: `# 2. Randbedingungen

Hier werden organisatorische, technische und politische Randbedingungen für die Systemarchitektur festgehalten.

## 2.1 Technische Randbedingungen
*   **Git-basierte Speicherung:** Keine externe relationale Datenbank für Textdateien.
*   **Tauri Desktop Wrapper:** Muss lokal lauffähig sein und native Dateisystemzugriffe ermöglichen.
*   **Monaco Editor:** Syntax-Highlighting und Shortcuts identisch mit VSCode.

## 2.2 Organisatorische Randbedingungen
*   **Zielgruppe:** 85% Entwickler, 15% Projektmanager.
*   **Datenschutz:** Vollständiger On-Premises-Betrieb muss gewährleistet sein.
`
  },
  {
    path: "adrs/ADR-0001-auth-strategy.md",
    name: "ADR-0001-auth-strategy.md",
    category: "adrs",
    content: `# ADR-0001: Modulare Authentifizierung

---
title: "ADR-0001: Modulare Authentifizierung"
status: "completed"
milestone: "Architektur-Entscheidungen"
start_date: "2026-06-01"
end_date: "2026-06-03"
assignee: "Lead Architect"
color: "#10b981"
---

## Status
==Akzeptiert== (Zuvor: ~~vorgeschlagen~~)

## Kontext
Wir benötigen ein Authentifizierungs-System, das flexibel an Firmennetzwerke (LDAP/AD) und SSO-Lösungen (Keycloak) angebunden werden kann.

## Entscheidung
Wir verwenden das Strategy-Pattern über Passport.js oder NextAuth (Auth.js) im API Gateway, um mehrere Identity Provider modular anzubinden.

## Konsequenzen
*   [x] Einfache Integration neuer Kunden-SSOs.
*   [x] Benutzerverwaltung verbleibt beim Identity Provider.

<details>
<summary>Weitere Diskussionspunkte & Notizen</summary>

*   LDAP-Synchronisation wird als Fallback eingerichtet.
*   OAuth2 / OpenID Connect wird als Standard-SSO-Prototyp empfohlen.
</details>
`
  },
  {
    path: "management/roadmap.md",
    name: "roadmap.md",
    category: "management",
    content: `# Projekt-Roadmap & Meilensteine

PMs nutzen dieses Dokument, um Meilensteine zu überwachen. Ändern Sie die YAML-Blöcke unten, um die Timeline im Dashboard live zu aktualisieren. Die operativen Aufgaben befinden sich im [Sprint-Backlog](management/sprint-backlog.md).

---
title: "Konzeptionierung & Architektur"
status: "completed"
milestone: "M1: Konzept"
start_date: "2026-06-01"
end_date: "2026-06-03"
assignee: "Projektteam"
---

---
title: "Monaco Editor & Split-Preview"
status: "in-progress"
milestone: "M2: Core Features"
start_date: "2026-06-04"
end_date: "2026-06-12"
assignee: "Developer A"
---

---
title: "Yjs Live-Sync-Server Setup"
status: "pending"
milestone: "M2: Core Features"
start_date: "2026-06-13"
end_date: "2026-06-20"
assignee: "Developer B"
color: "#a855f7"
---

---
title: "PDF & DOCX Export-Modul"
status: "pending"
milestone: "M3: Finalisierung"
start_date: "2026-06-21"
end_date: "2026-06-28"
assignee: "Developer A"
color: "#f97316"
---
`
  },
  {
    path: "meetings/2026-06-03_weekly.md",
    name: "2026-06-03_weekly.md",
    category: "meetings",
    content: `# Weekly Status Meeting - 03.06.2026

## Teilnehmer
*   Dev A, Dev B, PM C

## Agenda
*   Freigabe des MDTeam Workspace Konzepts.
*   Planung der ersten Implementierungsphase.

## Beschlüsse
*   Architekturkonzept ist freigegeben (Details unter [Einführung und Ziele](arc42/01_introduction_goals.md)).
*   Next.js & Tauri werden als Technologie-Stack gesetzt.
`
  },
  {
    path: "management/sprint-backlog.md",
    name: "sprint-backlog.md",
    category: "management",
    content: `# Sprint Backlog

Sprint-Aufgaben des Teams. Bearbeiten Sie die Aufgabenliste unten, um das Kanban-Board im Dashboard live zu aktualisieren.

## Aufgaben

- [ ] TODO: OAuth2-Verbindung in Keycloak testen @developer-a
- [/] IN-PROGRESS: Yjs-Kollaborationsserver deployen @developer-b
- [ ] TODO: PDF-Export-Layout verschönern @developer-a
- [x] DONE: Monaco Autocomplete-Provider einrichten @developer-b
- [x] DONE: Hilfe-Modal (Cheatsheet) einbauen @developer-a
- [ ] TODO: Linter mit DoD verknüpfen @developer-b

## Rahmenbedingungen
*   Die Einhaltung der Qualitätskriterien erfolgt gemäß unserer [Definition of Done](management/definition-of-done.md) und [Definition of Ready](management/definition-of-ready.md).
`
  },
  {
    path: "management/burndown.md",
    name: "burndown.md",
    category: "management",
    content: `# Sprint Burndown Metrics

Tägliche Erfassung der Restaufwände (Story Points). Ändern Sie die Tabelle unten, um das Burndown-Chart im Dashboard live zu aktualisieren.

## Sprint-Daten

| Tag | Ideal-Linie | Restaufwand (Tatsächlich) |
| :-- | :---------- | :------------------------ |
| 1   | 60          | 60                        |
| 2   | 50          | 55                        |
| 3   | 40          | 42                        |
| 4   | 30          | 38                        |
| 5   | 20          | 20                        |
| 6   | 10          | 12                        |
| 7   | 0           | 0                         |
`
  },
  {
    path: "management/definition-of-done.md",
    name: "definition-of-done.md",
    category: "management",
    content: `# Definition of Done (DoD)

Qualitätsrichtlinien für alle Tickets und Releases des Teams.

## Release-Kriterien (DoD)

*   [x] Alle Linter-Fehler im Problems-Panel sind behoben.
*   [ ] Keine unfertigen Aufgaben im aktuellen [Sprint-Backlog](management/sprint-backlog.md).
*   [ ] Alle [Architekturentscheidungen (ADRs)](adrs/ADR-0001-auth-strategy.md) sind auf "Akzeptiert" oder "Superseded" gesetzt (keine Entwürfe / "Vorgeschlagen").
*   [ ] Alle offenen Blocker-Einträge (Impediments) sind gelöst.
*   [x] Die arc42 Kapitel enthalten keine leeren Beispiel-Abschnitte.
`
  },
  {
    path: "meetings/2026-06-03_retro.md",
    name: "2026-06-03_retro.md",
    category: "meetings",
    content: `# Sprint Retrospektive - 03.06.2026

## 1. Was lief gut?
*   Die Autovervollständigung funktioniert extrem geschmeidig.
*   Das Cheatsheet hat die Einarbeitung enorm beschleunigt.
*   Die Arbeitsfortschritte laut [Sprint Burndown](management/burndown.md) sind im Soll.

## 2. Was lief nicht gut?
*   Die Firewall blockiert den Zugriff auf den LDAP-Server.
*   Die Kapazitätsgrenzen wurden überschritten, siehe [Sprint-Kapazität](management/capacity.md).

## 3. Impediments / Blocker Log
*   [ ] BLOCKED: LDAP-Port 389 ist in der Firewall gesperrt @scrummaster
*   [ ] BLOCKED: Docker Hub-Zugriff für Yjs-Basis-Image gedrosselt @scrummaster
`
  },
  {
    path: "management/capacity.md",
    name: "capacity.md",
    category: "management",
    content: `# Sprint-Kapazität & Velocity

Historische Velocity und aktuelle Teamberechnungen.

## Historische Velocity

| Sprint | Geplant (Story Points) | Erreicht (Story Points) |
| :----- | :--------------------- | :---------------------- |
| Sprint 1 | 45                     | 40                      |
| Sprint 2 | 50                     | 48                      |
| Sprint 3 | 55                     | 52                      |
| Sprint 4 (Aktuell) | 60                     | 20                      |

## Team-Kapazität (Aktueller Sprint)

| Teammitglied | Verfügbare Tage | Fokus-Faktor | Kapazität (SP) |
| :----------- | :-------------- | :----------- | :------------- |
| @developer-a | 10              | 0.8          | 8.0            |
| @developer-b | 8               | 0.7          | 5.6            |
| @scrummaster | 5               | 0.4          | 2.0            |
`
  },
  {
    path: "management/definition-of-ready.md",
    name: "definition-of-ready.md",
    category: "management",
    content: `# Definition of Ready (DoR)

Qualitätskriterien, die eine User Story erfüllen muss, bevor sie in den Sprint aufgenommen wird.

## Kriterien (DoR)

*   [ ] Zuweisung vorhanden: Jede Story im [Sprint-Backlog](management/sprint-backlog.md) muss einem Teammitglied zugewiesen sein (z. B. \`@developer-a\`).
*   [ ] Keine offenen Blocker: Storys dürfen im Sprint nicht blockiert sein (keine \`BLOCKED:\` Präfixe auf aktiven Aufgaben).
*   [ ] Klare Beschreibung: Das Ticket darf keine leeren Platzhalter-Texte enthalten.
`
  }
];

interface Commit {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

interface RoadmapItem {
  title: string;
  status: 'completed' | 'in-progress' | 'pending';
  milestone: string;
  start_date: string;
  end_date: string;
  assignee: string;
  color?: string;
}

interface BacklogItem {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  assignee: string;
}

interface BurndownDataPoint {
  day: string;
  ideal: number;
  actual: number | null;
}

interface ImpedimentItem {
  filePath: string;
  fileName: string;
  line: number;
  title: string;
  assignee: string;
}

const translations = {
  de: {
    // header status
    unsavedChanges: "ungespeicherte Änderungen",
    syncedWithGit: "Mit Git synchronisiert",
    devRole: "Dev-Rolle",
    
    // Sidebar titles
    titleExplorer: "Dateiexplorer (arc42 Struktur)",
    titleSearch: "Globale Suche",
    titleGit: "Git Source Control",
    titleGraph: "Dokumenten-Beziehungs-Graph",
    titlePM: "PM Timeline & Dashboard",
    titleMeetings: "Meeting Assistent",
    titleCheatsheet: "Syntax-Hilfe & Cheatsheet",
    titleSettings: "Einstellungen",
    
    // Explorer
    repoExplorer: "Repository Explorer",
    newFile: "Neue Markdown-Datei erstellen",
    newFolder: "Neuen Ordner erstellen",
    backlinks: "Verweise (Backlinks)",
    noBacklinks: "Keine Verweise auf dieses Dokument.",
    
    // Explorer Categories Display Names
    arc42Doc: "arc42-Dokumentation",
    adrsDecisions: "adrs (Entscheidungen)",
    mgmtRoadmaps: "management (Roadmaps)",
    meetProtokolle: "meetings (Protokolle)",
    
    // File/Folder Modals
    createFileTitle: "Neue Markdown-Datei erstellen",
    createFolderTitle: "Neuen Ordner erstellen",
    fileNameLabel: "Dateiname (z.B. datei.md)",
    folderNameLabel: "Ordnername (z.B. subfolder)",
    cancel: "Abbrechen",
    create: "Erstellen",
    folderSelectLabel: "Kategorie / Pfad",
    errorFileExists: "Datei existiert bereits!",
    errorFolderExists: "Ordner existiert bereits!",
    
    // Git Panel
    gitSourceControl: "Git Source Control",
    localChanges: "Lokale Änderungen",
    noChanges: "Keine geänderten Dateien",
    stageChanges: "Änderungen bereitstellen",
    unstagedChanges: "Nicht bereitgestellte Änderungen",
    commitMessage: "Commit Message",
    commitPush: "Commit & Push",
    commitHistory: "Commit Verlauf",
    lastCommit: "Letzter Commit",
    diffTitle: "Git Diff",
    diffOriginal: "Letzter Commit (Original)",
    diffModified: "Arbeitskopie (Modifiziert)",
    commitSuccess: "Commit erfolgreich durchgeführt und gepusht!",
    noChangesToCommit: "Keine geänderten Dateien zum Committen.",
    enterCommitMsg: "Bitte geben Sie eine Commit-Nachricht ein.",
    
    // PM Timeline Panel
    dashboardTitle: "Agile Project Dashboard",
    backlogBoardTitle: "Sprint Backlog & Kanban-Board",
    retroBoardTitle: "Retrospektive Board",
    dailyStandupTitle: "Daily Standup Assistent",
    activeSprint: "Aktueller Sprint",
    velocityTitle: "Historical Velocity (Sprintpunkte)",
    burndownTitle: "Burndown Chart",
    standupPrompt: "Wählen Sie ein Teammitglied oder generieren Sie ein Gesamt-Update für das Daily.",
    standupBtn: "Daily Update generieren",
    standupIntro: "Dieser Bericht wurde automatisch aus Ihrem aktuellen Sprint-Backlog und dem Impediment-Log zusammengestellt. Er kann kopiert und in Ihren Slack/Teams-Kanal oder das Besprechungsprotokoll eingefügt werden.",
    retroGlad: "Glad (Was lief gut?)",
    retroSad: "Sad (Was lief schlecht?)",
    retroImpediment: "Impediment (Blocker / Probleme)",
    addNote: "Notiz hinzufügen...",
    
    // Meeting Pane
    minutesTitle: "Minutes generieren",
    generateMinutes: "Meeting-Protokoll generieren",
    meetingType: "Meeting Typ",
    
    // Settings
    settingsTitle: "Einstellungen",
    authLabel: "Authentifizierung",
    gitProviderLabel: "Git Provider",
    gitUrlLabel: "Git Server URL",
    keycloakUrlLabel: "Keycloak Server URL",
    ldapUrlLabel: "LDAP Directory URL",
    languageLabel: "Sprache",
    languageDE: "Deutsch (German)",
    languageEN: "English",
    authOIDC: "Keycloak SSO (OpenID Connect)",
    authLDAP: "LDAP / Active Directory",
    authLocal: "Lokale Testbenutzer",
    
    // Cheatsheet
    cheatsheetTitle: "Syntax-Hilfe & Cheatsheet",
    cheatsheetSubtitle: "VSCode-ähnliche Shortcuts & Formatierungshilfen",
    clickToDiff: "Klicken für Diff-Ansicht",
  },
  en: {
    // header status
    unsavedChanges: "unsaved changes",
    syncedWithGit: "Synced with Git",
    devRole: "Dev Role",
    
    // Sidebar titles
    titleExplorer: "File Explorer (arc42 Structure)",
    titleSearch: "Global Search",
    titleGit: "Git Source Control",
    titleGraph: "Document Relationship Graph",
    titlePM: "PM Timeline & Dashboard",
    titleMeetings: "Meeting Assistant",
    titleCheatsheet: "Syntax Help & Cheatsheet",
    titleSettings: "Settings",
    
    // Explorer
    repoExplorer: "Repository Explorer",
    newFile: "Create new Markdown file",
    newFolder: "Create new folder",
    backlinks: "Backlinks",
    noBacklinks: "No references to this document.",
    
    // Explorer Categories Display Names
    arc42Doc: "arc42 Documentation",
    adrsDecisions: "adrs (Decisions)",
    mgmtRoadmaps: "management (Roadmaps)",
    meetProtokolle: "meetings (Minutes)",
    
    // File/Folder Modals
    createFileTitle: "Create new Markdown file",
    createFolderTitle: "Create new folder",
    fileNameLabel: "File name (e.g. file.md)",
    folderNameLabel: "Folder name (e.g. subfolder)",
    cancel: "Cancel",
    create: "Create",
    folderSelectLabel: "Category / Path",
    errorFileExists: "File already exists!",
    errorFolderExists: "Folder already exists!",
    
    // Git Panel
    gitSourceControl: "Git Source Control",
    localChanges: "Local Changes",
    noChanges: "No changed files",
    stageChanges: "Stage Changes",
    unstagedChanges: "Unstaged Changes",
    commitMessage: "Commit Message",
    commitPush: "Commit & Push",
    commitHistory: "Commit History",
    lastCommit: "Last Commit",
    diffTitle: "Git Diff",
    diffOriginal: "Last Commit (Original)",
    diffModified: "Working Copy (Modified)",
    commitSuccess: "Commit successfully created and pushed!",
    noChangesToCommit: "No changed files to commit.",
    enterCommitMsg: "Please enter a commit message.",
    
    // PM Timeline Panel
    dashboardTitle: "Agile Project Dashboard",
    backlogBoardTitle: "Sprint Backlog & Kanban Board",
    retroBoardTitle: "Retrospective Board",
    dailyStandupTitle: "Daily Standup Assistant",
    activeSprint: "Active Sprint",
    velocityTitle: "Historical Velocity (Sprint Points)",
    burndownTitle: "Burndown Chart",
    standupPrompt: "Select a team member or generate an overall update for the daily.",
    standupBtn: "Generate Daily Update",
    standupIntro: "This report was compiled automatically from your active Sprint Backlog and the Impediment Log. It can be copied and pasted into your Slack/Teams channel or meeting minutes.",
    retroGlad: "Glad (What went well?)",
    retroSad: "Sad (What went wrong?)",
    retroImpediment: "Impediment (Blockers / Issues)",
    addNote: "Add note...",
    
    // Meeting Pane
    minutesTitle: "Generate Minutes",
    generateMinutes: "Generate Meeting Minutes",
    meetingType: "Meeting Type",
    
    // Settings
    settingsTitle: "Settings",
    authLabel: "Authentication",
    gitProviderLabel: "Git Provider",
    gitUrlLabel: "Git Server URL",
    keycloakUrlLabel: "Keycloak Server URL",
    ldapUrlLabel: "LDAP Directory URL",
    languageLabel: "Language",
    languageDE: "Deutsch (German)",
    languageEN: "English",
    authOIDC: "Keycloak SSO (OpenID Connect)",
    authLDAP: "LDAP / Active Directory",
    authLocal: "Local Test Users",
    
    // Cheatsheet
    cheatsheetTitle: "Syntax Help & Cheatsheet",
    cheatsheetSubtitle: "VSCode-like Shortcuts & Formatting Aids",
    clickToDiff: "Click to view Diff",
  }
};

export default function Workspace() {
  const [language, setLanguage] = useState<"de" | "en">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("language");
      if (stored === "de" || stored === "en") return stored;
    }
    return "de";
  });
  const t = translations[language];

  const [files, setFiles] = useState<WorkspaceFile[]>(INITIAL_FILES);
  const [activeFilePath, setActiveFilePath] = useState<string>("arc42/01_introduction_goals.md");
  const [openTabs, setOpenTabs] = useState<string[]>(["arc42/01_introduction_goals.md"]);
  const [activePanel, setActivePanel] = useState<"explorer" | "search" | "git" | "pm" | "meetings" | "settings" | "graph" | "cheatsheet">("explorer");
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [pmSubTab, setPmSubTab] = useState<"roadmap" | "kanban" | "velocity" | "retro" | "standup">("roadmap");
  const [editorMode, setEditorMode] = useState<"code" | "visual">("code");
  const [showCheatsheetModal, setShowCheatsheetModal] = useState<boolean>(false);
  const [categories, setCategories] = useState<string[]>(["arc42", "adrs", "management", "meetings"]);

  const [isTauri, setIsTauri] = useState<boolean>(false);
  const [tauriRootFolder, setTauriRootFolder] = useState<string>("");
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [printScope, setPrintScope] = useState<"single" | "book" | null>(null);
  const [editorAInstance, setEditorAInstance] = useState<any>(null);
  const [editorBInstance, setEditorBInstance] = useState<any>(null);
  const [yjsUrl, setYjsUrl] = useState<string>("ws://localhost:1234");
  const [yjsStatus, setYjsStatus] = useState<"connected" | "connecting" | "offline">("offline");

  useEffect(() => {
    if (!yjsUrl) {
      setYjsStatus("offline");
      return;
    }
    setYjsStatus("connecting");
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(yjsUrl);
      ws.onopen = () => {
        setYjsStatus("connected");
      };
      ws.onerror = () => {
        setYjsStatus("offline");
      };
      ws.onclose = () => {
        setYjsStatus("offline");
      };
    } catch (e) {
      setYjsStatus("offline");
    }
    return () => {
      if (ws) ws.close();
    };
  }, [yjsUrl]);

  useEffect(() => {
    setIsTauri(typeof window !== "undefined" && (window as any).__TAURI__ !== undefined);
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("mdteam_recent_projects");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setRecentProjects(parsed.filter(item => typeof item === "string"));
          }
        }
      } catch (e) {
        console.error("Failed to parse mdteam_recent_projects from localStorage:", e);
      }
    }
  }, []);

  const syncGitStatus = async (rootPath = tauriRootFolder) => {
    if (!rootPath) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      
      // 1. Fetch native Git Status
      try {
        const statusOutput = await invoke<string>("git_status", { repoPath: rootPath });
        const lines = statusOutput.split("\n").filter(l => l.trim() !== "");
        const localMods: { [path: string]: boolean } = {};
        
        lines.forEach(line => {
          if (line.length >= 3) {
            const status = line.substring(0, 2);
            let filepath = line.substring(3).trim();
            // Handle quotes around filenames if git outputs them
            if (filepath.startsWith('"') && filepath.endsWith('"')) {
              filepath = filepath.substring(1, filepath.length - 1);
            }
            filepath = filepath.replace(/\\/g, "/");
            localMods[filepath] = true;
          }
        });
        
        setModifiedFiles(localMods);
      } catch (e: any) {
        if (e && typeof e === "string" && e.includes("not a git repository")) {
          setModifiedFiles({});
        } else {
          console.error("Git status failed:", e);
        }
      }

      // 2. Fetch native Git Log
      try {
        const logOutput = await invoke<string>("git_log", { repoPath: rootPath, limit: 15 });
        const lines = logOutput.split("\n").filter(l => l.trim() !== "");
        const loadedCommits = lines.map(line => {
          const [hash, message, author, date] = line.split("|");
          return {
            hash: hash || "unknown",
            message: message || "",
            author: author || "unknown",
            date: date || "",
            files: []
          };
        });
        setCommits(loadedCommits);
      } catch (e) {
        console.error("Git log failed:", e);
      }
      
    } catch (err) {
      console.error("Failed to run tauri core invoke:", err);
    }
  };

  const rescanTauriFiles = async (rootPath = tauriRootFolder) => {
    if (!rootPath) return;
    try {
      const { readDir, readTextFile, mkdir } = await import("@tauri-apps/plugin-fs");
      const loadedFiles: WorkspaceFile[] = [];
      const loadedCategories = new Set<string>();

      const scan = async (dirPath: string, relativePath: string = "") => {
        const entries = await readDir(dirPath);
        for (const entry of entries) {
          if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "out" || entry.name === "target" || entry.name === "dist" || entry.name === "public") {
            continue;
          }
          
          const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          const entryAbsPath = `${dirPath}/${entry.name}`;
          
          if (entry.isDirectory) {
            loadedCategories.add(entryRelPath);
            await scan(entryAbsPath, entryRelPath);
          } else if (entry.isFile && entry.name.endsWith(".md")) {
            const content = await readTextFile(entryAbsPath);
            const parentDir = relativePath || "other";
            loadedCategories.add(parentDir);
            loadedFiles.push({
              path: entryRelPath,
              name: entry.name,
              category: parentDir,
              content: content
            });
          }
        }
      };

      await scan(rootPath);

      if (loadedFiles.length === 0) {
        // Initialize default dirs on disk
        const defaultDirs = ["arc42", "adrs", "management", "meetings"];
        for (const d of defaultDirs) {
          await mkdir(`${rootPath}/${d}`, { recursive: true });
          loadedCategories.add(d);
        }
        
        // Write INITIAL_FILES to disk
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        for (const initFile of INITIAL_FILES) {
          const absPath = `${rootPath}/${initFile.path}`;
          await writeTextFile(absPath, initFile.content);
          loadedFiles.push(initFile);
        }
      }

      setCategories(Array.from(loadedCategories).sort());
      setFiles(loadedFiles);
    } catch (e) {
      console.error("Failed to rescan files:", e);
    }
  };

  const getFolderBasename = (pathStr: string) => {
    const normalized = pathStr.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    return parts[parts.length - 1] || pathStr;
  };

  const addRecentProject = (path: string) => {
    setRecentProjects(prev => {
      const updated = [path, ...prev.filter(p => p !== path)].slice(0, 5);
      if (typeof window !== "undefined") {
        localStorage.setItem("mdteam_recent_projects", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleRemoveRecentProject = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentProjects(prev => {
      const updated = prev.filter(p => p !== path);
      if (typeof window !== "undefined") {
        localStorage.setItem("mdteam_recent_projects", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleSwitchProject = async (path: string) => {
    try {
      setTauriRootFolder(path);
      addRecentProject(path);
      setOpenTabs([]);
      setActiveFilePath("");
      setActiveFilePathB("");
      
      await rescanTauriFiles(path);
      await syncGitStatus(path);
      
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("git_pull", { repoPath: path });
        await rescanTauriFiles(path);
        await syncGitStatus(path);
      } catch (pullErr) {
        console.log("Git auto-pull skipped or failed (perhaps no remote setup):", pullErr);
      }
    } catch (e) {
      console.error("Error switching projects:", e);
      alert(language === "en" ? `Failed to switch project: ${e}` : `Fehler beim Projektwechsel: ${e}`);
    }
  };

  const openLocalFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      
      const selected = await open({
        directory: true,
        multiple: false,
        title: language === "en" ? "Select Workspace Directory" : "Projektverzeichnis auswählen"
      });
      
      if (!selected || typeof selected !== "string") return;
      
      setTauriRootFolder(selected);
      addRecentProject(selected);
      
      // Rescan and initialize if empty
      await rescanTauriFiles(selected);
      
      // Trigger native Git sync
      await syncGitStatus(selected);
      
      // Auto-pull files on folder open to fetch changes made by others
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("git_pull", { repoPath: selected });
        // Rescan again after pull to fetch newly loaded files
        await rescanTauriFiles(selected);
        await syncGitStatus(selected);
      } catch (pullErr) {
        console.log("Git auto-pull skipped or failed (perhaps no remote setup):", pullErr);
      }
      
    } catch (e) {
      console.error("Error opening local folder:", e);
      alert(language === "en" ? `Failed to load directory: ${e}` : `Fehler beim Laden des Verzeichnisses: ${e}`);
    }
  };


  const handleGitPull = async () => {
    if (!tauriRootFolder) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("git_pull", { repoPath: tauriRootFolder });
      alert(language === "en" ? "Pull successful!" : "Pull erfolgreich!");
      await rescanTauriFiles();
      await syncGitStatus();
    } catch (e: any) {
      console.error("Git pull failed:", e);
      alert(language === "en" ? `Git pull failed: ${e}` : `Git-Pull fehlgeschlagen: ${e}`);
    }
  };

  // Synchronize changes to local disk in Tauri Mode
  useEffect(() => {
    if (!tauriRootFolder) return;
    
    let isMounted = true;
    
    const saveToDisk = async () => {
      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        for (const file of files) {
          if (!isMounted) return;
          const absPath = `${tauriRootFolder}/${file.path}`;
          await writeTextFile(absPath, file.content);
        }
        
        if (isMounted) {
          await syncGitStatus();
        }
      } catch (e) {
        console.error("Error synchronizing files to disk:", e);
      }
    };
    
    const handler = setTimeout(saveToDisk, 1000); // 1-second debounce
    return () => {
      isMounted = false;
      clearTimeout(handler);
    };
  }, [files, tauriRootFolder]);

  const filesRef = useRef<WorkspaceFile[]>(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const isAgileFile = (path: string): boolean => {
    if (!path) return false;
    const cleanPath = path.toLowerCase().replace(/\\/g, '/');
    return (
      cleanPath === "management/sprint-backlog.md" ||
      cleanPath === "management/capacity.md" ||
      cleanPath === "management/roadmap.md" ||
      cleanPath === "management/burndown.md" ||
      cleanPath.includes("definition-of-") ||
      cleanPath.includes("retro")
    );
  };

  useEffect(() => {
    if (!activeFilePath.endsWith(".md")) {
      setEditorMode("code");
    }
  }, [activeFilePath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowCheatsheetModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Create File/Folder inputs toggle states
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>("");
  const [newFileCategory, setNewFileCategory] = useState<string>("arc42");

  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [newFolderParent, setNewFolderParent] = useState<string>("none");
  
  // Git states
  const [modifiedFiles, setModifiedFiles] = useState<{ [path: string]: boolean }>({});
  const [commitMessage, setCommitMessage] = useState<string>("");

  // Branch states
  const [activeBranch, setActiveBranch] = useState<string>("main");
  const [branchFiles, setBranchFiles] = useState<{ [branch: string]: WorkspaceFile[] }>({
    main: INITIAL_FILES,
    "feature/auth-strategy": INITIAL_FILES.map(f => f.path === "adrs/ADR-0001-auth-strategy.md" ? { ...f, content: f.content + "\n\n## Update\n*   [ ] LDAP Konfiguration validieren.\n" } : f)
  });
  const [showBranchMenu, setShowBranchMenu] = useState<boolean>(false);

  // Linter states
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [showProblemsPanel, setShowProblemsPanel] = useState<boolean>(false);

  // Split editor states
  const [splitActive, setSplitActive] = useState<boolean>(false);
  const [activeFilePathB, setActiveFilePathB] = useState<string>("");
  const [openTabsB, setOpenTabsB] = useState<string[]>([]);
  const [activeEditorPane, setActiveEditorPane] = useState<'A' | 'B'>('A');
  const editorRefB = useRef<any>(null);
  const monacoRefB = useRef<any>(null);

  // Diff states
  const [diffTargetFile, setDiffTargetFile] = useState<string | null>(null);

  // Yjs real-time sync manager for Editor A
  useEffect(() => {
    if (yjsStatus !== "connected" || !yjsUrl || !activeFilePath || !editorAInstance) {
      return;
    }

    let providerA: any = null;
    let bindingA: any = null;
    let docA: any = null;

    const setupSync = async () => {
      try {
        const Y = await import("yjs");
        const { WebsocketProvider } = await import("y-websocket");
        const { MonacoBinding } = await import("y-monaco");

        const model = editorAInstance.getModel();
        if (model) {
          docA = new Y.Doc();
          const roomName = `mdteam-room-${activeFilePath.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
          providerA = new WebsocketProvider(yjsUrl, roomName, docA);
          const ytext = docA.getText("monaco");

          const localContent = filesRef.current.find(f => f.path === activeFilePath)?.content || "";
          providerA.on('sync', (isSynced: boolean) => {
            if (isSynced && ytext.toString() === "" && localContent !== "") {
              docA.transact(() => {
                ytext.insert(0, localContent);
              });
            }
          });

          bindingA = new MonacoBinding(
            ytext,
            model,
            new Set([editorAInstance]),
            providerA.awareness
          );
        }
      } catch (err) {
        console.error("Yjs setup failed:", err);
      }
    };

    setupSync();

    return () => {
      if (bindingA) bindingA.destroy();
      if (providerA) providerA.destroy();
      if (docA) docA.destroy();
    };
  }, [activeFilePath, yjsStatus, yjsUrl, editorAInstance]);

  // Yjs real-time sync manager for Editor B (Split Editor)
  useEffect(() => {
    if (yjsStatus !== "connected" || !yjsUrl || !splitActive || !activeFilePathB || !editorBInstance) {
      return;
    }

    let providerB: any = null;
    let bindingB: any = null;
    let docB: any = null;

    const setupSyncB = async () => {
      try {
        const Y = await import("yjs");
        const { WebsocketProvider } = await import("y-websocket");
        const { MonacoBinding } = await import("y-monaco");

        const model = editorBInstance.getModel();
        if (model) {
          docB = new Y.Doc();
          const roomName = `mdteam-room-${activeFilePathB.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
          providerB = new WebsocketProvider(yjsUrl, roomName, docB);
          const ytext = docB.getText("monaco");

          const localContent = filesRef.current.find(f => f.path === activeFilePathB)?.content || "";
          providerB.on('sync', (isSynced: boolean) => {
            if (isSynced && ytext.toString() === "" && localContent !== "") {
              docB.transact(() => {
                ytext.insert(0, localContent);
              });
            }
          });

          bindingB = new MonacoBinding(
            ytext,
            model,
            new Set([editorBInstance]),
            providerB.awareness
          );
        }
      } catch (err) {
        console.error("Yjs B setup failed:", err);
      }
    };

    setupSyncB();

    return () => {
      if (bindingB) bindingB.destroy();
      if (providerB) providerB.destroy();
      if (docB) docB.destroy();
    };
  }, [activeFilePathB, yjsStatus, yjsUrl, splitActive, editorBInstance]);
  
  // Export state
  const [exportScope, setExportScope] = useState<"single" | "book">("single");

  // Yjs collaborators presence simulation
  const [collaborators, setCollaborators] = useState([
    { name: "Bob Dev", color: "#ef4444", activeFile: "arc42/01_introduction_goals.md", cursorLine: 12 },
    { name: "Alice Arch", color: "#10b981", activeFile: "arc42/02_constraints.md", cursorLine: 5 }
  ]);
  const [commits, setCommits] = useState<Commit[]>([
    {
      hash: "a4f89d2",
      message: "Initialisiert arc42 Struktur und erste Architekturkonzepte",
      author: "Max Mustermann",
      date: "03.06.2026 15:30",
      files: ["arc42/01_introduction_goals.md", "arc42/02_constraints.md"]
    }
  ]);
  
  // Auth settings states
  const [authStrategy, setAuthStrategy] = useState<string>("keycloak");
  const [ldapUrl, setLdapUrl] = useState<string>("ldap://company-directory.local:389");
  const [keycloakUrl, setKeycloakUrl] = useState<string>("https://keycloak.company-internal.de/auth");
  const [gitProvider, setGitProvider] = useState<string>("gitlab-selfhosted");
  const [gitUrl, setGitUrl] = useState<string>("https://gitlab.company-internal.de/mdteam/arc42-docs.git");


  // Export states
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx" | "html">("pdf");
  
  // Meeting Assistant selection
  const [startCommit, setStartCommit] = useState<string>("a4f89d2");
  const [endCommit, setEndCommit] = useState<string>("current");
  const [generatedMeetingText, setGeneratedMeetingText] = useState<string>("");

  const activeFile = files.find(f => f.path === activeFilePath) || files[0];

  // Helper to update file contents
  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;
    setFiles(prev => prev.map(f => f.path === activeFilePath ? { ...f, content: value } : f));
    
    // Mark file as modified
    setModifiedFiles(prev => ({ ...prev, [activeFilePath]: true }));
  };

  // Open a file tab
  const handleOpenFile = (path: string) => {
    setActiveFilePath(path);
    if (!openTabs.includes(path)) {
      setOpenTabs(prev => [...prev, path]);
    }
  };

  // Close a file tab
  const handleCloseTab = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(t => t !== path);
    setOpenTabs(newTabs);
    if (activeFilePath === path && newTabs.length > 0) {
      setActiveFilePath(newTabs[newTabs.length - 1]);
    }
  };

  // Close a file tab in pane B
  const handleCloseTabB = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const newTabs = openTabsB.filter(t => t !== path);
    setOpenTabsB(newTabs);
    if (activeFilePathB === path && newTabs.length > 0) {
      setActiveFilePathB(newTabs[newTabs.length - 1]);
    } else if (newTabs.length === 0) {
      setSplitActive(false);
    }
  };

  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    
    let name = newFileName.trim();
    if (!name.endsWith(".md")) {
      name += ".md";
    }

    const path = `${newFileCategory}/${name}`;
    
    if (files.some(f => f.path === path)) {
      alert("Eine Datei mit diesem Namen existiert bereits!");
      return;
    }

    const newFile: WorkspaceFile = {
      path,
      name,
      category: newFileCategory,
      content: `# ${name.replace(".md", "")}\n\nInhalt hier eingeben...\n`
    };

    setFiles(prev => [...prev, newFile]);
    handleOpenFile(path);
    
    // Mark as modified/added for Git
    setModifiedFiles(prev => ({ ...prev, [path]: true }));

    // Reset state
    setNewFileName("");
    setShowNewFileModal(false);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const cleanName = newFolderName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    
    const folderPath = newFolderParent === "none" ? cleanName : `${newFolderParent}/${cleanName}`;

    if (categories.includes(folderPath)) {
      alert("Dieser Ordner existiert bereits!");
      return;
    }

    if (tauriRootFolder) {
      import("@tauri-apps/plugin-fs").then(async ({ mkdir, exists }) => {
        try {
          const absPath = `${tauriRootFolder}/${folderPath}`;
          if (!(await exists(absPath))) {
            await mkdir(absPath, { recursive: true });
          }
        } catch (e) {
          console.error("Failed to create local folder:", folderPath, e);
        }
      });
    }

    setCategories(prev => {
      const next = [...prev, folderPath];
      return next.sort();
    });

    setNewFolderName("");
    setNewFolderParent("none");
    setShowNewFolderModal(false);
  };

  // Staging / Committing logic
  const handleCommit = async () => {
    if (!commitMessage.trim()) return;

    if (tauriRootFolder) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");

        // Check if directory is already a git repo by calling git_status
        let isGitRepo = true;
        try {
          await invoke("git_status", { repoPath: tauriRootFolder });
        } catch (e: any) {
          if (e && typeof e === "string" && e.includes("not a git repository")) {
            isGitRepo = false;
          }
        }

        if (!isGitRepo) {
          const confirmInit = window.confirm(
            language === "en"
              ? "This directory is not a Git repository. Would you like to initialize Git?"
              : "Dieses Verzeichnis ist kein Git-Repository. Möchten Sie Git initialisieren?"
          );
          if (confirmInit) {
            await invoke("git_init", { repoPath: tauriRootFolder });
            alert(
              language === "en"
                ? "Git repository successfully initialized!"
                : "Git-Repository erfolgreich initialisiert!"
            );
          } else {
            return;
          }
        }

        // 1. Perform Git commit
        await invoke("git_commit", { repoPath: tauriRootFolder, message: commitMessage });

        // 2. Perform Git push if remote configured (ignore failure if no remote set up)
        try {
          await invoke("git_push", { repoPath: tauriRootFolder });
        } catch (pushErr) {
          console.log("Git push skipped or failed (perhaps no remote is set up):", pushErr);
        }

        setCommitMessage("");
        
        // 3. Refresh Git status and history
        await syncGitStatus();

      } catch (err: any) {
        console.error("Git commit failed:", err);
        alert(language === "en" ? `Git commit failed: ${err}` : `Git-Commit fehlgeschlagen: ${err}`);
      }
    } else {
      // Browser Mock Mode
      const changedPaths = Object.keys(modifiedFiles).filter(k => modifiedFiles[k]);
      if (changedPaths.length === 0) return;

      const newCommit: Commit = {
        hash: Math.random().toString(16).substring(2, 9),
        message: commitMessage,
        author: "Entwickler (LDAP/SSO)",
        date: new Date().toLocaleString(),
        files: changedPaths
      };

      setCommits(prev => [newCommit, ...prev]);
      setModifiedFiles({});
      setCommitMessage("");
    }
  };

  // Auto-insert style block helpers into Monaco Editor
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  // Run Linter automatically when files change or language changes
  useEffect(() => {
    const diags = lintWorkspaceFiles(files, language);
    setDiagnostics(diags);
  }, [files, language]);

  // Set Monaco diagnostics squiggles in Editor A
  useEffect(() => {
    if (editorRef.current && monacoRef.current && activeFilePath) {
      const monaco = monacoRef.current;
      const model = editorRef.current.getModel();
      if (model) {
        const fileDiags = diagnostics.filter(d => d.filePath === activeFilePath);
        const markers = fileDiags.map(d => ({
          startLineNumber: d.line,
          startColumn: 1,
          endLineNumber: d.line,
          endColumn: 100,
          message: d.message,
          severity: d.severity === "error" 
            ? monaco.MarkerSeverity.Error 
            : d.severity === "warning" 
              ? monaco.MarkerSeverity.Warning 
              : monaco.MarkerSeverity.Info
        }));
        monaco.editor.setModelMarkers(model, "linter", markers);
      }
    }
  }, [diagnostics, activeFilePath, activeEditorPane]);

  // Set Monaco diagnostics squiggles in Editor B
  useEffect(() => {
    if (editorRefB.current && monacoRefB.current && activeFilePathB && splitActive) {
      const monaco = monacoRefB.current;
      const model = editorRefB.current.getModel();
      if (model) {
        const fileDiags = diagnostics.filter(d => d.filePath === activeFilePathB);
        const markers = fileDiags.map(d => ({
          startLineNumber: d.line,
          startColumn: 1,
          endLineNumber: d.line,
          endColumn: 100,
          message: d.message,
          severity: d.severity === "error" 
            ? monaco.MarkerSeverity.Error 
            : d.severity === "warning" 
              ? monaco.MarkerSeverity.Warning 
              : monaco.MarkerSeverity.Info
        }));
        monaco.editor.setModelMarkers(model, "linter", markers);
      }
    }
  }, [diagnostics, activeFilePathB, splitActive, activeEditorPane]);

  // Simulate collaborators cursors moving
  useEffect(() => {
    const interval = setInterval(() => {
      setCollaborators(prev => prev.map(c => {
        if (c.name === "Bob Dev") {
          const newLine = 4 + Math.floor(Math.random() * 14);
          return { ...c, cursorLine: newLine };
        }
        return c;
      }));
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Set decorator line marks for collaborators in Monaco Editor A
  const collabsDecorationsRef = useRef<string[]>([]);
  useEffect(() => {
    if (editorRef.current && activeFilePath) {
      const editor = editorRef.current;
      const activeCollabs = collaborators.filter(c => c.activeFile === activeFilePath);
      
      const newDecorations = activeCollabs.map(collab => ({
        range: { startLineNumber: collab.cursorLine, startColumn: 1, endLineNumber: collab.cursorLine, endColumn: 2 },
        options: {
          className: `collab-cursor-${collab.name.replace(/\s+/g, "")}`,
          hoverMessage: { value: `${collab.name} editiert hier` }
        }
      }));

      collabsDecorationsRef.current = editor.deltaDecorations(collabsDecorationsRef.current, newDecorations);
    }
  }, [activeFilePath, collaborators]);

  // Set decorator line marks for collaborators in Monaco Editor B
  const collabsDecorationsRefB = useRef<string[]>([]);
  useEffect(() => {
    if (editorRefB.current && activeFilePathB && splitActive) {
      const editor = editorRefB.current;
      const activeCollabs = collaborators.filter(c => c.activeFile === activeFilePathB);
      
      const newDecorations = activeCollabs.map(collab => ({
        range: { startLineNumber: collab.cursorLine, startColumn: 1, endLineNumber: collab.cursorLine, endColumn: 2 },
        options: {
          className: `collab-cursor-${collab.name.replace(/\s+/g, "")}`,
          hoverMessage: { value: `${collab.name} editiert hier` }
        }
      }));

      collabsDecorationsRefB.current = editor.deltaDecorations(collabsDecorationsRefB.current, newDecorations);
    }
  }, [activeFilePathB, collaborators, splitActive]);

  // Switch Branch
  const handleSwitchBranch = (branchName: string) => {
    setBranchFiles(prev => ({
      ...prev,
      [activeBranch]: files
    }));
    const targetFiles = branchFiles[branchName] || INITIAL_FILES;
    setFiles(targetFiles);
    setActiveBranch(branchName);
    setModifiedFiles({});
  };

  // Create Branch
  const handleCreateBranch = () => {
    const name = prompt("Name des neuen Branches:");
    if (!name) return;
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, "-");
    setBranchFiles(prev => ({
      ...prev,
      [activeBranch]: files,
      [cleanName]: files
    }));
    setActiveBranch(cleanName);
    setModifiedFiles({});
  };

  // Split Active Tab activation helper
  useEffect(() => {
    if (splitActive && !activeFilePathB) {
      const secondTab = openTabs.find(t => t !== activeFilePath) || activeFilePath;
      setActiveFilePathB(secondTab);
      setOpenTabsB([secondTab]);
    }
  }, [splitActive]);

  // Open file in Editor B tabs
  const handleOpenFileB = (path: string) => {
    setActiveFilePathB(path);
    if (!openTabsB.includes(path)) {
      setOpenTabsB(prev => [...prev, path]);
    }
  };

  const insertText = (text: string) => {
    const activeRef = activeEditorPane === 'A' ? editorRef : editorRefB;
    if (activeRef.current) {
      const selection = activeRef.current.getSelection();
      const id = { major: 1, minor: 1 };
      const textEdit = { identifier: id, range: selection, text: text, forceMoveMarkers: true };
      activeRef.current.executeEdits("my-source", [textEdit]);
    }
  };

  // Handle auto-completion styled block insertion
  const insertTemplateBlock = (type: string) => {
    switch (type) {
      case "adr":
        insertText(`\n# ADR-XXXX: [Titel der Entscheidung]\n\n---\ntitle: "ADR-XXXX: [Titel]"\nstatus: "accepted"\nmilestone: "Architektur-Entscheidungen"\nstart_date: "${new Date().toISOString().split('T')[0]}"\nend_date: "${new Date().toISOString().split('T')[0]}"\nassignee: "Lead Architect"\ncolor: "#10b981"\n---\n\n## Status\n==Akzeptiert== (Zuvor: ~~vorgeschlagen~~)\n\n## Kontext\n[Kontext beschreiben...]\n\n## Entscheidung\n[Entscheidung beschreiben...]\n\n## Konsequenzen\n* [x] [Konsequenz 1]\n* [ ] [Konsequenz 2]\n\n<details>\n<summary>Weitere Diskussionspunkte & Notizen</summary>\n\n*   Alternative A wurde wegen Latenz verworfen.\n*   Alternative B war zu teuer.\n</details>\n`);
        break;
      case "table":
        insertText(`\n| Header 1 | Header 2 | Header 3 |\n| :--- | :--- | :--- |\n| Zelle 1 | Zelle 2 | Zelle 3 |\n`);
        break;
      case "mermaid":
        insertText(`\n\`\`\`mermaid\ngraph TD\n    A[Start] --> B(Prozess)\n    B --> C{Entscheidung}\n    C -->|Ja| D[Ergebnis A]\n    C -->|Nein| E[Ergebnis B]\n\`\`\`\n`);
        break;
      case "drawio":
        insertText(`\n\`\`\`drawio\nhttps://viewer.diagrams.net/?chrome=0&lightbox=1#Uhttps%3A%2F%2Fraw.githubusercontent.com%2Fjgraph%2Fdrawio-diagrams%2Fmaster%2Fdocs%2F3d.xml\n\`\`\`\n`);
        break;
      case "todo":
        insertText(`\n- [ ] Offene Aufgabe (Zuständig: @name, Fälligkeit: YYYY-MM-DD)\n`);
        break;
      case "backlog":
        insertText(`\n- [ ] TODO: OAuth2-Verbindung in Keycloak testen @developer-a\n- [/] IN-PROGRESS: Yjs-Kollaborationsserver deployen @developer-b\n- [x] DONE: Monaco Autocomplete-Provider einrichten @developer-b\n`);
        break;
      case "blocker":
        insertText(`\n- [ ] BLOCKED: LDAP-Port 389 ist in der Firewall gesperrt @scrummaster\n`);
        break;
      case "burndown":
        insertText(`\n| Tag | Ideal-Linie | Restaufwand (Tatsächlich) |\n| :-- | :---------- | :------------------------ |\n| 1   | 60          | 60                        |\n| 2   | 50          | 55                        |\n| 3   | 40          | 42                        |\n| 4   | 30          | 38                        |\n| 5   | 20          | 20                        |\n| 6   | 10          | 12                        |\n| 7   | 0           | 0                         |\n`);
        break;
      case "roadmap-item":
        insertText(`\n---\ntitle: "Neues Feature / Task"\nstatus: "pending"\nmilestone: "M2: Core Features"\nstart_date: "${new Date().toISOString().split('T')[0]}"\nend_date: "${new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]}"\nassignee: "Developer A"\ncolor: "#3b82f6"\n---\n`);
        break;
      case "bold":
        insertText(`**fett gedruckter Text**`);
        break;
      case "italic":
        insertText(`*kursiver Text*`);
        break;
      case "bullet-list":
        insertText(`\n- Listenpunkt 1\n- Listenpunkt 2\n`);
        break;
      case "ordered-list":
        insertText(`\n1. Erster Punkt\n2. Zweiter Punkt\n`);
        break;
      case "code-block":
        insertText(`\n\`\`\`javascript\n// Code hier einfügen\nconsole.log("Hello World");\n\`\`\`\n`);
        break;
      case "quote":
        insertText(`\n> Hier steht ein Zitat oder Hinweis-Block\n`);
        break;
      case "horizontal-rule":
        insertText(`\n---\n`);
        break;
      case "link":
        insertText(`[Link Beschreibung](https://example.com)`);
        break;
      case "image":
        insertText(`![Bildbeschreibung](https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop)`);
        break;
      case "details":
        insertText(`\n<details>\n<summary>Details einblenden</summary>\n\nZusätzlicher Inhalt...\n</details>\n`);
        break;
      case "reference":
        insertText(`\n@[arc42/02_constraints.md#L4-L8]\n`);
        break;
      case "highlight":
        insertText(`==Hervorgehobener Text==`);
        break;
      case "strikethrough":
        insertText(`~~Durchgestrichener Text~~`);
        break;
    }
  };

  const parseInlineMarkdown = (text: string) => {
    const tokenRegex = /(!)?\[(.*?)\]\((.*?)\)/g;
    const segments: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    tokenRegex.lastIndex = 0;
    let keyIdx = 0;

    while ((match = tokenRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        segments.push(
          <span key={`text-${keyIdx++}`} dangerouslySetInnerHTML={{ __html: formatInlineMarkdownText(text.substring(lastIndex, matchIndex)) }} />
        );
      }

      const isImage = match[1] === "!";
      const linkText = match[2];
      const linkUrl = match[3];

      if (isImage) {
        if (linkUrl.includes("diagrams.net") || linkUrl.includes("draw.io")) {
          segments.push(
            <iframe 
              key={`drawio-${keyIdx++}`} 
              src={linkUrl} 
              title={linkText || "Draw.io Diagram"}
              style={{ width: '100%', height: '400px', border: '1px solid var(--border-color)', borderRadius: '8px', margin: '12px 0', backgroundColor: '#ffffff' }}
            />
          );
        } else {
          segments.push(
            <img 
              key={`img-${keyIdx++}`} 
              src={linkUrl} 
              alt={linkText} 
              style={{ maxWidth: '100%', height: 'auto', borderRadius: '6px', margin: '8px 0', display: 'block' }} 
            />
          );
        }
      } else if (linkUrl.startsWith("file:///") || linkUrl.includes(".md") || linkUrl.startsWith("#L")) {
        let cleanPath = linkUrl.replace("file:///", "");
        let filePath = "";
        let hash = "";

        if (cleanPath.startsWith("#L")) {
          filePath = activeFilePath;
          hash = cleanPath;
        } else {
          const parts = cleanPath.split("#");
          filePath = parts[0];
          hash = parts[1] || "";
        }

        const lineRange = hash && hash.startsWith("L") ? hash.substring(1) : "";

        segments.push(
          <a 
            key={`link-${keyIdx++}`} 
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleOpenFile(filePath);
              if (lineRange && editorRef.current) {
                setTimeout(() => {
                  if (editorRef.current) {
                    const parts = lineRange.split("-");
                    const startLine = parseInt(parts[0]);
                    const endLine = parts[1] ? parseInt(parts[1]) : startLine;
                    editorRef.current.revealLineInCenter(startLine);
                    editorRef.current.setSelection({
                      startLineNumber: startLine,
                      startColumn: 1,
                      endLineNumber: endLine,
                      endColumn: 100
                    });
                  }
                }, 100);
              }
            }}
            style={{ color: 'var(--accent-indigo)', textDecoration: 'underline', fontWeight: 500 }}
            title={`Öffne Datei: ${filePath}${lineRange ? ` (Zeile ${lineRange})` : ''}`}
          >
            {linkText}
          </a>
        );
      } else {
        segments.push(
          <a 
            key={`link-${keyIdx++}`} 
            href={linkUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}
          >
            {linkText}
          </a>
        );
      }
      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      segments.push(
        <span key={`text-${keyIdx++}`} dangerouslySetInnerHTML={{ __html: formatInlineMarkdownText(text.substring(lastIndex)) }} />
      );
    }

    return segments;
  };

  const formatInlineMarkdownText = (text: string) => {
    let formatted = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/__(.*?)__/g, "<strong>$1</strong>");
    formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
    formatted = formatted.replace(/_(.*?)_/g, "<em>$1</em>");
    formatted = formatted.replace(/~~(.*?)~~/g, "<del>$1</del>");
    formatted = formatted.replace(/==(.*?)==/g, "<mark style='background-color: rgba(99, 102, 241, 0.3); color: var(--text-primary); padding: 0 4px; border-radius: 3px;'>$1</mark>");
    formatted = formatted.replace(/`(.*?)`/g, "<code>$1</code>");
    return formatted;
  };

  // Markdown parser to convert markdown structure into HTML React Preview
  const parseMarkdown = (markdown: string) => {
    const lines = markdown.split("\n");
    const elements: React.ReactNode[] = [];
    
    let inYamlBlock = false;
    let yamlLines: string[] = [];

    let inDetails = false;
    let detailsSummary = "";
    let detailsContent: string[] = [];

    let inCode = false;
    let codeType = "";
    let accumulatedCode = "";
    
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];

    let listType: 'ul' | 'ol' | null = null;
    let listItems: React.ReactNode[] = [];

    const flushList = (key: string | number) => {
      if (listType && listItems.length > 0) {
        const items = [...listItems];
        const type = listType;
        listType = null;
        listItems = [];
        if (type === 'ul') {
          elements.push(
            <ul key={`ul-${key}`} style={{ marginBottom: '16px', paddingLeft: '20px', listStyleType: 'disc' }}>
              {items}
            </ul>
          );
        } else {
          elements.push(
            <ol key={`ol-${key}`} style={{ marginBottom: '16px', paddingLeft: '20px', listStyleType: 'decimal' }}>
              {items}
            </ol>
          );
        }
      }
    };

    const flushTable = (key: string | number) => {
      if (tableHeaders.length > 0) {
        const headers = [...tableHeaders];
        const rows = [...tableRows];
        tableHeaders = [];
        tableRows = [];
        elements.push(
          <table key={`table-${key}`}>
            <thead>
              <tr>
                {headers.map((h, i) => <th key={i}>{parseInlineMarkdown(h)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => <td key={cIdx}>{parseInlineMarkdown(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Details Block check
      if (trimmed.startsWith("<details>")) {
        flushList(i);
        flushTable(i);
        inDetails = true;
        detailsSummary = "";
        detailsContent = [];
        continue;
      }
      
      if (inDetails) {
        if (trimmed.startsWith("</details>")) {
          inDetails = false;
          const summaryText = detailsSummary;
          const contentText = detailsContent.join("\n");
          detailsSummary = "";
          detailsContent = [];
          
          elements.push(
            <details key={`details-${i}`} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', margin: '12px 0', backgroundColor: 'var(--bg-sidebar)' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, outline: 'none', color: 'var(--text-primary)' }}>
                {parseInlineMarkdown(summaryText || "Details einblenden")}
              </summary>
              <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                {parseMarkdown(contentText)}
              </div>
            </details>
          );
          continue;
        }
        
        const summaryMatch = line.match(/<summary>(.*?)<\/summary>/i);
        if (summaryMatch) {
          detailsSummary = summaryMatch[1];
        } else {
          detailsContent.push(line);
        }
        continue;
      }

      // Quoting / Reference transclusion check: @[path/to/file.md#L10-L15]
      const transclusionMatch = trimmed.match(/^@\[(.*?)(?:#(L\d+(?:-\d+)?))?\]$/i);
      if (transclusionMatch) {
        flushList(i);
        flushTable(i);
        const refPath = transclusionMatch[1];
        const hash = transclusionMatch[2] || "";
        const lineRange = hash && hash.startsWith("L") ? hash.substring(1) : "";

        // Find referenced file in state
        const refFile = files.find(f => f.path === refPath);
        let quotedContent = "";
        let displayLines = "";

        if (refFile) {
          if (lineRange) {
            const parts = lineRange.split("-");
            const startLine = parseInt(parts[0]);
            const endLine = parts[1] ? parseInt(parts[1]) : startLine;
            
            const fileLines = refFile.content.split("\n");
            quotedContent = fileLines.slice(startLine - 1, endLine).join("\n");
            displayLines = ` (Zeilen ${lineRange})`;
          } else {
            quotedContent = refFile.content;
          }
        } else {
          quotedContent = `[Referenzierte Datei nicht gefunden: ${refPath}]`;
        }

        elements.push(
          <div 
            key={`transclude-${i}`} 
            style={{ 
              borderLeft: '4px solid var(--accent-indigo)', 
              backgroundColor: 'rgba(99, 102, 241, 0.03)', 
              borderRadius: '0 6px 6px 0', 
              padding: '10px 16px', 
              margin: '16px 0',
              border: '1px solid var(--border-color)',
              borderLeftWidth: '4px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FileText size={12} />
                <span>Referenzierter Inhalt aus {refFile?.name || refPath}{displayLines}</span>
              </div>
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  handleOpenFile(refPath);
                  if (lineRange && editorRef.current) {
                    setTimeout(() => {
                      if (editorRef.current) {
                        const parts = lineRange.split("-");
                        const startLine = parseInt(parts[0]);
                        const endLine = parts[1] ? parseInt(parts[1]) : startLine;
                        editorRef.current.revealLineInCenter(startLine);
                        editorRef.current.setSelection({
                          startLineNumber: startLine,
                          startColumn: 1,
                          endLineNumber: endLine,
                          endColumn: 100
                        });
                      }
                    }, 100);
                  }
                }}
                style={{ color: 'var(--accent-indigo)', textDecoration: 'underline' }}
              >
                Inhalt öffnen
              </a>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)' }}>
              {quotedContent}
            </div>
          </div>
        );
        continue;
      }

      // YAML Block Checking
      if (trimmed === "---" && !inCode) {
        if (inYamlBlock) {
          inYamlBlock = false;
          const data: Record<string, string> = {};
          yamlLines.forEach(l => {
            const pts = l.split(":");
            if (pts.length >= 2) {
              const k = pts[0].trim();
              const v = pts.slice(1).join(":").trim().replace(/"/g, "").replace(/'/g, "");
              data[k] = v;
            }
          });

          if (Object.keys(data).length > 0) {
            const statusColors: Record<string, { bg: string, text: string }> = {
              completed: { bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--accent-green)' },
              'in-progress': { bg: 'rgba(59, 130, 246, 0.15)', text: 'var(--accent-blue)' },
              pending: { bg: 'rgba(107, 114, 128, 0.15)', text: 'var(--text-muted)' }
            };
            const currentStatus = (data.status || 'pending').toLowerCase();
            const colors = data.color 
              ? { bg: `color-mix(in srgb, ${data.color.trim()} 15%, transparent)`, text: data.color.trim() }
              : (statusColors[currentStatus] || statusColors.pending);

            elements.push(
              <div 
                key={`yaml-card-${i}`} 
                style={{ 
                  border: '1px solid var(--border-color)', 
                  borderLeft: `4px solid ${colors.text}`,
                  borderRadius: '8px', 
                  padding: '12px 16px', 
                  backgroundColor: 'var(--bg-sidebar)', 
                  margin: '16px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--accent-indigo)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <Calendar size={12} />
                    <span>Meilenstein / Roadmap-Daten</span>
                  </div>
                  <span 
                    style={{ 
                      fontSize: '9px', 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      fontWeight: 700,
                      backgroundColor: colors.bg,
                      color: colors.text
                    }}
                  >
                    {currentStatus.toUpperCase()}
                  </span>
                </div>
                {data.title && (
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {data.title}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {data.milestone && (
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Meilenstein:</span> {data.milestone}
                    </div>
                  )}
                  {data.assignee && (
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Zuständig:</span> {data.assignee}
                    </div>
                  )}
                  {data.start_date && data.end_date && (
                    <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Zeitraum:</span> 
                      <span style={{ fontWeight: 500 }}>{data.start_date}</span>
                      <ArrowRight size={12} style={{ color: 'var(--text-muted)', margin: '0 4px' }} />
                      <span style={{ fontWeight: 500 }}>{data.end_date}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          continue;
        }

        // If not in a YAML block, check if this is the start of one
        let isYaml = false;
        let matchIndex = -1;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === "---") {
            matchIndex = j;
            break;
          }
        }
        
        if (matchIndex !== -1) {
          isYaml = true;
          for (let j = i + 1; j < matchIndex; j++) {
            const midLine = lines[j].trim();
            if (midLine !== "" && !midLine.includes(":") && !midLine.startsWith("-")) {
              isYaml = false;
              break;
            }
          }
        }

        if (isYaml) {
          flushList(i);
          flushTable(i);
          inYamlBlock = true;
          yamlLines = [];
          continue;
        }
      }

      if (inYamlBlock) {
        yamlLines.push(line);
        continue;
      }

      // Code Block Toggle
      if (trimmed.startsWith("```")) {
        flushList(i);
        flushTable(i);
        if (inCode) {
          inCode = false;
          const currentCode = accumulatedCode;
          const currentType = codeType;
          accumulatedCode = "";
          codeType = "";

          if (currentType === "mermaid") {
            elements.push(<MermaidElement key={`mermaid-${i}`} chart={currentCode} />);
          } else if (currentType === "drawio") {
            const url = currentCode.trim();
            elements.push(
              <iframe 
                key={`drawio-${i}`} 
                src={url} 
                title="Draw.io Diagram"
                style={{ width: '100%', height: '450px', border: '1px solid var(--border-color)', borderRadius: '8px', margin: '16px 0', backgroundColor: '#ffffff' }}
              />
            );
          } else {
            elements.push(
              <pre key={`code-${i}`}>
                <code>{currentCode}</code>
              </pre>
            );
          }
        } else {
          inCode = true;
          codeType = trimmed.substring(3).trim().toLowerCase();
        }
        continue;
      }

      if (inCode) {
        accumulatedCode += line + "\n";
        continue;
      }

      // Horizontal Rules
      if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
        flushList(i);
        flushTable(i);
        elements.push(<hr key={`hr-${i}`} style={{ borderColor: 'var(--border-color)', margin: '20px 0' }} />);
        continue;
      }

      // Tables
      if (trimmed.startsWith("|")) {
        flushList(i);
        inTable = true;
        const cells = line.split("|").map(c => c.trim()).filter(c => c !== "");
        if (cells.every(c => c.startsWith(":") || c.startsWith("-"))) {
          continue;
        }
        if (tableHeaders.length === 0) {
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        continue;
      } else if (inTable) {
        inTable = false;
        flushTable(i);
      }

      // Headers
      const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (headerMatch) {
        flushList(i);
        flushTable(i);
        const level = headerMatch[1].length;
        const text = headerMatch[2];
        const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
        elements.push(<Tag key={i}>{parseInlineMarkdown(text)}</Tag>);
        continue;
      }

      // Checklists
      const checklistMatch = line.match(/^(\s*)[-*]\s+\[([ x])\]\s*(.*)$/i);
      if (checklistMatch) {
        flushList(i);
        flushTable(i);
        const isChecked = checklistMatch[2].toLowerCase() === "x";
        const text = checklistMatch[3];
        elements.push(
          <div className="task-list-item" key={i} style={{ paddingLeft: `${checklistMatch[1].length * 10}px` }}>
            <input type="checkbox" className="task-list-checkbox" readOnly checked={isChecked} />
            <span style={isChecked ? { textDecoration: "line-through", color: "var(--text-muted)" } : undefined}>
              {parseInlineMarkdown(text)}
            </span>
          </div>
        );
        continue;
      }

      // Unordered Lists
      if ((trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("+ ")) && !checklistMatch) {
        flushTable(i);
        if (listType !== 'ul') {
          flushList(i);
          listType = 'ul';
        }
        const content = trimmed.replace(/^[*+-]\s*/, "");
        listItems.push(<li key={`li-${i}`}>{parseInlineMarkdown(content)}</li>);
        continue;
      }

      // Ordered Lists
      const orderedListMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (orderedListMatch) {
        flushTable(i);
        if (listType !== 'ol') {
          flushList(i);
          listType = 'ol';
        }
        const content = orderedListMatch[1];
        listItems.push(<li key={`li-${i}`}>{parseInlineMarkdown(content)}</li>);
        continue;
      }

      // Blockquotes
      if (trimmed.startsWith(">")) {
        flushList(i);
        flushTable(i);
        elements.push(<blockquote key={i}>{parseInlineMarkdown(trimmed.replace(/^>\s*/, ""))}</blockquote>);
        continue;
      }

      // Empty Lines
      if (trimmed === "") {
        flushList(i);
        flushTable(i);
        elements.push(<br key={i} />);
        continue;
      }

      // Paragraph
      flushList(i);
      flushTable(i);
      elements.push(<p key={i}>{parseInlineMarkdown(line)}</p>);
    }

    flushTable("end");
    flushList("end");
    return elements;
  };

  // Register custom autocompletion (Monaco suggestion providers)
  const registerCustomCompletions = (monaco: any) => {
    if ((monaco as any).__customCompletionsRegistered) return;
    (monaco as any).__customCompletionsRegistered = true;

    monaco.languages.registerCompletionItemProvider('markdown', {
      triggerCharacters: ['@', '[', ':', '-', ' '],
      provideCompletionItems: (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        const suggestions: any[] = [];

        // 1. Transclusion links (e.g. typing '@' or '@[')
        if (textUntilPosition.endsWith('@') || textUntilPosition.endsWith('@[') || textUntilPosition.includes('@')) {
          const openBracketIdx = textUntilPosition.lastIndexOf('@[');
          const simpleAtIdx = textUntilPosition.lastIndexOf('@');
          
          if (openBracketIdx !== -1 || simpleAtIdx !== -1) {
            filesRef.current.forEach(file => {
              suggestions.push({
                label: `@[${file.path}]`,
                kind: monaco.languages.CompletionItemKind.Reference,
                insertText: openBracketIdx !== -1 ? file.path + ']' : `[${file.path}]`,
                detail: `Transklusion: Inhalt von ${file.name} einbetten`,
                documentation: {
                  value: `Fügt eine Quoting-Referenz auf die Datei \`${file.path}\` ein.`
                }
              });
            });
          }
        }

        // 2. YAML frontmatter keys & values inside '---' blocks
        const lines = model.getLinesContent();
        let inYaml = false;
        for (let i = 0; i < position.lineNumber - 1; i++) {
          if (lines[i] && lines[i].trim() === '---') {
            inYaml = !inYaml;
          }
        }

        if (inYaml) {
          const currentLine = lines[position.lineNumber - 1].trim();
          
          if (currentLine.includes('status:')) {
            suggestions.push(
              {
                label: '"completed"',
                kind: monaco.languages.CompletionItemKind.EnumMember,
                insertText: ' "completed"',
                detail: 'Meilenstein abgeschlossen'
              },
              {
                label: '"in-progress"',
                kind: monaco.languages.CompletionItemKind.EnumMember,
                insertText: ' "in-progress"',
                detail: 'Meilenstein in Bearbeitung'
              },
              {
                label: '"pending"',
                kind: monaco.languages.CompletionItemKind.EnumMember,
                insertText: ' "pending"',
                detail: 'Meilenstein ausstehend'
              }
            );
          } else {
            suggestions.push(
              {
                label: 'title',
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: 'title: "${1:Titel}"',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: 'Titel des Meilensteins'
              },
              {
                label: 'status',
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: 'status: "${1:pending}"',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: 'completed | in-progress | pending'
              },
              {
                label: 'milestone',
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: 'milestone: "${1:M1: Konzept}"',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: 'Meilenstein-Gruppe'
              },
              {
                label: 'start_date',
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: 'start_date: "${1:2026-06-01}"',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: 'Startdatum (YYYY-MM-DD)'
              },
              {
                label: 'end_date',
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: 'end_date: "${1:2026-06-15}"',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: 'Enddatum (YYYY-MM-DD)'
              },
              {
                label: 'assignee',
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: 'assignee: "${1:Name}"',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: 'Zuständige Person / Team'
              },
              {
                label: 'color',
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: 'color: "${1:#10b981}"',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: 'Eigene Statusfarbe (Hex)'
              }
            );
          }
        }

        // 3. Code block template suggestions
        if (textUntilPosition.endsWith('```')) {
          suggestions.push(
            {
              label: 'drawio',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'drawio\n\${1:https://embed.diagrams.net/?embed=1&ui=atlas&spin=1}\n```',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'Draw.io Diagramm einbetten'
            },
            {
              label: 'mermaid',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'mermaid\ngraph TD\n    A[Start] --> B[Ziel]\n```',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'Mermaid Diagramm'
            }
          );
        }

        // 4. Agile Backlog and Blocker Prefix suggestions
        if (textUntilPosition.endsWith('-') || textUntilPosition.endsWith('- ')) {
          suggestions.push(
            {
              label: '[ ] TODO: ...',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '[ ] TODO: ${1:Aufgabe} @${2:assignee}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'Neue offene Backlog-Aufgabe'
            },
            {
              label: '[/] IN-PROGRESS: ...',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '[/] IN-PROGRESS: ${1:Aufgabe} @${2:assignee}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'Aufgabe in Bearbeitung'
            },
            {
              label: '[x] DONE: ...',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '[x] DONE: ${1:Aufgabe} @${2:assignee}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'Erledigte Aufgabe'
            },
            {
              label: '[ ] BLOCKED: ...',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '[ ] BLOCKED: ${1:Blocker-Beschreibung} @scrummaster',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'Neuer Blocker (Impediment)'
            }
          );
        }

        return { suggestions };
      }
    });
  };

  // Parser to extract dynamic Roadmap Tasks from roadmap.md YAML blocks
  const getRoadmapItems = (): RoadmapItem[] => {
    const roadmapFile = files.find(f => f.path === "management/roadmap.md");
    if (!roadmapFile) return [];

    const rawContent = roadmapFile.content;
    const blocks = rawContent.split("---");
    const items: RoadmapItem[] = [];

    blocks.forEach(block => {
      if (!block.includes("title:") || !block.includes("status:")) return;
      
      const lines = block.split("\n");
      const item: Partial<RoadmapItem> = {};
      
      lines.forEach(line => {
        const parts = line.split(":");
        if (parts.length < 2) return;
        const key = parts[0].trim();
        const value = parts.slice(1).join(":").trim().replace(/"/g, "").replace(/'/g, "");
        
        if (key === "title") item.title = value;
        if (key === "status") item.status = value as any;
        if (key === "milestone") item.milestone = value;
        if (key === "start_date") item.start_date = value;
        if (key === "end_date") item.end_date = value;
        if (key === "assignee") item.assignee = value;
        if (key === "color") item.color = value;
      });

      if (item.title && item.status) {
        items.push(item as RoadmapItem);
      }
    });

    return items;
  };

  // Parser to extract Sprint Backlog tasks from sprint-backlog.md
  const getBacklogItems = (): BacklogItem[] => {
    const backlogFile = files.find(f => f.path === "management/sprint-backlog.md");
    if (!backlogFile) return [];

    const items: BacklogItem[] = [];
    const lines = backlogFile.content.split("\n");
    
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("- [")) return;
      
      const statusChar = trimmed.substring(3, 4); // ' ', '/', or 'x'
      let status: 'todo' | 'in-progress' | 'done' = 'todo';
      if (statusChar === '/') status = 'in-progress';
      if (statusChar === 'x' || statusChar === 'X') status = 'done';
      
      let text = trimmed.substring(6).trim();
      
      if (text.toUpperCase().startsWith("TODO:")) text = text.substring(5).trim();
      else if (text.toUpperCase().startsWith("IN-PROGRESS:")) text = text.substring(12).trim();
      else if (text.toUpperCase().startsWith("DONE:")) text = text.substring(5).trim();
      
      const assigneeMatch = text.match(/@([a-zA-Z0-9_-]+)$/);
      let assignee = "Unassigned";
      if (assigneeMatch) {
        assignee = `@${assigneeMatch[1]}`;
        text = text.replace(/@([a-zA-Z0-9_-]+)$/, "").trim();
      }
      
      items.push({
        id: `backlog-${idx}`,
        title: text,
        status,
        assignee
      });
    });
    
    return items;
  };

  // Parser to extract Burndown chart data points from burndown.md table
  const getBurndownData = (): BurndownDataPoint[] => {
    const burndownFile = files.find(f => f.path === "management/burndown.md");
    if (!burndownFile) return [];

    const data: BurndownDataPoint[] = [];
    const lines = burndownFile.content.split("\n");
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|") || trimmed.includes("Tag") || trimmed.includes("Day") || trimmed.includes("---") || trimmed.includes(":---")) return;
      
      const cols = trimmed.split("|").map(c => c.trim()).filter(Boolean);
      if (cols.length < 2) return;
      
      const day = cols[0];
      const ideal = parseFloat(cols[1]);
      const actualVal = cols[2] ? parseFloat(cols[2]) : null;
      
      if (!isNaN(ideal)) {
        data.push({
          day: `Day ${day.replace(/^(Tag|Day)\s+/i, "")}`,
          ideal,
          actual: isNaN(actualVal as any) || actualVal === null ? null : actualVal
        });
      }
    });
    
    return data;
  };

  // Parser to aggregate blocked tasks across meetings and retros
  const getImpedimentItems = (): ImpedimentItem[] => {
    const impediments: ImpedimentItem[] = [];
    
    files.forEach(file => {
      if (file.category !== "meetings" && !file.path.startsWith("meetings/")) return;
      
      const lines = file.content.split("\n");
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("- [ ] BLOCKED:") || trimmed.startsWith("- [ ] BLOCKER:")) {
          let text = trimmed.startsWith("- [ ] BLOCKED:") 
            ? trimmed.substring(14).trim() 
            : trimmed.substring(14).trim();
            
          const assigneeMatch = text.match(/@([a-zA-Z0-9_-]+)$/);
          let assignee = "Unassigned";
          if (assigneeMatch) {
            assignee = `@${assigneeMatch[1]}`;
            text = text.replace(/@([a-zA-Z0-9_-]+)$/, "").trim();
          }
          
          impediments.push({
            filePath: file.path,
            fileName: file.name,
            line: idx + 1,
            title: text,
            assignee
          });
        }
      });
    });
    
    return impediments;
  };

  // Parser to extract velocity data from capacity.md
  interface VelocityItem {
    sprint: string;
    planned: number;
    actual: number;
  }

  const getVelocityData = (): VelocityItem[] => {
    const capacityFile = files.find(f => f.path === "management/capacity.md");
    if (!capacityFile) return [];

    const data: VelocityItem[] = [];
    const lines = capacityFile.content.split("\n");
    let inVelocitySection = false;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith("## Historische Velocity") || trimmed.startsWith("## Historical Velocity")) {
        inVelocitySection = true;
        return;
      }
      if (trimmed.startsWith("## Team-Kapazität") || trimmed.startsWith("## Team Capacity")) {
        inVelocitySection = false;
        return;
      }

      if (inVelocitySection && trimmed.startsWith("|") && !trimmed.includes("Sprint") && !trimmed.includes("---")) {
        const cols = trimmed.split("|").map(c => c.trim()).filter(Boolean);
        if (cols.length >= 3) {
          const sprint = cols[0];
          const planned = parseFloat(cols[1]);
          const actual = parseFloat(cols[2]);
          if (!isNaN(planned) && !isNaN(actual)) {
            data.push({ sprint, planned, actual });
          }
        }
      }
    });

    return data;
  };

  // Parser to extract capacity data from capacity.md
  interface CapacityItem {
    member: string;
    days: number;
    focus: number;
    capacity: number;
  }

  const getCapacityData = (): CapacityItem[] => {
    const capacityFile = files.find(f => f.path === "management/capacity.md");
    if (!capacityFile) return [];

    const data: CapacityItem[] = [];
    const lines = capacityFile.content.split("\n");
    let inCapacitySection = false;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith("## Team-Kapazität") || trimmed.startsWith("## Team Capacity")) {
        inCapacitySection = true;
        return;
      }
      if (trimmed.startsWith("## Historische Velocity") || trimmed.startsWith("## Historical Velocity")) {
        inCapacitySection = false;
        return;
      }

      if (inCapacitySection && trimmed.startsWith("|") && !trimmed.includes("Teammitglied") && !trimmed.includes("Team Member") && !trimmed.includes("---")) {
        const cols = trimmed.split("|").map(c => c.trim()).filter(Boolean);
        if (cols.length >= 4) {
          const member = cols[0];
          const days = parseFloat(cols[1]);
          const focus = parseFloat(cols[2]);
          const capacity = parseFloat(cols[3]);
          if (!isNaN(days) && !isNaN(focus) && !isNaN(capacity)) {
            data.push({ member, days, focus, capacity });
          }
        }
      }
    });

    return data;
  };

  // Parser to extract Retro Sticky Notes from retro file
  interface RetroNote {
    type: 'glad' | 'sad' | 'impediment';
    text: string;
  }

  const getRetroNotesForFile = (filePath: string): RetroNote[] => {
    const retroFile = files.find(f => f.path === filePath);
    if (!retroFile) return [];

    const notes: RetroNote[] = [];
    const lines = retroFile.content.split("\n");
    let currentType: 'glad' | 'sad' | 'impediment' | null = null;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.includes("1. Was lief gut?") || trimmed.includes("(Glad)")) {
        currentType = 'glad';
        return;
      }
      if (trimmed.includes("2. Was lief nicht gut?") || trimmed.includes("(Sad)")) {
        currentType = 'sad';
        return;
      }
      if (trimmed.includes("3. Impediments / Blocker Log") || trimmed.includes("Blocker Log") || trimmed.includes("(Blocker)")) {
        currentType = 'impediment';
        return;
      }
      if (trimmed.startsWith("##")) {
        currentType = null;
        return;
      }

      if (currentType && (trimmed.startsWith("*") || trimmed.startsWith("-"))) {
        let text = trimmed.replace(/^[*+-]\s*/, "");
        if (currentType === 'impediment') {
          text = text.replace(/^\[[ x]\]\s*(BLOCKED:|BLOCKER:)?\s*/i, "");
        }
        notes.push({ type: currentType, text });
      }
    });

    return notes;
  };

  const getRetroNotes = (): RetroNote[] => {
    return getRetroNotesForFile("meetings/2026-06-03_retro.md");
  };

  // Save/serialize visual backlog items back to sprint-backlog.md
  const saveBacklogItems = (items: BacklogItem[]) => {
    let content = `# Sprint Backlog\n\nSprint-Aufgaben des Teams. Bearbeiten Sie die Aufgabenliste unten, um das Kanban-Board im Dashboard live zu aktualisieren.\n\n## Aufgaben\n\n`;
    items.forEach(item => {
      const statusChar = item.status === 'done' ? 'x' : item.status === 'in-progress' ? '/' : ' ';
      const prefix = item.status === 'done' ? 'DONE' : item.status === 'in-progress' ? 'IN-PROGRESS' : 'TODO';
      content += `- [${statusChar}] ${prefix}: ${item.title} ${item.assignee}\n`;
    });
    setFiles(prev => prev.map(f => f.path === "management/sprint-backlog.md" ? { ...f, content } : f));
    setModifiedFiles(prev => ({ ...prev, ["management/sprint-backlog.md"]: true }));
  };

  // Save/serialize capacity data back to capacity.md
  const saveCapacityData = (velocity: VelocityItem[], capacity: CapacityItem[]) => {
    let content = `# Sprint-Kapazität & Velocity\n\nHistorische Velocity und aktuelle Teamberechnungen.\n\n## Historische Velocity\n\n| Sprint | Geplant (Story Points) | Erreicht (Story Points) |\n| :----- | :--------------------- | :---------------------- |\n`;
    velocity.forEach(v => {
      content += `| ${v.sprint} | ${v.planned} | ${v.actual} |\n`;
    });
    content += `\n## Team-Kapazität (Aktueller Sprint)\n\n| Teammitglied | Verfügbare Tage | Fokus-Faktor | Kapazität (SP) |\n| :----------- | :-------------- | :----------- | :------------- |\n`;
    capacity.forEach(c => {
      content += `| ${c.member} | ${c.days} | ${c.focus} | ${c.capacity.toFixed(1)} |\n`;
    });
    setFiles(prev => prev.map(f => f.path === "management/capacity.md" ? { ...f, content } : f));
    setModifiedFiles(prev => ({ ...prev, ["management/capacity.md"]: true }));
  };

  // Save/serialize roadmap items back to roadmap.md
  const saveRoadmapItems = (items: RoadmapItem[]) => {
    let content = `# Projekt-Roadmap & Meilensteine\n\nPMs nutzen dieses Dokument, um Meilensteine zu überwachen. Ändern Sie die YAML-Blöcke unten, um die Timeline im Dashboard live zu aktualisieren.\n\n`;
    items.forEach(item => {
      content += `---\ntitle: "${item.title}"\nstatus: "${item.status}"\nmilestone: "${item.milestone}"\nstart_date: "${item.start_date}"\nend_date: "${item.end_date}"\nassignee: "${item.assignee}"\n`;
      if (item.color) {
        content += `color: "${item.color}"\n`;
      }
      content += `---\n\n`;
    });
    setFiles(prev => prev.map(f => f.path === "management/roadmap.md" ? { ...f, content } : f));
    setModifiedFiles(prev => ({ ...prev, ["management/roadmap.md"]: true }));
  };

  // Helper interface and parser/save logic for checklists (DoD/DoR)
  interface ChecklistItem {
    checked: boolean;
    text: string;
  }

  const getChecklistData = (filePath: string): ChecklistItem[] => {
    const file = files.find(f => f.path === filePath);
    if (!file) return [];

    const items: ChecklistItem[] = [];
    const lines = file.content.split("\n");
    lines.forEach(l => {
      const trimmed = l.trim();
      if (trimmed.startsWith("*   [") || trimmed.startsWith("- [")) {
        const checked = trimmed.substring(5, 6).toLowerCase() === 'x';
        const text = trimmed.replace(/^[-*]\s+\[[ x]\]\s*/i, "").trim();
        items.push({ checked, text });
      }
    });
    return items;
  };

  const saveChecklistData = (filePath: string, title: string, desc: string, items: ChecklistItem[]) => {
    let content = `# ${title}\n\n${desc}\n\n## Kriterien\n\n`;
    items.forEach(i => {
      const char = i.checked ? 'x' : ' ';
      content += `*   [${char}] ${i.text}\n`;
    });
    setFiles(prev => prev.map(f => f.path === filePath ? { ...f, content } : f));
    setModifiedFiles(prev => ({ ...prev, [filePath]: true }));
  };

  const getChecklistMetadata = (filePath: string): { title: string; desc: string } => {
    const file = files.find(f => f.path === filePath);
    if (!file) return { title: "Checkliste", desc: "" };
    const lines = file.content.split("\n");
    let title = "Checkliste";
    let desc = "";
    
    if (lines.length > 0 && lines[0].startsWith("# ")) {
      title = lines[0].substring(2).trim();
    }
    if (lines.length > 2 && lines[2].trim()) {
      desc = lines[2].trim();
    }
    return { title, desc };
  };

  const renderBacklogForm = () => {
    const items = getBacklogItems();
    
    const handleItemChange = (index: number, field: keyof BacklogItem, value: any) => {
      const updated = [...items];
      updated[index] = { ...updated[index], [field]: value };
      saveBacklogItems(updated);
    };

    const handleAddItem = () => {
      const updated = [...items, { id: `backlog-new-${Date.now()}`, title: 'New Task', status: 'todo' as const, assignee: 'Unassigned' }];
      saveBacklogItems(updated);
    };

    const handleDeleteItem = (index: number) => {
      const updated = items.filter((_, idx) => idx !== index);
      saveBacklogItems(updated);
    };

    return (
      <div className="visual-form-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', margin: 0 }}>Sprint Backlog Editor</h3>
            <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>Manage tasks and assignments directly through this form.</p>
          </div>
          <button className="visual-add-btn" onClick={handleAddItem} style={{ padding: '8px 14px', fontSize: '13px' }}>
            <Plus size={14} /> Add Task
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map((item, idx) => (
            <div 
              key={item.id || idx} 
              style={{ 
                display: 'flex', 
                gap: '12px', 
                alignItems: 'center', 
                backgroundColor: 'var(--bg-panel)', 
                padding: '12px 16px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <select 
                value={item.status} 
                onChange={(e) => handleItemChange(idx, 'status', e.target.value as any)}
                style={{ 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  backgroundColor: 'var(--bg-editor)', 
                  border: '1px solid var(--border-color)', 
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  width: '140px',
                  outline: 'none'
                }}
              >
                <option value="todo">TODO</option>
                <option value="in-progress">IN PROGRESS</option>
                <option value="done">DONE</option>
              </select>
              
              <input 
                type="text" 
                value={item.title} 
                onChange={(e) => handleItemChange(idx, 'title', e.target.value)}
                placeholder="Task description..."
                style={{ 
                  flex: 1, 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  backgroundColor: 'var(--bg-editor)', 
                  border: '1px solid var(--border-color)', 
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              
              <select
                value={item.assignee}
                onChange={(e) => handleItemChange(idx, 'assignee', e.target.value)}
                style={{ 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  backgroundColor: 'var(--bg-editor)', 
                  border: '1px solid var(--border-color)', 
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  width: '160px',
                  outline: 'none'
                }}
              >
                <option value="Unassigned">Unassigned</option>
                <option value="@developer-a">@developer-a</option>
                <option value="@developer-b">@developer-b</option>
                <option value="@scrummaster">@scrummaster</option>
              </select>

              <button 
                onClick={() => handleDeleteItem(idx)}
                className="visual-delete-btn"
                style={{ width: '34px', height: '34px', minWidth: '34px', padding: 0 }}
                title="Delete Task"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-panel)' }}>
              No tasks available. Add a new task using the button on the top right.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCapacityForm = () => {
    const velocity = getVelocityData();
    const capacity = getCapacityData();

    const handleVelocityChange = (index: number, field: keyof VelocityItem, value: any) => {
      const updatedVelocity = [...velocity];
      updatedVelocity[index] = { ...updatedVelocity[index], [field]: value };
      saveCapacityData(updatedVelocity, capacity);
    };

    const handleCapacityChange = (index: number, field: keyof CapacityItem, value: any) => {
      const updatedCapacity = [...capacity];
      const item = { ...updatedCapacity[index], [field]: value };
      if (field === 'days' || field === 'focus') {
        item.capacity = Number(item.days) * Number(item.focus);
      }
      updatedCapacity[index] = item;
      saveCapacityData(velocity, updatedCapacity);
    };

    const handleAddVelocity = () => {
      const nextSprintNum = velocity.length + 1;
      const updatedVelocity = [...velocity, { sprint: `Sprint ${nextSprintNum}`, planned: 0, actual: 0 }];
      saveCapacityData(updatedVelocity, capacity);
    };

    const handleDeleteVelocity = (index: number) => {
      const updatedVelocity = velocity.filter((_, idx) => idx !== index);
      saveCapacityData(updatedVelocity, capacity);
    };

    const handleAddCapacity = () => {
      const updatedCapacity = [...capacity, { member: '@new-member', days: 10, focus: 0.8, capacity: 8.0 }];
      saveCapacityData(velocity, updatedCapacity);
    };

    const handleDeleteCapacity = (index: number) => {
      const updatedCapacity = capacity.filter((_, idx) => idx !== index);
      saveCapacityData(velocity, updatedCapacity);
    };

    return (
      <div className="visual-form-container" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', margin: 0 }}>Historical Velocity</h3>
              <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>Adjust planned and actual Story Points of past sprints.</p>
            </div>
            <button className="visual-add-btn" onClick={handleAddVelocity} style={{ padding: '8px 14px', fontSize: '13px' }}>
              <Plus size={14} /> Add Sprint
            </button>
          </div>
          <table className="visual-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Sprint Name</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Planned (SP)</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Actual (SP)</th>
                <th style={{ padding: '12px', textAlign: 'center', width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {velocity.map((v, idx) => (
                <tr key={idx} style={{ borderBottom: idx < velocity.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                  <td style={{ padding: '12px' }}>
                    <input 
                      type="text" 
                      value={v.sprint} 
                      onChange={(e) => handleVelocityChange(idx, 'sprint', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '100%', maxWidth: '200px', outline: 'none' }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input 
                      type="number" 
                      value={v.planned} 
                      onChange={(e) => handleVelocityChange(idx, 'planned', parseFloat(e.target.value) || 0)}
                      style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '120px', outline: 'none' }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input 
                      type="number" 
                      value={v.actual} 
                      onChange={(e) => handleVelocityChange(idx, 'actual', parseFloat(e.target.value) || 0)}
                      style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '120px', outline: 'none' }}
                    />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDeleteVelocity(idx)}
                      className="visual-delete-btn"
                      style={{ width: '32px', height: '32px', display: 'inline-flex', padding: 0 }}
                      title="Delete Sprint"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {velocity.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No velocity data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', margin: 0 }}>Team Capacity (Current Sprint)</h3>
              <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>Story points calculation based on available days and focus factor.</p>
            </div>
            <button className="visual-add-btn" onClick={handleAddCapacity} style={{ padding: '8px 14px', fontSize: '13px' }}>
              <Plus size={14} /> Add Member
            </button>
          </div>
          <table className="visual-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Member</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Available Days</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Focus Factor</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Capacity (SP)</th>
                <th style={{ padding: '12px', textAlign: 'center', width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {capacity.map((c, idx) => (
                <tr key={idx} style={{ borderBottom: idx < capacity.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                  <td style={{ padding: '12px' }}>
                    <input 
                      type="text" 
                      value={c.member} 
                      onChange={(e) => handleCapacityChange(idx, 'member', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '100%', maxWidth: '200px', outline: 'none' }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input 
                      type="number" 
                      step="0.5"
                      value={c.days} 
                      onChange={(e) => handleCapacityChange(idx, 'days', parseFloat(e.target.value) || 0)}
                      style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '100px', outline: 'none' }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="1"
                      value={c.focus} 
                      onChange={(e) => handleCapacityChange(idx, 'focus', parseFloat(e.target.value) || 0)}
                      style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '100px', outline: 'none' }}
                    />
                  </td>
                  <td style={{ padding: '12px', fontWeight: 600, color: 'var(--accent-green)', fontSize: '14px' }}>
                    {c.capacity.toFixed(1)} SP
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDeleteCapacity(idx)}
                      className="visual-delete-btn"
                      style={{ width: '32px', height: '32px', display: 'inline-flex', padding: 0 }}
                      title="Delete Member"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {capacity.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No capacity data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderRoadmapForm = () => {
    const items = getRoadmapItems();

    const handleItemChange = (index: number, field: keyof RoadmapItem, value: any) => {
      const updated = [...items];
      updated[index] = { ...updated[index], [field]: value };
      saveRoadmapItems(updated);
    };

    const handleAddItem = () => {
      const updated = [...items, {
        title: 'New Milestone',
        status: 'pending' as const,
        milestone: 'M: Milestone',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        assignee: 'Unassigned',
        color: '#6366f1'
      }];
      saveRoadmapItems(updated);
    };

    const handleDeleteItem = (index: number) => {
      const updated = items.filter((_, idx) => idx !== index);
      saveRoadmapItems(updated);
    };

    return (
      <div className="visual-form-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', margin: 0 }}>Roadmap & Milestones</h3>
            <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>Plan project phases and assign them to owners.</p>
          </div>
          <button className="visual-add-btn" onClick={handleAddItem} style={{ padding: '8px 14px', fontSize: '13px' }}>
            <Plus size={14} /> Add Milestone
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {items.map((item, idx) => (
            <div 
              key={idx} 
              className="visual-card-milestone"
              style={{ 
                backgroundColor: 'var(--bg-panel)', 
                borderRadius: '8px', 
                padding: '16px', 
                border: `1px solid ${item.color || 'var(--border-color)'}`,
                borderLeft: `5px solid ${item.color || 'var(--accent-indigo)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  value={item.title} 
                  onChange={(e) => handleItemChange(idx, 'title', e.target.value)}
                  placeholder="Milestone Title..."
                  style={{ flex: 1, padding: '6px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '13px', outline: 'none' }}
                />
                <button 
                  onClick={() => handleDeleteItem(idx)}
                  className="visual-delete-btn"
                  style={{ width: '28px', height: '28px', padding: 0 }}
                  title="Delete Milestone"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</label>
                  <select 
                    value={item.status} 
                    onChange={(e) => handleItemChange(idx, 'status', e.target.value as any)}
                    style={{ padding: '6px', borderRadius: '4px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Milestone</label>
                  <input 
                    type="text" 
                    value={item.milestone} 
                    onChange={(e) => handleItemChange(idx, 'milestone', e.target.value)}
                    placeholder="e.g. M1"
                    style={{ padding: '6px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Start</label>
                  <input 
                    type="date" 
                    value={item.start_date} 
                    onChange={(e) => handleItemChange(idx, 'start_date', e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>End</label>
                  <input 
                    type="date" 
                    value={item.end_date} 
                    onChange={(e) => handleItemChange(idx, 'end_date', e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Assignee</label>
                  <input 
                    type="text" 
                    value={item.assignee} 
                    onChange={(e) => handleItemChange(idx, 'assignee', e.target.value)}
                    placeholder="Name/Role..."
                    style={{ padding: '6px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Color</label>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input 
                      type="color" 
                      value={item.color || '#6366f1'} 
                      onChange={(e) => handleItemChange(idx, 'color', e.target.value)}
                      style={{ border: 'none', background: 'transparent', width: '28px', height: '28px', cursor: 'pointer', padding: 0 }}
                    />
                    <input 
                      type="text" 
                      value={item.color || ''} 
                      onChange={(e) => handleItemChange(idx, 'color', e.target.value)}
                      placeholder="#hex"
                      style={{ flex: 1, padding: '5px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '10px', outline: 'none', minWidth: 0 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderChecklistForm = () => {
    const items = getChecklistData(activeFilePath);
    const { title, desc } = getChecklistMetadata(activeFilePath);

    const handleItemChange = (index: number, field: keyof ChecklistItem, value: any) => {
      const updated = [...items];
      updated[index] = { ...updated[index], [field]: value };
      saveChecklistData(activeFilePath, title, desc, updated);
    };

    const handleAddItem = () => {
      const updated = [...items, { checked: false, text: 'New Criterion' }];
      saveChecklistData(activeFilePath, title, desc, updated);
    };

    const handleDeleteItem = (index: number) => {
      const updated = items.filter((_, idx) => idx !== index);
      saveChecklistData(activeFilePath, title, desc, updated);
    };

    const completedCount = items.filter(i => i.checked).length;
    const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

    return (
      <div className="visual-form-container">
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '6px' }}>{title}</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{desc}</p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px' }}>
            <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: 'var(--accent-green)', transition: 'width 0.3s ease' }}></div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '40px', textAlign: 'right' }}>
              {completedCount}/{items.length} ({progressPercent}%)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Checklist Criteria</span>
          <button className="visual-add-btn" onClick={handleAddItem} style={{ padding: '6px 12px', fontSize: '12px' }}>
            <Plus size={14} /> Add Criterion
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item, idx) => (
            <div 
              key={idx} 
              style={{ 
                display: 'flex', 
                gap: '12px', 
                alignItems: 'center', 
                backgroundColor: 'var(--bg-panel)', 
                padding: '10px 14px', 
                borderRadius: '6px', 
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <input 
                type="checkbox" 
                checked={item.checked} 
                onChange={(e) => handleItemChange(idx, 'checked', e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-indigo)' }}
              />
              <input 
                type="text" 
                value={item.text} 
                onChange={(e) => handleItemChange(idx, 'text', e.target.value)}
                placeholder="Enter quality criterion..."
                style={{ 
                  flex: 1, 
                  padding: '6px 10px', 
                  borderRadius: '4px', 
                  backgroundColor: 'var(--bg-editor)', 
                  border: '1px solid var(--border-color)', 
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  textDecoration: item.checked ? 'line-through' : 'none',
                  opacity: item.checked ? 0.6 : 1,
                  transition: 'opacity 0.2s, text-decoration 0.2s'
                }}
              />
              <button 
                onClick={() => handleDeleteItem(idx)}
                className="visual-delete-btn"
                style={{ width: '30px', height: '30px', padding: 0 }}
                title="Delete Criterion"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-panel)' }}>
              No criteria available. Click "+ Add Criterion".
            </div>
          )}
        </div>
      </div>
    );
  };

  const saveBurndownData = (data: BurndownDataPoint[]) => {
    let content = `# Sprint Burndown Metrics\n\nDaily tracking of remaining efforts (Story Points). Change the table below to update the burndown chart in the dashboard live.\n\n## Sprint Data\n\n| Day | Ideal Line | Remaining Effort (Actual) |\n| :-- | :--------- | :------------------------ |\n`;
    data.forEach(d => {
      const dayNumber = d.day.replace(/^Day\s+/i, "").trim();
      const actualStr = d.actual !== null && !isNaN(d.actual) ? d.actual.toString() : "";
      content += `| ${dayNumber} | ${d.ideal} | ${actualStr} |\n`;
    });
    setFiles(prev => prev.map(f => f.path === "management/burndown.md" ? { ...f, content } : f));
    setModifiedFiles(prev => ({ ...prev, ["management/burndown.md"]: true }));
  };

  const saveRetroNotesForFile = (filePath: string, notes: RetroNote[]) => {
    const file = files.find(f => f.path === filePath);
    let title = "# Retrospective";
    if (file) {
      const firstLine = file.content.split("\n")[0];
      if (firstLine && firstLine.startsWith("# ")) {
        title = firstLine;
      }
    }
    
    let content = `${title}\n\n## 1. What went well? (Glad)\n\n`;
    notes.filter(n => n.type === 'glad').forEach(n => {
      content += `- ${n.text}\n`;
    });
    
    content += `\n## 2. What did not go well? (Sad)\n\n`;
    notes.filter(n => n.type === 'sad').forEach(n => {
      content += `- ${n.text}\n`;
    });
    
    content += `\n## 3. Impediments / Blocker Log\n\n`;
    notes.filter(n => n.type === 'impediment').forEach(n => {
      const prefix = n.text.toUpperCase().startsWith("BLOCKED:") ? "" : "BLOCKED: ";
      content += `- [ ] ${prefix}${n.text}\n`;
    });
    
    setFiles(prev => prev.map(f => f.path === filePath ? { ...f, content } : f));
    setModifiedFiles(prev => ({ ...prev, [filePath]: true }));
  };

  const renderBurndownForm = () => {
    const data = getBurndownData();

    const handleDataChange = (index: number, field: keyof BurndownDataPoint, value: any) => {
      const updated = [...data];
      updated[index] = { ...updated[index], [field]: value };
      saveBurndownData(updated);
    };

    const handleAddDay = () => {
      const nextDay = data.length + 1;
      const lastIdeal = data.length > 0 ? data[data.length - 1].ideal : 60;
      const nextIdeal = Math.max(0, lastIdeal - 10);
      const updated = [...data, { day: `Day ${nextDay}`, ideal: nextIdeal, actual: null }];
      saveBurndownData(updated);
    };

    const handleDeleteDay = (index: number) => {
      const updated = data.filter((_, idx) => idx !== index);
      const reindexed = updated.map((d, idx) => ({ ...d, day: `Day ${idx + 1}` }));
      saveBurndownData(reindexed);
    };

    return (
      <div className="visual-form-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', margin: 0 }}>Sprint Burndown Editor</h3>
            <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>Enter daily remaining efforts to update the burndown chart.</p>
          </div>
          <button className="visual-add-btn" onClick={handleAddDay} style={{ padding: '8px 14px', fontSize: '13px' }}>
            <Plus size={14} /> Add Day
          </button>
        </div>

        <table className="visual-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Sprint Day</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Ideal Value (Story Points)</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Actual Remaining Effort (Story Points)</th>
              <th style={{ padding: '12px', textAlign: 'center', width: '80px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, idx) => (
              <tr key={idx} style={{ borderBottom: idx < data.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {d.day}
                </td>
                <td style={{ padding: '12px' }}>
                  <input 
                    type="number" 
                    value={d.ideal} 
                    onChange={(e) => handleDataChange(idx, 'ideal', parseFloat(e.target.value) || 0)}
                    style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '120px', outline: 'none' }}
                  />
                </td>
                <td style={{ padding: '12px' }}>
                  <input 
                    type="number" 
                    value={d.actual === null ? "" : d.actual} 
                    onChange={(e) => {
                      const val = e.target.value;
                      handleDataChange(idx, 'actual', val === "" ? null : (parseFloat(val) || 0));
                    }}
                    placeholder="Not recorded yet"
                    style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '160px', outline: 'none' }}
                  />
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button 
                    onClick={() => handleDeleteDay(idx)}
                    className="visual-delete-btn"
                    style={{ width: '32px', height: '32px', display: 'inline-flex', padding: 0 }}
                    title="Delete Day"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No burndown data available. Click "Add Day".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderRetroForm = (filePath: string) => {
    const notes = getRetroNotesForFile(filePath);

    const handleNoteChange = (index: number, text: string) => {
      const updated = [...notes];
      updated[index] = { ...updated[index], text };
      saveRetroNotesForFile(filePath, updated);
    };

    const handleAddNote = (type: 'glad' | 'sad' | 'impediment') => {
      const text = type === 'glad' ? 'What went well...' : type === 'sad' ? 'What went wrong...' : 'Blocker...';
      const updated = [...notes, { type, text }];
      saveRetroNotesForFile(filePath, updated);
    };

    const handleDeleteNote = (index: number) => {
      const updated = notes.filter((_, idx) => idx !== index);
      saveRetroNotesForFile(filePath, updated);
    };

    const indexedNotes = notes.map((n, idx) => ({ ...n, originalIndex: idx }));
    const glads = indexedNotes.filter(n => n.type === 'glad');
    const sads = indexedNotes.filter(n => n.type === 'sad');
    const impediments = indexedNotes.filter(n => n.type === 'impediment');

    const renderColumn = (columnTitle: string, type: 'glad' | 'sad' | 'impediment', items: typeof glads, headerColor: string, bgColor: string) => {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '240px', backgroundColor: bgColor, borderRadius: '8px', padding: '16px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${headerColor}`, paddingBottom: '8px', marginBottom: '8px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>{columnTitle} ({items.length})</span>
            <button className="action-icon-btn" onClick={() => handleAddNote(type)} title="Add Card" style={{ color: headerColor }}>
              <Plus size={16} />
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', minHeight: '300px' }}>
            {items.map((item) => (
              <div 
                key={item.originalIndex}
                style={{ 
                  backgroundColor: 'var(--bg-panel)', 
                  borderLeft: `4px solid ${headerColor}`, 
                  borderRadius: '6px', 
                  padding: '12px', 
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative'
                }}
              >
                <textarea 
                  value={item.text} 
                  onChange={(e) => handleNoteChange(item.originalIndex, e.target.value)}
                  style={{ 
                    width: '100%', 
                    background: 'transparent', 
                    border: 'none', 
                    color: 'var(--text-primary)', 
                    fontFamily: 'var(--font-sans)', 
                    fontSize: '13px', 
                    resize: 'none', 
                    outline: 'none',
                    height: '60px'
                  }}
                  placeholder="Write a note..."
                />
                
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => handleDeleteNote(item.originalIndex)}
                    className="visual-delete-btn"
                    style={{ width: '24px', height: '24px', padding: 0 }}
                    title="Delete Note"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                No entries
              </div>
            )}
          </div>
        </div>
      );
    };

    const file = files.find(f => f.path === filePath);
    const retroTitle = file ? (file.content.split("\n")[0] || "# Retrospective").replace("# ", "") : "Retrospective";

    return (
      <div className="visual-form-container">
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', margin: 0 }}>{retroTitle}</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Conduct the sprint retrospective directly on this interactive sticky-note board.</p>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {renderColumn("1. What went well? (Glad)", "glad", glads, "var(--accent-green)", "rgba(16, 185, 129, 0.01)")}
          {renderColumn("2. What did not go well? (Sad)", "sad", sads, "var(--accent-red)", "rgba(239, 68, 68, 0.01)")}
          {renderColumn("3. Impediments / Blocker Log", "impediment", impediments, "var(--accent-yellow)", "rgba(245, 158, 11, 0.01)")}
        </div>
      </div>
    );
  };

  interface GenericBlock {
    type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'list';
    content: string;
    listType?: 'unordered' | 'ordered' | 'todo';
    listItems?: { checked: boolean; text: string }[];
  }

  const parseGenericMarkdown = (content: string): GenericBlock[] => {
    const lines = content.split("\n");
    const blocks: GenericBlock[] = [];
    let currentBlock: GenericBlock | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === "") {
        if (currentBlock && currentBlock.type === 'paragraph') {
          blocks.push(currentBlock);
          currentBlock = null;
        }
        continue;
      }

      // Headers
      if (trimmed.startsWith("# ")) {
        if (currentBlock) blocks.push(currentBlock);
        blocks.push({ type: 'h1', content: trimmed.substring(2).trim() });
        currentBlock = null;
        continue;
      }
      if (trimmed.startsWith("## ")) {
        if (currentBlock) blocks.push(currentBlock);
        blocks.push({ type: 'h2', content: trimmed.substring(3).trim() });
        currentBlock = null;
        continue;
      }
      if (trimmed.startsWith("### ")) {
        if (currentBlock) blocks.push(currentBlock);
        blocks.push({ type: 'h3', content: trimmed.substring(4).trim() });
        currentBlock = null;
        continue;
      }

      // Checklists
      if (trimmed.startsWith("*   [") || trimmed.startsWith("- [")) {
        if (currentBlock && (currentBlock.type !== 'list' || currentBlock.listType !== 'todo')) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
        const checked = trimmed.includes("[x]") || trimmed.includes("[X]");
        const text = trimmed.replace(/^[-*]\s+\[[ xX]\]\s*/, "").trim();
        
        if (!currentBlock) {
          currentBlock = { type: 'list', listType: 'todo', content: '', listItems: [{ checked, text }] };
        } else {
          currentBlock.listItems?.push({ checked, text });
        }
        continue;
      }

      // Bullet lists
      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        if (currentBlock && (currentBlock.type !== 'list' || currentBlock.listType !== 'unordered')) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
        const text = trimmed.replace(/^[-*]\s+/, "").trim();
        
        if (!currentBlock) {
          currentBlock = { type: 'list', listType: 'unordered', content: '', listItems: [{ checked: false, text }] };
        } else {
          currentBlock.listItems?.push({ checked: false, text });
        }
        continue;
      }

      // Ordered lists
      const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (orderedMatch) {
        if (currentBlock && (currentBlock.type !== 'list' || currentBlock.listType !== 'ordered')) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
        const text = orderedMatch[2].trim();
        
        if (!currentBlock) {
          currentBlock = { type: 'list', listType: 'ordered', content: '', listItems: [{ checked: false, text }] };
        } else {
          currentBlock.listItems?.push({ checked: false, text });
        }
        continue;
      }

      // Standard text / paragraph
      if (!currentBlock) {
        currentBlock = { type: 'paragraph', content: trimmed };
      } else if (currentBlock.type === 'paragraph') {
        currentBlock.content += "\n" + trimmed;
      } else {
        blocks.push(currentBlock);
        currentBlock = { type: 'paragraph', content: trimmed };
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    return blocks;
  };

  const saveGenericMarkdown = (filePath: string, blocks: GenericBlock[]) => {
    let content = "";
    blocks.forEach((block, idx) => {
      if (block.type === 'h1') {
        content += `# ${block.content}\n\n`;
      } else if (block.type === 'h2') {
        content += `## ${block.content}\n\n`;
      } else if (block.type === 'h3') {
        content += `### ${block.content}\n\n`;
      } else if (block.type === 'paragraph') {
        content += `${block.content}\n\n`;
      } else if (block.type === 'list') {
        block.listItems?.forEach((item, lIdx) => {
          if (block.listType === 'todo') {
            const char = item.checked ? 'x' : ' ';
            content += `*   [${char}] ${item.text}\n`;
          } else if (block.listType === 'unordered') {
            content += `* ${item.text}\n`;
          } else if (block.listType === 'ordered') {
            content += `${lIdx + 1}. ${item.text}\n`;
          }
        });
        content += "\n";
      }
    });

    content = content.trim() + "\n";
    
    setFiles(prev => prev.map(f => f.path === filePath ? { ...f, content } : f));
    setModifiedFiles(prev => ({ ...prev, [filePath]: true }));
  };

  const renderGenericVisualEditor = (filePath: string) => {
    const blocks = parseGenericMarkdown(files.find(f => f.path === filePath)?.content || "");

    const handleBlockChange = (index: number, field: 'content' | 'listItems', value: any) => {
      const updated = [...blocks];
      updated[index] = { ...updated[index], [field]: value } as any;
      saveGenericMarkdown(filePath, updated);
    };

    const handleAddBlock = (type: 'h2' | 'paragraph' | 'todo') => {
      const newBlock: GenericBlock = {
        type: type === 'todo' ? 'list' : type,
        content: type === 'todo' ? '' : 'New text...',
        listType: type === 'todo' ? 'todo' : undefined,
        listItems: type === 'todo' ? [{ checked: false, text: 'New Item' }] : undefined
      };
      saveGenericMarkdown(filePath, [...blocks, newBlock]);
    };

    const handleDeleteBlock = (index: number) => {
      const updated = blocks.filter((_, idx) => idx !== index);
      saveGenericMarkdown(filePath, updated);
    };

    const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= blocks.length) return;
      
      const updated = [...blocks];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      saveGenericMarkdown(filePath, updated);
    };

    return (
      <div className="visual-form-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', margin: 0 }}>Visual Document Editor</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Edit headings, paragraphs and lists structured in blocks.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {blocks.map((block, idx) => {
            return (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  backgroundColor: 'var(--bg-panel)', 
                  padding: '14px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-color)',
                  position: 'relative'
                }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {block.type === 'h1' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--accent-indigo)', fontWeight: 'bold' }}>MAIN TITLE (H1)</span>
                      <input 
                        type="text" 
                        value={block.content} 
                        onChange={(e) => handleBlockChange(idx, 'content', e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '20px', fontWeight: 'bold', outline: 'none' }}
                      />
                    </div>
                  )}
                  {block.type === 'h2' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--accent-indigo)', fontWeight: 'bold' }}>SECTION HEADING (H2)</span>
                      <input 
                        type="text" 
                        value={block.content} 
                        onChange={(e) => handleBlockChange(idx, 'content', e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '16px', fontWeight: 'bold', outline: 'none' }}
                      />
                    </div>
                  )}
                  {block.type === 'h3' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--accent-indigo)', fontWeight: 'bold' }}>SUBHEADING (H3)</span>
                      <input 
                        type="text" 
                        value={block.content} 
                        onChange={(e) => handleBlockChange(idx, 'content', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 'bold', outline: 'none' }}
                      />
                    </div>
                  )}
                  {block.type === 'paragraph' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>PARAGRAPH (TEXT)</span>
                      <textarea 
                        value={block.content} 
                        onChange={(e) => handleBlockChange(idx, 'content', e.target.value)}
                        style={{ width: '100%', minHeight: '80px', padding: '10px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.5, resize: 'vertical', outline: 'none', fontFamily: 'var(--font-sans)' }}
                      />
                    </div>
                  )}
                  {block.type === 'list' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                        LIST ({block.listType === 'todo' ? 'Checklist' : block.listType === 'ordered' ? 'Numbered List' : 'Bullet List'})
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {block.listItems?.map((item, lIdx) => (
                          <div key={lIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {block.listType === 'todo' && (
                              <input 
                                type="checkbox" 
                                checked={item.checked} 
                                onChange={(e) => {
                                  const updatedItems = [...(block.listItems || [])];
                                  updatedItems[lIdx] = { ...item, checked: e.target.checked };
                                  handleBlockChange(idx, 'listItems', updatedItems);
                                }}
                                style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                              />
                            )}
                            {block.listType === 'ordered' && (
                              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', width: '20px' }}>{lIdx + 1}.</span>
                            )}
                            {block.listType === 'unordered' && (
                              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', width: '12px' }}>•</span>
                            )}
                            <input 
                              type="text" 
                              value={item.text} 
                              onChange={(e) => {
                                const updatedItems = [...(block.listItems || [])];
                                updatedItems[lIdx] = { ...item, text: e.target.value };
                                handleBlockChange(idx, 'listItems', updatedItems);
                              }}
                              style={{ flex: 1, padding: '5px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                            />
                            <button 
                              onClick={() => {
                                const updatedItems = block.listItems?.filter((_, lIndex) => lIndex !== lIdx) || [];
                                if (updatedItems.length === 0) {
                                  handleDeleteBlock(idx);
                                } else {
                                  handleBlockChange(idx, 'listItems', updatedItems);
                                }
                              }}
                              style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center' }}
                              title="Remove Line"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={() => {
                          const updatedItems = [...(block.listItems || []), { checked: false, text: 'New Element' }];
                          handleBlockChange(idx, 'listItems', updatedItems);
                        }}
                        className="git-btn" 
                        style={{ alignSelf: 'flex-start', padding: '4px 8px', fontSize: '11px', marginTop: '4px' }}
                      >
                        + Add Line
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'flex-start' }}>
                  <button 
                    onClick={() => handleMoveBlock(idx, 'up')}
                    disabled={idx === 0}
                    className="action-icon-btn"
                    style={{ width: '28px', height: '28px', padding: 0, opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                    title="Move Block Up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button 
                    onClick={() => handleMoveBlock(idx, 'down')}
                    disabled={idx === blocks.length - 1}
                    className="action-icon-btn"
                    style={{ width: '28px', height: '28px', padding: 0, opacity: idx === blocks.length - 1 ? 0.3 : 1, cursor: idx === blocks.length - 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronDown size={14} />
                  </button>
                  {block.type !== 'h1' && (
                    <button 
                      onClick={() => handleDeleteBlock(idx)}
                      className="visual-delete-btn"
                      style={{ width: '28px', height: '28px', padding: 0, marginTop: '4px' }}
                      title="Delete Block"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <button className="visual-add-btn" onClick={() => handleAddBlock('paragraph')} style={{ padding: '8px 14px', fontSize: '13px' }}>
            <Plus size={14} /> + Add Paragraph
          </button>
          <button className="visual-add-btn" onClick={() => handleAddBlock('h2')} style={{ padding: '8px 14px', fontSize: '13px', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
            <Plus size={14} /> + Add Heading
          </button>
          <button className="visual-add-btn" onClick={() => handleAddBlock('todo')} style={{ padding: '8px 14px', fontSize: '13px', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
            <Plus size={14} /> + Add Checklist
          </button>
        </div>
      </div>
    );
  };

  const renderVisualEditor = () => {
    const cleanPath = activeFilePath.toLowerCase().replace(/\\/g, '/');
    if (cleanPath.endsWith("sprint-backlog.md")) {
      return renderBacklogForm();
    } else if (cleanPath.endsWith("capacity.md")) {
      return renderCapacityForm();
    } else if (cleanPath.endsWith("roadmap.md")) {
      return renderRoadmapForm();
    } else if (cleanPath.endsWith("burndown.md")) {
      return renderBurndownForm();
    } else if (cleanPath.includes("definition-of-")) {
      return renderChecklistForm();
    } else if (cleanPath.includes("retro")) {
      return renderRetroForm(activeFilePath);
    } else {
      return renderGenericVisualEditor(activeFilePath);
    }
  };

  // Generate meeting minute template based on diff commits
  const handleGenerateMeeting = async () => {
    const changesList: string[] = [];

    if (tauriRootFolder) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const diffOutput = await invoke<string>("git_diff_files", {
          repoPath: tauriRootFolder,
          startCommit: startCommit,
          endCommit: endCommit
        });

        const lines = diffOutput.split("\n").filter(l => l.trim() !== "");
        lines.forEach(line => {
          if (line.length >= 2) {
            const parts = line.split(/\s+/);
            const status = parts[0];
            let filepath = parts.slice(1).join(" ").trim();
            if (filepath.startsWith('"') && filepath.endsWith('"')) {
              filepath = filepath.substring(1, filepath.length - 1);
            }
            filepath = filepath.replace(/\\/g, "/");

            const statusLabel = status === "A"
              ? (language === "en" ? "[ADDED]" : "[HINZUGEFÜGT]")
              : status === "D"
                ? (language === "en" ? "[DELETED]" : "[GELÖSCHT]")
                : (language === "en" ? "[MODIFIED]" : "[GEÄNDERT]");

            changesList.push(`*   **${statusLabel}** \`${filepath}\``);
          }
        });
      } catch (err) {
        console.error("Failed to generate meeting diff natively:", err);
      }
    } else {
      // Browser Mock Mode
      files.forEach(f => {
        if (modifiedFiles[f.path]) {
          const label = language === "en" ? "[MODIFIED]" : "[GEÄNDERT]";
          changesList.push(`*   **${label}** [${f.name}](file:///${f.path})`);
        }
      });
    }

    if (changesList.length === 0) {
      changesList.push(
        language === "en"
          ? `*   *No files changed between selected checkpoints.*`
          : `*   *Keine Dateiveränderungen im ausgewählten Bereich.*`
      );
    }

    const meetingContent = language === "en"
      ? `# Meeting Minutes - ${new Date().toLocaleDateString("en-US")}

## 1. Attendees
*   [ ] Development Team
*   [ ] Product Owner / Stakeholder

## 2. Status since sync-checkpoint (${startCommit})
### Changed Documents:
${changesList.join("\n")}

### Architecture Decision Records (ADRs):
*   No new ADRs found in selected commit range.

### Roadmaps & Milestones:
*   Project timeline milestones visualised in dashboard.

## 3. Discussion Points & Decisions
*   [ ] Decision 1...
*   [ ] Decision 2...

## 4. Next Steps
*   [ ] Define next action item...
`
      : `# Meeting Minutes - ${new Date().toLocaleDateString("de-DE")}

## 1. Teilnehmer
*   [ ] Entwickler-Team
*   [ ] Product Owner / Stakeholder

## 2. Status seit letztem Sync-Checkpoint (${startCommit})
### Geänderte Dokumente:
${changesList.join("\n")}

### Getroffene Architekturentscheidungen (ADRs):
*   Keine neuen ADRs im ausgewählten Commit-Bereich.

### Aktuelle Meilensteine:
*   Meilensteine aus der Roadmap wurden im Dashboard visualisiert.

## 3. Besprochene Themen & Beschlüsse
*   [ ] Beschluss 1...
*   [ ] Beschluss 2...

## 4. Nächste Schritte
*   [ ] Nächste Aufgabe definieren...
`;

    setGeneratedMeetingText(meetingContent);
  };

  // Add the generated meeting template to the workspace tree
  const saveGeneratedMeeting = () => {
    if (!generatedMeetingText) return;
    
    const fileName = `meeting_${new Date().toISOString().split('T')[0]}.md`;
    const filePath = `meetings/${fileName}`;

    const newFile: WorkspaceFile = {
      path: filePath,
      name: fileName,
      category: "meetings",
      content: generatedMeetingText
    };

    setFiles(prev => [...prev, newFile]);
    handleOpenFile(filePath);
    setActivePanel("explorer");
    setGeneratedMeetingText("");
  };

  // Custom visual trigger for file exports
  const triggerDownload = async (format: string, scope: "single" | "book" = "single") => {
    let content = "";
    let downloadName = "";
    
    if (scope === "book") {
      const arc42Files = files.filter(f => f.category === "arc42").sort((a, b) => a.name.localeCompare(b.name));
      let toc = "# Inhaltsverzeichnis\n\n";
      let body = "";
      
      arc42Files.forEach((f, idx) => {
        const title = f.name.replace(".md", "").replace(/^\d+_/, "").replace(/_/g, " ");
        const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1);
        toc += `${idx + 1}. [${formattedTitle}](#chapter-${idx + 1})\n`;
        body += `\n\n<a name="chapter-${idx + 1}"></a>\n` + f.content;
      });
      content = `# MDTeam arc42 Architekturdokumentation (Gesamtausgabe)\n\n${toc}\n\n${body}`;
      downloadName = `arc42_Architecture_Book.${format}`;
    } else {
      content = activeFile.content;
      downloadName = `${activeFile.name.replace('.md', '')}.${format}`;
    }

    if (format === "pdf") {
      setPrintScope(scope);
      // Wait for React to render the printable container
      setTimeout(() => {
        const printStyles = document.createElement("style");
        printStyles.id = "print-only-styles";
        printStyles.innerHTML = `
          @media print {
            body > *:not(#print-capture-container) {
              display: none !important;
            }
            #print-capture-container {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              height: auto;
              color: #000000 !important;
              background-color: #ffffff !important;
            }
            /* Style code and blocks for clean print */
            pre, code {
              background-color: #f3f4f6 !important;
              color: #1f2937 !important;
              border: 1px solid #d1d5db !important;
            }
            blockquote {
              border-left-color: #d1d5db !important;
              background-color: #f9fafb !important;
            }
          }
        `;
        document.head.appendChild(printStyles);
        window.print();
        setTimeout(() => {
          printStyles.remove();
          setPrintScope(null);
        }, 500);
      }, 200);
      setShowExportModal(false);
      return;
    }

    // HTML / MD native saving in Tauri
    if (tauriRootFolder) {
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        
        const defaultPath = downloadName;
        const filters = format === "html" 
          ? [{ name: "HTML Document", extensions: ["html"] }]
          : [{ name: "Markdown Document", extensions: ["md"] }];
          
        const selectedPath = await save({
          defaultPath,
          filters,
          title: language === "en" ? "Save Exported File" : "Exportierte Datei speichern"
        });
        
        if (selectedPath) {
          let exportContent = content;
          if (format === "html") {
            // For HTML, wrap the parsed preview container's HTML in a document structure
            const previewEl = document.querySelector(".preview-container");
            const innerHTML = previewEl ? previewEl.innerHTML : "";
            exportContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${downloadName.replace('.html', '')}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      color: #333;
    }
    pre {
      background: #f4f4f4;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
    code {
      font-family: Consolas, Monaco, monospace;
    }
    blockquote {
      border-left: 4px solid #ccc;
      margin: 0;
      padding-left: 10px;
      color: #666;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
  </style>
</head>
<body>
  ${scope === "book" ? `<h1>MDTeam arc42 Architekturdokumentation (Gesamtausgabe)</h1>` : ""}
  ${scope === "single" ? innerHTML : `<div>${innerHTML}</div>`}
</body>
</html>`;
          }
          
          await writeTextFile(selectedPath, exportContent);
          alert(language === "en" ? "Export successful!" : "Export erfolgreich!");
        }
      } catch (err) {
        console.error("Native export failed:", err);
      }
    } else {
      // Browser Download Fallback
      let exportContent = content;
      if (format === "html") {
        const previewEl = document.querySelector(".preview-container");
        const innerHTML = previewEl ? previewEl.innerHTML : "";
        exportContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Export</title></head><body>${innerHTML}</body></html>`;
      }
      
      const blob = new Blob([exportContent], { type: format === "html" ? "text/html" : "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setShowExportModal(false);
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="logo-section">
          <span className="logo-icon"><Sparkles size={18} /></span>
          <span>MDTeam Workspace</span>
          <span className="logo-badge">Git & arc42</span>
        </div>
        
        <div className="header-status">
          <div className="status-indicator">
            <span className={`status-dot ${Object.keys(modifiedFiles).length > 0 ? "syncing" : ""}`}></span>
            <span>
              {Object.keys(modifiedFiles).length > 0 
                ? `${Object.keys(modifiedFiles).length} ${t.unsavedChanges}` 
                : t.syncedWithGit}
            </span>
          </div>
          
          <div className="language-selector" style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)', marginRight: '12px' }}>
            <button 
              className={`lang-btn ${language === 'de' ? 'active' : ''}`}
              onClick={() => { setLanguage('de'); localStorage.setItem("language", 'de'); }}
              style={{
                border: 'none',
                background: language === 'de' ? 'var(--accent-indigo)' : 'none',
                color: language === 'de' ? '#ffffff' : 'var(--text-muted)',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              DE
            </button>
            <button 
              className={`lang-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => { setLanguage('en'); localStorage.setItem("language", 'en'); }}
              style={{
                border: 'none',
                background: language === 'en' ? 'var(--accent-indigo)' : 'none',
                color: language === 'en' ? '#ffffff' : 'var(--text-muted)',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              EN
            </button>
          </div>

          <div className="user-profile">
            <div className="user-avatar">JD</div>
            <span style={{ fontSize: "12px" }}>Jane Doe ({t.devRole})</span>
          </div>
        </div>
      </header>

      {/* Workspace Core Area */}
      <div className="workspace-body">
        {/* Left Side Icon Strip */}
        <div className="sidebar-strip">
          <div className="strip-group">
            <button 
              className={`strip-btn ${activePanel === "explorer" ? "active" : ""}`}
              onClick={() => setActivePanel("explorer")}
              title={t.titleExplorer}
            >
              <Folder size={20} />
            </button>

            <button 
              className={`strip-btn ${activePanel === "search" ? "active" : ""}`}
              onClick={() => setActivePanel("search")}
              title={t.titleSearch}
            >
              <Search size={20} />
            </button>
            
            <button 
              className={`strip-btn ${activePanel === "git" ? "active" : ""}`}
              onClick={() => setActivePanel("git")}
              title={t.titleGit}
            >
              <GitBranch size={20} />
            </button>

            <button 
              className={`strip-btn ${activePanel === "graph" ? "active" : ""}`}
              onClick={() => setActivePanel("graph")}
              title={t.titleGraph}
            >
              <Share2 size={20} />
            </button>

            <button 
              className={`strip-btn ${activePanel === "pm" ? "active" : ""}`}
              onClick={() => setActivePanel("pm")}
              title={t.titlePM}
            >
              <Calendar size={20} />
            </button>

            <button 
              className={`strip-btn ${activePanel === "meetings" ? "active" : ""}`}
              onClick={() => setActivePanel("meetings")}
              title={t.titleMeetings}
            >
              <Users size={20} />
            </button>
          </div>

          <button 
            className={`strip-btn ${activePanel === "cheatsheet" ? "active" : ""}`}
            onClick={() => setActivePanel("cheatsheet")}
            title={t.titleCheatsheet}
            style={{ marginBottom: '8px' }}
          >
            <HelpCircle size={20} />
          </button>

          <button 
            className={`strip-btn ${activePanel === "settings" ? "active" : ""}`}
            onClick={() => setActivePanel("settings")}
            title={t.titleSettings}
          >
            <Settings size={20} />
          </button>
        </div>

        {/* Dynamic Context Panel */}
        <aside className="context-panel">
          {activePanel === "explorer" && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t.repoExplorer}</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button 
                      className="action-icon-btn" 
                      onClick={() => setShowNewFileModal(true)} 
                      title={t.newFile}
                      style={{ padding: '2px' }}
                    >
                      <FilePlus size={14} />
                    </button>
                    <button 
                      className="action-icon-btn" 
                      onClick={() => setShowNewFolderModal(true)} 
                      title={t.newFolder}
                      style={{ padding: '2px' }}
                    >
                      <FolderPlus size={14} />
                    </button>
                  </div>
                </div>

                {isTauri && (
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <button 
                      onClick={openLocalFolder}
                      className="git-btn" 
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: 0, width: '100%', padding: '6px 12px', fontSize: '11px', fontWeight: 600 }}
                    >
                      <FolderPlus size={12} />
                      {tauriRootFolder ? (language === "en" ? "Change Workspace Folder" : "Verzeichnis wechseln") : (language === "en" ? "Open Local Folder" : "Lokalen Ordner öffnen")}
                    </button>
                    {tauriRootFolder && (
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tauriRootFolder}>
                        {language === "en" ? "Root:" : "Pfad:"} {tauriRootFolder}
                      </div>
                    )}

                    {recentProjects.length > 0 && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{language === "en" ? "Recent Projects" : "Kürzliche Projekte"}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {recentProjects.map(projPath => {
                            const isCurrent = tauriRootFolder === projPath;
                            const folderName = getFolderBasename(projPath);
                            return (
                              <div
                                key={projPath}
                                onClick={() => handleSwitchProject(projPath)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  backgroundColor: isCurrent ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                  borderLeft: isCurrent ? '2px solid var(--accent-indigo)' : '2px solid transparent',
                                  transition: 'all 0.2s ease',
                                }}
                                className="recent-project-row"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                  <Folder size={12} style={{ color: isCurrent ? 'var(--accent-indigo)' : 'var(--text-muted)', flexShrink: 0 }} />
                                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {folderName}
                                    </span>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={projPath}>
                                      {projPath}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => handleRemoveRecentProject(projPath, e)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '2px',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'opacity 0.2s',
                                  }}
                                  className="recent-project-delete-btn"
                                  title={language === "en" ? "Remove from history" : "Aus Verlauf entfernen"}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="panel-content" style={{ flex: 1, overflowY: 'auto' }}>
                  {categories.map(cat => {
                    const parts = cat.split("/");
                    const depth = parts.length - 1;
                    const lastPart = parts[parts.length - 1];

                    let displayName = lastPart;
                    if (cat === "arc42") displayName = t.arc42Doc;
                    else if (cat === "adrs") displayName = t.adrsDecisions;
                    else if (cat === "management") displayName = t.mgmtRoadmaps;
                    else if (cat === "meetings") displayName = t.meetProtokolle;

                    return (
                      <React.Fragment key={cat}>
                        <div 
                          className="tree-item tree-item-folder" 
                          style={{ 
                            marginTop: cat !== categories[0] && depth === 0 ? '12px' : '0',
                            paddingLeft: `${16 + depth * 12}px`
                          }}
                        >
                          <Folder size={14} style={{ color: "var(--accent-indigo)" }} />
                          <span>{displayName}</span>
                        </div>
                        {files.filter(f => f.category === cat).map(f => (
                          <div 
                            key={f.path} 
                            className={`tree-item tree-item-file sub-item ${activeFilePath === f.path ? "selected" : ""}`}
                            onClick={() => handleOpenFile(f.path)}
                            style={{ paddingLeft: `${28 + depth * 12}px` }}
                          >
                            <FileText size={13} />
                            <span>{f.name}</span>
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Backlinks finder panel section */}
              <div style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-sidebar)', padding: '0 0 10px 0' }}>
                <div className="panel-header" style={{ height: '32px', minHeight: '32px', fontSize: '11px', display: 'flex', alignItems: 'center' }}>
                  <span>{t.backlinks} ({findBacklinks(activeFilePath, files).length})</span>
                </div>
                <div style={{ padding: '4px 16px', maxHeight: '140px', overflowY: 'auto', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {findBacklinks(activeFilePath, files).length === 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t.noBacklinks}</span>
                  ) : (
                    findBacklinks(activeFilePath, files).map(sourcePath => {
                      const srcFile = files.find(f => f.path === sourcePath);
                      return (
                        <div 
                          key={sourcePath} 
                          onClick={() => handleOpenFile(sourcePath)}
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}
                          className="backlink-item"
                        >
                          <FileText size={10} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ textDecoration: 'underline' }}>{srcFile?.name || sourcePath}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activePanel === "search" && (
            <GlobalSearch 
              files={files} 
              onSelectResult={(filePath, line) => {
                handleOpenFile(filePath);
                setTimeout(() => {
                  if (editorRef.current) {
                    editorRef.current.revealLineInCenter(line);
                    editorRef.current.setPosition({ lineNumber: line, column: 1 });
                    editorRef.current.focus();
                  }
                }, 100);
              }}
              language={language}
            />
          )}

          {activePanel === "git" && (
            <>
              <div className="panel-header">
                <span>{t.gitSourceControl}</span>
              </div>
              <div className="git-panel-content">
                <div className="git-status-section">
                  <div className="git-status-title">{t.localChanges}</div>
                  {Object.keys(modifiedFiles).filter(k => modifiedFiles[k]).length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.noChanges}</div>
                  ) : (
                    Object.keys(modifiedFiles).filter(k => modifiedFiles[k]).map(path => {
                      const fileObj = files.find(f => f.path === path);
                      return (
                        <div 
                          key={path} 
                          className="git-changed-file" 
                          onClick={() => setDiffTargetFile(path)}
                          style={{ cursor: 'pointer' }}
                          title={t.clickToDiff}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileObj?.name}</span>
                          <span className="git-change-badge modified">M</span>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="git-commit-box">
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>{t.commitMessage}</label>
                  <textarea 
                    className="git-textarea"
                    placeholder={language === 'en' ? "Feat: Add details in arc42 chapter 1..." : "Feat: Füge Details in arc42 Kapitel 1 hinzu..."}
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="git-btn"
                      disabled={Object.keys(modifiedFiles).filter(k => modifiedFiles[k]).length === 0}
                      onClick={handleCommit}
                      style={{ flex: 1 }}
                    >
                      <GitBranch size={14} /> {t.commitPush}
                    </button>
                    {isTauri && (
                      <button 
                        className="git-btn"
                        onClick={handleGitPull}
                        style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', width: 'auto', padding: '0 12px' }}
                        title={language === 'en' ? "Pull changes from remote" : "Änderungen vom Server herunterladen (Pull)"}
                      >
                        <Download size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="git-status-section" style={{ flex: 1, overflowY: 'auto' }}>
                  <div className="git-status-title">{t.commitHistory}</div>
                  {commits.map((c, i) => (
                    <div key={i} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'between', fontSize: '11px', marginBottom: '2px' }}>
                        <span style={{ color: 'var(--accent-indigo)', fontWeight: 'bold' }}>{c.hash}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{c.date}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{c.message}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{language === 'en' ? 'Author' : 'Autor'}: {c.author}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activePanel === "pm" && (
            <>
              <div className="panel-header">
                <span>{language === 'en' ? "Project Status" : "Projektstatus"}</span>
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="git-status-section">
                  <div className="git-status-title">{language === 'en' ? "Progress" : "Fortschritt"}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: 'bold', margin: '8px 0' }}>
                    <CheckCircle size={20} style={{ color: 'var(--accent-green)' }} />
                    <span>65%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '65%', height: '100%', backgroundColor: 'var(--accent-green)' }}></div>
                  </div>
                </div>

                <div className="git-status-section">
                  <div className="git-status-title">{language === 'en' ? "Document Quality" : "Dokumentenqualität"}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{language === 'en' ? "arc42 Coverage:" : "arc42 Abdeckung:"}</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--accent-green)' }}>100%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{language === 'en' ? "ADRs maintained:" : "ADRs gepflegt:"}</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--accent-blue)' }}>{language === 'en' ? "Active (1)" : "Aktiv (1)"}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{language === 'en' ? "Last Meeting:" : "Letztes Meeting:"}</span>
                      <span style={{ fontWeight: 'bold' }}>{language === 'en' ? "Today" : "Heute"}</span>
                    </div>
                  </div>
                </div>

                <button 
                  className="git-btn" 
                  onClick={() => { setActivePanel("pm"); triggerDownload("pdf", "book"); }}
                  style={{ backgroundColor: 'var(--accent-blue)' }}
                >
                  <FileDown size={14} /> {language === 'en' ? "Export Report" : "Report exportieren"}
                </button>
              </div>
            </>
          )}

          {activePanel === "meetings" && (
            <>
              <div className="panel-header">
                <span>{language === 'en' ? "Meeting Configurator" : "Meeting-Konfigurator"}</span>
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="settings-group">
                  <label className="settings-label">{language === 'en' ? "Last Status (Start-Commit)" : "Letzter Stand (Start-Commit)"}</label>
                  <select 
                    className="settings-select"
                    value={startCommit}
                    onChange={(e) => setStartCommit(e.target.value)}
                  >
                    {commits.map(c => (
                      <option key={c.hash} value={c.hash}>{c.hash} - {c.message.substring(0, 15)}...</option>
                    ))}
                  </select>
                </div>

                <div className="settings-group">
                  <label className="settings-label">{language === 'en' ? "Current Status" : "Aktueller Stand"}</label>
                  <select 
                    className="settings-select"
                    value={endCommit}
                    onChange={(e) => setEndCommit(e.target.value)}
                  >
                    <option value="current">{language === 'en' ? "Now (Local changes)" : "Jetzt (Lokale Änderungen)"}</option>
                    {commits.map(c => (
                      <option key={c.hash} value={c.hash}>{c.hash}</option>
                    ))}
                  </select>
                </div>

                <button className="git-btn" onClick={handleGenerateMeeting}>
                  <Sparkles size={14} /> {language === 'en' ? "Generate Minutes" : "Minutes generieren"}
                </button>
              </div>
            </>
          )}

          {activePanel === "settings" && (
            <>
              <div className="panel-header">
                <span>{t.settingsTitle}</span>
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="settings-group">
                  <label className="settings-label">{t.languageLabel}</label>
                  <select 
                    className="settings-select"
                    value={language}
                    onChange={(e) => {
                      const val = e.target.value as "de" | "en";
                      setLanguage(val);
                      localStorage.setItem("language", val);
                    }}
                  >
                    <option value="de">{t.languageDE}</option>
                    <option value="en">{t.languageEN}</option>
                  </select>
                </div>

                <div className="settings-group">
                  <label className="settings-label">{t.authLabel}</label>
                  <select 
                    className="settings-select"
                    value={authStrategy}
                    onChange={(e) => setAuthStrategy(e.target.value)}
                  >
                    <option value="keycloak">{t.authOIDC}</option>
                    <option value="ldap">{t.authLDAP}</option>
                    <option value="local">{t.authLocal}</option>
                  </select>
                </div>

                {authStrategy === "keycloak" && (
                  <div className="settings-group">
                    <label className="settings-label">{t.keycloakUrlLabel}</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      value={keycloakUrl} 
                      onChange={(e) => setKeycloakUrl(e.target.value)}
                    />
                  </div>
                )}

                {authStrategy === "ldap" && (
                  <div className="settings-group">
                    <label className="settings-label">{t.ldapUrlLabel}</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      value={ldapUrl} 
                      onChange={(e) => setLdapUrl(e.target.value)}
                    />
                  </div>
                )}

                <div className="settings-group">
                  <label className="settings-label">{t.gitProviderLabel}</label>
                  <select 
                    className="settings-select"
                    value={gitProvider}
                    onChange={(e) => setGitProvider(e.target.value)}
                  >
                    <option value="gitlab-selfhosted">GitLab (Self-hosted)</option>
                    <option value="github-cloud">GitHub Enterprise (Cloud)</option>
                  </select>
                </div>

                <div className="settings-group">
                  <label className="settings-label">{t.gitUrlLabel}</label>
                  <input 
                    type="text" 
                    className="settings-input" 
                    value={gitUrl} 
                    onChange={(e) => setGitUrl(e.target.value)}
                  />
                </div>

                <div className="settings-group">
                  <label className="settings-label">Yjs Server URL</label>
                  <input 
                    type="text" 
                    className="settings-input" 
                    value={yjsUrl} 
                    onChange={(e) => setYjsUrl(e.target.value)}
                    placeholder="ws://localhost:1234"
                  />
                </div>
              </div>
            </>
          )}

          {activePanel === "cheatsheet" && (
            <>
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{t.cheatsheetTitle}</span>
                <span className="logo-badge" style={{ fontSize: '9px', backgroundColor: 'rgba(99, 102, 241, 0.1)' }}>MD Extensions</span>
              </div>
              <div className="cheatsheet-container">
                <div className="cheatsheet-section">
                  <div className="cheatsheet-header">
                    <Link size={14} style={{ color: 'var(--accent-indigo)' }} />
                    <span>{language === 'en' ? "File Reference & Transclusion" : "Dateiverweis & Transklusion"}</span>
                  </div>
                  <div className="cheatsheet-desc">
                    {language === 'en' 
                      ? "Quotes lines or complete files live from the repository. Clicking in preview opens file at that line."
                      : "Zitiert Zeilen oder komplette Dateien live aus dem Repository. Klicks in der Vorschau öffnen die Datei an der Stelle."}
                  </div>
                  <div className="cheatsheet-preview">
                    <code>{"@[arc42/02_constraints.md#L4-L8]"}</code>
                  </div>
                  <div className="cheatsheet-actions">
                    <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("reference")}>
                      <Plus size={10} /> {language === 'en' ? "Insert" : "Einfügen"}
                    </button>
                  </div>
                </div>

                <div className="cheatsheet-section">
                  <div className="cheatsheet-header">
                    <Box size={14} style={{ color: 'var(--accent-blue)' }} />
                    <span>{language === 'en' ? "Draw.io Diagrams" : "Draw.io Diagramme"}</span>
                  </div>
                  <div className="cheatsheet-desc">
                    {language === 'en'
                      ? "Embeds interactive diagrams.net / draw.io charts directly into the Markdown preview via URL or code block."
                      : "Bettet interaktive diagrams.net / draw.io Grafiken über URL oder Code-Blöcke direkt in die Markdown-Vorschau ein."}
                  </div>
                  <div className="cheatsheet-preview">
                    <code>{"```drawio\n[Draw.io Embed URL]\n```"}</code>
                  </div>
                  <div className="cheatsheet-actions">
                    <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("drawio")}>
                      <Plus size={10} /> {language === 'en' ? "Insert" : "Einfügen"}
                    </button>
                  </div>
                </div>

                <div className="cheatsheet-section">
                  <div className="cheatsheet-header">
                    <Calendar size={14} style={{ color: 'var(--accent-green)' }} />
                    <span>{language === 'en' ? "Roadmap Milestones" : "Roadmap-Meilensteine"}</span>
                  </div>
                  <div className="cheatsheet-desc">
                    {language === 'en'
                      ? "Creates structured milestone cards in the document and automatically feeds dates into the dashboard."
                      : "Erstellt strukturierte Meilenstein-Karten im Dokument und füttert das Projekt-Dashboard automatisch mit Terminen."}
                  </div>
                  <div className="cheatsheet-preview">
                    <code>{"---\ntitle: \"Meilenstein Name\"\nstatus: \"pending\"\nmilestone: \"M1: Konzept\"\nstart_date: \"2026-06-01\"\nend_date: \"2026-06-15\"\nassignee: \"Developer A\"\ncolor: \"#a855f7\"\n---"}</code>
                  </div>
                  <div className="cheatsheet-actions">
                    <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("roadmap-item")}>
                      <Plus size={10} /> {language === 'en' ? "Insert" : "Einfügen"}
                    </button>
                  </div>
                </div>

                <div className="cheatsheet-section">
                  <div className="cheatsheet-header">
                    <Share2 size={14} style={{ color: 'var(--accent-indigo)' }} />
                    <span>{language === 'en' ? "Mermaid UML Diagrams" : "Mermaid UML Diagramme"}</span>
                  </div>
                  <div className="cheatsheet-desc">
                    {language === 'en'
                      ? "Renders UML, flowcharts, Gantt charts, or sequence diagrams directly from plain-text code blocks."
                      : "Rendert UML, Ablaufdiagramme, Gantt-Diagramme oder Sequenzdiagramme direkt aus plain-text Codeblöcken."}
                  </div>
                  <div className="cheatsheet-preview">
                    <code>{"```mermaid\ngraph TD\n    A[Start] --> B[Prozess]\n```"}</code>
                  </div>
                  <div className="cheatsheet-actions">
                    <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("mermaid")}>
                      <Plus size={10} /> {language === 'en' ? "Insert" : "Einfügen"}
                    </button>
                  </div>
                </div>

                <div className="cheatsheet-section">
                  <div className="cheatsheet-header">
                    <Users size={14} style={{ color: 'var(--accent-indigo)' }} />
                    <span>{language === 'en' ? "Agile & Scrum Syntax" : "Agile & Scrum-Syntax"}</span>
                  </div>
                  <div className="cheatsheet-desc">
                    {language === 'en'
                      ? "Use prefixes for the Kanban board and blockers in logs."
                      : "Verwende Präfixe für das Kanban-Board und Blocker in Protokollen."}
                  </div>
                  <div className="cheatsheet-preview">
                    <div>Backlog: <code>- [ ] TODO: Text @dev</code></div>
                    <div>Blocker: <code>- [ ] BLOCKED: Text @sm</code></div>
                  </div>
                  <div className="cheatsheet-actions" style={{ gap: '8px' }}>
                    <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("backlog")} style={{ marginRight: '8px' }}>
                      <Plus size={10} /> Backlog
                    </button>
                    <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("blocker")}>
                      <Plus size={10} /> Blocker
                    </button>
                  </div>
                </div>

                <div className="cheatsheet-section">
                  <div className="cheatsheet-header">
                    <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />
                    <span>{language === 'en' ? "Advanced Formatting" : "Erweiterte Formatierung"}</span>
                  </div>
                  <div className="cheatsheet-desc">
                    {language === 'en'
                      ? "Special text highlight classes for marking or crossing out content."
                      : "Spezielle Text-Highlight-Klassen zur Markierung oder Streichung von Inhalten."}
                  </div>
                  <div className="cheatsheet-preview">
                    <div>Highlight: <code>{"==Text=="}</code></div>
                    <div>Strikethrough: <code>{"~~Text~~"}</code></div>
                  </div>
                  <div className="cheatsheet-actions" style={{ gap: '8px' }}>
                    <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("highlight")} style={{ marginRight: '8px' }}>
                      <Plus size={10} /> Highlight
                    </button>
                    <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("strikethrough")}>
                      <Plus size={10} /> Strike
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Center Main Editor Pane OR PM Dashboard */}
        {/* Center Main Editor Pane OR PM Dashboard OR DocumentGraph */}
        {activePanel === "pm" ? (
          <div className="pm-dashboard">
            <div className="dashboard-title-section" style={{ marginBottom: '16px' }}>
              <h1 className="dashboard-title">
                <Sparkles size={22} style={{ color: 'var(--accent-indigo)' }} />
                Scrum Master & PM Dashboard
              </h1>
              
              <div className="timeline-legend">
                <div className="legend-item">
                  <span className="legend-color completed"></span>
                  <span>{language === 'en' ? "Completed" : "Erledigt"}</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color in-progress"></span>
                  <span>{language === 'en' ? "In Progress" : "In Arbeit"}</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color pending"></span>
                  <span>{language === 'en' ? "Pending" : "Ausstehend"}</span>
                </div>
              </div>
            </div>

            {/* PM Sub Tabs Navigation */}
            <div className="pm-tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px', paddingBottom: '1px' }}>
              <button 
                className={`pm-tab-btn ${pmSubTab === "roadmap" ? "active" : ""}`}
                onClick={() => setPmSubTab("roadmap")}
                style={{
                  background: 'none',
                  border: 'none',
                  color: pmSubTab === "roadmap" ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                  borderBottom: pmSubTab === "roadmap" ? '2px solid var(--accent-indigo)' : 'none',
                  padding: '8px 16px',
                  fontWeight: pmSubTab === "roadmap" ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {language === 'en' ? "Roadmap & Timeline" : "Roadmap & Timeline"}
              </button>
              <button 
                className={`pm-tab-btn ${pmSubTab === "kanban" ? "active" : ""}`}
                onClick={() => setPmSubTab("kanban")}
                style={{
                  background: 'none',
                  border: 'none',
                  color: pmSubTab === "kanban" ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                  borderBottom: pmSubTab === "kanban" ? '2px solid var(--accent-indigo)' : 'none',
                  padding: '8px 16px',
                  fontWeight: pmSubTab === "kanban" ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {language === 'en' ? "Sprint Kanban Board" : "Sprint Kanban Board"}
              </button>
              <button 
                className={`pm-tab-btn ${pmSubTab === "velocity" ? "active" : ""}`}
                onClick={() => setPmSubTab("velocity")}
                style={{
                  background: 'none',
                  border: 'none',
                  color: pmSubTab === "velocity" ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                  borderBottom: pmSubTab === "velocity" ? '2px solid var(--accent-indigo)' : 'none',
                  padding: '8px 16px',
                  fontWeight: pmSubTab === "velocity" ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {language === 'en' ? "Burndown & Capacity" : "Burndown & Kapazität"}
              </button>
              <button 
                className={`pm-tab-btn ${pmSubTab === "retro" ? "active" : ""}`}
                onClick={() => setPmSubTab("retro")}
                style={{
                  background: 'none',
                  border: 'none',
                  color: pmSubTab === "retro" ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                  borderBottom: pmSubTab === "retro" ? '2px solid var(--accent-indigo)' : 'none',
                  padding: '8px 16px',
                  fontWeight: pmSubTab === "retro" ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {language === 'en' ? "Retrospective & Blockers" : "Retrospektive & Blocker"}
              </button>
              <button 
                className={`pm-tab-btn ${pmSubTab === "standup" ? "active" : ""}`}
                onClick={() => setPmSubTab("standup")}
                style={{
                  background: 'none',
                  border: 'none',
                  color: pmSubTab === "standup" ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                  borderBottom: pmSubTab === "standup" ? '2px solid var(--accent-indigo)' : 'none',
                  padding: '8px 16px',
                  fontWeight: pmSubTab === "standup" ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {language === 'en' ? "Standup Assistant" : "Standup Assistent"}
              </button>
            </div>

            {pmSubTab === "roadmap" && (
              <>
                <div className="timeline-card">
                  <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
                    {language === 'en' ? "Project Milestones & Roadmap (Dynamic from roadmap.md)" : "Projekt-Meilensteine & Roadmap (Dynamisch aus roadmap.md)"}
                  </h2>

                  <div className="timeline-axis">
                    <div className="timeline-axis-label">{language === 'en' ? "June 1-5" : "Juni 1-5"}</div>
                    <div className="timeline-axis-label">{language === 'en' ? "June 6-12" : "Juni 6-12"}</div>
                    <div className="timeline-axis-label">{language === 'en' ? "June 13-20" : "Juni 13-20"}</div>
                    <div className="timeline-axis-label">{language === 'en' ? "June 21-28" : "Juni 21-28"}</div>
                  </div>

                  <div className="timeline-rows">
                    {getRoadmapItems().map((item, idx) => {
                      // Generate layout properties based on items
                      let width = "25%";
                      let left = "0%";
                      if (idx === 0) { width = "18%"; left = "0%"; }
                      else if (idx === 1) { width = "25%"; left = "18%"; }
                      else if (idx === 2) { width = "28%"; left = "43%"; }
                      else if (idx === 3) { width = "28%"; left = "71%"; }

                      return (
                        <div className="timeline-row" key={idx}>
                          <div className="timeline-row-info">
                            <span>{item.title}</span>
                            <span className="timeline-row-assignee">{item.assignee} ({item.milestone})</span>
                          </div>
                          
                          <div className="timeline-bar-track">
                            <div 
                              className={`timeline-bar ${item.status}`} 
                              style={{ 
                                left: left, 
                                width: width,
                                background: item.color 
                                  ? `linear-gradient(135deg, ${item.color.trim()}, color-mix(in srgb, ${item.color.trim()} 80%, black))` 
                                  : undefined,
                                borderColor: item.color || undefined
                              }}
                            >
                              {item.status.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quality Radar Chart and ADR Summaries */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
                  <div className="timeline-card">
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Qualitätsziele Radar (arc42 §1.2)</h3>
                    <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ border: '2px solid var(--border-color)', borderRadius: '50%', width: '120px', height: '120px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '50%', width: '70px', height: '70px', position: 'relative' }} />
                        <span style={{ position: 'absolute', top: '-15px', fontSize: '9px', fontWeight: 600 }}>Entwickler-Zufriedenheit</span>
                        <span style={{ position: 'absolute', bottom: '-15px', fontSize: '9px', fontWeight: 600 }}>PM-Transparenz</span>
                        <span style={{ position: 'absolute', right: '-35px', fontSize: '9px', fontWeight: 600 }}>Live-Sync</span>
                        
                        {/* SVG plotting custom radar polygon */}
                        <svg style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }}>
                          <polygon points="60,20 100,60 60,95" fill="rgba(99, 102, 241, 0.25)" stroke="var(--accent-indigo)" strokeWidth="2" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="timeline-card">
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Neueste Architekturentscheidungen (ADR)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>
                          <span>ADR-0001: Modulare Authentifizierung</span>
                          <span className="git-change-badge added" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-green)' }}>Akzeptiert</span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Einführung von Passport.js / NextAuth zur modularen Integration von Keycloak SSO und LDAP.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {pmSubTab === "kanban" && (
              <div className="timeline-card">
                <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Folder size={18} style={{ color: 'var(--accent-blue)' }} />
                  {language === 'en' ? "Sprint Backlog & Kanban Board (Dynamic from sprint-backlog.md)" : "Sprint Backlog & Kanban-Board (Dynamisch aus sprint-backlog.md)"}
                </h2>
                
                <div className="kanban-board">
                  {/* Spalte 1: Todo */}
                  <div className="kanban-column">
                    <div className="kanban-column-header">
                      <span>{language === 'en' ? "Open (TODO)" : "Offen (TODO)"}</span>
                      <span className="kanban-badge">
                        {getBacklogItems().filter(i => i.status === 'todo').length}
                      </span>
                    </div>
                    {getBacklogItems().filter(i => i.status === 'todo').map(item => (
                      <div key={item.id} className="kanban-card">
                        <div className="kanban-card-title">{item.title}</div>
                        <div className="kanban-card-footer">
                          <span className="kanban-card-assignee">{item.assignee}</span>
                          <span className="kanban-card-status-badge">TODO</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Spalte 2: In Progress */}
                  <div className="kanban-column">
                    <div className="kanban-column-header in-progress">
                      <span>{language === 'en' ? "In Progress (IN PROGRESS)" : "In Arbeit (IN PROGRESS)"}</span>
                      <span className="kanban-badge">
                        {getBacklogItems().filter(i => i.status === 'in-progress').length}
                      </span>
                    </div>
                    {getBacklogItems().filter(i => i.status === 'in-progress').map(item => (
                      <div key={item.id} className="kanban-card in-progress">
                        <div className="kanban-card-title">{item.title}</div>
                        <div className="kanban-card-footer">
                          <span className="kanban-card-assignee">{item.assignee}</span>
                          <span className="kanban-card-status-badge">IN PROG</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Spalte 3: Done */}
                  <div className="kanban-column">
                    <div className="kanban-column-header done">
                      <span>{language === 'en' ? "Completed (DONE)" : "Erledigt (DONE)"}</span>
                      <span className="kanban-badge">
                        {getBacklogItems().filter(i => i.status === 'done').length}
                      </span>
                    </div>
                    {getBacklogItems().filter(i => i.status === 'done').map(item => (
                      <div key={item.id} className="kanban-card done">
                        <div className="kanban-card-title">{item.title}</div>
                        <div className="kanban-card-footer">
                          <span className="kanban-card-assignee">{item.assignee}</span>
                          <span className="kanban-card-status-badge">DONE</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {pmSubTab === "velocity" && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                  {/* Burndown Chart */}
                  <div className="timeline-card">
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingDown size={16} style={{ color: 'var(--accent-indigo)' }} />
                      {language === 'en' ? "Sprint Burndown Chart (Dynamic from burndown.md)" : "Sprint Burndown Chart (Dynamisch aus burndown.md)"}
                    </h3>
                    
                    <div style={{ height: '180px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      {getBurndownData().length === 0 ? (
                        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>{language === 'en' ? "No burndown data found." : "Keine Burndown-Daten gefunden."}</div>
                      ) : (
                        <svg viewBox="0 0 400 160" style={{ width: '100%', height: '100%' }}>
                          {/* Grid Lines */}
                          <line x1="40" y1="20" x2="380" y2="20" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                          <line x1="40" y1="50" x2="380" y2="50" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                          <line x1="40" y1="80" x2="380" y2="80" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                          <line x1="40" y1="110" x2="380" y2="110" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                          <line x1="40" y1="140" x2="380" y2="140" stroke="var(--border-color)" strokeWidth="1" />
                          <line x1="40" y1="20" x2="40" y2="140" stroke="var(--border-color)" strokeWidth="1" />

                          {/* Labels Y */}
                          <text x="10" y="24" fill="var(--text-muted)" fontSize="8px">60 SP</text>
                          <text x="10" y="84" fill="var(--text-muted)" fontSize="8px">30 SP</text>
                          <text x="10" y="144" fill="var(--text-muted)" fontSize="8px">0 SP</text>

                          {/* Plot ideal burndown line */}
                          <line x1="40" y1="20" x2="380" y2="140" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="5 5" />

                          {/* Plot actual burndown line */}
                          {(() => {
                            const data = getBurndownData();
                            const maxVal = Math.max(...data.map(d => d.ideal));
                            const points: string[] = [];
                            
                            data.forEach((d, idx) => {
                              if (d.actual !== null) {
                                const x = 40 + (idx * (340 / (data.length - 1)));
                                const y = 140 - (d.actual * (120 / maxVal));
                                points.push(`${x},${y}`);
                              }
                            });

                            return points.length > 1 ? (
                              <>
                                <polyline points={points.join(" ")} fill="none" stroke="var(--accent-indigo)" strokeWidth="2.5" />
                                {points.map((pt, idx) => {
                                  const [x, y] = pt.split(",");
                                  return (
                                    <circle key={idx} cx={x} cy={y} r="3" fill="var(--accent-indigo)" stroke="var(--bg-sidebar)" strokeWidth="1" />
                                  );
                                })}
                              </>
                            ) : null;
                          })()}

                          {/* Labels X */}
                          {getBurndownData().map((d, idx, arr) => {
                            const x = 40 + (idx * (340 / (arr.length - 1)));
                            return (
                              <text key={idx} x={x} y="152" fill="var(--text-muted)" fontSize="8px" textAnchor="middle">
                                {d.day.replace("Tag ", "T").replace("Day ", "D")}
                              </text>
                            );
                          })}
                        </svg>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '16px', fontSize: '9px', color: 'var(--text-secondary)', marginTop: '8px', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ borderTop: '2px dashed var(--text-muted)', width: '12px', display: 'inline-block' }}></span>
                        <span>{language === 'en' ? "Ideal trend" : "Idealverlauf"}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ borderTop: '2px solid var(--accent-indigo)', width: '12px', display: 'inline-block' }}></span>
                        <span>{language === 'en' ? "Actual trend" : "Tatsächlicher Verlauf"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Team Capacity Calculator */}
                  <div className="timeline-card">
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={16} style={{ color: 'var(--accent-indigo)' }} />
                      {language === 'en' ? "Sprint Capacity & Load (capacity.md)" : "Sprint-Kapazität & Auslastung (capacity.md)"}
                    </h3>
                    {(() => {
                      const capacities = getCapacityData();
                      const totalCapacity = capacities.reduce((sum, c) => sum + c.capacity, 0);
                      const backlogItems = getBacklogItems();
                      const plannedSP = backlogItems.filter(i => i.status !== 'done').length * 3;
                      const loadPercent = totalCapacity > 0 ? Math.round((plannedSP / totalCapacity) * 100) : 0;
                      
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{language === 'en' ? "Total Capacity" : "Gesamtkapazität"}</div>
                              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--accent-green)' }}>{totalCapacity.toFixed(1)} SP</div>
                            </div>
                            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{language === 'en' ? "Planned (Open)" : "Geplant (Offen)"}</div>
                              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--accent-indigo)' }}>{plannedSP} SP</div>
                            </div>
                          </div>

                          <div style={{ margin: '8px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                              <span>{language === 'en' ? "Team Load:" : "Team-Auslastung:"}</span>
                              <span style={{ fontWeight: 'bold', color: loadPercent > 100 ? 'var(--accent-red)' : 'var(--text-primary)' }}>{loadPercent}%</span>
                            </div>
                            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(loadPercent, 100)}%`, height: '100%', backgroundColor: loadPercent > 100 ? 'var(--accent-red)' : 'var(--accent-indigo)' }}></div>
                            </div>
                            {loadPercent > 100 && (
                              <div style={{ fontSize: '10px', color: 'var(--accent-red)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={10} />
                                <span>{language === 'en' ? "Team is overloaded!" : "Team ist überlastet!"}</span>
                              </div>
                            )}
                          </div>

                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>{language === 'en' ? "Individual Capacities:" : "Einzelkapazitäten:"}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {capacities.map((c, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '2px' }}>
                                  <span>{c.member} ({c.days}d {language === 'en' ? 'at' : 'à'} {c.focus * 100}%)</span>
                                  <span style={{ fontWeight: 500 }}>{c.capacity.toFixed(1)} SP</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Velocity SVG Bar Chart */}
                <div className="timeline-card" style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingDown size={16} style={{ color: 'var(--accent-indigo)' }} />
                    {language === 'en' ? "Team Velocity (Historical from capacity.md)" : "Team Velocity (Historischer Verlauf aus capacity.md)"}
                  </h3>
                  <div style={{ height: '180px', display: 'flex', justifyContent: 'center' }}>
                    {getVelocityData().length === 0 ? (
                      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>{language === 'en' ? "No velocity data found." : "Keine Velocity-Daten gefunden."}</div>
                    ) : (
                      <svg viewBox="0 0 400 160" style={{ width: '100%', height: '100%' }}>
                        {/* Grid lines */}
                        <line x1="40" y1="20" x2="380" y2="20" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                        <line x1="40" y1="60" x2="380" y2="60" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                        <line x1="40" y1="100" x2="380" y2="100" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                        <line x1="40" y1="140" x2="380" y2="140" stroke="var(--border-color)" strokeWidth="1" />
                        <line x1="40" y1="20" x2="40" y2="140" stroke="var(--border-color)" strokeWidth="1" />

                        {/* Labels Y */}
                        <text x="10" y="24" fill="var(--text-muted)" fontSize="8px">60 SP</text>
                        <text x="10" y="64" fill="var(--text-muted)" fontSize="8px">30 SP</text>
                        <text x="10" y="104" fill="var(--text-muted)" fontSize="8px">10 SP</text>

                        {/* Bars plotting */}
                        {(() => {
                          const data = getVelocityData();
                          const barWidth = 10;
                          const spacing = 60;
                          return data.map((d, idx) => {
                            const xPlanned = 70 + idx * spacing;
                            const xActual = xPlanned + 15;

                            const yPlanned = 140 - (d.planned * (120 / 60));
                            const yActual = 140 - (d.actual * (120 / 60));

                            const hPlanned = 140 - yPlanned;
                            const hActual = 140 - yActual;

                            return (
                              <g key={idx}>
                                {/* Planned Bar */}
                                <rect x={xPlanned} y={yPlanned} width={barWidth} height={hPlanned} fill="var(--border-color)" rx="2" stroke="rgba(255,255,255,0.05)" />
                                {/* Actual Bar */}
                                <rect x={xActual} y={yActual} width={barWidth} height={hActual} fill="var(--accent-indigo)" rx="2" />
                                {/* Label X */}
                                <text x={xPlanned + 12} y="152" fill="var(--text-muted)" fontSize="8px" textAnchor="middle">{d.sprint}</text>
                              </g>
                            );
                          });
                        })()}
                      </svg>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '9px', color: 'var(--text-secondary)', marginTop: '8px', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ backgroundColor: 'var(--border-color)', width: '12px', height: '8px', display: 'inline-block', borderRadius: '2px' }}></span>
                      <span>{language === 'en' ? "Planned Story Points" : "Geplante Story Points"}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ backgroundColor: 'var(--accent-indigo)', width: '12px', height: '8px', display: 'inline-block', borderRadius: '2px' }}></span>
                      <span>{language === 'en' ? "Completed Story Points" : "Erreichte Story Points"}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {pmSubTab === "retro" && (
              <>
                {/* Retro Sticky Notes Board */}
                <div className="timeline-card">
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} style={{ color: 'var(--accent-indigo)' }} />
                    {language === 'en' ? "Sprint Retrospective Sticky Board (meetings/2026-06-03_retro.md)" : "Sprint Retrospektive Sticky Board (meetings/2026-06-03_retro.md)"}
                  </h3>
                  
                  {getRetroNotes().length === 0 ? (
                    <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', padding: '24px' }}>{language === 'en' ? "No retro notes found." : "Keine Retro-Notizen gefunden."}</div>
                  ) : (
                    <div className="retro-board" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                      {/* Glad Column */}
                      <div className="retro-column glad" style={{ backgroundColor: 'rgba(16, 185, 129, 0.03)', padding: '12px', borderRadius: '8px', border: '1px dashed rgba(16, 185, 129, 0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-green)', textTransform: 'uppercase', borderBottom: '1px solid rgba(16, 185, 129, 0.1)', paddingBottom: '6px' }}>
                          {language === 'en' ? "What went well? (Glad)" : "Was lief gut? (Glad)"}
                        </div>
                        {getRetroNotes().filter(n => n.type === 'glad').map((n, idx) => (
                          <div key={idx} className="retro-card glad" style={{ backgroundColor: 'var(--bg-panel)', borderLeft: '3px solid var(--accent-green)', padding: '10px', borderRadius: '6px', fontSize: '12px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }}>
                            {n.text}
                          </div>
                        ))}
                      </div>

                      {/* Sad Column */}
                      <div className="retro-column sad" style={{ backgroundColor: 'rgba(239, 68, 68, 0.03)', padding: '12px', borderRadius: '8px', border: '1px dashed rgba(239, 68, 68, 0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-red)', textTransform: 'uppercase', borderBottom: '1px solid rgba(239, 68, 68, 0.1)', paddingBottom: '6px' }}>
                          {language === 'en' ? "What did not go well? (Sad)" : "Was lief nicht gut? (Sad)"}
                        </div>
                        {getRetroNotes().filter(n => n.type === 'sad').map((n, idx) => (
                          <div key={idx} className="retro-card sad" style={{ backgroundColor: 'var(--bg-panel)', borderLeft: '3px solid var(--accent-red)', padding: '10px', borderRadius: '6px', fontSize: '12px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }}>
                            {n.text}
                          </div>
                        ))}
                      </div>

                      {/* Impediments Column */}
                      <div className="retro-column impediment" style={{ backgroundColor: 'rgba(245, 158, 11, 0.03)', padding: '12px', borderRadius: '8px', border: '1px dashed rgba(245, 158, 11, 0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-yellow)', textTransform: 'uppercase', borderBottom: '1px solid rgba(245, 158, 11, 0.1)', paddingBottom: '6px' }}>
                          {language === 'en' ? "Impediments / Blocker Log" : "Impediments / Blocker Log"}
                        </div>
                        {getRetroNotes().filter(n => n.type === 'impediment').map((n, idx) => (
                          <div key={idx} className="retro-card impediment" style={{ backgroundColor: 'var(--bg-panel)', borderLeft: '3px solid var(--accent-yellow)', padding: '10px', borderRadius: '6px', fontSize: '12px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }}>
                            {n.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Impediment List widget */}
                <div className="timeline-card" style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} style={{ color: 'var(--accent-red)' }} />
                    {language === 'en' ? "Impediment Backlog & Blockers (Meetings / Retros)" : "Impediment-Backlog & Blocker (Meetings / Retros)"}
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {getImpedimentItems().length === 0 ? (
                      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', padding: '24px 0' }}>
                        {language === 'en' ? "No active blockers logged in the project." : "Keine aktiven Blocker im Projekt protokolliert."}
                      </div>
                    ) : (
                      getImpedimentItems().map((imp, idx) => (
                        <div 
                          key={idx} 
                          style={{ 
                            backgroundColor: 'rgba(239, 68, 68, 0.05)', 
                            border: '1px solid rgba(239, 68, 68, 0.2)', 
                            borderLeft: '4px solid var(--accent-red)',
                            padding: '10px', 
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            handleOpenFile(imp.filePath);
                            setTimeout(() => {
                              if (editorRef.current) {
                                editorRef.current.revealLineInCenter(imp.line);
                                editorRef.current.setPosition({ lineNumber: imp.line, column: 1 });
                              }
                            }, 100);
                          }}
                          title={language === 'en' ? `Click to jump to ${imp.fileName} line ${imp.line}` : `Klicken um in ${imp.fileName} Zeile ${imp.line} zu springen`}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{imp.title}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Protokolliert in {imp.fileName} (Zeile {imp.line})</span>
                          </div>
                          <span style={{ fontSize: '9px', padding: '2px 6px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)', borderRadius: '4px', fontWeight: 600 }}>
                            {imp.assignee}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {pmSubTab === "standup" && (
              <div className="timeline-card">
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} style={{ color: 'var(--accent-indigo)' }} />
                  {language === 'en' ? "Daily Standup Assistant (Automatically generated)" : "Daily Standup Assistent (Automatisch generiert)"}
                </h3>
                
                {(() => {
                  const backlog = getBacklogItems();
                  const impediments = getImpedimentItems();
                  
                  const doneTasks = backlog.filter(i => i.status === 'done');
                  const inProgressTasks = backlog.filter(i => i.status === 'in-progress');
                  
                  const standupText = language === 'en' 
                    ? `Daily Standup Report - ${new Date().toLocaleDateString("en-US")}

1. Completed yesterday:
${doneTasks.map(t => `* [x] ${t.title} (${t.assignee})`).join("\n") || "* No tasks in DONE status"}

2. Focus today:
${inProgressTasks.map(t => `* [/] ${t.title} (${t.assignee})`).join("\n") || "* No tasks in IN-PROGRESS status"}

3. Blockers / Impediments:
${impediments.map(i => `* [ ] BLOCKED: ${i.title} (${i.assignee})`).join("\n") || "* No active blockers reported"}`
                    : `Daily Standup Bericht - ${new Date().toLocaleDateString("de-DE")}

1. Gestern erledigt:
${doneTasks.map(t => `* [x] ${t.title} (${t.assignee})`).join("\n") || "* Keine Aufgaben im Status DONE"}

2. Heute im Fokus:
${inProgressTasks.map(t => `* [/] ${t.title} (${t.assignee})`).join("\n") || "* Keine Aufgaben im Status IN-PROGRESS"}

3. Blocker / Impediments:
${impediments.map(i => `* [ ] BLOCKED: ${i.title} (${i.assignee})`).join("\n") || "* Keine aktiven Blocker gemeldet"}`;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {t.standupIntro}
                      </div>
                      
                      <div style={{ position: 'relative' }}>
                        <pre style={{ margin: 0, padding: '16px', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '12px', whiteSpace: 'pre-wrap', color: 'var(--text-primary)', maxHeight: '300px', overflowY: 'auto' }}>
                          {standupText}
                        </pre>
                        
                        <button 
                          className="git-btn"
                          style={{ position: 'absolute', top: '10px', right: '10px', padding: '4px 10px', fontSize: '11px', margin: 0 }}
                          onClick={() => {
                            navigator.clipboard.writeText(standupText);
                            alert(language === 'en' ? "Standup report copied to clipboard!" : "Standup-Bericht in die Zwischenablage kopiert!");
                          }}
                        >
                          {language === 'en' ? "Copy Report" : "Bericht kopieren"}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : activePanel === "graph" ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <DocumentGraph 
              files={files} 
              onSelectNode={(filePath) => {
                handleOpenFile(filePath);
                setActivePanel("explorer");
              }} 
              language={language}
            />
          </div>
        ) : (
          <div className="editor-workspace" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Split Editor Pane Container */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* Left Panel: Editor A */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: splitActive ? '1px solid var(--border-color)' : 'none', minWidth: 0 }}>
                {/* Tab Bar A */}
                <div className="editor-tabs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
                  {/* Scrollable Tabs List */}
                  <div style={{ display: 'flex', overflowX: 'auto', flex: 1, height: '100%', scrollbarWidth: 'none' }}>
                    {openTabs.map(tabPath => {
                      const tabFile = files.find(f => f.path === tabPath);
                      return (
                        <div 
                          key={tabPath} 
                          className={`editor-tab ${activeFilePath === tabPath ? "active" : ""} ${activeEditorPane === 'A' && activeFilePath === tabPath ? "pane-focused" : ""}`}
                          onClick={() => { setActiveFilePath(tabPath); setActiveEditorPane('A'); }}
                        >
                          <FileText size={12} />
                          <span>{tabFile?.name}</span>
                          {modifiedFiles[tabPath] && (
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-yellow)' }}></span>
                          )}
                          <span className="tab-close" onClick={(e) => handleCloseTab(e, tabPath)}><X size={10} /></span>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Editor A Actions */}
                  <div className="editor-actions" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', height: '100%', padding: '0 12px', backgroundColor: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border-color)' }}>
                    {activeFilePath.endsWith(".md") && (
                      <div className="editor-mode-toggle" style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden', height: '24px', marginRight: '8px' }}>
                        <button 
                          className={`mode-btn ${editorMode === "code" ? "active" : ""}`}
                          onClick={() => setEditorMode("code")}
                          style={{
                            background: editorMode === "code" ? 'var(--accent-indigo)' : 'transparent',
                            color: editorMode === "code" ? 'white' : 'var(--text-secondary)',
                            border: 'none',
                            padding: '2px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: editorMode === "code" ? 600 : 400
                          }}
                        >
                          Code
                        </button>
                        <button 
                          className={`mode-btn ${editorMode === "visual" ? "active" : ""}`}
                          onClick={() => setEditorMode("visual")}
                          style={{
                            background: editorMode === "visual" ? 'var(--accent-indigo)' : 'transparent',
                            color: editorMode === "visual" ? 'white' : 'var(--text-secondary)',
                            border: 'none',
                            padding: '2px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: editorMode === "visual" ? 600 : 400
                          }}
                        >
                          Visual
                        </button>
                      </div>
                    )}
                    <button 
                      className="action-icon-btn" 
                      onClick={() => setSplitActive(!splitActive)}
                      title="Editor aufteilen (Split Editor)"
                      style={{ color: splitActive ? "var(--accent-indigo)" : "var(--text-secondary)" }}
                    >
                      <Split size={16} />
                    </button>
                    <button 
                      className="action-icon-btn" 
                      onClick={() => setShowPreview(!showPreview)}
                      title="Toggle Live-Vorschau"
                      style={{ color: showPreview ? "var(--accent-indigo)" : "var(--text-secondary)" }}
                    >
                      <Eye size={16} />
                    </button>
                    <button className="action-icon-btn" onClick={() => setShowExportModal(true)} title="Dokument exportieren"><FileDown size={16} /></button>
                  </div>
                </div>

                {/* Editor A Content */}
                <div className="editor-pane" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                  {editorMode === "code" ? (
                    <>
                      {/* Editor Toolbar */}
                      <div className="editor-toolbar">
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("todo")} title="Aufgabe / Checkliste">
                          <CheckSquare size={14} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("table")} title="Tabelle einfügen">
                          <TableIcon size={14} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("mermaid")} title="Mermaid UML Diagramm">
                          <CodeIcon size={14} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("drawio")} title="Draw.io Diagramm einfügen">
                          <Box size={14} style={{ color: 'var(--accent-indigo)' }} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("adr")} title="ADR Architektur-Vorlage">
                          <Sparkles size={14} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("roadmap-item")} title="Roadmap-Meilenstein Block">
                          <Calendar size={14} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("reference")} title="Referenz aus anderem Dokument einbetten (@[pfad#L1-L5])">
                          <FileText size={14} style={{ color: 'var(--accent-indigo)' }} />
                        </button>
                        
                        <div className="toolbar-separator"></div>
                        
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("bold")} title="Fett markieren">
                          <Bold size={14} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("italic")} title="Kursiv markieren">
                          <Italic size={14} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("link")} title="Link einfügen">
                          <Link size={14} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("image")} title="Bild einfügen">
                          <ImageIcon size={14} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("bullet-list")} title="Aufzählungliste">
                          <List size={14} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("ordered-list")} title="Nummerierte Liste">
                          <ListOrdered size={14} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("code-block")} title="Codeblock einfügen">
                          <CodeIcon size={14} style={{ opacity: 0.8 }} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("quote")} title="Zitat-Block">
                          <Quote size={14} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("horizontal-rule")} title="Trennlinie einfügen">
                          <Minus size={14} />
                        </button>
                        <button className="action-icon-btn" onClick={() => insertTemplateBlock("details")} title="Dropdown-Details Block">
                          <ChevronDown size={14} />
                        </button>
                        <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />
                        <button 
                          className="action-icon-btn" 
                          onClick={() => setShowCheatsheetModal(true)} 
                          title="Syntax-Hilfe & Cheatsheet öffnen (Ctrl+/)"
                          style={{ color: 'var(--accent-indigo)' }}
                        >
                          <HelpCircle size={14} />
                        </button>
                      </div>
                      
                      <div className="monaco-wrapper" style={{ flex: 1, minHeight: 0 }}>
                        <Editor
                          height="100%"
                          language="markdown"
                          theme="vs-dark"
                          value={activeFile.content}
                          onChange={handleEditorChange}
                          onMount={(editor, monaco) => {
                            editorRef.current = editor;
                            monacoRef.current = monaco;
                            setEditorAInstance(editor);
                            editor.onDidFocusEditorText(() => setActiveEditorPane('A'));
                            registerCustomCompletions(monaco);
                          }}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            lineNumbers: "on",
                            wordWrap: "on",
                            fontFamily: "var(--font-mono)",
                            automaticLayout: true,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="visual-editor-wrapper" style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: 'var(--bg-editor)' }}>
                      {renderVisualEditor()}
                    </div>
                  )}

                  {showProblemsPanel && (
                    <ProblemsPanel 
                      diagnostics={diagnostics}
                      onSelectProblem={(filePath, line) => {
                        handleOpenFile(filePath);
                        setTimeout(() => {
                          if (editorRef.current) {
                            editorRef.current.revealLineInCenter(line);
                            editorRef.current.setPosition({ lineNumber: line, column: 1 });
                            editorRef.current.focus();
                          }
                        }, 100);
                      }}
                      onClose={() => setShowProblemsPanel(false)}
                      language={language}
                    />
                  )}
                </div>
              </div>

              {/* Right Panel: Editor B */}
              {splitActive && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', minWidth: 0 }}>
                  {/* Tab Bar B */}
                  <div className="editor-tabs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ display: 'flex', overflowX: 'auto', flex: 1, height: '100%', scrollbarWidth: 'none' }}>
                      {openTabsB.map(tabPath => {
                        const tabFile = files.find(f => f.path === tabPath);
                        return (
                          <div 
                            key={tabPath} 
                            className={`editor-tab ${activeFilePathB === tabPath ? "active" : ""} ${activeEditorPane === 'B' && activeFilePathB === tabPath ? "pane-focused" : ""}`}
                            onClick={() => { setActiveFilePathB(tabPath); setActiveEditorPane('B'); }}
                          >
                            <FileText size={12} />
                            <span>{tabFile?.name}</span>
                            {modifiedFiles[tabPath] && (
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-yellow)' }}></span>
                            )}
                            <span className="tab-close" onClick={(e) => handleCloseTabB(e, tabPath)}><X size={10} /></span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Editor B Content */}
                  <div className="editor-pane" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                    <div className="monaco-wrapper" style={{ flex: 1, minHeight: 0 }}>
                      <Editor
                        height="100%"
                        language="markdown"
                        theme="vs-dark"
                        value={files.find(f => f.path === activeFilePathB)?.content || ""}
                        onChange={(val) => {
                          if (val === undefined) return;
                          setFiles(prev => prev.map(f => f.path === activeFilePathB ? { ...f, content: val } : f));
                          setModifiedFiles(prev => ({ ...prev, [activeFilePathB]: true }));
                        }}
                        onMount={(editor, monaco) => {
                          editorRefB.current = editor;
                          monacoRefB.current = monaco;
                          setEditorBInstance(editor);
                          editor.onDidFocusEditorText(() => setActiveEditorPane('B'));
                          registerCustomCompletions(monaco);
                        }}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: "on",
                          wordWrap: "on",
                          fontFamily: "var(--font-mono)",
                          automaticLayout: true,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Rightmost Panel: Preview */}
              {showPreview && !splitActive && (
                <div className="preview-pane" style={{ width: '45%' }}>
                  <div className="panel-header" style={{ height: '36px', minHeight: '36px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel)' }}>
                    <span>Echtzeit-Vorschau</span>
                    <span className="logo-badge" style={{ fontSize: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>HTML Rendered</span>
                  </div>
                  <div className="preview-container markdown-body">
                    {parseMarkdown(activeFile.content)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Meeting assistant generated templates display */}
      {generatedMeetingText && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '600px' }}>
            <div className="modal-header">
              <span>{language === 'en' ? "Generated Meeting Minutes Template" : "Generierte Besprechungs-Protokoll Vorlage"}</span>
              <button className="modal-close" onClick={() => setGeneratedMeetingText("")}><X size={16} /></button>
            </div>
            
            <div style={{ maxHeight: '350px', overflowY: 'auto', padding: '12px', backgroundColor: 'var(--bg-editor)', border: '1px solid var(--border-color)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
              {generatedMeetingText}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button className="git-btn git-btn-secondary" onClick={() => setGeneratedMeetingText("")}>{t.cancel}</button>
              <button className="git-btn" onClick={saveGeneratedMeeting}>{language === 'en' ? "Save Minutes in Workspace" : "Vorlage in Workspace speichern"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal overlay */}
      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>{language === 'en' ? "Export Documentation" : "Dokumentation exportieren"}</span>
              <button className="modal-close" onClick={() => setShowExportModal(false)}><X size={16} /></button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {language === 'en' ? "Choose formatting and scope for the export:" : "Wählen Sie das Format und den Umfang für den Export:"}
            </p>

            <div className="export-options-grid" style={{ marginBottom: '16px' }}>
              <div 
                className={`export-option-card ${exportFormat === "pdf" ? "active" : ""}`}
                onClick={() => setExportFormat("pdf")}
              >
                <FileDown size={28} style={{ color: 'var(--accent-indigo)' }} />
                <span className="export-option-title">{language === 'en' ? "PDF Report" : "PDF Bericht"}</span>
                <span className="export-option-desc">{language === 'en' ? "Ideal for PMs, clients, and offline printing." : "Ideal für PMs, Kunden und Offlinedruck."}</span>
              </div>

              <div 
                className={`export-option-card ${exportFormat === "docx" ? "active" : ""}`}
                onClick={() => setExportFormat("docx")}
              >
                <FileText size={28} style={{ color: 'var(--accent-blue)' }} />
                <span className="export-option-title">Word (DOCX)</span>
                <span className="export-option-desc">{language === 'en' ? "Ideal for office document post-processing." : "Ideal für Nachbearbeitungen in Office."}</span>
              </div>
            </div>

            <div className="settings-group" style={{ marginBottom: '8px' }}>
              <label className="settings-label" style={{ marginBottom: '8px' }}>{language === 'en' ? "Export Scope" : "Export-Umfang"}</label>
              <div style={{ display: 'flex', gap: '20px', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="exportScope" 
                    checked={exportScope === "single"} 
                    onChange={() => setExportScope("single")} 
                    style={{ accentColor: 'var(--accent-indigo)' }}
                  />
                  <span>{language === 'en' ? "Active Document" : "Aktives Dokument"} ({activeFile.name})</span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="exportScope" 
                    checked={exportScope === "book"} 
                    onChange={() => setExportScope("book")} 
                    style={{ accentColor: 'var(--accent-indigo)' }}
                  />
                  <span>{language === 'en' ? "arc42 Manual (Compiled)" : "arc42 Handbuch (Kompiliert)"}</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button className="git-btn git-btn-secondary" onClick={() => setShowExportModal(false)}>{t.cancel}</button>
              <button className="git-btn" onClick={() => triggerDownload(exportFormat, exportScope)}>
                <Download size={14} /> {language === 'en' ? "Download" : "Herunterladen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '400px' }}>
            <div className="modal-header">
              <span>{t.createFileTitle}</span>
              <button className="modal-close" onClick={() => setShowNewFileModal(false)}><X size={16} /></button>
            </div>
            
            <div className="settings-group">
              <label className="settings-label">{t.folderSelectLabel}</label>
              <select 
                className="settings-select"
                value={newFileCategory}
                onChange={(e) => setNewFileCategory(e.target.value)}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="settings-group">
              <label className="settings-label">{language === 'en' ? "File name (e.g. 13_documentation.md)" : "Dateiname (z. B. 13_dokumentation.md)"}</label>
              <input 
                type="text" 
                className="settings-input"
                placeholder="neues_kapitel.md"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFile(); }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button className="git-btn git-btn-secondary" onClick={() => setShowNewFileModal(false)}>{t.cancel}</button>
              <button className="git-btn" onClick={handleCreateFile}>{t.create}</button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '400px' }}>
            <div className="modal-header">
              <span>{t.createFolderTitle}</span>
              <button className="modal-close" onClick={() => setShowNewFolderModal(false)}><X size={16} /></button>
            </div>

            <div className="settings-group">
              <label className="settings-label">{language === 'en' ? "Parent folder" : "Übergeordneter Ordner (Parent)"}</label>
              <select 
                className="settings-select"
                value={newFolderParent}
                onChange={(e) => setNewFolderParent(e.target.value)}
              >
                <option value="none">{language === 'en' ? "None (Root folder)" : "Kein (Hauptordner)"}</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="settings-group">
              <label className="settings-label">{language === 'en' ? "Folder name (lowercase)" : "Ordnername (Kleinbuchstaben)"}</label>
              <input 
                type="text" 
                className="settings-input"
                placeholder="z. B. drafts"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button className="git-btn git-btn-secondary" onClick={() => setShowNewFolderModal(false)}>{t.cancel}</button>
              <button className="git-btn" onClick={handleCreateFolder}>{t.create}</button>
            </div>
          </div>
        </div>
      )}

      {/* App Status Bar */}
      <footer className="app-statusbar">
        <div className="statusbar-left">
          {/* Branch selector dropdown */}
          <div className="statusbar-item" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowBranchMenu(!showBranchMenu)}>
            <GitBranch size={11} />
            <span style={{ fontWeight: 600 }}>{activeBranch}</span>
            <ChevronDown size={10} style={{ marginLeft: '4px' }} />
            
            {showBranchMenu && (
              <div 
                style={{ 
                  position: 'absolute', 
                  bottom: '22px', 
                  left: 0, 
                  backgroundColor: 'var(--bg-panel)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '4px',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 2000,
                  width: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '4px 0'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: '6px 12px', fontSize: '10px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold' }}>Branches</div>
                {Object.keys(branchFiles).map(b => (
                  <div 
                    key={b}
                    onClick={() => { handleSwitchBranch(b); setShowBranchMenu(false); }}
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '11px',
                      color: b === activeBranch ? 'var(--accent-indigo)' : 'var(--text-primary)',
                      backgroundColor: b === activeBranch ? 'rgba(99,102,241,0.08)' : 'transparent',
                      fontWeight: b === activeBranch ? 'bold' : 'normal'
                    }}
                    className="branch-menu-item"
                  >
                    {b}
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>
                <div 
                  onClick={() => { handleCreateBranch(); setShowBranchMenu(false); }}
                  style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}
                  className="branch-menu-item"
                >
                  + Neuer Branch...
                </div>
              </div>
            )}
          </div>

          {/* Diagnostics warning/error count toggle panel */}
          <div className="statusbar-item" onClick={() => setShowProblemsPanel(!showProblemsPanel)} style={{ cursor: 'pointer' }} title="Probleme ein-/ausblenden">
            <AlertCircle size={11} style={{ color: diagnostics.filter(d => d.severity === "error").length > 0 ? "var(--accent-red)" : "inherit" }} />
            <span style={{ marginLeft: '4px' }}>{diagnostics.filter(d => d.severity === "error").length}</span>
            <AlertTriangle size={11} style={{ color: diagnostics.filter(d => d.severity === "warning").length > 0 ? "var(--accent-yellow)" : "inherit", marginLeft: '8px' }} />
            <span style={{ marginLeft: '4px' }}>{diagnostics.filter(d => d.severity === "warning").length}</span>
          </div>

          <div className="statusbar-item" title={yjsUrl}>
            <span>Yjs Sync: </span>
            <span style={{ 
              color: yjsStatus === "connected" 
                ? "var(--accent-green)" 
                : yjsStatus === "connecting" 
                  ? "var(--accent-yellow)" 
                  : "var(--accent-red)", 
              fontWeight: 'bold' 
            }}>
              {yjsStatus === "connected" 
                ? (language === "en" ? "Connected" : "Verbunden") 
                : yjsStatus === "connecting" 
                  ? (language === "en" ? "Connecting..." : "Verbinde...") 
                  : (language === "en" ? "Offline" : "Offline")}
            </span>
          </div>
        </div>

        <div className="statusbar-right">
          <span>Zeilen: {activeFile.content.split('\n').length}</span>
          <span>UTF-8</span>
          <span>Markdown</span>
        </div>
      </footer>

      {/* Visual DiffViewer overlay dialog */}
      {diffTargetFile && (
        <DiffViewer 
          originalContent={INITIAL_FILES.find(f => f.path === diffTargetFile)?.content || ""}
          modifiedContent={files.find(f => f.path === diffTargetFile)?.content || ""}
          fileName={diffTargetFile.split('/').pop() || diffTargetFile}
          onClose={() => setDiffTargetFile(null)}
        />
      )}

      {/* Cheatsheet Modal Overlay */}
      {showCheatsheetModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
          onClick={() => setShowCheatsheetModal(false)}
        >
          <div 
            style={{
              backgroundColor: 'var(--bg-sidebar)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={20} style={{ color: 'var(--accent-indigo)' }} />
                <span style={{ fontWeight: 600, fontSize: '16px', color: 'var(--text-primary)' }}>Syntax-Hilfe & Editor Cheatsheet</span>
              </div>
              <button 
                onClick={() => setShowCheatsheetModal(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                className="action-icon-btn"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content (Grid of 3 columns) */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', backgroundColor: 'var(--bg-sidebar)' }}>
              
              {/* Column 1: Markdown Basics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', margin: 0 }}>
                  Markdown Basics
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>Überschriften</div>
                  <pre style={{ margin: 0, padding: '6px', fontSize: '11px', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    {"# H1 Überschrift\n## H2 Überschrift\n### H3 Überschrift"}
                  </pre>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>Formatierung & Listen</div>
                  <pre style={{ margin: 0, padding: '6px', fontSize: '11px', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    {"**Fett** oder *Kursiv*\n- Liste Punkt 1\n- Liste Punkt 2\n1. Nummeriert 1\n2. Nummeriert 2"}
                  </pre>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>Tabellen & Checklisten</div>
                  <pre style={{ margin: 0, padding: '6px', fontSize: '11px', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
                    {"| Spalte 1 | Spalte 2 |\n| :--- | :--- |\n| Wert 1 | Wert 2 |\n\n- [ ] Offene Aufgabe\n- [x] Erledigte Aufgabe"}
                  </pre>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>Formatierungserweiterung</div>
                  <pre style={{ margin: 0, padding: '6px', fontSize: '11px', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    {"==Gelber Highlight-Text==\n~~Durchgestrichener Text~~"}
                  </pre>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button className="cheatsheet-btn" onClick={() => { insertTemplateBlock("highlight"); setShowCheatsheetModal(false); }} style={{ padding: '2px 6px', fontSize: '9px' }}>== Highlight</button>
                    <button className="cheatsheet-btn" onClick={() => { insertTemplateBlock("strikethrough"); setShowCheatsheetModal(false); }} style={{ padding: '2px 6px', fontSize: '9px' }}>~~ Strike</button>
                  </div>
                </div>
              </div>

              {/* Column 2: Advanced MDTeam Features */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', margin: 0 }}>
                  Workspace Features
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Link size={12} style={{ color: 'var(--accent-indigo)' }} />
                    <span>Dateireferenz (Transklusion)</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Zitiert Abschnitte live aus anderen Dateien:</div>
                  <pre style={{ margin: 0, padding: '6px', fontSize: '11px', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    {"@[arc42/02_constraints.md#L4-L8]"}
                  </pre>
                  <button className="cheatsheet-btn" onClick={() => { insertTemplateBlock("reference"); setShowCheatsheetModal(false); }} style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                    <Plus size={10} /> Einfügen
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Box size={12} style={{ color: 'var(--accent-blue)' }} />
                    <span>Draw.io / diagrams.net</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Bettet interaktive Vektorgrafiken ein:</div>
                  <pre style={{ margin: 0, padding: '6px', fontSize: '11px', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    {"```drawio\n[Draw.io Embed URL]\n```"}
                  </pre>
                  <button className="cheatsheet-btn" onClick={() => { insertTemplateBlock("drawio"); setShowCheatsheetModal(false); }} style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                    <Plus size={10} /> Einfügen
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Share2 size={12} style={{ color: 'var(--accent-indigo)' }} />
                    <span>Mermaid Diagramme</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Erstellt Grafiken direkt aus Text-Code:</div>
                  <pre style={{ margin: 0, padding: '6px', fontSize: '11px', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    {"```mermaid\ngraph TD\n    A[Start] --> B[Ziel]\n```"}
                  </pre>
                  <button className="cheatsheet-btn" onClick={() => { insertTemplateBlock("mermaid"); setShowCheatsheetModal(false); }} style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                    <Plus size={10} /> Einfügen
                  </button>
                </div>
              </div>

              {/* Column 3: Roadmap & Milestones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', margin: 0 }}>
                  Roadmap & YAML
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} style={{ color: 'var(--accent-green)' }} />
                    <span>YAML Meilenstein-Block</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Füttert die Dashboard-Timeline und generiert Milestone-Cards:</div>
                  <pre style={{ margin: 0, padding: '6px', fontSize: '11px', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
                    {"---\ntitle: \"Titel\"\nstatus: \"pending\"\nmilestone: \"M1\"\nstart_date: \"2026-06-01\"\nend_date: \"2026-06-15\"\nassignee: \"Developer\"\ncolor: \"#a855f7\"\n---"}
                  </pre>
                  <button className="cheatsheet-btn" onClick={() => { insertTemplateBlock("roadmap-item"); setShowCheatsheetModal(false); }} style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                    <Plus size={10} /> Einfügen
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Users size={12} style={{ color: 'var(--accent-indigo)' }} />
                    <span>Agile & Scrum-Syntax</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Kanban-Tasks & Impediment-Blocker:</div>
                  <pre style={{ margin: 0, padding: '6px', fontSize: '11px', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
                    {"- [ ] TODO: OAuth2-Verbindung testen @developer-a\n- [ ] BLOCKED: Firewall gesperrt @scrummaster"}
                  </pre>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button className="cheatsheet-btn" onClick={() => { insertTemplateBlock("backlog"); setShowCheatsheetModal(false); }}>
                      <Plus size={10} /> Backlog
                    </button>
                    <button className="cheatsheet-btn" onClick={() => { insertTemplateBlock("blocker"); setShowCheatsheetModal(false); }}>
                      <Plus size={10} /> Blocker
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.05)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={12} style={{ color: 'var(--accent-indigo)' }} />
                    <span>Monaco Autocomplete (Tipp!)</span>
                  </div>
                  Tippen Sie einfach <code>@</code> oder <code>@[</code> um Dateipfade zu vervollständigen, oder schreiben Sie YAML-Schlüssel inside <code>---</code> um Feldnamen und Statuswerte direkt einzufügen.
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-panel)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tastenkombination: Drücken Sie <kbd style={{ padding: '2px 4px', border: '1px solid var(--border-color)', borderRadius: '3px', fontSize: '10px', backgroundColor: 'var(--bg-sidebar)' }}>Ctrl</kbd> + <kbd style={{ padding: '2px 4px', border: '1px solid var(--border-color)', borderRadius: '3px', fontSize: '10px', backgroundColor: 'var(--bg-sidebar)' }}>/</kbd> zum Umschalten</span>
              <button 
                className="git-btn" 
                onClick={() => setShowCheatsheetModal(false)}
                style={{ padding: '6px 16px', margin: 0 }}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual DiffViewer overlay dialog */}
      {diffTargetFile && (
        <DiffViewer 
          originalContent={INITIAL_FILES.find(f => f.path === diffTargetFile)?.content || ""}
          modifiedContent={files.find(f => f.path === diffTargetFile)?.content || ""}
          fileName={diffTargetFile.split('/').pop() || diffTargetFile}
          onClose={() => setDiffTargetFile(null)}
        />
      )}

      {printScope && (
        <div id="print-capture-container" className="markdown-body" style={{ display: 'none', padding: '40px', backgroundColor: '#fff', color: '#000' }}>
          {printScope === "book" ? (
            <>
              <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>MDTeam arc42 Architekturdokumentation (Gesamtausgabe)</h1>
              {files.filter(f => f.category === "arc42").sort((a, b) => a.name.localeCompare(b.name)).map((f, idx) => (
                <div key={f.path} style={{ pageBreakAfter: 'always', marginTop: '20px' }}>
                  <h2 style={{ borderBottom: '2px solid #333', paddingBottom: '8px' }}>
                    {idx + 1}. {f.name.replace(".md", "").replace(/^\d+_/, "").replace(/_/g, " ").toUpperCase()}
                  </h2>
                  {parseMarkdown(f.content)}
                </div>
              ))}
            </>
          ) : (
            <>
              <h1 style={{ borderBottom: '2px solid #333', paddingBottom: '8px' }}>
                {activeFile.name.replace(".md", "").replace(/^\d+_/, "").replace(/_/g, " ").toUpperCase()}
              </h1>
              {parseMarkdown(activeFile.content)}
            </>
          )}
        </div>
      )}

      {/* Collaborator Presence Cursor Styles */}
      <style>{`
        .collab-cursor-BobDev {
          border-left: 2px solid #ef4444 !important;
          background-color: rgba(239, 68, 68, 0.05);
        }
        .collab-cursor-AliceArch {
          border-left: 2px solid #10b981 !important;
          background-color: rgba(16, 185, 129, 0.05);
        }
        .backlink-item:hover {
          color: var(--accent-indigo) !important;
        }
        .branch-menu-item {
          cursor: pointer;
          transition: background-color 0.1s;
        }
        .branch-menu-item:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
        .pane-focused {
          border-top-color: var(--accent-indigo) !important;
          background-color: rgba(99, 102, 241, 0.03) !important;
        }
      `}</style>
    </div>
  );
}
