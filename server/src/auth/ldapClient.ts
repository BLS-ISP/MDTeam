import net from "node:net";
import tls from "node:tls";
import { isValidScrumRole, type ScrumRole } from "../types.js";
import {
  decodeLdapMessage,
  encodeBindRequest,
  encodeSearchRequest,
  encodeUnbindRequest,
  readBerElement,
  type DecodedLdapMessage,
  type LdapFilter,
} from "./asn1Ber.js";

const LDAP_TIMEOUT_MS = 5000;
const USER_SEARCH_ATTRS = ["dn", "cn", "displayName", "mail", "uid", "sAMAccountName", "memberOf"];

export type LdapSchemaType = "ad" | "rfc2307";

export interface LdapRuntimeConfig {
  enabled: boolean;
  host: string;
  port: number;
  tls: boolean;
  tlsRejectUnauthorized: boolean;
  schema: LdapSchemaType;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  domain: string;
  defaultRole: ScrumRole;
  adminGroup: string;
  poGroup: string;
  smGroup: string;
  stakeholderGroup: string;
}

export interface LdapAuthenticatedProfile {
  dn: string;
  username: string;
  displayName: string;
  email: string;
  role: ScrumRole;
  groups: string[];
  domain: string;
}

interface LdapSearchEntry {
  dn: string;
  attributes: Record<string, string[]>;
}

const ESCAPE_MAP: Record<string, string> = { "\\": "\\5c", "*": "\\2a", "(": "\\28", ")": "\\29", "\0": "\\00" };

export function escapeLdapFilterValue(input: string): string {
  return input.replace(/[\\*()\0]/g, (ch) => ESCAPE_MAP[ch] || ch);
}

function unescapeLdapFilterValue(escaped: string): string {
  return escaped.replace(/(?:\\[0-9a-fA-F]{2})+/g, (seq) =>
    Buffer.from(seq.replace(/\\/g, ""), "hex").toString("utf8")
  );
}

export function parseLdapFilterString(filterText: string): LdapFilter {
  const trimmed = filterText.trim();
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) {
    throw new Error(`Malformed LDAP filter: ${filterText}`);
  }
  const inner = trimmed.slice(1, -1);
  if (inner.startsWith("|") || inner.startsWith("&")) {
    const op = inner[0] === "&" ? "and" : "or";
    const filters: LdapFilter[] = [];
    let idx = 1;
    while (idx < inner.length) {
      while (idx < inner.length && /\s/.test(inner[idx])) idx++;
      if (idx >= inner.length) break;
      if (inner[idx] !== "(") throw new Error(`Invalid compound LDAP filter: ${filterText}`);
      let depth = 0;
      const start = idx;
      while (idx < inner.length) {
        if (inner[idx] === "(") depth++;
        else if (inner[idx] === ")" && --depth === 0) {
          idx++;
          break;
        }
        idx++;
      }
      if (depth !== 0) throw new Error(`Unbalanced LDAP filter parentheses: ${filterText}`);
      filters.push(parseLdapFilterString(inner.slice(start, idx)));
    }
    if (filters.length === 0) throw new Error(`Empty compound LDAP filter: ${filterText}`);
    return { type: op, filters };
  }
  const eqIdx = inner.indexOf("=");
  if (eqIdx <= 0) throw new Error(`Missing '=' in LDAP filter: ${filterText}`);
  const attribute = inner.slice(0, eqIdx).trim();
  const rawValue = inner.slice(eqIdx + 1);
  if (rawValue === "*") return { type: "present", attribute };
  return { type: "equality", attribute, value: unescapeLdapFilterValue(rawValue) };
}

function parseBoolEnv(raw: string | undefined, fallback = false): boolean {
  if (!raw) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}

export function isLdapEnabled(): boolean {
  return parseBoolEnv(process.env.LDAP_ENABLED, false);
}

export function getLdapRuntimeConfig(): LdapRuntimeConfig {
  const useTls = parseBoolEnv(process.env.LDAP_TLS, false);
  const parsedPort = Number.parseInt(process.env.LDAP_PORT || "", 10);
  const schemaRaw = (process.env.LDAP_SCHEMA || "rfc2307").trim().toLowerCase();
  const roleRaw = (process.env.LDAP_DEFAULT_ROLE || "developer").trim();

  return {
    enabled: isLdapEnabled(),
    host: (process.env.LDAP_HOST || "127.0.0.1").trim(),
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : useTls ? 636 : 389,
    tls: useTls,
    tlsRejectUnauthorized: parseBoolEnv(process.env.LDAP_TLS_REJECT_UNAUTHORIZED, true),
    schema: schemaRaw === "ad" || schemaRaw === "active_directory" ? "ad" : "rfc2307",
    baseDn: (process.env.LDAP_BASE_DN || "").trim(),
    bindDn: (process.env.LDAP_BIND_DN || "").trim(),
    bindPassword: process.env.LDAP_BIND_PASSWORD || "",
    domain: (process.env.LDAP_DOMAIN || "").trim(),
    defaultRole: isValidScrumRole(roleRaw) ? roleRaw : "developer",
    adminGroup: (process.env.LDAP_ADMIN_GROUP || "").trim(),
    poGroup: (process.env.LDAP_PO_GROUP || "").trim(),
    smGroup: (process.env.LDAP_SM_GROUP || "").trim(),
    stakeholderGroup: (process.env.LDAP_STAKEHOLDER_GROUP || "").trim(),
  };
}

class LdapSession {
  private nextMessageId = 1;
  private buffer: Buffer = Buffer.alloc(0);
  private pending = new Map<
    number,
    {
      entries: LdapSearchEntry[];
      resolve: (msg: DecodedLdapMessage, entries: LdapSearchEntry[]) => void;
      reject: (err: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();

  private constructor(private socket: net.Socket | tls.TLSSocket) {
    socket.on("data", (chunk: Buffer) => this.onData(chunk));
    socket.on("error", (err: Error) => this.failAll(err));
    socket.on("close", () => this.failAll(new Error("LDAP connection closed")));
    socket.on("timeout", () => {
      this.failAll(new Error("LDAP socket timeout"));
      socket.destroy();
    });
  }

  static async connect(cfg: LdapRuntimeConfig): Promise<LdapSession> {
    const socket = await new Promise<net.Socket | tls.TLSSocket>((resolve, reject) => {
      let settled = false;
      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        rawSock.removeListener("error", onErr);
        if (err) {
          rawSock.destroy();
          reject(err);
        } else {
          resolve(rawSock);
        }
      };
      const onErr = (err: Error) => finish(err);
      const timer = setTimeout(() => finish(new Error(`LDAP connect timeout (${cfg.host}:${cfg.port})`)), LDAP_TIMEOUT_MS);
      const rawSock = cfg.tls
        ? tls.connect(
            { host: cfg.host, port: cfg.port, servername: cfg.host, rejectUnauthorized: cfg.tlsRejectUnauthorized },
            () => finish()
          )
        : net.createConnection({ host: cfg.host, port: cfg.port }, () => finish());
      rawSock.setTimeout(LDAP_TIMEOUT_MS);
      rawSock.once("error", onErr);
    });
    return new LdapSession(socket);
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    try {
      while (true) {
        const el = readBerElement(this.buffer, 0);
        if (!el) break;
        this.buffer = this.buffer.subarray(el.totalLength);
        const msg = decodeLdapMessage(el);
        const slot = this.pending.get(msg.messageId);
        if (!slot) continue;
        if (msg.op === "SearchResultEntry") {
          slot.entries.push({ dn: msg.dn, attributes: msg.attributes });
        } else if (msg.op === "BindResponse" || msg.op === "SearchResultDone") {
          clearTimeout(slot.timer);
          this.pending.delete(msg.messageId);
          slot.resolve(msg, slot.entries);
        }
      }
    } catch (err) {
      this.failAll(err instanceof Error ? err : new Error(String(err)));
      this.socket.destroy();
    }
  }

  private failAll(err: Error): void {
    for (const [id, slot] of this.pending.entries()) {
      clearTimeout(slot.timer);
      this.pending.delete(id);
      slot.reject(err);
    }
  }

  private sendRequest(
    buildPacket: (messageId: number) => Buffer
  ): Promise<{ final: DecodedLdapMessage; entries: LdapSearchEntry[] }> {
    const messageId = this.nextMessageId++;
    const packet = buildPacket(messageId);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(messageId);
        reject(new Error(`LDAP request ${messageId} timed out`));
      }, LDAP_TIMEOUT_MS);
      this.pending.set(messageId, { entries: [], timer, resolve: (final, entries) => resolve({ final, entries }), reject });
      this.socket.write(packet, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(messageId);
          reject(err);
        }
      });
    });
  }

  async bind(dn: string, password: string): Promise<number> {
    const { final } = await this.sendRequest((id) => encodeBindRequest(id, dn, password));
    return final.op === "BindResponse" ? final.resultCode : -1;
  }

  async search(baseDn: string, filter: LdapFilter, attributes: string[]): Promise<LdapSearchEntry[]> {
    const { final, entries } = await this.sendRequest((id) =>
      encodeSearchRequest({ messageId: id, baseDn, scope: 2, filter, attributes })
    );
    return final.op === "SearchResultDone" && final.resultCode === 0 ? entries : [];
  }

  close(): void {
    if (!this.socket.destroyed) {
      try {
        this.socket.end(encodeUnbindRequest(this.nextMessageId++));
      } catch {}
      this.socket.destroy();
    }
  }
}

function getAttrValues(attrs: Record<string, string[]>, key: string): string[] {
  const lower = key.toLowerCase();
  for (const [k, vals] of Object.entries(attrs)) {
    if (k.toLowerCase() === lower) return vals;
  }
  return [];
}

function getFirstAttr(attrs: Record<string, string[]>, key: string): string {
  return (getAttrValues(attrs, key)[0] || "").trim();
}

function collectNormalizedGroupSet(memberOfRaw: string[], posixGroupCns: string[]): Set<string> {
  const set = new Set<string>();
  for (const item of memberOfRaw) {
    const clean = item.trim();
    if (!clean) continue;
    set.add(clean.toLowerCase());
    const rdn = /^cn=([^,]+)/i.exec(clean);
    if (rdn?.[1]) set.add(rdn[1].trim().toLowerCase());
  }
  for (const cn of posixGroupCns) {
    if (cn.trim()) set.add(cn.trim().toLowerCase());
  }
  return set;
}

function matchesGroup(groupSet: ReadonlySet<string>, configuredGroup: string): boolean {
  const clean = configuredGroup.trim().toLowerCase();
  if (!clean) return false;
  if (groupSet.has(clean)) return true;
  const rdn = /^cn=([^,]+)/i.exec(clean);
  return rdn?.[1] ? groupSet.has(rdn[1].trim().toLowerCase()) : false;
}

export function resolveLdapScrumRole(groupSet: ReadonlySet<string>, cfg: LdapRuntimeConfig): ScrumRole {
  if (matchesGroup(groupSet, cfg.adminGroup)) return "admin";
  if (matchesGroup(groupSet, cfg.poGroup)) return "product-owner";
  if (matchesGroup(groupSet, cfg.smGroup)) return "scrum-master";
  if (matchesGroup(groupSet, cfg.stakeholderGroup)) return "stakeholder";
  return cfg.defaultRole;
}

export async function authenticateViaLdap(
  usernameOrEmail: string,
  password: string
): Promise<LdapAuthenticatedProfile | null> {
  const loginInput = usernameOrEmail.trim();
  if (!loginInput || !password) return null;

  const cfg = getLdapRuntimeConfig();
  if (!cfg.enabled || !cfg.host || !cfg.baseDn) return null;

  let searchSession: LdapSession | null = null;
  let verifySession: LdapSession | null = null;
  try {
    searchSession = await LdapSession.connect(cfg);
    if (cfg.bindDn && (await searchSession.bind(cfg.bindDn, cfg.bindPassword)) !== 0) {
      return null;
    }

    const escaped = escapeLdapFilterValue(loginInput);
    const userFilterStr =
      cfg.schema === "ad"
        ? `(|(sAMAccountName=${escaped})(userPrincipalName=${escaped})(mail=${escaped}))`
        : `(|(uid=${escaped})(mail=${escaped})(cn=${escaped}))`;

    const entries = await searchSession.search(cfg.baseDn, parseLdapFilterString(userFilterStr), USER_SEARCH_ATTRS);
    const userEntry = entries[0];
    const entryDn = (userEntry?.dn || getFirstAttr(userEntry?.attributes || {}, "dn")).trim();
    if (!userEntry || !entryDn) return null;

    const uidAttr = getFirstAttr(userEntry.attributes, "uid");
    const samAttr = getFirstAttr(userEntry.attributes, "sAMAccountName");
    const cnAttr = getFirstAttr(userEntry.attributes, "cn");
    const displayNameAttr = getFirstAttr(userEntry.attributes, "displayName");
    const mailAttr = getFirstAttr(userEntry.attributes, "mail");
    const memberOfVals = getAttrValues(userEntry.attributes, "memberOf");

    const posixGroupCns: string[] = [];
    if (cfg.schema === "rfc2307") {
      const posixKey = uidAttr || cnAttr || loginInput.split("@")[0];
      if (posixKey) {
        const groupFilter = parseLdapFilterString(`(memberUid=${escapeLdapFilterValue(posixKey)})`);
        const groupEntries = await searchSession.search(cfg.baseDn, groupFilter, ["cn"]).catch(() => []);
        for (const grp of groupEntries) posixGroupCns.push(...getAttrValues(grp.attributes, "cn"));
      }
    }
    searchSession.close();
    searchSession = null;

    verifySession = await LdapSession.connect(cfg);
    if ((await verifySession.bind(entryDn, password)) !== 0) return null;

    const groupSet = collectNormalizedGroupSet(memberOfVals, posixGroupCns);
    const role = resolveLdapScrumRole(groupSet, cfg);
    const fallbackUser = loginInput.includes("@") ? loginInput.split("@")[0] : loginInput;
    const username = samAttr || uidAttr || fallbackUser || cnAttr;
    const displayName = displayNameAttr || cnAttr || username;
    const email = mailAttr || (loginInput.includes("@") ? loginInput : `${username}@${cfg.domain || "ldap.local"}`);

    return { dn: entryDn, username, displayName, email, role, groups: [...groupSet], domain: cfg.domain };
  } catch {
    return null;
  } finally {
    searchSession?.close();
    verifySession?.close();
  }
}
