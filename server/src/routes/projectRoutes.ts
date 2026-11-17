import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";
import {
  enforceFileMutationPermission,
  requireAuthenticatedUser,
  requireRoleAction,
} from "../auth/jwtSession.js";
import {
  deleteProjectFile,
  ensureProjectRepository,
  getProjectGitStatus,
  inspectProjectConflicts,
  listAvailableProjects,
  listProjectFilesAndAssets,
  readProjectBinaryAsset,
  readProjectTextFileIfExists,
  resolveProjectConflictFile,
  syncProjectGitRemote,
  uploadProjectBinaryAsset,
  upsertProjectTextFile,
} from "../git/serverGitBridge.js";
import { HttpError, readJsonBody, sendError, sendJson } from "../httpHelpers.js";

function safeDecodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function handleProjectRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<boolean> {
  const pathname = url.pathname;
  const method = (req.method || "GET").toUpperCase();

  if (pathname === "/api/projects" || pathname === "/api/projects/") {
    if (method === "GET") {
      const user = await requireAuthenticatedUser(req, res);
      if (!user) return true;
      const projects = await listAvailableProjects();
      sendJson(res, 200, { projects });
      return true;
    }
    if (method === "POST") {
      const user = await requireRoleAction(req, res, "edit_wiki");
      if (!user) return true;
      const body = await readJsonBody<{ projectId?: string }>(req);
      const created = await ensureProjectRepository(body.projectId || "");
      sendJson(res, 201, { projectId: created.projectId });
      return true;
    }
    return false;
  }

  const prefix = "/api/projects/";
  if (!pathname.startsWith(prefix)) return false;

  const rest = pathname.slice(prefix.length);
  const slashIdx = rest.indexOf("/");
  if (slashIdx === -1) return false;

  const projectId = safeDecodeSegment(rest.slice(0, slashIdx));
  const subRoute = rest.slice(slashIdx); // starts with '/'

  // Binary asset serving: GET /api/projects/:id/assets/*
  if (subRoute.startsWith("/assets/") && method === "GET") {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return true;
    const assetRel = safeDecodeSegment(subRoute.slice("/assets/".length));
    const { buffer, mimeType } = await readProjectBinaryAsset(projectId, assetRel);
    res.statusCode = 200;
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"
    );
    res.end(buffer);
    return true;
  }

  // Binary asset upload: POST /api/projects/:id/assets
  if ((subRoute === "/assets" || subRoute === "/assets/") && method === "POST") {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return true;
    enforceFileMutationPermission(user, "assets/upload.bin", null, null);

    const body = await readJsonBody<{
      path?: string;
      name?: string;
      subdir?: string;
      dataBase64?: string;
      base64?: string;
    }>(req);

    const base64Data = body.dataBase64 || body.base64 || "";
    const targetAssetPath =
      body.path ||
      `${(body.subdir || "assets").replace(/\/+$/, "")}/${Date.now()}-${(
        body.name || "attachment.bin"
      ).replace(/[^a-zA-Z0-9._-]+/g, "_")}`;

    const uploaded = await uploadProjectBinaryAsset(
      projectId,
      targetAssetPath,
      base64Data,
      user
    );
    const assetSub = uploaded.assetPath.replace(/^assets\//, "");
    sendJson(res, 201, {
      ...uploaded,
      url: `/api/projects/${encodeURIComponent(projectId)}/assets/${assetSub}`,
    });
    return true;
  }

  // Files listing / upsert / delete: /api/projects/:id/files or /api/projects/:id/files/*
  if (subRoute === "/files" || subRoute === "/files/" || subRoute.startsWith("/files/")) {
    const wildcardRel = subRoute.startsWith("/files/")
      ? safeDecodeSegment(subRoute.slice("/files/".length))
      : "";

    if (method === "GET") {
      const user = await requireAuthenticatedUser(req, res);
      if (!user) return true;
      const singlePath = wildcardRel || url.searchParams.get("path") || "";
      if (singlePath) {
        const content = await readProjectTextFileIfExists(projectId, singlePath);
        if (content === null) {
          sendError(res, 404, `File '${singlePath}' not found`, "FILE_NOT_FOUND");
          return true;
        }
        sendJson(res, 200, { path: singlePath, content });
        return true;
      }
      const listing = await listProjectFilesAndAssets(projectId);
      sendJson(res, 200, listing);
      return true;
    }

    if (method === "PUT" || method === "POST") {
      const user = await requireAuthenticatedUser(req, res);
      if (!user) return true;

      const body = await readJsonBody<{
        path?: string;
        content?: string;
        message?: string;
        action?: string;
        files?: Array<{ path: string; content: string }>;
      }>(req);

      const headerAction = req.headers["x-scrum-action"];
      const explicitAction =
        body.action || (typeof headerAction === "string" ? headerAction : undefined);

      if (Array.isArray(body.files) && body.files.length > 0) {
        const results = [];
        for (const item of body.files) {
          const prev = await readProjectTextFileIfExists(projectId, item.path);
          enforceFileMutationPermission(
            user,
            item.path,
            item.content,
            prev,
            explicitAction
          );
          const saved = await upsertProjectTextFile(
            projectId,
            item.path,
            item.content,
            user,
            body.message
          );
          results.push(saved.file);
        }
        sendJson(res, 200, { files: results, count: results.length });
        return true;
      }

      const targetPath = wildcardRel || body.path || "";
      if (!targetPath || typeof body.content !== "string") {
        throw new HttpError(
          400,
          "File 'path' and string 'content' are required",
          "MISSING_FILE_FIELDS"
        );
      }

      const previousContent = await readProjectTextFileIfExists(projectId, targetPath);
      enforceFileMutationPermission(
        user,
        targetPath,
        body.content,
        previousContent,
        explicitAction
      );

      const saved = await upsertProjectTextFile(
        projectId,
        targetPath,
        body.content,
        user,
        body.message
      );
      sendJson(res, 200, saved);
      return true;
    }

    if (method === "DELETE") {
      const user = await requireAuthenticatedUser(req, res);
      if (!user) return true;
      const body =
        wildcardRel || url.searchParams.get("path")
          ? ({} as { path?: string; message?: string })
          : await readJsonBody<{ path?: string; message?: string }>(req);
      const targetPath = wildcardRel || url.searchParams.get("path") || body.path || "";
      if (!targetPath) {
        throw new HttpError(400, "File 'path' is required for deletion", "MISSING_PATH");
      }

      const prev = await readProjectTextFileIfExists(projectId, targetPath);
      enforceFileMutationPermission(user, targetPath, null, prev);

      const deleted = await deleteProjectFile(projectId, targetPath, user, body.message);
      sendJson(res, 200, deleted);
      return true;
    }
  }

  // Git status: GET /api/projects/:id/git/status
  if (subRoute === "/git/status" && method === "GET") {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return true;
    const status = await getProjectGitStatus(projectId);
    sendJson(res, 200, status);
    return true;
  }

  // Git pull/push sync: POST /api/projects/:id/git/sync
  if (subRoute === "/git/sync" && method === "POST") {
    const user = await requireRoleAction(req, res, "edit_wiki");
    if (!user) return true;
    const body = await readJsonBody<{
      remoteUrl?: string;
      branch?: string;
      direction?: "pull" | "push" | "both";
    }>(req);
    const syncOutcome = await syncProjectGitRemote(projectId, body, user);
    sendJson(res, 200, syncOutcome);
    return true;
  }

  // Git conflict inspection: GET /api/projects/:id/git/conflicts
  if (subRoute === "/git/conflicts" && method === "GET") {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return true;
    const specificFile = url.searchParams.get("file") || undefined;
    const inspected = await inspectProjectConflicts(projectId, specificFile);
    const versionsMap: Record<string, (typeof inspected.items)[number]> = {};
    for (const item of inspected.items) {
      versionsMap[item.path] = item;
    }
    sendJson(res, 200, {
      conflicts: inspected.conflicts,
      items: inspected.items,
      versions: versionsMap,
    });
    return true;
  }

  // Git conflict resolution: POST /api/projects/:id/git/resolve
  if (subRoute === "/git/resolve" && method === "POST") {
    const user = await requireRoleAction(req, res, "edit_wiki");
    if (!user) return true;
    const body = await readJsonBody<{
      path?: string;
      filePath?: string;
      resolvedContent?: string;
      content?: string;
      commit?: boolean;
    }>(req);

    const targetFile = body.filePath || body.path || "";
    const resolvedText =
      typeof body.resolvedContent === "string"
        ? body.resolvedContent
        : typeof body.content === "string"
        ? body.content
        : null;

    if (!targetFile || resolvedText === null) {
      throw new HttpError(
        400,
        "Conflict resolution requires 'filePath' (or 'path') and 'resolvedContent'",
        "INVALID_RESOLVE_PAYLOAD"
      );
    }

    const outcome = await resolveProjectConflictFile(
      projectId,
      targetFile,
      resolvedText,
      user,
      body.commit !== false
    );
    sendJson(res, 200, outcome);
    return true;
  }

  return false;
}
