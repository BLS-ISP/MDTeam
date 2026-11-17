"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Bell, Globe, RefreshCw, ShieldAlert, Users, X } from "lucide-react";
import {
  canRolePerform,
  type AuthUser,
  type OidcClientConfig,
  type ScrumRole,
  type WebhookConfig,
  type WebhookDeliveryChannelResult,
} from "../../types/auth";
import { AdminTeamUsersTab } from "./AdminTeamUsersTab";
import { AdminOidcTab, AdminWebhooksTab } from "./AdminWebhooksAndOidcTabs";
import { modalBackdropStyle, performServerJsonRequest } from "./authModalStyles";

export interface TeamAndWebhookAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: "de" | "en";
  apiBaseUrl?: string;
  currentUser?: AuthUser | null;
  onUsersUpdated?: (users: AuthUser[]) => void;
}

const DEFAULT_WEBHOOK_STATE: WebhookConfig = {
  teamsWebhookUrl: "",
  slackWebhookUrl: "",
  emailWebhookUrl: "",
  events: ["mention", "blocker", "review", "sprint", "assignment"],
};

const DEFAULT_OIDC_STATE: OidcClientConfig = {
  enabled: false,
  provider: "keycloak",
  issuerUrl: "https://keycloak.company-internal.de/realms/mdteam",
  authorizationEndpoint: "",
  tokenEndpoint: "",
  userinfoEndpoint: "",
  clientId: "",
  clientSecret: "",
  redirectUri: "http://localhost:4000/api/auth/oidc/callback",
  scopes: "openid profile email",
  defaultRole: "developer",
};

export function TeamAndWebhookAdminModal({
  isOpen,
  onClose,
  language = "de",
  apiBaseUrl = "",
  currentUser = null,
  onUsersUpdated,
}: TeamAndWebhookAdminModalProps) {
  const isEn = language === "en";
  const [activeTab, setActiveTab] = useState<"users" | "oidc" | "webhooks">("users");
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>(DEFAULT_WEBHOOK_STATE);
  const [oidcConfig, setOidcConfig] = useState<OidcClientConfig>(DEFAULT_OIDC_STATE);
  const [testResults, setTestResults] = useState<WebhookDeliveryChannelResult[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const isAdmin = currentUser ? canRolePerform(currentUser.role, "manage_users") : true;

  const loadAdminData = useCallback(async () => {
    setIsBusy(true);
    setStatusBanner(null);
    try {
      const [uRes, wRes, oRes] = await Promise.allSettled([
        performServerJsonRequest<{ users: AuthUser[] }>(apiBaseUrl, "/api/users"),
        performServerJsonRequest<{ webhooks: WebhookConfig }>(
          apiBaseUrl,
          "/api/notifications/config"
        ),
        performServerJsonRequest<{ oidc: OidcClientConfig }>(apiBaseUrl, "/api/admin/oidc"),
      ]);
      if (uRes.status === "fulfilled" && Array.isArray(uRes.value.users)) {
        setUsers(uRes.value.users);
        onUsersUpdated?.(uRes.value.users);
      }
      if (wRes.status === "fulfilled" && wRes.value.webhooks) {
        setWebhookConfig(wRes.value.webhooks);
      }
      if (oRes.status === "fulfilled" && oRes.value.oidc) {
        setOidcConfig(oRes.value.oidc);
      }
    } catch (err) {
      setStatusBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to load admin configuration",
      });
    } finally {
      setIsBusy(false);
    }
  }, [apiBaseUrl, onUsersUpdated]);

  useEffect(() => {
    if (isOpen) {
      setTestResults(null);
      void loadAdminData();
    }
  }, [isOpen, loadAdminData]);

  if (!isOpen) return null;

  const handleRoleChange = async (userId: string, role: ScrumRole) => {
    setIsBusy(true);
    setStatusBanner(null);
    try {
      const res = await performServerJsonRequest<{ user: AuthUser }>(
        apiBaseUrl,
        `/api/users/${encodeURIComponent(userId)}`,
        { method: "PUT", body: JSON.stringify({ role }) }
      );
      const next = users.map((u) => (u.id === userId ? res.user : u));
      setUsers(next);
      onUsersUpdated?.(next);
      setStatusBanner({
        kind: "ok",
        text: isEn ? "Scrum role updated." : "Scrum-Rolle aktualisiert.",
      });
    } catch (err) {
      setStatusBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Role update failed",
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateUser = async (input: {
    username: string;
    displayName: string;
    email: string;
    role: ScrumRole;
    password: string;
  }): Promise<boolean> => {
    setIsBusy(true);
    setStatusBanner(null);
    try {
      const res = await performServerJsonRequest<{ user: AuthUser }>(
        apiBaseUrl,
        "/api/users",
        { method: "POST", body: JSON.stringify(input) }
      );
      const next = [...users, res.user];
      setUsers(next);
      onUsersUpdated?.(next);
      setStatusBanner({
        kind: "ok",
        text: isEn ? "Team account created." : "Team-Konto angelegt.",
      });
      return true;
    } catch (err) {
      setStatusBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to create account",
      });
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setIsBusy(true);
    setStatusBanner(null);
    try {
      await performServerJsonRequest(apiBaseUrl, `/api/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const next = users.filter((u) => u.id !== userId);
      setUsers(next);
      onUsersUpdated?.(next);
    } catch (err) {
      setStatusBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Delete failed",
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveOidc = async () => {
    setIsBusy(true);
    setStatusBanner(null);
    try {
      const res = await performServerJsonRequest<{ oidc: OidcClientConfig }>(
        apiBaseUrl,
        "/api/admin/oidc",
        { method: "PUT", body: JSON.stringify(oidcConfig) }
      );
      setOidcConfig(res.oidc);
      setStatusBanner({
        kind: "ok",
        text: isEn ? "OIDC / SSO configuration saved." : "OIDC / SSO Einstellungen gespeichert.",
      });
    } catch (err) {
      setStatusBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to save OIDC settings",
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveWebhooks = async () => {
    setIsBusy(true);
    setStatusBanner(null);
    try {
      const res = await performServerJsonRequest<{ webhooks: WebhookConfig }>(
        apiBaseUrl,
        "/api/notifications/config",
        { method: "PUT", body: JSON.stringify(webhookConfig) }
      );
      setWebhookConfig(res.webhooks);
      setStatusBanner({
        kind: "ok",
        text: isEn ? "Webhook configuration saved." : "Webhook-Konfiguration gespeichert.",
      });
    } catch (err) {
      setStatusBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to save webhooks",
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendTestNotification = async () => {
    setIsBusy(true);
    setStatusBanner(null);
    try {
      const res = await performServerJsonRequest<{
        results: WebhookDeliveryChannelResult[];
      }>(apiBaseUrl, "/api/notifications/test", {
        method: "POST",
        body: JSON.stringify(webhookConfig),
      });
      setTestResults(res.results || []);
    } catch (err) {
      setStatusBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Test webhook dispatch failed",
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={modalBackdropStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 95vw)",
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
            <Users size={18} color="var(--accent-indigo)" />
            <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
              {isEn
                ? "Team Accounts, Scrum RBAC & Outgoing Webhooks"
                : "Team-Konten, Scrum-RBAC & Ausgehende Webhooks"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => void loadAdminData()}
              title={isEn ? "Refresh" : "Aktualisieren"}
              style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "6px",
            padding: "8px 18px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-primary)",
          }}
        >
          {[
            { id: "users" as const, icon: Users, de: "Team & Scrum-Rollen", en: "Team & Scrum Roles" },
            { id: "oidc" as const, icon: Globe, de: "SSO / OIDC", en: "SSO / OIDC" },
            { id: "webhooks" as const, icon: Bell, de: "Teams / Slack / E-Mail Webhooks", en: "Teams / Slack / Email Webhooks" },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "7px",
                  border: active ? "1px solid var(--accent-indigo)" : "1px solid transparent",
                  backgroundColor: active ? "rgba(99, 102, 241, 0.16)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Icon size={13} />
                {isEn ? tab.en : tab.de}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "16px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
          {!isAdmin && (
            <div
              style={{
                padding: "9px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(245, 158, 11, 0.14)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                color: "var(--accent-yellow)",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <ShieldAlert size={15} />
              <span>
                {isEn
                  ? "Admin privileges ('admin' role) are required to mutate users, OIDC, or webhook endpoints."
                  : "Administrator-Rechte (Rolle 'admin') sind für Änderungen an Benutzern, OIDC oder Webhooks erforderlich."}
              </span>
            </div>
          )}

          {statusBanner && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "7px",
                backgroundColor:
                  statusBanner.kind === "ok"
                    ? "rgba(16, 185, 129, 0.14)"
                    : "rgba(239, 68, 68, 0.14)",
                border:
                  statusBanner.kind === "ok"
                    ? "1px solid rgba(16, 185, 129, 0.4)"
                    : "1px solid rgba(239, 68, 68, 0.4)",
                color: statusBanner.kind === "ok" ? "var(--accent-green)" : "#fca5a5",
                fontSize: "12px",
              }}
            >
              {statusBanner.text}
            </div>
          )}

          {activeTab === "users" && (
            <AdminTeamUsersTab
              isEn={isEn}
              users={users}
              currentUser={currentUser}
              isAdmin={isAdmin}
              isBusy={isBusy}
              onRoleChange={handleRoleChange}
              onDeleteUser={handleDeleteUser}
              onCreateUser={handleCreateUser}
            />
          )}

          {activeTab === "oidc" && (
            <AdminOidcTab
              isEn={isEn}
              oidcConfig={oidcConfig}
              setOidcConfig={setOidcConfig}
              isBusy={isBusy || !isAdmin}
              onSaveOidc={handleSaveOidc}
            />
          )}

          {activeTab === "webhooks" && (
            <AdminWebhooksTab
              isEn={isEn}
              webhookConfig={webhookConfig}
              setWebhookConfig={setWebhookConfig}
              testResults={testResults}
              isBusy={isBusy || !isAdmin}
              onSaveWebhooks={handleSaveWebhooks}
              onSendTestNotification={handleSendTestNotification}
            />
          )}
        </div>
      </div>
    </div>
  );
}
