import { HttpError } from "../httpHelpers.js";
import { assertSafeOutboundUrl } from "../security/ssrfDnsGuard.js";
import type { AuthUser, WebhookConfig, WebhookEventType } from "../types.js";

const WEBHOOK_SSRF_GUARD_OPTS = {
  allowLocalEnvVar: "MDTEAM_ALLOW_LOCAL_WEBHOOKS",
  allowLocalWhenSkipAutostart: true,
} as const;

export interface OutgoingNotificationPayload {
  event: WebhookEventType;
  title: string;
  summary: string;
  projectId?: string;
  targetPath?: string;
  url?: string;
  severity?: "info" | "warning" | "critical";
  recipientHandle?: string;
}

export interface ChannelDispatchResult {
  channel: "teams" | "slack" | "email";
  ok: boolean;
  status?: number;
  error?: string;
}

function validateOutboundWebhookUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new HttpError(400, `Invalid webhook URL: ${trimmed}`, "INVALID_WEBHOOK_URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new HttpError(
      400,
      "Webhook URL must use https:// or http:// protocol",
      "INVALID_WEBHOOK_PROTOCOL"
    );
  }
  return parsed.toString();
}

function eventBadgeLabel(event: WebhookEventType): string {
  switch (event) {
    case "mention":
      return "@Mention";
    case "blocker":
      return "Sprint Blocker";
    case "review":
      return "Review & Approval";
    case "sprint":
      return "Sprint Lifecycle";
    case "assignment":
      return "Ticket Assignment";
  }
}

function buildTeamsAdaptiveCard(
  payload: OutgoingNotificationPayload,
  actor: AuthUser,
  timestampIso: string
): Record<string, unknown> {
  const accentColor =
    payload.severity === "critical" || payload.event === "blocker"
      ? "Attention"
      : payload.severity === "warning"
      ? "Warning"
      : "Accent";

  const facts: Array<{ title: string; value: string }> = [
    { title: "Event", value: eventBadgeLabel(payload.event) },
    { title: "Actor", value: `${actor.displayName} (${actor.handle})` },
  ];
  if (payload.projectId) {
    facts.push({ title: "Project", value: payload.projectId });
  }
  if (payload.targetPath) {
    facts.push({ title: "Document / Issue", value: payload.targetPath });
  }
  if (payload.recipientHandle) {
    facts.push({ title: "Recipient", value: payload.recipientHandle });
  }

  const actions = payload.url
    ? [
        {
          type: "Action.OpenUrl",
          title: "Open in MDTeam Workspace",
          url: payload.url,
        },
      ]
    : [];

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              size: "Medium",
              weight: "Bolder",
              color: accentColor,
              text: `[MDTeam] ${payload.title}`,
              wrap: true,
            },
            {
              type: "TextBlock",
              text: payload.summary,
              wrap: true,
              spacing: "Small",
            },
            {
              type: "FactSet",
              facts,
              spacing: "Medium",
            },
            {
              type: "TextBlock",
              size: "Small",
              isSubtle: true,
              text: `Dispatched at ${timestampIso}`,
              spacing: "Small",
            },
          ],
          actions,
        },
      },
    ],
  };
}

function buildSlackBlockKitPayload(
  payload: OutgoingNotificationPayload,
  actor: AuthUser,
  timestampIso: string
): Record<string, unknown> {
  const fields: Array<{ type: string; text: string }> = [
    { type: "mrkdwn", text: `*Type:*\n${eventBadgeLabel(payload.event)}` },
    { type: "mrkdwn", text: `*Triggered by:*\n${actor.displayName} (\`${actor.handle}\`)` },
  ];
  if (payload.targetPath) {
    fields.push({ type: "mrkdwn", text: `*File:*\n\`${payload.targetPath}\`` });
  }
  if (payload.recipientHandle) {
    fields.push({ type: "mrkdwn", text: `*Target:*\n\`${payload.recipientHandle}\`` });
  }

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `MDTeam: ${payload.title}`.slice(0, 148),
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: payload.summary,
      },
    },
    {
      type: "section",
      fields,
    },
  ];

  if (payload.url) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open in MDTeam", emoji: true },
          url: payload.url,
        },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Project: *${payload.projectId || "default"}* • ${timestampIso}`,
      },
    ],
  });

  return {
    text: `[MDTeam ${eventBadgeLabel(payload.event)}] ${payload.title} — ${payload.summary}`,
    blocks,
  };
}

function buildGenericEmailJsonPayload(
  payload: OutgoingNotificationPayload,
  actor: AuthUser,
  timestampIso: string
): Record<string, unknown> {
  const subject = `[MDTeam ${eventBadgeLabel(payload.event)}] ${payload.title}`;
  const textBody = [
    subject,
    "",
    payload.summary,
    "",
    `Actor: ${actor.displayName} (${actor.handle} / ${actor.email})`,
    payload.projectId ? `Project: ${payload.projectId}` : "",
    payload.targetPath ? `Document: ${payload.targetPath}` : "",
    payload.url ? `Workspace Link: ${payload.url}` : "",
    `Timestamp: ${timestampIso}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    source: "mdteam-api",
    event: payload.event,
    severity: payload.severity || "info",
    subject,
    title: payload.title,
    summary: payload.summary,
    projectId: payload.projectId || "default",
    targetPath: payload.targetPath || "",
    recipientHandle: payload.recipientHandle || "",
    url: payload.url || "",
    actor: {
      username: actor.username,
      displayName: actor.displayName,
      handle: actor.handle,
      email: actor.email,
      role: actor.role,
    },
    textBody,
    timestamp: timestampIso,
  };
}

export async function validateWebhookPatchUrls(patch: Partial<WebhookConfig>): Promise<void> {
  const candidates = [patch.teamsWebhookUrl, patch.slackWebhookUrl, patch.emailWebhookUrl];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      const validUrl = validateOutboundWebhookUrl(candidate);
      await assertSafeOutboundUrl(validUrl, WEBHOOK_SSRF_GUARD_OPTS);
    }
  }
}

async function postJsonWebhook(
  channel: "teams" | "slack" | "email",
  rawUrl: string,
  bodyObj: Record<string, unknown>
): Promise<ChannelDispatchResult> {
  try {
    const validUrl = validateOutboundWebhookUrl(rawUrl);
    const safeUrl = await assertSafeOutboundUrl(validUrl, WEBHOOK_SSRF_GUARD_OPTS);
    const resp = await fetch(safeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "MDTeam-WebhookDispatcher/1.0",
      },
      body: JSON.stringify(bodyObj),
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      return {
        channel,
        ok: false,
        status: resp.status,
        error: `HTTP ${resp.status} ${resp.statusText}`,
      };
    }

    return { channel, ok: true, status: resp.status };
  } catch (err) {
    return {
      channel,
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function dispatchNotificationEvent(
  config: WebhookConfig,
  payload: OutgoingNotificationPayload,
  actor: AuthUser,
  options?: { bypassEventFilter?: boolean }
): Promise<{ skipped: boolean; results: ChannelDispatchResult[] }> {
  if (!options?.bypassEventFilter && !config.events.includes(payload.event)) {
    return { skipped: true, results: [] };
  }

  const timestampIso = new Date().toISOString();
  const tasks: Array<Promise<ChannelDispatchResult>> = [];

  if (config.teamsWebhookUrl.trim()) {
    tasks.push(
      postJsonWebhook(
        "teams",
        config.teamsWebhookUrl,
        buildTeamsAdaptiveCard(payload, actor, timestampIso)
      )
    );
  }

  if (config.slackWebhookUrl.trim()) {
    tasks.push(
      postJsonWebhook(
        "slack",
        config.slackWebhookUrl,
        buildSlackBlockKitPayload(payload, actor, timestampIso)
      )
    );
  }

  if (config.emailWebhookUrl.trim()) {
    tasks.push(
      postJsonWebhook(
        "email",
        config.emailWebhookUrl,
        buildGenericEmailJsonPayload(payload, actor, timestampIso)
      )
    );
  }

  const results = await Promise.all(tasks);
  return { skipped: false, results };
}

export async function sendTestWebhookNotification(
  config: WebhookConfig,
  actor: AuthUser
): Promise<{ results: ChannelDispatchResult[] }> {
  const outcome = await dispatchNotificationEvent(
    config,
    {
      event: "sprint",
      severity: "info",
      projectId: "default",
      targetPath: "sprints/sprint-01.md",
      title: "Webhook Connectivity Verification",
      summary:
        "Test notification from MDTeam Multi-User Backend confirming Adaptive Card, Slack Block Kit, and Email/JSON relay formatting.",
    },
    actor,
    { bypassEventFilter: true }
  );
  return { results: outcome.results };
}
