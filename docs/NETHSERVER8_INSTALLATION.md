# MDTeam Workspace — NethServer 8 Installation & Administration Guide (EN / DE)

Practical cluster administrator reference for installing, configuring, backing up, and updating **MDTeam Workspace** as a rootless **NethServer 8 (NS8)** module (`ghcr.io/bls-isp/mdteam-ns8`).

* [1. English Administrator Guide](#1-english-administrator-guide)
* [2. Deutsches Administrationshandbuch](#2-deutsches-administrationshandbuch)

---

## 1. English Administrator Guide

### 1.1 Architecture & Prerequisites

MDTeam Workspace runs as an isolated, rootless Podman pod inside NethServer 8 with zero external database dependencies:

* **`mdteam-web`** (`ghcr.io/bls-isp/mdteam/workspace-web:latest`) — Next.js UI & Nginx gateway bound strictly to `127.0.0.1:${TCP_PORT}` behind NS8's node **Traefik** reverse proxy (`/` HTTP/HTTPS + `/ws` Yjs WebSocket upgrade).
* **`mdteam-api`** (`ghcr.io/bls-isp/mdteam/api-server:latest`) — Node 20 Git-Bridge, RBAC, OIDC, and native RFC 4511 LDAPv3 client storing repositories and metadata on the persistent `mdteam-data` volume.
* **`mdteam-yjs`** (`ghcr.io/bls-isp/mdteam/yjs-server:latest`) — Real-time CRDT multi-cursor & Planning Poker collaboration server.

**Prerequisites:**
1. A running **NethServer 8** cluster node with DNS `A` / `AAAA` record pointing your chosen FQDN (e.g. `mdteam.example.org`) to the NS8 node.
2. *(Optional)* An **OpenLDAP** (`rfc2307`) or **Samba Active Directory** (`ad`) User Domain configured in NS8 Cluster-Admin under **Domains and users**.

### 1.2 One-Line SSH Installation

Connect to your NethServer 8 leader node via SSH as `root` and install the module on node `1` (replace `1` with the target node ID if deploying on another worker node):

```bash
add-module ghcr.io/bls-isp/mdteam-ns8:latest 1
```

The command outputs the created module instance identifier (for example `{"module_id": "mdteam1", ...}`).

### 1.3 Initial Configuration in NS8 Cluster-Admin

1. Sign in to **NS8 Cluster-Admin** at `https://<ns8-host>/cluster-admin`.
2. Open **Applications** → **MDTeam Workspace (`mdteam1`)** → **Settings**.
3. Configure **Hostname & HTTPS Routing**:
   * **MDTeam Workspace FQDN (Hostname):** Enter a dedicated hostname (e.g. `mdteam.example.org`). The module validates via Traefik that the hostname is not already used by another route.
   * **Request Let's Encrypt certificate:** Enable when the FQDN is publicly reachable on ports `80`/`443` for ACME validation. Disable in internal LANs to use the NS8 cluster TLS certificate.
   * **Redirect HTTP traffic to HTTPS:** Keep enabled (recommended) so all browser sessions and secure `HttpOnly` JWT cookies run over TLS (`https://` and `wss://`).
4. Bind an **NethServer 8 User Domain (OpenLDAP / Active Directory)**:
   * **User domain:** Select your NS8 OpenLDAP or Samba Active Directory domain from the dropdown (or choose *None* to use only local MDTeam accounts / OIDC SSO).
   * When a domain is selected, NS8 automatically injects local `Ldapproxy` (`accountprovider`) credentials and subscribes `mdteam1` to `ldap-provider-changed` events so proxy port or bind secret rotations reload seamlessly.
5. *(Optional)* Set a **Local admin password** (minimum 8 characters, no spaces/quotes/`=`) to initialize or update `MDTEAM_INITIAL_PASSWORD` for seeded local fallback accounts (`admin`, `po`, `sm`, `dev-a`, `stakeholder`).
6. Click **Save**. Open **Status** and click **Open MDTeam Workspace** (`https://<your-fqdn>`).

### 1.4 Directory Group to Scrum Role Mapping

During LDAP / Active Directory login, MDTeam authenticates the user via an LDAP search followed by a direct user DN bind, then resolves their **Scrum Role** dynamically on every sign-in:

| Priority | Settings Field / Env Variable | Matched LDAP / AD Group (CN) | Assigned MDTeam Role | Permissions Summary |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Admin group** (`LDAP_ADMIN_GROUP`) | e.g. `Domain Admins` or `mdteam-admins` | `admin` | Full workspace, Scrum, user, OIDC & webhook administration |
| **2** | **Product Owner group** (`LDAP_PO_GROUP`) | e.g. `mdteam-po` | `product-owner` | Product Goal, Product Backlog ordering, Sprint Review acceptance, Wiki & Issues |
| **3** | **Scrum Master group** (`LDAP_SM_GROUP`) | e.g. `mdteam-sm` | `scrum-master` | Scrum Policy (`strict`/`pragmatic`/`kanban`), 4 Ceremonies, Board & Wiki |
| **4** | *(Optional env)* `LDAP_STAKEHOLDER_GROUP` | e.g. `mdteam-stakeholders` | `stakeholder` | Clean read-only Wiki/Board access, comments & Sprint Review feedback (`403` on writes) |
| **Fallback** | **Default Scrum role** (`LDAP_DEFAULT_ROLE`) | *(Any authenticated domain user)* | `developer` *(default)*, `stakeholder`, `scrum-master`, or `product-owner` | Configurable baseline role (`developer` edits issues/wiki; choose `stakeholder` for strict read-only default) |

* Both **Samba Active Directory** (`sAMAccountName`, `userPrincipalName`, `mail`, `memberOf`) and **OpenLDAP RFC 2307** (`uid`, `mail`, `cn`, `memberOf` / POSIX `memberUid`) are supported out of the box.

### 1.5 Backup, Restore, Cloning & Updating

#### Backup, Restore & Clone (Cluster-Admin UI)
MDTeam integrates natively with NethServer 8's **Restic** backup engine (`state/secrets.env` + persistent `mdteam-data` volume containing all Git repositories, attachments, users, and webhook settings):

* **Scheduled Backups:** In Cluster-Admin, open **Backup**, add a backup repository, and include `mdteam1` in your backup schedule. The **Status** page of `mdteam1` displays live backup status and last run metrics.
* **Restore:** Navigate to **Backup** → **Restore app**, choose your `mdteam1` snapshot, and restore in place or onto another cluster node. Traefik routes and `Ldapproxy` bindings are re-registered automatically.
* **Clone:** In **Applications** → `mdteam1` three-dot menu → **Clone**, select the destination node and assign a new FQDN in the cloned instance's **Settings**.

#### Updating the Module via CLI or Software Center
To update an existing instance (`mdteam1`) to the latest published container images via SSH on the leader node:

```bash
api-cli run update-module --data '{"module_url":"ghcr.io/bls-isp/mdteam-ns8:latest","instances":["mdteam1"]}'
```

#### Inspecting Logs & Service Health
* **UI:** Click **View logs** on the **System Logs** card in `mdteam1` → **Status**.
* **CLI:** Run `runagent -m mdteam1 systemctl --user status mdteam.service mdteam-api.service mdteam-yjs.service mdteam-web.service`.

---

## 2. Deutsches Administrationshandbuch

### 2.1 Architektur & Voraussetzungen

**MDTeam Workspace** läuft unter **NethServer 8 (NS8)** als vollständig isolierter, rootless Podman-Pod ohne externe Datenbankabhängigkeit:

* **`mdteam-web`** — Next.js-Oberfläche & Nginx-Reverse-Proxy, strikt gebunden an `127.0.0.1:${TCP_PORT}` hinter dem NS8-**Traefik**-Proxy (inklusive `/ws` Echtzeit-WebSockets).
* **`mdteam-api`** — Node-20-Git-Bridge-, RBAC-, OIDC- und nativer LDAPv3-Server mit persistentem Datenvolume `mdteam-data`.
* **`mdteam-yjs`** — Echtzeit-CRDT-Server für simultanes Editieren und Planning Poker.

**Voraussetzungen:**
1. Ein betriebsbereiter **NethServer 8**-Clusterknoten sowie ein DNS-Eintrag (`A` / `AAAA`), der den gewünschten Hostnamen (z. B. `mdteam.example.org`) auf den NS8-Knoten verweist.
2. *(Optional)* Eine in NS8 unter **Domänen und Benutzer** eingerichtete **OpenLDAP**- (`rfc2307`) oder **Samba Active Directory**-Benutzerdomäne (`ad`).

### 2.2 Einzeilige SSH-Installation

Verbinden Sie sich per SSH als `root` mit dem NethServer-8-Leader-Knoten und installieren Sie das Modul auf Knoten `1` (bzw. Ihrer gewünschten Node-ID):

```bash
add-module ghcr.io/bls-isp/mdteam-ns8:latest 1
```

Als Ausgabe erhalten Sie die Instanz-ID des neuen Moduls (standardmäßig `mdteam1`).

### 2.3 Erstkonfiguration im NS8 Cluster-Admin

1. Öffnen Sie den **NS8 Cluster-Admin** unter `https://<ns8-host>/cluster-admin`.
2. Wechseln Sie zu **Anwendungen** → **MDTeam Workspace (`mdteam1`)** → **Einstellungen**.
3. Konfigurieren Sie **Hostname & HTTPS-Routing**:
   * **MDTeam Workspace FQDN (Hostname):** Tragen Sie den gewünschten Domainnamen ein (z. B. `mdteam.example.org`). Eine Kollisionsprüfung verhindert doppelte Traefik-Routen.
   * **Let's-Encrypt-Zertifikat anfordern:** Aktivieren, sofern der Hostname öffentlich über Port `80`/`443` erreichbar ist (im internen LAN deaktiviert lassen, um das Cluster-Zertifikat zu nutzen).
   * **HTTP-Verkehr auf HTTPS weiterleiten:** Aktiviert lassen (empfohlen für verschlüsselte Sitzungs-Cookies und sichere `wss://`-Verbindungen).
4. **NethServer 8 Benutzerdomäne (OpenLDAP / Active Directory)** anbinden:
   * Wählen Sie unter **Benutzerdomäne** Ihre NS8-OpenLDAP- oder Active-Directory-Domäne aus (oder *Keine*, falls ausschließlich lokale Konten bzw. OIDC genutzt werden).
   * NS8 übergibt die lokalen `Ldapproxy`-Verbindungsdaten (`accountprovider`) automatisch und aktualisiert den Dienst bei Änderungen (`ldap-provider-changed`) unterbrechungsfrei.
5. *(Optional)* Setzen Sie unter **Lokales Admin-Passwort** (mind. 8 Zeichen, keine Leerzeichen/Anführungszeichen/`=`) das Initialpasswort für lokale Notfallkonten (`admin`).
6. Klicken Sie auf **Speichern** und starten Sie die Anwendung über **Status** → **MDTeam Workspace öffnen** (`https://<ihr-fqdn>`).

### 2.4 Gruppen-zu-Scrum-Rollen-Zuordnung (RBAC)

Bei jeder Anmeldung eines Domänenbenutzers prüft MDTeam dessen Gruppenzugehörigkeiten (`memberOf` bzw. POSIX `memberUid`) in absteigender Priorität:

| Priorität | Einstellungsfeld | Beispiel-Gruppe (CN) | MDTeam-Scrum-Rolle | Berechtigungen |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Admin-Gruppe** | `Domain Admins` / `mdteam-admins` | `admin` | Vollzugriff inklusive Benutzer-, SSO- & Webhook-Verwaltung |
| **2** | **Product-Owner-Gruppe** | `mdteam-po` | `product-owner` | Product Goal, Product-Backlog-Priorisierung, Sprint-Review-Abnahme, Tickets & Wiki |
| **3** | **Scrum-Master-Gruppe** | `mdteam-sm` | `scrum-master` | Scrum-Policy (`strict`/`pragmatic`/`kanban`), alle 4 Zeremonien, Board & Wiki |
| **4** | *(Umgebungsvariable)* `LDAP_STAKEHOLDER_GROUP` | `mdteam-stakeholders` | `stakeholder` | Reiner Lesezugriff (Clean Mode), Kommentare & Review-Feedback |
| **Standard** | **Standard-Scrum-Rolle** | *(Alle übrigen Domänenbenutzer)* | `developer` *(Standard)*, `stakeholder`, `scrum-master` oder `product-owner` | Basisrolle für Domänenmitglieder ohne spezielle Gruppenzuweisung |

### 2.5 Backup, Wiederherstellung, Klonen & Updates

* **Backup & Restore:** Über das NS8-Menü **Backup** werden sowohl `state/secrets.env` (JWT- & LDAP-Geheimnisse) als auch das Podman-Volume `mdteam-data` (alle Git-Repositories, Anhänge und Benutzereinstellungen) konsistent per Restic gesichert und bei Bedarf auf demselben oder einem anderen Knoten wiederhergestellt.
* **Instanz klonen:** Über das Drei-Punkte-Menü von `mdteam1` → **Klonen** lässt sich eine Test- oder Staging-Kopie erstellen (anschließend in den **Einstellungen** des Klons einen eigenen FQDN vergeben).
* **Modul aktualisieren (CLI):** Führen Sie auf dem Leader-Knoten folgenden Befehl aus, um `mdteam1` auf die neueste Version zu heben:

```bash
api-cli run update-module --data '{"module_url":"ghcr.io/bls-isp/mdteam-ns8:latest","instances":["mdteam1"]}'
```
