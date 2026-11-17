import fs from "node:fs/promises";
import path from "node:path";
import { HttpError } from "../httpHelpers.js";
import type { AuthUser } from "../types.js";
import {
  execGitSafe,
  sanitizeGitRef,
  sanitizeRemoteUrl,
  sanitizeRepoRelativePath,
} from "./gitSanitizer.js";
import { ensureProjectRepository } from "./serverGitBridge.js";

export interface ServerCommitEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface ConflictFileVersions {
  path: string;
  base: string;
  ours: string;
  theirs: string;
  working: string;
}

export async function getProjectGitStatus(rawProjectId: string): Promise<{
  projectId: string;
  branch: string;
  headSha: string;
  remoteUrl: string;
  ahead: number;
  behind: number;
  modified: string[];
  untracked: string[];
  conflicts: string[];
  recentCommits: ServerCommitEntry[];
}> {
  const { projectId, repoDir } = await ensureProjectRepository(rawProjectId);

  const branchRes = await execGitSafe(
    repoDir,
    ["rev-parse", "--abbrev-ref", "HEAD"],
    undefined,
    true
  );
  const headRes = await execGitSafe(
    repoDir,
    ["rev-parse", "--short", "HEAD"],
    undefined,
    true
  );
  const remoteRes = await execGitSafe(
    repoDir,
    ["remote", "get-url", "origin"],
    undefined,
    true
  );
  const porcelain = await execGitSafe(repoDir, ["status", "--porcelain"]);
  const conflictRes = await execGitSafe(
    repoDir,
    ["diff", "--name-only", "--diff-filter=U"],
    undefined,
    true
  );

  const modified: string[] = [];
  const untracked: string[] = [];
  for (const line of porcelain.stdout.split(/\r?\n/)) {
    if (line.length < 4) continue;
    const xy = line.slice(0, 2);
    const file = line.slice(3).trim();
    if (xy === "??") untracked.push(file);
    else modified.push(file);
  }

  let ahead = 0;
  let behind = 0;
  const countsRes = await execGitSafe(
    repoDir,
    ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    undefined,
    true
  );
  if (countsRes.exitCode === 0) {
    const parts = countsRes.stdout.trim().split(/\s+/);
    ahead = Number.parseInt(parts[0] || "0", 10) || 0;
    behind = Number.parseInt(parts[1] || "0", 10) || 0;
  }

  const logRes = await execGitSafe(
    repoDir,
    ["log", "-n", "15", "--pretty=format:%h%x09%an%x09%aI%x09%s"],
    undefined,
    true
  );
  const recentCommits: ServerCommitEntry[] = logRes.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash = "", author = "", date = "", message = ""] = line.split("\t");
      return { hash, author, date, message };
    });

  return {
    projectId,
    branch: branchRes.stdout.trim() || "master",
    headSha: headRes.stdout.trim(),
    remoteUrl: remoteRes.exitCode === 0 ? remoteRes.stdout.trim() : "",
    ahead,
    behind,
    modified,
    untracked,
    conflicts: conflictRes.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    recentCommits,
  };
}

export async function syncProjectGitRemote(
  rawProjectId: string,
  options: { remoteUrl?: string; branch?: string; direction?: "pull" | "push" | "both" },
  author: AuthUser
): Promise<{
  ok: boolean;
  hasConflicts: boolean;
  conflicts: string[];
  message: string;
}> {
  const { repoDir } = await ensureProjectRepository(rawProjectId);

  if (options.remoteUrl) {
    const cleanUrl = sanitizeRemoteUrl(options.remoteUrl);
    const existing = await execGitSafe(
      repoDir,
      ["remote", "get-url", "origin"],
      author,
      true
    );
    if (existing.exitCode === 0) {
      await execGitSafe(repoDir, ["remote", "set-url", "origin", cleanUrl], author);
    } else {
      await execGitSafe(repoDir, ["remote", "add", "origin", cleanUrl], author);
    }
  }

  const remoteCheck = await execGitSafe(
    repoDir,
    ["remote", "get-url", "origin"],
    author,
    true
  );
  if (remoteCheck.exitCode !== 0 || !remoteCheck.stdout.trim()) {
    return {
      ok: true,
      hasConflicts: false,
      conflicts: [],
      message: "Local Git commit state verified (no remote 'origin' configured yet).",
    };
  }

  const branchRes = await execGitSafe(repoDir, ["rev-parse", "--abbrev-ref", "HEAD"], author);
  const targetBranch = options.branch
    ? sanitizeGitRef(options.branch)
    : sanitizeGitRef(branchRes.stdout.trim() || "master");
  const direction = options.direction || "both";

  if (direction === "pull" || direction === "both") {
    const pullRes = await execGitSafe(
      repoDir,
      ["pull", "--no-rebase", "origin", targetBranch],
      author,
      true
    );
    const conflictCheck = await execGitSafe(
      repoDir,
      ["diff", "--name-only", "--diff-filter=U"],
      author,
      true
    );
    const conflicts = conflictCheck.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (conflicts.length > 0) {
      return {
        ok: false,
        hasConflicts: true,
        conflicts,
        message: `Merge conflicts detected in ${conflicts.length} file(s)`,
      };
    }
    if (pullRes.exitCode !== 0 && !pullRes.stderr.includes("couldn't find remote ref")) {
      throw new HttpError(
        502,
        `Git pull failed: ${pullRes.stderr.trim() || pullRes.stdout.trim()}`,
        "GIT_PULL_FAILED"
      );
    }
  }

  if (direction === "push" || direction === "both") {
    const pushRes = await execGitSafe(
      repoDir,
      ["push", "-u", "origin", targetBranch],
      author,
      true
    );
    if (pushRes.exitCode !== 0) {
      throw new HttpError(
        502,
        `Git push failed: ${pushRes.stderr.trim() || pushRes.stdout.trim()}`,
        "GIT_PUSH_FAILED"
      );
    }
  }

  return {
    ok: true,
    hasConflicts: false,
    conflicts: [],
    message: `Synchronized branch '${targetBranch}' with origin.`,
  };
}

export async function inspectProjectConflicts(
  rawProjectId: string,
  specificFile?: string
): Promise<{
  conflicts: string[];
  items: ConflictFileVersions[];
}> {
  const { repoDir } = await ensureProjectRepository(rawProjectId);
  const diffRes = await execGitSafe(
    repoDir,
    ["diff", "--name-only", "--diff-filter=U"],
    undefined,
    true
  );
  const conflictPaths = diffRes.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const targetPaths = specificFile
    ? [sanitizeRepoRelativePath(repoDir, specificFile).cleanRelPath]
    : conflictPaths;

  const items: ConflictFileVersions[] = [];
  for (const relPath of targetPaths) {
    const { cleanRelPath, absolutePath } = sanitizeRepoRelativePath(repoDir, relPath);
    const [baseRes, oursRes, theirsRes] = await Promise.all([
      execGitSafe(repoDir, ["show", `:1:${cleanRelPath}`], undefined, true),
      execGitSafe(repoDir, ["show", `:2:${cleanRelPath}`], undefined, true),
      execGitSafe(repoDir, ["show", `:3:${cleanRelPath}`], undefined, true),
    ]);
    let working = "";
    try {
      working = await fs.readFile(absolutePath, "utf8");
    } catch {
      working = "";
    }
    items.push({
      path: cleanRelPath,
      base: baseRes.exitCode === 0 ? baseRes.stdout : "",
      ours: oursRes.exitCode === 0 ? oursRes.stdout : working,
      theirs: theirsRes.exitCode === 0 ? theirsRes.stdout : "",
      working,
    });
  }

  return { conflicts: conflictPaths, items };
}

export async function resolveProjectConflictFile(
  rawProjectId: string,
  rawRelPath: string,
  resolvedContent: string,
  author: AuthUser,
  autoCommit = true
): Promise<{ resolvedPath: string; remainingConflicts: string[]; committed: boolean }> {
  if (/^<{7}\s/m.test(resolvedContent) || /^>{7}\s/m.test(resolvedContent)) {
    throw new HttpError(
      400,
      "Resolved content still contains unresolved Git conflict markers (<<<<<<< / >>>>>>>)",
      "UNRESOLVED_MARKERS"
    );
  }

  const { repoDir } = await ensureProjectRepository(rawProjectId);
  const { cleanRelPath, absolutePath } = sanitizeRepoRelativePath(repoDir, rawRelPath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, resolvedContent, "utf8");
  await execGitSafe(repoDir, ["add", "--", cleanRelPath], author);

  const remRes = await execGitSafe(
    repoDir,
    ["diff", "--name-only", "--diff-filter=U"],
    author,
    true
  );
  const remainingConflicts = remRes.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  let committed = false;
  if (autoCommit && remainingConflicts.length === 0) {
    const status = await execGitSafe(repoDir, ["status", "--porcelain"], author);
    if (status.stdout.trim()) {
      await execGitSafe(
        repoDir,
        [
          "commit",
          "-m",
          `merge(${cleanRelPath}): resolve conflict by ${author.handle || author.username}`,
        ],
        author
      );
      committed = true;
    }
  }

  return { resolvedPath: cleanRelPath, remainingConflicts, committed };
}
