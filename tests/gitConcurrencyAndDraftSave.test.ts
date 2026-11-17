import test from "node:test";
import assert from "node:assert/strict";
import dns from "node:dns";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

test("Git Concurrency Mutex, Draft Auto-Save, Pre-Clone SSH Preview, Code Snippet Guard & DNS-Rebinding SSRF E2E", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mdteam-git-concurrency-"));
  const dataDir = path.join(tempRoot, "data");
  await fs.mkdir(dataDir, { recursive: true });

  process.env.MDTEAM_SKIP_AUTOSTART = "1";
  process.env.DATA_DIR = dataDir;
  process.env.JWT_SECRET = "git-concurrency-e2e-jwt-secret-minimum-32-bytes!!";
  process.env.MDTEAM_ALLOW_LOCAL_GIT_REMOTE = "0";

  const { createMdTeamApiServer } = await import("../server/src/index.js");
  const { ensureUserStore, DEV_FALLBACK_PASSWORD } = await import("../server/src/auth/userStore.js");
  const { ensureProjectRepository } = await import("../server/src/git/serverGitBridge.js");
  const { withProjectGitLock } = await import("../server/src/git/gitMutex.js");
  const { validateRemoteUrlWithDns } = await import("../server/src/git/gitSanitizer.js");

  await ensureUserStore();
  await ensureProjectRepository("default");

  // Verify AsyncLocalStorage re-entrancy on withProjectGitLock (zero deadlock on nested lock)
  const reentrantResult = await withProjectGitLock("default", async () => {
    return withProjectGitLock("default", async () => "reentrant-ok");
  });
  assert.equal(reentrantResult, "reentrant-ok");

  // Verify DNS-rebinding SSRF guard blocks loopback & cloud metadata while permitting RFC1918 LAN IPs
  const origLookup = dns.promises.lookup;
  try {
    (dns.promises as any).lookup = async (host: string) => {
      if (host === "rebind-loopback.example.test") {
        return [{ address: "127.0.0.1", family: 4 }];
      }
      if (host === "rebind-metadata.example.test") {
        return [{ address: "169.254.169.254", family: 4 }];
      }
      if (host === "rebind-v6mapped.example.test") {
        return [{ address: "::ffff:127.0.0.1", family: 6 }];
      }
      if (host === "internal-gitlab.corp.lan") {
        return [{ address: "10.24.8.15", family: 4 }];
      }
      return origLookup(host, { all: true });
    };

    await assert.rejects(
      () => validateRemoteUrlWithDns("https://rebind-loopback.example.test/org/repo.git"),
      (err: any) => err?.statusCode === 400 && err?.code === "SSRF_DNS_REBIND_BLOCKED"
    );
    await assert.rejects(
      () => validateRemoteUrlWithDns("https://rebind-metadata.example.test/org/repo.git"),
      (err: any) => err?.statusCode === 400 && err?.code === "SSRF_DNS_REBIND_BLOCKED"
    );
    await assert.rejects(
      () => validateRemoteUrlWithDns("git@rebind-v6mapped.example.test:org/repo.git"),
      (err: any) => err?.statusCode === 400 && err?.code === "SSRF_DNS_REBIND_BLOCKED"
    );
    const allowedLan = await validateRemoteUrlWithDns("https://internal-gitlab.corp.lan/org/repo.git");
    assert.equal(allowedLan, "https://internal-gitlab.corp.lan/org/repo.git");
  } finally {
    (dns.promises as any).lookup = origLookup;
  }

  const apiServer = createMdTeamApiServer();
  await new Promise<void>((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
  const addr = apiServer.address();
  assert.ok(addr && typeof addr === "object");
  const apiBase = `http://127.0.0.1:${addr.port}`;

  try {
    const login = async (username: string) => {
      const res = await apiJson<{ token: string }>(apiBase, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password: DEV_FALLBACK_PASSWORD }),
      });
      assert.equal(res.status, 200);
      return res.body.token;
    };

    const devToken = await login("dev-a");
    const stakeholderToken = await login("stakeholder");

    // (a) 10 concurrent Promise.all PUT /api/projects/default/files requests succeed 10/10 with zero .git/index.lock errors
    const parallelWrites = Array.from({ length: 10 }, (_, idx) =>
      apiJson<{ committed: boolean; commitSha: string; file: { path: string; content: string } }>(
        apiBase,
        "/api/projects/default/files",
        {
          method: "PUT",
          body: JSON.stringify({
            path: `wiki/concurrent-${idx}.md`,
            content: `# Concurrent Doc ${idx}\n\nWritten in parallel batch.\n`,
            message: `docs(concurrent-${idx}): parallel save ${idx}`,
          }),
        },
        devToken
      )
    );
    const parallelOutcomes = await Promise.all(parallelWrites);
    for (let i = 0; i < 10; i += 1) {
      assert.equal(
        parallelOutcomes[i].status,
        200,
        `Expected 200 for concurrent PUT #${i}, got ${parallelOutcomes[i].status}: ${JSON.stringify(parallelOutcomes[i].body)}`
      );
      assert.equal(parallelOutcomes[i].body.committed, true);
      assert.ok(parallelOutcomes[i].body.commitSha.length >= 6);
    }

    // Verify .git/index.lock does not linger and all 10 commits exist in git history
    const indexLockExists = await fs
      .access(path.join(dataDir, "repos", "default", ".git", "index.lock"))
      .then(() => true)
      .catch(() => false);
    assert.equal(indexLockExists, false, ".git/index.lock must not exist after serialized writes");

    const statusAfterParallel = await apiJson<{
      headSha: string;
      modified: string[];
      untracked: string[];
      recentCommits: Array<{ hash: string; message: string }>;
    }>(apiBase, "/api/projects/default/git/status", {}, devToken);
    assert.equal(statusAfterParallel.status, 200);
    assert.equal(statusAfterParallel.body.modified.length, 0);
    assert.equal(statusAfterParallel.body.untracked.length, 0);
    assert.ok(statusAfterParallel.body.recentCommits.length >= 11);

    const headBeforeDraft = statusAfterParallel.body.headSha;
    const commitsCountBeforeDraft = statusAfterParallel.body.recentCommits.length;

    // (b) autoCommit: false writes draft to disk without committing until POST /git/commit
    const draftNewRes = await apiJson<{ committed: boolean; commitSha: string }>(
      apiBase,
      "/api/projects/default/files",
      {
        method: "PUT",
        body: JSON.stringify({
          path: "wiki/typing-draft.md",
          content: "# Typing Draft v1\n\nUnsaved working-tree draft.\n",
          autoCommit: false,
        }),
      },
      devToken
    );
    assert.equal(draftNewRes.status, 200);
    assert.equal(draftNewRes.body.committed, false);
    assert.equal(draftNewRes.body.commitSha, headBeforeDraft);

    const draftModRes = await apiJson<{ committed: boolean; commitSha: string }>(
      apiBase,
      "/api/projects/default/files",
      {
        method: "PUT",
        body: JSON.stringify({
          path: "wiki/concurrent-0.md",
          content: "# Concurrent Doc 0 (Edited Draft)\n\nDebounced keystroke update.\n",
          autoCommit: false,
        }),
      },
      devToken
    );
    assert.equal(draftModRes.status, 200);
    assert.equal(draftModRes.body.committed, false);
    assert.equal(draftModRes.body.commitSha, headBeforeDraft);

    // GET /files returns updated draft content from disk
    const getDraftFile = await apiJson<{ path: string; content: string }>(
      apiBase,
      "/api/projects/default/files?path=wiki/typing-draft.md",
      {},
      devToken
    );
    assert.equal(getDraftFile.status, 200);
    assert.match(getDraftFile.body.content, /Unsaved working-tree draft/);

    // GET /git/status shows modified + untracked while HEAD SHA is unchanged
    const statusDuringDraft = await apiJson<{
      headSha: string;
      modified: string[];
      untracked: string[];
      recentCommits: Array<{ hash: string }>;
    }>(apiBase, "/api/projects/default/git/status", {}, devToken);
    assert.equal(statusDuringDraft.status, 200);
    assert.equal(statusDuringDraft.body.headSha, headBeforeDraft);
    assert.equal(statusDuringDraft.body.recentCommits.length, commitsCountBeforeDraft);
    assert.ok(statusDuringDraft.body.untracked.includes("wiki/typing-draft.md"));
    assert.ok(statusDuringDraft.body.modified.includes("wiki/concurrent-0.md"));

    // Explicit POST /git/commit creates exactly 1 clean commit for all drafts
    const manualCommit = await apiJson<{ committed: boolean; commitSha: string }>(
      apiBase,
      "/api/projects/default/git/commit",
      {
        method: "POST",
        body: JSON.stringify({ message: "docs(wiki): publish draft changes", push: false }),
      },
      devToken
    );
    assert.equal(manualCommit.status, 200);
    assert.equal(manualCommit.body.committed, true);
    assert.notEqual(manualCommit.body.commitSha, headBeforeDraft);

    const statusAfterCommit = await apiJson<{
      headSha: string;
      modified: string[];
      untracked: string[];
      recentCommits: Array<{ hash: string; message: string }>;
    }>(apiBase, "/api/projects/default/git/status", {}, devToken);
    assert.equal(statusAfterCommit.body.headSha, manualCommit.body.commitSha);
    assert.equal(statusAfterCommit.body.modified.length, 0);
    assert.equal(statusAfterCommit.body.untracked.length, 0);
    assert.equal(statusAfterCommit.body.recentCommits[0].message, "docs(wiki): publish draft changes");

    // (c) POST /api/projects/git/ssh-key-preview requires connect_git_repo & returns valid Ed25519 keypair
    const stakeholderPreview = await apiJson(
      apiBase,
      "/api/projects/git/ssh-key-preview",
      { method: "POST", body: JSON.stringify({}) },
      stakeholderToken
    );
    assert.equal(stakeholderPreview.status, 403);

    const sshPreview = await apiJson<{ sshPublicKey: string; sshPrivateKey: string }>(
      apiBase,
      "/api/projects/git/ssh-key-preview",
      { method: "POST", body: JSON.stringify({ comment: "mdteam@clone-preview" }) },
      devToken
    );
    assert.equal(sshPreview.status, 200);
    assert.match(sshPreview.body.sshPublicKey, /^ssh-ed25519 AAAA\S+ mdteam@clone-preview$/);
    assert.match(sshPreview.body.sshPrivateKey, /-----BEGIN OPENSSH PRIVATE KEY-----/);
    assert.match(sshPreview.body.sshPrivateKey, /-----END OPENSSH PRIVATE KEY-----/);

    // (d) GET /api/projects/default/code?path=... serves .ts code while blocking .env / secrets / keys with 403
    const defaultRepoDir = path.join(dataDir, "repos", "default");
    await fs.mkdir(path.join(defaultRepoDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(defaultRepoDir, "src", "service.ts"),
      "export function add(a: number, b: number): number {\n  return a + b;\n}\n",
      "utf8"
    );
    await fs.writeFile(path.join(defaultRepoDir, ".env"), "DATABASE_URL=postgres://secret\n", "utf8");
    await fs.writeFile(path.join(defaultRepoDir, "jwt-secret.json"), '{"key":"top-secret"}\n', "utf8");
    await fs.writeFile(path.join(defaultRepoDir, "tls.pem"), "-----BEGIN PRIVATE KEY-----\n", "utf8");

    const codeOk = await apiJson<{ path: string; content: string }>(
      apiBase,
      "/api/projects/default/code?path=src/service.ts",
      {},
      devToken
    );
    assert.equal(codeOk.status, 200);
    assert.equal(codeOk.body.path, "src/service.ts");
    assert.match(codeOk.body.content, /export function add/);

    for (const forbidden of [".env", ".env.production", "jwt-secret.json", "tls.pem"]) {
      const blocked = await apiJson<{ code: string }>(
        apiBase,
        `/api/projects/default/code?path=${encodeURIComponent(forbidden)}`,
        {},
        devToken
      );
      assert.equal(blocked.status, 403, `Expected 403 for sensitive path ${forbidden}`);
      assert.equal(blocked.body.code, "FORBIDDEN_SENSITIVE_FILE");
    }
  } finally {
    await new Promise<void>((r) => apiServer.close(() => r()));
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});
