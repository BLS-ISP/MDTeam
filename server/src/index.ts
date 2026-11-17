import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import {
  buildClearSessionCookie,
  issueSessionForUser,
  requireAuthenticatedUser,
  requireRoleAction,
} from "./auth/jwtSession.js";
import { handleOidcCallback, handleOidcLoginRedirect } from "./auth/oidcClient.js";
import { authenticateViaLdap, isLdapEnabled } from "./auth/ldapClient.js";
import {
  authenticateLocalUser,
  createLocalUserAccount,
  deleteUserAccount,
  ensureUserStore,
  findOrProvisionLdapUser,
  getOidcServerConfig,
  getWebhookConfig,
  listPublicUsers,
  updateExistingUser,
  updateOidcServerConfig,
  updateWebhookConfig,
} from "./auth/userStore.js";
import { ensureProjectRepository } from "./git/serverGitBridge.js";
import {
  applyCorsAndSecurityHeaders,
  getDataDir,
  HttpError,
  readJsonBody,
  sendError,
  sendJson,
} from "./httpHelpers.js";
import {
  dispatchNotificationEvent,
  sendTestWebhookNotification,
  type OutgoingNotificationPayload,
} from "./notifications/webhookDispatcher.js";
import { handleProjectRoutes } from "./routes/projectRoutes.js";
import type { OidcServerConfig, ScrumRole, WebhookConfig } from "./types.js";

async function routeApiRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  applyCorsAndSecurityHeaders(req, res);

  const method = (req.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const hostHeader = req.headers.host || "localhost:4000";
  const url = new URL(req.url || "/", `http://${hostHeader}`);
  const pathname = url.pathname;

  // 1. Health Check
  if (pathname === "/api/health" && method === "GET") {
    const oidc = await getOidcServerConfig();
    sendJson(res, 200, {
      status: "ok",
      service: "mdteam-api",
      version: "1.1.0",
      oidcEnabled: Boolean(oidc.enabled && oidc.clientId),
      oidcProvider: oidc.provider,
      ldapEnabled: isLdapEnabled(),
      ldapDomain: process.env.LDAP_DOMAIN || "",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 2. Local + LDAP + Session Auth
  if (pathname === "/api/auth/login" && method === "POST") {
    const body = await readJsonBody<{ username?: string; password?: string }>(req);
    const rawUsername = body.username || "";
    const rawPassword = body.password || "";
    let user = await authenticateLocalUser(rawUsername, rawPassword);
    if (!user && isLdapEnabled()) {
      const ldapProfile = await authenticateViaLdap(rawUsername, rawPassword);
      if (ldapProfile) {
        user = await findOrProvisionLdapUser(ldapProfile);
      }
    }
    if (!user) {
      sendError(res, 401, "Invalid username or password", "INVALID_CREDENTIALS");
      return;
    }
    const { token, cookieHeader } = await issueSessionForUser(user);
    sendJson(
      res,
      200,
      { user, token },
      { "Set-Cookie": cookieHeader }
    );
    return;
  }

  if (pathname === "/api/auth/logout" && method === "POST") {
    sendJson(
      res,
      200,
      { ok: true },
      { "Set-Cookie": buildClearSessionCookie() }
    );
    return;
  }

  if (pathname === "/api/auth/me" && method === "GET") {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    sendJson(res, 200, { user });
    return;
  }

  // 3. OIDC / OAuth2 Enterprise SSO
  if (pathname === "/api/auth/oidc/providers" && method === "GET") {
    const oidc = await getOidcServerConfig();
    sendJson(res, 200, {
      enabled: Boolean(oidc.enabled && oidc.clientId),
      provider: oidc.provider,
      issuerUrl: oidc.issuerUrl,
    });
    return;
  }

  if (pathname === "/api/auth/oidc/login" && method === "GET") {
    await handleOidcLoginRedirect(req, res, url);
    return;
  }

  if (pathname === "/api/auth/oidc/callback" && method === "GET") {
    await handleOidcCallback(req, res, url);
    return;
  }

  // 4. Team Roster & Admin User Management (/api/users/*)
  if (pathname === "/api/users" || pathname === "/api/users/") {
    if (method === "GET") {
      const user = await requireAuthenticatedUser(req, res);
      if (!user) return;
      const users = await listPublicUsers();
      sendJson(res, 200, { users });
      return;
    }
    if (method === "POST") {
      const admin = await requireRoleAction(req, res, "manage_users");
      if (!admin) return;
      const body = await readJsonBody<{
        username?: string;
        displayName?: string;
        email?: string;
        handle?: string;
        role?: ScrumRole;
        password?: string;
      }>(req);
      const created = await createLocalUserAccount({
        username: body.username || "",
        displayName: body.displayName || "",
        email: body.email || "",
        handle: body.handle,
        role: body.role || "developer",
        password: body.password || "",
      });
      sendJson(res, 201, { user: created });
      return;
    }
  }

  if (pathname.startsWith("/api/users/")) {
    const targetId = decodeURIComponent(pathname.slice("/api/users/".length));
    if (method === "PUT" || method === "PATCH") {
      const admin = await requireRoleAction(req, res, "manage_users");
      if (!admin) return;
      const patch = await readJsonBody<{
        displayName?: string;
        email?: string;
        handle?: string;
        role?: ScrumRole;
        password?: string;
      }>(req);
      const updated = await updateExistingUser(targetId, patch);
      sendJson(res, 200, { user: updated });
      return;
    }
    if (method === "DELETE") {
      const admin = await requireRoleAction(req, res, "manage_users");
      if (!admin) return;
      await deleteUserAccount(targetId, admin.id);
      sendJson(res, 200, { deletedId: targetId });
      return;
    }
  }

  // 5. Admin OIDC Configuration (/api/admin/oidc)
  if (pathname === "/api/admin/oidc") {
    const admin = await requireRoleAction(req, res, "manage_users");
    if (!admin) return;

    if (method === "GET") {
      const cfg = await getOidcServerConfig();
      sendJson(res, 200, {
        oidc: {
          ...cfg,
          clientSecret: cfg.clientSecret ? "********" : "",
          hasClientSecret: Boolean(cfg.clientSecret),
        },
      });
      return;
    }
    if (method === "PUT") {
      const patch = await readJsonBody<Partial<OidcServerConfig>>(req);
      const updated = await updateOidcServerConfig(patch);
      sendJson(res, 200, {
        oidc: {
          ...updated,
          clientSecret: updated.clientSecret ? "********" : "",
          hasClientSecret: Boolean(updated.clientSecret),
        },
      });
      return;
    }
  }

  // 6. Outgoing Webhooks (MS Teams Adaptive Cards, Slack Block Kit, Email/JSON)
  if (pathname === "/api/notifications/config") {
    const admin = await requireRoleAction(req, res, "manage_users");
    if (!admin) return;

    if (method === "GET") {
      const webhooks = await getWebhookConfig();
      sendJson(res, 200, { webhooks });
      return;
    }
    if (method === "PUT") {
      const patch = await readJsonBody<Partial<WebhookConfig>>(req);
      const webhooks = await updateWebhookConfig(patch);
      sendJson(res, 200, { webhooks });
      return;
    }
  }

  if (pathname === "/api/notifications/dispatch" && method === "POST") {
    const actor = await requireRoleAction(req, res, "comment_or_feedback");
    if (!actor) return;
    const payload = await readJsonBody<OutgoingNotificationPayload>(req);
    if (!payload.event || !payload.title) {
      throw new HttpError(400, "Notification 'event' and 'title' are required", "INVALID_NOTIFICATION");
    }
    const config = await getWebhookConfig();
    const outcome = await dispatchNotificationEvent(config, payload, actor);
    sendJson(res, 200, outcome);
    return;
  }

  if (pathname === "/api/notifications/test" && method === "POST") {
    const admin = await requireRoleAction(req, res, "manage_users");
    if (!admin) return;
    const override = await readJsonBody<Partial<WebhookConfig>>(req);
    const saved = await getWebhookConfig();
    const effectiveConfig: WebhookConfig = {
      teamsWebhookUrl:
        typeof override.teamsWebhookUrl === "string"
          ? override.teamsWebhookUrl.trim()
          : saved.teamsWebhookUrl,
      slackWebhookUrl:
        typeof override.slackWebhookUrl === "string"
          ? override.slackWebhookUrl.trim()
          : saved.slackWebhookUrl,
      emailWebhookUrl:
        typeof override.emailWebhookUrl === "string"
          ? override.emailWebhookUrl.trim()
          : saved.emailWebhookUrl,
      events: saved.events,
    };
    const outcome = await sendTestWebhookNotification(effectiveConfig, admin);
    sendJson(res, 200, outcome);
    return;
  }

  // 7. Multi-Project Server Git-Bridge (/api/projects/*)
  const handledProject = await handleProjectRoutes(req, res, url);
  if (handledProject) return;

  sendError(res, 404, `API endpoint not found: ${method} ${pathname}`, "NOT_FOUND");
}

export function createMdTeamApiServer(): http.Server {
  return http.createServer((req, res) => {
    void routeApiRequest(req, res).catch((err: unknown) => {
      if (err instanceof HttpError) {
        sendError(res, err.statusCode, err.message, err.code);
        return;
      }
      console.error("[mdteam-api] Unhandled request error:", err);
      sendError(
        res,
        500,
        err instanceof Error ? err.message : "Internal server error",
        "INTERNAL_ERROR"
      );
    });
  });
}

async function bootstrap(): Promise<void> {
  const port = Number.parseInt(process.env.PORT || "4000", 10) || 4000;
  const host = process.env.HOST || "0.0.0.0";

  await ensureUserStore();
  await ensureProjectRepository("default");

  if (!process.env.MDTEAM_INITIAL_PASSWORD) {
    console.info(
      "[mdteam-api] Seeded default Scrum accounts (admin, po, sm, dev-a, dev-b, stakeholder). Set MDTEAM_INITIAL_PASSWORD in production."
    );
  }

  const server = createMdTeamApiServer();
  server.listen(port, host, () => {
    console.info(
      `[mdteam-api] Listening on http://${host}:${port} (DATA_DIR=${getDataDir()})`
    );
  });
}

if (process.env.MDTEAM_SKIP_AUTOSTART !== "1") {
  void bootstrap();
}
