import { execFile } from "node:child_process";
import path from "node:path";
import { getDataDir, HttpError } from "../httpHelpers.js";
import type { AuthUser } from "../types.js";

export interface GitCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function getReposBaseDir(): string {
  return path.join(getDataDir(), "repos");
}

export function sanitizeProjectId(rawProjectId: string): string {
  const trimmed = decodeURIComponent(rawProjectId || "").trim();
  if (!trimmed) {
    throw new HttpError(400, "Project ID cannot be empty", "INVALID_PROJECT_ID");
  }
  if (
    trimmed.startsWith("-") ||
    trimmed.startsWith(".") ||
    trimmed.includes("..") ||
    !/^[a-zA-Z0-9._-]{1,64}$/.test(trimmed)
  ) {
    throw new HttpError(
      400,
      "Invalid project ID (must be 1-64 alphanumeric, dot, underscore, or dash characters)",
      "INVALID_PROJECT_ID"
    );
  }

  const baseDir = path.resolve(getReposBaseDir());
  const resolved = path.resolve(baseDir, trimmed);
  if (!resolved.startsWith(baseDir + path.sep)) {
    throw new HttpError(400, "Project path escapes repository root", "PATH_TRAVERSAL");
  }
  return trimmed;
}

export function resolveProjectDir(rawProjectId: string): string {
  const safeId = sanitizeProjectId(rawProjectId);
  return path.join(getReposBaseDir(), safeId);
}

export function sanitizeRepoRelativePath(
  repoRootDir: string,
  rawRelPath: string
): { cleanRelPath: string; absolutePath: string } {
  if (typeof rawRelPath !== "string" || rawRelPath.includes("\0")) {
    throw new HttpError(400, "Invalid file path", "INVALID_PATH");
  }

  const normalized = rawRelPath.replace(/\\/g, "/").trim().replace(/^\/+/, "");
  if (!normalized) {
    throw new HttpError(400, "File path cannot be empty", "INVALID_PATH");
  }
  if (normalized.startsWith("-") || /^[a-zA-Z]:/.test(normalized)) {
    throw new HttpError(
      400,
      "File path cannot start with '-' or drive prefix",
      "FLAG_INJECTION_BLOCKED"
    );
  }

  const segments = normalized.split("/");
  for (const seg of segments) {
    if (!seg || seg === "." || seg === "..") {
      throw new HttpError(
        400,
        "Path traversal ('..') or empty segment is forbidden",
        "PATH_TRAVERSAL"
      );
    }
    if (seg.startsWith("-")) {
      throw new HttpError(
        400,
        "Path segments starting with '-' are forbidden",
        "FLAG_INJECTION_BLOCKED"
      );
    }
  }

  if (segments[0].toLowerCase() === ".git") {
    throw new HttpError(
      403,
      "Direct access to .git metadata directory is forbidden",
      "FORBIDDEN_GIT_INTERNAL"
    );
  }

  const resolvedRoot = path.resolve(repoRootDir);
  const resolvedTarget = path.resolve(resolvedRoot, ...segments);
  if (!resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new HttpError(400, "File path escapes repository boundary", "PATH_TRAVERSAL");
  }

  return {
    cleanRelPath: segments.join("/"),
    absolutePath: resolvedTarget,
  };
}

export function sanitizeGitRef(rawRef: string): string {
  const trimmed = (rawRef || "").trim();
  if (!trimmed || trimmed.length > 120) {
    throw new HttpError(400, "Invalid Git branch or reference name", "INVALID_GIT_REF");
  }
  if (
    trimmed.startsWith("-") ||
    trimmed.includes("..") ||
    trimmed.includes("@{") ||
    trimmed.endsWith(".lock") ||
    trimmed.endsWith("/") ||
    /[\x00-\x20~^:?*\[\\]/.test(trimmed)
  ) {
    throw new HttpError(
      400,
      "Unsafe characters or flag prefix in Git reference",
      "INVALID_GIT_REF"
    );
  }
  return trimmed;
}

export function sanitizeRemoteUrl(rawUrl: string): string {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("-")) {
    throw new HttpError(400, "Git remote URL cannot start with '-'", "FLAG_INJECTION_BLOCKED");
  }
  if (
    !/^(https?:\/\/|ssh:\/\/|git@[a-zA-Z0-9._-]+:)/i.test(trimmed) ||
    /[\x00-\x20]/.test(trimmed)
  ) {
    throw new HttpError(
      400,
      "Only https://, ssh://, or git@host: remote URLs are permitted",
      "UNSAFE_REMOTE_URL"
    );
  }
  return trimmed;
}

export function execGitSafe(
  cwd: string,
  args: string[],
  author?: Pick<AuthUser, "displayName" | "email" | "username">,
  allowNonZero = false
): Promise<GitCommandResult> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C.UTF-8",
  };

  if (author) {
    const safeName = (author.displayName || author.username || "MDTeam User").replace(
      /[\r\n<>]/g,
      ""
    );
    const safeEmail = (author.email || `${author.username}@mdteam.local`).replace(
      /[\r\n<>]/g,
      ""
    );
    env.GIT_AUTHOR_NAME = safeName;
    env.GIT_AUTHOR_EMAIL = safeEmail;
    env.GIT_COMMITTER_NAME = safeName;
    env.GIT_COMMITTER_EMAIL = safeEmail;
  }

  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      {
        cwd,
        env,
        maxBuffer: 20 * 1024 * 1024,
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        const outStr = typeof stdout === "string" ? stdout : String(stdout || "");
        const errStr = typeof stderr === "string" ? stderr : String(stderr || "");
        if (err && !allowNonZero) {
          const exitCode = typeof (err as { code?: unknown }).code === "number"
            ? ((err as { code: number }).code)
            : 1;
          reject(
            new HttpError(
              500,
              `Git command failed (exit ${exitCode}): ${errStr.trim() || err.message}`,
              "GIT_EXEC_FAILED"
            )
          );
          return;
        }
        const exitCode = err && typeof (err as { code?: unknown }).code === "number"
          ? ((err as { code: number }).code)
          : err
          ? 1
          : 0;
        resolve({ stdout: outStr, stderr: errStr, exitCode });
      }
    );
  });
}
