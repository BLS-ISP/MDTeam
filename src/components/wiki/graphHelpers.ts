import type {
  DocumentGraphData,
  GraphEdge,
  GraphNode,
} from "../../utils/graphParser";

export interface WorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

export interface DocumentGraphProps {
  files: WorkspaceFile[];
  onSelectNode: (filePath: string) => void;
  language?: "de" | "en";
}

export interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed?: boolean;
}

export interface GraphSavedState {
  positions?: Record<string, Point>;
  pan?: { x: number; y: number };
  zoom?: number;
}

export const GRAPH_WIDTH = 700;
export const GRAPH_HEIGHT = 450;
export const GRAPH_STORAGE_KEY = "mdteam_graph_state";

export const GRAPH_LEGEND_ITEMS: ReadonlyArray<{
  color: string;
  label: string;
}> = [
  { color: "#6366f1", label: "arc42" },
  { color: "#10b981", label: "ADRs" },
  { color: "#3b82f6", label: "Issues" },
  { color: "#06b6d4", label: "Sprints" },
  { color: "#f97316", label: "Wiki" },
  { color: "#eab308", label: "Roadmap" },
  { color: "#a855f7", label: "Meetings" },
];

export function isGraphEqual(
  a: DocumentGraphData,
  b: DocumentGraphData
): boolean {
  if (!a || !b) return false;
  if (a.nodes.length !== b.nodes.length) return false;
  if (a.edges.length !== b.edges.length) return false;

  const nodesA = new Set(a.nodes.map((n) => n.id));
  const nodesB = new Set(b.nodes.map((n) => n.id));
  for (const id of nodesA) {
    if (!nodesB.has(id)) return false;
  }

  const edgesA = new Set(
    a.edges.map((e) => `${e.source}->${e.target}:${e.type}`)
  );
  const edgesB = new Set(
    b.edges.map((e) => `${e.source}->${e.target}:${e.type}`)
  );
  for (const edge of edgesA) {
    if (!edgesB.has(edge)) return false;
  }

  return true;
}

export function loadSavedGraphState(): GraphSavedState | null {
  try {
    const saved = localStorage.getItem(GRAPH_STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved) as GraphSavedState;
  } catch (e) {
    console.error("Failed to load graph state", e);
    return null;
  }
}

export function saveGraphStateToStorage(state: {
  positions: Record<string, Point>;
  pan: { x: number; y: number };
  zoom: number;
}): void {
  try {
    localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save graph state", e);
  }
}

export function syncGraphNodePositions(
  nodes: GraphNode[],
  prev: Record<string, Point>
): Record<string, Point> {
  const next: Record<string, Point> = {};
  nodes.forEach((node, idx) => {
    if (prev[node.id]) {
      next[node.id] = prev[node.id];
    } else {
      const angle = (idx / nodes.length) * 2 * Math.PI;
      const radius = 120 + Math.random() * 30;
      next[node.id] = {
        x: GRAPH_WIDTH / 2 + Math.cos(angle) * radius,
        y: GRAPH_HEIGHT / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        fixed: false,
      };
    }
  });
  return next;
}

export function stepGraphForceSimulation(
  prev: Record<string, Point>,
  edges: GraphEdge[],
  draggedNode: string | null,
  alphaRef: { current: number }
): Record<string, Point> {
  const next = { ...prev };
  const nodeIds = Object.keys(next);
  if (nodeIds.length === 0) return prev;

  const centerX = GRAPH_WIDTH / 2;
  const centerY = GRAPH_HEIGHT / 2;

  const repulsion = 3500;
  const springLength = 100;
  const springStrength = 0.04;
  const centerGravity = 0.015;
  const friction = 0.85;

  const alpha = alphaRef.current;
  if (!draggedNode) {
    alphaRef.current *= 0.98;
  } else {
    alphaRef.current = 1;
  }

  const forces: Record<string, { fx: number; fy: number }> = {};
  nodeIds.forEach((id) => {
    forces[id] = { fx: 0, fy: 0 };
  });

  // Repulsion between all node pairs
  for (let i = 0; i < nodeIds.length; i++) {
    const idA = nodeIds[i];
    const posA = next[idA];
    for (let j = i + 1; j < nodeIds.length; j++) {
      const idB = nodeIds[j];
      const posB = next[idB];

      const dx = posA.x - posB.x;
      const dy = posA.y - posB.y;
      const distSq = dx * dx + dy * dy + 0.1;
      const dist = Math.sqrt(distSq);

      if (dist < 220) {
        const force = (repulsion / distSq) * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        forces[idA].fx += fx;
        forces[idA].fy += fy;
        forces[idB].fx -= fx;
        forces[idB].fy -= fy;
      }
    }
  }

  // Attraction along edges / springs
  edges.forEach((edge) => {
    const posA = next[edge.source];
    const posB = next[edge.target];
    if (!posA || !posB) return;

    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

    const displacement = dist - springLength;
    const force = displacement * springStrength * alpha;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    forces[edge.source].fx += fx;
    forces[edge.source].fy += fy;
    forces[edge.target].fx -= fx;
    forces[edge.target].fy -= fy;
  });

  // Center gravity for free nodes
  nodeIds.forEach((id) => {
    const pos = next[id];
    if (id === draggedNode || pos.fixed) return;
    forces[id].fx += (centerX - pos.x) * centerGravity * alpha;
    forces[id].fy += (centerY - pos.y) * centerGravity * alpha;
  });

  // Update positions & velocities
  nodeIds.forEach((id) => {
    if (id === draggedNode) return;
    const pos = next[id];
    if (pos.fixed) {
      next[id] = { ...pos, vx: 0, vy: 0 };
      return;
    }

    const vx = (pos.vx + forces[id].fx) * friction;
    const vy = (pos.vy + forces[id].fy) * friction;
    next[id] = { x: pos.x + vx, y: pos.y + vy, vx, vy, fixed: false };
  });

  return next;
}

export function getCategoryColor(cat: string): string {
  switch (cat) {
    case "arc42":
      return "#6366f1";
    case "adrs":
      return "#10b981";
    case "issues":
      return "#3b82f6";
    case "sprints":
      return "#06b6d4";
    case "wiki":
      return "#f97316";
    case "management":
      return "#eab308";
    case "meetings":
      return "#a855f7";
    default:
      return "#94a3b8";
  }
}

export function getEdgeVisualStyle(edgeType: GraphEdge["type"]): {
  strokeColor: string;
  strokeDash: string;
  marker: string;
  strokeWidth: number;
} {
  if (edgeType === "transclusion") {
    return {
      strokeColor: "rgba(99, 102, 241, 0.45)",
      strokeDash: "4 4",
      marker: "url(#arrow-transclude)",
      strokeWidth: 2,
    };
  }
  if (edgeType === "epic") {
    return {
      strokeColor: "rgba(59, 130, 246, 0.45)",
      strokeDash: "none",
      marker: "url(#arrow-epic)",
      strokeWidth: 2,
    };
  }
  if (edgeType === "blocked_by") {
    return {
      strokeColor: "rgba(239, 68, 68, 0.6)",
      strokeDash: "3 3",
      marker: "url(#arrow-blocked)",
      strokeWidth: 2,
    };
  }
  return {
    strokeColor: "rgba(255, 255, 255, 0.14)",
    strokeDash: "none",
    marker: "url(#arrow-link)",
    strokeWidth: 1.5,
  };
}
