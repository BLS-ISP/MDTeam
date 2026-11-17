import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, message: string, code = "HTTP_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function getDataDir(): string {
  const configured = (process.env.DATA_DIR || "").trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(process.cwd(), ".mdteam-data");
}

function isAllowedCorsOrigin(requestOrigin: string, reqHostHeader: string | undefined): boolean {
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(requestOrigin);
  } catch {
    return false;
  }
  if (parsedOrigin.protocol !== "http:" && parsedOrigin.protocol !== "https:") {
    return false;
  }
  if (parsedOrigin.origin !== requestOrigin) {
    return false;
  }

  // (a) Explicit MDTEAM_CORS_ORIGINS allowlist (excluding wildcard '*' when credentials are used)
  const allowedOriginsRaw = (process.env.MDTEAM_CORS_ORIGINS || "").trim();
  if (allowedOriginsRaw) {
    const allowedList = allowedOriginsRaw
      .split(",")
      .map((item) => item.trim())
      .filter((item) => Boolean(item) && item !== "*");
    if (allowedList.includes(requestOrigin)) {
      return true;
    }
  }

  // (b) Same-origin host match
  const normalizedReqHost = (reqHostHeader || "").trim().toLowerCase();
  if (normalizedReqHost && parsedOrigin.host.toLowerCase() === normalizedReqHost) {
    return true;
  }

  // (c) Local Next.js dev server origin in non-production environments
  if (
    process.env.NODE_ENV !== "production" &&
    (requestOrigin === "http://localhost:3000" || requestOrigin === "http://127.0.0.1:3000")
  ) {
    return true;
  }

  return false;
}

export function applyCorsAndSecurityHeaders(
  req: IncomingMessage,
  res: ServerResponse
): void {
  const rawOrigin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";

  if (rawOrigin) {
    res.setHeader("Vary", "Origin");
    if (isAllowedCorsOrigin(rawOrigin, req.headers.host)) {
      res.setHeader("Access-Control-Allow-Origin", rawOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Scrum-Action"
      );
    }
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
}

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
  extraHeaders?: Record<string, string | string[]>
): void {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      res.setHeader(key, value);
    }
  }
  res.end(body);
}

export function sendError(
  res: ServerResponse,
  statusCode: number,
  message: string,
  code = "REQUEST_FAILED"
): void {
  sendJson(res, statusCode, { error: message, code });
}

export async function readJsonBody<T = Record<string, unknown>>(
  req: IncomingMessage,
  maxBytes = 15 * 1024 * 1024
): Promise<T> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > maxBytes) {
      throw new HttpError(413, "Request payload exceeds size limit", "PAYLOAD_TOO_LARGE");
    }
    chunks.push(buf);
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {} as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON request body", "INVALID_JSON");
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

const ASSET_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".zip": "application/zip",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function inferAssetMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return ASSET_MIME_TYPES[ext] || "application/octet-stream";
}
