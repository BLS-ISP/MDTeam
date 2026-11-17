import type { WorkspaceFile } from "../../utils/issueEngine";

export const SEED_MANAGEMENT_AND_MEETINGS: WorkspaceFile[] = [
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
`,
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
`,
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
`,
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
`,
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
`,
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
`,
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
`,
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
`,
  },
];
