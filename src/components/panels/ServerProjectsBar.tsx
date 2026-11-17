"use client";

import React from "react";
import { FolderGit2, Globe, KeyRound, Link2, Lock, RefreshCw } from "lucide-react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

function formatShortRemote(url: string): string {
  if (!url) return "";
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^ssh:\/\//i, "")
    .replace(/^git@/i, "")
    .replace(/\.git$/i, "");
}

export function ServerProjectsBar() {
  const {
    language,
    serverMode,
    authUser,
    activeProjectId,
    availableProjects,
    projectDetails,
    gitStatus,
    canPerformAction,
    selectServerProject,
    openGitRepoModal,
    setIsAuthModalOpen,
    syncServerGitRemote,
    setIsConflictModalOpen,
    isSyncingServer,
  } = useWorkspaceContext();

  if (!serverMode) return null;

  const isEn = language === "en";
  const canConnectRepo = canPerformAction("connect_git_repo");
  const activeMeta = projectDetails.find((p) => p.projectId === activeProjectId);
  const effectiveRemote = gitStatus?.remoteUrl || activeMeta?.remoteUrl || "";

  if (!authUser) {
    return (
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "rgba(99, 102, 241, 0.06)",
          display: "flex",
          flexDirection: "column",
          gap: "7px",
        }}
      >
        <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
          {isEn
            ? "Sign in to connect, clone, and switch real Git repositories online."
            : "Bitte anmelden, um echte Git-Repositories online zu klonen und zu wechseln."}
        </div>
        <button
          type="button"
          onClick={() => setIsAuthModalOpen(true)}
          className="git-btn"
          style={{ width: "100%", padding: "6px 10px", fontSize: "11.5px" }}
        >
          <KeyRound size={12} />
          <span>{isEn ? "Sign In / SSO" : "Anmelden / SSO"}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "10px 14px",
        borderBottom: "1px solid var(--border-color)",
        backgroundColor: "rgba(255, 255, 255, 0.015)",
        display: "flex",
        flexDirection: "column",
        gap: "7px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {activeMeta?.visibility === "private" ? (
            <Lock size={10} style={{ color: "var(--accent-green)" }} />
          ) : (
            <Globe size={10} style={{ color: "var(--accent-indigo)" }} />
          )}
          {isEn ? "Online Git Project" : "Online-Git-Projekt"}
        </span>

        {gitStatus && (gitStatus.ahead > 0 || gitStatus.behind > 0) && (
          <span
            style={{
              fontSize: "10px",
              fontFamily: "var(--font-mono)",
              padding: "1px 6px",
              borderRadius: "999px",
              backgroundColor: "rgba(99, 102, 241, 0.18)",
              color: "#c7d2fe",
            }}
          >
            ↑{gitStatus.ahead} ↓{gitStatus.behind}
          </span>
        )}
      </div>

      {/* Project Switcher Dropdown */}
      <div style={{ display: "flex", gap: "6px" }}>
        <select
          value={activeProjectId}
          onChange={(e) => void selectServerProject(e.target.value)}
          className="settings-select"
          style={{ flex: 1, padding: "5px 8px", fontSize: "12px", fontWeight: 600 }}
        >
          {availableProjects.map((pid) => {
            const detail = projectDetails.find((d) => d.projectId === pid);
            const label =
              detail && detail.displayName && detail.displayName !== pid
                ? `${detail.displayName} (${pid})`
                : pid;
            return (
              <option key={pid} value={pid}>
                {detail?.visibility === "private" ? `🔒 ${label}` : label}
              </option>
            );
          })}
        </select>

        {canConnectRepo && effectiveRemote && (
          <button
            type="button"
            disabled={isSyncingServer}
            onClick={async () => {
              const res = await syncServerGitRemote({ direction: "both" });
              if (res?.hasConflicts) setIsConflictModalOpen(true);
            }}
            title={isEn ? "Pull & Push with Git Remote" : "Mit Git-Remote synchronisieren (Pull & Push)"}
            style={{
              padding: "0 8px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-panel)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>

      {/* Remote Origin Info Badge */}
      <div
        style={{
          fontSize: "10px",
          fontFamily: "var(--font-mono)",
          color: effectiveRemote ? "var(--text-secondary)" : "var(--text-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={effectiveRemote || (isEn ? "No remote URL configured" : "Noch kein externes Git-Remote verknüpft")}
      >
        {effectiveRemote
          ? `origin: ${formatShortRemote(effectiveRemote)}`
          : isEn
          ? "Local server Git (no external remote linked)"
          : "Lokales Server-Git (noch kein Remote verknüpft)"}
      </div>

      {/* Developer Action Buttons */}
      {canConnectRepo && (
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={() => openGitRepoModal("clone")}
            className="git-btn"
            style={{ flex: 1, padding: "6px 8px", fontSize: "11px", fontWeight: 600 }}
          >
            <FolderGit2 size={12} />
            <span>{isEn ? "+ Clone Git Repo" : "+ Git-Repo klonen"}</span>
          </button>
          <button
            type="button"
            onClick={() => openGitRepoModal("remote")}
            title={isEn ? "Configure Remote & PAT/SSH Auth" : "Remote-URL & PAT/SSH konfigurieren"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 9px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-panel)",
              color: "var(--text-secondary)",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Link2 size={12} />
            <span>Remote</span>
          </button>
        </div>
      )}
    </div>
  );
}
