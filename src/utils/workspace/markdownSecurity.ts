/**
 * Security sanitizers for untrusted Markdown content, links, images, and Draw.io embeds.
 * Prevents Stored XSS when rendering cloned external Git repositories.
 */

export const BLOCKED_UNSAFE_URL = "#blocked-unsafe-url";

const SAFE_URL_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

const SAFE_DATA_IMAGE_REGEX =
  /^data:image\/(png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i;

const ALLOWED_DRAWIO_HOSTS = new Set([
  "diagrams.net",
  "www.diagrams.net",
  "viewer.diagrams.net",
  "app.diagrams.net",
  "draw.io",
  "www.draw.io",
]);

/**
 * Escapes HTML special characters (`&`, `<`, `>`, `"`, `'`) before inline Markdown formatting
 * so raw HTML tags or event handlers cannot execute via `dangerouslySetInnerHTML`.
 */
export function escapeHtmlEntities(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitizes Markdown link `href` and image `src` URLs.
 * - Strips ASCII control characters and trims surrounding whitespace.
 * - Blocks `javascript:`, `vbscript:`, `file:`, and arbitrary schemes.
 * - Blocks all `data:` URIs unless `allowDataImage === true` AND the URI is a strict
 *   raster base64 image (`png`, `jpeg`, `jpg`, `gif`, `webp` — never `image/svg+xml` or `text/html`).
 * - Returns `"#blocked-unsafe-url"` when blocked.
 */
export function sanitizeMarkdownUrl(rawUrl: string, allowDataImage = false): string {
  if (typeof rawUrl !== "string") return BLOCKED_UNSAFE_URL;

  const withoutNonWsControls = rawUrl.replace(
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g,
    ""
  );
  const trimmedRaw = withoutNonWsControls.trim();
  if (!trimmedRaw) return BLOCKED_UNSAFE_URL;

  const compactRaw = trimmedRaw.replace(/[\u0000-\u0020\u007f]+/g, "");
  if (/^data:/i.test(compactRaw)) {
    if (allowDataImage && SAFE_DATA_IMAGE_REGEX.test(trimmedRaw)) {
      return trimmedRaw.replace(/\s+/g, "");
    }
    return BLOCKED_UNSAFE_URL;
  }

  const cleaned = trimmedRaw.replace(/[\u0000-\u001f\u007f]+/g, "").trim();
  if (!cleaned) return BLOCKED_UNSAFE_URL;

  const compact = cleaned.replace(/\s+/g, "");
  let decodedCompact = compact;
  try {
    decodedCompact = decodeURIComponent(compact).replace(/[\u0000-\u0020\u007f]+/g, "");
  } catch {
    // Keep compact form if percent-encoding is malformed
  }

  if (/^(javascript|vbscript|file|data):/i.test(compact)) {
    return BLOCKED_UNSAFE_URL;
  }
  if (/^(javascript|vbscript|file|data):/i.test(decodedCompact)) {
    return BLOCKED_UNSAFE_URL;
  }

  const schemeMatch = compact.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (schemeMatch && !SAFE_URL_SCHEMES.has(schemeMatch[1].toLowerCase())) {
    return BLOCKED_UNSAFE_URL;
  }

  const decodedSchemeMatch = decodedCompact.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (decodedSchemeMatch && !SAFE_URL_SCHEMES.has(decodedSchemeMatch[1].toLowerCase())) {
    return BLOCKED_UNSAFE_URL;
  }

  return cleaned;
}

/**
 * Validates Draw.io / diagrams.net iframe embed URLs.
 * Allows ONLY `https:` URLs hosted on official Draw.io / diagrams.net hostnames.
 */
export function sanitizeDrawioEmbedUrl(rawUrl: string): string | null {
  if (typeof rawUrl !== "string") return null;
  const cleaned = rawUrl.replace(/[\u0000-\u001f\u007f]+/g, "").trim();
  if (!cleaned) return null;

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (!ALLOWED_DRAWIO_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  return parsed.toString();
}
