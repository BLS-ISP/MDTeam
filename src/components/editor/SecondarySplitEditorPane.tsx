"use client";

import React from "react";
import Editor from "@monaco-editor/react";
import { FileText, X } from "lucide-react";
import { ApprovalLockBanner } from "../WikiEnhancements";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { registerCustomCompletions } from "../../utils/workspace/monacoSetup";
import {
  createSupersedingAdr,
  isDocumentWriteProtected,
  startNewDocumentRevision,
} from "../../utils/wiki/documentProtection";

export function SecondarySplitEditorPane() {
  const {
    files,
    filesRef,
    activeFilePathB,
    setActiveFilePathB,
    openTabsB,
    handleCloseTabB,
    activeEditorPane,
    setActiveEditorPane,
    modifiedFiles,
    editorRefB,
    monacoRefB,
    setEditorBInstance,
    updateMarkdownFileContent,
    handleUpsertWorkspaceFile,
    handleUpsertMultipleFiles,
    currentUser,
    language,
    isStakeholderReadOnly,
  } = useWorkspaceContext();

  const fileB = files.find((f) => f.path === activeFilePathB);
  const protectionB = isDocumentWriteProtected(fileB);
  const isReadOnlyB = protectionB.locked || isStakeholderReadOnly;

  return (
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

      {fileB && protectionB.locked && (
        <ApprovalLockBanner
          file={fileB}
          reason={protectionB.reason}
          approvedBy={protectionB.approvedBy}
          language={language}
          compact
          onStartNewRevision={
            isStakeholderReadOnly
              ? undefined
              : () => {
                  const unlocked = startNewDocumentRevision(fileB, currentUser || "@editor");
                  void handleUpsertWorkspaceFile(unlocked);
                }
          }
          onSupersedeAdr={
            isStakeholderReadOnly
              ? undefined
              : async () => {
                  const { newAdr, updatedOldAdr } = createSupersedingAdr(
                    fileB,
                    files,
                    currentUser || "@architect",
                    language
                  );
                  await handleUpsertMultipleFiles([updatedOldAdr, newAdr]);
                  setActiveFilePathB(newAdr.path);
                }
          }
        />
      )}

      <div className="editor-pane" style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div className="monaco-wrapper" style={{ flex: 1, minHeight: 0 }}>
          <Editor
            height="100%"
            language="markdown"
            theme="vs-dark"
            value={fileB?.content || ""}
            onChange={(val) => {
              if (val === undefined || isReadOnlyB) return;
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
              readOnly: isReadOnlyB,
            }}
          />
        </div>
      </div>
    </div>
  );
}
