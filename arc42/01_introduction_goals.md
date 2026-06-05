# 1. Einführung und Ziele

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

