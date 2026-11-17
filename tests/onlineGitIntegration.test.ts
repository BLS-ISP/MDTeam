import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface JsonResponse<T = Record<string, any>> {
  status: number;
  body: T;
}

async function apiJson<T = Record<string, any>>(
  baseUrl: string,
  endpoint: string,
  init: RequestInit = {},
  token?: string
): Promise<JsonResponse<T>> {
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const resp = await fetch(`${baseUrl}${endpoint}`, { ...init, headers });
  const body = (await resp.json().catch(() => ({}))) as T;
  return { status: resp.status, body };
}

function startSmartGitHttpServer(
  gitProjectRoot: string,
  expectedUser: string,
  expectedToken: string
): Promise<{ server: http.Server; baseUrl: string }> {
  const expectedAuth =
    "Basic " + Buffer.from(`${expectedUser}:${expectedToken}`, "utf8").toString("base64");

  const server = http.createServer((req, res) => {
    const authHeader = req.headers.authorization || "";
    if (authHeader !== expectedAuth) {
      res.statusCode = 401;
      res.setHeader("WWW-Authenticate", 'Basic realm="GitServer"');
      res.end("Authentication required");
      return;
    }

    const reqUrl = new URL(req.url || "/", "http://127.0.0.1");
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_PROJECT_ROOT: gitProjectRoot,
      GIT_HTTP_EXPORT_ALL: "1",
      PATH_INFO: reqUrl.pathname,
      QUERY_STRING: reqUrl.search.replace(/^\?/, ""),
      REQUEST_METHOD: req.method || "GET",
      CONTENT_TYPE: req.headers["content-type"] || "",
      CONTENT_LENGTH: req.headers["content-length"] || "",
      REMOTE_USER: expectedUser,
      REMOTE_ADDR: "127.0.0.1",
    };

    const child = spawn("git", ["http-backend"], { env, windowsHide: true });
    req.pipe(child.stdin);

    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("close", () => {
      const raw = Buffer.concat(chunks);
      const sepCrlf = raw.indexOf("\r\n\r\n");
      const sepLf = raw.indexOf("\n\n");
      const sepIdx =
        sepCrlf !== -1 && (sepLf === -1 || sepCrlf < sepLf) ? sepCrlf : sepLf;
      const sepLen = sepIdx === sepCrlf ? 4 : 2;
      if (sepIdx === -1) {
        res.statusCode = 500;
        res.end(raw);
        return;
      }
      const headerBlock = raw.subarray(0, sepIdx).toString("utf8");
      const bodyBuf = raw.subarray(sepIdx + sepLen);
      let status = 200;
      for (const line of headerBlock.split(/\r?\n/)) {
        const colon = line.indexOf(":");
        if (colon === -1) continue;
        const key = line.slice(0, colon).trim();
        const val = line.slice(colon + 1).trim();
        if (key.toLowerCase() === "status") {
          status = Number.parseInt(val, 10) || 200;
        } else {
          res.setHeader(key, val);
        }
      }
      res.statusCode = status;
      res.end(bodyBuf);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      assert.ok(addr && typeof addr === "object");
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

test("Online Git Integration E2E: Authenticated Smart HTTP Clone, Encrypted PAT, SSH Deploy Key, RBAC, Branches, Push/Pull & File History", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mdteam-online-git-"));
  const dataDir = path.join(tempRoot, "data");
  const upstreamRoot = path.join(tempRoot, "upstream");
  const seedWorkDir = path.join(tempRoot, "seed-work");
  const bareRepoDir = path.join(upstreamRoot, "real-product.git");

  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(upstreamRoot, { recursive: true });

  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: "Upstream Lead",
    GIT_AUTHOR_EMAIL: "lead@company.dev",
    GIT_COMMITTER_NAME: "Upstream Lead",
    GIT_COMMITTER_EMAIL: "lead@company.dev",
  };

  // 1. Create real bare Git repository with 2 branches & real project files
  await execFileAsync("git", ["init", "--bare", bareRepoDir], { env: gitEnv });
  await execFileAsync("git", ["config", "http.receivepack", "true"], { cwd: bareRepoDir, env: gitEnv });

  await execFileAsync("git", ["clone", bareRepoDir, seedWorkDir], { env: gitEnv });
  await execFileAsync("git", ["checkout", "-b", "main"], { cwd: seedWorkDir, env: gitEnv });
  await fs.writeFile(path.join(seedWorkDir, "README.md"), "# Real Product Repo\n\nv1 architecture.\n", "utf8");
  await fs.mkdir(path.join(seedWorkDir, "docs"), { recursive: true });
  await fs.writeFile(path.join(seedWorkDir, "docs", "setup.md"), "# Developer Setup\n\nRun npm test.\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: seedWorkDir, env: gitEnv });
  await execFileAsync("git", ["commit", "-m", "feat: initial product repository"], { cwd: seedWorkDir, env: gitEnv });
  await execFileAsync("git", ["push", "-u", "origin", "main"], { cwd: seedWorkDir, env: gitEnv });
  await execFileAsync("git", ["symbolic-ref", "HEAD", "refs/heads/main"], { cwd: bareRepoDir, env: gitEnv });

  await execFileAsync("git", ["checkout", "-b", "develop"], { cwd: seedWorkDir, env: gitEnv });
  await fs.writeFile(path.join(seedWorkDir, "docs", "setup.md"), "# Developer Setup\n\nDevelop branch notes.\n", "utf8");
  await execFileAsync("git", ["commit", "-am", "chore: develop branch"], { cwd: seedWorkDir, env: gitEnv });
  await execFileAsync("git", ["push", "-u", "origin", "develop"], { cwd: seedWorkDir, env: gitEnv });

  const PAT_USER = "oauth2";
  const PAT_TOKEN = "glpat-super-secret-token-999";
  const gitHttp = await startSmartGitHttpServer(upstreamRoot, PAT_USER, PAT_TOKEN);
  const remoteRepoUrl = `${gitHttp.baseUrl}/real-product.git`;

  process.env.MDTEAM_SKIP_AUTOSTART = "1";
  process.env.DATA_DIR = dataDir;
  process.env.JWT_SECRET = "online-git-e2e-jwt-secret-key-minimum-32-bytes!!";
  process.env.MDTEAM_ALLOW_LOCAL_GIT_REMOTE = "0";

  const { createMdTeamApiServer } = await import("../server/src/index.js");
  const { ensureUserStore, DEV_FALLBACK_PASSWORD } = await import("../server/src/auth/userStore.js");
  const { ensureProjectRepository } = await import("../server/src/git/serverGitBridge.js");

  await ensureUserStore();
  await ensureProjectRepository("default");

  const apiServer = createMdTeamApiServer();
  await new Promise<void>((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
  const apiAddr = apiServer.address();
  assert.ok(apiAddr && typeof apiAddr === "object");
  const apiBase = `http://127.0.0.1:${apiAddr.port}`;

  try {
    const login = async (username: string) => {
      const r = await apiJson<{ token: string }>(apiBase, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password: DEV_FALLBACK_PASSWORD }),
      });
      assert.equal(r.status, 200);
      return r.body.token;
    };

    const devAToken = await login("dev-a");
    const devBToken = await login("dev-b");
    const stakeholderToken = await login("stakeholder");

    // 2. SSRF & Dangerous Protocol Guard (127.0.0.1 & ext:: blocked when local override is off)
    const ssrfBlocked = await apiJson(
      apiBase,
      "/api/projects/git/test",
      {
        method: "POST",
        body: JSON.stringify({ remoteUrl: remoteRepoUrl, authType: "https", httpsUsername: PAT_USER, httpsToken: PAT_TOKEN }),
      },
      devAToken
    );
    assert.equal(ssrfBlocked.status, 400);

    const extBlocked = await apiJson(
      apiBase,
      "/api/projects/git/test",
      {
        method: "POST",
        body: JSON.stringify({ remoteUrl: "ext::sh -c touch% /tmp/pwn" }),
      },
      devAToken
    );
    assert.equal(extBlocked.status, 400);

    // Enable local Git HTTP remote exclusively for local E2E test harness
    process.env.MDTEAM_ALLOW_LOCAL_GIT_REMOTE = "1";

    // 3. Stakeholder is strictly 403 Forbidden from testing/cloning Git repos
    const stakeholderDenied = await apiJson(
      apiBase,
      "/api/projects/clone",
      {
        method: "POST",
        body: JSON.stringify({ projectId: "blocked-proj", remoteUrl: remoteRepoUrl }),
      },
      stakeholderToken
    );
    assert.equal(stakeholderDenied.status, 403);

    // 4. Connection test fails without PAT (401 upstream -> 502/401) and succeeds with PAT
    const unauthTest = await apiJson(
      apiBase,
      "/api/projects/git/test",
      {
        method: "POST",
        body: JSON.stringify({ remoteUrl: remoteRepoUrl, authType: "none" }),
      },
      devAToken
    );
    assert.ok(unauthTest.status >= 400);

    const okTest = await apiJson<{ ok: boolean; branches: string[]; defaultBranch: string }>(
      apiBase,
      "/api/projects/git/test",
      {
        method: "POST",
        body: JSON.stringify({
          remoteUrl: remoteRepoUrl,
          authType: "https",
          httpsUsername: PAT_USER,
          httpsToken: PAT_TOKEN,
        }),
      },
      devAToken
    );
    assert.equal(okTest.status, 200);
    assert.equal(okTest.body.ok, true);
    assert.ok(okTest.body.branches.includes("main"));
    assert.ok(okTest.body.branches.includes("develop"));
    assert.equal(okTest.body.defaultBranch, "main");

    // 5. Developer clones real repository (passing embedded token URL to test auto-stripping + encryption!)
    const embeddedUrl = remoteRepoUrl.replace("http://", `http://${PAT_USER}:${PAT_TOKEN}@`);
    const cloneRes = await apiJson<{ project: Record<string, any>; filesCount: number }>(
      apiBase,
      "/api/projects/clone",
      {
        method: "POST",
        body: JSON.stringify({
          projectId: "real-product",
          displayName: "Real Product Service",
          remoteUrl: embeddedUrl,
          branch: "main",
          scaffoldMdTeam: true,
          visibility: "team",
        }),
      },
      devAToken
    );
    assert.equal(cloneRes.status, 201);
    assert.equal(cloneRes.body.project.projectId, "real-product");
    assert.equal(cloneRes.body.project.remoteUrl, remoteRepoUrl);
    assert.equal(cloneRes.body.project.hasToken, true);
    assert.equal(JSON.stringify(cloneRes.body).includes(PAT_TOKEN), false, "PAT must never leak in API response");

    // Verify .git/config has NO plaintext token & git-projects.json encrypts the token at rest
    const gitConfigRaw = await fs.readFile(path.join(dataDir, "repos", "real-product", ".git", "config"), "utf8");
    assert.equal(gitConfigRaw.includes(PAT_TOKEN), false, ".git/config must never contain plaintext PAT");
    const credStoreRaw = await fs.readFile(path.join(dataDir, "git-projects.json"), "utf8");
    assert.equal(credStoreRaw.includes(PAT_TOKEN), false, "git-projects.json must encrypt PAT with AES-256-GCM");

    // Verify cloned files (README.md preserved + optional MDTeam scaffolding added)
    const filesRes = await apiJson<{ files: Array<{ path: string; content: string }> }>(
      apiBase,
      "/api/projects/real-product/files",
      {},
      devAToken
    );
    assert.equal(filesRes.status, 200);
    const readme = filesRes.body.files.find((f) => f.path === "README.md");
    assert.ok(readme);
    assert.match(readme.content, /# Real Product Repo/);
    assert.ok(filesRes.body.files.some((f) => f.path === "docs/setup.md"));
    assert.ok(filesRes.body.files.some((f) => f.path.startsWith("wiki/")));

    // 6. Generate Ed25519 SSH Deploy Key for project
    const sshRes = await apiJson<{ sshPublicKey: string }>(
      apiBase,
      "/api/projects/real-product/git/ssh-key",
      { method: "POST", body: JSON.stringify({}) },
      devAToken
    );
    assert.equal(sshRes.status, 200);
    assert.match(sshRes.body.sshPublicKey, /^ssh-ed25519 AAAA/);
    assert.equal(JSON.stringify(sshRes.body).includes("PRIVATE KEY"), false);

    // Switch auth back to HTTPS PAT for Smart HTTP push/pull verification
    const setHttpsRes = await apiJson(
      apiBase,
      "/api/projects/real-product/git/remote",
      {
        method: "PUT",
        body: JSON.stringify({ remoteUrl: remoteRepoUrl, authType: "https", httpsUsername: PAT_USER }),
      },
      devAToken
    );
    assert.equal(setHttpsRes.status, 200);

    // 7. Real Server Branch Listing, Checkout & Authenticated Push to Upstream
    const branchesBefore = await apiJson<{ currentBranch: string; branches: Array<{ name: string }> }>(
      apiBase,
      "/api/projects/real-product/git/branches",
      {},
      devAToken
    );
    assert.equal(branchesBefore.status, 200);
    assert.equal(branchesBefore.body.currentBranch, "main");
    assert.ok(branchesBefore.body.branches.some((b) => b.name === "develop"));

    const checkoutRes = await apiJson<{ branch: string }>(
      apiBase,
      "/api/projects/real-product/git/checkout",
      {
        method: "POST",
        body: JSON.stringify({ branch: "feat/MDT-300-online-git", create: true }),
      },
      devAToken
    );
    assert.equal(checkoutRes.status, 200);
    assert.equal(checkoutRes.body.branch, "feat/MDT-300-online-git");

    await apiJson(
      apiBase,
      "/api/projects/real-product/files",
      {
        method: "PUT",
        body: JSON.stringify({
          path: "README.md",
          content: "# Real Product Repo\n\nv2 edited online by dev-a!\n",
          message: "docs(readme): update online from MDTeam browser",
        }),
      },
      devAToken
    );

    const pushRes = await apiJson<{ ok: boolean }>(
      apiBase,
      "/api/projects/real-product/git/sync",
      { method: "POST", body: JSON.stringify({ direction: "push" }) },
      devAToken
    );
    assert.equal(pushRes.status, 200);
    assert.equal(pushRes.body.ok, true);

    // Verify commit landed in upstream bare repository on feat/MDT-300-online-git!
    const { stdout: upstreamLog } = await execFileAsync(
      "git",
      ["log", "-n", "1", "--pretty=format:%ae|%s", "feat/MDT-300-online-git"],
      { cwd: bareRepoDir }
    );
    assert.match(upstreamLog, /dev-a@mdteam\.local\|docs\(readme\): update online from MDTeam browser/);

    // 8. File Git History & Historical File Content API + Private Workspace Isolation
    const historyRes = await apiJson<{ commits: Array<{ hash: string; message: string }> }>(
      apiBase,
      "/api/projects/real-product/git/history?path=README.md",
      {},
      devAToken
    );
    assert.equal(historyRes.status, 200);
    assert.ok(historyRes.body.commits.length >= 2);
    const oldestCommit = historyRes.body.commits[historyRes.body.commits.length - 1];

    const atCommitRes = await apiJson<{ content: string }>(
      apiBase,
      `/api/projects/real-product/git/file-at-commit?sha=${encodeURIComponent(oldestCommit.hash)}&path=README.md`,
      {},
      devAToken
    );
    assert.equal(atCommitRes.status, 200);
    assert.match(atCommitRes.body.content, /v1 architecture\./);

    // Private workspace visibility check: dev-a clones private repo -> hidden & 403 for dev-b
    const privClone = await apiJson(
      apiBase,
      "/api/projects/clone",
      {
        method: "POST",
        body: JSON.stringify({
          projectId: "dev-a-sandbox",
          remoteUrl: remoteRepoUrl,
          authType: "https",
          httpsUsername: PAT_USER,
          httpsToken: PAT_TOKEN,
          visibility: "private",
        }),
      },
      devAToken
    );
    assert.equal(privClone.status, 201);

    const devBProjects = await apiJson<{ projects: string[] }>(apiBase, "/api/projects", {}, devBToken);
    assert.ok(devBProjects.body.projects.includes("real-product"));
    assert.equal(devBProjects.body.projects.includes("dev-a-sandbox"), false);

    const devBForbiddenRead = await apiJson(apiBase, "/api/projects/dev-a-sandbox/files", {}, devBToken);
    assert.equal(devBForbiddenRead.status, 403);

    const delRes = await apiJson(
      apiBase,
      "/api/projects/dev-a-sandbox",
      { method: "DELETE" },
      devAToken
    );
    assert.equal(delRes.status, 200);
  } finally {
    await new Promise<void>((r) => apiServer.close(() => r()));
    await new Promise<void>((r) => gitHttp.server.close(() => r()));
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});
