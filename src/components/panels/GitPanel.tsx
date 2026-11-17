"use client";

import React from "react";
import { AlertTriangle, Download, GitBranch, GitMerge, RefreshCw } from "lucide-react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

export function GitPanel() {
  const {
    t,
    language,
    files,
    modifiedFiles,
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
    syncServerGitRemote,
    isStakeholderReadOnly,
  } = useWorkspaceContext();

  const isEn = language === "en";
  const changedPaths = Object.keys(modifiedFiles).filter((k) => modifiedFiles[k]);

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
              disabled={changedPaths.length === 0 || conflictCount > 0 || isStakeholderReadOnly}
              onClick={handleCommit}
              style={{ flex: 1 }}
            >
              <GitBranch size={14} /> {t.commitPush}
            </button>
            {isTauri && (
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
            {serverMode && authUser && (
              <button
                className="git-btn"
                onClick={async () => {
                  const res = await syncServerGitRemote({ direction: "both" });
                  if (res?.hasConflicts) setIsConflictModalOpen(true);
                }}
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
          {commits.map((c, i) => (
            <div
              key={i}
              style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "8px", marginBottom: "8px" }}
            >
              <div style={{ display: "flex", fontSize: "11px", marginBottom: "2px" }}>
                <span style={{ color: "var(--accent-indigo)", fontWeight: "bold" }}>{c.hash}</span>
                <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>{c.date}</span>
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
