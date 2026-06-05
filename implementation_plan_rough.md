# MDTeam Workspace: Git-basiertes VSCode-Style Kollaborationstool für arc42 & Projektmanagement

Dieses Dokument beschreibt die detaillierte Konzeption und den vorgeschlagenen Technologie-Stack für das neue firmeninterne Tool (**MDTeam Workspace**). Es vereint die vertraute Arbeitsweise von Entwicklern (Git-basiert, Markdown, VSCode-UI) mit den visuellen und organisatorischen Anforderungen von Projektmanagern (Roadmaps, Meilensteine, Meeting-Zusammenfassungen).

---

## 1. Systemarchitektur & Datenfluss

Das System wird als **hybride Web- & Desktop-Anwendung** konzipiert. Der Core besteht aus einer React-Anwendung, die sowohl im Browser läuft als auch via Tauri als native Desktop-App für Entwickler bereitgestellt werden kann.

### Architektur-Übersicht

```mermaid
graph TD
    subgraph Client-Tier [Entwickler / PM Clients]
        WebClient[Web-App im Browser]
        TauriClient[Tauri Desktop-App]
        Monaco[Monaco Editor]
        Collab[Yjs Client]
    end

    subgraph Sync-Tier [Kollaborations-Layer (Lokal oder Zentral)]
        LocalSync[Lokaler Yjs Docker-Container / Prozess]
        CentralSync[Zentraler Yjs Server]
    end

    subgraph Backend-Tier [Zentraler App-Server]
        Auth[Modular Auth Gateway: AD/LDAP, Keycloak/OIDC, OAuth2]
        GitBridge[Git Bridge Service]
    end

    subgraph Storage-Tier [Infrastruktur]
        GitRepo[(Git-Server: GitHub / GitLab)]
        Redis[(Redis Cache - Live Session State)]
    end

    TauriClient --> Monaco
    WebClient --> Monaco
    
    %% Sync Verbindung
    Collab <-->|WebSocket| LocalSync
    Collab <-->|WebSocket| CentralSync
    CentralSync <--> Redis
    
    %% API & Git
    TauriClient <-->|Git API| GitBridge
    WebClient <-->|Git API| GitBridge
    GitBridge <-->|Auth & Proxy Commit| GitRepo
    
    %% Authentifizierung
    TauriClient & WebClient -->|Login| Auth
```

---

## 2. Kernfunktionen & User Experience

### A. Developer Mode (Entwickler-Fokus)
*   **VSCode-ähnliches Layout:** 
    *   **Sidebar:** Datei-Explorer, Git-Änderungen (Stage/Commit/Push/Pull), arc42-Struktur-Assistent, Suchfunktion.
    *   **Editor-Bereich:** Editor auf Basis von **Monaco Editor** (oder CodeMirror 6) mit nativer Tab-Verwaltung, Split-Screen (Markdown links, Live-Vorschau rechts).
    *   **Status-Leiste:** Aktueller Git-Branch, Online-Kollaborationsstatus, aktiver Cursor-Name, Wortanzahl.
*   **Voller Markdown & arc42 Support:**
    *   **arc42-Quickstart:** Erstellt per Klick die offizielle arc42-Struktur (12 standardisierte Kapitel als separate `.md` Dateien oder als eine strukturierte Monolith-Datei).
    *   **Interactive Styleblocks & Snippets:** Eingabehilfen (z. B. `/adr` für Architecture Decision Records, `/table` für Tabellenschablonen, `/mermaid` für UML/Flussdiagramme).
    *   **Native Markdown-Blöcke & Formatierungshilfen:**
        *   Schnelles Einfügen von standardisierten Elementen wie Checklisten/Tasklisten (`- [ ]`), nummerierten/unnummerierten Listen, Zitatblöcken (Blockquotes) und Code-Blöcken.
        *   Steuerung über eine schwebende Toolbar (Floating Menu), Tastatur-Shortcuts (z. B. `Strg+Shift+C` für eine Checkbox) sowie ein Slash-Command-Menü (z. B. `/todo`, `/list`, `/table`).
    *   **Linting & Style Guide:** Automatische Validierung von Markdown-Konventionen und Strukturvorgaben.

### B. Project Manager Mode (PM-Fokus)
*   **Dashboard-Generierung:** Das System scannt die Markdown-Dateien nach strukturierten Metadaten (YAML-Frontmatter oder spezifischen Markdown-Blöcken) und visualisiert diese.
*   **Dynamic Timeline (Gantt/Roadmap):**
    *   Entwickler schreiben ihre Ziele, Meilensteine und Termine direkt in eine `roadmap.md` oder in die Frontmatter einzelner Feature-Markdown-Dateien:
        ```yaml
        ---
        title: "Implementierung Auth-Service"
        status: "in-progress"
        milestone: "M1: Alpha-Release"
        start_date: "2026-06-01"
        end_date: "2026-06-15"
        assignee: "Developer A"
        ---
        ```
    *   Das Tool parst diese Daten und rendert ein interaktives Gantt-Diagramm oder eine Timeline für PMs.
*   **Goal & Status Tracking:** Fortschritts-Tracker basierend auf dem Status von Kapiteln oder definierten Meilensteinen in den Markdown-Dokumenten.

### C. Live-Synchronisation & Git-Workflow
*   **Echtzeit-Kollaboration (Yjs):**
    *   **Zentrales Szenario:** Für Teams im gemeinsamen Netzwerk verbindet sich der Client mit dem zentralen Yjs-Server.
    *   **Lokales Szenario (Offline/Einzelarbeit):** Der Client startet/verbindet sich mit einer lokalen Yjs-Instanz (z. B. als Background-Prozess in Tauri oder lokaler Docker-Container), sodass auch ohne Internetverbindung editiert werden kann.
*   **Auto-Commit / Manual-Commit:**
    *   Änderungen werden live in einem In-Memory/Redis-State gehalten.
    *   **Auto-Commit-Modus:** Das Tool commitet Änderungen in konfigurierbaren Abständen (z. B. alle 10 Minuten oder bei Inaktivität) automatisch auf einen Entwickler-Zweig (`sync/dev-name`).
    *   **Manual-Commit-Modus:** Entwickler können Änderungen explizit über ein Git-Panel mit Commit-Message committen und pushen.

### D. Automated Meeting Assistant
*   **Besprechungsvorlagen-Generator:** Generiert automatisch ein Dokument für das nächste Meeting.
    *   **Eingabe:** Vergleich zweier Git-Commits/Tags (z.B. Stand letztes Meeting vs. heute).
    *   **Inhalt:**
        *   Welche Dokumente/Kapitel wurden geändert (inklusive kurzer Zusammenfassung der Änderungen, extrahiert aus Commit-Messages oder LLM-generierten Markdown-Diffs).
        *   Welche neuen Architekturentscheidungen (ADRs) wurden getroffen?
        *   Welche Meilensteine wurden erreicht?
    *   **Output:** Eine editierbare Markdown-Vorlage für das Besprechungsprotokoll mit Standardbereichen wie *Teilnehmer*, *Agenda*, *Beschlüsse*, und *Nächste Schritte*.

### E. Rendering & Export Engine
*   **Live Rendered Preview:** Neben dem Monaco-Editor befindet sich eine Echtzeit-Vorschau (Split-Screen), die das Markdown inklusive Styles, Tabellen, Checkboxen und Mermaid-Diagrammen formatiert darstellt.
*   **Multi-Format Export:**
    *   Benutzer (insb. PMs) können einzelne Dokumente oder die gesamte arc42-Dokumentation (zusammengeführt in ein einziges großes Dokument) exportieren.
    *   **PDF-Export:** Generiert professionell gelayoutete PDF-Berichte mit anpassbarem Deckblatt, Inhaltsverzeichnis (TOC), Kopf- und Fußzeilen (inkl. Seitenzahlen) und Seitenumbrüchen vor Hauptkapiteln.
    *   **Word-Export (DOCX):** Exportiert das Dokument als standardkonforme Microsoft Word-Datei unter Beibehaltung der Überschriftsebenen und Formatierungen (ideal für die Weiterleitung an Kunden oder PMs).

---

## 3. Expliziter Technologie-Stack

| Schicht | Technologie | Begründung |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js (React) + TypeScript** | Ermöglicht schnelle Single-Page-App (SPA) für Editoren und serverseitiges Rendering (SSR) für schnelle Ladezeiten bei PM-Exporten. |
| **Desktop Wrapper** | **Tauri (Rust-basiert)** | Ermöglicht das Paketieren des React-Frontends als native Desktop-App. Extrem ressourcenschonend im Vergleich zu Electron und bietet native API-Brücken. |
| **Styling** | **Custom CSS (CSS Modules) / Tailwind CSS** | Hochgradig anpassbar, perfekt für die Umsetzung eines premium Dark-Modes im VSCode-Style. |
| **Editor Engine** | **Monaco Editor** | Das Herzstück von VSCode. Bietet vertraute Shortcuts, hervorragendes Syntax-Highlighting und Autovervollständigung. |
| **Echtzeit-Synchronisation** | **Yjs (CRDT)** + **y-websocket** + **y-monaco** | Industriestandard für performante Echtzeit-Kollaboration. Unterstützt sowohl zentrale Websockets als auch lokale Ausführung. |
| **Server Engine / API** | **Node.js (NestJS oder Next.js API Routes)** | Zentrale API für modular konfigurierbare Authentifizierung (LDAP, Active Directory, Keycloak / OIDC, OAuth2) und die Git-Kopplung. |
| **Git Bridge & Proxy** | **Isomorphic-Git / Node-Git / Native Git CLI** | Das Backend übernimmt das Klonen und Committen. Es authentifiziert sich über AD/LDAP und führt Git-Aktionen im Namen des Benutzers (per OAuth-Token für GitHub oder SSH-Keys/Tokens für GitLab) aus. |
| **Markdown Parsing** | **Unified / Remark / Rehype** | Modulares Ökosystem zum Parsen von Markdown, Extrahieren von YAML-Frontmatter und Generieren der HTML-Vorschau. |
| **Visualisierung (PM)** | **Mermaid.js** & **Recharts / React-Flow** | Zum Rendern von Timelines, Roadmaps, UML-Diagrammen und Dashboards direkt aus Text. |
| **Session Cache / Live Sync State**| **Redis** | Dient dem Yjs-WebSocket-Server zur Zwischenspeicherung des Live-Editierungs-States vor dem Git-Commit. |
| **Export Engine** | **Puppeteer (PDF) & html-to-docx (Word/DOCX)** | Serverseitige Generierung von PDF-Dateien (mit Deckblatt und Seitenumbrüchen) und Word-Dokumenten aus dem gerenderten HTML. |

---

## 4. Vorgeschlagene Struktur für das Markdown-Repository

Das Git-Repository, welches das Tool verwaltet, folgt einer festen Ordnerstruktur:

```text
/
├── .gitdocs/                   # Konfigurationen für das Tool (z.B. Team-Mitglieder, Rollen)
├── arc42/                      # Der offizielle arc42 Aufbau
│   ├── 01_introduction_goals.md
│   ├── 02_constraints.md
│   ├── 03_context_and_scope.md
│   ├── ...
│   └── 12_glossary.md
├── adrs/                       # Architecture Decision Records (ADRs)
│   ├── ADR-0001-template.md
│   └── ADR-0002-auth-selection.md
├── management/                 # PM-spezifische Markdown-Dateien
│   ├── roadmap.md              # Enthält die Metadaten für die Roadmap-Visualisierung
│   └── backlog.md              # Einfaches Task-Tracking in Markdown
└── meetings/                   # Automatisch generierte und manuell gepflegte Meeting-Protokolle
    ├── 2026-06-03_weekly.md
    └── templates/
```

---

## 5. UI/UX Designentwurf (VSCode Aesthetics)

Das Design orientiert sich an modernen IDEs wie VSCode, jedoch mit einem eleganteren Web-Touch (Vibrant Colors, abgerundete Ecken, dezente Schatten, klar strukturiertes Two-Column-Layout).

Wir entwerfen eine responsive Oberfläche mit einem Dark Mode (z.B. Slate-Grau, tiefblaue Akzente `#3b82f6` und Smaragdgrün `#10b981` für Erfolgsmeldungen und Git-Status).

---

## 6. Integrationsdetails (Basierend auf Feedback)

### A. Git-Hosting & Authentifizierung
*   **Git-Anbindung:** Die Git Bridge unterstützt standardmäßig HTTP(S)- und SSH-Protokolle, sodass sowohl **GitHub Enterprise (Cloud)** als auch **GitLab (Self-hosted)** flexibel angebunden werden können.
*   **Modulares Authentifizierungs-System:**
    *   Um maximale Flexibilität zu gewährleisten, wird das Authentifizierungs-System modular (Strategy Pattern, z. B. via **Passport.js** oder **Auth.js / NextAuth**) aufgebaut.
    *   Unterstützte Login-Methoden:
        *   **LDAP / Active Directory (AD):** Direkte Authentifizierung gegen das Firmennetzwerk.
        *   **OpenID Connect (OIDC) / Keycloak:** Ermöglicht Single Sign-On (SSO) über Keycloak oder andere Identity Provider (Okta, Ping Identity, Azure AD/Entra ID).
        *   **Git-Direktlogin (OAuth2):** Direkte Authentifizierung über GitHub/GitLab, falls die Benutzerkonten dort direkt verwaltet werden.
    *   **Authentifizierungs-Fluss:**
        1. Der Benutzer loggt sich über die gewählte Methode (z.B. Keycloak SSO oder LDAP) ein.
        2. Der Backend-Server validiert die Session und ermittelt das zugehörige Git-Profil.
        3. Der Server verknüpft die SSO-Identität mit dem Git-Repository-Access. Git-Schreibaktionen (Push/Commit) werden über die hinterlegten OAuth-Tokens oder SSH-Schlüssel des jeweiligen Entwicklers autorisiert.
        4. Wenn eine Git-Aktion ausgeführt wird, führt der Server den Push/Pull im Namen dieses Nutzers unter Verwendung des entsprechenden Tokens/Schlüssels aus.

### B. Dual-Plattform Deployment (Web & Desktop)
*   **Entwickler (Desktop):** Erhalten eine Tauri-App, die nativ auf Windows/macOS/Linux läuft. Falls gewünscht, kann diese App auch direkt lokale Repositories ansprechen.
*   **Projektmanager & Stakeholder (Web):** Nutzen das Tool im Browser. Die Authentifizierung erfolgt über das LDAP/AD-geschützte Portal, das Lesezugriff auf die gerenderten Timelines und Dokumente gewährt.

### C. Synchronisations-Infrastruktur
*   **Zentraler Server:** Ein Docker-Image mit Node.js und dem Yjs-WebSocket-Server läuft on-premises (z. B. auf derselben Infrastruktur wie GitLab).
*   **Lokaler Server:** Für Offline-Arbeit oder restriktive Netzwerkumgebungen bringt die Tauri-App einen eingebetteten Yjs-Serverprozess mit (bzw. nutzt ein lokales Docker-Image), der bei Bedarf gestartet wird.

---

## 7. Verifizierungsplan (Proof of Concept)

### Phase 1: Lokales MVP
1. Aufsetzen einer Next.js App mit Tailwind CSS und dem Monaco Editor.
2. Einbinden von Yjs zur Live-Synchronisation im lokalen Netzwerk.
3. Entwicklung des Markdown-Parsers für die Generierung einer interaktiven Roadmap-Timeline aus einer `roadmap.md`.
4. Integration eines lokalen Git-Clients, der Änderungen committet.
