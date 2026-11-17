import type { IncomingMessage } from "node:http";
import net from "node:net";
import { HttpError } from "../httpHelpers.js";

export const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
export const MAX_LOGIN_FAILURES_PER_USER = 10;
export const MAX_LOGIN_FAILURES_PER_IP = 30;
const MAX_TRACKED_BUCKETS = 10_000;

export interface LoginRateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

const failureBuckets = new Map<string, number[]>();

function normalizeIp(raw: string): string {
  let clean = raw.trim();
  if (!clean) return "";
  if (clean.startsWith("[") && clean.endsWith("]")) clean = clean.slice(1, -1);
  const zoneIdx = clean.indexOf("%");
  if (zoneIdx !== -1) clean = clean.slice(0, zoneIdx);
  const lower = clean.toLowerCase();
  if (lower.startsWith("::ffff:")) {
    const v4Candidate = lower.slice(7);
    if (net.isIPv4(v4Candidate)) return v4Candidate;
  }
  return lower;
}

function isTrustedProxyIp(remoteAddress: string | undefined): boolean {
  const ip = normalizeIp(remoteAddress || "");
  if (!ip) return false;
  if (ip === "::1") return true;
  if (!net.isIPv4(ip)) return false;
  const [a, b] = ip.split(".").map((seg) => Number.parseInt(seg, 10));
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function readFirstHeaderValue(header: string | string[] | undefined): string {
  if (typeof header === "string") return header;
  return Array.isArray(header) && header.length > 0 ? header[0] || "" : "";
}

export function extractClientIp(req: IncomingMessage): string {
  const socketIp = req.socket?.remoteAddress;
  if (isTrustedProxyIp(socketIp)) {
    const realIp = normalizeIp(readFirstHeaderValue(req.headers["x-real-ip"]));
    if (realIp && realIp.length <= 100 && !isTrustedProxyIp(realIp)) {
      return realIp;
    }
    const forwardedFor = readFirstHeaderValue(req.headers["x-forwarded-for"]);
    if (forwardedFor) {
      const hops = forwardedFor
        .split(",")
        .map((h) => normalizeIp(h))
        .filter((h) => h.length > 0 && h.length <= 100);
      for (let i = hops.length - 1; i >= 0; i -= 1) {
        if (!isTrustedProxyIp(hops[i])) return hops[i];
      }
      if (hops.length > 0) return hops[0];
    }
    if (realIp && realIp.length <= 100) return realIp;
  }
  return normalizeIp(socketIp || "") || "unknown";
}

function buildBucketKeys(ip: string, username: string): { userKey: string; ipKey: string } {
  const cleanIp = normalizeIp(ip) || "unknown";
  const normalizedUser = (username || "").trim().toLowerCase();
  const safeUser = !normalizedUser ? "<empty>" : normalizedUser === "*" ? "\\*" : normalizedUser;
  return { userKey: `${cleanIp}|${safeUser}`, ipKey: `${cleanIp}|*` };
}

function getActiveTimestamps(key: string, nowMs: number): number[] {
  const existing = failureBuckets.get(key);
  if (!existing || existing.length === 0) return [];
  const cutoff = nowMs - LOGIN_RATE_WINDOW_MS;
  const active = existing.filter((ts) => ts > cutoff);
  if (active.length === 0) {
    failureBuckets.delete(key);
    return [];
  }
  if (active.length !== existing.length) failureBuckets.set(key, active);
  return active;
}

function sweepExpiredBucketsIfNeeded(nowMs: number): void {
  if (failureBuckets.size < MAX_TRACKED_BUCKETS) return;
  const cutoff = nowMs - LOGIN_RATE_WINDOW_MS;
  for (const [key, timestamps] of failureBuckets.entries()) {
    const active = timestamps.filter((ts) => ts > cutoff);
    if (active.length === 0) failureBuckets.delete(key);
    else failureBuckets.set(key, active);
  }
  while (failureBuckets.size >= MAX_TRACKED_BUCKETS) {
    const oldestKey = failureBuckets.keys().next().value;
    if (oldestKey === undefined) break;
    failureBuckets.delete(oldestKey);
  }
}

export function checkLoginRateLimit(
  ip: string,
  username: string,
  nowMs = Date.now()
): LoginRateLimitResult {
  const { userKey, ipKey } = buildBucketKeys(ip, username);
  const userHits = getActiveTimestamps(userKey, nowMs);
  const ipHits = getActiveTimestamps(ipKey, nowMs);

  let retryAfterSec = 0;
  if (userHits.length >= MAX_LOGIN_FAILURES_PER_USER) {
    const oldest = userHits[userHits.length - MAX_LOGIN_FAILURES_PER_USER];
    retryAfterSec = Math.max(1, Math.ceil((oldest + LOGIN_RATE_WINDOW_MS - nowMs) / 1000));
  }
  if (ipHits.length >= MAX_LOGIN_FAILURES_PER_IP) {
    const oldest = ipHits[ipHits.length - MAX_LOGIN_FAILURES_PER_IP];
    retryAfterSec = Math.max(
      retryAfterSec,
      Math.max(1, Math.ceil((oldest + LOGIN_RATE_WINDOW_MS - nowMs) / 1000))
    );
  }
  return retryAfterSec > 0 ? { allowed: false, retryAfterSec } : { allowed: true, retryAfterSec: 0 };
}

export function assertLoginRateLimit(ip: string, username: string, nowMs = Date.now()): void {
  const res = checkLoginRateLimit(ip, username, nowMs);
  if (!res.allowed) {
    throw new HttpError(
      429,
      "Too many failed login attempts. Please wait before retrying.",
      "TOO_MANY_ATTEMPTS"
    );
  }
}

export function recordLoginFailure(ip: string, username: string, nowMs = Date.now()): void {
  sweepExpiredBucketsIfNeeded(nowMs);
  const { userKey, ipKey } = buildBucketKeys(ip, username);
  failureBuckets.set(userKey, [...getActiveTimestamps(userKey, nowMs), nowMs]);
  failureBuckets.set(ipKey, [...getActiveTimestamps(ipKey, nowMs), nowMs]);
}

export function clearLoginFailures(ip: string, username: string): void {
  const { userKey } = buildBucketKeys(ip, username);
  failureBuckets.delete(userKey);
}

export function resetLoginRateLimiter(): void {
  failureBuckets.clear();
}
