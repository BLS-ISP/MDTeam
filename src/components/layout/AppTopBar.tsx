"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { WorkspaceHeaderControls } from "../CommandPaletteAndModals";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

export function AppTopBar() {
  const {
    t,
    language,
    setLanguage,
    files,
    modifiedFiles,
    roleMode,
    handleRoleModeChange,
    currentUser,
    setCurrentUser,
    activeBranch,
    handleOpenFile,
    setActivePanel,
    setPendingBranchName,
    setPendingBranchIssue,
    setIsGitBranchModalOpen,
    setIsCommandPaletteOpen,
    setIsImportModalOpen,
  } = useWorkspaceContext();

  const unsavedCount = Object.keys(modifiedFiles).length;

  return (
    <header className="app-header">
      <div className="logo-section">
        <span className="logo-icon">
          <Sparkles size={18} />
        </span>
        <span>MDTeam Workspace</span>
        <span className="logo-badge">Jira • Confluence • arc42</span>
      </div>

      <div className="header-status" style={{ gap: "10px" }}>
        <div className="status-indicator">
          <span className={`status-dot ${unsavedCount > 0 ? "syncing" : ""}`} />
          <span>{unsavedCount > 0 ? `${unsavedCount} ${t.unsavedChanges}` : t.syncedWithGit}</span>
        </div>

        <WorkspaceHeaderControls
          roleMode={roleMode}
          onRoleModeChange={handleRoleModeChange}
          currentUser={currentUser}
          onCurrentUserChange={setCurrentUser}
          files={files}
          onOpenFile={(filePath) => {
            handleOpenFile(filePath);
            setActivePanel("explorer");
          }}
          language={language}
          currentBranch={roleMode === "stakeholder" ? undefined : activeBranch}
          onOpenGitBranchModal={
            roleMode === "stakeholder"
              ? undefined
              : () => {
                  setPendingBranchName("");
                  setPendingBranchIssue(null);
                  setIsGitBranchModalOpen(true);
                }
          }
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenImportModal={() => setIsImportModalOpen(true)}
        />

        <div
          className="language-selector"
          style={{
            display: "flex",
            gap: "4px",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            padding: "2px",
            borderRadius: "6px",
            border: "1px solid var(--border-color)",
          }}
        >
          <button
            className={`lang-btn ${language === "de" ? "active" : ""}`}
            onClick={() => setLanguage("de")}
            style={{
              border: "none",
              background: language === "de" ? "var(--accent-indigo)" : "none",
              color: language === "de" ? "#ffffff" : "var(--text-muted)",
              padding: "3px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            DE
          </button>
          <button
            className={`lang-btn ${language === "en" ? "active" : ""}`}
            onClick={() => setLanguage("en")}
            style={{
              border: "none",
              background: language === "en" ? "var(--accent-indigo)" : "none",
              color: language === "en" ? "#ffffff" : "var(--text-muted)",
              padding: "3px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
