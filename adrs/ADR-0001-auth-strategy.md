# ADR-0001: Modulare Authentifizierung

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
