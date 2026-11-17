"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Download,
  FolderGit2,
  GitBranch,
  GitMerge,
  Link2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

export function GitPanel() {
  const {
    t,
    language,
    files,
    modifiedFiles,
    setModifiedFiles,
    commitMessage,
    setCommitMessage,
    handleCommit,
    handleGitPull,
    isTauri,
    commits,
    setDiffTargetFile,
    conflictPaths,
    conflictCount,
    setIsConflictModalOpen,
    serverMode,
    authUser,
    gitStatus,
    canPerformAction,
    syncUpsertServerFile,
    commitServerChanges,
    syncServerGitRemote,
    openGitRepoModal,
    isStakeholderReadOnly,
  } = useWorkspaceContext();

  const isEn = language === "en";
  const [syncNotice, setSyncNotice] = useState("");
  const [syncError, setSyncError] = useState("");
  const [isGitBusy, setIsGitBusy] = useState(false);

  const isOnlineGit = Boolean(serverMode && authUser);
  const canConnectRepo = canPerformAction("connect_git_repo");
  const localChangedPaths = Object.keys(modifiedFiles).filter((k) => modifiedFiles[k]);
  const serverDirtyPaths = [
    ...(gitStatus?.modified || []),
    ...(gitStatus?.untracked || []),
  ];
  const changedPaths = Array.from(new Set([...localChangedPaths, ...(isOnlineGit ? serverDirtyPaths : [])]));

  const displayCommits =
    isOnlineGit && gitStatus?.recentCommits && gitStatus.recentCommits.length > 0
      ? gitStatus.recentCommits
      : commits;

  const handleOnlineCommitAndPush = async () => {
    if (!commitMessage.trim() || isStakeholderReadOnly) return;
    setSyncError("");
    setSyncNotice("");
    setIsGitBusy(true);
    try {
      for (const p of localChangedPaths) {
        const f = files.find((item) => item.path === p);
        if (f) {
          await syncUpsertServerFile(f, "edit_wiki", commitMessage.trim());
        }
      }
      const shouldPush = Boolean(gitStatus?.remoteUrl);
      const res = await commitServerChanges(commitMessage.trim(), shouldPush);
      setModifiedFiles({});
      setCommitMessage("");
      setSyncNotice(
        res.pushed
          ? isEn
            ? `Committed (${res.commitSha}) & pushed to origin.`
            : `Committet (${res.commitSha}) & an origin gepusht.`
          : isEn
          ? `Committed (${res.commitSha}) on server.`
          : `Auf Server committet (${res.commitSha}).`
      );
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGitBusy(false);
    }
  };

  const handleOnlineRemoteSync = async (direction: "pull" | "push" | "both") => {
    setSyncError("");
    setSyncNotice("");
    setIsGitBusy(true);
    try {
      const res = await syncServerGitRemote({ direction });
      if (res?.hasConflicts) {
        setIsConflictModalOpen(true);
      } else if (res?.message) {
        setSyncNotice(res.message);
      }
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGitBusy(false);
    }
  };

  return (
    <>
      <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{t.gitSourceControl}</span>
        <button
          type="button"
          onClick={() => setIsConflictModalOpen(true)}
          title={isEn ? "Open Guided Git Conflict Resolver" : "Geführten Git-Konfliktlöser öffnen"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 7px",
            borderRadius: "4px",
            border: conflictCount > 0 ? "1px solid var(--accent-red)" : "1px solid var(--border-color)",
            backgroundColor: conflictCount > 0 ? "rgba(239, 68, 68, 0.18)" : "var(--bg-sidebar)",
            color: conflictCount > 0 ? "#fca5a5" : "var(--text-secondary)",
            fontSize: "10.5px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <GitMerge size={11} />
          <span>{conflictCount > 0 ? `${conflictCount}` : isEn ? "Conflicts" : "Konflikte"}</span>
        </button>
      </div>

      <div className="git-panel-content">
        {/* Online Server Remote Status & Quick Connect Card */}
        {isOnlineGit && (
          <div
            style={{
              padding: "10px 12px",
              marginBottom: "10px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-panel)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
              <span style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                {gitStatus?.branch || "main"}
              </span>
              {gitStatus?.remoteUrl && (
                <span style={{ fontSize: "10.5px", fontFamily: "var(--font-mono)", color: "var(--accent-indigo)" }}>
                  ↑{gitStatus.ahead} • ↓{gitStatus.behind}
                </span>
              )}
            </div>

            {gitStatus?.remoteUrl ? (
              <>
                <div
                  style={{
                    fontSize: "10.5px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={gitStatus.remoteUrl}
                >
                  {gitStatus.remoteUrl}
                </div>
                {canConnectRepo && (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      disabled={isGitBusy}
                      onClick={() => void handleOnlineRemoteSync("pull")}
                      className="git-btn"
                      style={{ flex: 1, padding: "5px 8px", fontSize: "11px", backgroundColor: "var(--bg-sidebar)", border: "1px solid var(--border-color)" }}
                    >
                      <Download size={12} /> Pull
                    </button>
                    <button
                      type="button"
                      disabled={isGitBusy}
                      onClick={() => void handleOnlineRemoteSync("push")}
                      className="git-btn"
                      style={{ flex: 1, padding: "5px 8px", fontSize: "11px", backgroundColor: "var(--bg-sidebar)", border: "1px solid var(--border-color)" }}
                    >
                      <Upload size={12} /> Push
                    </button>
                    <button
                      type="button"
                      onClick={() => openGitRepoModal("remote")}
                      title={isEn ? "Remote & Auth Settings" : "Remote & PAT/SSH Einstellungen"}
                      style={{
                        padding: "5px 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-sidebar)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      <Link2 size={12} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              canConnectRepo && (
                <button
                  type="button"
                  onClick={() => openGitRepoModal("clone")}
                  className="git-btn"
                  style={{ width: "100%", padding: "6px 10px", fontSize: "11.5px" }}
                >
                  <FolderGit2 size={13} />
                  <span>
                    {isEn ? "Connect or Clone Git Repo" : "Git-Repo verbinden / klonen"}
                  </span>
                </button>
              )
            )}
          </div>
        )}

        {syncError && (
          <div style={{ padding: "8px 10px", marginBottom: "8px", borderRadius: "6px", border: "1px solid var(--accent-red)", backgroundColor: "rgba(239,68,68,0.1)", color: "#fca5a5", fontSize: "11px" }}>
            {syncError}
          </div>
        )}

        {syncNotice && (
          <div style={{ padding: "8px 10px", marginBottom: "8px", borderRadius: "6px", border: "1px solid var(--accent-green)", backgroundColor: "rgba(16,185,129,0.1)", color: "var(--accent-green)", fontSize: "11px" }}>
            {syncNotice}
          </div>
        )}

        {conflictCount > 0 && (
          <div
            style={{
              padding: "10px 12px",
              marginBottom: "10px",
              borderRadius: "8px",
              border: "1px solid rgba(239, 68, 68, 0.55)",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#fca5a5", fontSize: "12px", fontWeight: 700 }}>
              <AlertTriangle size={14} style={{ color: "var(--accent-red)", flexShrink: 0 }} />
              <span>
                {isEn
                  ? `${conflictCount} Merge Conflict(s) Detected`
                  : `${conflictCount} Merge-Konflikt(e) erkannt`}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {conflictPaths.map((cp) => (
                <div
                  key={cp}
                  onClick={() => setIsConflictModalOpen(true)}
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-primary)",
                    padding: "4px 6px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(0,0,0,0.25)",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cp}</span>
                  <span style={{ color: "var(--accent-red)", fontWeight: 700, fontSize: "10px" }}>C</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsConflictModalOpen(true)}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(239, 68, 68, 0.65)",
                backgroundColor: "var(--accent-red)",
                color: "#ffffff",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <GitMerge size={13} />
              <span>{isEn ? "Resolve Conflicts Now" : "Konflikte jetzt auflösen"}</span>
            </button>
          </div>
        )}

        <div className="git-status-section">
          <div className="git-status-title">{t.localChanges}</div>
          {changedPaths.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.noChanges}</div>
          ) : (
            changedPaths.map((path) => {
              const fileObj = files.find((f) => f.path === path);
              return (
                <div
                  key={path}
                  className="git-changed-file"
                  onClick={() => setDiffTargetFile(path)}
                  style={{ cursor: "pointer" }}
                  title={t.clickToDiff}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {fileObj?.name || path}
                  </span>
                  <span className="git-change-badge modified">M</span>
                </div>
              );
            })
          )}
        </div>

        <div className="git-commit-box">
          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>
            {t.commitMessage}
          </label>
          <textarea
            className="git-textarea"
            disabled={isStakeholderReadOnly}
            placeholder={
              isEn
                ? "Feat: Add details in arc42 chapter 1..."
                : "Feat: Füge Details in arc42 Kapitel 1 hinzu..."
            }
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="git-btn"
              disabled={
                isGitBusy ||
                (!isOnlineGit && changedPaths.length === 0) ||
                !commitMessage.trim() ||
                conflictCount > 0 ||
                isStakeholderReadOnly
              }
              onClick={() => {
                if (isOnlineGit) void handleOnlineCommitAndPush();
                else void handleCommit();
              }}
              style={{ flex: 1 }}
            >
              <GitBranch size={14} /> {t.commitPush}
            </button>
            {isTauri && !isOnlineGit && (
              <button
                className="git-btn"
                onClick={handleGitPull}
                style={{
                  backgroundColor: "var(--bg-panel)",
                  border: "1px solid var(--border-color)",
                  width: "auto",
                  padding: "0 12px",
                }}
                title={isEn ? "Pull changes from remote" : "Änderungen vom Server herunterladen (Pull)"}
              >
                <Download size={14} />
              </button>
            )}
            {isOnlineGit && (
              <button
                className="git-btn"
                disabled={isGitBusy}
                onClick={() => void handleOnlineRemoteSync("both")}
                style={{
                  backgroundColor: "var(--bg-panel)",
                  border: "1px solid var(--border-color)",
                  width: "auto",
                  padding: "0 12px",
                }}
                title={isEn ? "Sync Server Git Remote" : "Server-Git-Remote synchronisieren"}
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="git-status-section" style={{ flex: 1, overflowY: "auto" }}>
          <div className="git-status-title">{t.commitHistory}</div>
          {displayCommits.map((c, i) => (
            <div
              key={`${c.hash}-${i}`}
              style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "8px", marginBottom: "8px" }}
            >
              <div style={{ display: "flex", fontSize: "11px", marginBottom: "2px" }}>
                <span style={{ color: "var(--accent-indigo)", fontWeight: "bold", fontFamily: "var(--font-mono)" }}>
                  {c.hash}
                </span>
                <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>
                  {c.date.length > 16 ? c.date.slice(0, 16).replace("T", " ") : c.date}
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-primary)" }}>{c.message}</div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                {isEn ? "Author" : "Autor"}: {c.author}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
