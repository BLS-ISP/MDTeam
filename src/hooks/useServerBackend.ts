"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import {
  canRolePerform,
  mapScrumRoleToWorkspaceMode,
  type AuthUser,
  type OidcProviderPreset,
  type ScrumAction,
  type ServerConflictEntry,
  type ServerGitStatusSummary,
  type WebhookDeliveryChannelResult,
  type WebhookDispatchInput,
} from "../types/auth";
import type { WorkspaceFile } from "../types/workspace";
import { blobToRawBase64 } from "../components/auth/authModalStyles";

const SERVER_URL_KEY = "mdteam_server_url";
const TOKEN_KEY = "mdteam_session_token";
const PROJECT_KEY = "mdteam_server_project";

interface HealthPayload {
  status?: string;
  oidcEnabled?: boolean;
  oidcProvider?: OidcProviderPreset;
  ldapEnabled?: boolean;
  ldapDomain?: string;
}

export interface UseServerBackendParams {
  isTauri?: boolean;
  tauriRootFolder?: string;
  setFiles?: React.Dispatch<React.SetStateAction<WorkspaceFile[]>>;
  setCategories?: React.Dispatch<React.SetStateAction<string[]>>;
  onAuthenticatedUserChange?: (
    user: AuthUser | null,
    suggestedMode?: "developer" | "scrum" | "stakeholder"
  ) => void;
}

export function useServerBackend(params: UseServerBackendParams = {}) {
  const {
    isTauri = false,
    tauriRootFolder = "",
    setFiles,
    setCategories,
    onAuthenticatedUserChange,
  } = params;

  const [configuredServerUrl, setConfiguredServerUrlState] = useState("");
  const [resolvedApiBase, setResolvedApiBase] = useState("");
  const [serverMode, setServerMode] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isSyncingServer, setIsSyncingServer] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState("");
  const [teamUsers, setTeamUsers] = useState<AuthUser[]>([]);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [oidcProvider, setOidcProvider] = useState<OidcProviderPreset>("keycloak");
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [ldapDomain, setLdapDomain] = useState("");
  const [activeProjectId, setActiveProjectId] = useState("default");
  const [availableProjects, setAvailableProjects] = useState<string[]>(["default"]);
  const [gitStatus, setGitStatus] = useState<ServerGitStatusSummary | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const onAuthChangeRef = useRef(onAuthenticatedUserChange);
  useEffect(() => {
    onAuthChangeRef.current = onAuthenticatedUserChange;
  }, [onAuthenticatedUserChange]);

  const apiFetch = useCallback(
    async <T = Record<string, unknown>>(
      endpoint: string,
      init: RequestInit = {},
      overrideBase?: string,
      overrideToken?: string
    ): Promise<T> => {
      const base = (overrideBase ?? resolvedApiBase).replace(/\/+$/, "");
      const url = endpoint.startsWith("http") ? endpoint : `${base}${endpoint}`;
      const token = overrideToken ?? sessionToken;
      const headers = new Headers(init.headers || {});
      if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
        headers.set("Content-Type", "application/json");
      }
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      const resp = await fetch(url, { ...init, headers, credentials: "include" });
      const isJson = (resp.headers.get("content-type") || "").includes("application/json");
      const data = isJson ? ((await resp.json()) as Record<string, unknown>) : {};
      if (!resp.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : `Server error (${resp.status})`
        );
      }
      return data as T;
    },
    [resolvedApiBase, sessionToken]
  );

  const loadServerWorkspaceFiles = useCallback(
    async (projectId = activeProjectId, baseOverride?: string, tokenOverride?: string) => {
      setIsSyncingServer(true);
      try {
        const res = await apiFetch<{
          projectId: string;
          files: WorkspaceFile[];
          assets: string[];
        }>(
          `/api/projects/${encodeURIComponent(projectId)}/files`,
          { method: "GET" },
          baseOverride,
          tokenOverride
        );
        if (Array.isArray(res.files) && res.files.length > 0) {
          setFiles?.(res.files);
          if (setCategories) {
            const cats = Array.from(
              new Set(res.files.map((f) => f.category).filter((c) => c && !c.startsWith(".")))
            ).sort();
            if (cats.length > 0) setCategories(cats);
          }
        }
        setServerError(null);
        return res;
      } finally {
        setIsSyncingServer(false);
      }
    },
    [activeProjectId, apiFetch, setCategories, setFiles]
  );

  const refreshTeamAndProjects = useCallback(
    async (baseOverride?: string, tokenOverride?: string, targetProject = activeProjectId) => {
      const [uRes, pRes, sRes] = await Promise.allSettled([
        apiFetch<{ users: AuthUser[] }>("/api/users", {}, baseOverride, tokenOverride),
        apiFetch<{ projects: string[] }>("/api/projects", {}, baseOverride, tokenOverride),
        apiFetch<ServerGitStatusSummary>(
          `/api/projects/${encodeURIComponent(targetProject)}/git/status`,
          {},
          baseOverride,
          tokenOverride
        ),
      ]);
      if (uRes.status === "fulfilled" && Array.isArray(uRes.value.users)) {
        setTeamUsers(uRes.value.users);
      }
      if (pRes.status === "fulfilled" && Array.isArray(pRes.value.projects)) {
        setAvailableProjects(pRes.value.projects);
      }
      if (sRes.status === "fulfilled") setGitStatus(sRes.value);
    },
    [activeProjectId, apiFetch]
  );

  const probeBackendAndSession = useCallback(
    async (explicitServerUrl?: string) => {
      if (typeof window === "undefined") return;
      const storedUrl = (
        explicitServerUrl !== undefined
          ? explicitServerUrl
          : localStorage.getItem(SERVER_URL_KEY) || ""
      ).trim();
      const storedToken = localStorage.getItem(TOKEN_KEY) || "";
      const storedProject = localStorage.getItem(PROJECT_KEY) || "default";

      setConfiguredServerUrlState(storedUrl);
      setSessionToken(storedToken);
      setActiveProjectId(storedProject);

      const inTauri = Boolean(
        isTauri || (window as unknown as { __TAURI__?: unknown }).__TAURI__
      );
      if ((inTauri || Boolean(tauriRootFolder)) && !storedUrl) {
        setServerMode(false);
        setResolvedApiBase("");
        return;
      }

      setIsCheckingHealth(true);
      const isLocal =
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const candidates = storedUrl
        ? [storedUrl.replace(/\/+$/, "")]
        : isLocal && window.location.port !== "4000"
        ? ["", `http://${window.location.hostname}:4000`]
        : [""];

      let detectedBase: string | null = null;
      let health: HealthPayload | null = null;

      for (const candidate of candidates) {
        try {
          const resp = await fetch(`${candidate}/api/health`, {
            credentials: "include",
            signal: AbortSignal.timeout(2200),
          });
          if (resp.ok) {
            const json = (await resp.json()) as HealthPayload;
            if (json?.status === "ok") {
              detectedBase = candidate;
              health = json;
              break;
            }
          }
        } catch {
          // Offline or candidate unavailable
        }
      }

      setIsCheckingHealth(false);
      if (detectedBase === null || !health) {
        setServerMode(false);
        setResolvedApiBase("");
        setLdapEnabled(false);
        setLdapDomain("");
        return;
      }

      setResolvedApiBase(detectedBase);
      setServerMode(true);
      setOidcEnabled(Boolean(health.oidcEnabled));
      if (health.oidcProvider) setOidcProvider(health.oidcProvider);
      setLdapEnabled(Boolean(health.ldapEnabled));
      setLdapDomain(typeof health.ldapDomain === "string" ? health.ldapDomain : "");

      try {
        const me = await apiFetch<{ user: AuthUser }>("/api/auth/me", {}, detectedBase, storedToken);
        if (me.user) {
          setAuthUser(me.user);
          onAuthChangeRef.current?.(me.user, mapScrumRoleToWorkspaceMode(me.user.role));
          await Promise.allSettled([
            loadServerWorkspaceFiles(storedProject, detectedBase, storedToken),
            refreshTeamAndProjects(detectedBase, storedToken, storedProject),
          ]);
        }
      } catch {
        setAuthUser(null);
      }
    },
    [apiFetch, isTauri, loadServerWorkspaceFiles, refreshTeamAndProjects, tauriRootFolder]
  );

  useEffect(() => {
    void probeBackendAndSession();
  }, [probeBackendAndSession]);

  const setCustomServerUrl = useCallback(
    async (nextUrl: string) => {
      const clean = nextUrl.trim().replace(/\/+$/, "");
      if (typeof window !== "undefined") {
        if (clean) localStorage.setItem(SERVER_URL_KEY, clean);
        else localStorage.removeItem(SERVER_URL_KEY);
      }
      await probeBackendAndSession(clean);
    },
    [probeBackendAndSession]
  );

  const loginLocal = useCallback(
    async (username: string, password: string): Promise<AuthUser> => {
      setServerError(null);
      const data = await apiFetch<{ user: AuthUser; token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setAuthUser(data.user);
      setSessionToken(data.token);
      if (typeof window !== "undefined" && data.token) localStorage.setItem(TOKEN_KEY, data.token);
      onAuthChangeRef.current?.(data.user, mapScrumRoleToWorkspaceMode(data.user.role));
      await Promise.allSettled([
        loadServerWorkspaceFiles(activeProjectId, resolvedApiBase, data.token),
        refreshTeamAndProjects(resolvedApiBase, data.token, activeProjectId),
      ]);
      return data.user;
    },
    [activeProjectId, apiFetch, loadServerWorkspaceFiles, refreshTeamAndProjects, resolvedApiBase]
  );

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setAuthUser(null);
    setSessionToken("");
    if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
    onAuthChangeRef.current?.(null);
  }, [apiFetch]);

  const startOidcLogin = useCallback(
    (returnTo = "/") => {
      if (typeof window === "undefined") return;
      const base = resolvedApiBase.replace(/\/+$/, "");
      window.location.href = `${base}/api/auth/oidc/login?returnTo=${encodeURIComponent(returnTo)}`;
    },
    [resolvedApiBase]
  );

  const selectServerProject = useCallback(
    async (projectId: string) => {
      setActiveProjectId(projectId);
      if (typeof window !== "undefined") localStorage.setItem(PROJECT_KEY, projectId);
      if (serverMode && authUser) {
        await Promise.allSettled([
          loadServerWorkspaceFiles(projectId),
          refreshTeamAndProjects(undefined, undefined, projectId),
        ]);
      }
    },
    [authUser, loadServerWorkspaceFiles, refreshTeamAndProjects, serverMode]
  );

  const syncUpsertServerFile = useCallback(
    async (file: WorkspaceFile, scrumAction?: ScrumAction, commitMessage?: string) => {
      if (!serverMode || !authUser) return null;
      return apiFetch<{ file: WorkspaceFile; committed: boolean; commitSha: string }>(
        `/api/projects/${encodeURIComponent(activeProjectId)}/files`,
        {
          method: "PUT",
          headers: scrumAction ? { "X-Scrum-Action": scrumAction } : undefined,
          body: JSON.stringify({
            path: file.path,
            content: file.content,
            action: scrumAction,
            message: commitMessage,
          }),
        }
      );
    },
    [activeProjectId, apiFetch, authUser, serverMode]
  );

  const syncDeleteServerFile = useCallback(
    async (filePath: string, commitMessage?: string) => {
      if (!serverMode || !authUser) return null;
      return apiFetch<{ deletedPath: string; committed: boolean }>(
        `/api/projects/${encodeURIComponent(activeProjectId)}/files?path=${encodeURIComponent(filePath)}`,
        {
          method: "DELETE",
          body: commitMessage ? JSON.stringify({ path: filePath, message: commitMessage }) : undefined,
        }
      );
    },
    [activeProjectId, apiFetch, authUser, serverMode]
  );

  const uploadServerBinaryAsset = useCallback(
    async (blobOrFile: File | Blob, subdir = "assets") => {
      const dataBase64 = await blobToRawBase64(blobOrFile);
      const rawName = "name" in blobOrFile && blobOrFile.name ? blobOrFile.name : "image.png";
      const res = await apiFetch<{
        assetPath: string;
        url: string;
        sizeBytes: number;
        commitSha: string;
      }>(`/api/projects/${encodeURIComponent(activeProjectId)}/assets`, {
        method: "POST",
        body: JSON.stringify({ name: rawName, subdir, dataBase64 }),
      });
      const fullUrl = res.url.startsWith("http") ? res.url : `${resolvedApiBase}${res.url}`;
      return { ...res, fullUrl, markdown: `![${rawName}](${fullUrl})` };
    },
    [activeProjectId, apiFetch, resolvedApiBase]
  );

  const syncServerGitRemote = useCallback(
    async (options?: { remoteUrl?: string; branch?: string; direction?: "pull" | "push" | "both" }) => {
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

  const dispatchWebhookNotification = useCallback(
    async (input: WebhookDispatchInput) => {
      if (!serverMode || !authUser) return { skipped: true, results: [] };
      return apiFetch<{ skipped: boolean; results: WebhookDeliveryChannelResult[] }>(
        "/api/notifications/dispatch",
        { method: "POST", body: JSON.stringify({ projectId: activeProjectId, ...input }) }
      );
    },
    [activeProjectId, apiFetch, authUser, serverMode]
  );

  const canPerform = useCallback(
    (action: ScrumAction): boolean =>
      !serverMode ? true : authUser ? canRolePerform(authUser.role, action) : false,
    [authUser, serverMode]
  );

  return {
    serverMode,
    resolvedApiBase,
    configuredServerUrl,
    isCheckingHealth,
    isSyncingServer,
    serverError,
    authUser,
    teamUsers,
    oidcEnabled,
    oidcProvider,
    ldapEnabled,
    ldapDomain,
    activeProjectId,
    availableProjects,
    gitStatus,
    apiFetch,
    setCustomServerUrl,
    probeBackendAndSession,
    loginLocal,
    logout,
    startOidcLogin,
    selectServerProject,
    loadServerWorkspaceFiles,
    syncUpsertServerFile,
    syncDeleteServerFile,
    uploadServerBinaryAsset,
    syncServerGitRemote,
    fetchServerConflicts,
    resolveServerConflict,
    dispatchWebhookNotification,
    refreshTeamAndProjects,
    canPerform,
  };
}
