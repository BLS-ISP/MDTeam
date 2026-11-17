"use client";

import React from "react";
import { CheckCircle, FileDown, FileText, Plus } from "lucide-react";
import { extractAllIssues, parseSprints } from "../../utils/issueEngine";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

export function PmSidebarPanel() {
  const { files, language, openQuickCreateIssue, setActivePanel, triggerDownload } = useWorkspaceContext();

  const allAgileIssues = extractAllIssues(files);
  const nonEpics = allAgileIssues.filter((i) => i.type !== "epic");
  const totalPts = nonEpics.reduce((acc, i) => acc + (i.storyPoints || 0), 0);
  const donePts = nonEpics
    .filter((i) => i.status === "done")
    .reduce((acc, i) => acc + (i.storyPoints || 0), 0);
  const pct = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0;
  const adrCount = files.filter((f) => f.path.startsWith("adrs/")).length;
  const wikiCount = files.filter((f) => f.path.startsWith("wiki/")).length;
  const activeSprints = parseSprints(files).filter((s) => s.state === "active");

  return (
    <>
      <div className="panel-header">
        <span>{language === "en" ? "Agile & Doc Health" : "Agile & Projektstatus"}</span>
      </div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div className="git-status-section">
          <div className="git-status-title">
            {language === "en" ? "Story Points Done" : "Story Points Erledigt"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "20px", fontWeight: "bold", margin: "8px 0" }}>
            <CheckCircle size={20} style={{ color: "var(--accent-green)" }} />
            <span>{pct}%</span>
            <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)" }}>
              ({donePts}/{totalPts} SP)
            </span>
          </div>
          <div style={{ width: "100%", height: "6px", backgroundColor: "var(--border-color)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "var(--accent-green)" }} />
          </div>
        </div>

        <div className="git-status-section">
          <div className="git-status-title">Workspace Governance</div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{language === "en" ? "Active Sprint:" : "Aktiver Sprint:"}</span>
              <span style={{ fontWeight: "bold", color: "var(--accent-indigo)" }}>
                {activeSprints[0]?.id || "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{language === "en" ? "Jira Tickets:" : "Jira-Tickets:"}</span>
              <span style={{ fontWeight: "bold", color: "var(--accent-green)" }}>{allAgileIssues.length}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>ADRs &amp; Wiki:</span>
              <span style={{ fontWeight: "bold", color: "var(--accent-blue)" }}>
                {adrCount} ADR / {wikiCount} Wiki
              </span>
            </div>
          </div>
        </div>

        <button className="git-btn" onClick={openQuickCreateIssue}>
          <Plus size={14} /> {language === "en" ? "New Jira Issue" : "Neues Jira-Ticket"}
        </button>

        <button
          className="git-btn"
          onClick={() => {
            setActivePanel("pm");
            triggerDownload("docx", "book");
          }}
          style={{
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          <FileText size={14} /> {language === "en" ? "Export arc42 DOCX" : "arc42 als DOCX"}
        </button>

        <button
          className="git-btn"
          onClick={() => {
            setActivePanel("pm");
            triggerDownload("pdf", "book");
          }}
          style={{ backgroundColor: "var(--accent-blue)" }}
        >
          <FileDown size={14} /> {language === "en" ? "Export PDF Report" : "PDF-Report exportieren"}
        </button>
      </div>
    </>
  );
}
