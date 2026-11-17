import type { WikiTemplateDefinition } from "../components/wiki/wikiTypes";
import { WIKI_TEMPLATES_AGILE } from "./wikiTemplatesAgile";

const WIKI_TEMPLATES_CORE: WikiTemplateDefinition[] = [
  {
    id: "prd",
    name: "PRD - Product Requirements",
    nameDe: "PRD - Produktanforderungen",
    badge: "Product",
    defaultFolder: "wiki",
    slugPrefix: "prd",
    descriptionEn:
      "Structured Product Requirements Document with problem statement, KPIs, user stories, and scope matrix.",
    descriptionDe:
      "Strukturiertes Product Requirements Document mit Zielsetzung, Erfolgsmetriken, User Stories und Abgrenzung.",
    buildContent: (title, author, dateIso, lang) =>
      lang === "en"
        ? `---
title: "${title}"
author: "${author}"
review_status: "draft"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [prd, product, specification]
---

# ${title}

## 1. Executive Summary & Problem Statement
Describe the user pain point, strategic context, and business impact solved by this initiative.

## 2. Goals & Success Metrics (KPIs)
| Metric | Baseline | Target | Measurement Window |
| :--- | :---: | :---: | :--- |
| User Adoption Rate | 0% | > 65% | 30 days post-launch |
| Task Completion Time | 8 min | < 2 min | Sprint Review |

## 3. Target Personas & User Stories
- [ ] **As a Product Manager**, I want live status rollups inside documentation so stakeholder updates stay accurate.
- [ ] **As a Developer**, I want Markdown-first specs stored in Git alongside code and ADRs.

## 4. Functional Scope
### In Scope
* Core workflow implementation and keyboard navigation
* Bilingual UI (\`de\` / \`en\`) and offline-capable desktop support

### Out of Scope
* Legacy third-party proprietary plugins

## 5. Risks & Open Questions
> **Open Decision:** Confirm SSO group mapping with Security Architecture before GA release.
`
        : `---
title: "${title}"
author: "${author}"
review_status: "draft"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [prd, produkt, spezifikation]
---

# ${title}

## 1. Management Summary & Problemstellung
Beschreiben Sie das Nutzerproblem, den geschäftlichen Nutzen und warum dieses Vorhaben jetzt priorisiert wird.

## 2. Ziele & Erfolgsmetriken (KPIs)
| Kennzahl (KPI) | Ist-Wert | Ziel-Wert | Messzeitraum |
| :--- | :---: | :---: | :--- |
| Aktive Nutzungsrate | 0% | > 65% | 30 Tage nach Go-Live |
| Durchlaufzeit pro Review | 15 Min | < 4 Min | Nächster Sprint |

## 3. Zielgruppen & User Stories
- [ ] **Als Product Owner** möchte ich Live-Abfragen direkt im Dokument einbetten, um jederzeit den echten Sprint-Stand zu sehen.
- [ ] **Als Entwickler:in** möchte ich Anforderungen als sauberes Markdown im Git-Repository versionieren.

## 4. Funktionsumfang & Abgrenzung
### Im Scope (Must-Have)
* Vollständige Tastaturbedienbarkeit und Git-Versionierung
* Zweisprachige Oberfläche (\`de\` / \`en\`)

### Nicht im Scope (Out-of-Scope)
* Proprietäre Drittanbieter-Datenbankabhängigkeiten

## 5. Risiken & Offene Fragen
> **Offener Punkt:** Abstimmung der Berechtigungsrollen mit dem Security-Team bis zum Sprint Planning.
`,
  },
  {
    id: "rfc",
    name: "RFC - Technical Design",
    nameDe: "RFC - Technisches Design",
    badge: "Engineering",
    defaultFolder: "adrs",
    slugPrefix: "rfc",
    descriptionEn:
      "Engineering Request for Comments with architecture diagram, trade-off analysis, and rollout plan.",
    descriptionDe:
      "Technischer Design-Entwurf (RFC) inkl. Mermaid-Architekturdiagramm, Alternativenbewertung und Rollout-Plan.",
    buildContent: (title, author, dateIso, lang) =>
      lang === "en"
        ? `---
title: "${title}"
author: "${author}"
status: "proposed"
review_status: "in-review"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [rfc, architecture, engineering]
---

# ${title}

## 1. Context & Motivation
Explain the technical constraints, scaling bottlenecks, or architectural drivers behind this RFC.

## 2. Proposed Architecture
\`\`\`mermaid
flowchart LR
  Client["MDTeam Client (React 19)"] --> Bridge["Tauri Rust Git Bridge"]
  Client --> Yjs["Yjs CRDT Sync"]
  Bridge --> Repo[("Local & Remote Git Repo")]
\`\`\`

## 3. Design Alternatives Considered
| Option | Pros | Cons | Verdict |
| :--- | :--- | :--- | :---: |
| **Option A: Git-Native Markdown** | Zero DB lock-in, full offline diffing | Requires fast client parser | **Selected** |
| Option B: External SQL Service | Relational joins | Breaks offline-first Git workflow | Rejected |

## 4. Security, Performance & Rollout Plan
- [ ] Sanitize all CLI & file path inputs
- [ ] Add automated verification tests
- [ ] Staged rollout behind workspace role toggle
`
        : `---
title: "${title}"
author: "${author}"
status: "proposed"
review_status: "in-review"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [rfc, architektur, engineering]
---

# ${title}

## 1. Ausgangslage & Motivation
Welche technischen Randbedingungen oder Skalierungsanforderungen machen diesen Entwurf erforderlich?

## 2. Vorgeschlagene Zielarchitektur
\`\`\`mermaid
flowchart LR
  Client["MDTeam Client (React 19)"] --> Bridge["Tauri Rust Git Bridge"]
  Client --> Yjs["Yjs CRDT Sync"]
  Bridge --> Repo[("Lokales & Remote Git-Repo")]
\`\`\`

## 3. Bewertete Handlungsoptionen
| Variante | Vorteile | Nachteile | Entscheidung |
| :--- | :--- | :--- | :---: |
| **Option A: Git-Natives Markdown** | Kein Vendor-Lock-in, volle Offline-Fähigkeit | Client-seitiges Indexing nötig | **Gewählt** |
| Option B: Externe SQL-Datenbank | Komplexe SQL-Joins | Bricht Single-Source-of-Truth in Git | Verworfen |

## 4. Security, Performance & Rollout-Checkliste
- [ ] Strikte Input-Validierung aller Pfade und Parameter
- [ ] Abwärtskompatibilität für bestehende Dokumente sicherstellen
- [ ] Architektur-Review im Team abschließen
`,
  },
  {
    id: "postmortem",
    name: "Incident Post-Mortem",
    nameDe: "Incident Post-Mortem",
    badge: "SRE / Ops",
    defaultFolder: "wiki",
    slugPrefix: "postmortem",
    descriptionEn:
      "Blameless incident retrospective with severity summary, minute-by-minute timeline, 5 Whys root cause, and CAPA actions.",
    descriptionDe:
      "Blameless Incident-Analyse mit Auswirkungsprofil, Minuten-Timeline, 5-Why-Ursachenanalyse und Maßnahmenplan.",
    buildContent: (title, author, dateIso, lang) =>
      lang === "en"
        ? `---
title: "${title}"
author: "${author}"
review_status: "draft"
severity: "SEV-2"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [incident, postmortem, reliability]
---

# ${title}

## 1. Incident Summary
| Field | Value |
| :--- | :--- |
| **Date** | ${dateIso} |
| **Severity** | SEV-2 (Partial Degradation) |
| **Incident Lead** | ${author} |
| **Time to Mitigate (TTM)** | 28 minutes |

## 2. Minute-by-Minute Timeline (UTC)
* **09:12** — Automated alert triggered on elevated WebSocket reconnect latency.
* **09:19** — On-call engineer identified memory spike on sync worker container.
* **09:40** — Rolled back config change and verified healthy sync state.

## 3. Root Cause Analysis (5 Whys)
1. **Why did sync stall?** Connection pool reached max open descriptors.
2. **Why were descriptors exhausted?** Idle rooms were not garbage-collected on disconnect.

## 4. Corrective & Preventive Actions (CAPA)
- [ ] Add room TTL eviction & memory circuit breaker @developer-b
- [ ] Add synthetic reconnect load test to CI pipeline @developer-a
`
        : `---
title: "${title}"
author: "${author}"
review_status: "draft"
severity: "SEV-2"
created_at: "${dateIso}"
updated_at: "${dateIso}"
labels: [incident, postmortem, betrieb]
---

# ${title}

## 1. Vorfalls-Übersicht
| Merkmal | Wert |
| :--- | :--- |
| **Datum** | ${dateIso} |
| **Schweregrad** | SEV-2 (Teilbeeinträchtigung) |
| **Incident Commander** | ${author} |
| **Dauer bis Entstörung** | 28 Minuten |

## 2. Chronologischer Ablauf
* **09:12** — Monitoring meldet erhöhte Reconnect-Zeiten am Sync-Service.
* **09:19** — Bereitschaft identifiziert erschöpftes Connection-Limit im Container.
* **09:40** — Rollback der Konfiguration durchgeführt; Normalbetrieb wiederhergestellt.

## 3. Ursachenanalyse (Blameless 5-Whys)
1. **Warum schlugen Verbindungen fehl?** Das Dateideskriptor-Limit des Containers war erreicht.
2. **Warum wurden Verbindungen nicht freigegeben?** Inaktive Sessions hatten kein Idle-Timeout.

## 4. Korrektur- & Präventionsmaßnahmen
- [ ] Automatisches Idle-Timeout für verwaiste WebSocket-Räume einbauen @developer-b
- [ ] Lasttest für Reconnect-Spitzen in die CI-Pipeline aufnehmen @developer-a
`,
  },
];

/**
 * 6 Rich Confluence Knowledge Base Templates
 */
export const WIKI_TEMPLATES: WikiTemplateDefinition[] = [
  ...WIKI_TEMPLATES_CORE,
  ...WIKI_TEMPLATES_AGILE,
];

export function slugifyFileName(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "new-page"
  );
}
