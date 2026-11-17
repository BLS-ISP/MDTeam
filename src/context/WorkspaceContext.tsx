"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { Diagnostic, lintWorkspaceFiles } from "../utils/linter";
import type { WorkspaceFile } from "../utils/issueEngine";
import type { WorkspaceRoleMode } from "../components/CommandPaletteAndModals";
import { translations, type WorkspaceLanguage } from "../constants/translations";
import { DEFAULT_CATEGORIES, INITIAL_FILES } from "../constants/seedFiles";
import { useTauriWorkspace } from "../hooks/useTauriWorkspace";
import { useYjsCollaboration } from "../hooks/useYjsCollaboration";
import { useDocumentExport } from "../hooks/useDocumentExport";
import { useWorkspaceEditorActions } from "../hooks/useWorkspaceEditorActions";
import { useWorkspaceServerBridge } from "../hooks/useWorkspaceServerBridge";
import { applyMonacoDiagnosticsMarkers } from "../utils/workspace/monacoSetup";
import { isDocumentWriteProtected } from "../utils/wiki/documentProtection";

export type WorkspacePanelId =
  | "explorer"
  | "search"
  | "git"
  | "pm"
  | "meetings"
  | "settings"
  | "graph"
  | "cheatsheet";

export type PmSubTabId = "scrum" | "roadmap" | "kanban" | "velocity" | "retro" | "standup";

function useBuildWorkspaceContextValue() {
  const [language, setLanguageState] = useState<WorkspaceLanguage>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("language");
      if (stored === "de" || stored === "en") return stored;
    }
    return "de";
  });
  const setLanguage = (nextLang: WorkspaceLanguage) => {
    setLanguageState(nextLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("language", nextLang);
    }
  };
  const t = translations[language];

  const [files, setFiles] = useState<WorkspaceFile[]>(INITIAL_FILES);
  const [activeFilePath, setActiveFilePath] = useState<string>("arc42/01_introduction_goals.md");
  const [openTabs, setOpenTabs] = useState<string[]>(["arc42/01_introduction_goals.md"]);
  const [activePanel, setActivePanel] = useState<WorkspacePanelId>("explorer");
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [pmSubTab, setPmSubTab] = useState<PmSubTabId>("scrum");
  const [editorMode, setEditorMode] = useState<"code" | "visual">("code");
  const [showCheatsheetModal, setShowCheatsheetModal] = useState<boolean>(false);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  // Role mode, identity & global modal states
  const [roleMode, setRoleMode] = useState<WorkspaceRoleMode>("developer");
  const [currentUser, setCurrentUser] = useState<string>("@developer-a");
  const [stakeholderEditVisual, setStakeholderEditVisual] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isPageHistoryOpen, setIsPageHistoryOpen] = useState<boolean>(false);
  const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState<boolean>(false);

  // Linter, Split Editor & Diff states
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [showProblemsPanel, setShowProblemsPanel] = useState<boolean>(false);
  const [splitActive, setSplitActive] = useState<boolean>(false);
  const [activeFilePathB, setActiveFilePathB] = useState<string>("");
  const [openTabsB, setOpenTabsB] = useState<string[]>([]);
  const [activeEditorPane, setActiveEditorPane] = useState<"A" | "B">("A");
  const [diffTargetFile, setDiffTargetFile] = useState<string | null>(null);

  // Auth & Git settings states
  const [authStrategy, setAuthStrategy] = useState<string>("keycloak");
  const [ldapUrl, setLdapUrl] = useState<string>("ldap://company-directory.local:389");
  const [keycloakUrl, setKeycloakUrl] = useState<string>("https://keycloak.company-internal.de/auth");
  const [gitProvider, setGitProvider] = useState<string>("gitlab-selfhosted");
  const [gitUrl, setGitUrl] = useState<string>("https://gitlab.company-internal.de/mdteam/arc42-docs.git");

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const editorRefB = useRef<any>(null);
  const monacoRefB = useRef<any>(null);

  const filesRef = useRef<WorkspaceFile[]>(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const activeFile = files.find((f) => f.path === activeFilePath) || files[0];

  const tauriWorkspace = useTauriWorkspace({
    language,
    files,
    setFiles,
    setCategories,
    activeFilePath,
    setActiveFilePath,
    activeFilePathB,
    setActiveFilePathB,
    setOpenTabs,
    setOpenTabsB,
  });

  const docExport = useDocumentExport({
    files,
    activeFile,
    isTauri: tauriWorkspace.isTauri,
    tauriRootFolder: tauriWorkspace.tauriRootFolder,
    language,
  });

  const applyRoleMode = (nextMode: WorkspaceRoleMode) => {
    setRoleMode(nextMode);
    if (nextMode === "scrum") {
      setActivePanel("pm");
      setPmSubTab("scrum");
    } else if (nextMode === "stakeholder") {
      setSplitActive(false);
      setShowProblemsPanel(false);
      setStakeholderEditVisual(false);
      if (activePanel === "git" || activePanel === "cheatsheet" || activePanel === "settings") {
        setActivePanel("explorer");
      }
    }
  };

  const rawUpdateMarkdownContent = (targetPath: string, content: string) => {
    const targetObj = filesRef.current.find((f) => f.path === targetPath);
    if (targetObj && isDocumentWriteProtected(targetObj).locked) return;
    setFiles((prev) => prev.map((f) => (f.path === targetPath ? { ...f, content } : f)));
    tauriWorkspace.setModifiedFiles((prev) => ({ ...prev, [targetPath]: true }));
  };

  const serverBridge = useWorkspaceServerBridge({
    isTauri: tauriWorkspace.isTauri,
    tauriRootFolder: tauriWorkspace.tauriRootFolder,
    files,
    filesRef,
    setFiles,
    setCategories,
    roleMode,
    onApplyRoleMode: applyRoleMode,
    currentUser,
    setCurrentUser,
    rawUpsertFile: tauriWorkspace.handleUpsertWorkspaceFile,
    rawUpsertMultipleFiles: tauriWorkspace.handleUpsertMultipleFiles,
    rawDeleteFile: tauriWorkspace.handleDeleteWorkspaceFile,
    rawUpdateMarkdownContent,
  });

  const yjsCollab = useYjsCollaboration({
    activeFilePath,
    activeFilePathB,
    splitActive,
    filesRef,
    editorRef,
    editorRefB,
    projectId: serverBridge.serverMode
      ? serverBridge.activeProjectId
      : tauriWorkspace.tauriRootFolder || "local",
    activeBranch: tauriWorkspace.activeBranch,
    readOnly: serverBridge.isStakeholderReadOnly,
    canConnectWs: !serverBridge.serverMode || Boolean(serverBridge.authUser),
  });

  const editorActions = useWorkspaceEditorActions({
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
    tauriRootFolder: tauriWorkspace.tauriRootFolder,
    setModifiedFiles: tauriWorkspace.setModifiedFiles,
    handleUpsertWorkspaceFile: serverBridge.handleUpsertWorkspaceFile,
    setActivePanel,
    editorRef,
    editorRefB,
  });

  const handleRoleModeChange = (nextMode: WorkspaceRoleMode) => {
    if (serverBridge.serverMode && serverBridge.authUser?.role === "stakeholder" && nextMode !== "stakeholder") {
      applyRoleMode("stakeholder");
      return;
    }
    applyRoleMode(nextMode);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    serverBridge.updateMarkdownFileContent(activeFilePath, value);
  };

  useEffect(() => {
    if (serverBridge.serverMode && serverBridge.authUser && serverBridge.gitStatus?.branch) {
      tauriWorkspace.setActiveBranch(serverBridge.gitStatus.branch);
    }
  }, [serverBridge.authUser, serverBridge.gitStatus?.branch, serverBridge.serverMode]);

  useEffect(() => {
    if (files.length > 0 && !files.some((f) => f.path === activeFilePath)) {
      const preferred =
        files.find((f) => /^readme\.md$/i.test(f.path)) ||
        files.find((f) => f.path === "wiki/welcome.md") ||
        files[0];
      if (preferred) {
        setActiveFilePath(preferred.path);
        setOpenTabs((prev) => {
          const valid = prev.filter((p) => files.some((f) => f.path === p));
          return valid.length > 0 ? valid : [preferred.path];
        });
      }
    }
  }, [activeFilePath, files]);

  useEffect(() => {
    if (!activeFilePath.endsWith(".md")) {
      setEditorMode("code");
    }
  }, [activeFilePath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setShowCheatsheetModal((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setDiagnostics(lintWorkspaceFiles(files, language));
  }, [files, language]);

  useEffect(() => {
    applyMonacoDiagnosticsMarkers(editorRef.current, monacoRef.current, activeFilePath, diagnostics);
  }, [diagnostics, activeFilePath, activeEditorPane]);

  useEffect(() => {
    if (splitActive && activeFilePathB) {
      applyMonacoDiagnosticsMarkers(editorRefB.current, monacoRefB.current, activeFilePathB, diagnostics);
    }
  }, [diagnostics, activeFilePathB, splitActive, activeEditorPane]);

  return {
    language,
    setLanguage,
    t,
    files,
    setFiles,
    filesRef,
    activeFile,
    activeFilePath,
    setActiveFilePath,
    openTabs,
    setOpenTabs,
    activePanel,
    setActivePanel,
    showPreview,
    setShowPreview,
    pmSubTab,
    setPmSubTab,
    editorMode,
    setEditorMode,
    showCheatsheetModal,
    setShowCheatsheetModal,
    categories,
    setCategories,
    roleMode,
    handleRoleModeChange,
    currentUser,
    setCurrentUser,
    stakeholderEditVisual,
    setStakeholderEditVisual,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    isImportModalOpen,
    setIsImportModalOpen,
    isPageHistoryOpen,
    setIsPageHistoryOpen,
    isTemplateGalleryOpen,
    setIsTemplateGalleryOpen,
    diagnostics,
    showProblemsPanel,
    setShowProblemsPanel,
    splitActive,
    setSplitActive,
    activeFilePathB,
    setActiveFilePathB,
    openTabsB,
    setOpenTabsB,
    activeEditorPane,
    setActiveEditorPane,
    diffTargetFile,
    setDiffTargetFile,
    authStrategy,
    setAuthStrategy,
    ldapUrl,
    setLdapUrl,
    keycloakUrl,
    setKeycloakUrl,
    gitProvider,
    setGitProvider,
    gitUrl,
    setGitUrl,
    editorRef,
    monacoRef,
    editorRefB,
    monacoRefB,
    ...tauriWorkspace,
    ...yjsCollab,
    ...docExport,
    ...editorActions,
    ...serverBridge,
    handleEditorChange,
  };
}

export type WorkspaceContextValue = ReturnType<typeof useBuildWorkspaceContextValue>;

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const value = useBuildWorkspaceContextValue();
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspaceContext must be used inside WorkspaceProvider");
  }
  return ctx;
}
