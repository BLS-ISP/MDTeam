import dns from "node:dns";
import net from "node:net";
import { URL } from "node:url";
import { HttpError } from "../httpHelpers.js";

export interface OutboundUrlGuardOptions {
  allowLocalEnvVar?: string;
  allowLocalWhenSkipAutostart?: boolean;
  lookupFn?: (hostname: string) => Promise<Array<{ address: string; family?: number }>>;
}

function normalizeHostOrIp(raw: string): string {
  let clean = (raw || "").trim().toLowerCase();
  if (clean.startsWith("[") && clean.endsWith("]")) clean = clean.slice(1, -1);
  const pctZoneIdx = clean.indexOf("%");
  if (pctZoneIdx !== -1) clean = clean.slice(0, pctZoneIdx);
  clean = clean.replace(/\.+$/, "");
  if (
    clean &&
    net.isIP(clean) === 0 &&
    /^(0x[0-9a-f]+|0[0-7]+|\d+)(\.(0x[0-9a-f]+|0[0-7]+|\d+)){0,3}$/i.test(clean)
  ) {
    try {
      clean = new URL(`http://${clean}`).hostname.toLowerCase();
    } catch {
      // Keep original string if numeric hostname cannot be canonicalized
    }
  }
  return clean;
}

function parseIpv4Octets(ip: string): [number, number, number, number] | null {
  if (!net.isIPv4(ip)) return null;
  const parts = ip.split(".").map((s) => Number.parseInt(s, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return [parts[0], parts[1], parts[2], parts[3]];
}

function parseIpv6Hextets(ip: string): number[] | null {
  if (!net.isIPv6(ip)) return null;
  let working = ip.toLowerCase();
  if (working.includes(".")) {
    const lastColon = working.lastIndexOf(":");
    const v4Octets = lastColon !== -1 ? parseIpv4Octets(working.slice(lastColon + 1)) : null;
    if (!v4Octets) return null;
    const hi = ((v4Octets[0] << 8) | v4Octets[1]).toString(16);
    const lo = ((v4Octets[2] << 8) | v4Octets[3]).toString(16);
    working = `${working.slice(0, lastColon)}:${hi}:${lo}`;
  }
  const dblParts = working.split("::");
  if (dblParts.length > 2) return null;
  if (dblParts.length === 1) {
    const segs = working.split(":");
    return segs.length === 8 ? segs.map((s) => Number.parseInt(s, 16)) : null;
  }
  const left = dblParts[0] ? dblParts[0].split(":") : [];
  const right = dblParts[1] ? dblParts[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  return [
    ...left.map((s) => Number.parseInt(s, 16)),
    ...new Array<number>(missing).fill(0),
    ...right.map((s) => Number.parseInt(s, 16)),
  ];
}

function classifyHostOrIp(hostOrIp: string): { isLoopback: boolean; isMetadataOrSpecial: boolean } {
  const clean = normalizeHostOrIp(hostOrIp);
  if (!clean) return { isLoopback: false, isMetadataOrSpecial: true };
  if (clean === "localhost" || clean.endsWith(".localhost")) {
    return { isLoopback: true, isMetadataOrSpecial: false };
  }
  if (clean === "accountprovider" || clean.endsWith(".accountprovider")) {
    return { isLoopback: false, isMetadataOrSpecial: true };
  }

  const v4 = parseIpv4Octets(clean);
  if (v4) {
    const [a, b] = v4;
    if (a === 127) return { isLoopback: true, isMetadataOrSpecial: false };
    if (a === 0 || (a === 169 && b === 254)) return { isLoopback: false, isMetadataOrSpecial: true };
    return { isLoopback: false, isMetadataOrSpecial: false };
  }

  const v6 = parseIpv6Hextets(clean);
  if (v6 && v6.length === 8) {
    const allFirst7Zero = v6.slice(0, 7).every((h) => h === 0);
    if (allFirst7Zero && v6[7] === 0) return { isLoopback: false, isMetadataOrSpecial: true };
    if (allFirst7Zero && v6[7] === 1) return { isLoopback: true, isMetadataOrSpecial: false };
    if ((v6[0] & 0xffc0) === 0xfe80) return { isLoopback: false, isMetadataOrSpecial: true };
    if (v6.slice(0, 5).every((h) => h === 0) && (v6[5] === 0xffff || v6[5] === 0)) {
      const a = (v6[6] >> 8) & 0xff;
      const b = v6[6] & 0xff;
      if (a === 127) return { isLoopback: true, isMetadataOrSpecial: false };
      if (a === 0 || (a === 169 && b === 254)) return { isLoopback: false, isMetadataOrSpecial: true };
    }
  }
  return { isLoopback: false, isMetadataOrSpecial: false };
}

export function isLoopbackOrMetadataIpOrHost(hostOrIp: string): boolean {
  const { isLoopback, isMetadataOrSpecial } = classifyHostOrIp(hostOrIp);
  return isLoopback || isMetadataOrSpecial;
}

function shouldAllowLocalLoopback(opts?: OutboundUrlGuardOptions): boolean {
  const envKey = opts?.allowLocalEnvVar;
  if (envKey && process.env[envKey] === "1") return true;
  return Boolean(
    opts?.allowLocalWhenSkipAutostart &&
      process.env.MDTEAM_SKIP_AUTOSTART === "1" &&
      process.env[envKey || ""] !== "0"
  );
}

export async function assertSafeOutboundUrl(
  rawUrl: string,
  opts?: OutboundUrlGuardOptions
): Promise<string> {
  const trimmed = (rawUrl || "").trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new HttpError(400, `Invalid outbound URL: ${trimmed}`, "INVALID_WEBHOOK_URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new HttpError(400, "Outbound URL must use https:// or http://", "INVALID_WEBHOOK_PROTOCOL");
  }

  const allowLoopback = shouldAllowLocalLoopback(opts);
  const rawHost = parsed.hostname.replace(/^\[|\]$/g, "");
  const direct = classifyHostOrIp(rawHost);
  if (direct.isMetadataOrSpecial || (!allowLoopback && direct.isLoopback)) {
    throw new HttpError(400, `Outbound URL blocked by SSRF guard: '${rawHost}'`, "SSRF_BLOCKED");
  }

  const normalizedHost = normalizeHostOrIp(rawHost);
  if (net.isIP(normalizedHost) === 0) {
    const resolver =
      opts?.lookupFn || ((host: string) => dns.promises.lookup(host, { all: true }));
    let records: Array<{ address: string; family?: number }>;
    try {
      records = await resolver(normalizedHost);
    } catch {
      throw new HttpError(400, `Hostname '${normalizedHost}' could not be resolved`, "SSRF_DNS_FAILED");
    }
    if (!Array.isArray(records) || records.length === 0) {
      throw new HttpError(400, `Hostname '${normalizedHost}' returned no DNS records`, "SSRF_DNS_FAILED");
    }
    for (const rec of records) {
      const resolved = classifyHostOrIp(rec.address);
      if (resolved.isMetadataOrSpecial || (!allowLoopback && resolved.isLoopback)) {
        throw new HttpError(
          400,
          `Outbound URL blocked by SSRF DNS guard: '${normalizedHost}' resolved to forbidden IP`,
          "SSRF_BLOCKED"
        );
      }
    }
  }
  return parsed.toString();
}
