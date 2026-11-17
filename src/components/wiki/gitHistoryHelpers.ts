import type { PageVersionEntry, WorkspaceFile } from "./wikiTypes";
import {
  loadSessionSnapshots,
  recordPageSessionSnapshot,
} from "./wikiStorageUtils";

export function parseGitHistoryOutput(rawOutput: string): PageVersionEntry[] {
  const entries: PageVersionEntry[] = [];
  const lines = rawOutput
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Format from Rust git_file_history: %h|%s|%an|%ad
    // Parse first pipe from left and last two pipes from right so `%s` containing `|` never breaks!
    const firstPipe = line.indexOf("|");
    const lastPipe = line.lastIndexOf("|");
    if (firstPipe === -1 || lastPipe === -1 || firstPipe === lastPipe) continue;

    const commitHash = line.slice(0, firstPipe).trim();
    const date = line.slice(lastPipe + 1).trim();
    const middle = line.slice(firstPipe + 1, lastPipe);
    const secondLastPipe = middle.lastIndexOf("|");

    let message = middle.trim();
    let author = "Git Author";
    if (secondLastPipe !== -1) {
      message = middle.slice(0, secondLastPipe).trim();
      author = middle.slice(secondLastPipe + 1).trim() || "Git Author";
    }

    if (commitHash) {
      entries.push({
        id: `git-${commitHash}`,
        commitHash,
        message: message || "Commit",
        author,
        date,
        source: "git",
      });
    }
  }

  return entries;
}

export async function loadCombinedPageVersions(
  activeFile: WorkspaceFile,
  isTauri: boolean,
  tauriRootFolder: string | undefined,
  currentUser: string
): Promise<PageVersionEntry[]> {
  const combined: PageVersionEntry[] = [];

  // 1. Try native Git history when running inside Tauri with an open repository
  if (isTauri && tauriRootFolder) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const rawLog = await invoke<string>("git_file_history", {
        repoPath: tauriRootFolder,
        filePath: activeFile.path,
        limit: 20,
      });
      if (rawLog && rawLog.trim()) {
        combined.push(...parseGitHistoryOutput(rawLog));
      }
    } catch (err) {
      console.warn(
        "git_file_history unavailable or file untracked, falling back to session snapshots:",
        err
      );
    }
  }

  // 2. Load browser / session snapshots (used directly in browser mode or appended for uncommitted edits)
  recordPageSessionSnapshot(activeFile, currentUser);
  const sessionSnaps = loadSessionSnapshots(activeFile.path).map(
    (snap): PageVersionEntry => ({
      id: `session-${snap.id}`,
      commitHash: snap.commitHash,
      message: snap.message,
      author: snap.author,
      date: snap.date,
      source: "session",
      snapshotContent: snap.content,
    })
  );

  if (combined.length === 0) {
    combined.push(...sessionSnaps);
  } else {
    // Include latest session checkpoints if uncommitted local changes exist
    for (const snap of sessionSnaps.slice(0, 5)) {
      combined.push(snap);
    }
  }

  return combined;
}

export async function fetchGitFileAtCommit(
  tauriRootFolder: string,
  commitHash: string,
  filePath: string
): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("git_show_file_at_commit", {
    repoPath: tauriRootFolder,
    commitHash,
    filePath,
  });
}
