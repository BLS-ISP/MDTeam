import { HttpError } from "../httpHelpers.js";
import type { AuthUser } from "../types.js";
import { withProjectGitLock } from "./gitMutex.js";
import {
  execGitSafe,
  sanitizeGitRef,
  sanitizeProjectId,
  sanitizeRepoRelativePath,
} from "./gitSanitizer.js";
import {
  ensureProjectRepository,
  syncProjectGitRemote,
  type ServerCommitEntry,
} from "./serverGitBridge.js";

export async function listProjectBranches(rawProjectId: string): Promise<{
  currentBranch: string;
  branches: Array<{ name: string; isCurrent: boolean; isRemote: boolean }>;
}> {
  const { repoDir } = await ensureProjectRepository(rawProjectId);
  const currRes = await execGitSafe(
    repoDir,
    ["rev-parse", "--abbrev-ref", "HEAD"],
    undefined,
    true
  );
  const currentBranch = currRes.stdout.trim() || "main";

  const localRes = await execGitSafe(
    repoDir,
    ["for-each-ref", "--format=%(refname:short)", "refs/heads/"],
    undefined,
    true
  );
  const remoteRes = await execGitSafe(
    repoDir,
    ["for-each-ref", "--format=%(refname:short)", "refs/remotes/origin/"],
    undefined,
    true
  );

  const map = new Map<string, { name: string; isCurrent: boolean; isRemote: boolean }>();
  for (const raw of localRes.stdout.split(/\r?\n/)) {
    const name = raw.trim();
    if (!name) continue;
    map.set(name, { name, isCurrent: name === currentBranch, isRemote: false });
  }
  for (const raw of remoteRes.stdout.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "origin/HEAD" || trimmed === "origin") continue;
    const shortName = trimmed.replace(/^origin\//, "");
    if (!shortName || shortName === "HEAD" || map.has(shortName)) continue;
    map.set(shortName, { name: shortName, isCurrent: false, isRemote: true });
  }

  if (!map.has(currentBranch)) {
    map.set(currentBranch, { name: currentBranch, isCurrent: true, isRemote: false });
  }

  return { currentBranch, branches: Array.from(map.values()) };
}

export async function checkoutProjectBranch(
  rawProjectId: string,
  rawBranch: string,
  createNew: boolean,
  actor: AuthUser
): Promise<{ branch: string }> {
  const projectId = sanitizeProjectId(rawProjectId);
  return withProjectGitLock(projectId, async () => {
    const { repoDir } = await ensureProjectRepository(projectId);
    const safeBranch = sanitizeGitRef(rawBranch);

    if (createNew) {
      await execGitSafe(repoDir, ["checkout", "-b", safeBranch], actor);
      return { branch: safeBranch };
    }

    const localCheck = await execGitSafe(
      repoDir,
      ["show-ref", "--verify", "--quiet", `refs/heads/${safeBranch}`],
      actor,
      true
    );
    if (localCheck.exitCode === 0) {
      await execGitSafe(repoDir, ["checkout", safeBranch], actor);
      return { branch: safeBranch };
    }

    const remoteCheck = await execGitSafe(
      repoDir,
      ["show-ref", "--verify", "--quiet", `refs/remotes/origin/${safeBranch}`],
      actor,
      true
    );
    if (remoteCheck.exitCode === 0) {
      await execGitSafe(
        repoDir,
        ["checkout", "-b", safeBranch, "--track", `origin/${safeBranch}`],
        actor
      );
      return { branch: safeBranch };
    }

    await execGitSafe(repoDir, ["checkout", safeBranch], actor);
    return { branch: safeBranch };
  });
}

export async function commitWorkingProjectChanges(
  rawProjectId: string,
  message: string,
  pushAfter: boolean,
  actor: AuthUser
): Promise<{ committed: boolean; commitSha: string; pushed: boolean }> {
  const projectId = sanitizeProjectId(rawProjectId);
  const cleanMsg = (message || "").trim();
  if (!cleanMsg) {
    throw new HttpError(400, "Commit message cannot be empty", "EMPTY_COMMIT_MESSAGE");
  }

  return withProjectGitLock(projectId, async () => {
    const { repoDir } = await ensureProjectRepository(projectId);
    await execGitSafe(repoDir, ["add", "-A"], actor);
    const status = await execGitSafe(repoDir, ["status", "--porcelain"], actor);
    let committed = false;
    if (status.stdout.trim()) {
      await execGitSafe(repoDir, ["commit", "-m", cleanMsg], actor);
      committed = true;
    }

    const head = await execGitSafe(repoDir, ["rev-parse", "--short", "HEAD"], actor, true);
    let pushed = false;
    if (pushAfter) {
      const syncRes = await syncProjectGitRemote(projectId, { direction: "push" }, actor);
      pushed = syncRes.ok;
    }

    return { committed, commitSha: head.stdout.trim(), pushed };
  });
}

export async function getProjectFileGitHistory(
  rawProjectId: string,
  rawFilePath?: string,
  limit = 25
): Promise<ServerCommitEntry[]> {
  const { repoDir } = await ensureProjectRepository(rawProjectId);
  const capped = Math.max(1, Math.min(100, limit));
  const args = ["log", `-n`, String(capped), "--pretty=format:%h%x09%an%x09%aI%x09%s"];
  if (rawFilePath && rawFilePath.trim()) {
    const { cleanRelPath } = sanitizeRepoRelativePath(repoDir, rawFilePath);
    args.push("--", cleanRelPath);
  }
  const res = await execGitSafe(repoDir, args, undefined, true);
  return res.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash = "", author = "", date = "", message = ""] = line.split("\t");
      return { hash, author, date, message };
    });
}

export async function getProjectFileAtCommit(
  rawProjectId: string,
  rawSha: string,
  rawFilePath: string
): Promise<string> {
  const { repoDir } = await ensureProjectRepository(rawProjectId);
  const safeSha = sanitizeGitRef(rawSha);
  const { cleanRelPath } = sanitizeRepoRelativePath(repoDir, rawFilePath);
  const res = await execGitSafe(repoDir, ["show", `${safeSha}:${cleanRelPath}`], undefined, true);
  if (res.exitCode !== 0) {
    throw new HttpError(404, `File '${cleanRelPath}' not found at commit '${safeSha}'`, "NOT_FOUND");
  }
  return res.stdout;
}
