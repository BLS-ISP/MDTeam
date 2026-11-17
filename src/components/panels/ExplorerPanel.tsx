"use client";

import React, { useMemo, useState } from "react";
import { Check, FilePlus, FileText, Folder, FolderPlus, Trash2, X } from "lucide-react";
import { findBacklinks } from "../../utils/graphParser";
import {
  buildWikiPageTree,
  createNestedSubpage,
  normalizeWorkspacePath,
  previewLinkRefactorImpact,
  renameOrMoveWorkspaceFile,
  type WorkspaceFile,
} from "../../utils/wiki/pageTreeAndRefactor";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { PageTreeNodeView } from "./PageTreeNodeView";
import { RenameMovePageModal } from "./RenameMovePageModal";

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
    handleUpsertWorkspaceFile,
    handleUpsertMultipleFiles,
    handleDeleteWorkspaceFile,
    setShowNewFileModal,
    setShowNewFolderModal,
  } = useWorkspaceContext();

  const isEn = language === "en";
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [renameTargetFile, setRenameTargetFile] = useState<WorkspaceFile | null>(null);
  const [subpageTarget, setSubpageTarget] = useState<{ parentPath: string; label: string } | null>(null);
  const [subpageTitle, setSubpageTitle] = useState("");
  const [refactorNotice, setRefactorNotice] = useState<string>("");

  const rootLabels = useMemo<Record<string, string>>(
    () => ({
      arc42: t.arc42Doc,
      adrs: t.adrsDecisions,
      issues: t.issuesTickets,
      sprints: t.sprintsFolder,
      wiki: t.wikiPages,
      management: t.mgmtRoadmaps,
      meetings: t.meetProtokolle,
    }),
    [t]
  );

  const pageTree = useMemo(
    () => buildWikiPageTree(files, categories, rootLabels),
    [files, categories, rootLabels]
  );

  const inboundLinkCountMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const f of files) {
      const clean = normalizeWorkspacePath(f.path);
      if (!clean || clean.startsWith(".") || !clean.toLowerCase().endsWith(".md")) continue;
      map[clean] = previewLinkRefactorImpact(files, clean).totalLinks;
    }
    return map;
  }, [files]);

  const backlinks = useMemo(() => findBacklinks(activeFilePath, files), [activeFilePath, files]);

  const showNotice = (msg: string) => {
    setRefactorNotice(msg);
    setTimeout(() => setRefactorNotice((curr) => (curr === msg ? "" : curr)), 4200);
  };

  const executeRenameOrMove = async (oldPath: string, newPath: string) => {
    const cleanOld = normalizeWorkspacePath(oldPath);
    const rawNew = normalizeWorkspacePath(newPath);
    const cleanNew =
      cleanOld.toLowerCase().endsWith(".md") && !rawNew.toLowerCase().endsWith(".md")
        ? `${rawNew}.md`
        : rawNew;

    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;
    if (files.some((f) => normalizeWorkspacePath(f.path) === cleanNew)) {
      showNotice(isEn ? `Target already exists: ${cleanNew}` : `Ziel existiert bereits: ${cleanNew}`);
      return;
    }

    const { updatedFiles, rewrittenLinkCount } = renameOrMoveWorkspaceFile(files, cleanOld, cleanNew);
    const filesToPersist = updatedFiles.filter((uf) => {
      const ufClean = normalizeWorkspacePath(uf.path);
      if (ufClean === cleanNew) return true;
      const orig = files.find((pf) => normalizeWorkspacePath(pf.path) === ufClean);
      return !orig || orig.content !== uf.content;
    });

    const wasActive = normalizeWorkspacePath(activeFilePath) === cleanOld;
    await handleUpsertMultipleFiles(filesToPersist);
    await handleDeleteWorkspaceFile(cleanOld);
    if (wasActive) handleOpenFile(cleanNew);

    showNotice(
      isEn
        ? `Moved to ${cleanNew} (${rewrittenLinkCount} link${rewrittenLinkCount === 1 ? "" : "s"} updated)`
        : `Verschoben nach ${cleanNew} (${rewrittenLinkCount} Verweis${rewrittenLinkCount === 1 ? "" : "e"} angepasst)`
    );
  };

  const handleDropMoveFile = (draggedFilePath: string, destinationFolderPath: string) => {
    const cleanDragged = normalizeWorkspacePath(draggedFilePath);
    const cleanDestDir = normalizeWorkspacePath(destinationFolderPath);
    if (!cleanDragged || !cleanDestDir) return;

    const draggedStem = cleanDragged.replace(/\.md$/i, "");
    if (cleanDestDir === draggedStem || cleanDestDir.startsWith(`${draggedStem}/`)) return;

    const baseName = cleanDragged.split("/").pop() || cleanDragged;
    const targetPath = `${cleanDestDir}/${baseName}`;
    if (targetPath !== cleanDragged) void executeRenameOrMove(cleanDragged, targetPath);
  };

  const handleConfirmCreateSubpage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subpageTarget || !subpageTitle.trim()) return;
    const childFile = createNestedSubpage(subpageTarget.parentPath, subpageTitle.trim(), language);
    if (files.some((f) => normalizeWorkspacePath(f.path) === childFile.path)) {
      showNotice(isEn ? `Page already exists: ${childFile.path}` : `Seite existiert bereits: ${childFile.path}`);
      return;
    }
    await handleUpsertWorkspaceFile(childFile);
    setCollapsedMap((prev) => ({
      ...prev,
      [`folder:${subpageTarget.parentPath}`]: false,
      [`file:${subpageTarget.parentPath}`]: false,
    }));
    handleOpenFile(childFile.path);
    setSubpageTarget(null);
    setSubpageTitle("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{t.repoExplorer}</span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button className="action-icon-btn" onClick={() => setShowNewFileModal(true)} title={t.newFile} style={{ padding: "2px" }}>
              <FilePlus size={14} />
            </button>
            <button className="action-icon-btn" onClick={() => setShowNewFolderModal(true)} title={t.newFolder} style={{ padding: "2px" }}>
              <FolderPlus size={14} />
            </button>
          </div>
        </div>

        {isTauri && (
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "6px", backgroundColor: "rgba(255,255,255,0.01)" }}>
            <button onClick={openLocalFolder} className="git-btn" style={{ width: "100%", padding: "6px 12px", fontSize: "11px", fontWeight: 600 }}>
              <FolderPlus size={12} />
              {tauriRootFolder ? (isEn ? "Change Workspace Folder" : "Verzeichnis wechseln") : isEn ? "Open Local Folder" : "Lokalen Ordner öffnen"}
            </button>
            {tauriRootFolder && (
              <div style={{ fontSize: "9px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tauriRootFolder}>
                {isEn ? "Root:" : "Pfad:"} {tauriRootFolder}
              </div>
            )}

            {recentProjects.length > 0 && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, color: "var(--text-muted)" }}>
                  {isEn ? "Recent Projects" : "Kürzliche Projekte"}
                </span>
                {recentProjects.map((projPath) => {
                  const isCurrent = tauriRootFolder === projPath;
                  return (
                    <div
                      key={projPath}
                      onClick={() => handleSwitchProject(projPath)}
                      className="recent-project-row"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        backgroundColor: isCurrent ? "rgba(99, 102, 241, 0.1)" : "transparent",
                        borderLeft: isCurrent ? "2px solid var(--accent-indigo)" : "2px solid transparent",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                        <Folder size={12} style={{ color: isCurrent ? "var(--accent-indigo)" : "var(--text-muted)", flexShrink: 0 }} />
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {getFolderBasename(projPath)}
                          </span>
                          <span style={{ fontSize: "9px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={projPath}>
                            {projPath}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleRemoveRecentProject(projPath, e)}
                        className="recent-project-delete-btn"
                        style={{ background: "none", border: "none", padding: "2px", cursor: "pointer", color: "var(--text-muted)" }}
                        title={isEn ? "Remove from history" : "Aus Verlauf entfernen"}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {subpageTarget && (
          <form
            onSubmit={handleConfirmCreateSubpage}
            style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)", backgroundColor: "rgba(99, 102, 241, 0.09)", display: "flex", flexDirection: "column", gap: "6px" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10.5px", color: "var(--text-secondary)" }}>
              <span>
                {isEn ? "New subpage under:" : "Neue Unterseite unter:"} <strong style={{ color: "var(--text-primary)" }}>{subpageTarget.label}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSubpageTarget(null);
                  setSubpageTitle("");
                }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={12} />
              </button>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="text"
                value={subpageTitle}
                onChange={(e) => setSubpageTitle(e.target.value)}
                placeholder={isEn ? "Subpage title (e.g. OAuth Flow)" : "Titel der Unterseite (z.B. OAuth Flow)"}
                className="settings-input"
                style={{ padding: "5px 8px", fontSize: "11.5px" }}
                autoFocus
              />
              <button type="submit" className="git-btn" style={{ padding: "5px 10px", fontSize: "11px" }}>
                <Check size={12} />
              </button>
            </div>
          </form>
        )}

        {refactorNotice && (
          <div style={{ padding: "6px 12px", fontSize: "11px", backgroundColor: "rgba(16, 185, 129, 0.13)", borderBottom: "1px solid rgba(16, 185, 129, 0.35)", color: "var(--accent-green)", fontWeight: 500 }}>
            {refactorNotice}
          </div>
        )}

        <div className="panel-content" style={{ flex: 1, overflowY: "auto", paddingBottom: "8px" }}>
          {pageTree.map((rootNode) => (
            <PageTreeNodeView
              key={rootNode.id}
              node={rootNode}
              activeFilePath={activeFilePath}
              collapsedMap={collapsedMap}
              inboundLinkCountMap={inboundLinkCountMap}
              language={language}
              onToggleCollapse={(nodeId) => setCollapsedMap((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }))}
              onOpenFile={handleOpenFile}
              onRequestCreateSubpage={(parentPath, label) => {
                setSubpageTarget({ parentPath, label });
                setSubpageTitle("");
              }}
              onRequestRenameMove={(file) => setRenameTargetFile(file)}
              onDropMoveFile={handleDropMoveFile}
            />
          ))}
        </div>
      </div>

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

      <RenameMovePageModal
        isOpen={Boolean(renameTargetFile)}
        targetFile={renameTargetFile}
        files={files}
        categories={categories}
        language={language}
        onClose={() => setRenameTargetFile(null)}
        onConfirmRenameMove={executeRenameOrMove}
      />
    </div>
  );
}
