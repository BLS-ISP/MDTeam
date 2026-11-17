"use client";

import React from "react";
import { KeyRound, ShieldCheck, Sparkles, Users } from "lucide-react";
import { WorkspaceHeaderControls } from "../CommandPaletteAndModals";
import { getRoleBadgeMeta } from "../auth";
import { canRolePerform } from "../../types/auth";
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
    serverMode,
    authUser,
    isStakeholderReadOnly,
    setIsAuthModalOpen,
    setIsTeamAdminModalOpen,
  } = useWorkspaceContext();

  const unsavedCount = Object.keys(modifiedFiles).length;
  const roleBadge = authUser ? getRoleBadgeMeta(authUser.role) : null;
  const roleLabel = roleBadge ? (language === "en" ? roleBadge.labelEn : roleBadge.labelDe) : "";
  const canOpenAdmin = !serverMode || !authUser || canRolePerform(authUser.role, "manage_users");

  return (
    <header className="app-header">
      <div className="logo-section">
        <span className="logo-icon">
          <Sparkles size={18} />
        </span>
        <span>MDTeam Workspace</span>
        <span className="logo-badge">Jira • Confluence • arc42</span>
      </div>

      <div className="header-status" style={{ gap: "8px" }}>
        <div className="status-indicator">
          <span className={`status-dot ${unsavedCount > 0 ? "syncing" : ""}`} />
          <span>{unsavedCount > 0 ? `${unsavedCount} ${t.unsavedChanges}` : t.syncedWithGit}</span>
        </div>

        {/* Multi-User Auth & SSO Trigger */}
        <button
          type="button"
          onClick={() => setIsAuthModalOpen(true)}
          title={
            language === "en"
              ? "Server Connection, SSO & Scrum Account Login"
              : "Server-Verbindung, SSO & Scrum-Anmeldung"
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            height: "28px",
            padding: "0 10px",
            borderRadius: "6px",
            border: authUser
              ? `1px solid ${roleBadge?.color || "var(--border-color)"}`
              : "1px solid var(--border-color)",
            backgroundColor: authUser
              ? roleBadge?.bgColor || "var(--bg-panel)"
              : "var(--bg-panel)",
            color: authUser ? roleBadge?.color || "var(--text-primary)" : "var(--text-secondary)",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {authUser ? <ShieldCheck size={12} /> : <KeyRound size={12} style={{ color: "var(--accent-indigo)" }} />}
          <span>
            {authUser
              ? `${authUser.displayName} • ${roleLabel}`
              : serverMode
              ? language === "en"
                ? "Sign In / SSO"
                : "Anmelden / SSO"
              : language === "en"
              ? "Server / Auth"
              : "Server / Login"}
          </span>
        </button>

        {/* Team RBAC & Webhooks Admin Trigger */}
        {canOpenAdmin && (
          <button
            type="button"
            onClick={() => setIsTeamAdminModalOpen(true)}
            title={
              language === "en"
                ? "Team Accounts, OIDC SSO & Teams/Slack Webhooks"
                : "Team-Konten, OIDC SSO & Teams/Slack-Webhooks"
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              height: "28px",
              padding: "0 9px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-panel)",
              color: "var(--text-secondary)",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Users size={12} style={{ color: "var(--accent-indigo)" }} />
            <span>{language === "en" ? "Team & Webhooks" : "Team & Webhooks"}</span>
          </button>
        )}

        <WorkspaceHeaderControls
          roleMode={roleMode}
          onRoleModeChange={handleRoleModeChange}
          currentUser={currentUser}
          onCurrentUserChange={(nextHandle) => {
            if (serverMode && authUser) return;
            setCurrentUser(nextHandle);
          }}
          files={files}
          onOpenFile={(filePath) => {
            handleOpenFile(filePath);
            setActivePanel("explorer");
          }}
          language={language}
          currentBranch={isStakeholderReadOnly ? undefined : activeBranch}
          onOpenGitBranchModal={
            isStakeholderReadOnly
              ? undefined
              : () => {
                  setPendingBranchName("");
                  setPendingBranchIssue(null);
                  setIsGitBranchModalOpen(true);
                }
          }
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenImportModal={isStakeholderReadOnly ? undefined : () => setIsImportModalOpen(true)}
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
            }}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
