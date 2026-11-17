"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Upload, AlertTriangle, X, Check } from "lucide-react";
import {
  importJiraCsv,
  importJiraJson,
  importConfluencePages,
  extractImportedFilePreview,
  type ImportedFilePreview,
  SAMPLE_JIRA_CSV,
  SAMPLE_JIRA_JSON,
  SAMPLE_CONFLUENCE_HTML,
} from "../../utils/atlassianImporter";
import type { AtlassianSourceType, WorkspaceFile } from "./modalTypesAndBadges";
import { ImportSourceControls } from "./ImportSourceControls";
import { ImportPreviewTable } from "./ImportPreviewTable";

export type { AtlassianSourceType };

export interface AtlassianImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportFiles: (newFiles: WorkspaceFile[]) => void;
  existingFiles?: WorkspaceFile[];
  language?: "de" | "en";
}

export function AtlassianImportModal({
  isOpen,
  onClose,
  onImportFiles,
  existingFiles = [],
  language = "de",
}: AtlassianImportModalProps) {
  const isEn = language === "en";
  const [sourceType, setSourceType] = useState<AtlassianSourceType>("jira-csv");
  const [projectPrefix, setProjectPrefix] = useState("");
  const [loadedPayloads, setLoadedPayloads] = useState<{ name: string; content: string }[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Record<string, boolean>>({});
  const [inspectedPath, setInspectedPath] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInspectedPath(null);
    }
  }, [isOpen]);

  const { parsedPreviews, parseError } = useMemo<{
    parsedPreviews: ImportedFilePreview[];
    parseError: string;
  }>(() => {
    if (loadedPayloads.length === 0) {
      return { parsedPreviews: [], parseError: "" };
    }
    try {
      let generated: WorkspaceFile[] = [];
      if (sourceType === "jira-csv") {
        generated = loadedPayloads.flatMap((p) =>
          importJiraCsv(p.content, projectPrefix || undefined)
        );
      } else if (sourceType === "jira-json") {
        generated = loadedPayloads.flatMap((p) =>
          importJiraJson(p.content, projectPrefix || undefined)
        );
      } else {
        generated = importConfluencePages(loadedPayloads);
      }
      return {
        parsedPreviews: generated.map(extractImportedFilePreview),
        parseError: "",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { parsedPreviews: [], parseError: msg };
    }
  }, [loadedPayloads, sourceType, projectPrefix]);

  // Select all newly parsed rows by default
  useEffect(() => {
    const nextSel: Record<string, boolean> = {};
    for (const p of parsedPreviews) {
      nextSel[p.file.path] = true;
    }
    setSelectedPaths(nextSel);
  }, [parsedPreviews]);

  if (!isOpen) return null;

  const existingPathSet = new Set(existingFiles.map((f) => f.path));

  const handleSwitchSource = (nextSource: AtlassianSourceType) => {
    setSourceType(nextSource);
    setLoadedPayloads([]);
    setInspectedPath(null);
  };

  const handleLoadSampleJira = () => {
    if (sourceType === "confluence") {
      setSourceType("jira-csv");
      setLoadedPayloads([{ name: "sample-jira-export.csv", content: SAMPLE_JIRA_CSV }]);
    } else if (sourceType === "jira-json") {
      setLoadedPayloads([{ name: "sample-jira-rest.json", content: SAMPLE_JIRA_JSON }]);
    } else {
      setLoadedPayloads([{ name: "sample-jira-export.csv", content: SAMPLE_JIRA_CSV }]);
    }
    setInspectedPath(null);
  };

  const handleLoadSampleConfluence = () => {
    setSourceType("confluence");
    setLoadedPayloads([
      {
        name: "system-architecture-runbook.html",
        content: SAMPLE_CONFLUENCE_HTML,
      },
    ]);
    setInspectedPath(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const uploaded: { name: string; content: string }[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const content = await f.text();
      uploaded.push({ name: f.name, content });
    }
    setLoadedPayloads(uploaded);
    setInspectedPath(null);
    e.target.value = "";
  };

  const selectedFilesToImport = parsedPreviews
    .filter((p) => selectedPaths[p.file.path])
    .map((p) => p.file);

  const handleConfirmImport = () => {
    if (selectedFilesToImport.length === 0) return;
    onImportFiles(selectedFilesToImport);
    setLoadedPayloads([]);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(860px, 94vw)",
          maxHeight: "88vh",
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Upload size={18} style={{ color: "var(--accent-indigo)" }} />
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                {isEn
                  ? "Atlassian (Jira & Confluence) Migration Wizard"
                  : "Atlassian (Jira & Confluence) Migrations-Assistent"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {isEn
                  ? "Convert Jira CSV/JSON tickets into issues/*.md and Confluence exports into wiki/*.md"
                  : "Jira CSV/JSON-Tickets nach issues/*.md und Confluence-Seiten nach wiki/*.md migrieren"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <ImportSourceControls
            isEn={isEn}
            sourceType={sourceType}
            projectPrefix={projectPrefix}
            onProjectPrefixChange={setProjectPrefix}
            onSwitchSource={handleSwitchSource}
            onLoadSampleJira={handleLoadSampleJira}
            onLoadSampleConfluence={handleLoadSampleConfluence}
            onFileUpload={handleFileUpload}
          />

          {parseError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid var(--accent-red)",
                backgroundColor: "rgba(239, 68, 68, 0.08)",
                color: "var(--accent-red)",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={15} />
              <span>{parseError}</span>
            </div>
          )}

          <ImportPreviewTable
            isEn={isEn}
            sourceType={sourceType}
            parsedPreviews={parsedPreviews}
            existingPathSet={existingPathSet}
            selectedPaths={selectedPaths}
            onSelectedPathsChange={setSelectedPaths}
            inspectedPath={inspectedPath}
            onInspectedPathChange={setInspectedPath}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderTop: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {selectedFilesToImport.length}{" "}
            {isEn ? "file(s) selected for Git workspace import" : "Datei(en) für den Import ausgewählt"}
          </span>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isEn ? "Cancel" : "Abbrechen"}
            </button>
            <button
              type="button"
              disabled={selectedFilesToImport.length === 0}
              onClick={handleConfirmImport}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor:
                  selectedFilesToImport.length > 0
                    ? "var(--accent-indigo)"
                    : "var(--bg-active)",
                color:
                  selectedFilesToImport.length > 0 ? "#ffffff" : "var(--text-muted)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: selectedFilesToImport.length > 0 ? "pointer" : "not-allowed",
              }}
            >
              <Check size={14} />
              {isEn
                ? `Import into Workspace (${selectedFilesToImport.length})`
                : `In Workspace importieren (${selectedFilesToImport.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
