"use client";

import React from "react";
import { Download, GitBranch } from "lucide-react";
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
  } = useWorkspaceContext();

  const changedPaths = Object.keys(modifiedFiles).filter((k) => modifiedFiles[k]);

  return (
    <>
      <div className="panel-header">
        <span>{t.gitSourceControl}</span>
      </div>
      <div className="git-panel-content">
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
            placeholder={
              language === "en"
                ? "Feat: Add details in arc42 chapter 1..."
                : "Feat: Füge Details in arc42 Kapitel 1 hinzu..."
            }
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="git-btn"
              disabled={changedPaths.length === 0}
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
                title={
                  language === "en"
                    ? "Pull changes from remote"
                    : "Änderungen vom Server herunterladen (Pull)"
                }
              >
                <Download size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="git-status-section" style={{ flex: 1, overflowY: "auto" }}>
          <div className="git-status-title">{t.commitHistory}</div>
          {commits.map((c, i) => (
            <div key={i} style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "8px", marginBottom: "8px" }}>
              <div style={{ display: "flex", fontSize: "11px", marginBottom: "2px" }}>
                <span style={{ color: "var(--accent-indigo)", fontWeight: "bold" }}>{c.hash}</span>
                <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>{c.date}</span>
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-primary)" }}>{c.message}</div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                {language === "en" ? "Author" : "Autor"}: {c.author}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
