export interface GraphNode {
  id: string;
  label: string;
  category: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "link" | "transclusion";
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

export function parseDocumentGraph(files: WorkspaceFile[]): DocumentGraphData {
  const nodes: GraphNode[] = files.map(file => {
    // Determine user-friendly label
    let label = file.name;
    if (file.path.startsWith("arc42/")) {
      const match = file.name.match(/^\d+_(.*)\.md$/);
      if (match) {
        label = match[1].replace(/_/g, " ");
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
    } else if (file.path.startsWith("adrs/")) {
      label = file.name.replace(".md", "");
    } else if (file.path === "management/roadmap.md") {
      label = "Roadmap & Meilensteine";
    }

    return {
      id: file.path,
      label,
      category: file.category
    };
  });

  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();

  files.forEach(file => {
    const content = file.content;
    
    // 1. Match Transclusions: @[path/to/file.md#L10]
    const transclusionRegex = /@\[(.*?)(?:#.*?)?\]/g;
    let match;
    while ((match = transclusionRegex.exec(content)) !== null) {
      const refPath = match[1].trim();
      const targetFile = files.find(f => f.path === refPath);
      if (targetFile) {
        const edgeKey = `${file.path}->${targetFile.path}:transclusion`;
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          edges.push({
            source: file.path,
            target: targetFile.path,
            type: "transclusion"
          });
        }
      }
    }

    // 2. Match Standard Links: [text](path/to/file.md#hash) or [text](file:///path/to/file.md)
    const linkRegex = /\[(.*?)\]\((.*?)\)/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(content)) !== null) {
      const linkUrl = linkMatch[2].trim();
      
      // Clean up link URL
      let cleanPath = linkUrl.replace("file:///", "");
      const hashIndex = cleanPath.indexOf("#");
      if (hashIndex !== -1) {
        cleanPath = cleanPath.substring(0, hashIndex);
      }

      const targetFile = files.find(f => f.path === cleanPath || f.path === `arc42/${cleanPath}` || f.path === `adrs/${cleanPath}`);
      if (targetFile && targetFile.path !== file.path) {
        const edgeKey = `${file.path}->${targetFile.path}:link`;
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          edges.push({
            source: file.path,
            target: targetFile.path,
            type: "link"
          });
        }
      }
    }
  });

  return { nodes, edges };
}

export function findBacklinks(targetPath: string, files: WorkspaceFile[]): string[] {
  const graph = parseDocumentGraph(files);
  return graph.edges
    .filter(edge => edge.target === targetPath)
    .map(edge => edge.source);
}
