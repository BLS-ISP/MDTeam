"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  Link2,
  Lock,
} from "lucide-react";
import { isDocumentWriteProtected } from "../../utils/wiki/documentProtection";
import type { WikiTreeNode, WorkspaceFile } from "../../utils/wiki/pageTreeAndRefactor";

export interface PageTreeNodeViewProps {
  node: WikiTreeNode;
  activeFilePath: string;
  collapsedMap: Record<string, boolean>;
  inboundLinkCountMap: Record<string, number>;
  language: "de" | "en";
  onToggleCollapse: (nodeId: string) => void;
  onOpenFile: (filePath: string) => void;
  onRequestCreateSubpage: (parentPath: string, displayLabel: string) => void;
  onRequestRenameMove: (file: WorkspaceFile) => void;
  onDropMoveFile: (draggedFilePath: string, destinationFolderPath: string) => void;
}

const DRAG_MIME = "text/x-mdteam-filepath";

export function PageTreeNodeView({
  node,
  activeFilePath,
  collapsedMap,
  inboundLinkCountMap,
  language,
  onToggleCollapse,
  onOpenFile,
  onRequestCreateSubpage,
  onRequestRenameMove,
  onDropMoveFile,
}: PageTreeNodeViewProps) {
  const isEn = language === "en";
  const [hovered, setHovered] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const hasChildren = node.children.length > 0;
  const isCollapsed = Boolean(collapsedMap[node.id]);
  const isSelected = node.kind === "file" && activeFilePath === node.path;
  const isLocked = node.kind === "file" ? isDocumentWriteProtected(node.file).locked : false;
  const inboundCount = node.kind === "file" ? inboundLinkCountMap[node.path] || 0 : 0;

  const destinationFolder =
    node.kind === "folder" ? node.path : node.path.replace(/\.md$/i, "");

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (node.kind !== "file") return;
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(DRAG_MIME, node.path);
    e.dataTransfer.setData("text/plain", node.path);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const types = Array.from(e.dataTransfer.types || []);
    if (!types.includes(DRAG_MIME) && !types.includes("text/plain")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (!dragOver) setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const draggedPath =
      e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData("text/plain");
    if (!draggedPath || draggedPath === node.path) return;
    onDropMoveFile(draggedPath, destinationFolder);
  };

  const indentPx = 10 + node.depth * 13;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        className={`tree-item ${node.kind === "folder" ? "tree-item-folder" : "tree-item-file sub-item"} ${
          isSelected ? "selected" : ""
        }`}
        draggable={node.kind === "file"}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (node.kind === "folder") {
            onToggleCollapse(node.id);
          } else {
            onOpenFile(node.path);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "4px",
          paddingLeft: `${indentPx}px`,
          paddingRight: "8px",
          marginTop: node.depth === 0 && node.kind === "folder" ? "6px" : "0",
          backgroundColor: dragOver
            ? "rgba(99, 102, 241, 0.2)"
            : isSelected
              ? undefined
              : undefined,
          outline: dragOver ? "1px dashed var(--accent-indigo)" : "none",
          borderRadius: "4px",
          cursor: "pointer",
          minHeight: "26px",
        }}
      >
        {/* Left: Chevron + Icon + Name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            minWidth: 0,
            flex: 1,
          }}
        >
          {node.kind === "folder" || hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(node.id);
              }}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                width: "14px",
                height: "14px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                cursor: "pointer",
                flexShrink: 0,
              }}
              title={isCollapsed ? (isEn ? "Expand" : "Ausklappen") : isEn ? "Collapse" : "Einklappen"}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          ) : (
            <span style={{ width: "14px", flexShrink: 0 }} />
          )}

          {node.kind === "folder" ? (
            isCollapsed ? (
              <Folder size={13} style={{ color: "var(--accent-indigo)", flexShrink: 0 }} />
            ) : (
              <FolderOpen size={13} style={{ color: "var(--accent-indigo)", flexShrink: 0 }} />
            )
          ) : (
            <FileText
              size={13}
              style={{
                color: isSelected ? "var(--accent-indigo)" : "var(--text-secondary)",
                flexShrink: 0,
              }}
            />
          )}

          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: node.kind === "folder" && node.depth === 0 ? "12px" : "12px",
              fontWeight: node.kind === "folder" ? 600 : isSelected ? 600 : 400,
            }}
            title={node.path}
          >
            {node.displayTitle}
          </span>

          {isLocked && (
            <span
              title={isEn ? "Write-protected (Approved / Accepted)" : "Schreibgeschützt (Freigegeben / Akzeptiert)"}
              style={{ display: "inline-flex", alignItems: "center", color: "var(--accent-yellow)", flexShrink: 0 }}
            >
              <Lock size={10} />
            </span>
          )}

          {isCollapsed && hasChildren && (
            <span
              style={{
                fontSize: "9.5px",
                padding: "0 5px",
                borderRadius: "999px",
                backgroundColor: "var(--bg-active)",
                color: "var(--text-muted)",
                flexShrink: 0,
              }}
            >
              {node.children.length}
            </span>
          )}
        </div>

        {/* Right: Hover Quick-Actions (+ Subpage, Rename / Move with live link count) */}
        {hovered && (
          <div
            style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onRequestCreateSubpage(node.path, node.displayTitle)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "2px",
                padding: "2px 5px",
                borderRadius: "4px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-sidebar)",
                color: "var(--text-secondary)",
                fontSize: "10px",
                cursor: "pointer",
              }}
              title={
                isEn
                  ? `Add nested subpage under ${node.displayTitle}`
                  : `Unterseite unter ${node.displayTitle} erstellen`
              }
            >
              <FilePlus2 size={11} />
              <span>+</span>
            </button>

            {node.kind === "file" && node.file && (
              <button
                type="button"
                onClick={() => node.file && onRequestRenameMove(node.file)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  padding: "2px 5px",
                  borderRadius: "4px",
                  border:
                    inboundCount > 0
                      ? "1px solid rgba(99, 102, 241, 0.45)"
                      : "1px solid var(--border-color)",
                  backgroundColor:
                    inboundCount > 0 ? "rgba(99, 102, 241, 0.14)" : "var(--bg-sidebar)",
                  color: inboundCount > 0 ? "#c7d2fe" : "var(--text-secondary)",
                  fontSize: "10px",
                  fontWeight: inboundCount > 0 ? 600 : 500,
                  cursor: "pointer",
                }}
                title={
                  isEn
                    ? `Rename / Move (${inboundCount} link${inboundCount === 1 ? "" : "s"} will be auto-updated)`
                    : `Umbenennen / Verschieben (${inboundCount} Verweis${inboundCount === 1 ? "" : "e"} werden automatisch aktualisiert)`
                }
              >
                <FolderInput size={11} />
                {inboundCount > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "1px" }}>
                    <Link2 size={9} />
                    {inboundCount}
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Recursive Children */}
      {hasChildren && !isCollapsed && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {node.children.map((child) => (
            <PageTreeNodeView
              key={child.id}
              node={child}
              activeFilePath={activeFilePath}
              collapsedMap={collapsedMap}
              inboundLinkCountMap={inboundLinkCountMap}
              language={language}
              onToggleCollapse={onToggleCollapse}
              onOpenFile={onOpenFile}
              onRequestCreateSubpage={onRequestCreateSubpage}
              onRequestRenameMove={onRequestRenameMove}
              onDropMoveFile={onDropMoveFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
