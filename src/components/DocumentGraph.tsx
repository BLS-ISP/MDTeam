import React, { useState, useEffect, useRef } from "react";
import { parseDocumentGraph, GraphNode, GraphEdge, DocumentGraphData } from "../utils/graphParser";
import { FileText, Share2, HelpCircle } from "lucide-react";

interface WorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

interface DocumentGraphProps {
  files: WorkspaceFile[];
  onSelectNode: (filePath: string) => void;
  language?: "de" | "en";
}

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed?: boolean;
}

const isGraphEqual = (a: DocumentGraphData, b: DocumentGraphData): boolean => {
  if (!a || !b) return false;
  if (a.nodes.length !== b.nodes.length) return false;
  if (a.edges.length !== b.edges.length) return false;
  
  const nodesA = new Set(a.nodes.map(n => n.id));
  const nodesB = new Set(b.nodes.map(n => n.id));
  for (const id of nodesA) {
    if (!nodesB.has(id)) return false;
  }

  const edgesA = new Set(a.edges.map(e => `${e.source}->${e.target}:${e.type}`));
  const edgesB = new Set(b.edges.map(e => `${e.source}->${e.target}:${e.type}`));
  for (const edge of edgesA) {
    if (!edgesB.has(edge)) return false;
  }
  
  return true;
};

export default function DocumentGraph({ files, onSelectNode, language = "de" }: DocumentGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphData, setGraphData] = useState(() => parseDocumentGraph(files));
  const [positions, setPositions] = useState<{ [id: string]: Point }>({});
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);
  const isEn = language === "en";
  const [wakeCounter, setWakeCounter] = useState(0);
  const alphaRef = useRef(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [startPanMouse, setStartPanMouse] = useState({ x: 0, y: 0 });
  const [startPanOffset, setStartPanOffset] = useState({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Load positions, pan, and zoom from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mdteam_graph_state");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.positions) setPositions(parsed.positions);
        if (parsed.pan) setPan(parsed.pan);
        if (parsed.zoom) setZoom(parsed.zoom);
      }
    } catch (e) {
      console.error("Failed to load graph state", e);
    }
  }, []);

  // Save positions, pan, and zoom to localStorage with a 1-second debounce
  useEffect(() => {
    if (Object.keys(positions).length === 0) return;
    const handler = setTimeout(() => {
      try {
        localStorage.setItem("mdteam_graph_state", JSON.stringify({
          positions,
          pan,
          zoom
        }));
      } catch (e) {
        console.error("Failed to save graph state", e);
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [positions, pan, zoom]);

  // Update graph data when files change
  useEffect(() => {
    const data = parseDocumentGraph(files);
    
    // Prevent jiggling / resetting simulation heat if topology is identical
    setGraphData(prev => {
      if (isGraphEqual(prev, data)) {
        return prev;
      }
      alphaRef.current = 1;
      return data;
    });

    // Initialize/preserve positions
    setPositions(prev => {
      const next: { [id: string]: Point } = {};
      const width = 700;
      const height = 450;
      
      data.nodes.forEach((node, idx) => {
        if (prev[node.id]) {
          next[node.id] = prev[node.id];
        } else {
          // Arrange in a circle initially
          const angle = (idx / data.nodes.length) * 2 * Math.PI;
          const radius = 120 + Math.random() * 30;
          next[node.id] = {
            x: width / 2 + Math.cos(angle) * radius,
            y: height / 2 + Math.sin(angle) * radius,
            vx: 0,
            vy: 0,
            fixed: false
          };
        }
      });
      return next;
    });
  }, [files]);

  // Reset alpha on file or drag changes
  useEffect(() => {
    alphaRef.current = 1;
  }, [graphData, draggedNode]);

  // Spring-force simulation loop
  useEffect(() => {
    let frameId: number;

    const runSimulation = () => {
      if (alphaRef.current < 0.005) {
        // Simulation cooled down, stop requesting frames to save CPU
        return;
      }

      setPositions(prev => {
        const next = { ...prev };
        const nodeIds = Object.keys(next);
        if (nodeIds.length === 0) return prev;

        const width = 700;
        const height = 450;
        const centerX = width / 2;
        const centerY = height / 2;

        // Physics parameters
        const repulsion = 3500;
        const springLength = 100;
        const springStrength = 0.04;
        const centerGravity = 0.015;
        const friction = 0.85;

        // Decaying alpha (cooling)
        const alpha = alphaRef.current;
        if (!draggedNode) {
          alphaRef.current *= 0.98; // Cool down
        } else {
          alphaRef.current = 1; // Keep simulation hot during drag
        }

        // 1. Initialize forces/velocities
        const forces: { [id: string]: { fx: number; fy: number } } = {};
        nodeIds.forEach(id => {
          forces[id] = { fx: 0, fy: 0 };
        });

        // 2. Repulsion (between all node pairs)
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

        // 3. Attraction (along edges/springs)
        graphData.edges.forEach(edge => {
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

        // 4. Center Gravity (pull free nodes back to center)
        nodeIds.forEach(id => {
          const pos = next[id];
          if (id === draggedNode || pos.fixed) return; // Don't pull dragged or fixed node
          forces[id].fx += (centerX - pos.x) * centerGravity * alpha;
          forces[id].fy += (centerY - pos.y) * centerGravity * alpha;
        });

        // 5. Update positions & velocities
        nodeIds.forEach(id => {
          if (id === draggedNode) return; // Keep dragged node static during drag

          const pos = next[id];
          if (pos.fixed) {
            next[id] = { ...pos, vx: 0, vy: 0 };
            return;
          }

          const fx = forces[id].fx;
          const fy = forces[id].fy;

          const vx = (pos.vx + fx) * friction;
          const vy = (pos.vy + fy) * friction;

          // Fluid canvas movement: remove strict box constraints to allow infinite scroll layout
          let x = pos.x + vx;
          let y = pos.y + vy;

          next[id] = { x, y, vx, vy, fixed: false };
        });

        return next;
      });

      frameId = requestAnimationFrame(runSimulation);
    };

    frameId = requestAnimationFrame(runSimulation);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [graphData, draggedNode, wakeCounter]);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggedNode(nodeId);
    hasMovedRef.current = false; // Reset on drag start

    // Calculate drag offset to prevent the node from jumping when clicked
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * 700;
      const svgY = ((e.clientY - rect.top) / rect.height) * 450;
      
      const mouseX = (svgX - pan.x) / zoom;
      const mouseY = (svgY - pan.y) / zoom;
      
      const nodePos = positions[nodeId];
      if (nodePos) {
        setDragOffset({
          x: mouseX - nodePos.x,
          y: mouseY - nodePos.y
        });
      }
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Panning starts for any background click (node propagation is stopped)
    setIsPanning(true);
    setStartPanMouse({ x: e.clientX, y: e.clientY });
    setStartPanOffset(pan);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current) return;

    if (draggedNode) {
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * 700;
      const svgY = ((e.clientY - rect.top) / rect.height) * 450;
      
      // Transform screen coordinates back to graph coordinates (considering pan & zoom & click offset)
      const x = (svgX - pan.x) / zoom - dragOffset.x;
      const y = (svgY - pan.y) / zoom - dragOffset.y;

      const nodePos = positions[draggedNode];
      if (nodePos) {
        const dx = x - nodePos.x;
        const dy = y - nodePos.y;
        if (dx * dx + dy * dy > 4) {
          hasMovedRef.current = true; // Mark as dragged if mouse moved > 2 units
        }
      }

      setPositions(prev => ({
        ...prev,
        [draggedNode]: {
          x,
          y,
          vx: 0,
          vy: 0,
          fixed: true
        }
      }));
    } else if (isPanning) {
      const dx = e.clientX - startPanMouse.x;
      const dy = e.clientY - startPanMouse.y;
      
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = 700 / rect.width;
      const scaleY = 450 / rect.height;

      setPan({
        x: startPanOffset.x + dx * scaleX,
        y: startPanOffset.y + dy * scaleY
      });
    }
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = 1.1;
    const nextZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    setZoom(Math.max(0.3, Math.min(3, nextZoom)));
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "arc42":
        return "#6366f1"; // Indigo
      case "adrs":
        return "#10b981"; // Emerald
      case "management":
        return "#eab308"; // Amber
      case "meetings":
        return "#a855f7"; // Violet
      default:
        return "#94a3b8"; // Slate
    }
  };

  return (
    <div 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        backgroundColor: 'var(--bg-editor)', 
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-sans)'
      }}
    >
      <div 
        className="panel-header" 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-panel)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Share2 size={16} style={{ color: 'var(--accent-indigo)' }} />
          <span style={{ fontWeight: 600 }}>{isEn ? "Document Relationship Graph" : "Dokumenten-Beziehungs-Graph"}</span>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '12px', fontSize: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
            <span>arc42</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            <span>ADRs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#eab308' }}></span>
            <span>Roadmap</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#a855f7' }}></span>
            <span>Meetings</span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div 
        style={{ 
          fontSize: '11px', 
          color: 'var(--text-muted)', 
          padding: '6px 16px', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          backgroundColor: 'rgba(99, 102, 241, 0.02)'
        }}
      >
        <HelpCircle size={12} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isEn 
            ? "Drag background to pan | Scroll to zoom | Drag nodes to pin | Double-click to unpin | Click node to open" 
            : "Hintergrund ziehen = Verschieben | Scrollen = Zoomen | Knoten ziehen = Pinne | Doppelklick = Lösen | Klick = Öffnen"}
        </span>
      </div>

      {/* SVG Canvas Area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: '380px' }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox="0 0 700 450"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ userSelect: 'none', cursor: draggedNode ? 'grabbing' : isPanning ? 'grabbing' : 'grab' }}
        >
          {/* Arrow definitions for directed edges */}
          <defs>
            <marker id="arrow-link" markerWidth="8" markerHeight="8" refX="21" refY="4" orient="auto">
              <path d="M0,1 L8,4 L0,7 Z" fill="rgba(255,255,255,0.15)" />
            </marker>
            <marker id="arrow-transclude" markerWidth="8" markerHeight="8" refX="21" refY="4" orient="auto">
              <path d="M0,1 L8,4 L0,7 Z" fill="var(--accent-indigo)" />
            </marker>
          </defs>

          {/* Group that applies Panning and Zooming */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Lines (Edges) */}
            {graphData.edges.map((edge, idx) => {
              const posA = positions[edge.source];
              const posB = positions[edge.target];
              if (!posA || !posB) return null;

              const isTransclusion = edge.type === "transclusion";
              const strokeColor = isTransclusion ? "rgba(99, 102, 241, 0.4)" : "rgba(255, 255, 255, 0.1)";
              const strokeDash = isTransclusion ? "4 4" : "none";
              const marker = isTransclusion ? "url(#arrow-transclude)" : "url(#arrow-link)";

              return (
                <line
                  key={idx}
                  x1={posA.x}
                  y1={posA.y}
                  x2={posB.x}
                  y2={posB.y}
                  stroke={strokeColor}
                  strokeWidth={isTransclusion ? 2 : 1.5}
                  strokeDasharray={strokeDash}
                  markerEnd={marker}
                />
              );
            })}

            {/* Nodes (Circles and Text labels) */}
            {graphData.nodes.map(node => {
              const pos = positions[node.id];
              if (!pos) return null;

              const color = getCategoryColor(node.category);
              const isDragging = draggedNode === node.id;

              return (
                <g 
                  key={node.id}
                  style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
                  onClick={() => {
                    // Only open document if we clicked the node without dragging it
                    if (!hasMovedRef.current) {
                      onSelectNode(node.id);
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setPositions(prev => {
                      const current = prev[node.id];
                      if (current) {
                        return {
                          ...prev,
                          [node.id]: { ...current, fixed: !current.fixed }
                        };
                      }
                      return prev;
                    });
                    // Reset alpha to wake up simulation so it converges on new layout
                    alphaRef.current = 1;
                    setWakeCounter(prev => prev + 1);
                  }}
                >
                  {/* Outer halo on hover */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={18}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={0}
                    className="node-halo"
                    style={{ transition: 'stroke-width 0.2s' }}
                  />

                  {/* Main node circle */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={12}
                    fill="var(--bg-editor)"
                    stroke={color}
                    strokeWidth={3}
                    onMouseDown={(e) => handleMouseDown(e, node.id)}
                    style={{ filter: isDragging ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' : 'none' }}
                  />

                  {/* Pinned/Fixed center dot */}
                  {pos.fixed && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={4}
                      fill={color}
                      pointerEvents="none"
                    />
                  )}

                  {/* Node Label Text */}
                  <text
                    x={pos.x}
                    y={pos.y + 26}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="11px"
                    fontWeight={500}
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Zoom controls floating panel */}
        <div 
          style={{ 
            position: 'absolute', 
            bottom: '16px', 
            right: '16px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '6px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '4px',
            boxShadow: 'var(--shadow-md)',
            zIndex: 10
          }}
        >
          <button 
            onClick={() => { setZoom(prev => Math.min(3, prev * 1.2)); alphaRef.current = 1; setWakeCounter(w => w + 1); }}
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold' }}
            title={isEn ? "Zoom In" : "Vergrößern"}
            className="action-icon-btn"
          >
            +
          </button>
          <button 
            onClick={() => { setZoom(prev => Math.max(0.3, prev / 1.2)); alphaRef.current = 1; setWakeCounter(w => w + 1); }}
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold' }}
            title={isEn ? "Zoom Out" : "Verkleinern"}
            className="action-icon-btn"
          >
            −
          </button>
          <button 
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); alphaRef.current = 1; setWakeCounter(w => w + 1); }}
            style={{ width: '38px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold' }}
            title={isEn ? "Reset View" : "Zurücksetzen"}
            className="action-icon-btn"
          >
            Reset
          </button>
        </div>
      </div>

      <style>{`
        g:hover .node-halo {
          stroke-width: 4px;
          fill: rgba(255, 255, 255, 0.03);
        }
      `}</style>
    </div>
  );
}
