"use client";

import React from "react";
import type { ImportedFilePreview } from "../../utils/atlassianImporter";
import {
  type AtlassianSourceType,
  type WorkspaceFile,
  getStatusBadgeColors,
} from "./modalTypesAndBadges";

export interface ImportPreviewTableProps {
  isEn: boolean;
  sourceType: AtlassianSourceType;
  parsedPreviews: ImportedFilePreview[];
  existingPathSet: Set<string>;
  selectedPaths: Record<string, boolean>;
  onSelectedPathsChange: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  inspectedPath: string | null;
  onInspectedPathChange: (path: string | null) => void;
}

export function ImportPreviewTable({
  isEn,
  sourceType,
  parsedPreviews,
  existingPathSet,
  selectedPaths,
  onSelectedPathsChange,
  inspectedPath,
  onInspectedPathChange,
}: ImportPreviewTableProps) {
  const inspectedFile: WorkspaceFile | undefined = parsedPreviews.find(
    (p) => p.file.path === inspectedPath
  )?.file;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.6px",
            color: "var(--text-muted)",
          }}
        >
          {isEn
            ? `Step 2 — Preview Parsed Workspace Files (${parsedPreviews.length})`
            : `Schritt 2 — Vorschau konvertierter Dateien (${parsedPreviews.length})`}
        </span>
        {parsedPreviews.length > 0 && (
          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            {isEn
              ? "Click any row to inspect generated Markdown"
              : "Zeile anklicken für Markdown-Vorschau"}
          </span>
        )}
      </div>

      {parsedPreviews.length === 0 ? (
        <div
          style={{
            padding: "34px 20px",
            borderRadius: "8px",
            border: "1px dashed var(--border-color)",
            backgroundColor: "var(--bg-panel)",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "12px",
          }}
        >
          {isEn
            ? "Upload a Jira CSV/JSON or Confluence HTML/MD export above, or click a Sample button for an instant demo."
            : "Laden Sie oben eine Jira- oder Confluence-Datei hoch oder klicken Sie auf einen der Sample-Buttons."}
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            overflow: "hidden",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--bg-sidebar)",
                  borderBottom: "1px solid var(--border-color)",
                  color: "var(--text-muted)",
                  fontSize: "11px",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "8px 10px", width: "32px" }}>
                  <input
                    type="checkbox"
                    checked={
                      parsedPreviews.length > 0 &&
                      parsedPreviews.every((p) => selectedPaths[p.file.path])
                    }
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const next: Record<string, boolean> = {};
                      parsedPreviews.forEach((p) => {
                        next[p.file.path] = checked;
                      });
                      onSelectedPathsChange(next);
                    }}
                  />
                </th>
                <th style={{ padding: "8px 10px" }}>{isEn ? "ID / Type" : "ID / Typ"}</th>
                <th style={{ padding: "8px 10px" }}>{isEn ? "Title" : "Titel"}</th>
                <th style={{ padding: "8px 10px" }}>Status</th>
                {sourceType !== "confluence" && (
                  <>
                    <th style={{ padding: "8px 10px" }}>SP</th>
                    <th style={{ padding: "8px 10px" }}>{isEn ? "Assignee" : "Bearbeiter"}</th>
                  </>
                )}
                <th style={{ padding: "8px 10px" }}>{isEn ? "Target Path" : "Zielpfad"}</th>
              </tr>
            </thead>
            <tbody>
              {parsedPreviews.map((item) => {
                const statusColors = getStatusBadgeColors(item.status);
                const willOverwrite = existingPathSet.has(item.file.path);
                const isInspected = inspectedPath === item.file.path;

                return (
                  <tr
                    key={item.file.path}
                    onClick={() =>
                      onInspectedPathChange(isInspected ? null : item.file.path)
                    }
                    style={{
                      borderBottom: "1px solid var(--border-color)",
                      backgroundColor: isInspected
                        ? "rgba(99, 102, 241, 0.08)"
                        : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <td
                      style={{ padding: "8px 10px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(selectedPaths[item.file.path])}
                        onChange={(e) =>
                          onSelectedPathsChange((prev) => ({
                            ...prev,
                            [item.file.path]: e.target.checked,
                          }))
                        }
                      />
                    </td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          color: "var(--accent-indigo)",
                          fontWeight: 600,
                        }}
                      >
                        {item.id}
                      </span>
                      <span
                        style={{
                          marginLeft: "6px",
                          fontSize: "10px",
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                        }}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "8px 10px",
                        color: "var(--text-primary)",
                        fontWeight: 500,
                        maxWidth: "260px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.title}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <span
                        style={{
                          padding: "2px 7px",
                          borderRadius: "999px",
                          fontSize: "10px",
                          fontWeight: 600,
                          backgroundColor: statusColors.bg,
                          color: statusColors.fg,
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                    {sourceType !== "confluence" && (
                      <>
                        <td
                          style={{
                            padding: "8px 10px",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {item.storyPoints || "-"}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            fontFamily: "var(--font-mono)",
                            fontSize: "11px",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {item.assignee}
                        </td>
                      </>
                    )}
                    <td
                      style={{
                        padding: "8px 10px",
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: "var(--text-muted)",
                      }}
                    >
                      {item.file.path}
                      {willOverwrite && (
                        <span
                          style={{
                            marginLeft: "6px",
                            color: "var(--accent-yellow)",
                            fontSize: "10px",
                          }}
                        >
                          ({isEn ? "update" : "Update"})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {inspectedFile && (
            <div
              style={{
                borderTop: "1px solid var(--border-color)",
                padding: "12px 14px",
                backgroundColor: "var(--bg-editor)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--accent-indigo)",
                  marginBottom: "6px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {inspectedFile.path}
              </div>
              <pre
                style={{
                  maxHeight: "170px",
                  overflowY: "auto",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-secondary)",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                }}
              >
                {inspectedFile.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
