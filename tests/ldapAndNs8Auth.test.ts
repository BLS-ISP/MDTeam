import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  BER_TAGS,
  decodeBoolean,
  decodeInteger,
  decodeLdapMessage,
  encodeBerLength,
  encodeBindRequest,
  encodeBindResponse,
  encodeBoolean,
  encodeInteger,
  encodeOctetString,
  encodeSearchResultDone,
  encodeSearchResultEntry,
  encodeSequence,
  encodeUnbindRequest,
  readBerElement,
  type LdapFilter,
} from "../server/src/auth/asn1Ber.js";
import {
  escapeLdapFilterValue,
  parseLdapFilterString,
} from "../server/src/auth/ldapClient.js";
import { resolveBrowserAutoYjsUrl } from "../src/hooks/useYjsCollaboration";

interface MockDirectoryEntry {
  dn: string;
  password?: string;
  attributes: Record<string, string[]>;
}

function evaluateFilter(entry: MockDirectoryEntry, filter: LdapFilter): boolean {
  const getVals = (attr: string): string[] => {
    const lower = attr.toLowerCase();
    for (const [k, vals] of Object.entries(entry.attributes)) {
      if (k.toLowerCase() === lower) return vals;
    }
    return [];
  };
  if (filter.type === "present") {
    return getVals(filter.attribute).length > 0;
  }
  if (filter.type === "equality") {
    const needle = filter.value.toLowerCase();
    return getVals(filter.attribute).some((v) => v.toLowerCase() === needle);
  }
  if (filter.type === "and") {
    return filter.filters.every((f) => evaluateFilter(entry, f));
  }
  return filter.filters.some((f) => evaluateFilter(entry, f));
}

function filterContainsPresent(filter: LdapFilter): boolean {
  if (filter.type === "present") return true;
  if (filter.type === "equality") return false;
  return filter.filters.some(filterContainsPresent);
}

async function apiJson<T = Record<string, any>>(
  baseUrl: string,
  endpoint: string,
  init: RequestInit = {},
  cookie?: string
): Promise<{ status: number; headers: Headers; body: T }> {
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (cookie) headers.set("Cookie", cookie);
  const resp = await fetch(`${baseUrl}${endpoint}`, { ...init, headers });
  const body = (await resp.json().catch(() => ({}))) as T;
  return { status: resp.status, headers: resp.headers, body };
}

test("ASN.1 BER codec, RFC 4515 LDAP filter escaping & Browser Auto-WSS Yjs detection", () => {
  // 1. Definite short & multi-byte BER lengths + primitives
  for (const len of [0, 1, 127, 128, 320, 70000]) {
    const payload = Buffer.alloc(len, 0x61);
    const encoded = Buffer.concat([Buffer.from([BER_TAGS.OCTET_STRING]), encodeBerLength(len), payload]);
    const parsed = readBerElement(encoded, 0);
    assert.ok(parsed);
    assert.equal(parsed.length, len);
    assert.equal(parsed.totalLength, encoded.length);
  }

  for (const num of [0, 1, 127, 128, 255, 32768, -1, -129]) {
    const el = readBerElement(encodeInteger(num), 0);
    assert.ok(el);
    assert.equal(decodeInteger(el.value), num);
  }
  const trueEl = readBerElement(encodeBoolean(true), 0);
  const falseEl = readBerElement(encodeBoolean(false), 0);
  assert.ok(trueEl && falseEl);
  assert.equal(decodeBoolean(trueEl.value), true);
  assert.equal(decodeBoolean(falseEl.value), false);

  const seq = readBerElement(encodeSequence([encodeOctetString("ns8")]), 0);
  assert.ok(seq && seq.constructed);

  // 2. BindRequest / SearchResultEntry / UnbindRequest round-trip
  const bindFrame = readBerElement(encodeBindRequest(7, "uid=alice,dc=local", "s3cr3t"), 0);
  assert.ok(bindFrame);
  const decodedBind = decodeLdapMessage(bindFrame);
  assert.equal(decodedBind.op, "BindRequest");
  assert.equal(decodedBind.dn, "uid=alice,dc=local");
  assert.equal(decodedBind.password, "s3cr3t");

  const longDnGroup = `CN=${"EnterpriseGroup".repeat(18)},OU=Groups,DC=ad,DC=nethserver,DC=local`;
  const entryFrame = readBerElement(
    encodeSearchResultEntry(8, "CN=Alice,DC=ad,DC=nethserver,DC=local", {
      cn: ["Alice"],
      memberOf: [longDnGroup],
    }),
    0
  );
  assert.ok(entryFrame);
  const decodedEntry = decodeLdapMessage(entryFrame);
  assert.equal(decodedEntry.op, "SearchResultEntry");
  assert.deepEqual(decodedEntry.attributes.memberOf, [longDnGroup]);

  const unbindFrame = readBerElement(encodeUnbindRequest(9), 0);
  assert.ok(unbindFrame);
  assert.equal(decodeLdapMessage(unbindFrame).op, "UnbindRequest");

  // 3. RFC 4515 filter injection escaping
  const malicious = "admin)(|(uid=*";
  const escaped = escapeLdapFilterValue(malicious);
  assert.equal(escaped, "admin\\29\\28|\\28uid=\\2a");
  assert.equal(escapeLdapFilterValue("a\\b*c(d)e\0f"), "a\\5cb\\2ac\\28d\\29e\\00f");

  const parsedSafe = parseLdapFilterString(`(|(uid=${escaped})(mail=${escaped})(cn=${escaped}))`);
  assert.equal(parsedSafe.type, "or");
  assert.equal(filterContainsPresent(parsedSafe), false);
  for (const sub of parsedSafe.filters) {
    assert.equal(sub.type, "equality");
    assert.equal(sub.value, malicious);
  }

  // 4. Browser HTTPS/HTTP Auto-WSS Yjs URL detection
  assert.equal(
    resolveBrowserAutoYjsUrl({ protocol: "https:", host: "mdteam.nethserver.local", port: "" }, false),
    "wss://mdteam.nethserver.local/ws"
  );
  assert.equal(
    resolveBrowserAutoYjsUrl({ protocol: "http:", host: "10.0.0.12:8080", port: "8080" }, false),
    "ws://10.0.0.12:8080/ws"
  );
  assert.equal(
    resolveBrowserAutoYjsUrl({ protocol: "http:", host: "localhost:3000", port: "3000" }, false),
    null
  );
  assert.equal(
    resolveBrowserAutoYjsUrl({ protocol: "https:", host: "tauri.localhost", port: "" }, true),
    null
  );
});

test("In-process TCP LDAPv3 Server + HTTP API E2E: OpenLDAP rfc2307, Samba AD, RBAC & Injection Defense", async () => {
  const tempDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "mdteam-ldap-e2e-"));
  const savedEnv = { ...process.env };
  process.env.MDTEAM_SKIP_AUTOSTART = "1";
  process.env.DATA_DIR = tempDataDir;
  process.env.JWT_SECRET = "ns8-ldap-test-jwt-secret-minimum-32-chars!!";

  const SERVICE_DN = "cn=ldapservice,dc=nethserver,dc=local";
  const SERVICE_PW = "ns8-ldapproxy-secret";

  const posixScrumMastersMembers = ["mrossi"];
  const posixAdminsMembers: string[] = [];

  const getDirectoryEntries = (): MockDirectoryEntry[] => [
    {
      dn: "uid=ldaproot,ou=People,dc=openldap,dc=nethserver,dc=local",
      password: "RootNeverMatchPassword!1",
      attributes: {
        uid: ["ldaproot"],
        cn: ["LDAP Root"],
        mail: ["ldaproot@openldap.nethserver.local"],
      },
    },
    {
      dn: "uid=mrossi,ou=People,dc=openldap,dc=nethserver,dc=local",
      password: "RossiOpenLdap!2026",
      attributes: {
        uid: ["mrossi"],
        cn: ["Marco Rossi"],
        displayName: ["Marco Rossi"],
        mail: ["mrossi@openldap.nethserver.local"],
      },
    },
    {
      dn: "cn=scrum-masters,ou=Groups,dc=openldap,dc=nethserver,dc=local",
      attributes: {
        objectClass: ["posixGroup"],
        cn: ["scrum-masters"],
        memberUid: [...posixScrumMastersMembers],
      },
    },
    {
      dn: "cn=domain-admins,ou=Groups,dc=openldap,dc=nethserver,dc=local",
      attributes: {
        objectClass: ["posixGroup"],
        cn: ["domain-admins"],
        memberUid: [...posixAdminsMembers],
      },
    },
    {
      dn: "CN=Elena Weber,CN=Users,DC=ad,DC=nethserver,DC=local",
      password: "SambaAdSecret#99",
      attributes: {
        sAMAccountName: ["eweber"],
        userPrincipalName: ["eweber@ad.nethserver.local"],
        cn: ["Elena Weber"],
        displayName: ["Elena Weber (AD PO)"],
        mail: ["elena.weber@ad.nethserver.local"],
        memberOf: [
          "CN=MDTeam Product Owners,CN=Users,DC=ad,DC=nethserver,DC=local",
          "CN=Domain Users,CN=Users,DC=ad,DC=nethserver,DC=local",
        ],
      },
    },
  ];

  const recordedSearches: Array<{ baseDn: string; filter: LdapFilter }> = [];
  let userBindAttempts = 0;

  // Real TCP server speaking RFC 4511 ASN.1 BER
  const ldapServer = net.createServer((socket) => {
    let recvBuf = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      recvBuf = Buffer.concat([recvBuf, chunk]);
      while (true) {
        const frame = readBerElement(recvBuf, 0);
        if (!frame) break;
        recvBuf = recvBuf.subarray(frame.totalLength);
        const msg = decodeLdapMessage(frame);

        if (msg.op === "BindRequest") {
          // Simulate classic LDAP anonymous-bind footgun (empty password returns 0!)
          // to prove ldapClient rejects empty passwords before binding!
          if (!msg.dn && !msg.password) {
            socket.write(encodeBindResponse(msg.messageId, 0));
            continue;
          }
          if (msg.dn.toLowerCase() === SERVICE_DN.toLowerCase()) {
            const ok = msg.password === SERVICE_PW;
            socket.write(encodeBindResponse(msg.messageId, ok ? 0 : 49));
            continue;
          }
          userBindAttempts += 1;
          const target = getDirectoryEntries().find(
            (e) => e.dn.toLowerCase() === msg.dn.toLowerCase()
          );
          const ok = Boolean(target?.password && msg.password === target.password);
          socket.write(encodeBindResponse(msg.messageId, ok ? 0 : 49));
        } else if (msg.op === "SearchRequest") {
          recordedSearches.push({ baseDn: msg.baseDn, filter: msg.filter });
          const suffix = msg.baseDn.toLowerCase();
          const matches = getDirectoryEntries().filter(
            (e) => e.dn.toLowerCase().endsWith(suffix) && evaluateFilter(e, msg.filter)
          );
          for (const m of matches) {
            socket.write(encodeSearchResultEntry(msg.messageId, m.dn, m.attributes));
          }
          socket.write(encodeSearchResultDone(msg.messageId, 0));
        } else if (msg.op === "UnbindRequest") {
          socket.end();
        }
      }
    });
  });

  await new Promise<void>((resolve) => ldapServer.listen(0, "127.0.0.1", resolve));
  const ldapAddr = ldapServer.address();
  assert.ok(ldapAddr && typeof ldapAddr === "object");

  const { createMdTeamApiServer } = await import("../server/src/index.js");
  const { ensureUserStore, DEV_FALLBACK_PASSWORD } = await import("../server/src/auth/userStore.js");
  await ensureUserStore();

  const apiServer = createMdTeamApiServer();
  await new Promise<void>((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
  const apiAddr = apiServer.address();
  assert.ok(apiAddr && typeof apiAddr === "object");
  const baseUrl = `http://127.0.0.1:${apiAddr.port}`;

  try {
    // 1. Configure OpenLDAP (rfc2307) via NS8 Ldapproxy env vars
    process.env.LDAP_ENABLED = "true";
    process.env.LDAP_HOST = "127.0.0.1";
    process.env.LDAP_PORT = String(ldapAddr.port);
    process.env.LDAP_TLS = "false";
    process.env.LDAP_SCHEMA = "rfc2307";
    process.env.LDAP_BASE_DN = "dc=openldap,dc=nethserver,dc=local";
    process.env.LDAP_BIND_DN = SERVICE_DN;
    process.env.LDAP_BIND_PASSWORD = SERVICE_PW;
    process.env.LDAP_DOMAIN = "openldap.nethserver.local";
    process.env.LDAP_DEFAULT_ROLE = "developer";
    process.env.LDAP_ADMIN_GROUP = "domain-admins";
    process.env.LDAP_PO_GROUP = "MDTeam Product Owners";
    process.env.LDAP_SM_GROUP = "scrum-masters";
    process.env.LDAP_STAKEHOLDER_GROUP = "external-stakeholders";

    const healthRes = await apiJson(baseUrl, "/api/health");
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.ldapEnabled, true);
    assert.equal(healthRes.body.ldapDomain, "openldap.nethserver.local");

    // 2. OpenLDAP rfc2307 login + POSIX memberUid group -> scrum-master role + HttpOnly JWT cookie
    const openLdapLogin = await apiJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "mrossi", password: "RossiOpenLdap!2026" }),
    });
    assert.equal(openLdapLogin.status, 200);
    assert.equal(openLdapLogin.body.user.username, "mrossi");
    assert.equal(openLdapLogin.body.user.displayName, "Marco Rossi");
    assert.equal(openLdapLogin.body.user.authProvider, "ldap");
    assert.equal(openLdapLogin.body.user.role, "scrum-master");

    const setCookie = openLdapLogin.headers.get("set-cookie") || "";
    assert.match(setCookie, /HttpOnly/i);
    const sessionCookie = setCookie.split(";")[0];

    const meRes = await apiJson(baseUrl, "/api/auth/me", {}, sessionCookie);
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.authProvider, "ldap");
    assert.equal(meRes.body.user.role, "scrum-master");

    // Promote mrossi to domain-admins in LDAP and confirm role syncs on next login
    posixAdminsMembers.push("mrossi");
    const promotedLogin = await apiJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "mrossi", password: "RossiOpenLdap!2026" }),
    });
    assert.equal(promotedLogin.status, 200);
    assert.equal(promotedLogin.body.user.role, "admin");

    // 3. Samba Active Directory (ad) login + memberOf DN group -> product-owner role
    process.env.LDAP_SCHEMA = "ad";
    process.env.LDAP_BASE_DN = "DC=ad,DC=nethserver,DC=local";
    process.env.LDAP_DOMAIN = "ad.nethserver.local";

    const adLogin = await apiJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: "eweber@ad.nethserver.local",
        password: "SambaAdSecret#99",
      }),
    });
    assert.equal(adLogin.status, 200);
    assert.equal(adLogin.body.user.username, "eweber");
    assert.equal(adLogin.body.user.displayName, "Elena Weber (AD PO)");
    assert.equal(adLogin.body.user.email, "elena.weber@ad.nethserver.local");
    assert.equal(adLogin.body.user.authProvider, "ldap");
    assert.equal(adLogin.body.user.role, "product-owner");

    // 4. Wrong password rejection (401)
    const wrongPwRes = await apiJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "eweber", password: "WrongPassword123!" }),
    });
    assert.equal(wrongPwRes.status, 401);

    // 5. Empty password rejection (never attempts anonymous bind)
    const bindsBeforeEmpty = userBindAttempts;
    const emptyPwRes = await apiJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "eweber", password: "" }),
    });
    assert.equal(emptyPwRes.status, 401);
    assert.equal(userBindAttempts, bindsBeforeEmpty);

    // 6. LDAP Filter-Injection attack rejection on live wire
    process.env.LDAP_SCHEMA = "rfc2307";
    process.env.LDAP_BASE_DN = "dc=openldap,dc=nethserver,dc=local";
    recordedSearches.length = 0;

    const injectionRes = await apiJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: "admin)(|(uid=*",
        password: "RootNeverMatchPassword!1",
      }),
    });
    assert.equal(injectionRes.status, 401);
    assert.equal(recordedSearches.length, 1);
    assert.equal(filterContainsPresent(recordedSearches[0].filter), false);

    // 7. Local seeded accounts continue working seamlessly alongside LDAP
    const localLogin = await apiJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "po", password: DEV_FALLBACK_PASSWORD }),
    });
    assert.equal(localLogin.status, 200);
    assert.equal(localLogin.body.user.authProvider, "local");
  } finally {
    for (const k of Object.keys(process.env)) {
      if (!(k in savedEnv)) delete process.env[k];
    }
    Object.assign(process.env, savedEnv);
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    await new Promise<void>((resolve) => ldapServer.close(() => resolve()));
    await fs.rm(tempDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
});
