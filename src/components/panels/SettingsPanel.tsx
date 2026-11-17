"use client";

import React from "react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import type { WorkspaceLanguage } from "../../constants/translations";

export function SettingsPanel() {
  const {
    t,
    language,
    setLanguage,
    authStrategy,
    setAuthStrategy,
    keycloakUrl,
    setKeycloakUrl,
    ldapUrl,
    setLdapUrl,
    gitProvider,
    setGitProvider,
    gitUrl,
    setGitUrl,
    yjsUrl,
    setYjsUrl,
  } = useWorkspaceContext();

  return (
    <>
      <div className="panel-header">
        <span>{t.settingsTitle}</span>
      </div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="settings-group">
          <label className="settings-label">{t.languageLabel}</label>
          <select
            className="settings-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as WorkspaceLanguage)}
          >
            <option value="de">{t.languageDE}</option>
            <option value="en">{t.languageEN}</option>
          </select>
        </div>

        <div className="settings-group">
          <label className="settings-label">{t.authLabel}</label>
          <select
            className="settings-select"
            value={authStrategy}
            onChange={(e) => setAuthStrategy(e.target.value)}
          >
            <option value="keycloak">{t.authOIDC}</option>
            <option value="ldap">{t.authLDAP}</option>
            <option value="local">{t.authLocal}</option>
          </select>
        </div>

        {authStrategy === "keycloak" && (
          <div className="settings-group">
            <label className="settings-label">{t.keycloakUrlLabel}</label>
            <input
              type="text"
              className="settings-input"
              value={keycloakUrl}
              onChange={(e) => setKeycloakUrl(e.target.value)}
            />
          </div>
        )}

        {authStrategy === "ldap" && (
          <div className="settings-group">
            <label className="settings-label">{t.ldapUrlLabel}</label>
            <input
              type="text"
              className="settings-input"
              value={ldapUrl}
              onChange={(e) => setLdapUrl(e.target.value)}
            />
          </div>
        )}

        <div className="settings-group">
          <label className="settings-label">{t.gitProviderLabel}</label>
          <select
            className="settings-select"
            value={gitProvider}
            onChange={(e) => setGitProvider(e.target.value)}
          >
            <option value="gitlab-selfhosted">GitLab (Self-hosted)</option>
            <option value="github-cloud">GitHub Enterprise (Cloud)</option>
          </select>
        </div>

        <div className="settings-group">
          <label className="settings-label">{t.gitUrlLabel}</label>
          <input
            type="text"
            className="settings-input"
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
          />
        </div>

        <div className="settings-group">
          <label className="settings-label">Yjs Server URL</label>
          <input
            type="text"
            className="settings-input"
            value={yjsUrl}
            onChange={(e) => setYjsUrl(e.target.value)}
            placeholder="ws://localhost:1234"
          />
        </div>
      </div>
    </>
  );
}
