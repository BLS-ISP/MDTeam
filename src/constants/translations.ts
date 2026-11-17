export type WorkspaceLanguage = "de" | "en";

export const translations = {
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
    issuesTickets: "issues (Jira-Tickets)",
    sprintsFolder: "sprints (Sprints)",
    wikiPages: "wiki (Confluence-Seiten)",
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
    standupIntro:
      "Dieser Bericht wurde automatisch aus Ihrem aktuellen Sprint-Backlog und dem Impediment-Log zusammengestellt. Er kann kopiert und in Ihren Slack/Teams-Kanal oder das Besprechungsprotokoll eingefügt werden.",
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
    issuesTickets: "issues (Jira Tickets)",
    sprintsFolder: "sprints (Sprints)",
    wikiPages: "wiki (Confluence Pages)",
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
    standupIntro:
      "This report was compiled automatically from your active Sprint Backlog and the Impediment Log. It can be copied and pasted into your Slack/Teams channel or meeting minutes.",
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
  },
};

export type TranslationDictionary = typeof translations.de;
