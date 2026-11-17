"use client";

import React, { useEffect, useRef, useState } from "react";
import { parseDocumentGraph } from "../utils/graphParser";
import {
  DocumentGraphProps,
  getCategoryColor,
  getEdgeVisualStyle,
  GRAPH_HEIGHT,
  GRAPH_WIDTH,
  isGraphEqual,
  loadSavedGraphState,
  Point,
  saveGraphStateToStorage,
  stepGraphForceSimulation,
  syncGraphNodePositions,
} from "./wiki/graphHelpers";
import {
  GraphHeaderAndInstructions,
  GraphZoomControls,
} from "./wiki/GraphHeaderAndControls";

export type { DocumentGraphProps };

export default function DocumentGraph({
  files,
  onSelectNode,
  language = "de",
}: DocumentGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphData, setGraphData] = useState(() => parseDocumentGraph(files));
  const [positions, setPositions] = useState<{ [id: string]: Point }>({});
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
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
    const parsed = loadSavedGraphState();
    if (!parsed) return;
    if (parsed.positions) setPositions(parsed.positions);
    if (parsed.pan) setPan(parsed.pan);
    if (parsed.zoom) setZoom(parsed.zoom);
  }, []);

  // Save positions, pan, and zoom to localStorage with a 1-second debounce
  useEffect(() => {
    if (Object.keys(positions).length === 0) return;
    const handler = setTimeout(() => {
      saveGraphStateToStorage({ positions, pan, zoom });
    }, 1000);
    return () => clearTimeout(handler);
  }, [positions, pan, zoom]);

  // Update graph data when files change
  useEffect(() => {
    const data = parseDocumentGraph(files);
    setGraphData((prev) => {
      if (isGraphEqual(prev, data)) return prev;
      alphaRef.current = 1;
      return data;
    });
    setPositions((prev) => syncGraphNodePositions(data.nodes, prev));
  }, [files]);

  // Reset alpha on file or drag changes
  useEffect(() => {
    alphaRef.current = 1;
  }, [graphData, draggedNode]);

  // Spring-force simulation loop
  useEffect(() => {
    let frameId: number;
    const runSimulation = () => {
      if (alphaRef.current < 0.005) return;
      setPositions((prev) =>
        stepGraphForceSimulation(prev, graphData.edges, draggedNode, alphaRef)
      );
      frameId = requestAnimationFrame(runSimulation);
    };
    frameId = requestAnimationFrame(runSimulation);
    return () => cancelAnimationFrame(frameId);
  }, [graphData, draggedNode, wakeCounter]);

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggedNode(nodeId);
    hasMovedRef.current = false;

    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * GRAPH_WIDTH;
      const svgY = ((e.clientY - rect.top) / rect.height) * GRAPH_HEIGHT;
      const mouseX = (svgX - pan.x) / zoom;
      const mouseY = (svgY - pan.y) / zoom;
      const nodePos = positions[nodeId];
      if (nodePos) {
        setDragOffset({ x: mouseX - nodePos.x, y: mouseY - nodePos.y });
      }
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setStartPanMouse({ x: e.clientX, y: e.clientY });
    setStartPanOffset(pan);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    if (draggedNode) {
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * GRAPH_WIDTH;
      const svgY = ((e.clientY - rect.top) / rect.height) * GRAPH_HEIGHT;
      const x = (svgX - pan.x) / zoom - dragOffset.x;
      const y = (svgY - pan.y) / zoom - dragOffset.y;

      const nodePos = positions[draggedNode];
      if (nodePos) {
        const dx = x - nodePos.x;
        const dy = y - nodePos.y;
        if (dx * dx + dy * dy > 4) {
          hasMovedRef.current = true;
        }
      }

      setPositions((prev) => ({
        ...prev,
        [draggedNode]: { x, y, vx: 0, vy: 0, fixed: true },
      }));
    } else if (isPanning) {
      const dx = e.clientX - startPanMouse.x;
      const dy = e.clientY - startPanMouse.y;
      const rect = svgRef.current.getBoundingClientRect();
      setPan({
        x: startPanOffset.x + dx * (GRAPH_WIDTH / rect.width),
        y: startPanOffset.y + dy * (GRAPH_HEIGHT / rect.height),
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--bg-editor)",
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <GraphHeaderAndInstructions isEn={isEn} />

      {/* SVG Canvas Area */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          minHeight: "380px",
        }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{
            userSelect: "none",
            cursor: draggedNode || isPanning ? "grabbing" : "grab",
          }}
        >
          <defs>
            <marker id="arrow-link" markerWidth="8" markerHeight="8" refX="21" refY="4" orient="auto">
              <path d="M0,1 L8,4 L0,7 Z" fill="rgba(255,255,255,0.18)" />
            </marker>
            <marker id="arrow-transclude" markerWidth="8" markerHeight="8" refX="21" refY="4" orient="auto">
              <path d="M0,1 L8,4 L0,7 Z" fill="var(--accent-indigo)" />
            </marker>
            <marker id="arrow-epic" markerWidth="8" markerHeight="8" refX="21" refY="4" orient="auto">
              <path d="M0,1 L8,4 L0,7 Z" fill="rgba(59, 130, 246, 0.65)" />
            </marker>
            <marker id="arrow-blocked" markerWidth="8" markerHeight="8" refX="21" refY="4" orient="auto">
              <path d="M0,1 L8,4 L0,7 Z" fill="rgba(239, 68, 68, 0.8)" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {graphData.edges.map((edge, idx) => {
              const posA = positions[edge.source];
              const posB = positions[edge.target];
              if (!posA || !posB) return null;
              const style = getEdgeVisualStyle(edge.type);
              return (
                <line
                  key={idx}
                  x1={posA.x}
                  y1={posA.y}
                  x2={posB.x}
                  y2={posB.y}
                  stroke={style.strokeColor}
                  strokeWidth={style.strokeWidth}
                  strokeDasharray={style.strokeDash}
                  markerEnd={style.marker}
                />
              );
            })}

            {graphData.nodes.map((node) => {
              const pos = positions[node.id];
              if (!pos) return null;
              const color = getCategoryColor(node.category);
              const isDragging = draggedNode === node.id;

              return (
                <g
                  key={node.id}
                  style={{ cursor: isDragging ? "grabbing" : "pointer" }}
                  onClick={() => {
                    if (!hasMovedRef.current) onSelectNode(node.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setPositions((prev) => {
                      const current = prev[node.id];
                      return current
                        ? { ...prev, [node.id]: { ...current, fixed: !current.fixed } }
                        : prev;
                    });
                    alphaRef.current = 1;
                    setWakeCounter((prev) => prev + 1);
                  }}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={18}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={0}
                    className="node-halo"
                    style={{ transition: "stroke-width 0.2s" }}
                  />
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={12}
                    fill="var(--bg-editor)"
                    stroke={color}
                    strokeWidth={3}
                    onMouseDown={(e) => handleMouseDown(e, node.id)}
                    style={{
                      filter: isDragging
                        ? "drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                        : "none",
                    }}
                  />
                  {pos.fixed && (
                    <circle cx={pos.x} cy={pos.y} r={4} fill={color} pointerEvents="none" />
                  )}
                  <text
                    x={pos.x}
                    y={pos.y + 26}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="11px"
                    fontWeight={500}
                    style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.8))" }}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <GraphZoomControls
          isEn={isEn}
          onZoomIn={() => {
            setZoom((prev) => Math.min(3, prev * 1.2));
            alphaRef.current = 1;
            setWakeCounter((w) => w + 1);
          }}
          onZoomOut={() => {
            setZoom((prev) => Math.max(0.3, prev / 1.2));
            alphaRef.current = 1;
            setWakeCounter((w) => w + 1);
          }}
          onReset={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
            alphaRef.current = 1;
            setWakeCounter((w) => w + 1);
          }}
        />
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
