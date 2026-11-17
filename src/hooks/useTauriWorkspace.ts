"use client";

import { useState, useEffect } from "react";
import type React from "react";
import type { WorkspaceFile } from "../utils/issueEngine";
import type { WorkspaceLanguage } from "../constants/translations";
import { scanTauriWorkspaceDir } from "../utils/workspace/tauriFsScanner";
import { useTauriGitSync } from "./useTauriGitSync";

interface UseTauriWorkspaceParams {
  language: WorkspaceLanguage;
  files: WorkspaceFile[];
  setFiles: React.Dispatch<React.SetStateAction<WorkspaceFile[]>>;
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  activeFilePath: string;
  setActiveFilePath: React.Dispatch<React.SetStateAction<string>>;
  activeFilePathB: string;
  setActiveFilePathB: React.Dispatch<React.SetStateAction<string>>;
  setOpenTabs: React.Dispatch<React.SetStateAction<string[]>>;
  setOpenTabsB: React.Dispatch<React.SetStateAction<string[]>>;
}

export function getFolderBasename(pathStr: string): string {
  const normalized = pathStr.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || pathStr;
}

export function useTauriWorkspace({
  language,
  files,
  setFiles,
  setCategories,
  activeFilePath,
  setActiveFilePath,
  activeFilePathB,
  setActiveFilePathB,
  setOpenTabs,
  setOpenTabsB,
}: UseTauriWorkspaceParams) {
  const [isTauri, setIsTauri] = useState<boolean>(false);
  const [tauriRootFolder, setTauriRootFolder] = useState<string>("");
  const [recentProjects, setRecentProjects] = useState<string[]>([]);

  const gitSync = useTauriGitSync({
    tauriRootFolder,
    language,
    files,
    setFiles,
  });

  const { syncGitStatus, setModifiedFiles, handleGitPullWithRescan } = gitSync;

  useEffect(() => {
    setIsTauri(typeof window !== "undefined" && (window as any).__TAURI__ !== undefined);
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("mdteam_recent_projects");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setRecentProjects(parsed.filter((item) => typeof item === "string"));
          }
        }
      } catch (e) {
        console.error("Failed to parse mdteam_recent_projects from localStorage:", e);
      }
    }
  }, []);

  const rescanTauriFiles = async (rootPath = tauriRootFolder) => {
    if (!rootPath) return;
    try {
      const scanned = await scanTauriWorkspaceDir(rootPath);
      setCategories(scanned.categories);
      setFiles(scanned.files);
    } catch (e) {
      console.error("Failed to rescan files:", e);
    }
  };

  const handleUpsertWorkspaceFile = async (file: WorkspaceFile) => {
    const normalizedPath = file.path.replace(/\\/g, "/");
    const slashIdx = normalizedPath.lastIndexOf("/");
    const derivedCat = file.category || (slashIdx !== -1 ? normalizedPath.slice(0, slashIdx) : "other");
    const derivedName = file.name || (slashIdx !== -1 ? normalizedPath.slice(slashIdx + 1) : normalizedPath);
    const normalizedFile: WorkspaceFile = {
      path: normalizedPath,
      name: derivedName,
      category: derivedCat,
      content: file.content,
    };

    setFiles((prev) => {
      const existsIdx = prev.findIndex((f) => f.path === normalizedPath);
      if (existsIdx !== -1) {
        const next = [...prev];
        next[existsIdx] = normalizedFile;
        return next;
      }
      return [...prev, normalizedFile];
    });

    if (derivedCat && !derivedCat.startsWith(".")) {
      setCategories((prev) => (prev.includes(derivedCat) ? prev : [...prev, derivedCat].sort()));
    }

    setModifiedFiles((prev) => ({ ...prev, [normalizedPath]: true }));

    if (isTauri && tauriRootFolder) {
      try {
        const { mkdir, writeTextFile } = await import("@tauri-apps/plugin-fs");
        const cleanRoot = tauriRootFolder.replace(/[\\/]+$/, "");
        const absPath = `${cleanRoot}/${normalizedPath}`;
        const lastSlash = absPath.lastIndexOf("/");
        if (lastSlash > 0) {
          await mkdir(absPath.slice(0, lastSlash), { recursive: true });
        }
        await writeTextFile(absPath, normalizedFile.content);
      } catch (err) {
        console.error("Failed to write workspace file to Tauri disk:", normalizedPath, err);
      }
    }
  };

  const handleUpsertMultipleFiles = async (newFiles: WorkspaceFile[]) => {
    if (!newFiles || newFiles.length === 0) return;

    const normalizedList: WorkspaceFile[] = newFiles.map((file) => {
      const normalizedPath = file.path.replace(/\\/g, "/");
      const slashIdx = normalizedPath.lastIndexOf("/");
      const derivedCat = file.category || (slashIdx !== -1 ? normalizedPath.slice(0, slashIdx) : "other");
      const derivedName = file.name || (slashIdx !== -1 ? normalizedPath.slice(slashIdx + 1) : normalizedPath);
      return {
        path: normalizedPath,
        name: derivedName,
        category: derivedCat,
        content: file.content,
      };
    });

    setFiles((prev) => {
      const map = new Map<string, WorkspaceFile>();
      prev.forEach((f) => map.set(f.path, f));
      normalizedList.forEach((nf) => map.set(nf.path, nf));
      return Array.from(map.values());
    });

    setCategories((prev) => {
      const catSet = new Set(prev);
      normalizedList.forEach((nf) => {
        if (nf.category && !nf.category.startsWith(".")) {
          catSet.add(nf.category);
        }
      });
      return Array.from(catSet).sort();
    });

    setModifiedFiles((prev) => {
      const next = { ...prev };
      normalizedList.forEach((nf) => {
        next[nf.path] = true;
      });
      return next;
    });

    if (isTauri && tauriRootFolder) {
      try {
        const { mkdir, writeTextFile } = await import("@tauri-apps/plugin-fs");
        const cleanRoot = tauriRootFolder.replace(/[\\/]+$/, "");
        for (const nf of normalizedList) {
          const absPath = `${cleanRoot}/${nf.path}`;
          const lastSlash = absPath.lastIndexOf("/");
          if (lastSlash > 0) {
            await mkdir(absPath.slice(0, lastSlash), { recursive: true });
          }
          await writeTextFile(absPath, nf.content);
        }
      } catch (err) {
        console.error("Failed to batch-write workspace files to Tauri disk:", err);
      }
    }
  };

  const handleDeleteWorkspaceFile = async (targetPath: string) => {
    const normalizedPath = targetPath.replace(/\\/g, "/");
    setFiles((prev) => {
      const remaining = prev.filter((f) => f.path !== normalizedPath);
      if (activeFilePath === normalizedPath) {
        setActiveFilePath(remaining[0]?.path || "");
      }
      if (activeFilePathB === normalizedPath) {
        setActiveFilePathB(remaining[0]?.path || "");
      }
      return remaining;
    });
    setOpenTabs((prev) => prev.filter((t) => t !== normalizedPath));
    setOpenTabsB((prev) => prev.filter((t) => t !== normalizedPath));
    setModifiedFiles((prev) => {
      const next = { ...prev };
      delete next[normalizedPath];
      return next;
    });

    if (isTauri && tauriRootFolder) {
      try {
        const { exists, remove } = await import("@tauri-apps/plugin-fs");
        const cleanRoot = tauriRootFolder.replace(/[\\/]+$/, "");
        const absPath = `${cleanRoot}/${normalizedPath}`;
        if (await exists(absPath)) {
          await remove(absPath);
        }
      } catch (err) {
        console.error("Failed to delete workspace file from Tauri disk:", normalizedPath, err);
      }
    }
  };

  const addRecentProject = (path: string) => {
    setRecentProjects((prev) => {
      const updated = [path, ...prev.filter((p) => p !== path)].slice(0, 5);
      if (typeof window !== "undefined") {
        localStorage.setItem("mdteam_recent_projects", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleRemoveRecentProject = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentProjects((prev) => {
      const updated = prev.filter((p) => p !== path);
      if (typeof window !== "undefined") {
        localStorage.setItem("mdteam_recent_projects", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleSwitchProject = async (path: string) => {
    try {
      setTauriRootFolder(path);
      addRecentProject(path);
      setOpenTabs([]);
      setActiveFilePath("");
      setActiveFilePathB("");

      await rescanTauriFiles(path);
      await syncGitStatus(path);

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("git_pull", { repoPath: path });
        await rescanTauriFiles(path);
        await syncGitStatus(path);
      } catch (pullErr) {
        console.log("Git auto-pull skipped or failed (perhaps no remote setup):", pullErr);
      }
    } catch (e) {
      console.error("Error switching projects:", e);
      alert(language === "en" ? `Failed to switch project: ${e}` : `Fehler beim Projektwechsel: ${e}`);
    }
  };

  const openLocalFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: language === "en" ? "Select Workspace Directory" : "Projektverzeichnis auswählen",
      });

      if (!selected || typeof selected !== "string") return;

      setTauriRootFolder(selected);
      addRecentProject(selected);

      await rescanTauriFiles(selected);
      await syncGitStatus(selected);

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("git_pull", { repoPath: selected });
        await rescanTauriFiles(selected);
        await syncGitStatus(selected);
      } catch (pullErr) {
        console.log("Git auto-pull skipped or failed (perhaps no remote setup):", pullErr);
      }
    } catch (e) {
      console.error("Error opening local folder:", e);
      alert(language === "en" ? `Failed to load directory: ${e}` : `Fehler beim Laden des Verzeichnisses: ${e}`);
    }
  };

  const handleGitPull = async () => {
    await handleGitPullWithRescan(rescanTauriFiles);
  };

  // Synchronize changes to local disk in Tauri Mode (1-second debounce)
  useEffect(() => {
    if (!tauriRootFolder) return;

    let isMounted = true;
    const saveToDisk = async () => {
      try {
        const { mkdir, writeTextFile } = await import("@tauri-apps/plugin-fs");
        const cleanRoot = tauriRootFolder.replace(/[\\/]+$/, "");
        for (const file of files) {
          if (!isMounted) return;
          const absPath = `${cleanRoot}/${file.path}`;
          const lastSlash = absPath.lastIndexOf("/");
          if (lastSlash > 0) {
            await mkdir(absPath.slice(0, lastSlash), { recursive: true });
          }
          await writeTextFile(absPath, file.content);
        }

        if (isMounted) {
          await syncGitStatus();
        }
      } catch (e) {
        console.error("Error synchronizing files to disk:", e);
      }
    };

    const handler = setTimeout(saveToDisk, 1000);
    return () => {
      isMounted = false;
      clearTimeout(handler);
    };
  }, [files, tauriRootFolder]);

  return {
    isTauri,
    tauriRootFolder,
    setTauriRootFolder,
    recentProjects,
    getFolderBasename,
    handleRemoveRecentProject,
    handleSwitchProject,
    openLocalFolder,
    rescanTauriFiles,
    handleUpsertWorkspaceFile,
    handleUpsertMultipleFiles,
    handleDeleteWorkspaceFile,
    handleGitPull,
    ...gitSync,
  };
}
