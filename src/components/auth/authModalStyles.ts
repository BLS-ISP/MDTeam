import type React from "react";
import type { ScrumRole, WebhookEventType } from "../../types/auth";

export const SCRUM_ROLE_OPTIONS: Array<{
  role: ScrumRole;
  labelDe: string;
  labelEn: string;
  color: string;
  bgColor: string;
}> = [
  {
    role: "admin",
    labelDe: "Workspace Admin",
    labelEn: "Workspace Admin",
    color: "#f43f5e",
    bgColor: "rgba(244, 63, 94, 0.14)",
  },
  {
    role: "product-owner",
    labelDe: "Product Owner (PO)",
    labelEn: "Product Owner (PO)",
    color: "#8b5cf6",
    bgColor: "rgba(139, 92, 246, 0.16)",
  },
  {
    role: "scrum-master",
    labelDe: "Scrum Master (SM)",
    labelEn: "Scrum Master (SM)",
    color: "#10b981",
    bgColor: "rgba(16, 185, 129, 0.15)",
  },
  {
    role: "developer",
    labelDe: "Developer",
    labelEn: "Developer",
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.15)",
  },
  {
    role: "stakeholder",
    labelDe: "Stakeholder (Read-Only)",
    labelEn: "Stakeholder (Read-Only)",
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.15)",
  },
];

export const LOCALHOST_DEMO_ACCOUNTS: Array<{
  username: string;
  handle: string;
  role: ScrumRole;
  labelDe: string;
  labelEn: string;
}> = [
  {
    username: "po",
    handle: "@product-owner",
    role: "product-owner",
    labelDe: "Product Owner",
    labelEn: "Product Owner",
  },
  {
    username: "sm",
    handle: "@scrum-master",
    role: "scrum-master",
    labelDe: "Scrum Master",
    labelEn: "Scrum Master",
  },
  {
    username: "dev-a",
    handle: "@developer-a",
    role: "developer",
    labelDe: "Developer A",
    labelEn: "Developer A",
  },
  {
    username: "dev-b",
    handle: "@developer-b",
    role: "developer",
    labelDe: "Developer B",
    labelEn: "Developer B",
  },
  {
    username: "stakeholder",
    handle: "@stakeholder",
    role: "stakeholder",
    labelDe: "Stakeholder",
    labelEn: "Stakeholder",
  },
  {
    username: "admin",
    handle: "@admin",
    role: "admin",
    labelDe: "Admin",
    labelEn: "Admin",
  },
];

export const WEBHOOK_EVENT_META: Array<{
  event: WebhookEventType;
  labelDe: string;
  labelEn: string;
}> = [
  { event: "mention", labelDe: "@Erwähnungen in Issues & Wiki", labelEn: "@Mentions in Issues & Wiki" },
  { event: "blocker", labelDe: "Sprint-Blocker & Impediments", labelEn: "Sprint Blockers & Impediments" },
  { event: "review", labelDe: "Seiten-Freigabe & Sprint Review", labelEn: "Page Approval & Sprint Review" },
  { event: "sprint", labelDe: "Sprint-Start & Abschluss", labelEn: "Sprint Start & Completion" },
  { event: "assignment", labelDe: "Ticket-Zuweisungen", labelEn: "Issue Assignments" },
];

export function getRoleBadgeMeta(role: ScrumRole) {
  return (
    SCRUM_ROLE_OPTIONS.find((item) => item.role === role) || SCRUM_ROLE_OPTIONS[3]
  );
}

export const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.74)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1050,
  fontFamily: "var(--font-sans)",
};

export const modalInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  borderRadius: "7px",
  border: "1px solid var(--border-color)",
  backgroundColor: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontSize: "13px",
  outline: "none",
};

export const modalLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11.5px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: "5px",
};

export function blobToRawBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(
        typeof reader.result === "string"
          ? reader.result.replace(/^data:[^;]+;base64,/, "")
          : ""
      );
    reader.onerror = () => reject(reader.error || new Error("Failed to read asset"));
    reader.readAsDataURL(blob);
  });
}

export async function performServerJsonRequest<T = Record<string, unknown>>(
  apiBaseUrl: string,
  endpoint: string,
  init: RequestInit = {}
): Promise<T> {
  const cleanBase = (apiBaseUrl || "").replace(/\/+$/, "");
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("mdteam_session_token") || ""
      : "";
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const resp = await fetch(`${cleanBase}${endpoint}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : `Request failed (${resp.status})`
    );
  }
  return data as T;
}
