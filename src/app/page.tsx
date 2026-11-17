"use client";

import React from "react";
import DocumentGraph from "../components/DocumentGraph";
import GlobalSearch from "../components/GlobalSearch";
import { WorkspaceProvider, useWorkspaceContext } from "../context/WorkspaceContext";
import { AppTopBar } from "../components/layout/AppTopBar";
import { ActivityStrip } from "../components/layout/ActivityStrip";
import { AppStatusBar } from "../components/layout/AppStatusBar";
import { WorkspaceModalsHost } from "../components/layout/WorkspaceModalsHost";
import { ExplorerPanel } from "../components/panels/ExplorerPanel";
import { GitPanel } from "../components/panels/GitPanel";
import { MeetingPanel } from "../components/panels/MeetingPanel";
import { SettingsPanel } from "../components/panels/SettingsPanel";
import { CheatsheetPanel } from "../components/panels/CheatsheetPanel";
import { PmSidebarPanel } from "../components/panels/PmSidebarPanel";
import { PmDashboardWrapper } from "../components/panels/PmDashboardWrapper";
import { EditorSplitWorkspace } from "../components/editor/EditorSplitWorkspace";

function WorkspaceShell() {
  const {
    activePanel,
    setActivePanel,
    files,
    language,
    handleOpenFile,
    editorRef,
  } = useWorkspaceContext();

  return (
    <div className="app-container">
      <AppTopBar />

      <div className="workspace-body">
        <ActivityStrip />

        <aside className="context-panel">
          {activePanel === "explorer" && <ExplorerPanel />}
          {activePanel === "search" && (
            <GlobalSearch
              files={files}
              onSelectResult={(filePath, line) => {
                handleOpenFile(filePath);
                setTimeout(() => {
                  if (editorRef.current) {
                    editorRef.current.revealLineInCenter(line);
                    editorRef.current.setPosition({ lineNumber: line, column: 1 });
                    editorRef.current.focus();
                  }
                }, 100);
              }}
              language={language}
            />
          )}
          {activePanel === "git" && <GitPanel />}
          {activePanel === "pm" && <PmSidebarPanel />}
          {activePanel === "meetings" && <MeetingPanel />}
          {activePanel === "settings" && <SettingsPanel />}
          {activePanel === "cheatsheet" && <CheatsheetPanel />}
        </aside>

        {activePanel === "pm" ? (
          <PmDashboardWrapper />
        ) : activePanel === "graph" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <DocumentGraph
              files={files}
              onSelectNode={(filePath) => {
                handleOpenFile(filePath);
                setActivePanel("explorer");
              }}
              language={language}
            />
          </div>
        ) : (
          <EditorSplitWorkspace />
        )}
      </div>

      <AppStatusBar />
      <WorkspaceModalsHost />

      {/* Collaborator Presence Cursor Styles */}
      <style>{`
        .collab-cursor-BobDev {
          border-left: 2px solid #ef4444 !important;
          background-color: rgba(239, 68, 68, 0.05);
        }
        .collab-cursor-AliceArch {
          border-left: 2px solid #10b981 !important;
          background-color: rgba(16, 185, 129, 0.05);
        }
        .backlink-item:hover {
          color: var(--accent-indigo) !important;
        }
        .branch-menu-item {
          cursor: pointer;
          transition: background-color 0.1s;
        }
        .branch-menu-item:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
        .pane-focused {
          border-top-color: var(--accent-indigo) !important;
          background-color: rgba(99, 102, 241, 0.03) !important;
        }
      `}</style>
    </div>
  );
}

export default function Workspace() {
  return (
    <WorkspaceProvider>
      <WorkspaceShell />
    </WorkspaceProvider>
  );
}
