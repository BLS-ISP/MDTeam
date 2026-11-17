import type { WorkspaceFile } from "../issueEngine";
import { DEFAULT_CATEGORIES, INITIAL_FILES } from "../../constants/seedFiles";

export async function scanTauriWorkspaceDir(
  rootPath: string
): Promise<{ files: WorkspaceFile[]; categories: string[] }> {
  const { readDir, readTextFile, mkdir, exists, writeTextFile } = await import("@tauri-apps/plugin-fs");
  const loadedFiles: WorkspaceFile[] = [];
  const loadedCategories = new Set<string>();
  const cleanRoot = rootPath.replace(/[\\/]+$/, "");

  const scan = async (dirPath: string, relativePath: string = "") => {
    const entries = await readDir(dirPath);
    for (const entry of entries) {
      if (
        entry.name.startsWith(".") ||
        entry.name === "node_modules" ||
        entry.name === "out" ||
        entry.name === "target" ||
        entry.name === "dist" ||
        entry.name === "public" ||
        entry.name === "src" ||
        entry.name === "src-tauri" ||
        entry.name === "assets"
      ) {
        continue;
      }

      const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const entryAbsPath = `${dirPath}/${entry.name}`;

      if (entry.isDirectory) {
        loadedCategories.add(entryRelPath);
        await scan(entryAbsPath, entryRelPath);
      } else if (entry.isFile && entry.name.endsWith(".md")) {
        const content = await readTextFile(entryAbsPath);
        const parentDir = relativePath || "other";
        loadedCategories.add(parentDir);
        loadedFiles.push({
          path: entryRelPath,
          name: entry.name,
          category: parentDir,
          content,
        });
      }
    }
  };

  await scan(cleanRoot);

  if (loadedFiles.length === 0) {
    for (const d of DEFAULT_CATEGORIES) {
      await mkdir(`${cleanRoot}/${d}`, { recursive: true });
      loadedCategories.add(d);
    }

    for (const initFile of INITIAL_FILES) {
      const absPath = `${cleanRoot}/${initFile.path}`;
      const lastSlash = absPath.lastIndexOf("/");
      if (lastSlash > 0) {
        await mkdir(absPath.slice(0, lastSlash), { recursive: true });
      }
      await writeTextFile(absPath, initFile.content);
      loadedFiles.push(initFile);
    }
  } else {
    for (const agileDir of ["issues", "sprints", "wiki"]) {
      await mkdir(`${cleanRoot}/${agileDir}`, { recursive: true });
      loadedCategories.add(agileDir);
    }
  }

  try {
    const inlineCommentsPath = `${cleanRoot}/.mdteam/inline-comments.json`;
    if (await exists(inlineCommentsPath)) {
      const commentsRaw = await readTextFile(inlineCommentsPath);
      loadedFiles.push({
        path: ".mdteam/inline-comments.json",
        name: "inline-comments.json",
        category: ".mdteam",
        content: commentsRaw,
      });
    }
  } catch {
    // Ignore if .mdteam/inline-comments.json does not exist yet
  }

  const categories = Array.from(loadedCategories)
    .filter((c) => !c.startsWith("."))
    .sort();

  return { files: loadedFiles, categories };
}
