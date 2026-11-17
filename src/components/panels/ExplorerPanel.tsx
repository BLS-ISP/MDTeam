"use client";

import React from "react";
import { FilePlus, FileText, Folder, FolderPlus, Trash2 } from "lucide-react";
import { findBacklinks } from "../../utils/graphParser";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

export function ExplorerPanel() {
  const {
    t,
    language,
    files,
    categories,
    activeFilePath,
    isTauri,
    tauriRootFolder,
    recentProjects,
    getFolderBasename,
    openLocalFolder,
    handleSwitchProject,
    handleRemoveRecentProject,
    handleOpenFile,
    setShowNewFileModal,
    setShowNewFolderModal,
  } = useWorkspaceContext();

  const backlinks = findBacklinks(activeFilePath, files);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{t.repoExplorer}</span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              className="action-icon-btn"
              onClick={() => setShowNewFileModal(true)}
              title={t.newFile}
              style={{ padding: "2px" }}
            >
              <FilePlus size={14} />
            </button>
            <button
              className="action-icon-btn"
              onClick={() => setShowNewFolderModal(true)}
              title={t.newFolder}
              style={{ padding: "2px" }}
            >
              <FolderPlus size={14} />
            </button>
          </div>
        </div>

        {isTauri && (
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              backgroundColor: "rgba(255,255,255,0.01)",
            }}
          >
            <button
              onClick={openLocalFolder}
              className="git-btn"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                margin: 0,
                width: "100%",
                padding: "6px 12px",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              <FolderPlus size={12} />
              {tauriRootFolder
                ? language === "en"
                  ? "Change Workspace Folder"
                  : "Verzeichnis wechseln"
                : language === "en"
                  ? "Open Local Folder"
                  : "Lokalen Ordner öffnen"}
            </button>
            {tauriRootFolder && (
              <div
                style={{
                  fontSize: "9px",
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={tauriRootFolder}
              >
                {language === "en" ? "Root:" : "Pfad:"} {tauriRootFolder}
              </div>
            )}

            {recentProjects.length > 0 && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>{language === "en" ? "Recent Projects" : "Kürzliche Projekte"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {recentProjects.map((projPath) => {
                    const isCurrent = tauriRootFolder === projPath;
                    const folderName = getFolderBasename(projPath);
                    return (
                      <div
                        key={projPath}
                        onClick={() => handleSwitchProject(projPath)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          backgroundColor: isCurrent ? "rgba(99, 102, 241, 0.1)" : "transparent",
                          borderLeft: isCurrent ? "2px solid var(--accent-indigo)" : "2px solid transparent",
                          transition: "all 0.2s ease",
                        }}
                        className="recent-project-row"
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                          <Folder
                            size={12}
                            style={{ color: isCurrent ? "var(--accent-indigo)" : "var(--text-muted)", flexShrink: 0 }}
                          />
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "var(--text-primary)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {folderName}
                            </span>
                            <span
                              style={{
                                fontSize: "9px",
                                color: "var(--text-muted)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={projPath}
                            >
                              {projPath}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleRemoveRecentProject(projPath, e)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: "2px",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "opacity 0.2s",
                          }}
                          className="recent-project-delete-btn"
                          title={language === "en" ? "Remove from history" : "Aus Verlauf entfernen"}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="panel-content" style={{ flex: 1, overflowY: "auto" }}>
          {categories
            .filter((cat) => !cat.startsWith("."))
            .map((cat) => {
              const parts = cat.split("/");
              const depth = parts.length - 1;
              const lastPart = parts[parts.length - 1];

              let displayName = lastPart;
              if (cat === "arc42") displayName = t.arc42Doc;
              else if (cat === "adrs") displayName = t.adrsDecisions;
              else if (cat === "issues") displayName = t.issuesTickets;
              else if (cat === "sprints") displayName = t.sprintsFolder;
              else if (cat === "wiki") displayName = t.wikiPages;
              else if (cat === "management") displayName = t.mgmtRoadmaps;
              else if (cat === "meetings") displayName = t.meetProtokolle;

              return (
                <React.Fragment key={cat}>
                  <div
                    className="tree-item tree-item-folder"
                    style={{
                      marginTop: cat !== categories[0] && depth === 0 ? "12px" : "0",
                      paddingLeft: `${16 + depth * 12}px`,
                    }}
                  >
                    <Folder size={14} style={{ color: "var(--accent-indigo)" }} />
                    <span>{displayName}</span>
                  </div>
                  {files
                    .filter((f) => f.category === cat)
                    .map((f) => (
                      <div
                        key={f.path}
                        className={`tree-item tree-item-file sub-item ${activeFilePath === f.path ? "selected" : ""}`}
                        onClick={() => handleOpenFile(f.path)}
                        style={{ paddingLeft: `${28 + depth * 12}px` }}
                      >
                        <FileText size={13} />
                        <span>{f.name}</span>
                      </div>
                    ))}
                </React.Fragment>
              );
            })}
        </div>
      </div>

      {/* Backlinks finder panel section */}
      <div style={{ borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-sidebar)", padding: "0 0 10px 0" }}>
        <div className="panel-header" style={{ height: "32px", minHeight: "32px", fontSize: "11px", display: "flex", alignItems: "center" }}>
          <span>
            {t.backlinks} ({backlinks.length})
          </span>
        </div>
        <div style={{ padding: "4px 16px", maxHeight: "140px", overflowY: "auto", fontSize: "11px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {backlinks.length === 0 ? (
            <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{t.noBacklinks}</span>
          ) : (
            backlinks.map((sourcePath) => {
              const srcFile = files.find((f) => f.path === sourcePath);
              return (
                <div
                  key={sourcePath}
                  onClick={() => handleOpenFile(sourcePath)}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)" }}
                  className="backlink-item"
                >
                  <FileText size={10} style={{ color: "var(--text-muted)" }} />
                  <span style={{ textDecoration: "underline" }}>{srcFile?.name || sourcePath}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
