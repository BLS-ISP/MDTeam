"use client";

import { useCallback } from "react";
import type {
  GitAuthType,
  ProjectVisibility,
  ServerBranchInfo,
  ServerCommitSummary,
  ServerConflictEntry,
  ServerProjectSummary,
} from "../types/auth";

export interface UseServerGitApiParams {
  activeProjectId: string;
  apiFetch: <T = Record<string, unknown>>(
    endpoint: string,
    init?: RequestInit,
    overrideBase?: string,
    overrideToken?: string
  ) => Promise<T>;
  selectServerProject: (projectId: string) => Promise<void>;
  loadServerWorkspaceFiles: (
    projectId?: string,
    baseOverride?: string,
    tokenOverride?: string
  ) => Promise<unknown>;
  refreshTeamAndProjects: (
    baseOverride?: string,
    tokenOverride?: string,
    targetProject?: string
  ) => Promise<void>;
}

export function useServerGitApi({
  activeProjectId,
  apiFetch,
  selectServerProject,
  loadServerWorkspaceFiles,
  refreshTeamAndProjects,
}: UseServerGitApiParams) {
  const testServerGitRemote = useCallback(
    async (input: {
      remoteUrl: string;
      projectId?: string;
      authType?: GitAuthType;
      httpsUsername?: string;
      httpsToken?: string;
      sshPrivateKey?: string;
    }) => {
      return apiFetch<{
        ok: boolean;
        cleanUrl: string;
        defaultBranch: string;
        branches: string[];
      }>("/api/projects/git/test", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    [apiFetch]
  );

  const cloneServerGitRepo = useCallback(
    async (input: {
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
    }) => {
      const res = await apiFetch<{
        project: ServerProjectSummary;
        filesCount: number;
        activeBranch: string;
      }>("/api/projects/clone", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await selectServerProject(res.project.projectId);
      return res;
    },
    [apiFetch, selectServerProject]
  );

  const createBlankServerProject = useCallback(
    async (input: {
      projectId: string;
      displayName?: string;
      visibility?: ProjectVisibility;
    }) => {
      const res = await apiFetch<{
        projectId: string;
        project: ServerProjectSummary;
      }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await selectServerProject(res.projectId);
      return res;
    },
    [apiFetch, selectServerProject]
  );

  const updateServerGitRemote = useCallback(
    async (
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
      targetProjectId = activeProjectId
    ) => {
      const res = await apiFetch<{ project: ServerProjectSummary }>(
        `/api/projects/${encodeURIComponent(targetProjectId)}/git/remote`,
        {
          method: "PUT",
          body: JSON.stringify(patch),
        }
      );
      await refreshTeamAndProjects(undefined, undefined, targetProjectId);
      if (patch.scaffoldMdTeam) {
        await loadServerWorkspaceFiles(targetProjectId);
      }
      return res.project;
    },
    [activeProjectId, apiFetch, loadServerWorkspaceFiles, refreshTeamAndProjects]
  );

  const previewPreCloneSshKey = useCallback(async () => {
    return apiFetch<{
      sshPublicKey: string;
      sshPrivateKey: string;
    }>("/api/projects/git/ssh-key-preview", {
      method: "POST",
      body: JSON.stringify({}),
    });
  }, [apiFetch]);

  const generateServerSshKey = useCallback(
    async (targetProjectId = activeProjectId) => {
      const res = await apiFetch<{
        sshPublicKey: string;
        project: ServerProjectSummary;
      }>(`/api/projects/${encodeURIComponent(targetProjectId)}/git/ssh-key`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refreshTeamAndProjects(undefined, undefined, targetProjectId);
      return res;
    },
    [activeProjectId, apiFetch, refreshTeamAndProjects]
  );

  const deleteServerProject = useCallback(
    async (targetProjectId: string) => {
      const res = await apiFetch<{ deletedProjectId: string }>(
        `/api/projects/${encodeURIComponent(targetProjectId)}`,
        { method: "DELETE" }
      );
      if (targetProjectId === activeProjectId) {
        await selectServerProject("default");
      } else {
        await refreshTeamAndProjects();
      }
      return res;
    },
    [activeProjectId, apiFetch, refreshTeamAndProjects, selectServerProject]
  );

  const syncServerGitRemote = useCallback(
    async (options?: {
      remoteUrl?: string;
      branch?: string;
      direction?: "pull" | "push" | "both";
    }) => {
      const res = await apiFetch<{
        ok: boolean;
        hasConflicts: boolean;
        conflicts: string[];
        message: string;
      }>(`/api/projects/${encodeURIComponent(activeProjectId)}/git/sync`, {
        method: "POST",
        body: JSON.stringify(options || {}),
      });
      await refreshTeamAndProjects();
      if (res.ok) await loadServerWorkspaceFiles(activeProjectId);
      return res;
    },
    [activeProjectId, apiFetch, loadServerWorkspaceFiles, refreshTeamAndProjects]
  );

  const listServerBranches = useCallback(
    async (targetProjectId = activeProjectId) => {
      return apiFetch<{
        currentBranch: string;
        branches: ServerBranchInfo[];
      }>(`/api/projects/${encodeURIComponent(targetProjectId)}/git/branches`);
    },
    [activeProjectId, apiFetch]
  );

  const checkoutServerBranch = useCallback(
    async (branch: string, create = false, targetProjectId = activeProjectId) => {
      const res = await apiFetch<{ branch: string }>(
        `/api/projects/${encodeURIComponent(targetProjectId)}/git/checkout`,
        {
          method: "POST",
          body: JSON.stringify({ branch, create }),
        }
      );
      await Promise.allSettled([
        loadServerWorkspaceFiles(targetProjectId),
        refreshTeamAndProjects(undefined, undefined, targetProjectId),
      ]);
      return res;
    },
    [activeProjectId, apiFetch, loadServerWorkspaceFiles, refreshTeamAndProjects]
  );

  const commitServerChanges = useCallback(
    async (message: string, pushAfter = true) => {
      const res = await apiFetch<{
        committed: boolean;
        commitSha: string;
        pushed: boolean;
      }>(`/api/projects/${encodeURIComponent(activeProjectId)}/git/commit`, {
        method: "POST",
        body: JSON.stringify({ message, push: pushAfter }),
      });
      await refreshTeamAndProjects();
      return res;
    },
    [activeProjectId, apiFetch, refreshTeamAndProjects]
  );

  const fetchServerFileHistory = useCallback(
    async (filePath?: string, limit = 25) => {
      const q = new URLSearchParams();
      if (filePath) q.set("path", filePath);
      q.set("limit", String(limit));
      const res = await apiFetch<{ commits: ServerCommitSummary[] }>(
        `/api/projects/${encodeURIComponent(activeProjectId)}/git/history?${q.toString()}`
      );
      return res.commits || [];
    },
    [activeProjectId, apiFetch]
  );

  const fetchServerFileAtCommit = useCallback(
    async (sha: string, filePath: string) => {
      const q = new URLSearchParams({ sha, path: filePath });
      const res = await apiFetch<{ content: string }>(
        `/api/projects/${encodeURIComponent(activeProjectId)}/git/file-at-commit?${q.toString()}`
      );
      return res.content ?? "";
    },
    [activeProjectId, apiFetch]
  );

  const fetchServerConflicts = useCallback(
    async (specificFile?: string) => {
      const q = specificFile ? `?file=${encodeURIComponent(specificFile)}` : "";
      return apiFetch<{
        conflicts: string[];
        items: ServerConflictEntry[];
        versions: Record<string, ServerConflictEntry>;
      }>(`/api/projects/${encodeURIComponent(activeProjectId)}/git/conflicts${q}`);
    },
    [activeProjectId, apiFetch]
  );

  const resolveServerConflict = useCallback(
    async (filePath: string, resolvedContent: string, commit = true) => {
      const res = await apiFetch<{
        resolvedPath: string;
        remainingConflicts: string[];
        committed: boolean;
      }>(`/api/projects/${encodeURIComponent(activeProjectId)}/git/resolve`, {
        method: "POST",
        body: JSON.stringify({ filePath, resolvedContent, commit }),
      });
      await loadServerWorkspaceFiles(activeProjectId);
      return res;
    },
    [activeProjectId, apiFetch, loadServerWorkspaceFiles]
  );

  return {
    testServerGitRemote,
    cloneServerGitRepo,
    createBlankServerProject,
    updateServerGitRemote,
    previewPreCloneSshKey,
    generateServerSshKey,
    deleteServerProject,
    syncServerGitRemote,
    listServerBranches,
    checkoutServerBranch,
    commitServerChanges,
    fetchServerFileHistory,
    fetchServerFileAtCommit,
    fetchServerConflicts,
    resolveServerConflict,
  };
}
