import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface JsonResponse<T = Record<string, any>> {
  status: number;
  headers: Headers;
  body: T;
}

async function apiJson<T = Record<string, any>>(
  baseUrl: string,
  endpoint: string,
  init: RequestInit = {},
  cookieOrToken?: { cookie?: string; token?: string }
): Promise<JsonResponse<T>> {
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (cookieOrToken?.cookie) {
    headers.set("Cookie", cookieOrToken.cookie);
  }
  if (cookieOrToken?.token) {
    headers.set("Authorization", `Bearer ${cookieOrToken.token}`);
  }
  const resp = await fetch(`${baseUrl}${endpoint}`, { ...init, headers });
  const body = (await resp.json().catch(() => ({}))) as T;
  return { status: resp.status, headers: resp.headers, body };
}

test("Live Multi-User Server E2E: scrypt+JWT Auth, Scrum RBAC, Git Commit Author, Conflicts & Webhooks", async () => {
  const tempDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "mdteam-e2e-"));
  process.env.MDTEAM_SKIP_AUTOSTART = "1";
  process.env.DATA_DIR = tempDataDir;
  process.env.JWT_SECRET = "e2e-test-jwt-secret-key-32-bytes-minimum!!";

  // Import real server modules after setting env vars
  const { createMdTeamApiServer } = await import("../server/src/index.js");
  const { ensureUserStore, DEV_FALLBACK_PASSWORD } = await import("../server/src/auth/userStore.js");
  const { ensureProjectRepository } = await import("../server/src/git/serverGitBridge.js");

  await ensureUserStore();
  const repoInfo = await ensureProjectRepository("default");

  // Start real API HTTP server on ephemeral port
  const apiServer = createMdTeamApiServer();
  await new Promise<void>((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
  const addr = apiServer.address();
  assert.ok(addr && typeof addr === "object");
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  // Start mock webhook collector server for MS Teams & Slack verification
  const webhookDeliveries: Array<{ path: string; body: any }> = [];
  const webhookServer = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        webhookDeliveries.push({
          path: req.url || "/",
          body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
        });
      } catch {}
      res.statusCode = 200;
      res.end("ok");
    });
  });
  await new Promise<void>((resolve) => webhookServer.listen(0, "127.0.0.1", resolve));
  const whAddr = webhookServer.address();
  assert.ok(whAddr && typeof whAddr === "object");
  const webhookBaseUrl = `http://127.0.0.1:${whAddr.port}`;

  try {
    // 1. Health check & invalid login rejection
    const health = await apiJson(baseUrl, "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.status, "ok");

    const badLogin = await apiJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "wrong-password" }),
    });
    assert.equal(badLogin.status, 401);

    // Helper to authenticate any seeded Scrum role via scrypt + JWT cookie
    const loginRole = async (username: string) => {
      const res = await apiJson(baseUrl, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password: DEV_FALLBACK_PASSWORD }),
      });
      assert.equal(res.status, 200, `Login failed for ${username}`);
      const setCookie = res.headers.get("set-cookie") || "";
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Lax/i);
      const cookiePair = setCookie.split(";")[0];
      return { user: res.body.user, token: res.body.token as string, cookie: cookiePair };
    };

    const stakeholderAuth = await loginRole("stakeholder");
    const devAuth = await loginRole("dev-a");
    const poAuth = await loginRole("po");
    const adminAuth = await loginRole("admin");

    assert.equal(stakeholderAuth.user.role, "stakeholder");
    assert.equal(devAuth.user.role, "developer");
    assert.equal(poAuth.user.role, "product-owner");
    assert.equal(adminAuth.user.role, "admin");

    // Verify cookie-only session resolution via /api/auth/me
    const meRes = await apiJson(baseUrl, "/api/auth/me", {}, { cookie: poAuth.cookie });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.username, "po");

    // 2. RBAC Enforcement: Stakeholder receives 403 on file/backlog writes, 200 on feedback!
    const shWikiWrite = await apiJson(
      baseUrl,
      "/api/projects/default/files",
      {
        method: "PUT",
        body: JSON.stringify({
          path: "wiki/architecture.md",
          content: "# Unauthorized Stakeholder Edit\n",
        }),
      },
      { cookie: stakeholderAuth.cookie }
    );
    assert.equal(shWikiWrite.status, 403);

    const shBacklogWrite = await apiJson(
      baseUrl,
      "/api/projects/default/files",
      {
        method: "PUT",
        body: JSON.stringify({
          path: "issues/MDT-901.md",
          content: "# Unauthorized Ticket\n",
          action: "edit_issue",
        }),
      },
      { cookie: stakeholderAuth.cookie }
    );
    assert.equal(shBacklogWrite.status, 403);

    // Stakeholder IS allowed to post inline review comments / feedback!
    const shFeedbackOk = await apiJson(
      baseUrl,
      "/api/projects/default/files",
      {
        method: "PUT",
        body: JSON.stringify({
          path: ".mdteam/inline-comments.json",
          content: JSON.stringify(
            {
              version: 1,
              threads: [{ id: "t-1", filePath: "arc42/01_goals.md", status: "open", comments: [] }],
            },
            null,
            2
          ),
        }),
      },
      { cookie: stakeholderAuth.cookie }
    );
    assert.equal(shFeedbackOk.status, 200);

    // 3. Developer RBAC: 403 on reorder_product_backlog & approve_wiki, 200 on issue/wiki edits
    const devReorder = await apiJson(
      baseUrl,
      "/api/projects/default/files",
      {
        method: "PUT",
        body: JSON.stringify({
          path: ".mdteam/backlog-order.json",
          content: '["MDT-102","MDT-101"]\n',
          action: "reorder_product_backlog",
        }),
      },
      { token: devAuth.token }
    );
    assert.equal(devReorder.status, 403);

    const devApprove = await apiJson(
      baseUrl,
      "/api/projects/default/files",
      {
        method: "PUT",
        body: JSON.stringify({
          path: "wiki/dev-spec.md",
          content: '---\nreview_status: "approved"\n---\n# Spec\n',
        }),
      },
      { token: devAuth.token }
    );
    assert.equal(devApprove.status, 403);

    const devIssueWrite = await apiJson(
      baseUrl,
      "/api/projects/default/files",
      {
        method: "PUT",
        body: JSON.stringify({
          path: "issues/MDT-205.md",
          content: "---\nid: MDT-205\ntype: task\nstatus: in-progress\n---\n\n# Dev Task\n",
          message: "feat(issue): add MDT-205 implementation task",
        }),
      },
      { token: devAuth.token }
    );
    assert.equal(devIssueWrite.status, 200);
    assert.equal(devIssueWrite.body.committed, true);

    // 4. PO writes commit to real Git repo with authenticated user author attribution + path sanitizer
    const poWrite = await apiJson(
      baseUrl,
      "/api/projects/default/files",
      {
        method: "PUT",
        body: JSON.stringify({
          path: "wiki/product-vision.md",
          content: '---\nreview_status: "approved"\napproved_by: "@po"\n---\n\n# Product Vision\n',
          message: "docs(vision): approve product vision",
        }),
      },
      { cookie: poAuth.cookie }
    );
    assert.equal(poWrite.status, 200);

    const { stdout: gitAuthorOut } = await execFileAsync(
      "git",
      ["log", "-1", "--format=%an <%ae>|%s"],
      { cwd: repoInfo.repoDir }
    );
    assert.match(gitAuthorOut.trim(), /<po@mdteam\.local>\|docs\(vision\): approve product vision/i);

    // Path traversal & git flag injection must be rejected with 400
    const traversalAttempt = await apiJson(
      baseUrl,
      "/api/projects/default/files",
      {
        method: "PUT",
        body: JSON.stringify({ path: "../escape.md", content: "bad" }),
      },
      { token: adminAuth.token }
    );
    assert.equal(traversalAttempt.status, 400);

    // 5. Real Git Merge Conflict Inspection & Resolution API
    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: "Test Bot",
      GIT_AUTHOR_EMAIL: "bot@mdteam.local",
      GIT_COMMITTER_NAME: "Test Bot",
      GIT_COMMITTER_EMAIL: "bot@mdteam.local",
    };
    const conflictTarget = path.join(repoInfo.repoDir, "wiki", "roadmap-conflict.md");
    await fs.mkdir(path.dirname(conflictTarget), { recursive: true });
    await fs.writeFile(conflictTarget, "# Roadmap\n\nTarget: Q2\n", "utf8");
    await execFileAsync("git", ["add", "wiki/roadmap-conflict.md"], { cwd: repoInfo.repoDir, env: gitEnv });
    await execFileAsync("git", ["commit", "-m", "seed conflict base"], { cwd: repoInfo.repoDir, env: gitEnv });

    const { stdout: baseBranchOut } = await execFileAsync(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd: repoInfo.repoDir }
    );
    const mainBranch = baseBranchOut.trim();

    await execFileAsync("git", ["checkout", "-b", "feat/theirs-q4"], { cwd: repoInfo.repoDir, env: gitEnv });
    await fs.writeFile(conflictTarget, "# Roadmap\n\nTarget: Q4 Enterprise\n", "utf8");
    await execFileAsync("git", ["commit", "-am", "theirs q4"], { cwd: repoInfo.repoDir, env: gitEnv });

    await execFileAsync("git", ["checkout", mainBranch], { cwd: repoInfo.repoDir, env: gitEnv });
    await fs.writeFile(conflictTarget, "# Roadmap\n\nTarget: Q3 Cloud\n", "utf8");
    await execFileAsync("git", ["commit", "-am", "ours q3"], { cwd: repoInfo.repoDir, env: gitEnv });

    // Trigger real Git merge conflict
    await execFileAsync("git", ["merge", "feat/theirs-q4"], { cwd: repoInfo.repoDir, env: gitEnv }).catch(
      () => undefined
    );

    const conflictsRes = await apiJson(
      baseUrl,
      "/api/projects/default/git/conflicts",
      {},
      { token: devAuth.token }
    );
    assert.equal(conflictsRes.status, 200);
    assert.ok(conflictsRes.body.conflicts.includes("wiki/roadmap-conflict.md"));
    const conflictEntry = conflictsRes.body.versions["wiki/roadmap-conflict.md"];
    assert.ok(conflictEntry);
    assert.match(conflictEntry.ours, /Target: Q3 Cloud/);
    assert.match(conflictEntry.theirs, /Target: Q4 Enterprise/);
    assert.match(conflictEntry.working, /<{7}/);

    const resolveRes = await apiJson(
      baseUrl,
      "/api/projects/default/git/resolve",
      {
        method: "POST",
        body: JSON.stringify({
          filePath: "wiki/roadmap-conflict.md",
          resolvedContent: "# Roadmap\n\nTarget: Q3 Cloud + Q4 Enterprise\n",
          commit: true,
        }),
      },
      { token: devAuth.token }
    );
    assert.equal(resolveRes.status, 200);
    assert.deepEqual(resolveRes.body.remainingConflicts, []);

    // 6. Outgoing MS Teams Adaptive Card & Slack Block Kit Webhooks
    const cfgRes = await apiJson(
      baseUrl,
      "/api/notifications/config",
      {
        method: "PUT",
        body: JSON.stringify({
          teamsWebhookUrl: `${webhookBaseUrl}/teams`,
          slackWebhookUrl: `${webhookBaseUrl}/slack`,
          emailWebhookUrl: "",
          events: ["blocker", "mention", "review", "sprint", "assignment"],
        }),
      },
      { token: adminAuth.token }
    );
    assert.equal(cfgRes.status, 200);

    const dispatchRes = await apiJson(
      baseUrl,
      "/api/notifications/dispatch",
      {
        method: "POST",
        body: JSON.stringify({
          event: "blocker",
          severity: "critical",
          projectId: "default",
          targetPath: "issues/MDT-205.md",
          title: "MDT-205 Blocked by SSO Gateway",
          summary: "Waiting on Keycloak realm certificate rotation.",
        }),
      },
      { token: devAuth.token }
    );
    assert.equal(dispatchRes.status, 200);
    assert.equal(dispatchRes.body.skipped, false);

    const teamsPayload = webhookDeliveries.find((d) => d.path === "/teams")?.body;
    const slackPayload = webhookDeliveries.find((d) => d.path === "/slack")?.body;
    assert.ok(teamsPayload, "Teams Adaptive Card webhook should be delivered");
    assert.equal(teamsPayload.attachments?.[0]?.content?.type, "AdaptiveCard");
    assert.equal(teamsPayload.attachments?.[0]?.content?.version, "1.4");
    assert.ok(slackPayload, "Slack Block Kit webhook should be delivered");
    assert.ok(Array.isArray(slackPayload.blocks));
  } finally {
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    await new Promise<void>((resolve) => webhookServer.close(() => resolve()));
    await fs.rm(tempDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
});
