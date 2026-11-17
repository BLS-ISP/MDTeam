"use client";

import React from "react";
import { FileText } from "lucide-react";
import type { WorkspaceFile } from "../issueEngine";

export function renderTransclusionCard(
  refPath: string,
  lineRange: string,
  files: WorkspaceFile[],
  cardKey: string,
  onOpenFile: (filePath: string, lineRange?: string) => void
): React.ReactNode {
  const refFile = files.find((f) => f.path === refPath);
  let quotedContent = "";
  let displayLines = "";

  if (refFile) {
    if (lineRange) {
      const parts = lineRange.split("-");
      const startLine = parseInt(parts[0], 10);
      const endLine = parts[1] ? parseInt(parts[1], 10) : startLine;

      const fileLines = refFile.content.split("\n");
      quotedContent = fileLines.slice(startLine - 1, endLine).join("\n");
      displayLines = ` (Zeilen ${lineRange})`;
    } else {
      quotedContent = refFile.content;
    }
  } else {
    quotedContent = `[Referenzierte Datei nicht gefunden: ${refPath}]`;
  }

  return (
    <div
      key={cardKey}
      style={{
        borderLeft: "4px solid var(--accent-indigo)",
        backgroundColor: "rgba(99, 102, 241, 0.03)",
        borderRadius: "0 6px 6px 0",
        padding: "10px 16px",
        margin: "16px 0",
        border: "1px solid var(--border-color)",
        borderLeftWidth: "4px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--text-muted)",
          marginBottom: "8px",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <FileText size={12} />
          <span>
            Referenzierter Inhalt aus {refFile?.name || refPath}
            {displayLines}
          </span>
        </div>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onOpenFile(refPath, lineRange || undefined);
          }}
          style={{ color: "var(--accent-indigo)", textDecoration: "underline" }}
        >
          Inhalt öffnen
        </a>
      </div>
      <div
        style={{
          fontSize: "13px",
          color: "var(--text-secondary)",
          fontStyle: "italic",
          whiteSpace: "pre-wrap",
          fontFamily: "var(--font-sans)",
        }}
      >
        {quotedContent}
      </div>
    </div>
  );
}
