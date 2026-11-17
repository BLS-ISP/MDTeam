export interface GraphNode {
  id: string;
  label: string;
  category: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "link" | "transclusion" | "epic" | "blocked_by";
}

export interface DocumentGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface WorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

function parseGraphFrontmatter(markdown: string): Record<string, string> {
  const fm = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const data: Record<string, string> = {};
  if (!fm) return data;
  fm[1].split(/\r?\n/).forEach(line => {
    const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (kv) {
      data[kv[1].trim().toLowerCase()] = kv[2].trim();
    }
  });
  return data;
}

function unquoteYamlVal(raw?: string): string {
  return (raw || "").replace(/^["']|["']$/g, "").trim();
}

function parseYamlIdArray(raw?: string): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed === "[]") return [];
  return trimmed
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map(v => unquoteYamlVal(v))
    .filter(Boolean);
}

export function parseDocumentGraph(files: WorkspaceFile[]): DocumentGraphData {
  const graphFiles = files.filter(
    f => !f.path.startsWith(".") && f.path.toLowerCase().endsWith(".md")
  );

  // Map issue IDs and sprint IDs to file paths for frontmatter edge resolution
  const issuePathById = new Map<string, string>();
  const sprintPathById = new Map<string, string>();

  graphFiles.forEach(file => {
    const fm = parseGraphFrontmatter(file.content);
    if (file.path.startsWith("issues/")) {
      const id = (unquoteYamlVal(fm.id) || file.name.replace(/\.md$/i, "")).toUpperCase();
      issuePathById.set(id, file.path);
    } else if (file.path.startsWith("sprints/")) {
      const id = (unquoteYamlVal(fm.id) || file.name.replace(/\.md$/i, "")).toLowerCase();
      sprintPathById.set(id, file.path);
    }
  });

  const nodes: GraphNode[] = graphFiles.map(file => {
    const fm = parseGraphFrontmatter(file.content);
    let label = file.name;
    let category = file.category;

    if (file.path.startsWith("arc42/")) {
      category = "arc42";
      const match = file.name.match(/^\d+_(.*)\.md$/);
      if (match) {
        label = match[1].replace(/_/g, " ");
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
    } else if (file.path.startsWith("adrs/")) {
      category = "adrs";
      label = file.name.replace(".md", "");
    } else if (file.path.startsWith("issues/")) {
      category = "issues";
      const id = unquoteYamlVal(fm.id) || file.name.replace(/\.md$/i, "");
      const title = unquoteYamlVal(fm.title);
      if (title) {
        const shortTitle = title.length > 22 ? `${title.slice(0, 22)}…` : title;
        label = `${id}: ${shortTitle}`;
      } else {
        label = id;
      }
    } else if (file.path.startsWith("sprints/")) {
      category = "sprints";
      const sprintName = unquoteYamlVal(fm.name) || unquoteYamlVal(fm.id) || file.name.replace(/\.md$/i, "");
      label = sprintName.length > 26 ? `${sprintName.slice(0, 26)}…` : sprintName;
    } else if (file.path.startsWith("wiki/")) {
      category = "wiki";
      const wikiTitle = unquoteYamlVal(fm.title) || file.name.replace(/\.md$/i, "").replace(/[-_]/g, " ");
      label = wikiTitle.length > 28 ? `${wikiTitle.slice(0, 28)}…` : wikiTitle;
    } else if (file.path === "management/roadmap.md") {
      category = "management";
      label = "Roadmap & Meilensteine";
    }

    return {
      id: file.path,
      label,
      category
    };
  });

  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();

  const pushEdge = (source: string, target: string, type: GraphEdge["type"]) => {
    if (!source || !target || source === target) return;
    const edgeKey = `${source}->${target}:${type}`;
    if (!edgeKeys.has(edgeKey)) {
      edgeKeys.add(edgeKey);
      edges.push({ source, target, type });
    }
  };

  graphFiles.forEach(file => {
    const content = file.content;
    const fm = parseGraphFrontmatter(content);

    // 1. Match Transclusions: @[path/to/file.md#L10]
    const transclusionRegex = /@\[(.*?)(?:#.*?)?\]/g;
    let match;
    while ((match = transclusionRegex.exec(content)) !== null) {
      const refPath = match[1].trim();
      const targetFile = graphFiles.find(f => f.path === refPath);
      if (targetFile) {
        pushEdge(file.path, targetFile.path, "transclusion");
      }
    }

    // 2. Match Standard Links: [text](path/to/file.md#hash) or [text](file:///path/to/file.md)
    const linkRegex = /\[(.*?)\]\((.*?)\)/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(content)) !== null) {
      const linkUrl = linkMatch[2].trim();
      if (!linkUrl || linkUrl.startsWith("http://") || linkUrl.startsWith("https://")) continue;

      let cleanPath = linkUrl.replace("file:///", "");
      const hashIndex = cleanPath.indexOf("#");
      if (hashIndex !== -1) {
        cleanPath = cleanPath.substring(0, hashIndex);
      }
      if (!cleanPath) continue;

      const targetFile = graphFiles.find(
        f =>
          f.path === cleanPath ||
          f.path === `arc42/${cleanPath}` ||
          f.path === `adrs/${cleanPath}` ||
          f.path === `issues/${cleanPath}` ||
          f.path === `sprints/${cleanPath}` ||
          f.path === `wiki/${cleanPath}` ||
          f.path === `management/${cleanPath}` ||
          f.path === `meetings/${cleanPath}`
      );
      if (targetFile) {
        pushEdge(file.path, targetFile.path, "link");
      }
    }

    // 3. Frontmatter relational edges (`epic:`, `blocked_by:`, `sprint:`)
    const epicId = unquoteYamlVal(fm.epic).toUpperCase();
    if (epicId) {
      const epicPath = issuePathById.get(epicId);
      if (epicPath) {
        pushEdge(file.path, epicPath, "epic");
      }
    }

    const blockedByIds = parseYamlIdArray(fm.blocked_by);
    blockedByIds.forEach(rawBlockerId => {
      const blockerPath = issuePathById.get(rawBlockerId.toUpperCase());
      if (blockerPath) {
        pushEdge(file.path, blockerPath, "blocked_by");
      }
    });

    const sprintId = unquoteYamlVal(fm.sprint).toLowerCase();
    if (sprintId) {
      const sprintPath = sprintPathById.get(sprintId);
      if (sprintPath) {
        pushEdge(file.path, sprintPath, "link");
      }
    }
  });

  return { nodes, edges };
}

export function findBacklinks(targetPath: string, files: WorkspaceFile[]): string[] {
  const graph = parseDocumentGraph(files);
  const uniqueSources = new Set<string>();
  graph.edges.forEach(edge => {
    if (edge.target === targetPath) {
      uniqueSources.add(edge.source);
    }
  });
  return Array.from(uniqueSources);
}
