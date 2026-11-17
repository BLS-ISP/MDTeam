import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { HttpError } from "../httpHelpers.js";
import type {
  AuthUser,
  GitAuthType,
  ProjectVisibility,
  PublicProjectSummary,
} from "../types.js";
import {
  decryptGitSecret,
  extractEmbeddedUrlCredentials,
  generateEd25519OpenSshKeyPair,
  getStoredProjectRecord,
  prepareGitAuthExecution,
  removeStoredProjectRecord,
  toPublicProjectSummary,
  upsertStoredProjectRecord,
} from "./gitCredentialsStore.js";
import { withProjectGitLock } from "./gitMutex.js";
import {
  execGitSafe,
  getReposBaseDir,
  resolveProjectDir,
  sanitizeGitRef,
  sanitizeProjectId,
  validateRemoteUrlWithDns,
} from "./gitSanitizer.js";
import { ensureProjectRepository, listProjectFilesAndAssets } from "./serverGitBridge.js";

export interface RemoteTestInput {
  remoteUrl: string;
  projectId?: string;
  authType?: GitAuthType;
  httpsUsername?: string;
  httpsToken?: string;
  sshPrivateKey?: string;
}

export function generatePreCloneSshKeyPair(comment?: string): {
  sshPublicKey: string;
  sshPrivateKey: string;
} {
  const safeComment =
    (comment || "").replace(/[\r\n\0]/g, "").trim().slice(0, 80) || "mdteam-deploy-key";
  const { publicKey, privateKeyPem } = generateEd25519OpenSshKeyPair(safeComment);
  return { sshPublicKey: publicKey, sshPrivateKey: privateKeyPem };
}

export async function testGitRemoteConnection(input: RemoteTestInput): Promise<{
  ok: boolean;
  cleanUrl: string;
  defaultBranch: string;
  branches: string[];
}> {
  const { cleanUrl, extractedUser, extractedToken } = extractEmbeddedUrlCredentials(
    input.remoteUrl
  );
  const validatedUrl = await validateRemoteUrlWithDns(cleanUrl);
  if (!validatedUrl) {
    throw new HttpError(400, "Git remote URL is required", "MISSING_REMOTE_URL");
  }

  const stored = input.projectId ? await getStoredProjectRecord(input.projectId) : null;
  const effectiveToken =
    extractedToken ||
    input.httpsToken ||
    (stored?.encryptedToken ? decryptGitSecret(stored.encryptedToken) : "");
  const effectiveUser =
    extractedUser || input.httpsUsername || stored?.httpsUsername || "x-access-token";
  const effectiveSshKey =
    input.sshPrivateKey ||
    (stored?.encryptedSshPrivateKey ? decryptGitSecret(stored.encryptedSshPrivateKey) : "");
  const effectiveAuthType: GitAuthType =
    extractedToken || input.httpsToken
      ? "https"
      : input.sshPrivateKey
      ? "ssh"
      : input.authType || stored?.authType || "none";

  const authCtx = await prepareGitAuthExecution({
    remoteUrl: validatedUrl,
    authType: effectiveAuthType,
    httpsUsername: effectiveUser,
    httpsToken: effectiveToken,
    sshPrivateKey: effectiveSshKey,
  });

  try {
    const res = await execGitSafe(
      os.tmpdir(),
      [...authCtx.gitConfigArgs, "ls-remote", "--symref", validatedUrl, "HEAD", "refs/heads/*"],
      undefined,
      true,
      authCtx.extraEnv
    );
    if (res.exitCode !== 0) {
      const cleanErr = authCtx.redactSecrets(res.stderr.trim() || res.stdout.trim());
      const isAuthErr = /authentication|401|403|denied|publickey|could not read username/i.test(
        cleanErr
      );
      throw new HttpError(
        isAuthErr ? 401 : 502,
        `Remote Git check failed: ${cleanErr || "Repository unreachable"}`,
        isAuthErr ? "GIT_AUTH_FAILED" : "GIT_REMOTE_UNREACHABLE"
      );
    }

    let defaultBranch = "";
    const branchSet = new Set<string>();
    for (const line of res.stdout.split(/\r?\n/)) {
      const symMatch = line.match(/^ref:\s+refs\/heads\/([^\s]+)\s+HEAD$/);
      if (symMatch) {
        defaultBranch = symMatch[1];
        continue;
      }
      const headMatch = line.match(/^[0-9a-f]+\s+refs\/heads\/(.+)$/i);
      if (headMatch) {
        branchSet.add(headMatch[1].trim());
      }
    }

    const branches = Array.from(branchSet).sort();
    if (!defaultBranch) {
      defaultBranch = branches.includes("main")
        ? "main"
        : branches.includes("master")
        ? "master"
        : branches[0] || "main";
    }

    return { ok: true, cleanUrl: validatedUrl, defaultBranch, branches };
  } finally {
    await authCtx.cleanup();
  }
}

async function scaffoldMissingMdTeamDocs(repoDir: string, author: AuthUser): Promise<boolean> {
  const starterDocs: Array<{ rel: string; content: string }> = [
    {
      rel: "wiki/welcome.md",
      content:
        '---\ntitle: "Project Wiki Home"\nreview_status: "draft"\n---\n\n# Project Wiki\n\nCollaborative documentation linked directly to this Git repository.\n',
    },
    {
      rel: "management/product-goal.md",
      content:
        "# Product Goal & Vision\n\nDefine your overarching Scrum Product Goal and measurable outcomes here.\n",
    },
  ];

  const writtenPaths: string[] = [];
  for (const item of starterDocs) {
    const abs = path.join(repoDir, item.rel);
    const exists = await fs
      .access(abs)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, item.content, "utf8");
      writtenPaths.push(item.rel);
    }
  }

  if (writtenPaths.length === 0) return false;
  await execGitSafe(repoDir, ["add", "--", ...writtenPaths], author);
  const st = await execGitSafe(repoDir, ["status", "--porcelain", "--", ...writtenPaths], author);
  if (st.stdout.trim()) {
    await execGitSafe(
      repoDir,
      ["commit", "-m", "chore(mdteam): initialize agile workspace docs", "--", ...writtenPaths],
      author
    );
    return true;
  }
  return false;
}

export interface CloneProjectInput {
  projectId: string;
  displayName?: string;
  remoteUrl: string;
  branch?: string;
  authType?: GitAuthType;
  httpsUsername?: string;
  httpsToken?: string;
  sshPrivateKey?: string;
  sshPublicKey?: string;
  scaffoldMdTeam?: boolean;
  visibility?: ProjectVisibility;
}

export async function cloneRemoteProjectRepository(
  input: CloneProjectInput,
  actor: AuthUser
): Promise<{ project: PublicProjectSummary; filesCount: number; activeBranch: string }> {
  const projectId = sanitizeProjectId(input.projectId);
  const repoDir = resolveProjectDir(projectId);

  return withProjectGitLock(projectId, async () => {
    const alreadyExists = await fs
      .stat(repoDir)
      .then(() => true)
      .catch(() => false);
    if (alreadyExists) {
      throw new HttpError(
        409,
        `A project workspace named '${projectId}' already exists on this server`,
        "PROJECT_EXISTS"
      );
    }

    const { cleanUrl, extractedUser, extractedToken } = extractEmbeddedUrlCredentials(
      input.remoteUrl
    );
    const validatedUrl = await validateRemoteUrlWithDns(cleanUrl);
    if (!validatedUrl) {
      throw new HttpError(400, "Valid Git remote URL is required to clone", "MISSING_REMOTE_URL");
    }

    const effectiveToken = (extractedToken || input.httpsToken || "").trim();
    const effectiveUser =
      (extractedUser || input.httpsUsername || "").trim() ||
      (effectiveToken ? "x-access-token" : "");
    const effectiveAuthType: GitAuthType = effectiveToken
      ? "https"
      : input.sshPrivateKey
      ? "ssh"
      : input.authType || "none";
    const effectiveSshPub =
      effectiveAuthType === "ssh" && input.sshPublicKey
        ? input.sshPublicKey.replace(/[\r\n\0]/g, "").trim()
        : undefined;

    const authCtx = await prepareGitAuthExecution({
      remoteUrl: validatedUrl,
      authType: effectiveAuthType,
      httpsUsername: effectiveUser,
      httpsToken: effectiveToken,
      sshPrivateKey: input.sshPrivateKey,
    });

    await fs.mkdir(getReposBaseDir(), { recursive: true });

    try {
      const cloneArgs = [...authCtx.gitConfigArgs, "clone"];
      if (input.branch && input.branch.trim()) {
        cloneArgs.push("--branch", sanitizeGitRef(input.branch.trim()));
      }
      cloneArgs.push("--", validatedUrl, repoDir);

      const cloneRes = await execGitSafe(
        getReposBaseDir(),
        cloneArgs,
        actor,
        true,
        authCtx.extraEnv
      );
      if (cloneRes.exitCode !== 0) {
        await fs.rm(repoDir, { recursive: true, force: true }).catch(() => undefined);
        const cleanErr = authCtx.redactSecrets(cloneRes.stderr.trim() || cloneRes.stdout.trim());
        throw new HttpError(502, `Git clone failed: ${cleanErr}`, "GIT_CLONE_FAILED");
      }

      await execGitSafe(repoDir, ["config", "user.name", actor.displayName || actor.username]);
      await execGitSafe(
        repoDir,
        ["config", "user.email", actor.email || `${actor.username}@mdteam.local`]
      );

      if (input.scaffoldMdTeam) {
        await scaffoldMissingMdTeamDocs(repoDir, actor);
      }

      const branchOut = await execGitSafe(repoDir, ["rev-parse", "--abbrev-ref", "HEAD"], actor, true);
      const activeBranch = branchOut.stdout.trim() || input.branch?.trim() || "main";

      const stored = await upsertStoredProjectRecord(
        projectId,
        {
          displayName: (input.displayName || "").trim() || projectId,
          remoteUrl: validatedUrl,
          authType: effectiveAuthType,
          httpsUsername: effectiveUser,
          httpsToken: effectiveToken || undefined,
          sshPrivateKey: input.sshPrivateKey || undefined,
          sshPublicKey: effectiveSshPub,
          defaultBranch: activeBranch,
          visibility: input.visibility === "private" ? "private" : "team",
        },
        actor
      );

      const listing = await listProjectFilesAndAssets(projectId);
      return {
        project: toPublicProjectSummary(stored),
        filesCount: listing.files.length,
        activeBranch,
      };
    } finally {
      await authCtx.cleanup();
    }
  });
}

export async function configureProjectGitRemote(
  rawProjectId: string,
  patch: {
    displayName?: string;
    remoteUrl?: string;
    authType?: GitAuthType;
    httpsUsername?: string;
    httpsToken?: string;
    clearToken?: boolean;
    visibility?: ProjectVisibility;
    scaffoldMdTeam?: boolean;
  },
  actor: AuthUser
): Promise<PublicProjectSummary> {
  const projectId = sanitizeProjectId(rawProjectId);
  return withProjectGitLock(projectId, async () => {
    const { repoDir } = await ensureProjectRepository(projectId);

    let nextRemoteUrl: string | undefined;
    let extractedUser = "";
    let extractedToken = "";

    if (typeof patch.remoteUrl === "string") {
      if (patch.remoteUrl.trim() === "") {
        await execGitSafe(repoDir, ["remote", "remove", "origin"], actor, true);
        nextRemoteUrl = "";
      } else {
        const ext = extractEmbeddedUrlCredentials(patch.remoteUrl);
        extractedUser = ext.extractedUser;
        extractedToken = ext.extractedToken;
        nextRemoteUrl = await validateRemoteUrlWithDns(ext.cleanUrl);
        const existing = await execGitSafe(repoDir, ["remote", "get-url", "origin"], actor, true);
        if (existing.exitCode === 0) {
          await execGitSafe(repoDir, ["remote", "set-url", "origin", nextRemoteUrl], actor);
        } else {
          await execGitSafe(repoDir, ["remote", "add", "origin", nextRemoteUrl], actor);
        }
      }
    }

    if (patch.scaffoldMdTeam) {
      await scaffoldMissingMdTeamDocs(repoDir, actor);
    }

    const saved = await upsertStoredProjectRecord(
      projectId,
      {
        displayName: patch.displayName,
        remoteUrl: nextRemoteUrl,
        authType: extractedToken ? "https" : patch.authType,
        httpsUsername: extractedUser || patch.httpsUsername,
        httpsToken: extractedToken || patch.httpsToken,
        clearToken: patch.clearToken,
        visibility: patch.visibility,
      },
      actor
    );

    return toPublicProjectSummary(saved);
  });
}

export async function generateAndSaveProjectSshKey(
  rawProjectId: string,
  actor: AuthUser
): Promise<{ sshPublicKey: string; project: PublicProjectSummary }> {
  const projectId = sanitizeProjectId(rawProjectId);
  return withProjectGitLock(projectId, async () => {
    await ensureProjectRepository(projectId);
    const { publicKey, privateKeyPem } = generateEd25519OpenSshKeyPair(`mdteam@${projectId}`);
    const saved = await upsertStoredProjectRecord(
      projectId,
      { authType: "ssh", sshPublicKey: publicKey, sshPrivateKey: privateKeyPem },
      actor
    );
    return { sshPublicKey: publicKey, project: toPublicProjectSummary(saved) };
  });
}

export async function deleteProjectWorkspace(
  rawProjectId: string,
  actor: AuthUser
): Promise<{ deletedProjectId: string }> {
  const projectId = sanitizeProjectId(rawProjectId);
  if (projectId === "default") {
    throw new HttpError(400, "The default workspace cannot be deleted", "CANNOT_DELETE_DEFAULT");
  }

  return withProjectGitLock(projectId, async () => {
    const stored = await getStoredProjectRecord(projectId);
    if (actor.role !== "admin" && (!stored?.ownerId || stored.ownerId !== actor.id)) {
      throw new HttpError(
        403,
        "Only an administrator or the project creator can delete this workspace",
        "DELETE_PROJECT_FORBIDDEN"
      );
    }

    const baseDir = await fs.realpath(getReposBaseDir()).catch(() => path.resolve(getReposBaseDir()));
    const repoDir = resolveProjectDir(projectId);
    const stat = await fs.lstat(repoDir).catch(() => null);
    if (!stat) {
      await removeStoredProjectRecord(projectId);
      throw new HttpError(404, `Project '${projectId}' not found`, "PROJECT_NOT_FOUND");
    }
    if (stat.isSymbolicLink()) {
      throw new HttpError(400, "Refusing to delete symbolic link project path", "UNSAFE_DELETE");
    }
    const resolvedTarget = await fs.realpath(repoDir);
    if (!resolvedTarget.startsWith(baseDir + path.sep) || path.dirname(resolvedTarget) !== baseDir) {
      throw new HttpError(400, "Project path escapes repository root", "PATH_TRAVERSAL");
    }

    await fs.rm(resolvedTarget, { recursive: true, force: true });
    await removeStoredProjectRecord(projectId);
    return { deletedProjectId: projectId };
  });
}
