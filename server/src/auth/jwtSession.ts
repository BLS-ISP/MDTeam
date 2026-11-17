import crypto from "node:crypto";
import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { getDataDir, HttpError, parseCookies, sendError } from "../httpHelpers.js";
import {
  canRolePerform,
  isValidScrumAction,
  type AuthUser,
  type ScrumAction,
  type ScrumRole,
} from "../types.js";
import { findPublicUserById } from "./userStore.js";

export const SESSION_COOKIE_NAME = "mdteam_session";
const DEFAULT_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export interface JwtSessionPayload {
  sub: string;
  username: string;
  role: ScrumRole;
  handle: string;
  iat: number;
  exp: number;
}

let cachedSecret: Buffer | null = null;

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(segment: string): Buffer {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

export async function getJwtSecret(): Promise<Buffer> {
  if (cachedSecret) return cachedSecret;

  const envSecret = (process.env.MDTEAM_JWT_SECRET || "").trim();
  if (envSecret.length >= 16) {
    cachedSecret = Buffer.from(envSecret, "utf8");
    return cachedSecret;
  }

  const secretPath = path.join(getDataDir(), ".jwt_secret");
  try {
    const existing = (await fs.readFile(secretPath, "utf8")).trim();
    if (existing.length >= 32) {
      cachedSecret = Buffer.from(existing, "hex");
      return cachedSecret;
    }
  } catch {
    // Generate persistent secret on first boot
  }

  const generated = crypto.randomBytes(32);
  await fs.mkdir(path.dirname(secretPath), { recursive: true });
  await fs.writeFile(secretPath, generated.toString("hex"), {
    encoding: "utf8",
    mode: 0o600,
  });
  cachedSecret = generated;
  return cachedSecret;
}

export function signHmacJwt<T extends object>(
  payload: T,
  secret: Buffer,
  ttlSeconds = DEFAULT_TTL_SECONDS
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const headerSegment = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const bodySegment = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: nowSec,
      exp: nowSec + ttlSeconds,
    })
  );
  const signingInput = `${headerSegment}.${bodySegment}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest();
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export function verifyHmacJwt<T = JwtSessionPayload>(
  token: string,
  secret: Buffer
): T | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerSeg, payloadSeg, sigSeg] = parts;
  if (!headerSeg || !payloadSeg || !sigSeg) return null;

  try {
    const headerJson = JSON.parse(base64UrlDecode(headerSeg).toString("utf8")) as {
      alg?: string;
    };
    if (headerJson.alg !== "HS256") return null;

    const signingInput = `${headerSeg}.${payloadSeg}`;
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(signingInput)
      .digest();
    const providedSig = base64UrlDecode(sigSeg);

    if (providedSig.length !== expectedSig.length) {
      return null;
    }
    if (!crypto.timingSafeEqual(providedSig, expectedSig)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadSeg).toString("utf8")) as T & {
      exp?: number;
    };
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function issueSessionForUser(user: AuthUser): Promise<{
  token: string;
  cookieHeader: string;
}> {
  const secret = await getJwtSecret();
  const token = signHmacJwt(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      handle: user.handle,
    },
    secret,
    DEFAULT_TTL_SECONDS
  );

  const isSecure =
    process.env.MDTEAM_COOKIE_SECURE === "true" ||
    (process.env.NODE_ENV === "production" &&
      process.env.MDTEAM_COOKIE_SECURE !== "false");

  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${DEFAULT_TTL_SECONDS}`,
  ];
  if (isSecure) {
    cookieParts.push("Secure");
  }

  return {
    token,
    cookieHeader: cookieParts.join("; "),
  };
}

export function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function extractTokenFromRequest(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

export async function resolveAuthenticatedUser(
  req: IncomingMessage
): Promise<AuthUser | null> {
  const token = extractTokenFromRequest(req);
  if (!token) return null;
  const secret = await getJwtSecret();
  const decoded = verifyHmacJwt<JwtSessionPayload>(token, secret);
  if (!decoded || !decoded.sub) return null;
  // Always resolve fresh role from userStore so role revocations take effect immediately!
  return findPublicUserById(decoded.sub);
}

export async function requireAuthenticatedUser(
  req: IncomingMessage,
  res: ServerResponse
): Promise<AuthUser | null> {
  const user = await resolveAuthenticatedUser(req);
  if (!user) {
    sendError(res, 401, "Authentication required", "UNAUTHENTICATED");
    return null;
  }
  return user;
}

export async function requireRoleAction(
  req: IncomingMessage,
  res: ServerResponse,
  action: ScrumAction
): Promise<AuthUser | null> {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return null;
  if (!canRolePerform(user.role, action)) {
    sendError(
      res,
      403,
      `Role '${user.role}' is not permitted to perform '${action}'`,
      "FORBIDDEN_RBAC"
    );
    return null;
  }
  return user;
}

function extractFrontmatterField(markdown: string, key: string): string {
  const fmMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return "";
  const regex = new RegExp(`^${key}:\\s*(.*)$`, "m");
  const match = fmMatch[1].match(regex);
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
}

export function enforceFileMutationPermission(
  user: AuthUser,
  relPath: string,
  nextContent: string | null,
  previousContent: string | null,
  explicitActionRaw?: unknown
): void {
  const normalized = relPath.replace(/\\/g, "/");

  if (isValidScrumAction(explicitActionRaw)) {
    if (!canRolePerform(user.role, explicitActionRaw)) {
      throw new HttpError(
        403,
        `Role '${user.role}' cannot perform '${explicitActionRaw}'`,
        "FORBIDDEN_RBAC"
      );
    }
  }

  // Inline comments & stakeholder feedback files require comment_or_feedback
  if (
    normalized === ".mdteam/inline-comments.json" ||
    normalized.startsWith("feedback/")
  ) {
    if (!canRolePerform(user.role, "comment_or_feedback")) {
      throw new HttpError(403, "Insufficient permission to comment", "FORBIDDEN_RBAC");
    }
    return;
  }

  // Scrum policy & Product Goal configuration file
  if (normalized === ".mdteam/scrum-policy.md") {
    const prevMode = previousContent
      ? extractFrontmatterField(previousContent, "mode")
      : "";
    const nextMode = nextContent ? extractFrontmatterField(nextContent, "mode") : "";

    if (prevMode && nextMode && prevMode !== nextMode) {
      if (!canRolePerform(user.role, "manage_scrum_policy")) {
        throw new HttpError(
          403,
          `Role '${user.role}' cannot change Scrum process policy (requires scrum-master or admin)`,
          "FORBIDDEN_RBAC"
        );
      }
      return;
    }

    if (
      !canRolePerform(user.role, "manage_scrum_policy") &&
      !canRolePerform(user.role, "edit_product_goal")
    ) {
      throw new HttpError(
        403,
        `Role '${user.role}' cannot modify Scrum policy or Product Goal`,
        "FORBIDDEN_RBAC"
      );
    }
    return;
  }

  // Issues, Sprints & Releases
  if (
    normalized.startsWith("issues/") ||
    normalized.startsWith("sprints/") ||
    normalized === ".mdteam/releases.md"
  ) {
    if (nextContent) {
      const prevAccepted = previousContent
        ? extractFrontmatterField(previousContent, "review_accepted")
        : "";
      const nextAccepted = extractFrontmatterField(nextContent, "review_accepted");
      if (nextAccepted === "true" && prevAccepted !== "true") {
        if (!canRolePerform(user.role, "accept_sprint_review")) {
          throw new HttpError(
            403,
            `Role '${user.role}' cannot accept Sprint Review increments (requires product-owner or admin)`,
            "FORBIDDEN_RBAC"
          );
        }
      }
    }
    if (!canRolePerform(user.role, "edit_issue")) {
      throw new HttpError(
        403,
        `Role '${user.role}' is read-only for Scrum issues & sprints`,
        "FORBIDDEN_RBAC"
      );
    }
    return;
  }

  // Wiki, arc42, ADRs & general Markdown docs
  if (nextContent) {
    const prevReview = previousContent
      ? extractFrontmatterField(previousContent, "review_status")
      : "";
    const nextReview = extractFrontmatterField(nextContent, "review_status");
    if (nextReview === "approved" && prevReview !== "approved") {
      if (!canRolePerform(user.role, "approve_wiki")) {
        throw new HttpError(
          403,
          `Role '${user.role}' cannot approve governance pages`,
          "FORBIDDEN_RBAC"
        );
      }
    }
  }

  if (!canRolePerform(user.role, "edit_wiki")) {
    throw new HttpError(
      403,
      `Role '${user.role}' is strictly read-only for repository documents`,
      "FORBIDDEN_RBAC"
    );
  }
}
