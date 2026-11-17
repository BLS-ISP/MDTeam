"use client";

import React from "react";
import {
  CheckCircle2,
  FolderGit2,
  GitBranch,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { GitAuthConfigFields } from "./GitAuthConfigFields";
import { useGitRepoModalController } from "./useGitRepoModalController";

const TEXT_INPUT: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "6px",
  border: "1px solid var(--border-color)",
  backgroundColor: "var(--bg-editor)",
  color: "var(--text-primary)",
  fontSize: "12.5px",
  fontFamily: "var(--font-mono)",
  outline: "none",
};

export function GitRepositoryConnectModal() {
  const c = useGitRepoModalController();
  if (!c.isGitRepoModalOpen) return null;

  return (
    <div
      onClick={() => c.setIsGitRepoModalOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.76)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1120,
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 95vw)",
          maxHeight: "88vh",
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            backgroundColor: "var(--bg-panel)",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FolderGit2 size={19} style={{ color: "var(--accent-indigo)" }} />
            <div>
              <div style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)" }}>
                {c.isEn ? "Connect & Clone Git Repository" : "Git-Repository verbinden & klonen"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {c.isEn
                  ? "Work directly on real GitHub, GitLab, Gitea, or self-hosted repositories"
                  : "Arbeite online direkt auf echten GitHub-, GitLab-, Gitea- oder Firmen-Repositories"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => c.setIsGitRepoModalOpen(false)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: "6px",
            padding: "10px 18px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "rgba(255,255,255,0.015)",
          }}
        >
          {(
            [
              { id: "clone", icon: <FolderGit2 size={13} />, label: c.isEn ? "Clone Existing Repo" : "Bestehendes Repo klonen" },
              { id: "remote", icon: <Link2 size={13} />, label: c.isEn ? `Remote (${c.activeProjectId})` : `Remote (${c.activeProjectId})` },
              { id: "blank", icon: <Plus size={13} />, label: c.isEn ? "New Blank Project" : "Neues leeres Projekt" },
            ] as const
          ).map((tItem) => {
            const active = c.tab === tItem.id;
            return (
              <button
                key={tItem.id}
                type="button"
                onClick={() => c.switchTab(tItem.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: active ? "1px solid var(--accent-indigo)" : "1px solid var(--border-color)",
                  backgroundColor: active ? "var(--accent-indigo)" : "var(--bg-panel)",
                  color: active ? "#ffffff" : "var(--text-secondary)",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {tItem.icon}
                <span>{tItem.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {c.errorMsg && (
            <div
              style={{
                padding: "9px 12px",
                marginBottom: "12px",
                borderRadius: "6px",
                border: "1px solid var(--accent-red)",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: "#fca5a5",
                fontSize: "12px",
              }}
            >
              {c.errorMsg}
            </div>
          )}

          {c.statusMsg && (
            <div
              style={{
                padding: "9px 12px",
                marginBottom: "12px",
                borderRadius: "6px",
                border: "1px solid var(--accent-green)",
                backgroundColor: "rgba(16, 185, 129, 0.1)",
                color: "var(--accent-green)",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <CheckCircle2 size={14} />
              <span>{c.statusMsg}</span>
            </div>
          )}

          {c.tab === "blank" ? (
            <form onSubmit={c.handleBlankSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "5px" }}>
                  {c.isEn ? "Project Slug (ID)" : "Projekt-Kennung (Slug)"}
                </label>
                <input
                  type="text"
                  required
                  value={c.projectIdInput}
                  onChange={(e) => c.setProjectIdInput(e.target.value)}
                  placeholder="customer-platform"
                  style={TEXT_INPUT}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "5px" }}>
                  {c.isEn ? "Display Name" : "Anzeigename"}
                </label>
                <input
                  type="text"
                  value={c.displayName}
                  onChange={(e) => c.setDisplayName(e.target.value)}
                  placeholder="Customer Platform Architecture"
                  style={{ ...TEXT_INPUT, fontFamily: "var(--font-sans)" }}
                />
              </div>
              <GitAuthConfigFields
                isEn={c.isEn}
                authType="none"
                onAuthTypeChange={() => undefined}
                httpsUsername=""
                onHttpsUsernameChange={() => undefined}
                httpsToken=""
                onHttpsTokenChange={() => undefined}
                visibility={c.visibility}
                onVisibilityChange={c.setVisibility}
              />
              <button type="submit" disabled={c.busy || !c.projectIdInput.trim()} className="git-btn" style={{ marginTop: "6px", padding: "9px 16px" }}>
                <Plus size={14} />
                <span>{c.isEn ? "Create Server Project" : "Server-Projekt anlegen"}</span>
              </button>
            </form>
          ) : (
            <form
              onSubmit={c.tab === "clone" ? c.handleCloneSubmit : c.handleSaveRemoteSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "5px" }}>
                  {c.isEn ? "Git Repository URL (HTTPS or SSH)" : "Git-Repository-URL (HTTPS oder SSH)"}
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    required={c.tab === "clone"}
                    value={c.remoteUrl}
                    onChange={(e) => c.handleRemoteUrlChange(e.target.value)}
                    placeholder="https://github.com/org/project.git  |  git@gitlab.company.de:team/repo.git"
                    style={TEXT_INPUT}
                  />
                  <button
                    type="button"
                    disabled={!c.remoteUrl.trim() || c.testingConn}
                    onClick={c.handleTestConnection}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "0 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--bg-panel)",
                      color: "var(--text-primary)",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      cursor: c.remoteUrl.trim() ? "pointer" : "not-allowed",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>{c.testingConn ? "..." : c.isEn ? "Test URL" : "Prüfen"}</span>
                  </button>
                </div>
              </div>

              {c.tab === "clone" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "5px" }}>
                      {c.isEn ? "Workspace ID (Slug)" : "Projekt-Kennung (Slug)"}
                    </label>
                    <input
                      type="text"
                      required
                      value={c.projectIdInput}
                      onChange={(e) => {
                        c.setProjectSlugTouched(true);
                        c.setProjectIdInput(e.target.value);
                      }}
                      placeholder="my-service"
                      style={TEXT_INPUT}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "5px" }}>
                      <GitBranch size={11} style={{ display: "inline", marginRight: "4px" }} />
                      {c.isEn ? "Branch (optional)" : "Branch (optional)"}
                    </label>
                    {c.discoveredBranches.length > 0 ? (
                      <select
                        value={c.branch}
                        onChange={(e) => c.setBranch(e.target.value)}
                        style={{ ...TEXT_INPUT, cursor: "pointer" }}
                      >
                        {c.discoveredBranches.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={c.branch}
                        onChange={(e) => c.setBranch(e.target.value)}
                        placeholder={c.isEn ? "Auto-detect (main / master)" : "Automatisch (main / master)"}
                        style={TEXT_INPUT}
                      />
                    )}
                  </div>
                </div>
              )}

              <GitAuthConfigFields
                isEn={c.isEn}
                authType={c.authType}
                onAuthTypeChange={c.setAuthType}
                httpsUsername={c.httpsUsername}
                onHttpsUsernameChange={c.setHttpsUsername}
                httpsToken={c.httpsToken}
                onHttpsTokenChange={c.setHttpsToken}
                hasSavedToken={c.tab === "remote" && Boolean(c.currentProjectMeta?.hasToken)}
                sshPublicKey={c.tab === "remote" ? c.currentProjectMeta?.sshPublicKey || "" : ""}
                sshPrivateKeyInput={c.sshPrivateKeyInput}
                onSshPrivateKeyInputChange={c.setSshPrivateKeyInput}
                canGenerateSshKey={c.tab === "remote"}
                isGeneratingSsh={c.busy}
                onGenerateSshKey={c.handleGenerateSshKey}
                visibility={c.visibility}
                onVisibilityChange={c.setVisibility}
              />

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={c.scaffoldMdTeam}
                  onChange={(e) => c.setScaffoldMdTeam(e.target.checked)}
                />
                <span>
                  {c.isEn
                    ? "Initialize missing MDTeam starter folders (wiki/, management/) without overwriting existing files"
                    : "Fehlende MDTeam-Basisordner (wiki/, management/) anlegen (überschreibt keine vorhandenen Dateien)"}
                </span>
              </label>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                {c.tab === "remote" && c.canDeleteCurrent ? (
                  <button
                    type="button"
                    disabled={c.busy}
                    onClick={c.handleDeleteCurrentProject}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid rgba(239, 68, 68, 0.5)",
                      backgroundColor: "rgba(239, 68, 68, 0.12)",
                      color: "#fca5a5",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={13} />
                    <span>{c.isEn ? "Remove Workspace" : "Projekt entfernen"}</span>
                  </button>
                ) : (
                  <div />
                )}

                <button
                  type="submit"
                  disabled={c.busy || (c.tab === "clone" && (!c.remoteUrl.trim() || !c.projectIdInput.trim()))}
                  className="git-btn"
                  style={{ width: "auto", padding: "9px 18px" }}
                >
                  <FolderGit2 size={14} />
                  <span>
                    {c.busy
                      ? c.isEn
                        ? "Working..."
                        : "Bitte warten..."
                      : c.tab === "clone"
                      ? c.isEn
                        ? "Clone & Open Repository"
                        : "Repository klonen & öffnen"
                      : c.isEn
                      ? "Save Remote Configuration"
                      : "Remote-Einstellungen speichern"}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
