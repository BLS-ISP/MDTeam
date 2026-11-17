import type { WikiTemplateDefinition } from "../components/wiki/wikiTypes";

export const WIKI_TEMPLATES_AGILE: WikiTemplateDefinition[] = [
  {
    id: "release-notes",
    name: "Release Notes",
    nameDe: "Release Notes",
    badge: "Live Query",
    defaultFolder: "wiki",
    slugPrefix: "release-notes",
    descriptionEn:
      "Customer & stakeholder Release Notes featuring embedded live ```query``` blocks pulling completed & open issues automatically!",
    descriptionDe:
      "Release Notes mit eingebetteter Live-Datenbankabfrage (```query```), die erledigte Tickets automatisch aus dem Workspace zieht!",
    buildContent: (title, author, dateIso, lang) =>
      lang === "en"
        ? `---
title: "${title}"
author: "${author}"
review_status: "in-review"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [release, changelog]
---

# ${title}

> **Release Highlights:** Summary of shipped features, architectural improvements, and resolved bugs for this milestone.

## 1. Key Highlights
* **Git-Native Jira & Confluence Workspace:** Unified Sprint Boards, Live Queries, and OpenXML Word exports directly over Git Markdown files.
* **Zero-Lock-In Collaboration:** Full offline & real-time Yjs editing parity.

## 2. Shipped Issues (Live Query)
\`\`\`query
FROM issues
WHERE status = done
SORT priority DESC
VIEW table
\`\`\`

## 3. Remaining Open Items in Active Scope
\`\`\`query
FROM issues
WHERE status != done
SORT priority DESC
VIEW cards
\`\`\`

## 4. Upgrade & Verification Checklist
- [x] Zero TypeScript or linter errors
- [ ] Stakeholder sign-off via Page Governance Bar (\`Approved\`)
`
        : `---
title: "${title}"
author: "${author}"
review_status: "in-review"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [release, changelog]
---

# ${title}

> **Release-Überblick:** Zusammenfassung aller ausgelieferten Funktionen, Verbesserungen und behobenen Fehler dieser Version.

## 1. Wichtigste Neuerungen
* **Git-Nativer Jira- & Confluence-Workspace:** Interaktive Sprint-Boards, Live-Datenbankabfragen und direkter Microsoft Word (\`.docx\`) Export.
* **Volle Datenhoheit:** Alle Tickets, Reviews und Architekturentscheidungen liegen als sauberes Markdown in Git.

## 2. Ausgelieferte Tickets (Live-Abfrage)
\`\`\`query
FROM issues
WHERE status = done
SORT priority DESC
VIEW table
\`\`\`

## 3. Offene Punkte für das Folge-Release
\`\`\`query
FROM issues
WHERE status != done
SORT priority DESC
VIEW cards
\`\`\`

## 4. Freigabe-Checkliste
- [x] Alle Qualitäts- und Build-Prüfungen erfolgreich bestanden
- [ ] Formale Freigabe oben in der Governance-Leiste (\`Freigegeben\`) erteilt
`,
  },
  {
    id: "story-map",
    name: "User Story Map",
    nameDe: "User Story Map",
    badge: "Agile",
    defaultFolder: "management",
    slugPrefix: "story-map",
    descriptionEn:
      "Jeff Patton-style User Story Map organizing backbone user activities across MVP, Release 1.1, and Future slices.",
    descriptionDe:
      "User Story Map nach Jeff Patton: Nutzeraktivitäten horizontal und Release-Slices (MVP, R1.1, Zukunft) vertikal geplant.",
    buildContent: (title, author, dateIso, lang) =>
      lang === "en"
        ? `---
title: "${title}"
author: "${author}"
review_status: "draft"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [story-map, agile, discovery]
---

# ${title}

## 1. User Journey Backbone
| Step 1: Onboard & Import | Step 2: Plan & Estimate | Step 3: Author & Review | Step 4: Ship & Export |
| :--- | :--- | :--- | :--- |
| Connect Git repository | Groom backlog & Epics | Write specs & ADRs | Export DOCX / PDF |
| Import Jira / Confluence | Run Planning Poker | Resolve inline comments | Complete Sprint metrics |

## 2. Release Slices
### Slice 1 — Walking Skeleton (MVP)
- [x] Git workspace explorer + live Markdown split preview
- [ ] Kanban Sprint Board with Fibonacci Story Points

### Slice 2 — Team Collaboration (v1.1)
- [ ] Threaded inline review comments & page approval workflow
- [ ] Live \`\`\`query\`\`\` blocks inside Wiki & Release Notes

### Slice 3 — Enterprise Governance (v1.2)
- [ ] Stakeholder clean reading mode & automated release bundles
`
        : `---
title: "${title}"
author: "${author}"
review_status: "draft"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [story-map, agile, discovery]
---

# ${title}

## 1. User Journey Backbone (Nutzerfluss)
| Phase 1: Onboarding & Import | Phase 2: Sprint-Planung | Phase 3: Dokumentation & Review | Phase 4: Release & Export |
| :--- | :--- | :--- | :--- |
| Git-Repository verbinden | Epics & Stories schneiden | Konzepte & ADRs verfassen | DOCX / PDF Bericht exportieren |
| Jira & Confluence importieren | Planning Poker schätzen | Inline-Kommentare klären | Sprint-Metriken abschließen |

## 2. Vertikale Release-Schnitte (Slices)
### Slice 1 — Kernprodukt (MVP)
- [x] Git-basierter Editor mit Split-Screen-Vorschau
- [ ] Kanban-Board mit Drag & Drop und Story Points

### Slice 2 — Team-Kollaboration (v1.1)
- [ ] Inline-Review-Threads & Dokument-Freigabestatus
- [ ] Dynamische \`\`\`query\`\`\` Makros in Wiki-Seiten

### Slice 3 — Stakeholder-Reporting (v1.2)
- [ ] Aufgeräumter Stakeholder-Modus & Management-Exporte
`,
  },
  {
    id: "onboarding",
    name: "Onboarding Guide",
    nameDe: "Onboarding-Leitfaden",
    badge: "People",
    defaultFolder: "wiki",
    slugPrefix: "onboarding",
    descriptionEn:
      "First-week engineering & PM onboarding playbook with environment setup, key architecture links, and 30-60-90 day milestones.",
    descriptionDe:
      "Strukturierter Einarbeitungsplan für neue Teammitglieder inkl. Setup-Checkliste, Architektur-Links und 30-60-90-Tage-Zielen.",
    buildContent: (title, author, dateIso, lang) =>
      lang === "en"
        ? `---
title: "${title}"
author: "${author}"
review_status: "approved"
approved_by: "${author}"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [onboarding, handbook, team]
---

# ${title}

Welcome to the team! This guide walks you through your local setup, architecture conventions, and first sprint milestones.

## 1. Day 1 Environment Checklist
- [ ] Clone the project repository and verify Git SSH/HTTPS credentials
- [ ] Read [Introduction & Goals](arc42/01_introduction_goals.md) and [System Constraints](arc42/02_constraints.md)
- [ ] Review accepted decisions in [ADR-0001 Auth Strategy](adrs/ADR-0001-auth-strategy.md)
- [ ] Pick your starter ticket on the Scrum Board

## 2. Team Rituals & Contacts
| Ceremony | Cadence | Owner |
| :--- | :--- | :--- |
| Daily Standup | Daily 09:30 | \`@scrum-master\` |
| Sprint Planning & Poker | Bi-weekly Monday | \`@product-owner\` |
| Architecture Guild | Thursday 14:00 | \`@developer-a\` |

## 3. 30 / 60 / 90 Day Milestones
1. **First 30 Days:** Ship your first Story & participate in inline doc reviews.
2. **First 60 Days:** Author an RFC/ADR and lead a feature demo in Sprint Review.
3. **First 90 Days:** Own an Epic end-to-end from PRD to Release Notes.
`
        : `---
title: "${title}"
author: "${author}"
review_status: "approved"
approved_by: "${author}"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [onboarding, handbuch, team]
---

# ${title}

Willkommen im Team! Dieser Leitfaden begleitet dich durch das technische Setup, unsere Architektur-Dokumentation und deine ersten Wochen.

## 1. Tag-1 Setup-Checkliste
- [ ] Git-Repository klonen und Zugangsdaten prüfen
- [ ] [Einführung und Ziele](arc42/01_introduction_goals.md) sowie [Randbedingungen](arc42/02_constraints.md) lesen
- [ ] Aktuelle Architekturentscheidungen prüfen: [ADR-0001 Authentifizierung](adrs/ADR-0001-auth-strategy.md)
- [ ] Erstes Starter-Ticket im Sprint-Board übernehmen

## 2. Team-Termine & Ansprechpersonen
| Regeltermin | Rhythmus | Moderation |
| :--- | :--- | :--- |
| Daily Standup | Täglich 09:30 Uhr | \`@scrum-master\` |
| Sprint Planning & Poker | Alle 2 Wochen montags | \`@product-owner\` |
| Architektur-Runde | Donnerstags 14:00 Uhr | \`@developer-a\` |

## 3. 30 / 60 / 90 Tage Fahrplan
1. **Tag 1–30:** Erstes Feature-Ticket abschließen & Inline-Reviews durchführen.
2. **Tag 31–60:** Eigenen RFC/ADR entwerfen und im Sprint Review präsentieren.
3. **Tag 61–90:** Ein Epic Ende-zu-Ende von PRD bis Release Notes verantworten.
`,
  },
];
