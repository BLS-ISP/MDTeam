"use client";

import React from "react";
import { BellRing, Check, Save, Send } from "lucide-react";
import type {
  WebhookConfig,
  WebhookDeliveryChannelResult,
  WebhookEventType,
} from "../../types/auth";
import {
  modalInputStyle,
  modalLabelStyle,
  WEBHOOK_EVENT_META,
} from "./authModalStyles";

export { AdminOidcTab, type AdminOidcTabProps } from "./AdminOidcTab";

export interface AdminWebhooksTabProps {
  isEn: boolean;
  webhookConfig: WebhookConfig;
  setWebhookConfig: React.Dispatch<React.SetStateAction<WebhookConfig>>;
  testResults: WebhookDeliveryChannelResult[] | null;
  isBusy: boolean;
  onSaveWebhooks: () => Promise<void>;
  onSendTestNotification: () => Promise<void>;
}

export function AdminWebhooksTab({
  isEn,
  webhookConfig,
  setWebhookConfig,
  testResults,
  isBusy,
  onSaveWebhooks,
  onSendTestNotification,
}: AdminWebhooksTabProps) {
  const toggleEvent = (ev: WebhookEventType) => {
    setWebhookConfig((prev) => {
      const exists = prev.events.includes(ev);
      return {
        ...prev,
        events: exists
          ? prev.events.filter((item) => item !== ev)
          : [...prev.events, ev],
      };
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div>
        <label style={modalLabelStyle}>
          {isEn
            ? "Microsoft Teams Incoming Webhook URL (Adaptive Card v1.4)"
            : "Microsoft Teams Webhook-URL (Adaptive Card v1.4)"}
        </label>
        <input
          type="url"
          value={webhookConfig.teamsWebhookUrl}
          onChange={(e) =>
            setWebhookConfig((prev) => ({ ...prev, teamsWebhookUrl: e.target.value }))
          }
          placeholder="https://outlook.office.com/webhook/..."
          style={modalInputStyle}
        />
      </div>

      <div>
        <label style={modalLabelStyle}>
          {isEn
            ? "Slack Incoming Webhook URL (Block Kit)"
            : "Slack Incoming Webhook-URL (Block Kit)"}
        </label>
        <input
          type="url"
          value={webhookConfig.slackWebhookUrl}
          onChange={(e) =>
            setWebhookConfig((prev) => ({ ...prev, slackWebhookUrl: e.target.value }))
          }
          placeholder="https://hooks.slack.com/services/T000/B000/XXXX"
          style={modalInputStyle}
        />
      </div>

      <div>
        <label style={modalLabelStyle}>
          {isEn
            ? "Email / Generic JSON Webhook Relay URL"
            : "E-Mail / Generischer JSON-Webhook-Endpunkt"}
        </label>
        <input
          type="url"
          value={webhookConfig.emailWebhookUrl}
          onChange={(e) =>
            setWebhookConfig((prev) => ({ ...prev, emailWebhookUrl: e.target.value }))
          }
          placeholder="https://mail-relay.company-internal.de/hooks/mdteam"
          style={modalInputStyle}
        />
      </div>

      <div
        style={{
          padding: "10px 12px",
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
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          <BellRing size={13} color="var(--accent-yellow)" />
          <span>
            {isEn
              ? "Subscribed Workspace & Scrum Events"
              : "Aktive Ereignisse für ausgehende Benachrichtigungen"}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
          {WEBHOOK_EVENT_META.map((item) => {
            const active = webhookConfig.events.includes(item.event);
            return (
              <label
                key={item.event}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  fontSize: "12px",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleEvent(item.event)}
                />
                <span>{isEn ? item.labelEn : item.labelDe}</span>
              </label>
            );
          })}
        </div>
      </div>

      {testResults && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-editor)",
            fontSize: "12px",
          }}
        >
          {testResults.length === 0 ? (
            <span style={{ color: "var(--accent-yellow)" }}>
              {isEn
                ? "No webhook URL configured yet — enter at least one URL above."
                : "Noch keine Webhook-URL eingetragen — bitte mindestens eine URL angeben."}
            </span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {testResults.map((res) => (
                <div
                  key={res.channel}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <strong style={{ textTransform: "uppercase" }}>{res.channel}</strong>
                  <span style={{ color: res.ok ? "var(--accent-green)" : "var(--accent-red)" }}>
                    {res.ok ? (
                      <>
                        <Check size={12} style={{ verticalAlign: "middle", marginRight: "3px" }} />
                        HTTP {res.status || 200} OK
                      </>
                    ) : (
                      res.error || "Failed"
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "4px" }}>
        <button
          type="button"
          onClick={() => void onSendTestNotification()}
          disabled={isBusy}
          style={{
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-editor)",
            color: "var(--text-primary)",
            fontWeight: 600,
            fontSize: "12.5px",
            cursor: isBusy ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Send size={13} color="var(--accent-green)" />
          {isEn ? "Send Test Notification" : "Test-Benachrichtigung senden"}
        </button>

        <button
          type="button"
          onClick={() => void onSaveWebhooks()}
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
          {isEn ? "Save Webhook Configuration" : "Webhooks speichern"}
        </button>
      </div>
    </div>
  );
}
