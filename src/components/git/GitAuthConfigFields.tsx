"use client";

import React, { useState } from "react";
import { Check, Copy, Globe, KeyRound, Lock, Shield } from "lucide-react";
import type { GitAuthType, ProjectVisibility } from "../../types/auth";

export interface GitAuthConfigFieldsProps {
  isEn: boolean;
  authType: GitAuthType;
  onAuthTypeChange: (next: GitAuthType) => void;
  httpsUsername: string;
  onHttpsUsernameChange: (val: string) => void;
  httpsToken: string;
  onHttpsTokenChange: (val: string) => void;
  hasSavedToken?: boolean;
  sshPublicKey?: string;
  sshPrivateKeyInput?: string;
  onSshPrivateKeyInputChange?: (val: string) => void;
  canGenerateSshKey?: boolean;
  isGeneratingSsh?: boolean;
  onGenerateSshKey?: () => void;
  visibility: ProjectVisibility;
  onVisibilityChange: (vis: ProjectVisibility) => void;
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border-color)",
  backgroundColor: "var(--bg-editor)", color: "var(--text-primary)", fontSize: "12px", fontFamily: "var(--font-mono)", outline: "none",
};

const LABEL_UPPER_STYLE: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "6px",
};

const AUTH_CARD_STYLE: React.CSSProperties = {
  padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-color)",
  backgroundColor: "var(--bg-panel)", display: "flex", flexDirection: "column", gap: "8px",
};

export function GitAuthConfigFields({
  isEn,
  authType,
  onAuthTypeChange,
  httpsUsername,
  onHttpsUsernameChange,
  httpsToken,
  onHttpsTokenChange,
  hasSavedToken = false,
  sshPublicKey = "",
  sshPrivateKeyInput = "",
  onSshPrivateKeyInputChange,
  canGenerateSshKey = false,
  isGeneratingSsh = false,
  onGenerateSshKey,
  visibility,
  onVisibilityChange,
}: GitAuthConfigFieldsProps) {
  const [copiedSsh, setCopiedSsh] = useState(false);

  const handleCopySshKey = async () => {
    if (!sshPublicKey) return;
    try {
      await navigator.clipboard.writeText(sshPublicKey);
      setCopiedSsh(true);
      setTimeout(() => setCopiedSsh(false), 2200);
    } catch {
      // ignore clipboard error
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Auth Method Segmented Buttons */}
      <div>
        <label style={LABEL_UPPER_STYLE}>
          {isEn ? "Git Authentication" : "Git-Authentifizierung"}
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
          {(
            [
              { id: "none", label: isEn ? "Public / None" : "Öffentlich / Keine" },
              { id: "https", label: "HTTPS Token / PAT" },
              { id: "ssh", label: "SSH Deploy Key" },
            ] as const
          ).map((opt) => {
            const active = authType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onAuthTypeChange(opt.id)}
                style={{
                  padding: "7px 8px",
                  borderRadius: "6px",
                  border: active ? "1px solid var(--accent-indigo)" : "1px solid var(--border-color)",
                  backgroundColor: active ? "rgba(99, 102, 241, 0.16)" : "var(--bg-panel)",
                  color: active ? "#ffffff" : "var(--text-secondary)",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* HTTPS Token Fields */}
      {authType === "https" && (
        <div style={AUTH_CARD_STYLE}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {isEn ? "Provider Preset:" : "Provider-Vorlage:"}
            </span>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {[
                { label: "GitHub", user: "x-access-token" },
                { label: "GitLab", user: "oauth2" },
                { label: "Gitea / Forgejo", user: "token" },
                { label: "Bitbucket", user: "x-token-auth" },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onHttpsUsernameChange(p.user)}
                  style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: httpsUsername === p.user ? "rgba(99, 102, 241, 0.2)" : "var(--bg-sidebar)",
                    color: httpsUsername === p.user ? "#c7d2fe" : "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "8px" }}>
            <div>
              <label style={{ display: "block", fontSize: "10.5px", color: "var(--text-muted)", marginBottom: "3px" }}>
                {isEn ? "Username / Token User" : "Benutzername / Token-User"}
              </label>
              <input
                type="text"
                value={httpsUsername}
                onChange={(e) => onHttpsUsernameChange(e.target.value)}
                placeholder="x-access-token / oauth2"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "10.5px", color: "var(--text-muted)", marginBottom: "3px" }}>
                {isEn ? "Personal Access Token (AES-256 encrypted)" : "Personal Access Token (AES-256 verschlüsselt)"}
              </label>
              <input
                type="password"
                value={httpsToken}
                onChange={(e) => onHttpsTokenChange(e.target.value)}
                placeholder={
                  hasSavedToken
                    ? isEn
                      ? "•••••••• (saved — leave blank to keep)"
                      : "•••••••• (gespeichert — leer lassen zum Behalten)"
                    : "ghp_... / glpat-..."
                }
                style={INPUT_STYLE}
              />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10.5px", color: "var(--text-muted)" }}>
            <Shield size={11} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
            <span>
              {isEn
                ? "Encrypted at rest via AES-256-GCM; never written in plaintext to .git/config."
                : "Wird per AES-256-GCM verschlüsselt gespeichert und niemals im Klartext in .git/config abgelegt."}
            </span>
          </div>
        </div>
      )}

      {/* SSH Deploy Key Fields (1-click generation in both Clone & Remote tabs) */}
      {authType === "ssh" && (
        <div style={AUTH_CARD_STYLE}>
          {canGenerateSshKey && onGenerateSshKey && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-primary)" }}>
                {isEn ? "Ed25519 Server Deploy Key" : "Ed25519 Server-Deploy-Key"}
              </span>
              <button
                type="button"
                disabled={isGeneratingSsh}
                onClick={onGenerateSshKey}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "6px",
                  border: "1px solid var(--accent-indigo)", backgroundColor: "rgba(99, 102, 241, 0.16)", color: "#c7d2fe",
                  fontSize: "11px", fontWeight: 600, cursor: isGeneratingSsh ? "not-allowed" : "pointer",
                }}
              >
                <KeyRound size={12} />
                <span>
                  {sshPublicKey
                    ? isEn ? "Rotate SSH Key" : "Neuen SSH-Key erzeugen"
                    : isEn ? "Generate SSH Deploy Key" : "SSH-Deploy-Key generieren"}
                </span>
              </button>
            </div>
          )}

          {sshPublicKey ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <input type="text" readOnly value={sshPublicKey} style={{ ...INPUT_STYLE, fontSize: "11px" }} />
                <button
                  type="button"
                  onClick={handleCopySshKey}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "0 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: copiedSsh ? "rgba(16, 185, 129, 0.2)" : "var(--bg-sidebar)",
                    color: copiedSsh ? "var(--accent-green)" : "var(--text-primary)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {copiedSsh ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedSsh ? (isEn ? "Copied" : "Kopiert") : isEn ? "Copy" : "Kopieren"}</span>
                </button>
              </div>
              <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                {isEn
                  ? "Add this Public Key in GitHub/GitLab → Settings → Deploy keys (enable 'Allow write access')."
                  : "Diesen Public Key in GitHub/GitLab unter Settings → Deploy keys hinterlegen ('Allow write access' aktivieren)."}
              </span>
            </div>
          ) : (
            onSshPrivateKeyInputChange && (
              <div>
                <label style={{ display: "block", fontSize: "10.5px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  {isEn
                    ? "Or paste existing OpenSSH Private Key (Ed25519 / RSA, encrypted at rest)"
                    : "Oder vorhandenen OpenSSH Private Key einfügen (Ed25519 / RSA, wird verschlüsselt gespeichert)"}
                </label>
                <textarea
                  rows={3}
                  value={sshPrivateKeyInput}
                  onChange={(e) => onSshPrivateKeyInputChange(e.target.value)}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                  style={{ ...INPUT_STYLE, resize: "vertical" }}
                />
              </div>
            )
          )}
        </div>
      )}

      {/* Workspace Visibility Selector */}
      <div>
        <label style={LABEL_UPPER_STYLE}>
          {isEn ? "Workspace Visibility" : "Projekt-Sichtbarkeit auf dem Server"}
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {(
            [
              {
                id: "team" as const,
                icon: <Globe size={14} style={{ color: "var(--accent-indigo)", flexShrink: 0 }} />,
                label: isEn ? "Shared Team Project (Scrum RBAC)" : "Team-Projekt (alle Rollen)",
              },
              {
                id: "private" as const,
                icon: <Lock size={14} style={{ color: "var(--accent-green)", flexShrink: 0 }} />,
                label: isEn ? "Private Developer Workspace" : "Privater Entwickler-Workspace",
              },
            ]
          ).map((item) => {
            const active = visibility === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onVisibilityChange(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: active ? "1px solid var(--accent-indigo)" : "1px solid var(--border-color)",
                  backgroundColor: active ? "rgba(99, 102, 241, 0.14)" : "var(--bg-panel)",
                  color: active ? "#ffffff" : "var(--text-secondary)",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
