"use client";

import React from "react";
import { Globe, Save } from "lucide-react";
import type {
  OidcClientConfig,
  OidcProviderPreset,
  ScrumRole,
} from "../../types/auth";
import {
  modalInputStyle,
  modalLabelStyle,
  SCRUM_ROLE_OPTIONS,
} from "./authModalStyles";

export interface AdminOidcTabProps {
  isEn: boolean;
  oidcConfig: OidcClientConfig;
  setOidcConfig: React.Dispatch<React.SetStateAction<OidcClientConfig>>;
  isBusy: boolean;
  onSaveOidc: () => Promise<void>;
}

export function AdminOidcTab({
  isEn,
  oidcConfig,
  setOidcConfig,
  isBusy,
  onSaveOidc,
}: AdminOidcTabProps) {
  const presets: Array<{ id: OidcProviderPreset; label: string }> = [
    { id: "keycloak", label: "Keycloak (OIDC)" },
    { id: "entra-id", label: "Microsoft Entra ID" },
    { id: "github", label: "GitHub OAuth2" },
    { id: "gitlab", label: "GitLab Self-Hosted / Cloud" },
    { id: "custom", label: isEn ? "Custom OIDC" : "Benutzerdefiniertes OIDC" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-primary)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={oidcConfig.enabled}
          onChange={(e) =>
            setOidcConfig((prev) => ({ ...prev, enabled: e.target.checked }))
          }
        />
        <Globe size={15} color="var(--accent-blue)" />
        <span>
          {isEn
            ? "Enable Enterprise OIDC / OAuth2 Single Sign-On"
            : "Enterprise OIDC / OAuth2 Single Sign-On aktivieren"}
        </span>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div>
          <label style={modalLabelStyle}>
            {isEn ? "Identity Provider Preset" : "Identity-Provider Vorlage"}
          </label>
          <select
            value={oidcConfig.provider}
            onChange={(e) =>
              setOidcConfig((prev) => ({
                ...prev,
                provider: e.target.value as OidcProviderPreset,
              }))
            }
            style={modalInputStyle}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={modalLabelStyle}>
            {isEn ? "Default Role for New SSO Users" : "Standard-Rolle für neue SSO-Konten"}
          </label>
          <select
            value={oidcConfig.defaultRole}
            onChange={(e) =>
              setOidcConfig((prev) => ({
                ...prev,
                defaultRole: e.target.value as ScrumRole,
              }))
            }
            style={modalInputStyle}
          >
            {SCRUM_ROLE_OPTIONS.map((r) => (
              <option key={r.role} value={r.role}>
                {isEn ? r.labelEn : r.labelDe}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={modalLabelStyle}>
          {isEn
            ? "Issuer URL (Keycloak Realm / Entra Tenant / GitLab Base URL)"
            : "Issuer-URL (Keycloak Realm / Entra Tenant / GitLab Basis-URL)"}
        </label>
        <input
          type="url"
          value={oidcConfig.issuerUrl}
          onChange={(e) =>
            setOidcConfig((prev) => ({ ...prev, issuerUrl: e.target.value }))
          }
          placeholder="https://keycloak.company.de/realms/mdteam"
          style={modalInputStyle}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div>
          <label style={modalLabelStyle}>Client ID</label>
          <input
            type="text"
            value={oidcConfig.clientId}
            onChange={(e) =>
              setOidcConfig((prev) => ({ ...prev, clientId: e.target.value }))
            }
            placeholder="mdteam-workspace"
            style={modalInputStyle}
          />
        </div>
        <div>
          <label style={modalLabelStyle}>Client Secret</label>
          <input
            type="password"
            value={oidcConfig.clientSecret || ""}
            onChange={(e) =>
              setOidcConfig((prev) => ({ ...prev, clientSecret: e.target.value }))
            }
            placeholder={oidcConfig.hasClientSecret ? "********" : "secret"}
            style={modalInputStyle}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "10px" }}>
        <div>
          <label style={modalLabelStyle}>Redirect Callback URI</label>
          <input
            type="url"
            value={oidcConfig.redirectUri}
            onChange={(e) =>
              setOidcConfig((prev) => ({ ...prev, redirectUri: e.target.value }))
            }
            placeholder="http://localhost:4000/api/auth/oidc/callback"
            style={modalInputStyle}
          />
        </div>
        <div>
          <label style={modalLabelStyle}>OAuth Scopes</label>
          <input
            type="text"
            value={oidcConfig.scopes}
            onChange={(e) =>
              setOidcConfig((prev) => ({ ...prev, scopes: e.target.value }))
            }
            placeholder="openid profile email"
            style={modalInputStyle}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
        <button
          type="button"
          onClick={() => void onSaveOidc()}
          disabled={isBusy}
          style={{
            padding: "8px 15px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "var(--accent-indigo)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "12.5px",
            cursor: isBusy ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Save size={14} />
          {isEn ? "Save OIDC / SSO Settings" : "OIDC / SSO Konfiguration speichern"}
        </button>
      </div>
    </div>
  );
}
