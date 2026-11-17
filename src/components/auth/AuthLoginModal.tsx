"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Globe,
  KeyRound,
  Lock,
  LogOut,
  Server,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { AuthUser, OidcProviderPreset } from "../../types/auth";
import {
  getRoleBadgeMeta,
  LOCALHOST_DEMO_ACCOUNTS,
  modalBackdropStyle,
  modalInputStyle,
  modalLabelStyle,
  performServerJsonRequest,
} from "./authModalStyles";

export interface AuthLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: "de" | "en";
  apiBaseUrl?: string;
  currentUser?: AuthUser | null;
  oidcEnabled?: boolean;
  oidcProvider?: OidcProviderPreset;
  ldapEnabled?: boolean;
  ldapDomain?: string;
  onLoginSuccess?: (user: AuthUser, token?: string) => void;
  onLoginSubmit?: (username: string, password: string) => Promise<AuthUser>;
  onLogout?: () => Promise<void> | void;
  onStartOidcLogin?: () => void;
  onSaveServerUrl?: (serverUrl: string) => Promise<void> | void;
}

export function AuthLoginModal({
  isOpen,
  onClose,
  language = "de",
  apiBaseUrl = "",
  currentUser = null,
  oidcEnabled = false,
  oidcProvider = "keycloak",
  ldapEnabled = false,
  ldapDomain = "",
  onLoginSuccess,
  onLoginSubmit,
  onLogout,
  onStartOidcLogin,
  onSaveServerUrl,
}: AuthLoginModalProps) {
  const isEn = language === "en";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrlDraft, setServerUrlDraft] = useState(apiBaseUrl);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    setServerUrlDraft(apiBaseUrl);
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      setIsLocalhost(host === "localhost" || host === "127.0.0.1");
    }
  }, [apiBaseUrl, isOpen]);

  if (!isOpen) return null;

  const executeLogin = async (targetUser: string, targetPass: string) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (onLoginSubmit) {
        const loggedIn = await onLoginSubmit(targetUser, targetPass);
        onLoginSuccess?.(loggedIn);
      } else {
        const data = await performServerJsonRequest<{ user: AuthUser; token: string }>(
          serverUrlDraft || apiBaseUrl,
          "/api/auth/login",
          {
            method: "POST",
            body: JSON.stringify({ username: targetUser, password: targetPass }),
          }
        );
        if (typeof window !== "undefined" && data.token) {
          localStorage.setItem("mdteam_session_token", data.token);
        }
        onLoginSuccess?.(data.user, data.token);
      }
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : isEn
          ? "Authentication failed"
          : "Anmeldung fehlgeschlagen"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    await executeLogin(username.trim(), password);
  };

  const handleOidcClick = () => {
    if (onStartOidcLogin) {
      onStartOidcLogin();
      return;
    }
    const base = (serverUrlDraft || apiBaseUrl || "").replace(/\/+$/, "");
    window.location.href = `${base}/api/auth/oidc/login?returnTo=/`;
  };

  const providerTitle =
    oidcProvider === "entra-id"
      ? "Microsoft Entra ID"
      : oidcProvider === "github"
      ? "GitHub OAuth"
      : oidcProvider === "gitlab"
      ? "GitLab OAuth"
      : "Keycloak / OIDC SSO";

  return (
    <div onClick={onClose} style={modalBackdropStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(480px, 93vw)",
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
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <ShieldCheck size={18} color="var(--accent-indigo)" />
            <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
              {isEn ? "MDTeam Authentication & Scrum Identity" : "MDTeam Anmeldung & Scrum-Rolle"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
          {currentUser && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "9px",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "13px", fontWeight: 600 }}>
                  <CheckCircle2 size={15} color="var(--accent-green)" />
                  <span>{currentUser.displayName}</span>
                  <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "11.5px" }}>
                    {currentUser.handle}
                  </span>
                </div>
                <div style={{ marginTop: "4px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "999px",
                      color: getRoleBadgeMeta(currentUser.role).color,
                      backgroundColor: getRoleBadgeMeta(currentUser.role).bgColor,
                    }}
                  >
                    {isEn ? getRoleBadgeMeta(currentUser.role).labelEn : getRoleBadgeMeta(currentUser.role).labelDe}
                  </span>
                </div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  <LogOut size={13} />
                  {isEn ? "Sign Out" : "Abmelden"}
                </button>
              )}
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                padding: "9px 12px",
                borderRadius: "7px",
                backgroundColor: "rgba(239, 68, 68, 0.14)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                fontSize: "12.5px",
              }}
            >
              {errorMessage}
            </div>
          )}

          {ldapEnabled && (
            <div
              data-testid="ns8-ldap-active-badge"
              style={{
                display: "flex", alignItems: "center", gap: "7px", padding: "7px 11px", borderRadius: "7px",
                border: "1px solid rgba(59, 130, 246, 0.38)", backgroundColor: "rgba(59, 130, 246, 0.1)",
                color: "var(--text-primary)", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden",
              }}
            >
              <Server size={13} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {isEn
                  ? `NethServer 8 / LDAP Domain Login active${ldapDomain ? ` (${ldapDomain})` : ""}`
                  : `NethServer 8 / LDAP-Domänenanmeldung aktiv${ldapDomain ? ` (${ldapDomain})` : ""}`}
              </span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "11px" }}>
            <div>
              <label style={modalLabelStyle}>
                {isEn ? "Username, Handle or Email" : "Benutzername, @Handle oder E-Mail"}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isEn ? "e.g. po, sm, dev-a, admin" : "z. B. po, sm, dev-a, admin"}
                autoComplete="username"
                style={modalInputStyle}
              />
            </div>

            <div>
              <label style={modalLabelStyle}>{isEn ? "Password" : "Passwort"}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                style={modalInputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !username.trim() || !password}
              style={{
                marginTop: "2px",
                padding: "9px 14px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "var(--accent-indigo)",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "13px",
                cursor: isSubmitting ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
                opacity: isSubmitting || !username.trim() || !password ? 0.65 : 1,
              }}
            >
              <Lock size={14} />
              {isSubmitting
                ? isEn ? "Signing in..." : "Anmeldung läuft..."
                : ldapEnabled
                ? isEn ? "Sign In (LDAP Domain / Local)" : "Anmelden (LDAP-Domäne / Lokal)"
                : isEn ? "Sign In with Local Account" : "Mit lokalem Konto anmelden"}
            </button>
          </form>

          <button
            type="button"
            onClick={handleOidcClick}
            disabled={!oidcEnabled && !onStartOidcLogin}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-editor)",
              color: "var(--text-primary)",
              fontWeight: 600,
              fontSize: "12.5px",
              cursor: oidcEnabled || onStartOidcLogin ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              opacity: oidcEnabled ? 1 : 0.72,
            }}
          >
            <Globe size={14} color="var(--accent-blue)" />
            {isEn
              ? `Continue with Enterprise SSO (${providerTitle})`
              : `Weiter mit Enterprise SSO (${providerTitle})`}
          </button>

          {isLocalhost && (
            <div
              style={{
                padding: "11px 12px",
                borderRadius: "8px",
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: "8px",
                }}
              >
                <Sparkles size={13} color="var(--accent-yellow)" />
                <span>
                  {isEn
                    ? "Localhost Quick Role Switcher (Dev Seed Accounts)"
                    : "Localhost Schnellauswahl für Scrum-Rollen (Dev-Konten)"}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {LOCALHOST_DEMO_ACCOUNTS.map((demo) => {
                  const badge = getRoleBadgeMeta(demo.role);
                  return (
                    <button
                      key={demo.username}
                      type="button"
                      onClick={() => {
                        setUsername(demo.username);
                        setPassword("mdteam-dev-2026");
                      }}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--border-color)",
                        backgroundColor: badge.bgColor,
                        color: badge.color,
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      title={`${demo.username} (${demo.handle})`}
                    >
                      {isEn ? demo.labelEn : demo.labelDe} ({demo.username})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowServerConfig((v) => !v)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "11.5px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Server size={12} />
              {isEn ? "Configure Backend API Server URL" : "Backend-Server-URL konfigurieren"}
            </button>

            {showServerConfig && (
              <div style={{ marginTop: "8px", display: "flex", gap: "6px" }}>
                <input
                  type="url"
                  value={serverUrlDraft}
                  onChange={(e) => setServerUrlDraft(e.target.value)}
                  placeholder="http://localhost:4000"
                  style={{ ...modalInputStyle, fontSize: "12px" }}
                />
                <button
                  type="button"
                  onClick={() => void onSaveServerUrl?.(serverUrlDraft)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: "7px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-active)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <KeyRound size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                  {isEn ? "Apply" : "Übernehmen"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
