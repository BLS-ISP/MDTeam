"use client";

import React from "react";
import DiffViewer from "../DiffViewer";
import IssueDrawer from "../IssueDrawer";
import {
  AgileIssue,
  extractAllIssues,
  parseReleases,
  parseSprints,
  serializeIssueToMarkdown,
} from "../../utils/issueEngine";
import {
  InlineCommentsDrawer,
  PageHistoryModal,
  TemplateGalleryModal,
} from "../WikiEnhancements";
import {
  AtlassianImportModal,
  CommandPaletteModal,
  GitBranchModal,
} from "../CommandPaletteAndModals";
import { AuthLoginModal, TeamAndWebhookAdminModal } from "../auth";
import { GitConflictResolverModal } from "../modals/GitConflictResolverModal";
import { INITIAL_FILES } from "../../constants/seedFiles";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { CheatsheetModal } from "../editor/CheatsheetModal";
import { PrintableExportView } from "../editor/PrintableExportView";
import { WorkspaceQuickDialogs } from "../editor/WorkspaceQuickDialogs";

export function WorkspaceModalsHost() {
  const {
    files,
    activeFile,
    language,
    roleMode,
    handleRoleModeChange,
    currentUser,
    isTauri,
    tauriRootFolder,
    activeBranch,
    setActiveBranch,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    isImportModalOpen,
    setIsImportModalOpen,
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
    isPageHistoryOpen,
    setIsPageHistoryOpen,
    isTemplateGalleryOpen,
    setIsTemplateGalleryOpen,
    isQuickCreateIssueOpen,
    setIsQuickCreateIssueOpen,
    quickCreateDraft,
    setQuickCreateDraft,
    isQuickDrawerNew,
    openQuickCreateIssue,
    handleCreateBranchFromIssue,
    handleOpenFile,
    setActivePanel,
    setPmSubTab,
    setEditorMode,
    editorRef,
    handleUpsertWorkspaceFile,
    handleUpsertMultipleFiles,
    handleDeleteWorkspaceFile,
    rescanTauriFiles,
    syncGitStatus,
    triggerDownload,
    diffTargetFile,
    setDiffTargetFile,
    serverMode,
    resolvedApiBase,
    configuredServerUrl,
    authUser,
    oidcEnabled,
    oidcProvider,
    ldapEnabled,
    ldapDomain,
    activeProjectId,
    sessionToken,
    loginLocal,
    logout,
    startOidcLogin,
    setCustomServerUrl,
    refreshTeamAndProjects,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isTeamAdminModalOpen,
    setIsTeamAdminModalOpen,
    isConflictModalOpen,
    setIsConflictModalOpen,
    refreshConflicts,
    isStakeholderReadOnly,
  } = useWorkspaceContext();

  return (
    <>
      <WorkspaceQuickDialogs />

      {/* Multi-User Authentication & Enterprise OIDC SSO Modal */}
      <AuthLoginModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        language={language}
        apiBaseUrl={resolvedApiBase || configuredServerUrl}
        currentUser={authUser}
        oidcEnabled={oidcEnabled}
        oidcProvider={oidcProvider}
        ldapEnabled={ldapEnabled}
        ldapDomain={ldapDomain}
        onLoginSubmit={loginLocal}
        onLogout={logout}
        onStartOidcLogin={() => startOidcLogin("/")}
        onSaveServerUrl={setCustomServerUrl}
      />

      {/* Team RBAC Accounts, OIDC Admin & Outgoing Teams/Slack Webhooks Modal */}
      <TeamAndWebhookAdminModal
        isOpen={isTeamAdminModalOpen}
        onClose={() => setIsTeamAdminModalOpen(false)}
        language={language}
        apiBaseUrl={resolvedApiBase || configuredServerUrl}
        currentUser={authUser}
        onUsersUpdated={() => {
          void refreshTeamAndProjects();
        }}
      />

      {/* Guided Git Conflict Resolver (Tauri + Server Git-Bridge + In-Memory) */}
      <GitConflictResolverModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        language={language}
        files={files}
        onUpsertFile={handleUpsertWorkspaceFile}
        isTauri={isTauri}
        tauriRootFolder={tauriRootFolder || null}
        serverMode={serverMode}
        projectId={serverMode ? activeProjectId : null}
        apiBaseUrl={resolvedApiBase}
        authToken={sessionToken || null}
        onConflictResolved={() => {
          void refreshConflicts();
          if (isTauri && tauriRootFolder) {
            void rescanTauriFiles(tauriRootFolder);
            void syncGitStatus(tauriRootFolder);
          }
        }}
        onAllResolved={() => {
          void refreshConflicts();
        }}
      />

      {/* Global Ctrl+K Command Palette / Omnibox */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onOpen={() => setIsCommandPaletteOpen(true)}
        onClose={() => setIsCommandPaletteOpen(false)}
        files={files}
        onSelectFile={(filePath) => {
          handleOpenFile(filePath);
          setActivePanel("explorer");
        }}
        language={language}
        roleMode={roleMode}
        enableGlobalShortcut={true}
        onCreateIssue={isStakeholderReadOnly ? undefined : openQuickCreateIssue}
        onOpenScrumBoard={() => {
          setActivePanel("pm");
          setPmSubTab("scrum");
        }}
        onOpenImportModal={isStakeholderReadOnly ? undefined : () => setIsImportModalOpen(true)}
        onOpenGitBranchModal={
          isStakeholderReadOnly
            ? undefined
            : () => {
                setPendingBranchName("");
                setPendingBranchIssue(null);
                setIsGitBranchModalOpen(true);
              }
        }
        onOpenTemplateGallery={isStakeholderReadOnly ? undefined : () => setIsTemplateGalleryOpen(true)}
        onExportDocx={() => triggerDownload("docx", "single")}
        onToggleStakeholderMode={() =>
          handleRoleModeChange(roleMode === "stakeholder" ? "developer" : "stakeholder")
        }
      />

      {/* Atlassian Jira (CSV/JSON/ADF) & Confluence (HTML) Importer */}
      <AtlassianImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingFiles={files}
        language={language}
        onImportFiles={(importedFiles) => {
          handleUpsertMultipleFiles(importedFiles);
          const firstImported = importedFiles[0];
          if (firstImported) {
            if (firstImported.path.startsWith("issues/")) {
              setActivePanel("pm");
              setPmSubTab("scrum");
            } else {
              handleOpenFile(firstImported.path);
              setActivePanel("explorer");
            }
          }
        }}
      />

      {/* GitOps Branch Manager Modal (wired to Issue-to-Branch creation) */}
      <GitBranchModal
        isOpen={isGitBranchModalOpen}
        onClose={() => {
          setIsGitBranchModalOpen(false);
          setPendingBranchName("");
          setPendingBranchIssue(null);
        }}
        isTauri={isTauri}
        tauriRootFolder={tauriRootFolder || null}
        initialNewBranchName={pendingBranchName}
        currentBranch={activeBranch}
        activeBranch={activeBranch}
        language={language}
        onBranchChanged={async (nextBranch) => {
          setActiveBranch(nextBranch);
          if (pendingBranchIssue) {
            const linkedIssue: AgileIssue = {
              ...pendingBranchIssue,
              branch: nextBranch,
              updatedAt: new Date().toISOString(),
            };
            await handleUpsertWorkspaceFile(serializeIssueToMarkdown(linkedIssue));
            setPendingBranchIssue(linkedIssue);
          } else if (isTauri && tauriRootFolder) {
            await rescanTauriFiles(tauriRootFolder);
            await syncGitStatus(tauriRootFolder);
          }
        }}
      />

      {/* Confluence Inline Review Comments Drawer */}
      {activeFile && (
        <InlineCommentsDrawer
          isOpen={isCommentsDrawerOpen}
          activeFile={activeFile}
          files={files}
          currentUser={currentUser}
          selectedQuote={selectedCommentQuote}
          selectedLineNumber={selectedCommentLine}
          language={language}
          onClose={() => setIsCommentsDrawerOpen(false)}
          onUpsertFile={handleUpsertWorkspaceFile}
          onJumpToLine={(lineNumber) => {
            if (editorRef.current && roleMode !== "stakeholder") {
              setEditorMode("code");
              setTimeout(() => {
                if (editorRef.current) {
                  editorRef.current.revealLineInCenter(lineNumber);
                  editorRef.current.setPosition({ lineNumber, column: 1 });
                  editorRef.current.focus();
                }
              }, 80);
            }
          }}
        />
      )}

      {/* Confluence Git Page History & Time Machine Modal */}
      {activeFile && (
        <PageHistoryModal
          isOpen={isPageHistoryOpen}
          activeFile={activeFile}
          isTauri={isTauri}
          tauriRootFolder={tauriRootFolder}
          currentUser={currentUser}
          language={language}
          onClose={() => setIsPageHistoryOpen(false)}
          onRestoreVersion={(restoredContent) => {
            if (isStakeholderReadOnly) return;
            handleUpsertWorkspaceFile({ ...activeFile, content: restoredContent });
            setIsPageHistoryOpen(false);
          }}
        />
      )}

      {/* Confluence Template Gallery Modal */}
      <TemplateGalleryModal
        isOpen={isTemplateGalleryOpen}
        currentUser={currentUser}
        existingFiles={files}
        language={language}
        onClose={() => setIsTemplateGalleryOpen(false)}
        onCreateFile={(newDoc) => {
          handleUpsertWorkspaceFile(newDoc);
          handleOpenFile(newDoc.path);
          setActivePanel("explorer");
          setIsTemplateGalleryOpen(false);
        }}
      />

      {/* Global Jira Issue Drawer (stable quickCreateDraft + isQuickDrawerNew invariant preserved) */}
      {isQuickCreateIssueOpen &&
        quickCreateDraft &&
        (() => {
          const allIssuesNow = extractAllIssues(files);
          const epicsNow = allIssuesNow.filter((i) => i.type === "epic");
          const sprintsNow = parseSprints(files);
          const releasesNow = parseReleases(files, allIssuesNow);
          return (
            <IssueDrawer
              issue={quickCreateDraft}
              isOpen={isQuickCreateIssueOpen}
              isNew={isQuickDrawerNew}
              epics={epicsNow}
              sprints={sprintsNow}
              releases={releasesNow}
              allIssues={allIssuesNow}
              currentUser={currentUser}
              language={language}
              onClose={() => {
                setIsQuickCreateIssueOpen(false);
                setQuickCreateDraft(null);
              }}
              onSave={(savedIssue) => {
                handleUpsertWorkspaceFile(serializeIssueToMarkdown(savedIssue));
                if (isQuickDrawerNew) {
                  setIsQuickCreateIssueOpen(false);
                  setQuickCreateDraft(null);
                } else {
                  setQuickCreateDraft(savedIssue);
                }
              }}
              onDelete={
                !isQuickDrawerNew && !isStakeholderReadOnly
                  ? (deletedIssue) => {
                      handleDeleteWorkspaceFile(deletedIssue.filePath || `issues/${deletedIssue.id}.md`);
                      setIsQuickCreateIssueOpen(false);
                      setQuickCreateDraft(null);
                    }
                  : undefined
              }
              onOpenMarkdownFile={(filePath) => {
                handleOpenFile(filePath);
                setActivePanel("explorer");
                setIsQuickCreateIssueOpen(false);
                setQuickCreateDraft(null);
              }}
              onCreateBranch={(iss, branchName) => {
                setIsQuickCreateIssueOpen(false);
                setQuickCreateDraft(null);
                handleCreateBranchFromIssue(iss, branchName);
              }}
            />
          );
        })()}

      {/* Visual DiffViewer overlay dialog */}
      {diffTargetFile && (
        <DiffViewer
          originalContent={INITIAL_FILES.find((f) => f.path === diffTargetFile)?.content || ""}
          modifiedContent={files.find((f) => f.path === diffTargetFile)?.content || ""}
          fileName={diffTargetFile.split("/").pop() || diffTargetFile}
          onClose={() => setDiffTargetFile(null)}
        />
      )}

      <CheatsheetModal />
      <PrintableExportView />
    </>
  );
}
