"use client";

import { useState } from "react";
import type React from "react";
import type { WorkspaceFile } from "../utils/issueEngine";
import type { Commit } from "../utils/workspace/agileMarkdownParsers";
import type { WorkspaceLanguage } from "../constants/translations";
import { INITIAL_FILES } from "../constants/seedFiles";

interface UseTauriGitSyncParams {
  tauriRootFolder: string;
  language: WorkspaceLanguage;
  files: WorkspaceFile[];
  setFiles: React.Dispatch<React.SetStateAction<WorkspaceFile[]>>;
}

export function useTauriGitSync({
  tauriRootFolder,
  language,
  files,
  setFiles,
}: UseTauriGitSyncParams) {
  const [modifiedFiles, setModifiedFiles] = useState<{ [path: string]: boolean }>({});
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [activeBranch, setActiveBranch] = useState<string>("main");
  const [branchFiles, setBranchFiles] = useState<{ [branch: string]: WorkspaceFile[] }>(() => ({
    main: INITIAL_FILES,
    "feature/auth-strategy": INITIAL_FILES.map((f) =>
      f.path === "adrs/ADR-0001-auth-strategy.md"
        ? { ...f, content: f.content + "\n\n## Update\n*   [ ] LDAP Konfiguration validieren.\n" }
        : f
    ),
  }));
  const [showBranchMenu, setShowBranchMenu] = useState<boolean>(false);
  const [commits, setCommits] = useState<Commit[]>([
    {
      hash: "a4f89d2",
      message: "Initialisiert arc42 Struktur und erste Architekturkonzepte",
      author: "Max Mustermann",
      date: "03.06.2026 15:30",
      files: ["arc42/01_introduction_goals.md", "arc42/02_constraints.md"],
    },
  ]);

  const syncGitStatus = async (rootPath = tauriRootFolder) => {
    if (!rootPath) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");

      // 1. Fetch native Git Status
      try {
        const statusOutput = await invoke<string>("git_status", { repoPath: rootPath });
        const lines = statusOutput.split("\n").filter((l) => l.trim() !== "");
        const localMods: { [path: string]: boolean } = {};

        lines.forEach((line) => {
          if (line.length >= 3) {
            let filepath = line.substring(3).trim();
            if (filepath.startsWith('"') && filepath.endsWith('"')) {
              filepath = filepath.substring(1, filepath.length - 1);
            }
            filepath = filepath.replace(/\\/g, "/");
            localMods[filepath] = true;
          }
        });

        setModifiedFiles(localMods);
      } catch (e: any) {
        if (e && typeof e === "string" && e.includes("not a git repository")) {
          setModifiedFiles({});
        } else {
          console.error("Git status failed:", e);
        }
      }

      // 2. Fetch native Git Current Branch
      try {
        const branchOut = await invoke<string>("git_current_branch", { repoPath: rootPath });
        if (branchOut && branchOut.trim()) {
          setActiveBranch(branchOut.trim());
        }
      } catch {
        // Ignore if not a git repo yet
      }

      // 3. Fetch native Git Log
      try {
        const logOutput = await invoke<string>("git_log", { repoPath: rootPath, limit: 15 });
        const lines = logOutput.split("\n").filter((l) => l.trim() !== "");
        const loadedCommits = lines.map((line) => {
          const [hash, message, author, date] = line.split("|");
          return {
            hash: hash || "unknown",
            message: message || "",
            author: author || "unknown",
            date: date || "",
            files: [],
          };
        });
        setCommits(loadedCommits);
      } catch (e) {
        console.error("Git log failed:", e);
      }
    } catch (err) {
      console.error("Failed to run tauri core invoke:", err);
    }
  };

  const handleGitPullWithRescan = async (rescanFn: (rootPath?: string) => Promise<void>) => {
    if (!tauriRootFolder) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("git_pull", { repoPath: tauriRootFolder });
      alert(language === "en" ? "Pull successful!" : "Pull erfolgreich!");
      await rescanFn();
      await syncGitStatus();
    } catch (e: any) {
      console.error("Git pull failed:", e);
      alert(language === "en" ? `Git pull failed: ${e}` : `Git-Pull fehlgeschlagen: ${e}`);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;

    if (tauriRootFolder) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");

        let isGitRepo = true;
        try {
          await invoke("git_status", { repoPath: tauriRootFolder });
        } catch (e: any) {
          if (e && typeof e === "string" && e.includes("not a git repository")) {
            isGitRepo = false;
          }
        }

        if (!isGitRepo) {
          const confirmInit = window.confirm(
            language === "en"
              ? "This directory is not a Git repository. Would you like to initialize Git?"
              : "Dieses Verzeichnis ist kein Git-Repository. Möchten Sie Git initialisieren?"
          );
          if (confirmInit) {
            await invoke("git_init", { repoPath: tauriRootFolder });
            alert(
              language === "en"
                ? "Git repository successfully initialized!"
                : "Git-Repository erfolgreich initialisiert!"
            );
          } else {
            return;
          }
        }

        await invoke("git_commit", { repoPath: tauriRootFolder, message: commitMessage });

        try {
          await invoke("git_push", { repoPath: tauriRootFolder });
        } catch (pushErr) {
          console.log("Git push skipped or failed (perhaps no remote is set up):", pushErr);
        }

        setCommitMessage("");
        await syncGitStatus();
      } catch (err: any) {
        console.error("Git commit failed:", err);
        alert(language === "en" ? `Git commit failed: ${err}` : `Git-Commit fehlgeschlagen: ${err}`);
      }
    } else {
      const changedPaths = Object.keys(modifiedFiles).filter((k) => modifiedFiles[k]);
      if (changedPaths.length === 0) return;

      const newCommit: Commit = {
        hash: Math.random().toString(16).substring(2, 9),
        message: commitMessage,
        author: "Entwickler (LDAP/SSO)",
        date: new Date().toLocaleString(),
        files: changedPaths,
      };

      setCommits((prev) => [newCommit, ...prev]);
      setModifiedFiles({});
      setCommitMessage("");
    }
  };

  const handleSwitchBranch = (branchName: string) => {
    setBranchFiles((prev) => ({
      ...prev,
      [activeBranch]: files,
    }));
    const targetFiles = branchFiles[branchName] || INITIAL_FILES;
    setFiles(targetFiles);
    setActiveBranch(branchName);
    setModifiedFiles({});
  };

  const handleCreateBranch = () => {
    const name = prompt("Name des neuen Branches:");
    if (!name) return;
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, "-");
    setBranchFiles((prev) => ({
      ...prev,
      [activeBranch]: files,
      [cleanName]: files,
    }));
    setActiveBranch(cleanName);
    setModifiedFiles({});
  };

  return {
    modifiedFiles,
    setModifiedFiles,
    commitMessage,
    setCommitMessage,
    activeBranch,
    setActiveBranch,
    branchFiles,
    showBranchMenu,
    setShowBranchMenu,
    commits,
    setCommits,
    syncGitStatus,
    handleGitPullWithRescan,
    handleCommit,
    handleSwitchBranch,
    handleCreateBranch,
  };
}
