"use client";

import React from "react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { parseMarkdown } from "../../utils/workspace/markdownRenderer";

export function PrintableExportView() {
  const {
    printScope,
    files,
    activeFile,
    activeFilePath,
    language,
    handleOpenFile,
    handleOpenFileWithLineJump,
    setActivePanel,
  } = useWorkspaceContext();

  if (!printScope || !activeFile) return null;

  const renderOpts = {
    files,
    activeFilePath,
    language,
    onOpenFile: handleOpenFileWithLineJump,
    onOpenFileFromQuery: (targetPath: string) => {
      handleOpenFile(targetPath);
      setActivePanel("explorer");
    },
  };

  return (
    <div
      id="print-capture-container"
      className="markdown-body"
      style={{ display: "none", padding: "40px", backgroundColor: "#fff", color: "#000" }}
    >
      {printScope === "book" ? (
        <>
          <h1 style={{ textAlign: "center", marginBottom: "40px" }}>
            MDTeam arc42 Architekturdokumentation (Gesamtausgabe)
          </h1>
          {files
            .filter((f) => f.category === "arc42")
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((f, idx) => (
              <div key={f.path} style={{ pageBreakAfter: "always", marginTop: "20px" }}>
                <h2 style={{ borderBottom: "2px solid #333", paddingBottom: "8px" }}>
                  {idx + 1}. {f.name.replace(".md", "").replace(/^\d+_/, "").replace(/_/g, " ").toUpperCase()}
                </h2>
                {parseMarkdown(f.content, renderOpts)}
              </div>
            ))}
        </>
      ) : (
        <>
          <h1 style={{ borderBottom: "2px solid #333", paddingBottom: "8px" }}>
            {activeFile.name.replace(".md", "").replace(/^\d+_/, "").replace(/_/g, " ").toUpperCase()}
          </h1>
          {parseMarkdown(activeFile.content, renderOpts)}
        </>
      )}
    </div>
  );
}
