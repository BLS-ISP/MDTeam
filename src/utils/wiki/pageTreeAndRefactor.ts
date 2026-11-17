import type { WorkspaceFile } from "../../components/wiki/wikiTypes";

export type { WorkspaceFile };

export interface WikiTreeNode {
  id: string;
  kind: "folder" | "file";
  name: string;
  displayTitle: string;
  path: string;
  depth: number;
  file?: WorkspaceFile;
  children: WikiTreeNode[];
}

const STANDARD_ROOT_ORDER = [
  "arc42",
  "adrs",
  "issues",
  "sprints",
  "wiki",
  "management",
  "meetings",
];

export function normalizeWorkspacePath(rawPath: string): string {
  return rawPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
}

export function slugifyWikiSegment(raw: string): string {
  const withoutExt = raw.trim().replace(/\.md$/i, "");
  const slug = withoutExt
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "subpage";
}

function getParentDir(normalizedPath: string): string {
  const slashIdx = normalizedPath.lastIndexOf("/");
  return slashIdx === -1 ? "" : normalizedPath.slice(0, slashIdx);
}

function getBasename(normalizedPath: string): string {
  const slashIdx = normalizedPath.lastIndexOf("/");
  return slashIdx === -1 ? normalizedPath : normalizedPath.slice(slashIdx + 1);
}

function compareRootFolders(a: string, b: string): number {
  const idxA = STANDARD_ROOT_ORDER.indexOf(a);
  const idxB = STANDARD_ROOT_ORDER.indexOf(b);
  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
  if (idxA !== -1) return -1;
  if (idxB !== -1) return 1;
  return a.localeCompare(b);
}

function sortTreeChildren(nodes: WikiTreeNode[], isRoot: boolean): WikiTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    if (isRoot && a.kind === "folder" && b.kind === "folder") {
      return compareRootFolders(a.path, b.path);
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}

function mergeSubpageFoldersIntoParentPages(nodes: WikiTreeNode[], isRoot: boolean): WikiTreeNode[] {
  for (const node of nodes) {
    if (node.children.length > 0) {
      node.children = mergeSubpageFoldersIntoParentPages(node.children, false);
    }
  }

  const fileNodeByStem = new Map<string, WikiTreeNode>();
  for (const node of nodes) {
    if (node.kind === "file" && node.name.toLowerCase().endsWith(".md")) {
      fileNodeByStem.set(node.path.replace(/\.md$/i, "").toLowerCase(), node);
    }
  }

  const merged: WikiTreeNode[] = [];
  for (const node of nodes) {
    if (node.kind === "folder") {
      const matchingPage = fileNodeByStem.get(node.path.toLowerCase());
      if (matchingPage && node.children.length > 0) {
        matchingPage.children = sortTreeChildren([...matchingPage.children, ...node.children], false);
        continue;
      }
    }
    merged.push(node);
  }
  return sortTreeChildren(merged, isRoot);
}

function assignNodeDepths(nodes: WikiTreeNode[], depth: number): void {
  for (const node of nodes) {
    node.depth = depth;
    if (node.children.length > 0) assignNodeDepths(node.children, depth + 1);
  }
}

/**
 * Builds a recursive tree (`WikiTreeNode`) of folders and nested pages of arbitrary depth
 * (e.g. `wiki/architecture/security/oauth-flow.md`) across all categories.
 */
export function buildWikiPageTree(
  files: WorkspaceFile[],
  categories: string[] = [],
  rootLabels: Record<string, string> = {}
): WikiTreeNode[] {
  const folderMap = new Map<string, WikiTreeNode>();
  const roots: WikiTreeNode[] = [];

  const ensureFolderNode = (rawFolderPath: string): WikiTreeNode | null => {
    const clean = normalizeWorkspacePath(rawFolderPath);
    if (!clean || clean.startsWith(".")) return null;
    const segments = clean.split("/").filter(Boolean);
    if (segments.some((seg) => seg.startsWith("."))) return null;

    let currentPath = "";
    let parentNode: WikiTreeNode | null = null;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      currentPath = i === 0 ? seg : `${currentPath}/${seg}`;
      let existing = folderMap.get(currentPath);
      if (!existing) {
        existing = {
          id: `folder:${currentPath}`,
          kind: "folder",
          name: seg,
          displayTitle: i === 0 && rootLabels[currentPath] ? rootLabels[currentPath] : seg,
          path: currentPath,
          depth: i,
          children: [],
        };
        folderMap.set(currentPath, existing);
        if (parentNode) parentNode.children.push(existing);
        else roots.push(existing);
      }
      parentNode = existing;
    }
    return parentNode;
  };

  for (const cat of categories) ensureFolderNode(cat);

  for (const file of files) {
    const cleanPath = normalizeWorkspacePath(file.path);
    if (!cleanPath || cleanPath.startsWith(".")) continue;
    const parentDir = getParentDir(cleanPath) || normalizeWorkspacePath(file.category);
    if (parentDir && parentDir.startsWith(".")) continue;
    const base = file.name || getBasename(cleanPath);

    const fileNode: WikiTreeNode = {
      id: `file:${cleanPath}`,
      kind: "file",
      name: base,
      displayTitle: base,
      path: cleanPath,
      depth: 0,
      file: { ...file, path: cleanPath, name: base, category: parentDir || file.category || "other" },
      children: [],
    };

    const folderNode = parentDir ? ensureFolderNode(parentDir) : null;
    if (folderNode) folderNode.children.push(fileNode);
    else roots.push(fileNode);
  }

  const mergedTree = mergeSubpageFoldersIntoParentPages(roots, true);
  assignNodeDepths(mergedTree, 0);
  return mergedTree;
}

export function collectAllFolderPaths(files: WorkspaceFile[], categories: string[] = []): string[] {
  const set = new Set<string>(STANDARD_ROOT_ORDER);
  const addPrefixes = (raw: string) => {
    const clean = normalizeWorkspacePath(raw);
    if (!clean || clean.startsWith(".")) return;
    let acc = "";
    for (const part of clean.split("/")) {
      acc = acc ? `${acc}/${part}` : part;
      set.add(acc);
    }
  };
  for (const cat of categories) addPrefixes(cat);
  for (const f of files) {
    const dir = getParentDir(normalizeWorkspacePath(f.path));
    if (dir) addPrefixes(dir);
  }
  return Array.from(set).sort((a, b) => {
    const rootA = a.split("/")[0];
    const rootB = b.split("/")[0];
    return rootA !== rootB ? compareRootFolders(rootA, rootB) : a.localeCompare(b);
  });
}

function rewriteMarkdownReferencesInContent(
  markdownContent: string,
  sourceFilePath: string,
  oldPath: string,
  newPath: string
): { content: string; count: number } {
  let count = 0;
  const oldDir = getParentDir(oldPath);
  const oldBasename = getBasename(oldPath);
  const sourceDir = getParentDir(normalizeWorkspacePath(sourceFilePath));

  const afterLinks = markdownContent.replace(
    /(!?\[[^\]]*\])\(([^)\r\n]+)\)/g,
    (fullMatch, bracketPart: string, rawTarget: string) => {
      const trimmedTarget = rawTarget.trim();
      if (!trimmedTarget || /^(?:https?:|mailto:|#)/i.test(trimmedTarget)) return fullMatch;

      const targetMatch = trimmedTarget.match(/^(\S+)(\s+["'][\s\S]*["'])?$/);
      if (!targetMatch) return fullMatch;

      const urlToken = targetMatch[1];
      const titleSuffix = targetMatch[2] || "";
      const hasFileScheme = urlToken.startsWith("file:///");
      const withoutScheme = hasFileScheme ? urlToken.slice(8) : urlToken;
      const hashIdx = withoutScheme.indexOf("#");
      const rawPathPart = hashIdx === -1 ? withoutScheme : withoutScheme.slice(0, hashIdx);
      const anchorPart = hashIdx === -1 ? "" : withoutScheme.slice(hashIdx);

      const cleanPathPart = normalizeWorkspacePath(rawPathPart.replace(/^\.\//, ""));
      const isExact = cleanPathPart === oldPath;
      const isRelSameDir = !hasFileScheme && sourceDir === oldDir && cleanPathPart === oldBasename;
      if (!isExact && !isRelSameDir) return fullMatch;

      count += 1;
      return `${bracketPart}(${hasFileScheme ? "file:///" : ""}${newPath}${anchorPart}${titleSuffix})`;
    }
  );

  const afterTransclusions = afterLinks.replace(
    /@\[([^\]#\r\n]+)(#[^\]\r\n]+)?\]/g,
    (fullMatch, rawRefPath: string, hashSuffix?: string) => {
      const cleanRef = normalizeWorkspacePath(rawRefPath.trim().replace(/^\.\//, ""));
      const isExact = cleanRef === oldPath;
      const isRelSameDir = sourceDir === oldDir && cleanRef === oldBasename;
      if (!isExact && !isRelSameDir) return fullMatch;

      count += 1;
      return `@[${newPath}${hashSuffix || ""}]`;
    }
  );

  return { content: afterTransclusions, count };
}

/**
 * Moves a file to `newPath` (`category` updated to parent folder path, `name` updated to basename)
 * and rewrites all workspace Markdown `[label](oldPath)`, `[label](oldPath#anchor)`,
 * and `@[oldPath]` / `@[oldPath#L1-L10]` references to `newPath`.
 */
export function renameOrMoveWorkspaceFile(
  files: WorkspaceFile[],
  oldPath: string,
  newPath: string
): { updatedFiles: WorkspaceFile[]; rewrittenLinkCount: number } {
  const normalizedOld = normalizeWorkspacePath(oldPath);
  let normalizedNew = normalizeWorkspacePath(newPath);
  if (!normalizedOld || !normalizedNew) return { updatedFiles: files, rewrittenLinkCount: 0 };

  if (normalizedOld.toLowerCase().endsWith(".md") && !normalizedNew.toLowerCase().endsWith(".md")) {
    normalizedNew = `${normalizedNew}.md`;
  }
  if (normalizedOld === normalizedNew) return { updatedFiles: files, rewrittenLinkCount: 0 };
  if (!files.some((f) => normalizeWorkspacePath(f.path) === normalizedOld)) {
    return { updatedFiles: files, rewrittenLinkCount: 0 };
  }

  const nextCategory = getParentDir(normalizedNew) || "other";
  const nextName = getBasename(normalizedNew);
  let rewrittenLinkCount = 0;

  const updatedFiles = files.map((file) => {
    const cleanFilePath = normalizeWorkspacePath(file.path);
    const isMovedFile = cleanFilePath === normalizedOld;
    let nextContent = file.content;

    if (cleanFilePath.toLowerCase().endsWith(".md")) {
      const rewritten = rewriteMarkdownReferencesInContent(
        file.content,
        cleanFilePath,
        normalizedOld,
        normalizedNew
      );
      nextContent = rewritten.content;
      rewrittenLinkCount += rewritten.count;
    }

    if (isMovedFile) {
      return { ...file, path: normalizedNew, name: nextName, category: nextCategory, content: nextContent };
    }
    return nextContent !== file.content ? { ...file, content: nextContent } : file;
  });

  return { updatedFiles, rewrittenLinkCount };
}

export function previewLinkRefactorImpact(
  files: WorkspaceFile[],
  targetPath: string
): { totalLinks: number; affectedFilePaths: string[] } {
  const normalizedTarget = normalizeWorkspacePath(targetPath);
  if (!normalizedTarget) return { totalLinks: 0, affectedFilePaths: [] };

  let totalLinks = 0;
  const affectedFilePaths: string[] = [];
  for (const file of files) {
    const cleanPath = normalizeWorkspacePath(file.path);
    if (!cleanPath.toLowerCase().endsWith(".md")) continue;
    const { count } = rewriteMarkdownReferencesInContent(
      file.content,
      cleanPath,
      normalizedTarget,
      "__preview_target__.md"
    );
    if (count > 0) {
      totalLinks += count;
      affectedFilePaths.push(cleanPath);
    }
  }
  return { totalLinks, affectedFilePaths };
}

/**
 * Creates a nested child page under `parentSlug/childSlug.md` with clean YAML frontmatter.
 */
export function createNestedSubpage(
  parentPath: string,
  childTitle: string,
  language: "de" | "en"
): WorkspaceFile {
  const cleanParent = normalizeWorkspacePath(parentPath);
  const parentSlug = cleanParent.replace(/\.md$/i, "") || "wiki";
  const childSlug = slugifyWikiSegment(childTitle);
  const cleanTitle =
    childTitle.trim().replace(/\.md$/i, "") ||
    (language === "en" ? "Untitled Subpage" : "Neue Unterseite");

  const name = `${childSlug}.md`;
  const path = `${parentSlug}/${name}`;
  const today = new Date().toISOString().slice(0, 10);
  const escapedTitle = cleanTitle.replace(/"/g, '\\"');
  const starterBody =
    language === "en"
      ? `Document context, architecture details, or team guidelines for **${cleanTitle}**.\n\n## Key Points\n\n* Add structured notes, tables, or callout panels in the Visual Editor.\n`
      : `Dokumentieren Sie hier Kontext, Architekturdetails oder Team-Richtlinien für **${cleanTitle}**.\n\n## Kernpunkte\n\n* Fügen Sie strukturierte Inhalte, Tabellen oder Callout-Hinweise direkt im visuellen Editor hinzu.\n`;

  const content = [
    "---",
    `title: "${escapedTitle}"`,
    `review_status: "draft"`,
    `parent_page: "${cleanParent || parentSlug}"`,
    `updated_at: "${today}"`,
    "---",
    "",
    `# ${cleanTitle}`,
    "",
    starterBody,
  ].join("\n");

  return { path, name, category: parentSlug, content };
}
