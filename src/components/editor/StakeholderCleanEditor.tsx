"use client";

import React from "react";
import { Calendar, FileDown, FileText, X } from "lucide-react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { VisualEditorRouter } from "./visual-editors/VisualEditorRouter";

export function StakeholderCleanEditor({ renderedPreview }: { renderedPreview: React.ReactNode }) {
  const {
    files,
    openTabs,
    activeFilePath,
    setActiveFilePath,
    handleCloseTab,
    stakeholderEditVisual,
    setStakeholderEditVisual,
    language,
    setActivePanel,
    setPmSubTab,
    setShowExportModal,
    isStakeholderReadOnly,
  } = useWorkspaceContext();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "var(--bg-editor)" }}>
      <div className="editor-tabs" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", overflow: "hidden" }}>
        <div style={{ display: "flex", overflowX: "auto", flex: 1, height: "100%", scrollbarWidth: "none" }}>
          {openTabs.map((tabPath) => {
            const tabFile = files.find((f) => f.path === tabPath);
            return (
              <div
                key={tabPath}
                className={`editor-tab ${activeFilePath === tabPath ? "active" : ""}`}
                onClick={() => setActiveFilePath(tabPath)}
              >
                <FileText size={12} />
                <span>{tabFile?.name}</span>
                <span className="tab-close" onClick={(e) => handleCloseTab(e, tabPath)}>
                  <X size={10} />
                </span>
              </div>
            );
          })}
        </div>
        <div
          className="editor-actions"
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            height: "100%",
            padding: "0 12px",
            backgroundColor: "var(--bg-sidebar)",
            borderLeft: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", border: "1px solid var(--border-color)", borderRadius: "6px", overflow: "hidden", height: "24px" }}>
            <button
              onClick={() => setStakeholderEditVisual(false)}
              style={{
                background: !stakeholderEditVisual ? "var(--accent-indigo)" : "transparent",
                color: !stakeholderEditVisual ? "white" : "var(--text-secondary)",
                border: "none",
                padding: "2px 10px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {language === "en" ? "Wiki Reader" : "Wiki-Ansicht"}
            </button>
            {!isStakeholderReadOnly && (
              <button
                onClick={() => setStakeholderEditVisual(true)}
                style={{
                  background: stakeholderEditVisual ? "var(--accent-indigo)" : "transparent",
                  color: stakeholderEditVisual ? "white" : "var(--text-secondary)",
                  border: "none",
                  padding: "2px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {language === "en" ? "Visual Form" : "Visuell bearbeiten"}
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setActivePanel("pm");
              setPmSubTab("scrum");
            }}
            style={{
              backgroundColor: "rgba(59, 130, 246, 0.14)",
              border: "1px solid rgba(59, 130, 246, 0.35)",
              color: "var(--accent-blue)",
              borderRadius: "6px",
              padding: "3px 10px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Calendar size={12} />
            {language === "en" ? "Jira Board" : "Jira-Board"}
          </button>
          <button
            className="action-icon-btn"
            onClick={() => setShowExportModal(true)}
            title={language === "en" ? "Export Document" : "Dokument exportieren"}
          >
            <FileDown size={16} />
          </button>
        </div>
      </div>

      {stakeholderEditVisual ? (
        <div className="visual-editor-wrapper" style={{ flex: 1, overflowY: "auto", padding: "24px", backgroundColor: "var(--bg-editor)" }}>
          <VisualEditorRouter />
        </div>
      ) : (
        <div className="preview-container markdown-body" style={{ maxWidth: "960px", width: "100%", margin: "0 auto", padding: "32px 40px" }}>
          {renderedPreview}
        </div>
      )}
    </div>
  );
}
