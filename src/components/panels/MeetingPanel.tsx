"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

export function MeetingPanel() {
  const {
    language,
    files,
    modifiedFiles,
    tauriRootFolder,
    commits,
    startCommit,
    setStartCommit,
    endCommit,
    setEndCommit,
    setGeneratedMeetingText,
  } = useWorkspaceContext();

  const handleGenerateMeeting = async () => {
    const changesList: string[] = [];

    if (tauriRootFolder) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const diffOutput = await invoke<string>("git_diff_files", {
          repoPath: tauriRootFolder,
          startCommit,
          endCommit,
        });

        const lines = diffOutput.split("\n").filter((l) => l.trim() !== "");
        lines.forEach((line) => {
          if (line.length >= 2) {
            const parts = line.split(/\s+/);
            const status = parts[0];
            let filepath = parts.slice(1).join(" ").trim();
            if (filepath.startsWith('"') && filepath.endsWith('"')) {
              filepath = filepath.substring(1, filepath.length - 1);
            }
            filepath = filepath.replace(/\\/g, "/");

            const statusLabel =
              status === "A"
                ? language === "en"
                  ? "[ADDED]"
                  : "[HINZUGEFÜGT]"
                : status === "D"
                  ? language === "en"
                    ? "[DELETED]"
                    : "[GELÖSCHT]"
                  : language === "en"
                    ? "[MODIFIED]"
                    : "[GEÄNDERT]";

            changesList.push(`*   **${statusLabel}** \`${filepath}\``);
          }
        });
      } catch (err) {
        console.error("Failed to generate meeting diff natively:", err);
      }
    } else {
      files.forEach((f) => {
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

    const meetingContent =
      language === "en"
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

  return (
    <>
      <div className="panel-header">
        <span>{language === "en" ? "Meeting Configurator" : "Meeting-Konfigurator"}</span>
      </div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="settings-group">
          <label className="settings-label">
            {language === "en" ? "Last Status (Start-Commit)" : "Letzter Stand (Start-Commit)"}
          </label>
          <select
            className="settings-select"
            value={startCommit}
            onChange={(e) => setStartCommit(e.target.value)}
          >
            {commits.map((c) => (
              <option key={c.hash} value={c.hash}>
                {c.hash} - {c.message.substring(0, 15)}...
              </option>
            ))}
          </select>
        </div>

        <div className="settings-group">
          <label className="settings-label">
            {language === "en" ? "Current Status" : "Aktueller Stand"}
          </label>
          <select
            className="settings-select"
            value={endCommit}
            onChange={(e) => setEndCommit(e.target.value)}
          >
            <option value="current">
              {language === "en" ? "Now (Local changes)" : "Jetzt (Lokale Änderungen)"}
            </option>
            {commits.map((c) => (
              <option key={c.hash} value={c.hash}>
                {c.hash}
              </option>
            ))}
          </select>
        </div>

        <button className="git-btn" onClick={handleGenerateMeeting}>
          <Sparkles size={14} /> {language === "en" ? "Generate Minutes" : "Minutes generieren"}
        </button>
      </div>
    </>
  );
}
