import fs from "node:fs/promises";
import path from "node:path";
import { HttpError, inferAssetMimeType } from "../httpHelpers.js";
import type { AuthUser, PublicProjectSummary } from "../types.js";
import {
  canUserAccessProject,
  listStoredProjectRecords,
  toPublicProjectSummary,
} from "./gitCredentialsStore.js";
import {
  execGitSafe,
  getReposBaseDir,
  resolveProjectDir,
  sanitizeProjectId,
  sanitizeRepoRelativePath,
} from "./gitSanitizer.js";

export {
  getProjectGitStatus,
  inspectProjectConflicts,
  resolveProjectConflictFile,
  syncProjectGitRemote,
  type ConflictFileVersions,
  type ServerCommitEntry,
} from "./gitSyncAndConflicts.js";

export interface ServerWorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

const SYSTEM_GIT_AUTHOR = {
  username: "mdteam-bot",
  displayName: "MDTeam System",
  email: "system@mdteam.local",
};

const STARTER_README = `---
title: "MDTeam Shared Server Repository"
review_status: "approved"
updated_at: "2026-06-09"
---

# MDTeam Collaborative Repository

This Git-backed multi-user workspace is managed by **MDTeam Server Git-Bridge**.
All Markdown documents (\`arc42/\`, \`adrs/\`, \`issues/\`, \`sprints/\`, \`wiki/\`) and binary \`assets/\` are versioned in Git with authenticated author attribution.
`;

export async function ensureProjectRepository(rawProjectId: string): Promise<{
  projectId: string;
  repoDir: string;
}> {
  const projectId = sanitizeProjectId(rawProjectId);
  const repoDir = resolveProjectDir(projectId);
  const gitDir = path.join(repoDir, ".git");

  try {
    const stat = await fs.stat(gitDir);
    if (stat.isDirectory()) {
      return { projectId, repoDir };
    }
  } catch {
    // Initialize fresh repository below
  }

  await fs.mkdir(repoDir, { recursive: true });
  await execGitSafe(repoDir, ["init"]);
  await execGitSafe(repoDir, ["config", "user.name", SYSTEM_GIT_AUTHOR.displayName]);
  await execGitSafe(repoDir, ["config", "user.email", SYSTEM_GIT_AUTHOR.email]);

  const welcomeDir = path.join(repoDir, "wiki");
  await fs.mkdir(welcomeDir, { recursive: true });
  const welcomeFile = path.join(welcomeDir, "welcome.md");
  try {
    await fs.access(welcomeFile);
  } catch {
    await fs.writeFile(welcomeFile, STARTER_README, "utf8");
  }

  await execGitSafe(repoDir, ["add", "--", "."]);
  const status = await execGitSafe(repoDir, ["status", "--porcelain"]);
  if (status.stdout.trim()) {
    await execGitSafe(
      repoDir,
      ["commit", "-m", "chore: initialize MDTeam project repository"],
      SYSTEM_GIT_AUTHOR
    );
  }

  return { projectId, repoDir };
}

const IGNORED_SCAN_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "out",
  "target",
  "vendor",
  ".venv",
  "venv",
  "__pycache__",
  ".cache",
]);

export async function listAvailableProjects(): Promise<string[]> {
  const baseDir = getReposBaseDir();
  await fs.mkdir(baseDir, { recursive: true });
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const ids = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();

  if (ids.length === 0) {
    await ensureProjectRepository("default");
    return ["default"];
  }
  return ids;
}

export async function listAccessibleProjectsForUser(user: AuthUser): Promise<{
  projects: string[];
  projectDetails: PublicProjectSummary[];
}> {
  const allIds = await listAvailableProjects();
  const storedMap = await listStoredProjectRecords();
  const visibleIds: string[] = [];
  const details: PublicProjectSummary[] = [];

  for (const id of allIds) {
    const rec = storedMap[id] || null;
    if (!canUserAccessProject(rec, user)) continue;
    visibleIds.push(id);
    if (rec) {
      details.push(toPublicProjectSummary(rec));
    } else {
      const repoDir = resolveProjectDir(id);
      const rem = await execGitSafe(repoDir, ["remote", "get-url", "origin"], undefined, true);
      const br = await execGitSafe(repoDir, ["rev-parse", "--abbrev-ref", "HEAD"], undefined, true);
      details.push({
        projectId: id,
        displayName: id,
        remoteUrl: rem.exitCode === 0 ? rem.stdout.trim() : "",
        authType: "none",
        httpsUsername: "",
        hasToken: false,
        hasSshKey: false,
        sshPublicKey: "",
        defaultBranch: br.stdout.trim() || "main",
        visibility: "team",
        ownerId: "",
        ownerHandle: "",
        createdAt: "",
      });
    }
  }

  return { projects: visibleIds, projectDetails: details };
}

async function walkProjectTree(
  rootDir: string,
  currentDir: string,
  filesOut: ServerWorkspaceFile[],
  assetsOut: string[]
): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink() || IGNORED_SCAN_DIRS.has(entry.name)) continue;
    const absPath = path.join(currentDir, entry.name);
    const relPath = path.relative(rootDir, absPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      await walkProjectTree(rootDir, absPath, filesOut, assetsOut);
      continue;
    }

    if (!entry.isFile()) continue;
    if (relPath.startsWith("assets/")) {
      assetsOut.push(relPath);
      continue;
    }

    const lower = entry.name.toLowerCase();
    if (lower.endsWith(".md") || (relPath.startsWith(".mdteam/") && lower.endsWith(".json"))) {
      const stat = await fs.stat(absPath).catch(() => null);
      if (stat && stat.size > 2 * 1024 * 1024) continue;
      const content = await fs.readFile(absPath, "utf8");
      const slashIdx = relPath.lastIndexOf("/");
      const category = slashIdx !== -1 ? relPath.slice(0, slashIdx) : "other";
      filesOut.push({
        path: relPath,
        name: entry.name,
        category,
        content,
      });
    }
  }
}

export async function listProjectFilesAndAssets(rawProjectId: string): Promise<{
  projectId: string;
  files: ServerWorkspaceFile[];
  assets: string[];
}> {
  const { projectId, repoDir } = await ensureProjectRepository(rawProjectId);
  const files: ServerWorkspaceFile[] = [];
  const assets: string[] = [];
  await walkProjectTree(repoDir, repoDir, files, assets);
  files.sort((a, b) => a.path.localeCompare(b.path));
  assets.sort();
  return { projectId, files, assets };
}

export async function readProjectTextFileIfExists(
  rawProjectId: string,
  rawRelPath: string
): Promise<string | null> {
  const { repoDir } = await ensureProjectRepository(rawProjectId);
  const { absolutePath } = sanitizeRepoRelativePath(repoDir, rawRelPath);
  try {
    return await fs.readFile(absolutePath, "utf8");
  } catch {
    return null;
  }
}

export async function upsertProjectTextFile(
  rawProjectId: string,
  rawRelPath: string,
  content: string,
  author: AuthUser,
  customMessage?: string
): Promise<{ file: ServerWorkspaceFile; committed: boolean; commitSha: string }> {
  const { repoDir } = await ensureProjectRepository(rawProjectId);
  const { cleanRelPath, absolutePath } = sanitizeRepoRelativePath(repoDir, rawRelPath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");

  await execGitSafe(repoDir, ["add", "--", cleanRelPath], author);
  const statusRes = await execGitSafe(repoDir, [
    "status",
    "--porcelain",
    "--",
    cleanRelPath,
  ]);

  let committed = false;
  if (statusRes.stdout.trim().length > 0) {
    const msg =
      (customMessage || "").trim() ||
      `docs(${cleanRelPath}): update by ${author.handle || author.username}`;
    await execGitSafe(repoDir, ["commit", "-m", msg, "--", cleanRelPath], author);
    committed = true;
  }

  const headRes = await execGitSafe(repoDir, ["rev-parse", "--short", "HEAD"], author, true);
  const slashIdx = cleanRelPath.lastIndexOf("/");
  return {
    file: {
      path: cleanRelPath,
      name: slashIdx !== -1 ? cleanRelPath.slice(slashIdx + 1) : cleanRelPath,
      category: slashIdx !== -1 ? cleanRelPath.slice(0, slashIdx) : "other",
      content,
    },
    committed,
    commitSha: headRes.stdout.trim(),
  };
}

export async function deleteProjectFile(
  rawProjectId: string,
  rawRelPath: string,
  author: AuthUser,
  customMessage?: string
): Promise<{ deletedPath: string; committed: boolean }> {
  const { repoDir } = await ensureProjectRepository(rawProjectId);
  const { cleanRelPath, absolutePath } = sanitizeRepoRelativePath(repoDir, rawRelPath);

  try {
    await fs.access(absolutePath);
  } catch {
    throw new HttpError(404, `File '${cleanRelPath}' does not exist`, "FILE_NOT_FOUND");
  }

  const rmRes = await execGitSafe(
    repoDir,
    ["rm", "-f", "--", cleanRelPath],
    author,
    true
  );
  if (rmRes.exitCode !== 0) {
    await fs.unlink(absolutePath);
    await execGitSafe(repoDir, ["add", "-A", "--", cleanRelPath], author, true);
  }

  const statusRes = await execGitSafe(repoDir, [
    "status",
    "--porcelain",
    "--",
    cleanRelPath,
  ]);
  let committed = false;
  if (statusRes.stdout.trim().length > 0) {
    const msg =
      (customMessage || "").trim() ||
      `chore(${cleanRelPath}): delete by ${author.handle || author.username}`;
    await execGitSafe(repoDir, ["commit", "-m", msg], author);
    committed = true;
  }

  return { deletedPath: cleanRelPath, committed };
}

export async function uploadProjectBinaryAsset(
  rawProjectId: string,
  rawAssetPath: string,
  base64Payload: string,
  author: AuthUser
): Promise<{ assetPath: string; sizeBytes: number; commitSha: string }> {
  const { repoDir } = await ensureProjectRepository(rawProjectId);
  const normalizedTarget = rawAssetPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const prefixedPath = normalizedTarget.startsWith("assets/")
    ? normalizedTarget
    : `assets/${normalizedTarget}`;

  const { cleanRelPath, absolutePath } = sanitizeRepoRelativePath(repoDir, prefixedPath);
  const strippedBase64 = base64Payload.replace(/^data:[^;]+;base64,/, "").trim();
  if (!strippedBase64) {
    throw new HttpError(400, "Empty base64 asset payload", "EMPTY_ASSET");
  }

  const binaryBuffer = Buffer.from(strippedBase64, "base64");
  if (binaryBuffer.length > 12 * 1024 * 1024) {
    throw new HttpError(413, "Binary asset exceeds 12 MB limit", "ASSET_TOO_LARGE");
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, binaryBuffer);

  await execGitSafe(repoDir, ["add", "--", cleanRelPath], author);
  const statusRes = await execGitSafe(repoDir, [
    "status",
    "--porcelain",
    "--",
    cleanRelPath,
  ]);
  if (statusRes.stdout.trim()) {
    await execGitSafe(
      repoDir,
      ["commit", "-m", `asset(${cleanRelPath}): upload by ${author.handle}`],
      author
    );
  }
  const headRes = await execGitSafe(repoDir, ["rev-parse", "--short", "HEAD"], author, true);

  return {
    assetPath: cleanRelPath,
    sizeBytes: binaryBuffer.length,
    commitSha: headRes.stdout.trim(),
  };
}

export async function readProjectBinaryAsset(
  rawProjectId: string,
  rawAssetSubpath: string
): Promise<{ buffer: Buffer; mimeType: string; assetPath: string }> {
  const { repoDir } = await ensureProjectRepository(rawProjectId);
  const cleanSub = rawAssetSubpath.replace(/\\/g, "/").replace(/^\/+/, "");
  const fullRel = cleanSub.startsWith("assets/") ? cleanSub : `assets/${cleanSub}`;
  const { cleanRelPath, absolutePath } = sanitizeRepoRelativePath(repoDir, fullRel);

  try {
    const buffer = await fs.readFile(absolutePath);
    return {
      buffer,
      mimeType: inferAssetMimeType(cleanRelPath),
      assetPath: cleanRelPath,
    };
  } catch {
    throw new HttpError(404, `Asset '${cleanRelPath}' not found`, "ASSET_NOT_FOUND");
  }
}
