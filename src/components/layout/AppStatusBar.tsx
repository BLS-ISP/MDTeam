"use client";

import React from "react";
import { AlertCircle, AlertTriangle, ChevronDown, GitBranch, Search, Sparkles } from "lucide-react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

export function AppStatusBar() {
  const {
    roleMode,
    language,
    activeBranch,
    diagnostics,
    showProblemsPanel,
    setShowProblemsPanel,
    yjsUrl,
    yjsStatus,
    activeFile,
    setIsCommandPaletteOpen,
    setPendingBranchName,
    setPendingBranchIssue,
    setIsGitBranchModalOpen,
  } = useWorkspaceContext();

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length;

  return (
    <footer className="app-statusbar">
      <div className="statusbar-left">
        {roleMode !== "stakeholder" ? (
          <>
            <div
              className="statusbar-item"
              style={{ cursor: "pointer" }}
              onClick={() => {
                setPendingBranchName("");
                setPendingBranchIssue(null);
                setIsGitBranchModalOpen(true);
              }}
              title={language === "en" ? "Open GitOps Branch Manager" : "GitOps Branch-Verwaltung öffnen"}
            >
              <GitBranch size={11} />
              <span style={{ fontWeight: 600 }}>{activeBranch}</span>
              <ChevronDown size={10} style={{ marginLeft: "4px" }} />
            </div>

            <div
              className="statusbar-item"
              onClick={() => setShowProblemsPanel(!showProblemsPanel)}
              style={{ cursor: "pointer" }}
              title="Probleme ein-/ausblenden"
            >
              <AlertCircle size={11} style={{ color: errorCount > 0 ? "var(--accent-red)" : "inherit" }} />
              <span style={{ marginLeft: "4px" }}>{errorCount}</span>
              <AlertTriangle
                size={11}
                style={{ color: warningCount > 0 ? "var(--accent-yellow)" : "inherit", marginLeft: "8px" }}
              />
              <span style={{ marginLeft: "4px" }}>{warningCount}</span>
            </div>
          </>
        ) : (
          <div className="statusbar-item">
            <Sparkles size={11} style={{ color: "var(--accent-indigo)" }} />
            <span style={{ fontWeight: 600 }}>Stakeholder &amp; PM Clean Mode (Confluence / Jira)</span>
          </div>
        )}

        <div className="statusbar-item" title={yjsUrl}>
          <span>Yjs Sync: </span>
          <span
            style={{
              color:
                yjsStatus === "connected"
                  ? "var(--accent-green)"
                  : yjsStatus === "connecting"
                    ? "var(--accent-yellow)"
                    : "var(--accent-red)",
              fontWeight: "bold",
            }}
          >
            {yjsStatus === "connected"
              ? language === "en"
                ? "Connected"
                : "Verbunden"
              : yjsStatus === "connecting"
                ? language === "en"
                  ? "Connecting..."
                  : "Verbinde..."
                : "Offline"}
          </span>
        </div>
      </div>

      <div className="statusbar-right">
        <span
          className="statusbar-item"
          onClick={() => setIsCommandPaletteOpen(true)}
          title="Command Palette (Ctrl+K)"
        >
          <Search size={10} />
          <span>Ctrl+K</span>
        </span>
        {roleMode !== "stakeholder" && activeFile && (
          <>
            <span>
              {language === "en" ? "Lines:" : "Zeilen:"} {activeFile.content.split("\n").length}
            </span>
            <span>UTF-8</span>
            <span>Markdown</span>
          </>
        )}
      </div>
    </footer>
  );
}
