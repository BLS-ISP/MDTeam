import type { WorkspaceFile } from "../../utils/issueEngine";

export const SEED_ARC42_AND_ADRS: WorkspaceFile[] = [
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
`,
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
`,
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
`,
  },
];
