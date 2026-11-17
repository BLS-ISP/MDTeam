"use client";

import { useState, useEffect, useCallback } from "react";
import type { GitBranchEntry } from "./modalTypesAndBadges";

const SANDBOX_BRANCHES_STORAGE_KEY = "mdteam_sandbox_branches";
const SANDBOX_CURRENT_BRANCH_KEY = "mdteam_sandbox_current_branch";

export function sanitizeClientBranchName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._/-]+/g, "-")
    .replace(/\.{2,}/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^[-./]+|[-./]+$/g, "");
}

function persistSandboxState(list: string[], current: string) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SANDBOX_BRANCHES_STORAGE_KEY, JSON.stringify(list));
      localStorage.setItem(SANDBOX_CURRENT_BRANCH_KEY, current);
    } catch {
      // ignore
    }
  }
}

export interface UseGitBranchManagerArgs {
  isOpen: boolean;
  isEn: boolean;
  useNativeGit: boolean;
  useServerGit?: boolean;
  tauriRootFolder: string | null;
  initialNewBranchName: string;
  resolvedExternalBranch?: string;
  onBranchChange?: (branchName: string) => void;
  onBranchChanged?: (branchName: string) => void;
  onListServerBranches?: () => Promise<{
    currentBranch: string;
    branches: Array<{ name: string; isCurrent: boolean; isRemote?: boolean }>;
  }>;
  onCheckoutServerBranch?: (branch: string, createNew: boolean) => Promise<{ branch: string }>;
}

export function useGitBranchManager({
  isOpen,
  isEn,
  useNativeGit,
  useServerGit = false,
  tauriRootFolder,
  initialNewBranchName,
  resolvedExternalBranch,
  onBranchChange,
  onBranchChanged,
  onListServerBranches,
  onCheckoutServerBranch,
}: UseGitBranchManagerArgs) {
  const notifyBranchChange = useCallback(
    (name: string) => {
      onBranchChange?.(name);
      onBranchChanged?.(name);
    },
    [onBranchChange, onBranchChanged]
  );

  const [branches, setBranches] = useState<GitBranchEntry[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>(resolvedExternalBranch || "main");
  const [newBranchName, setNewBranchName] = useState<string>(initialNewBranchName || "");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const loadBranches = useCallback(async () => {
    setErrorMsg("");
    if (useServerGit && onListServerBranches) {
      setIsLoading(true);
      try {
        const res = await onListServerBranches();
        const curr = res.currentBranch || "main";
        const parsed: GitBranchEntry[] = res.branches.map((b) => ({
          name: b.name,
          isCurrent: b.isCurrent || b.name === curr,
        }));
        setActiveBranch(curr);
        setBranches(parsed);
        notifyBranchChange(curr);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
      return;
    }
    if (useNativeGit && tauriRootFolder) {
      setIsLoading(true);
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const [currRaw, listRaw] = await Promise.all([
          invoke<string>("git_current_branch", { repoPath: tauriRootFolder }).catch(() => "HEAD"),
          invoke<string>("git_list_branches", { repoPath: tauriRootFolder }).catch(() => ""),
        ]);

        const curr = (currRaw || "").trim() || "main";
        const parsed: GitBranchEntry[] = listRaw
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .map((line) => {
            const [namePart, headFlag] = line.split("|");
            const cleanName = (namePart || "").trim();
            return {
              name: cleanName,
              isCurrent: (headFlag || "").trim() === "*" || cleanName === curr,
            };
          })
          .filter((b) => Boolean(b.name));

        if (parsed.length === 0 && curr) {
          parsed.push({ name: curr, isCurrent: true });
        }

        setActiveBranch(curr);
        setBranches(parsed);
        notifyBranchChange(curr);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    } else {
      // Browser Sandbox Mode persisted in localStorage
      let savedList = ["main", "develop", "feat/MDT-101-platform-architecture"];
      let savedCurrent = resolvedExternalBranch || "main";
      if (typeof window !== "undefined") {
        try {
          const rawList = localStorage.getItem(SANDBOX_BRANCHES_STORAGE_KEY);
          if (rawList) {
            const arr = JSON.parse(rawList);
            if (Array.isArray(arr) && arr.length > 0) {
              savedList = arr.map(String);
            }
          }
          const rawCurr = localStorage.getItem(SANDBOX_CURRENT_BRANCH_KEY);
          if (rawCurr) savedCurrent = rawCurr;
        } catch {
          // ignore storage errors
        }
      }
      if (!savedList.includes(savedCurrent)) {
        savedList = [savedCurrent, ...savedList];
      }
      setActiveBranch(savedCurrent);
      setBranches(
        savedList.map((name) => ({
          name,
          isCurrent: name === savedCurrent,
        }))
      );
    }
  }, [useServerGit, onListServerBranches, useNativeGit, tauriRootFolder, resolvedExternalBranch, notifyBranchChange]);

  useEffect(() => {
    if (isOpen) {
      setStatusMsg("");
      setErrorMsg("");
      setNewBranchName(initialNewBranchName || "");
      loadBranches();
    }
  }, [isOpen, initialNewBranchName, loadBranches]);

  const handleCheckout = async (targetBranch: string, createNew: boolean) => {
    setErrorMsg("");
    setStatusMsg("");
    const safeName = sanitizeClientBranchName(targetBranch);

    if (!safeName || safeName.startsWith("-")) {
      setErrorMsg(
        isEn
          ? "Please enter a valid Git branch name (cannot start with '-')."
          : "Bitte einen gültigen Git-Branch-Namen eingeben (darf nicht mit '-' beginnen)."
      );
      return;
    }

    if (useServerGit && onCheckoutServerBranch) {
      setIsLoading(true);
      try {
        const res = await onCheckoutServerBranch(safeName, createNew);
        setNewBranchName("");
        setStatusMsg(
          isEn
            ? `Switched server repository to branch '${res.branch}'`
            : `Server-Repository auf Branch '${res.branch}' gewechselt`
        );
        await loadBranches();
        notifyBranchChange(res.branch);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (useNativeGit && tauriRootFolder) {
      setIsLoading(true);
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke<string>("git_checkout_branch", {
          repoPath: tauriRootFolder,
          branchName: safeName,
          create: createNew,
        });
        setNewBranchName("");
        setStatusMsg(
          isEn
            ? `Switched to branch '${safeName}'`
            : `Auf Branch '${safeName}' gewechselt`
        );
        await loadBranches();
        notifyBranchChange(safeName);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    } else {
      // Browser Sandbox Mode
      const names = branches.map((b) => b.name);
      if (createNew && names.includes(safeName)) {
        setErrorMsg(
          isEn
            ? `Branch '${safeName}' already exists.`
            : `Branch '${safeName}' existiert bereits.`
        );
        return;
      }
      const updatedNames = names.includes(safeName) ? names : [safeName, ...names];
      persistSandboxState(updatedNames, safeName);
      setActiveBranch(safeName);
      setBranches(
        updatedNames.map((n) => ({
          name: n,
          isCurrent: n === safeName,
        }))
      );
      setNewBranchName("");
      setStatusMsg(
        isEn
          ? `Checked out '${safeName}' (Browser Sandbox)`
          : `Branch '${safeName}' aktiviert (Browser-Sandbox)`
      );
      notifyBranchChange(safeName);
    }
  };

  const applyBranchPrefix = (prefix: string) => {
    const stripped = newBranchName.replace(/^(feat|fix|docs|chore|spike)\//, "");
    setNewBranchName(`${prefix}${stripped}`);
  };

  return {
    branches,
    activeBranch,
    newBranchName,
    setNewBranchName,
    isLoading,
    errorMsg,
    statusMsg,
    loadBranches,
    handleCheckout,
    applyBranchPrefix,
  };
}
