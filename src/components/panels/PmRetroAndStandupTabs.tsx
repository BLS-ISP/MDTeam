"use client";

import React from "react";
import { AlertCircle, Sparkles, Users } from "lucide-react";
import { extractAllIssues } from "../../utils/issueEngine";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import {
  parseBacklogItems,
  parseImpedimentItems,
  parseRetroNotesForFile,
} from "../../utils/workspace/agileMarkdownParsers";

export function PmRetroTab() {
  const { files, language, handleOpenFile, editorRef } = useWorkspaceContext();
  const retroNotes = parseRetroNotesForFile(files, "meetings/2026-06-03_retro.md");
  const impediments = parseImpedimentItems(files);

  return (
    <>
      <div className="timeline-card">
        <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Users size={18} style={{ color: "var(--accent-indigo)" }} />
          {language === "en"
            ? "Sprint Retrospective Sticky Board (meetings/2026-06-03_retro.md)"
            : "Sprint Retrospektive Sticky Board (meetings/2026-06-03_retro.md)"}
        </h3>

        {retroNotes.length === 0 ? (
          <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)", padding: "24px" }}>
            {language === "en" ? "No retro notes found." : "Keine Retro-Notizen gefunden."}
          </div>
        ) : (
          <div className="retro-board" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            {/* Glad Column */}
            <div
              className="retro-column glad"
              style={{
                backgroundColor: "rgba(16, 185, 129, 0.03)",
                padding: "12px",
                borderRadius: "8px",
                border: "1px dashed rgba(16, 185, 129, 0.2)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-green)", textTransform: "uppercase", borderBottom: "1px solid rgba(16, 185, 129, 0.1)", paddingBottom: "6px" }}>
                {language === "en" ? "What went well? (Glad)" : "Was lief gut? (Glad)"}
              </div>
              {retroNotes
                .filter((n) => n.type === "glad")
                .map((n, idx) => (
                  <div
                    key={idx}
                    className="retro-card glad"
                    style={{
                      backgroundColor: "var(--bg-panel)",
                      borderLeft: "3px solid var(--accent-green)",
                      padding: "10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "var(--text-primary)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    {n.text}
                  </div>
                ))}
            </div>

            {/* Sad Column */}
            <div
              className="retro-column sad"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.03)",
                padding: "12px",
                borderRadius: "8px",
                border: "1px dashed rgba(239, 68, 68, 0.2)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-red)", textTransform: "uppercase", borderBottom: "1px solid rgba(239, 68, 68, 0.1)", paddingBottom: "6px" }}>
                {language === "en" ? "What did not go well? (Sad)" : "Was lief nicht gut? (Sad)"}
              </div>
              {retroNotes
                .filter((n) => n.type === "sad")
                .map((n, idx) => (
                  <div
                    key={idx}
                    className="retro-card sad"
                    style={{
                      backgroundColor: "var(--bg-panel)",
                      borderLeft: "3px solid var(--accent-red)",
                      padding: "10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "var(--text-primary)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    {n.text}
                  </div>
                ))}
            </div>

            {/* Impediments Column */}
            <div
              className="retro-column impediment"
              style={{
                backgroundColor: "rgba(245, 158, 11, 0.03)",
                padding: "12px",
                borderRadius: "8px",
                border: "1px dashed rgba(245, 158, 11, 0.2)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-yellow)", textTransform: "uppercase", borderBottom: "1px solid rgba(245, 158, 11, 0.1)", paddingBottom: "6px" }}>
                Impediments / Blocker Log
              </div>
              {retroNotes
                .filter((n) => n.type === "impediment")
                .map((n, idx) => (
                  <div
                    key={idx}
                    className="retro-card impediment"
                    style={{
                      backgroundColor: "var(--bg-panel)",
                      borderLeft: "3px solid var(--accent-yellow)",
                      padding: "10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "var(--text-primary)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    {n.text}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Impediment List widget */}
      <div className="timeline-card" style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={16} style={{ color: "var(--accent-red)" }} />
          {language === "en"
            ? "Impediment Backlog & Blockers (Meetings / Retros)"
            : "Impediment-Backlog & Blocker (Meetings / Retros)"}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
          {impediments.length === 0 ? (
            <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)", padding: "24px 0" }}>
              {language === "en"
                ? "No active blockers logged in the project."
                : "Keine aktiven Blocker im Projekt protokolliert."}
            </div>
          ) : (
            impediments.map((imp, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.05)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderLeft: "4px solid var(--accent-red)",
                  padding: "10px",
                  borderRadius: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                }}
                onClick={() => {
                  handleOpenFile(imp.filePath);
                  setTimeout(() => {
                    if (editorRef.current) {
                      editorRef.current.revealLineInCenter(imp.line);
                      editorRef.current.setPosition({ lineNumber: imp.line, column: 1 });
                    }
                  }, 100);
                }}
                title={
                  language === "en"
                    ? `Click to jump to ${imp.fileName} line ${imp.line}`
                    : `Klicken um in ${imp.fileName} Zeile ${imp.line} zu springen`
                }
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
                    {imp.title}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                    Protokolliert in {imp.fileName} (Zeile {imp.line})
                  </span>
                </div>
                <span style={{ fontSize: "9px", padding: "2px 6px", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "var(--accent-red)", borderRadius: "4px", fontWeight: 600 }}>
                  {imp.assignee}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export function PmStandupTab() {
  const { files, language, t } = useWorkspaceContext();
  const backlog = parseBacklogItems(files);
  const impediments = parseImpedimentItems(files);
  const agileIssues = extractAllIssues(files).filter((iss) => iss.type !== "epic");

  const doneLines = [
    ...agileIssues
      .filter((i) => i.status === "done")
      .map((i) => `* [x] [${i.id}] ${i.title} (${i.assignee || "Unassigned"} • ${i.storyPoints} SP)`),
    ...backlog.filter((i) => i.status === "done").map((item) => `* [x] ${item.title} (${item.assignee})`),
  ];
  const inProgressLines = [
    ...agileIssues
      .filter((i) => i.status === "in-progress" || i.status === "review")
      .map((i) => `* [/] [${i.id}] ${i.title} [${i.status.toUpperCase()}] (${i.assignee || "Unassigned"})`),
    ...backlog.filter((i) => i.status === "in-progress").map((item) => `* [/] ${item.title} (${item.assignee})`),
  ];
  const blockedIssueLines = agileIssues
    .filter((i) => i.status !== "done" && i.blockedBy.length > 0)
    .map(
      (i) =>
        `* [ ] BLOCKED: [${i.id}] ${i.title} — blocked by ${i.blockedBy.join(", ")} (${i.assignee || "Unassigned"})`
    );
  const allBlockerLines = [
    ...blockedIssueLines,
    ...impediments.map((i) => `* [ ] BLOCKED: ${i.title} (${i.assignee})`),
  ];

  const standupText =
    language === "en"
      ? `Daily Standup Report - ${new Date().toLocaleDateString("en-US")}\n\n1. Completed yesterday:\n${doneLines.join("\n") || "* No tasks in DONE status"}\n\n2. Focus today:\n${inProgressLines.join("\n") || "* No tasks in IN-PROGRESS status"}\n\n3. Blockers / Impediments:\n${allBlockerLines.join("\n") || "* No active blockers reported"}`
      : `Daily Standup Bericht - ${new Date().toLocaleDateString("de-DE")}\n\n1. Gestern erledigt:\n${doneLines.join("\n") || "* Keine Aufgaben im Status DONE"}\n\n2. Heute im Fokus:\n${inProgressLines.join("\n") || "* Keine Aufgaben im Status IN-PROGRESS"}\n\n3. Blocker / Impediments:\n${allBlockerLines.join("\n") || "* Keine aktiven Blocker gemeldet"}`;

  return (
    <div className="timeline-card">
      <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        <Sparkles size={18} style={{ color: "var(--accent-indigo)" }} />
        {language === "en"
          ? "Daily Standup Assistant (Jira Issues + Sprint Backlog)"
          : "Daily Standup Assistent (Jira-Tickets + Sprint-Backlog)"}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
          {t.standupIntro}
        </div>

        <div style={{ position: "relative" }}>
          <pre
            style={{
              margin: 0,
              padding: "16px",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              whiteSpace: "pre-wrap",
              color: "var(--text-primary)",
              maxHeight: "300px",
              overflowY: "auto",
            }}
          >
            {standupText}
          </pre>

          <button
            className="git-btn"
            style={{ position: "absolute", top: "10px", right: "10px", padding: "4px 10px", fontSize: "11px", margin: 0 }}
            onClick={() => {
              navigator.clipboard.writeText(standupText);
              alert(
                language === "en"
                  ? "Standup report copied to clipboard!"
                  : "Standup-Bericht in die Zwischenablage kopiert!"
              );
            }}
          >
            {language === "en" ? "Copy Report" : "Bericht kopieren"}
          </button>
        </div>
      </div>
    </div>
  );
}
