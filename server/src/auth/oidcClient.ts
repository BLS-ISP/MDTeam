import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { HttpError, parseCookies, sendError } from "../httpHelpers.js";
import {
  isValidScrumRole,
  type OidcProviderPreset,
  type OidcServerConfig,
  type ScrumRole,
} from "../types.js";
import {
  getJwtSecret,
  issueSessionForUser,
  signHmacJwt,
  verifyHmacJwt,
} from "./jwtSession.js";
import { findOrProvisionOidcUser, getOidcServerConfig } from "./userStore.js";

const OIDC_STATE_COOKIE = "mdteam_oidc_state";

interface OidcStatePayload {
  state: string;
  verifier: string;
  returnTo: string;
  provider: OidcProviderPreset;
}

interface ResolvedOidcEndpoints {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  scopes: string;
}

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function safeTimingEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function resolveProviderEndpoints(
  config: OidcServerConfig
): Promise<ResolvedOidcEndpoints> {
  if (config.provider === "github") {
    return {
      authorizationEndpoint:
        config.authorizationEndpoint || "https://github.com/login/oauth/authorize",
      tokenEndpoint:
        config.tokenEndpoint || "https://github.com/login/oauth/access_token",
      userinfoEndpoint: config.userinfoEndpoint || "https://api.github.com/user",
      scopes: config.scopes || "read:user user:email",
    };
  }

  if (config.provider === "gitlab") {
    const base = (config.issuerUrl || "https://gitlab.com").replace(/\/+$/, "");
    return {
      authorizationEndpoint:
        config.authorizationEndpoint || `${base}/oauth/authorize`,
      tokenEndpoint: config.tokenEndpoint || `${base}/oauth/token`,
      userinfoEndpoint: config.userinfoEndpoint || `${base}/api/v4/user`,
      scopes: config.scopes || "read_user openid profile email",
    };
  }

  if (
    config.authorizationEndpoint &&
    config.tokenEndpoint &&
    config.userinfoEndpoint
  ) {
    return {
      authorizationEndpoint: config.authorizationEndpoint,
      tokenEndpoint: config.tokenEndpoint,
      userinfoEndpoint: config.userinfoEndpoint,
      scopes: config.scopes || "openid profile email",
    };
  }

  // Standard OIDC Discovery for Keycloak, Microsoft Entra ID, and Custom OIDC
  const cleanIssuer = config.issuerUrl.replace(/\/+$/, "");
  if (!cleanIssuer) {
    throw new HttpError(400, "OIDC issuerUrl is not configured", "OIDC_MISCONFIGURED");
  }

  const discoveryUrl = `${cleanIssuer}/.well-known/openid-configuration`;
  const resp = await fetch(discoveryUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!resp.ok) {
    throw new HttpError(
      502,
      `OIDC discovery failed (${resp.status}) at ${discoveryUrl}`,
      "OIDC_DISCOVERY_FAILED"
    );
  }
  const doc = (await resp.json()) as Record<string, unknown>;
  const authUrl = String(doc.authorization_endpoint || config.authorizationEndpoint || "");
  const tokenUrl = String(doc.token_endpoint || config.tokenEndpoint || "");
  const userinfoUrl = String(doc.userinfo_endpoint || config.userinfoEndpoint || "");

  if (!authUrl || !tokenUrl) {
    throw new HttpError(
      502,
      "OIDC discovery document missing authorization_endpoint or token_endpoint",
      "OIDC_DISCOVERY_INVALID"
    );
  }

  return {
    authorizationEndpoint: authUrl,
    tokenEndpoint: tokenUrl,
    userinfoEndpoint: userinfoUrl,
    scopes: config.scopes || "openid profile email",
  };
}

function sanitizeReturnTo(rawReturnTo: string | null): string {
  if (!rawReturnTo) return "/";
  const trimmed = rawReturnTo.trim();
  // Prevent open redirects: allow only relative root paths starting with single '/'
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  return "/";
}

export async function handleOidcLoginRedirect(
  req: IncomingMessage,
  res: ServerResponse,
  requestUrl: URL
): Promise<void> {
  const config = await getOidcServerConfig();
  if (!config.enabled || !config.clientId) {
    sendError(
      res,
      400,
      "OIDC/SSO is not enabled or missing Client ID in Admin settings",
      "OIDC_DISABLED"
    );
    return;
  }

  const endpoints = await resolveProviderEndpoints(config);
  const state = base64Url(crypto.randomBytes(24));
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  const returnTo = sanitizeReturnTo(requestUrl.searchParams.get("returnTo"));

  const secret = await getJwtSecret();
  const stateToken = signHmacJwt<OidcStatePayload>(
    {
      state,
      verifier,
      returnTo,
      provider: config.provider,
    },
    secret,
    600
  );

  const authUrl = new URL(endpoints.authorizationEndpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("scope", endpoints.scopes);
  authUrl.searchParams.set("state", state);
  if (config.provider !== "github") {
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
  }

  res.statusCode = 302;
  res.setHeader(
    "Set-Cookie",
    `${OIDC_STATE_COOKIE}=${encodeURIComponent(stateToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
  );
  res.setHeader("Location", authUrl.toString());
  res.end();
}

function decodeIdTokenClaims(idToken: string | undefined): Record<string, unknown> {
  if (!idToken) return {};
  const parts = idToken.split(".");
  if (parts.length < 2) return {};
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

function inferRoleFromClaims(
  claims: Record<string, unknown>,
  fallback: ScrumRole
): ScrumRole {
  const rawGroups: string[] = [];
  for (const key of ["roles", "groups", "mdteam_role"]) {
    const val = claims[key];
    if (typeof val === "string") rawGroups.push(val.toLowerCase());
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === "string") rawGroups.push(item.toLowerCase());
      }
    }
  }
  for (const candidate of rawGroups) {
    if (isValidScrumRole(candidate)) return candidate;
    if (candidate.includes("admin")) return "admin";
    if (candidate.includes("product-owner") || candidate === "po") return "product-owner";
    if (candidate.includes("scrum-master") || candidate === "sm") return "scrum-master";
    if (candidate.includes("stakeholder")) return "stakeholder";
    if (candidate.includes("developer") || candidate.includes("dev")) return "developer";
  }
  return fallback;
}

export async function handleOidcCallback(
  req: IncomingMessage,
  res: ServerResponse,
  requestUrl: URL
): Promise<void> {
  const code = (requestUrl.searchParams.get("code") || "").trim();
  const stateParam = (requestUrl.searchParams.get("state") || "").trim();
  if (!code || !stateParam) {
    sendError(res, 400, "Missing authorization code or state parameter", "OIDC_INVALID_CALLBACK");
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const stateJwt = cookies[OIDC_STATE_COOKIE];
  if (!stateJwt) {
    sendError(res, 400, "Missing or expired OIDC state cookie", "OIDC_STATE_MISSING");
    return;
  }

  const secret = await getJwtSecret();
  const savedState = verifyHmacJwt<OidcStatePayload>(stateJwt, secret);
  if (!savedState || !safeTimingEqualStrings(savedState.state, stateParam)) {
    sendError(res, 403, "OIDC CSRF state mismatch", "OIDC_STATE_MISMATCH");
    return;
  }

  const config = await getOidcServerConfig();
  const endpoints = await resolveProviderEndpoints(config);

  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("code", code);
  form.set("redirect_uri", config.redirectUri);
  form.set("client_id", config.clientId);
  if (config.clientSecret) {
    form.set("client_secret", config.clientSecret);
  }
  if (config.provider !== "github" && savedState.verifier) {
    form.set("code_verifier", savedState.verifier);
  }

  const tokenResp = await fetch(endpoints.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
    signal: AbortSignal.timeout(8000),
  });

  if (!tokenResp.ok) {
    sendError(res, 502, `OIDC token exchange failed (${tokenResp.status})`, "OIDC_TOKEN_FAILED");
    return;
  }

  const tokenData = (await tokenResp.json()) as {
    access_token?: string;
    id_token?: string;
  };
  const accessToken = tokenData.access_token || "";
  if (!accessToken && !tokenData.id_token) {
    sendError(res, 502, "OIDC provider returned no access_token", "OIDC_NO_TOKEN");
    return;
  }

  let profileClaims: Record<string, unknown> = decodeIdTokenClaims(tokenData.id_token);

  if (endpoints.userinfoEndpoint && accessToken) {
    const userResp = await fetch(endpoints.userinfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "User-Agent": "MDTeam-API/1.0",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (userResp.ok) {
      const userJson = (await userResp.json()) as Record<string, unknown>;
      profileClaims = { ...profileClaims, ...userJson };
    }
  }

  // GitHub fallback: fetch primary verified email if /user omitted email
  if (config.provider === "github" && !profileClaims.email && accessToken) {
    const emailsResp = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "User-Agent": "MDTeam-API/1.0",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (emailsResp.ok) {
      const emails = (await emailsResp.json()) as Array<{
        email?: string;
        primary?: boolean;
        verified?: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified) || emails[0];
      if (primary?.email) profileClaims.email = primary.email;
    }
  }

  const subject = String(
    profileClaims.sub || profileClaims.id || profileClaims.oid || ""
  ).trim();
  const username = String(
    profileClaims.preferred_username ||
      profileClaims.login ||
      profileClaims.username ||
      profileClaims.upn ||
      ""
  ).trim();
  const email = String(profileClaims.email || profileClaims.mail || "").trim();
  const displayName = String(
    profileClaims.name || username || email || "SSO Member"
  ).trim();

  if (!subject && !email && !username) {
    sendError(res, 502, "OIDC user profile lacked subject/email claims", "OIDC_PROFILE_EMPTY");
    return;
  }

  const user = await findOrProvisionOidcUser({
    subject: subject || email || username,
    username: username || email.split("@")[0] || "sso-user",
    displayName,
    email,
    suggestedRole: inferRoleFromClaims(profileClaims, config.defaultRole),
  });

  const { cookieHeader } = await issueSessionForUser(user);
  const clearStateCookie = `${OIDC_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

  res.statusCode = 302;
  res.setHeader("Set-Cookie", [cookieHeader, clearStateCookie]);
  res.setHeader("Location", savedState.returnTo || "/");
  res.end();
}
