import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";
import { requireAuthenticatedUser, requireRoleAction } from "../auth/jwtSession.js";
import {
  checkoutProjectBranch,
  commitWorkingProjectChanges,
  getProjectFileAtCommit,
  getProjectFileGitHistory,
  listProjectBranches,
} from "../git/gitBranchesAndHistory.js";
import {
  cloneRemoteProjectRepository,
  configureProjectGitRemote,
  deleteProjectWorkspace,
  generateAndSaveProjectSshKey,
  testGitRemoteConnection,
} from "../git/gitCloneAndRemote.js";
import {
  assertProjectAccess,
  getStoredProjectRecord,
  toPublicProjectSummary,
} from "../git/gitCredentialsStore.js";
import { HttpError, readJsonBody, sendJson } from "../httpHelpers.js";
import type { GitAuthType, ProjectVisibility } from "../types.js";

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function handleProjectGitTopRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string
): Promise<boolean> {
  if (pathname === "/api/projects/git/test" && method === "POST") {
    const user = await requireRoleAction(req, res, "connect_git_repo");
    if (!user) return true;
    const body = await readJsonBody<{
      remoteUrl?: string;
      projectId?: string;
      authType?: GitAuthType;
      httpsUsername?: string;
      httpsToken?: string;
    }>(req);
    if (body.projectId) {
      await assertProjectAccess(body.projectId, user);
    }
    const result = await testGitRemoteConnection({
      remoteUrl: body.remoteUrl || "",
      projectId: body.projectId,
      authType: body.authType,
      httpsUsername: body.httpsUsername,
      httpsToken: body.httpsToken,
    });
    sendJson(res, 200, result);
    return true;
  }

  if (pathname === "/api/projects/clone" && method === "POST") {
    const user = await requireRoleAction(req, res, "connect_git_repo");
    if (!user) return true;
    const body = await readJsonBody<{
      projectId?: string;
      displayName?: string;
      remoteUrl?: string;
      branch?: string;
      authType?: GitAuthType;
      httpsUsername?: string;
      httpsToken?: string;
      sshPrivateKey?: string;
      scaffoldMdTeam?: boolean;
      visibility?: ProjectVisibility;
    }>(req);
    const cloned = await cloneRemoteProjectRepository(
      {
        projectId: body.projectId || "",
        displayName: body.displayName,
        remoteUrl: body.remoteUrl || "",
        branch: body.branch,
        authType: body.authType,
        httpsUsername: body.httpsUsername,
        httpsToken: body.httpsToken,
        sshPrivateKey: body.sshPrivateKey,
        scaffoldMdTeam: Boolean(body.scaffoldMdTeam),
        visibility: body.visibility,
      },
      user
    );
    sendJson(res, 201, cloned);
    return true;
  }

  const prefix = "/api/projects/";
  if (pathname.startsWith(prefix) && method === "DELETE") {
    const tail = pathname.slice(prefix.length).replace(/\/+$/, "");
    if (tail && !tail.includes("/")) {
      const user = await requireRoleAction(req, res, "connect_git_repo");
      if (!user) return true;
      const targetProjectId = safeDecode(tail);
      const deleted = await deleteProjectWorkspace(targetProjectId, user);
      sendJson(res, 200, deleted);
      return true;
    }
  }

  return false;
}

export async function handleProjectGitSubRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  projectId: string,
  subRoute: string,
  method: string
): Promise<boolean> {
  if (subRoute === "/git/remote" && method === "GET") {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return true;
    await assertProjectAccess(projectId, user);
    const stored = await getStoredProjectRecord(projectId);
    sendJson(res, 200, {
      project: stored
        ? toPublicProjectSummary(stored)
        : {
            projectId,
            displayName: projectId,
            remoteUrl: "",
            authType: "none",
            httpsUsername: "",
            hasToken: false,
            hasSshKey: false,
            sshPublicKey: "",
            defaultBranch: "main",
            visibility: "team",
            ownerId: "",
            ownerHandle: "",
            createdAt: "",
          },
    });
    return true;
  }

  if (subRoute === "/git/remote" && (method === "PUT" || method === "POST")) {
    const user = await requireRoleAction(req, res, "connect_git_repo");
    if (!user) return true;
    await assertProjectAccess(projectId, user);
    const body = await readJsonBody<{
      displayName?: string;
      remoteUrl?: string;
      authType?: GitAuthType;
      httpsUsername?: string;
      httpsToken?: string;
      clearToken?: boolean;
      visibility?: ProjectVisibility;
      scaffoldMdTeam?: boolean;
    }>(req);
    const updated = await configureProjectGitRemote(projectId, body, user);
    sendJson(res, 200, { project: updated });
    return true;
  }

  if (subRoute === "/git/ssh-key" && method === "POST") {
    const user = await requireRoleAction(req, res, "connect_git_repo");
    if (!user) return true;
    await assertProjectAccess(projectId, user);
    const generated = await generateAndSaveProjectSshKey(projectId, user);
    sendJson(res, 200, generated);
    return true;
  }

  if (subRoute === "/git/branches" && method === "GET") {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return true;
    await assertProjectAccess(projectId, user);
    const branches = await listProjectBranches(projectId);
    sendJson(res, 200, branches);
    return true;
  }

  if (subRoute === "/git/checkout" && method === "POST") {
    const user = await requireRoleAction(req, res, "connect_git_repo");
    if (!user) return true;
    await assertProjectAccess(projectId, user);
    const body = await readJsonBody<{ branch?: string; create?: boolean }>(req);
    const switched = await checkoutProjectBranch(
      projectId,
      body.branch || "",
      Boolean(body.create),
      user
    );
    sendJson(res, 200, switched);
    return true;
  }

  if (subRoute === "/git/commit" && method === "POST") {
    const user = await requireRoleAction(req, res, "edit_wiki");
    if (!user) return true;
    await assertProjectAccess(projectId, user);
    const body = await readJsonBody<{ message?: string; push?: boolean }>(req);
    const committed = await commitWorkingProjectChanges(
      projectId,
      body.message || "",
      Boolean(body.push),
      user
    );
    sendJson(res, 200, committed);
    return true;
  }

  if (subRoute === "/git/history" && method === "GET") {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return true;
    await assertProjectAccess(projectId, user);
    const filePath = url.searchParams.get("path") || undefined;
    const limit = Number.parseInt(url.searchParams.get("limit") || "25", 10) || 25;
    const commits = await getProjectFileGitHistory(projectId, filePath, limit);
    sendJson(res, 200, { commits });
    return true;
  }

  if (subRoute === "/git/file-at-commit" && method === "GET") {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return true;
    await assertProjectAccess(projectId, user);
    const sha = url.searchParams.get("sha") || "";
    const filePath = url.searchParams.get("path") || "";
    if (!sha || !filePath) {
      throw new HttpError(400, "Query params 'sha' and 'path' are required", "MISSING_PARAMS");
    }
    const content = await getProjectFileAtCommit(projectId, sha, filePath);
    sendJson(res, 200, { sha, path: filePath, content });
    return true;
  }

  return false;
}
