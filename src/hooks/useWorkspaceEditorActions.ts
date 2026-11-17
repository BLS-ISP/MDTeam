"use client";

import { useState, useEffect } from "react";
import type React from "react";
import {
  AgileIssue,
  WorkspaceFile,
  parseSprints,
  createBlankIssue,
  serializeIssueToMarkdown,
} from "../utils/issueEngine";
import type { WorkspaceRoleMode } from "../components/CommandPaletteAndModals";
import { insertTemplateBlock as insertTemplateBlockHelper } from "../utils/workspace/monacoSetup";
import type { WorkspacePanelId } from "../context/WorkspaceContext";

interface UseWorkspaceEditorActionsParams {
  files: WorkspaceFile[];
  setFiles: React.Dispatch<React.SetStateAction<WorkspaceFile[]>>;
  filesRef: React.MutableRefObject<WorkspaceFile[]>;
  activeFile: WorkspaceFile;
  activeFilePath: string;
  setActiveFilePath: React.Dispatch<React.SetStateAction<string>>;
  openTabs: string[];
  setOpenTabs: React.Dispatch<React.SetStateAction<string[]>>;
  splitActive: boolean;
  setSplitActive: React.Dispatch<React.SetStateAction<boolean>>;
  activeFilePathB: string;
  setActiveFilePathB: React.Dispatch<React.SetStateAction<string>>;
  openTabsB: string[];
  setOpenTabsB: React.Dispatch<React.SetStateAction<string[]>>;
  activeEditorPane: "A" | "B";
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  roleMode: WorkspaceRoleMode;
  editorMode: "code" | "visual";
  currentUser: string;
  tauriRootFolder: string;
  setModifiedFiles: React.Dispatch<React.SetStateAction<{ [path: string]: boolean }>>;
  handleUpsertWorkspaceFile: (file: WorkspaceFile) => Promise<void>;
  setActivePanel: React.Dispatch<React.SetStateAction<WorkspacePanelId>>;
  editorRef: React.MutableRefObject<any>;
  editorRefB: React.MutableRefObject<any>;
}

export function useWorkspaceEditorActions({
  files,
  setFiles,
  filesRef,
  activeFile,
  activeFilePath,
  setActiveFilePath,
  openTabs,
  setOpenTabs,
  splitActive,
  setSplitActive,
  activeFilePathB,
  setActiveFilePathB,
  openTabsB,
  setOpenTabsB,
  activeEditorPane,
  categories,
  setCategories,
  roleMode,
  editorMode,
  currentUser,
  tauriRootFolder,
  setModifiedFiles,
  handleUpsertWorkspaceFile,
  setActivePanel,
  editorRef,
  editorRefB,
}: UseWorkspaceEditorActionsParams) {
  // Modal & drawer states owned by editor/issue/file actions
  const [isGitBranchModalOpen, setIsGitBranchModalOpen] = useState<boolean>(false);
  const [pendingBranchName, setPendingBranchName] = useState<string>("");
  const [pendingBranchIssue, setPendingBranchIssue] = useState<AgileIssue | null>(null);
  const [isCommentsDrawerOpen, setIsCommentsDrawerOpen] = useState<boolean>(false);
  const [selectedCommentQuote, setSelectedCommentQuote] = useState<string>("");
  const [selectedCommentLine, setSelectedCommentLine] = useState<number | undefined>(undefined);
  const [isQuickCreateIssueOpen, setIsQuickCreateIssueOpen] = useState<boolean>(false);
  const [quickCreateDraft, setQuickCreateDraft] = useState<AgileIssue | null>(null);
  const [isQuickDrawerNew, setIsQuickDrawerNew] = useState<boolean>(true);

  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>("");
  const [newFileCategory, setNewFileCategory] = useState<string>("arc42");
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [newFolderParent, setNewFolderParent] = useState<string>("none");

  const [startCommit, setStartCommit] = useState<string>("a4f89d2");
  const [endCommit, setEndCommit] = useState<string>("current");
  const [generatedMeetingText, setGeneratedMeetingText] = useState<string>("");

  useEffect(() => {
    if (splitActive && !activeFilePathB) {
      const secondTab = openTabs.find((tab) => tab !== activeFilePath) || activeFilePath;
      setActiveFilePathB(secondTab);
      setOpenTabsB([secondTab]);
    }
  }, [splitActive, activeFilePathB, openTabs, activeFilePath, setActiveFilePathB, setOpenTabsB]);

  const updateMarkdownFileContent = (targetPath: string, content: string) => {
    setFiles((prev) => prev.map((f) => (f.path === targetPath ? { ...f, content } : f)));
    setModifiedFiles((prev) => ({ ...prev, [targetPath]: true }));
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;
    updateMarkdownFileContent(activeFilePath, value);
  };

  const handleOpenFile = (path: string) => {
    setActiveFilePath(path);
    if (!openTabs.includes(path)) {
      setOpenTabs((prev) => [...prev, path]);
    }
  };

  const handleOpenFileWithLineJump = (filePath: string, lineRange?: string) => {
    handleOpenFile(filePath);
    if (lineRange && editorRef.current) {
      setTimeout(() => {
        if (editorRef.current) {
          const parts = lineRange.split("-");
          const startLine = parseInt(parts[0], 10);
          const endLine = parts[1] ? parseInt(parts[1], 10) : startLine;
          editorRef.current.revealLineInCenter(startLine);
          editorRef.current.setSelection({
            startLineNumber: startLine,
            startColumn: 1,
            endLineNumber: endLine,
            endColumn: 100,
          });
        }
      }, 100);
    }
  };

  const handleOpenFileB = (path: string) => {
    setActiveFilePathB(path);
    if (!openTabsB.includes(path)) {
      setOpenTabsB((prev) => [...prev, path]);
    }
  };

  const handleCloseTab = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const newTabs = openTabs.filter((tab) => tab !== path);
    setOpenTabs(newTabs);
    if (activeFilePath === path && newTabs.length > 0) {
      setActiveFilePath(newTabs[newTabs.length - 1]);
    }
  };

  const handleCloseTabB = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const newTabs = openTabsB.filter((tab) => tab !== path);
    setOpenTabsB(newTabs);
    if (activeFilePathB === path && newTabs.length > 0) {
      setActiveFilePathB(newTabs[newTabs.length - 1]);
    } else if (newTabs.length === 0) {
      setSplitActive(false);
    }
  };

  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    let name = newFileName.trim();
    if (!name.endsWith(".md")) name += ".md";
    const path = `${newFileCategory}/${name}`;
    if (files.some((f) => f.path === path)) {
      alert("Eine Datei mit diesem Namen existiert bereits!");
      return;
    }
    const newFile: WorkspaceFile = {
      path,
      name,
      category: newFileCategory,
      content: `# ${name.replace(".md", "")}\n\nInhalt hier eingeben...\n`,
    };
    setFiles((prev) => [...prev, newFile]);
    handleOpenFile(path);
    setModifiedFiles((prev) => ({ ...prev, [path]: true }));
    setNewFileName("");
    setShowNewFileModal(false);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const cleanName = newFolderName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const folderPath = newFolderParent === "none" ? cleanName : `${newFolderParent}/${cleanName}`;
    if (categories.includes(folderPath)) {
      alert("Dieser Ordner existiert bereits!");
      return;
    }
    if (tauriRootFolder) {
      import("@tauri-apps/plugin-fs").then(async ({ mkdir, exists }) => {
        try {
          const absPath = `${tauriRootFolder}/${folderPath}`;
          if (!(await exists(absPath))) await mkdir(absPath, { recursive: true });
        } catch (e) {
          console.error("Failed to create local folder:", folderPath, e);
        }
      });
    }
    setCategories((prev) => [...prev, folderPath].sort());
    setNewFolderName("");
    setNewFolderParent("none");
    setShowNewFolderModal(false);
  };

  const insertText = (text: string) => {
    const activeRef = activeEditorPane === "A" ? editorRef : editorRefB;
    if (activeRef.current) {
      const selection = activeRef.current.getSelection();
      activeRef.current.executeEdits("my-source", [
        { identifier: { major: 1, minor: 1 }, range: selection, text, forceMoveMarkers: true },
      ]);
    }
  };

  const insertTemplateBlock = (type: string) => {
    insertTemplateBlockHelper(type, insertText);
  };

  const insertMarkdownImage = (markdownImage: string) => {
    const activeRef = activeEditorPane === "A" ? editorRef : editorRefB;
    if (roleMode !== "stakeholder" && editorMode === "code" && activeRef.current) {
      insertText(`\n${markdownImage}\n`);
    } else if (activeFile) {
      const targetPath = activeEditorPane === "B" && splitActive && activeFilePathB ? activeFilePathB : activeFile.path;
      const targetObj = files.find((f) => f.path === targetPath);
      if (targetObj) {
        const nextContent = `${targetObj.content.replace(/\s*$/, "")}\n\n${markdownImage}\n`;
        handleUpsertWorkspaceFile({ ...targetObj, content: nextContent });
      }
    }
  };

  const captureSelectionForComment = () => {
    let quote = "";
    let lineNum: number | undefined = undefined;
    if (editorRef.current && roleMode !== "stakeholder" && editorMode === "code") {
      try {
        const sel = editorRef.current.getSelection();
        const model = editorRef.current.getModel();
        if (sel && model) {
          const selectedText = model.getValueInRange(sel).trim();
          if (selectedText) {
            quote = selectedText.slice(0, 280);
            lineNum = sel.startLineNumber;
          } else if (sel.startLineNumber) {
            lineNum = sel.startLineNumber;
          }
        }
      } catch {
        // ignore
      }
    }
    if (!quote && typeof window !== "undefined") {
      const winSel = window.getSelection()?.toString().trim() || "";
      if (winSel) quote = winSel.slice(0, 280);
    }
    setSelectedCommentQuote(quote);
    setSelectedCommentLine(lineNum);
  };

  const handleCreateBranchFromIssue = (issue: AgileIssue, suggestedBranchName: string) => {
    const updatedIssue: AgileIssue = {
      ...issue,
      branch: suggestedBranchName,
      updatedAt: new Date().toISOString(),
    };
    handleUpsertWorkspaceFile(serializeIssueToMarkdown(updatedIssue));
    setPendingBranchIssue(updatedIssue);
    setPendingBranchName(suggestedBranchName);
    setIsGitBranchModalOpen(true);
  };

  // CRITICAL INVARIANT: instantiate draft ONCE here, never inline in JSX!
  const openQuickCreateIssue = () => {
    const sprintsNow = parseSprints(filesRef.current);
    const activeSprintNow = sprintsNow.find((s) => s.state === "active");
    const draft = createBlankIssue(filesRef.current, currentUser, {
      sprint: activeSprintNow?.id || "",
    });
    setIsQuickDrawerNew(true);
    setQuickCreateDraft(draft);
    setIsQuickCreateIssueOpen(true);
  };

  const openExistingIssueInDrawer = (issue: AgileIssue) => {
    setIsQuickDrawerNew(false);
    setQuickCreateDraft(issue);
    setIsQuickCreateIssueOpen(true);
  };

  const saveGeneratedMeeting = () => {
    if (!generatedMeetingText) return;
    const fileName = `meeting_${new Date().toISOString().split("T")[0]}.md`;
    const filePath = `meetings/${fileName}`;
    setFiles((prev) => [
      ...prev,
      { path: filePath, name: fileName, category: "meetings", content: generatedMeetingText },
    ]);
    handleOpenFile(filePath);
    setActivePanel("explorer");
    setGeneratedMeetingText("");
  };

  return {
    isGitBranchModalOpen,
    setIsGitBranchModalOpen,
    pendingBranchName,
    setPendingBranchName,
    pendingBranchIssue,
    setPendingBranchIssue,
    isCommentsDrawerOpen,
    setIsCommentsDrawerOpen,
    selectedCommentQuote,
    selectedCommentLine,
    captureSelectionForComment,
    isQuickCreateIssueOpen,
    setIsQuickCreateIssueOpen,
    quickCreateDraft,
    setQuickCreateDraft,
    isQuickDrawerNew,
    openQuickCreateIssue,
    openExistingIssueInDrawer,
    handleCreateBranchFromIssue,
    showNewFileModal,
    setShowNewFileModal,
    newFileName,
    setNewFileName,
    newFileCategory,
    setNewFileCategory,
    handleCreateFile,
    showNewFolderModal,
    setShowNewFolderModal,
    newFolderName,
    setNewFolderName,
    newFolderParent,
    setNewFolderParent,
    handleCreateFolder,
    startCommit,
    setStartCommit,
    endCommit,
    setEndCommit,
    generatedMeetingText,
    setGeneratedMeetingText,
    saveGeneratedMeeting,
    updateMarkdownFileContent,
    handleEditorChange,
    handleOpenFile,
    handleOpenFileWithLineJump,
    handleOpenFileB,
    handleCloseTab,
    handleCloseTabB,
    insertText,
    insertTemplateBlock,
    insertMarkdownImage,
  };
}
