import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getDataDir } from "../httpHelpers.js";
import type {
  AuthUser,
  OidcProviderPreset,
  OidcServerConfig,
  PersistedStoreData,
  ScrumRole,
  StoredUserRecord,
  WebhookConfig,
} from "../types.js";

const scryptAsync = promisify(crypto.scrypt);
const SCRYPT_KEYLEN = 64;

export const DEV_FALLBACK_PASSWORD =
  process.env.MDTEAM_INITIAL_PASSWORD || "mdteam-dev-2026";

export function sanitizePublicUser(record: StoredUserRecord): AuthUser {
  return {
    id: record.id,
    username: record.username,
    displayName: record.displayName,
    email: record.email,
    handle: record.handle,
    role: record.role,
    authProvider: record.authProvider,
    createdAt: record.createdAt,
    lastLoginAt: record.lastLoginAt,
  };
}

export async function hashPasswordScrypt(
  plainPassword: string,
  existingSaltHex?: string
): Promise<{ hashHex: string; saltHex: string }> {
  const saltBuf = existingSaltHex
    ? Buffer.from(existingSaltHex, "hex")
    : crypto.randomBytes(16);
  const derived = (await scryptAsync(plainPassword, saltBuf, SCRYPT_KEYLEN)) as Buffer;
  return {
    hashHex: derived.toString("hex"),
    saltHex: saltBuf.toString("hex"),
  };
}

export async function verifyPasswordScrypt(
  plainPassword: string,
  expectedHashHex: string | undefined,
  saltHex: string | undefined
): Promise<boolean> {
  if (!expectedHashHex || !saltHex) return false;
  const expectedBuf = Buffer.from(expectedHashHex, "hex");
  const saltBuf = Buffer.from(saltHex, "hex");
  if (expectedBuf.length !== SCRYPT_KEYLEN || saltBuf.length < 8) {
    return false;
  }
  const actualBuf = (await scryptAsync(
    plainPassword,
    saltBuf,
    SCRYPT_KEYLEN
  )) as Buffer;
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function defaultWebhookConfig(): WebhookConfig {
  return {
    teamsWebhookUrl: process.env.MDTEAM_TEAMS_WEBHOOK_URL || "",
    slackWebhookUrl: process.env.MDTEAM_SLACK_WEBHOOK_URL || "",
    emailWebhookUrl: process.env.MDTEAM_EMAIL_WEBHOOK_URL || "",
    events: ["mention", "blocker", "review", "sprint", "assignment"],
  };
}

export function defaultOidcConfig(): OidcServerConfig {
  const providerRaw = (process.env.MDTEAM_OIDC_PROVIDER || "keycloak").toLowerCase();
  const provider: OidcProviderPreset =
    providerRaw === "entra-id" ||
    providerRaw === "github" ||
    providerRaw === "gitlab" ||
    providerRaw === "custom"
      ? providerRaw
      : "keycloak";

  return {
    enabled: Boolean(process.env.MDTEAM_OIDC_CLIENT_ID),
    provider,
    issuerUrl:
      process.env.MDTEAM_OIDC_ISSUER_URL ||
      "https://keycloak.company-internal.de/realms/mdteam",
    authorizationEndpoint: process.env.MDTEAM_OIDC_AUTH_URL || "",
    tokenEndpoint: process.env.MDTEAM_OIDC_TOKEN_URL || "",
    userinfoEndpoint: process.env.MDTEAM_OIDC_USERINFO_URL || "",
    clientId: process.env.MDTEAM_OIDC_CLIENT_ID || "",
    clientSecret: process.env.MDTEAM_OIDC_CLIENT_SECRET || "",
    redirectUri:
      process.env.MDTEAM_OIDC_REDIRECT_URI ||
      "http://localhost:4000/api/auth/oidc/callback",
    scopes: process.env.MDTEAM_OIDC_SCOPES || "openid profile email",
    defaultRole: "developer",
  };
}

async function createSeededStore(): Promise<PersistedStoreData> {
  const now = new Date().toISOString();
  const seedSpecs: Array<{
    id: string;
    username: string;
    displayName: string;
    email: string;
    handle: string;
    role: ScrumRole;
  }> = [
    {
      id: "usr-admin",
      username: "admin",
      displayName: "Workspace Admin",
      email: "admin@mdteam.local",
      handle: "@admin",
      role: "admin",
    },
    {
      id: "usr-po",
      username: "po",
      displayName: "Product Owner",
      email: "po@mdteam.local",
      handle: "@product-owner",
      role: "product-owner",
    },
    {
      id: "usr-sm",
      username: "sm",
      displayName: "Scrum Master",
      email: "sm@mdteam.local",
      handle: "@scrum-master",
      role: "scrum-master",
    },
    {
      id: "usr-dev-a",
      username: "dev-a",
      displayName: "Developer A (Tech Lead)",
      email: "dev-a@mdteam.local",
      handle: "@developer-a",
      role: "developer",
    },
    {
      id: "usr-dev-b",
      username: "dev-b",
      displayName: "Developer B (Backend/Sync)",
      email: "dev-b@mdteam.local",
      handle: "@developer-b",
      role: "developer",
    },
    {
      id: "usr-stakeholder",
      username: "stakeholder",
      displayName: "Enterprise Stakeholder",
      email: "stakeholder@mdteam.local",
      handle: "@stakeholder",
      role: "stakeholder",
    },
  ];

  const users: StoredUserRecord[] = [];
  for (const spec of seedSpecs) {
    const { hashHex, saltHex } = await hashPasswordScrypt(DEV_FALLBACK_PASSWORD);
    users.push({
      ...spec,
      authProvider: "local",
      passwordHash: hashHex,
      passwordSalt: saltHex,
      createdAt: now,
    });
  }

  return {
    version: 1,
    users,
    webhooks: defaultWebhookConfig(),
    oidc: defaultOidcConfig(),
  };
}

let cachedStore: PersistedStoreData | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function getUsersFilePath(): string {
  return path.join(getDataDir(), "users.json");
}

async function persistStore(data: PersistedStoreData): Promise<void> {
  const filePath = getUsersFilePath();
  const dir = path.dirname(filePath);
  const tmpPath = `${filePath}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.rename(tmpPath, filePath);
}

export async function ensureUserStore(): Promise<PersistedStoreData> {
  if (cachedStore) return cachedStore;

  const filePath = getUsersFilePath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistedStoreData>;
    cachedStore = {
      version: 1,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      webhooks: {
        ...defaultWebhookConfig(),
        ...(parsed.webhooks || {}),
      },
      oidc: {
        ...defaultOidcConfig(),
        ...(parsed.oidc || {}),
      },
    };
    return cachedStore;
  } catch {
    const seeded = await createSeededStore();
    cachedStore = seeded;
    await persistStore(seeded);
    return seeded;
  }
}

export function enqueueStoreSave(store: PersistedStoreData): Promise<void> {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(() => persistStore(store));
  return writeQueue;
}

export function normalizeHandle(rawHandle: string, usernameFallback: string): string {
  const clean = (rawHandle || usernameFallback)
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._-]+/g, "-");
  return `@${clean || "member"}`;
}
