"use client";

import React from "react";
import Editor from "@monaco-editor/react";
import { Eye, FileDown, FileText, Split, X } from "lucide-react";
import ProblemsPanel from "../ProblemsPanel";
import {
  PageGovernanceBar,
  handlePasteOrDropImage,
  countOpenInlineComments,
} from "../WikiEnhancements";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { parseMarkdown } from "../../utils/workspace/markdownRenderer";
import { registerCustomCompletions } from "../../utils/workspace/monacoSetup";
import { EditorToolbar } from "./EditorToolbar";
import { StakeholderCleanEditor } from "./StakeholderCleanEditor";
import { VisualEditorRouter } from "./visual-editors/VisualEditorRouter";

export function EditorSplitWorkspace() {
  const {
    files,
    filesRef,
    activeFile,
    activeFilePath,
    setActiveFilePath,
    openTabs,
    handleCloseTab,
    activeFilePathB,
    setActiveFilePathB,
    openTabsB,
    handleCloseTabB,
    splitActive,
    setSplitActive,
    activeEditorPane,
    setActiveEditorPane,
    editorMode,
    setEditorMode,
    showPreview,
    setShowPreview,
    roleMode,
    currentUser,
    isTauri,
    tauriRootFolder,
    language,
    modifiedFiles,
    diagnostics,
    showProblemsPanel,
    setShowProblemsPanel,
    editorRef,
    monacoRef,
    editorRefB,
    monacoRefB,
    setEditorAInstance,
    setEditorBInstance,
    handleEditorChange,
    updateMarkdownFileContent,
    handleUpsertWorkspaceFile,
    handleOpenFile,
    handleOpenFileWithLineJump,
    insertMarkdownImage,
    captureSelectionForComment,
    setIsCommentsDrawerOpen,
    setIsPageHistoryOpen,
    setIsTemplateGalleryOpen,
    setShowExportModal,
    setActivePanel,
    triggerDownload,
  } = useWorkspaceContext();

  const handleEditorPasteCapture = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
    if (!imageItem) return;
    const blob = imageItem.getAsFile();
    if (!blob) return;

    e.preventDefault();
    e.stopPropagation();
    const res = await handlePasteOrDropImage(blob, isTauri, tauriRootFolder);
    if (res?.markdown) {
      insertMarkdownImage(res.markdown);
    }
  };

  const handleEditorDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    const droppedFiles = Array.from(e.dataTransfer?.files || []);
    const imageFiles = droppedFiles.filter(
      (f) => f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(f.name || "")
    );
    if (imageFiles.length === 0) return;

    e.preventDefault();
    e.stopPropagation();
    for (const imgFile of imageFiles) {
      const res = await handlePasteOrDropImage(imgFile, isTauri, tauriRootFolder);
      if (res?.markdown) {
        insertMarkdownImage(res.markdown);
      }
    }
  };

  const renderedPreview = activeFile
    ? parseMarkdown(activeFile.content, {
        files,
        activeFilePath,
        language,
        onOpenFile: handleOpenFileWithLineJump,
        onOpenFileFromQuery: (targetPath) => {
          handleOpenFile(targetPath);
          setActivePanel("explorer");
        },
      })
    : null;

  return (
    <div
      className="editor-workspace"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
      onPasteCapture={handleEditorPasteCapture}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer?.types || []).includes("Files")) {
          e.preventDefault();
        }
      }}
      onDrop={handleEditorDrop}
    >
      {activeFile && activeFile.path.endsWith(".md") && (
        <PageGovernanceBar
          activeFile={activeFile}
          files={files}
          currentUser={currentUser}
          commentCount={countOpenInlineComments(files, activeFile.path)}
          isTauri={isTauri}
          language={language}
          onUpdateContent={(newContent) => {
            handleUpsertWorkspaceFile({ ...activeFile, content: newContent });
          }}
          onOpenComments={() => {
            captureSelectionForComment();
            setIsCommentsDrawerOpen(true);
          }}
          onOpenHistory={() => setIsPageHistoryOpen(true)}
          onOpenTemplates={() => setIsTemplateGalleryOpen(true)}
          onExportDocx={() => triggerDownload("docx", "single")}
        />
      )}

      {roleMode === "stakeholder" ? (
        <StakeholderCleanEditor renderedPreview={renderedPreview} />
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left Panel: Editor A */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              borderRight: splitActive ? "1px solid var(--border-color)" : "none",
              minWidth: 0,
            }}
          >
            <div className="editor-tabs" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", overflow: "hidden", position: "relative" }}>
              <div style={{ display: "flex", overflowX: "auto", flex: 1, height: "100%", scrollbarWidth: "none" }}>
                {openTabs.map((tabPath) => {
                  const tabFile = files.find((f) => f.path === tabPath);
                  return (
                    <div
                      key={tabPath}
                      className={`editor-tab ${activeFilePath === tabPath ? "active" : ""} ${activeEditorPane === "A" && activeFilePath === tabPath ? "pane-focused" : ""}`}
                      onClick={() => {
                        setActiveFilePath(tabPath);
                        setActiveEditorPane("A");
                      }}
                    >
                      <FileText size={12} />
                      <span>{tabFile?.name}</span>
                      {modifiedFiles[tabPath] && (
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--accent-yellow)" }} />
                      )}
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
                  height: "100%",
                  padding: "0 12px",
                  backgroundColor: "var(--bg-sidebar)",
                  borderLeft: "1px solid var(--border-color)",
                }}
              >
                {activeFilePath.endsWith(".md") && (
                  <div
                    className="editor-mode-toggle"
                    style={{
                      display: "flex",
                      border: "1px solid var(--border-color)",
                      borderRadius: "6px",
                      overflow: "hidden",
                      height: "24px",
                      marginRight: "8px",
                    }}
                  >
                    <button
                      className={`mode-btn ${editorMode === "code" ? "active" : ""}`}
                      onClick={() => setEditorMode("code")}
                      style={{
                        background: editorMode === "code" ? "var(--accent-indigo)" : "transparent",
                        color: editorMode === "code" ? "white" : "var(--text-secondary)",
                        border: "none",
                        padding: "2px 8px",
                        fontSize: "11px",
                        cursor: "pointer",
                        fontWeight: editorMode === "code" ? 600 : 400,
                      }}
                    >
                      Code
                    </button>
                    <button
                      className={`mode-btn ${editorMode === "visual" ? "active" : ""}`}
                      onClick={() => setEditorMode("visual")}
                      style={{
                        background: editorMode === "visual" ? "var(--accent-indigo)" : "transparent",
                        color: editorMode === "visual" ? "white" : "var(--text-secondary)",
                        border: "none",
                        padding: "2px 8px",
                        fontSize: "11px",
                        cursor: "pointer",
                        fontWeight: editorMode === "visual" ? 600 : 400,
                      }}
                    >
                      Visual
                    </button>
                  </div>
                )}
                <button
                  className="action-icon-btn"
                  onClick={() => setSplitActive(!splitActive)}
                  title="Editor aufteilen (Split Editor)"
                  style={{ color: splitActive ? "var(--accent-indigo)" : "var(--text-secondary)" }}
                >
                  <Split size={16} />
                </button>
                <button
                  className="action-icon-btn"
                  onClick={() => setShowPreview(!showPreview)}
                  title="Toggle Live-Vorschau"
                  style={{ color: showPreview ? "var(--accent-indigo)" : "var(--text-secondary)" }}
                >
                  <Eye size={16} />
                </button>
                <button className="action-icon-btn" onClick={() => setShowExportModal(true)} title="Dokument exportieren">
                  <FileDown size={16} />
                </button>
              </div>
            </div>

            <div className="editor-pane" style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
              {editorMode === "code" ? (
                <>
                  <EditorToolbar />
                  <div className="monaco-wrapper" style={{ flex: 1, minHeight: 0 }}>
                    <Editor
                      height="100%"
                      language="markdown"
                      theme="vs-dark"
                      value={activeFile?.content || ""}
                      onChange={handleEditorChange}
                      onMount={(editor, monaco) => {
                        editorRef.current = editor;
                        monacoRef.current = monaco;
                        setEditorAInstance(editor);
                        editor.onDidFocusEditorText(() => setActiveEditorPane("A"));
                        registerCustomCompletions(monaco, filesRef);
                      }}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: "on",
                        wordWrap: "on",
                        fontFamily: "var(--font-mono)",
                        automaticLayout: true,
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="visual-editor-wrapper" style={{ flex: 1, overflowY: "auto", padding: "20px", backgroundColor: "var(--bg-editor)" }}>
                  <VisualEditorRouter />
                </div>
              )}

              {showProblemsPanel && (
                <ProblemsPanel
                  diagnostics={diagnostics}
                  onSelectProblem={(filePath, line) => {
                    handleOpenFile(filePath);
                    setTimeout(() => {
                      if (editorRef.current) {
                        editorRef.current.revealLineInCenter(line);
                        editorRef.current.setPosition({ lineNumber: line, column: 1 });
                        editorRef.current.focus();
                      }
                    }, 100);
                  }}
                  onClose={() => setShowProblemsPanel(false)}
                  language={language}
                />
              )}
            </div>
          </div>

          {/* Right Panel: Editor B */}
          {splitActive && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", borderLeft: "1px solid var(--border-color)", minWidth: 0 }}>
              <div className="editor-tabs" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", overflow: "hidden", position: "relative" }}>
                <div style={{ display: "flex", overflowX: "auto", flex: 1, height: "100%", scrollbarWidth: "none" }}>
                  {openTabsB.map((tabPath) => {
                    const tabFile = files.find((f) => f.path === tabPath);
                    return (
                      <div
                        key={tabPath}
                        className={`editor-tab ${activeFilePathB === tabPath ? "active" : ""} ${activeEditorPane === "B" && activeFilePathB === tabPath ? "pane-focused" : ""}`}
                        onClick={() => {
                          setActiveFilePathB(tabPath);
                          setActiveEditorPane("B");
                        }}
                      >
                        <FileText size={12} />
                        <span>{tabFile?.name}</span>
                        {modifiedFiles[tabPath] && (
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--accent-yellow)" }} />
                        )}
                        <span className="tab-close" onClick={(e) => handleCloseTabB(e, tabPath)}>
                          <X size={10} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="editor-pane" style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                <div className="monaco-wrapper" style={{ flex: 1, minHeight: 0 }}>
                  <Editor
                    height="100%"
                    language="markdown"
                    theme="vs-dark"
                    value={files.find((f) => f.path === activeFilePathB)?.content || ""}
                    onChange={(val) => {
                      if (val === undefined) return;
                      updateMarkdownFileContent(activeFilePathB, val);
                    }}
                    onMount={(editor, monaco) => {
                      editorRefB.current = editor;
                      monacoRefB.current = monaco;
                      setEditorBInstance(editor);
                      editor.onDidFocusEditorText(() => setActiveEditorPane("B"));
                      registerCustomCompletions(monaco, filesRef);
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: "on",
                      wordWrap: "on",
                      fontFamily: "var(--font-mono)",
                      automaticLayout: true,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rightmost Panel: Preview */}
          {showPreview && !splitActive && (
            <div className="preview-pane" style={{ width: "45%" }}>
              <div
                className="panel-header"
                style={{
                  height: "36px",
                  minHeight: "36px",
                  borderBottom: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-panel)",
                }}
              >
                <span>{language === "en" ? "Live Preview" : "Echtzeit-Vorschau"}</span>
                <span className="logo-badge" style={{ fontSize: "8px", backgroundColor: "rgba(16, 185, 129, 0.1)" }}>
                  HTML + Query Macro
                </span>
              </div>
              <div className="preview-container markdown-body">{renderedPreview}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
