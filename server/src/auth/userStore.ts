import crypto from "node:crypto";
import { HttpError } from "../httpHelpers.js";
import {
  isValidScrumRole,
  type AuthUser,
  type OidcServerConfig,
  type ScrumRole,
  type StoredUserRecord,
  type WebhookConfig,
  type WebhookEventType,
} from "../types.js";
import {
  DEV_FALLBACK_PASSWORD,
  enqueueStoreSave,
  ensureUserStore,
  hashPasswordScrypt,
  normalizeHandle,
  sanitizePublicUser,
  verifyPasswordScrypt,
} from "./passwordAndStorePersistence.js";

export {
  DEV_FALLBACK_PASSWORD,
  ensureUserStore,
  hashPasswordScrypt,
  verifyPasswordScrypt,
};

const VALID_WEBHOOK_EVENTS: ReadonlySet<WebhookEventType> = new Set([
  "mention",
  "blocker",
  "review",
  "sprint",
  "assignment",
]);

export async function listPublicUsers(): Promise<AuthUser[]> {
  const store = await ensureUserStore();
  return store.users.map(sanitizePublicUser);
}

export async function findPublicUserById(userId: string): Promise<AuthUser | null> {
  const store = await ensureUserStore();
  const found = store.users.find((u) => u.id === userId);
  return found ? sanitizePublicUser(found) : null;
}

export async function authenticateLocalUser(
  usernameOrEmail: string,
  password: string
): Promise<AuthUser | null> {
  const needle = usernameOrEmail.trim().toLowerCase();
  if (!needle || !password) return null;

  const store = await ensureUserStore();
  const record = store.users.find(
    (u) =>
      u.username.toLowerCase() === needle ||
      u.email.toLowerCase() === needle ||
      u.handle.toLowerCase() === needle
  );

  if (!record || record.authProvider !== "local") {
    await hashPasswordScrypt(password, "00112233445566778899aabbccddeeff");
    return null;
  }

  const valid = await verifyPasswordScrypt(
    password,
    record.passwordHash,
    record.passwordSalt
  );
  if (!valid) return null;

  record.lastLoginAt = new Date().toISOString();
  await enqueueStoreSave(store);
  return sanitizePublicUser(record);
}

export async function findOrProvisionOidcUser(profile: {
  subject: string;
  username: string;
  displayName: string;
  email: string;
  suggestedRole?: ScrumRole;
}): Promise<AuthUser> {
  const store = await ensureUserStore();
  const now = new Date().toISOString();
  const cleanEmail = profile.email.trim().toLowerCase();
  const cleanSub = profile.subject.trim();

  const existing = store.users.find(
    (u) =>
      (u.oidcSubject && u.oidcSubject === cleanSub) ||
      (cleanEmail && u.email.toLowerCase() === cleanEmail)
  );

  if (existing) {
    existing.lastLoginAt = now;
    existing.oidcSubject = cleanSub;
    if (profile.displayName) existing.displayName = profile.displayName;
    await enqueueStoreSave(store);
    return sanitizePublicUser(existing);
  }

  const baseUsername = (profile.username || cleanEmail.split("@")[0] || "sso-user")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-");
  let uniqueUsername = baseUsername;
  let suffix = 1;
  while (store.users.some((u) => u.username.toLowerCase() === uniqueUsername)) {
    suffix += 1;
    uniqueUsername = `${baseUsername}-${suffix}`;
  }

  const created: StoredUserRecord = {
    id: `usr-${crypto.randomBytes(6).toString("hex")}`,
    username: uniqueUsername,
    displayName: profile.displayName || uniqueUsername,
    email: cleanEmail || `${uniqueUsername}@sso.local`,
    handle: normalizeHandle(uniqueUsername, uniqueUsername),
    role: profile.suggestedRole || store.oidc.defaultRole || "developer",
    authProvider: "oidc",
    oidcSubject: cleanSub,
    createdAt: now,
    lastLoginAt: now,
  };
  store.users.push(created);
  await enqueueStoreSave(store);
  return sanitizePublicUser(created);
}

export async function createLocalUserAccount(input: {
  username: string;
  displayName: string;
  email: string;
  handle?: string;
  role: ScrumRole;
  password: string;
}): Promise<AuthUser> {
  const store = await ensureUserStore();
  const cleanUsername = input.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,40}$/.test(cleanUsername)) {
    throw new HttpError(
      400,
      "Username must be 2-40 alphanumeric characters",
      "INVALID_USERNAME"
    );
  }
  if (!input.password || input.password.length < 6) {
    throw new HttpError(400, "Password must be at least 6 characters", "WEAK_PASSWORD");
  }
  if (!isValidScrumRole(input.role)) {
    throw new HttpError(400, "Invalid Scrum role", "INVALID_ROLE");
  }
  if (store.users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    throw new HttpError(409, "Username already exists", "DUPLICATE_USER");
  }

  const { hashHex, saltHex } = await hashPasswordScrypt(input.password);
  const record: StoredUserRecord = {
    id: `usr-${crypto.randomBytes(6).toString("hex")}`,
    username: cleanUsername,
    displayName: input.displayName.trim() || cleanUsername,
    email: input.email.trim() || `${cleanUsername}@mdteam.local`,
    handle: normalizeHandle(input.handle || cleanUsername, cleanUsername),
    role: input.role,
    authProvider: "local",
    passwordHash: hashHex,
    passwordSalt: saltHex,
    createdAt: new Date().toISOString(),
  };

  store.users.push(record);
  await enqueueStoreSave(store);
  return sanitizePublicUser(record);
}

export async function updateExistingUser(
  userId: string,
  patch: {
    displayName?: string;
    email?: string;
    handle?: string;
    role?: ScrumRole;
    password?: string;
  }
): Promise<AuthUser> {
  const store = await ensureUserStore();
  const record = store.users.find((u) => u.id === userId);
  if (!record) {
    throw new HttpError(404, "User account not found", "USER_NOT_FOUND");
  }

  if (patch.role !== undefined) {
    if (!isValidScrumRole(patch.role)) {
      throw new HttpError(400, "Invalid Scrum role", "INVALID_ROLE");
    }
    if (record.role === "admin" && patch.role !== "admin") {
      const adminCount = store.users.filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        throw new HttpError(400, "Cannot demote the last admin user", "LAST_ADMIN");
      }
    }
    record.role = patch.role;
  }

  if (typeof patch.displayName === "string" && patch.displayName.trim()) {
    record.displayName = patch.displayName.trim();
  }
  if (typeof patch.email === "string" && patch.email.trim()) {
    record.email = patch.email.trim();
  }
  if (typeof patch.handle === "string" && patch.handle.trim()) {
    record.handle = normalizeHandle(patch.handle, record.username);
  }
  if (typeof patch.password === "string" && patch.password.length > 0) {
    if (patch.password.length < 6) {
      throw new HttpError(400, "Password must be at least 6 characters", "WEAK_PASSWORD");
    }
    const { hashHex, saltHex } = await hashPasswordScrypt(patch.password);
    record.passwordHash = hashHex;
    record.passwordSalt = saltHex;
    record.authProvider = "local";
  }

  await enqueueStoreSave(store);
  return sanitizePublicUser(record);
}

export async function deleteUserAccount(userId: string, actorId: string): Promise<void> {
  const store = await ensureUserStore();
  if (userId === actorId) {
    throw new HttpError(400, "You cannot delete your own active account", "SELF_DELETE");
  }
  const idx = store.users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    throw new HttpError(404, "User account not found", "USER_NOT_FOUND");
  }
  if (store.users[idx].role === "admin") {
    const adminCount = store.users.filter((u) => u.role === "admin").length;
    if (adminCount <= 1) {
      throw new HttpError(400, "Cannot delete the last admin account", "LAST_ADMIN");
    }
  }
  store.users.splice(idx, 1);
  await enqueueStoreSave(store);
}

export async function getWebhookConfig(): Promise<WebhookConfig> {
  const store = await ensureUserStore();
  return { ...store.webhooks, events: [...store.webhooks.events] };
}

export async function updateWebhookConfig(
  patch: Partial<WebhookConfig>
): Promise<WebhookConfig> {
  const store = await ensureUserStore();
  const nextEvents = Array.isArray(patch.events)
    ? patch.events.filter((ev): ev is WebhookEventType => VALID_WEBHOOK_EVENTS.has(ev))
    : store.webhooks.events;

  store.webhooks = {
    teamsWebhookUrl:
      typeof patch.teamsWebhookUrl === "string"
        ? patch.teamsWebhookUrl.trim()
        : store.webhooks.teamsWebhookUrl,
    slackWebhookUrl:
      typeof patch.slackWebhookUrl === "string"
        ? patch.slackWebhookUrl.trim()
        : store.webhooks.slackWebhookUrl,
    emailWebhookUrl:
      typeof patch.emailWebhookUrl === "string"
        ? patch.emailWebhookUrl.trim()
        : store.webhooks.emailWebhookUrl,
    events: nextEvents,
  };
  await enqueueStoreSave(store);
  return getWebhookConfig();
}

export async function getOidcServerConfig(): Promise<OidcServerConfig> {
  const store = await ensureUserStore();
  return { ...store.oidc };
}

export async function updateOidcServerConfig(
  patch: Partial<OidcServerConfig>
): Promise<OidcServerConfig> {
  const store = await ensureUserStore();
  const nextRole =
    patch.defaultRole && isValidScrumRole(patch.defaultRole)
      ? patch.defaultRole
      : store.oidc.defaultRole;

  store.oidc = {
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : store.oidc.enabled,
    provider: patch.provider || store.oidc.provider,
    issuerUrl:
      typeof patch.issuerUrl === "string" ? patch.issuerUrl.trim() : store.oidc.issuerUrl,
    authorizationEndpoint:
      typeof patch.authorizationEndpoint === "string"
        ? patch.authorizationEndpoint.trim()
        : store.oidc.authorizationEndpoint,
    tokenEndpoint:
      typeof patch.tokenEndpoint === "string"
        ? patch.tokenEndpoint.trim()
        : store.oidc.tokenEndpoint,
    userinfoEndpoint:
      typeof patch.userinfoEndpoint === "string"
        ? patch.userinfoEndpoint.trim()
        : store.oidc.userinfoEndpoint,
    clientId:
      typeof patch.clientId === "string" ? patch.clientId.trim() : store.oidc.clientId,
    clientSecret:
      typeof patch.clientSecret === "string" && patch.clientSecret !== "********"
        ? patch.clientSecret.trim()
        : store.oidc.clientSecret,
    redirectUri:
      typeof patch.redirectUri === "string"
        ? patch.redirectUri.trim()
        : store.oidc.redirectUri,
    scopes: typeof patch.scopes === "string" ? patch.scopes.trim() : store.oidc.scopes,
    defaultRole: nextRole,
  };
  await enqueueStoreSave(store);
  return getOidcServerConfig();
}
