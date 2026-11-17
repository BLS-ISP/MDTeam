"use client";

import React from "react";
import { HelpCircle, Share2 } from "lucide-react";
import { GRAPH_LEGEND_ITEMS } from "./graphHelpers";

export function GraphHeaderAndInstructions({ isEn }: { isEn: boolean }) {
  return (
    <>
      <div
        className="panel-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-panel)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Share2 size={16} style={{ color: "var(--accent-indigo)" }} />
          <span style={{ fontWeight: 600 }}>
            {isEn
              ? "Document Relationship Graph"
              : "Dokumenten-Beziehungs-Graph"}
          </span>
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            fontSize: "10px",
            flexWrap: "wrap",
          }}
        >
          {GRAPH_LEGEND_ITEMS.map((item) => (
            <div
              key={item.label}
              style={{ display: "flex", alignItems: "center", gap: "4px" }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: item.color,
                }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          padding: "6px 16px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          backgroundColor: "rgba(99, 102, 241, 0.02)",
        }}
      >
        <HelpCircle size={12} />
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {isEn
            ? "Drag background to pan | Scroll to zoom | Drag nodes to pin | Double-click to unpin | Click node to open"
            : "Hintergrund ziehen = Verschieben | Scrollen = Zoomen | Knoten ziehen = Pinne | Doppelklick = Lösen | Klick = Öffnen"}
        </span>
      </div>
    </>
  );
}

export function GraphZoomControls({
  isEn,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  isEn: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const iconBtnBase: React.CSSProperties = {
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "none",
    cursor: "pointer",
    borderRadius: "4px",
    fontWeight: "bold",
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "16px",
        right: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        backgroundColor: "var(--bg-panel)",
        border: "1px solid var(--border-color)",
        borderRadius: "8px",
        padding: "4px",
        boxShadow: "var(--shadow-md)",
        zIndex: 10,
      }}
    >
      <button
        onClick={onZoomIn}
        style={{
          ...iconBtnBase,
          width: "28px",
          color: "var(--text-primary)",
          fontSize: "16px",
        }}
        title={isEn ? "Zoom In" : "Vergrößern"}
        className="action-icon-btn"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        style={{
          ...iconBtnBase,
          width: "28px",
          color: "var(--text-primary)",
          fontSize: "16px",
        }}
        title={isEn ? "Zoom Out" : "Verkleinern"}
        className="action-icon-btn"
      >
        −
      </button>
      <button
        onClick={onReset}
        style={{
          ...iconBtnBase,
          width: "38px",
          color: "var(--text-secondary)",
          fontSize: "9px",
        }}
        title={isEn ? "Reset View" : "Zurücksetzen"}
        className="action-icon-btn"
      >
        Reset
      </button>
    </div>
  );
}
