"use client";

import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  GitBranch,
  GitMerge,
  Search,
  Server,
  Sparkles,
} from "lucide-react";
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
    conflictCount,
    setIsConflictModalOpen,
    serverMode,
    authUser,
    activeProjectId,
    setIsAuthModalOpen,
  } = useWorkspaceContext();

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length;
  const isEn = language === "en";

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
              title={isEn ? "Open GitOps Branch Manager" : "GitOps Branch-Verwaltung öffnen"}
            >
              <GitBranch size={11} />
              <span style={{ fontWeight: 600 }}>{activeBranch}</span>
              <ChevronDown size={10} style={{ marginLeft: "4px" }} />
            </div>

            {conflictCount > 0 && (
              <div
                className="statusbar-item"
                onClick={() => setIsConflictModalOpen(true)}
                style={{
                  cursor: "pointer",
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                  border: "1px solid rgba(239, 68, 68, 0.55)",
                  borderRadius: "4px",
                  padding: "1px 8px",
                  color: "#fca5a5",
                  fontWeight: 700,
                }}
                title={
                  isEn
                    ? "Click to resolve Git merge conflicts in 1 click"
                    : "Klicken, um Git-Merge-Konflikte geführt aufzulösen"
                }
              >
                <GitMerge size={11} style={{ color: "var(--accent-red)" }} />
                <span style={{ marginLeft: "4px" }}>
                  {conflictCount} {isEn ? "Conflicts — Resolve" : "Konflikte — Auflösen"}
                </span>
              </div>
            )}

            <div
              className="statusbar-item"
              onClick={() => setShowProblemsPanel(!showProblemsPanel)}
              style={{ cursor: "pointer" }}
              title={isEn ? "Toggle Problems Panel" : "Probleme ein-/ausblenden"}
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
            <span style={{ fontWeight: 600 }}>
              {isEn
                ? "Stakeholder Clean Read-Only Mode (Confluence / Jira)"
                : "Stakeholder Lese-Modus (Confluence / Jira)"}
            </span>
          </div>
        )}

        {serverMode && (
          <div
            className="statusbar-item"
            style={{ cursor: "pointer" }}
            onClick={() => setIsAuthModalOpen(true)}
            title={isEn ? "Multi-User API Server Connected" : "Multi-User API-Server verbunden"}
          >
            <Server size={11} style={{ color: "var(--accent-green)" }} />
            <span style={{ marginLeft: "4px", fontWeight: 600 }}>
              API ({activeProjectId}): {authUser ? `${authUser.handle} [${authUser.role}]` : isEn ? "Guest" : "Gast"}
            </span>
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
              ? isEn
                ? "Connected"
                : "Verbunden"
              : yjsStatus === "connecting"
                ? isEn
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
              {isEn ? "Lines:" : "Zeilen:"} {activeFile.content.split("\n").length}
            </span>
            <span>UTF-8</span>
            <span>Markdown</span>
          </>
        )}
      </div>
    </footer>
  );
}
