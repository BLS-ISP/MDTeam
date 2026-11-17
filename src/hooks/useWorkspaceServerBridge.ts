"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  canRolePerform,
  mapScrumRoleToWorkspaceMode,
  type AuthUser,
  type ScrumAction,
  type ScrumRole,
} from "../types/auth";
import {
  parseIssueFromFile,
  parseSprints,
  type WorkspaceFile,
} from "../utils/issueEngine";
import { hasConflictMarkers } from "../utils/gitConflictParser";
import type { WorkspaceRoleMode } from "../components/CommandPaletteAndModals";
import { useServerBackend } from "./useServerBackend";

export interface UseWorkspaceServerBridgeParams {
  isTauri: boolean;
  tauriRootFolder: string;
  files: WorkspaceFile[];
  filesRef: React.MutableRefObject<WorkspaceFile[]>;
  setFiles: React.Dispatch<React.SetStateAction<WorkspaceFile[]>>;
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  roleMode: WorkspaceRoleMode;
  onApplyRoleMode: (mode: WorkspaceRoleMode) => void;
  currentUser: string;
  setCurrentUser: React.Dispatch<React.SetStateAction<string>>;
  rawUpsertFile: (file: WorkspaceFile) => Promise<void>;
  rawUpsertMultipleFiles: (files: WorkspaceFile[]) => Promise<void>;
  rawDeleteFile: (targetPath: string) => Promise<void>;
  rawUpdateMarkdownContent: (targetPath: string, content: string) => void;
}

export function deriveScrumRoleFromHandleAndMode(
  handle: string,
  mode: WorkspaceRoleMode,
  authUser: AuthUser | null,
  serverMode: boolean
): ScrumRole {
  if (serverMode && authUser) return authUser.role;
  const clean = (handle || "").trim().toLowerCase();
  if (mode === "stakeholder" || clean.includes("stakeholder")) return "stakeholder";
  if (clean.includes("admin")) return "admin";
  if (clean.includes("product-owner") || /^@?po(?:-|$)/.test(clean)) return "product-owner";
  if (clean.includes("scrum-master") || /^@?sm(?:-|$)/.test(clean) || mode === "scrum") {
    return "scrum-master";
  }
  return "developer";
}

function isCommentOnlyIssueChange(prevContent: string | undefined, nextContent: string): boolean {
  if (!prevContent) return false;
  const splitComments = (md: string) => {
    const idx = md.search(/^##\s+Comments\b/im);
    return idx === -1 ? md.trim() : md.slice(0, idx).replace(/^updated_at:.*$/im, "").trim();
  };
  return splitComments(prevContent) === splitComments(nextContent);
}

export function inferScrumActionForMutation(
  file: WorkspaceFile,
  prevFile: WorkspaceFile | undefined,
  effectiveRole: ScrumRole
): ScrumAction {
  const p = file.path.replace(/\\/g, "/");
  if (p === ".mdteam/inline-comments.json") return "comment_or_feedback";
  if (p === ".mdteam/scrum-policy.md") return "manage_scrum_policy";
  if (p === ".mdteam/backlog-order.json") return "reorder_product_backlog";
  if (p.startsWith("issues/")) {
    if (effectiveRole === "stakeholder" && isCommentOnlyIssueChange(prevFile?.content, file.content)) {
      return "comment_or_feedback";
    }
    return "edit_issue";
  }
  if (
    p.startsWith("sprints/") ||
    p === ".mdteam/releases.md" ||
    p === ".mdteam/daily-parking-lot.json" ||
    p.startsWith(".mdteam/retro-") ||
    p.startsWith("management/")
  ) {
    return "edit_issue";
  }
  const newlyApproved =
    /review_status:\s*["']?approved["']?/i.test(file.content) &&
    !(prevFile && /review_status:\s*["']?approved["']?/i.test(prevFile.content));
  return newlyApproved ? "approve_wiki" : "edit_wiki";
}

function extractHandles(text: string): Set<string> {
  const matches = text.match(/@[a-zA-Z0-9_-]{2,32}/g) || [];
  return new Set(matches.map((m) => m.toLowerCase()));
}

export function useWorkspaceServerBridge({
  isTauri,
  tauriRootFolder,
  files,
  filesRef,
  setFiles,
  setCategories,
  roleMode,
  onApplyRoleMode,
  currentUser,
  setCurrentUser,
  rawUpsertFile,
  rawUpsertMultipleFiles,
  rawDeleteFile,
  rawUpdateMarkdownContent,
}: UseWorkspaceServerBridgeParams) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTeamAdminModalOpen, setIsTeamAdminModalOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isGitRepoModalOpen, setIsGitRepoModalOpen] = useState(false);
  const [gitRepoModalInitialTab, setGitRepoModalInitialTab] = useState<"clone" | "remote" | "blank">("clone");
  const [tauriConflicts, setTauriConflicts] = useState<string[]>([]);
  const debounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const serverBackend = useServerBackend({
    isTauri,
    tauriRootFolder,
    setFiles,
    setCategories,
    onAuthenticatedUserChange: (user, suggestedMode) => {
      if (user) {
        const normalizedHandle = user.handle.startsWith("@") ? user.handle : `@${user.handle}`;
        setCurrentUser(normalizedHandle);
        onApplyRoleMode(suggestedMode || mapScrumRoleToWorkspaceMode(user.role));
      }
    },
  });

  const effectiveScrumRole = useMemo(
    () =>
      deriveScrumRoleFromHandleAndMode(
        currentUser,
        roleMode,
        serverBackend.authUser,
        serverBackend.serverMode
      ),
    [currentUser, roleMode, serverBackend.authUser, serverBackend.serverMode]
  );

  const isStakeholderReadOnly = effectiveScrumRole === "stakeholder";

  const canPerformAction = useCallback(
    (action: ScrumAction): boolean => canRolePerform(effectiveScrumRole, action),
    [effectiveScrumRole]
  );

  // Enforce stakeholder roleMode lock when authenticated as stakeholder on backend
  useEffect(() => {
    if (serverBackend.serverMode && serverBackend.authUser?.role === "stakeholder" && roleMode !== "stakeholder") {
      onApplyRoleMode("stakeholder");
    }
  }, [onApplyRoleMode, roleMode, serverBackend.authUser, serverBackend.serverMode]);

  const emitMutationWebhooks = useCallback(
    (prevFile: WorkspaceFile | undefined, nextFile: WorkspaceFile) => {
      if (!serverBackend.serverMode || !serverBackend.authUser) return;
      const p = nextFile.path.replace(/\\/g, "/");

      if (p.startsWith("issues/") && p.endsWith(".md")) {
        const prevIssue = prevFile ? parseIssueFromFile(prevFile) : null;
        const nextIssue = parseIssueFromFile(nextFile);
        if (nextIssue) {
          const prevBlockers = new Set((prevIssue?.blockedBy || []).map((b) => b.toUpperCase()));
          const addedBlockers = (nextIssue.blockedBy || []).filter((b) => !prevBlockers.has(b.toUpperCase()));
          if (addedBlockers.length > 0) {
            void serverBackend.dispatchWebhookNotification({
              event: "blocker",
              severity: "critical",
              title: `Issue Blocked: ${nextIssue.id} — ${nextIssue.title}`,
              summary: `Blocked by ${addedBlockers.join(", ")}`,
              targetPath: p,
              recipientHandle: nextIssue.assignee || undefined,
            });
          }
          if (nextIssue.assignee && nextIssue.assignee !== (prevIssue?.assignee || "")) {
            void serverBackend.dispatchWebhookNotification({
              event: "assignment",
              severity: "info",
              title: `Assigned ${nextIssue.id}: ${nextIssue.title}`,
              summary: `Assigned to ${nextIssue.assignee}`,
              targetPath: p,
              recipientHandle: nextIssue.assignee,
            });
          }
          if (nextIssue.status === "review" && prevIssue?.status !== "review") {
            void serverBackend.dispatchWebhookNotification({
              event: "review",
              severity: "info",
              title: `Ready for Review: ${nextIssue.id}`,
              summary: nextIssue.title,
              targetPath: p,
            });
          }
        }
      } else if (p.startsWith("sprints/") && p.endsWith(".md")) {
        const prevSprint = prevFile ? parseSprints([prevFile])[0] : undefined;
        const nextSprint = parseSprints([nextFile])[0];
        if (nextSprint && nextSprint.state !== prevSprint?.state) {
          void serverBackend.dispatchWebhookNotification({
            event: "sprint",
            severity: "info",
            title: `Sprint ${nextSprint.name} → ${nextSprint.state.toUpperCase()}`,
            summary: nextSprint.goal || nextSprint.id,
            targetPath: p,
          });
        }
      } else if (p.endsWith(".md")) {
        const becameInReview =
          /review_status:\s*["']?(in-review|approved)["']?/i.test(nextFile.content) &&
          (!prevFile || !/review_status:\s*["']?(in-review|approved)["']?/i.test(prevFile.content));
        if (becameInReview) {
          void serverBackend.dispatchWebhookNotification({
            event: "review",
            severity: "info",
            title: `Wiki Review Update: ${nextFile.name}`,
            summary: `Document status updated on ${p}`,
            targetPath: p,
          });
        }
      }

      const prevMentions = prevFile ? extractHandles(prevFile.content) : new Set<string>();
      const nextMentions = extractHandles(nextFile.content);
      for (const handle of nextMentions) {
        if (!prevMentions.has(handle) && handle !== currentUser.toLowerCase()) {
          void serverBackend.dispatchWebhookNotification({
            event: "mention",
            severity: "info",
            title: `Mentioned ${handle} in ${nextFile.name}`,
            summary: `${currentUser} mentioned ${handle} in ${p}`,
            targetPath: p,
            recipientHandle: handle,
          });
          break;
        }
      }
    },
    [currentUser, serverBackend]
  );

  const handleUpsertWorkspaceFile = useCallback(
    async (file: WorkspaceFile) => {
      const normalizedPath = file.path.replace(/\\/g, "/");
      const prevFile = filesRef.current.find((f) => f.path === normalizedPath);
      const action = inferScrumActionForMutation(file, prevFile, effectiveScrumRole);
      if (effectiveScrumRole === "stakeholder" && !canRolePerform("stakeholder", action)) {
        return;
      }
      await rawUpsertFile(file);
      if (serverBackend.serverMode && serverBackend.authUser) {
        void serverBackend.syncUpsertServerFile(file, action).catch((err) => {
          console.warn("[mdteam-sync] Server upsert rejected:", err);
        });
        emitMutationWebhooks(prevFile, file);
      }
    },
    [effectiveScrumRole, emitMutationWebhooks, filesRef, rawUpsertFile, serverBackend]
  );

  const handleUpsertMultipleFiles = useCallback(
    async (batch: WorkspaceFile[]) => {
      const permitted = batch.filter((f) => {
        const prev = filesRef.current.find((x) => x.path === f.path.replace(/\\/g, "/"));
        const action = inferScrumActionForMutation(f, prev, effectiveScrumRole);
        return effectiveScrumRole !== "stakeholder" || canRolePerform("stakeholder", action);
      });
      if (permitted.length === 0) return;
      await rawUpsertMultipleFiles(permitted);
      if (serverBackend.serverMode && serverBackend.authUser) {
        for (const f of permitted) {
          const prev = filesRef.current.find((x) => x.path === f.path.replace(/\\/g, "/"));
          const action = inferScrumActionForMutation(f, prev, effectiveScrumRole);
          void serverBackend.syncUpsertServerFile(f, action).catch(() => undefined);
          emitMutationWebhooks(prev, f);
        }
      }
    },
    [effectiveScrumRole, emitMutationWebhooks, filesRef, rawUpsertMultipleFiles, serverBackend]
  );

  const handleDeleteWorkspaceFile = useCallback(
    async (targetPath: string) => {
      if (effectiveScrumRole === "stakeholder") return;
      await rawDeleteFile(targetPath);
      if (serverBackend.serverMode && serverBackend.authUser) {
        void serverBackend.syncDeleteServerFile(targetPath).catch(() => undefined);
      }
    },
    [effectiveScrumRole, rawDeleteFile, serverBackend]
  );

  const updateMarkdownFileContent = useCallback(
    (targetPath: string, content: string) => {
      if (effectiveScrumRole === "stakeholder") return;
      rawUpdateMarkdownContent(targetPath, content);
      if (serverBackend.serverMode && serverBackend.authUser) {
        const prevTimer = debounceTimersRef.current[targetPath];
        if (prevTimer) clearTimeout(prevTimer);
        debounceTimersRef.current[targetPath] = setTimeout(() => {
          const existing = filesRef.current.find((f) => f.path === targetPath);
          const payload: WorkspaceFile = {
            path: targetPath,
            name: existing?.name || targetPath.split("/").pop() || targetPath,
            category: existing?.category || "other",
            content,
          };
          void serverBackend.syncUpsertServerFile(payload, "edit_wiki").catch(() => undefined);
        }, 900);
      }
    },
    [effectiveScrumRole, filesRef, rawUpdateMarkdownContent, serverBackend]
  );

  const refreshConflicts = useCallback(async () => {
    if (isTauri && tauriRootFolder) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const list = await invoke<string[]>("git_list_conflicts", { repoPath: tauriRootFolder });
        setTauriConflicts(Array.isArray(list) ? list : []);
      } catch {
        setTauriConflicts([]);
      }
    } else {
      setTauriConflicts([]);
    }
    if (serverBackend.serverMode && serverBackend.authUser) {
      void serverBackend.refreshTeamAndProjects().catch(() => undefined);
    }
  }, [isTauri, serverBackend, tauriRootFolder]);

  useEffect(() => {
    void refreshConflicts();
  }, [refreshConflicts]);

  const conflictPaths = useMemo(() => {
    const set = new Set<string>();
    for (const f of files) {
      if (hasConflictMarkers(f.content)) set.add(f.path);
    }
    for (const p of serverBackend.gitStatus?.conflicts || []) {
      if (p) set.add(p);
    }
    for (const p of tauriConflicts) {
      if (p) set.add(p);
    }
    return Array.from(set).sort();
  }, [files, serverBackend.gitStatus?.conflicts, tauriConflicts]);

  const storedSessionToken =
    typeof window !== "undefined" ? localStorage.getItem("mdteam_session_token") || "" : "";

  const openGitRepoModal = useCallback((tab: "clone" | "remote" | "blank" = "clone") => {
    setGitRepoModalInitialTab(tab);
    setIsGitRepoModalOpen(true);
  }, []);

  return {
    ...serverBackend,
    sessionToken: storedSessionToken,
    effectiveScrumRole,
    isStakeholderReadOnly,
    canPerformAction,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isTeamAdminModalOpen,
    setIsTeamAdminModalOpen,
    isConflictModalOpen,
    setIsConflictModalOpen,
    isGitRepoModalOpen,
    setIsGitRepoModalOpen,
    gitRepoModalInitialTab,
    setGitRepoModalInitialTab,
    openGitRepoModal,
    conflictPaths,
    conflictCount: conflictPaths.length,
    refreshConflicts,
    handleUpsertWorkspaceFile,
    handleUpsertMultipleFiles,
    handleDeleteWorkspaceFile,
    updateMarkdownFileContent,
  };
}
