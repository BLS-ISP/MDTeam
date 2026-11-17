import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import os from "node:os";
import path from "node:path";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  extractClientIp,
  recordLoginFailure,
  resetLoginRateLimiter,
} from "../server/src/auth/loginRateLimiter.js";
import {
  assertSafeOutboundUrl,
  isLoopbackOrMetadataIpOrHost,
} from "../server/src/security/ssrfDnsGuard.js";

const REPO_ROOT = fs.existsSync(path.join(process.cwd(), "nginx.conf"))
  ? process.cwd()
  : path.resolve(__dirname, "../..");

async function apiFetch<T = Record<string, any>>(
  baseUrl: string,
  endpoint: string,
  init: RequestInit = {}
): Promise<{ status: number; headers: Headers; body: T }> {
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const resp = await fetch(`${baseUrl}${endpoint}`, { ...init, headers });
  const body = (await resp.json().catch(() => ({}))) as T;
  return { status: resp.status, headers: resp.headers, body };
}

test("SSRF & DNS-Rebinding Guard: blocks loopback/metadata/accountprovider, allows RFC1918 LAN", async () => {
  const savedSkip = process.env.MDTEAM_SKIP_AUTOSTART;
  const savedAllow = process.env.MDTEAM_ALLOW_LOCAL_WEBHOOKS;

  try {
    for (const blocked of [
      "localhost",
      "api.localhost",
      "LOCALHOST.",
      "accountprovider",
      "0.0.0.0",
      "127.0.0.1",
      "127.255.255.254",
      "169.254.169.254",
      "::1",
      "[::1]",
      "fe80::1",
      "febf::abcd",
      "::ffff:127.0.0.1",
      "::ffff:169.254.169.254",
      "[::ffff:7f00:1]",
    ]) {
      assert.equal(isLoopbackOrMetadataIpOrHost(blocked), true, `Expected '${blocked}' blocked`);
    }

    for (const allowedLan of [
      "10.0.5.12",
      "172.16.0.1",
      "172.31.255.254",
      "192.168.1.50",
      "93.184.216.34",
      "hooks.slack.com",
    ]) {
      assert.equal(
        isLoopbackOrMetadataIpOrHost(allowedLan),
        false,
        `Expected '${allowedLan}' permitted`
      );
    }

    process.env.MDTEAM_SKIP_AUTOSTART = "1";
    process.env.MDTEAM_ALLOW_LOCAL_WEBHOOKS = "0";
    const webhookGuardOpts = {
      allowLocalEnvVar: "MDTEAM_ALLOW_LOCAL_WEBHOOKS",
      allowLocalWhenSkipAutostart: true,
    };

    await assert.rejects(
      () => assertSafeOutboundUrl("http://127.0.0.1:9000", webhookGuardOpts),
      /SSRF/i
    );
    await assert.rejects(
      () => assertSafeOutboundUrl("http://169.254.169.254/latest/meta-data", webhookGuardOpts),
      /SSRF/i
    );
    await assert.rejects(
      () => assertSafeOutboundUrl("http://accountprovider:389/internal", webhookGuardOpts),
      /SSRF/i
    );

    // DNS-rebinding defense: reject when any resolved record is loopback or metadata
    await assert.rejects(
      () =>
        assertSafeOutboundUrl("https://rebind.attacker.tld/webhook", {
          ...webhookGuardOpts,
          lookupFn: async () => [{ address: "93.184.216.34" }, { address: "127.0.0.1" }],
        }),
      /SSRF/i
    );
    await assert.rejects(
      () =>
        assertSafeOutboundUrl("https://meta-rebind.attacker.tld/webhook", {
          ...webhookGuardOpts,
          lookupFn: async () => [{ address: "169.254.169.254" }],
        }),
      /SSRF/i
    );

    // Enterprise RFC1918 self-hosted target remains allowed
    const safeLan = await assertSafeOutboundUrl("https://192.168.10.25:8443/hooks/mdteam", webhookGuardOpts);
    assert.equal(safeLan, "https://192.168.10.25:8443/hooks/mdteam");
  } finally {
    if (savedSkip === undefined) delete process.env.MDTEAM_SKIP_AUTOSTART;
    else process.env.MDTEAM_SKIP_AUTOSTART = savedSkip;
    if (savedAllow === undefined) delete process.env.MDTEAM_ALLOW_LOCAL_WEBHOOKS;
    else process.env.MDTEAM_ALLOW_LOCAL_WEBHOOKS = savedAllow;
  }
});

test("Trusted proxy IP extraction & sliding-window IP/user login limiter unit checks", () => {
  const spoofedPublicReq = {
    headers: { "x-forwarded-for": "8.8.8.8", "x-real-ip": "8.8.4.4" },
    socket: { remoteAddress: "198.51.100.42" },
  } as unknown as IncomingMessage;
  assert.equal(extractClientIp(spoofedPublicReq), "198.51.100.42");

  const dockerProxyReq = {
    headers: { "x-real-ip": "203.0.113.77" },
    socket: { remoteAddress: "::ffff:172.18.0.4" },
  } as unknown as IncomingMessage;
  assert.equal(extractClientIp(dockerProxyReq), "203.0.113.77");

  const chainedProxySpoofReq = {
    headers: { "x-real-ip": "10.0.2.2", "x-forwarded-for": "1.1.1.1, 203.0.113.88, 10.0.2.2" },
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as IncomingMessage;
  assert.equal(extractClientIp(chainedProxySpoofReq), "203.0.113.88");

  resetLoginRateLimiter();
  const baseNow = 1_700_000_000_000;
  for (let i = 0; i < 30; i += 1) {
    recordLoginFailure("203.0.113.99", `spray-user-${i}`, baseNow + i * 100);
  }
  const ipSprayBlocked = checkLoginRateLimit("203.0.113.99", "fresh-user", baseNow + 5000);
  assert.equal(ipSprayBlocked.allowed, false);
  assert.ok(ipSprayBlocked.retryAfterSec > 0);
  resetLoginRateLimiter();
});

test("API Hardening E2E: CORS allowlist, 429 login rate limit + Retry-After, /api/auth/ws-verify & Webhook SSRF", async () => {
  const tempDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "mdteam-sec130-"));
  const savedEnv = { ...process.env };
  process.env.MDTEAM_SKIP_AUTOSTART = "1";
  process.env.DATA_DIR = tempDataDir;
  process.env.MDTEAM_JWT_SECRET = "sec130-test-jwt-secret-key-minimum-32-chars!";

  const { createMdTeamApiServer } = await import("../server/src/index.js");
  const { ensureUserStore, DEV_FALLBACK_PASSWORD } = await import("../server/src/auth/userStore.js");
  await ensureUserStore();
  resetLoginRateLimiter();

  const apiServer = createMdTeamApiServer();
  await new Promise<void>((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
  const addr = apiServer.address();
  assert.ok(addr && typeof addr === "object");
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // (a) CORS Hardening: untrusted origin & wildcard '*' never reflect credentials
    delete process.env.MDTEAM_CORS_ORIGINS;
    const evilCors = await apiFetch(baseUrl, "/api/health", {
      headers: { Origin: "https://evil.attacker.tld" },
    });
    assert.equal(evilCors.status, 200);
    assert.equal(evilCors.headers.get("access-control-allow-origin"), null);
    assert.equal(evilCors.headers.get("access-control-allow-credentials"), null);

    process.env.MDTEAM_CORS_ORIGINS = "*";
    const wildcardEvil = await apiFetch(baseUrl, "/api/health", {
      headers: { Origin: "https://evil.attacker.tld" },
    });
    assert.equal(wildcardEvil.headers.get("access-control-allow-origin"), null);

    process.env.MDTEAM_CORS_ORIGINS = "https://mdteam.company.tld, https://docs.company.tld";
    const allowedConfigured = await apiFetch(baseUrl, "/api/health", {
      headers: { Origin: "https://mdteam.company.tld" },
    });
    assert.equal(allowedConfigured.headers.get("access-control-allow-origin"), "https://mdteam.company.tld");
    assert.equal(allowedConfigured.headers.get("access-control-allow-credentials"), "true");

    delete process.env.MDTEAM_CORS_ORIGINS;
    const sameOriginRes = await apiFetch(baseUrl, "/api/health", {
      headers: { Origin: baseUrl },
    });
    assert.equal(sameOriginRes.headers.get("access-control-allow-origin"), baseUrl);
    assert.equal(sameOriginRes.headers.get("access-control-allow-credentials"), "true");

    // (b) Login Rate Limiter: 10 failed attempts -> 401, 11th attempt -> 429 + Retry-After, then resets
    resetLoginRateLimiter();
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const failRes = await apiFetch(baseUrl, "/api/auth/login", {
        method: "POST",
        headers: { "X-Real-IP": "198.51.100.25" },
        body: JSON.stringify({ username: "admin", password: `wrong-${attempt}` }),
      });
      assert.equal(failRes.status, 401, `Attempt ${attempt} should return 401`);
    }

    const eleventhRes = await apiFetch(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "X-Real-IP": "198.51.100.25" },
      body: JSON.stringify({ username: "admin", password: "wrong-11" }),
    });
    assert.equal(eleventhRes.status, 429);
    assert.equal(eleventhRes.body.code, "TOO_MANY_ATTEMPTS");
    const retryAfterHeader = Number.parseInt(eleventhRes.headers.get("retry-after") || "0", 10);
    assert.ok(retryAfterHeader > 0, "Expected positive Retry-After header on 429");

    // Clear/reset restores login ability
    clearLoginFailures("198.51.100.25", "admin");
    const okLogin = await apiFetch(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "X-Real-IP": "198.51.100.25" },
      body: JSON.stringify({ username: "admin", password: DEV_FALLBACK_PASSWORD }),
    });
    assert.equal(okLogin.status, 200);
    const cookiePair = (okLogin.headers.get("set-cookie") || "").split(";")[0];
    const jwtToken = okLogin.body.token as string;
    assert.ok(cookiePair && jwtToken);

    // (c) /api/auth/ws-verify: 401 unauthenticated, 200 with valid cookie, Bearer, or ?token=
    const unauthWs = await apiFetch(baseUrl, "/api/auth/ws-verify");
    assert.equal(unauthWs.status, 401);
    assert.equal(unauthWs.body.error, "Unauthorized WebSocket");

    const badTokenWs = await apiFetch(baseUrl, "/api/auth/ws-verify?token=invalid.jwt.sig");
    assert.equal(badTokenWs.status, 401);

    const cookieWs = await apiFetch(baseUrl, "/api/auth/ws-verify", {
      headers: { Cookie: cookiePair },
    });
    assert.equal(cookieWs.status, 200);
    assert.equal(cookieWs.body.ok, true);
    assert.equal(cookieWs.body.userId, okLogin.body.user.id);
    assert.equal(cookieWs.body.role, "admin");

    const queryTokenWs = await apiFetch(
      baseUrl,
      `/api/auth/ws-verify?token=${encodeURIComponent(jwtToken)}`
    );
    assert.equal(queryTokenWs.status, 200);
    assert.equal(queryTokenWs.body.ok, true);
    assert.equal(queryTokenWs.body.role, "admin");

    // (d) Webhook config & dispatcher block loopback/metadata when MDTEAM_ALLOW_LOCAL_WEBHOOKS="0"
    process.env.MDTEAM_ALLOW_LOCAL_WEBHOOKS = "0";
    const blockedWebhookCfg = await apiFetch(baseUrl, "/api/notifications/config", {
      method: "PUT",
      headers: { Authorization: `Bearer ${jwtToken}` },
      body: JSON.stringify({ teamsWebhookUrl: "http://127.0.0.1:9000/internal" }),
    });
    assert.equal(blockedWebhookCfg.status, 400);
    assert.equal(blockedWebhookCfg.body.code, "SSRF_BLOCKED");

    const testMetaDispatch = await apiFetch(baseUrl, "/api/notifications/test", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwtToken}` },
      body: JSON.stringify({ slackWebhookUrl: "http://169.254.169.254/latest/meta-data" }),
    });
    assert.equal(testMetaDispatch.status, 200);
    assert.equal(testMetaDispatch.body.results[0].ok, false);
    assert.match(testMetaDispatch.body.results[0].error, /SSRF/i);
  } finally {
    resetLoginRateLimiter();
    for (const k of Object.keys(process.env)) {
      if (!(k in savedEnv)) delete process.env[k];
    }
    Object.assign(process.env, savedEnv);
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    await fsp.rm(tempDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
});

test("Infrastructure Hardening: nginx.conf /_auth_ws subrequest & NS8 20initialize CSPRNG password + strict LF", () => {
  // (e) nginx.conf enforces auth_request /_auth_ws on location /ws
  const nginxConf = fs.readFileSync(path.join(REPO_ROOT, "nginx.conf"), "utf8");
  assert.match(nginxConf, /location\s*=\s*\/_auth_ws\s*\{[\s\S]*?internal;/);
  assert.match(nginxConf, /proxy_pass\s+http:\/\/api-server:4000\/api\/auth\/ws-verify;/);
  assert.match(nginxConf, /proxy_pass_request_body\s+off;/);
  assert.match(nginxConf, /proxy_set_header\s+Cookie\s+\$http_cookie;/);
  assert.match(nginxConf, /proxy_set_header\s+Authorization\s+\$http_authorization;/);
  const wsLocationBlock = nginxConf.match(/location\s+\/ws\s*\{([\s\S]*?)\}/);
  assert.ok(wsLocationBlock, "Expected location /ws block in nginx.conf");
  assert.match(wsLocationBlock[1], /auth_request\s+\/_auth_ws;/);

  // (f) ns8/imageroot/actions/create-module/20initialize sets MDTEAM_INITIAL_PASSWORD & has 0 CRLF bytes
  const initScriptPath = path.join(
    REPO_ROOT,
    "ns8",
    "imageroot",
    "actions",
    "create-module",
    "20initialize"
  );
  const rawBytes = fs.readFileSync(initScriptPath);
  assert.equal(
    rawBytes.includes(0x0d),
    false,
    "ns8/imageroot/actions/create-module/20initialize must contain ZERO 0x0d (CRLF) bytes"
  );
  const initText = rawBytes.toString("utf8");
  assert.match(initText, /existing_secrets\.get\(["']MDTEAM_INITIAL_PASSWORD["']\)\s+or\s+secrets\.token_urlsafe\(18\)/);
  assert.match(initText, /["']MDTEAM_INITIAL_PASSWORD["']\s*:\s*initial_pw/);
});
