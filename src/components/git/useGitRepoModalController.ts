"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import type { GitAuthType, ProjectVisibility } from "../../types/auth";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

export function deriveSlugFromGitUrl(rawUrl: string): string {
  const cleaned = rawUrl.trim().replace(/\/+$/, "").replace(/\.git$/i, "");
  const lastPart = cleaned.split(/[/:]/).pop() || "";
  return lastPart.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 48);
}

export function useGitRepoModalController() {
  const {
    language, isGitRepoModalOpen, setIsGitRepoModalOpen, gitRepoModalInitialTab,
    activeProjectId, projectDetails, authUser, testServerGitRemote, cloneServerGitRepo,
    createBlankServerProject, updateServerGitRemote, previewPreCloneSshKey,
    generateServerSshKey, deleteServerProject,
  } = useWorkspaceContext();

  const isEn = language === "en";
  const [tab, setTab] = useState<"clone" | "remote" | "blank">(gitRepoModalInitialTab);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [projectIdInput, setProjectIdInput] = useState("");
  const [projectSlugTouched, setProjectSlugTouched] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [branch, setBranch] = useState("");
  const [discoveredBranches, setDiscoveredBranches] = useState<string[]>([]);
  const [authType, setAuthType] = useState<GitAuthType>("https");
  const [httpsUsername, setHttpsUsername] = useState("x-access-token");
  const [httpsToken, setHttpsToken] = useState("");
  const [sshPrivateKeyInput, setSshPrivateKeyInput] = useState("");
  const [cloneSshPublicKey, setCloneSshPublicKey] = useState("");
  const [scaffoldMdTeam, setScaffoldMdTeam] = useState(false);
  const [visibility, setVisibility] = useState<ProjectVisibility>("team");

  const [busy, setBusy] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const currentProjectMeta = useMemo(
    () => projectDetails.find((p) => p.projectId === activeProjectId) || null,
    [activeProjectId, projectDetails]
  );

  useEffect(() => {
    if (!isGitRepoModalOpen) return;
    setTab(gitRepoModalInitialTab);
    setErrorMsg("");
    setStatusMsg("");
    setDiscoveredBranches([]);
    setHttpsToken("");
    setSshPrivateKeyInput("");
    setCloneSshPublicKey("");

    if (gitRepoModalInitialTab === "remote" && currentProjectMeta) {
      setRemoteUrl(currentProjectMeta.remoteUrl || "");
      setDisplayName(currentProjectMeta.displayName || activeProjectId);
      setAuthType(currentProjectMeta.authType || "none");
      setHttpsUsername(currentProjectMeta.httpsUsername || "x-access-token");
      setVisibility(currentProjectMeta.visibility || "team");
    } else {
      setRemoteUrl("");
      setProjectIdInput("");
      setProjectSlugTouched(false);
      setDisplayName("");
      setBranch("");
      setAuthType("https");
      setHttpsUsername("x-access-token");
      setVisibility("team");
    }
  }, [activeProjectId, currentProjectMeta, gitRepoModalInitialTab, isGitRepoModalOpen]);

  const switchTab = (next: "clone" | "remote" | "blank") => {
    setTab(next);
    setErrorMsg("");
    setStatusMsg("");
    if (next === "remote" && currentProjectMeta) {
      setRemoteUrl(currentProjectMeta.remoteUrl || "");
      setDisplayName(currentProjectMeta.displayName || activeProjectId);
      setAuthType(currentProjectMeta.authType || "none");
      setHttpsUsername(currentProjectMeta.httpsUsername || "x-access-token");
      setVisibility(currentProjectMeta.visibility || "team");
    } else if (next !== "remote") {
      setRemoteUrl("");
      setProjectIdInput("");
      setProjectSlugTouched(false);
      setDisplayName("");
    }
  };

  const handleRemoteUrlChange = (val: string) => {
    setRemoteUrl(val);
    if (/^(git@|ssh:\/\/)/i.test(val.trim())) setAuthType("ssh");
    if (tab === "clone" && !projectSlugTouched) {
      const slug = deriveSlugFromGitUrl(val);
      if (slug) setProjectIdInput(slug);
    }
  };

  const handleSshPrivateKeyInputChange = (val: string) => {
    setSshPrivateKeyInput(val);
    setCloneSshPublicKey("");
  };

  const handleTestConnection = async () => {
    setErrorMsg("");
    setStatusMsg("");
    setTestingConn(true);
    try {
      const res = await testServerGitRemote({
        remoteUrl,
        projectId: tab === "remote" ? activeProjectId : undefined,
        authType,
        httpsUsername,
        httpsToken: httpsToken || undefined,
        sshPrivateKey: sshPrivateKeyInput.trim() || undefined,
      });
      setDiscoveredBranches(res.branches);
      if (!branch && res.defaultBranch) setBranch(res.defaultBranch);
      setStatusMsg(
        isEn
          ? `Connected! Found ${res.branches.length} branch(es) (default: ${res.defaultBranch}).`
          : `Verbindung erfolgreich! ${res.branches.length} Branch(es) erkannt (Standard: ${res.defaultBranch}).`
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setTestingConn(false);
    }
  };

  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setStatusMsg("");
    setBusy(true);
    try {
      const res = await cloneServerGitRepo({
        projectId: projectIdInput.trim(),
        displayName: displayName.trim() || projectIdInput.trim(),
        remoteUrl: remoteUrl.trim(),
        branch: branch.trim() || undefined,
        authType,
        httpsUsername: httpsUsername.trim(),
        httpsToken: httpsToken.trim() || undefined,
        sshPrivateKey: sshPrivateKeyInput.trim() || undefined,
        sshPublicKey: cloneSshPublicKey.trim() || undefined,
        scaffoldMdTeam,
        visibility,
      });
      setStatusMsg(
        isEn
          ? `Cloned '${res.project.projectId}' (${res.filesCount} Markdown files on '${res.activeBranch}').`
          : `Projekt '${res.project.projectId}' geklont (${res.filesCount} Markdown-Dateien auf '${res.activeBranch}').`
      );
      setTimeout(() => setIsGitRepoModalOpen(false), 600);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRemoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setStatusMsg("");
    setBusy(true);
    try {
      await updateServerGitRemote({
        displayName: displayName.trim() || activeProjectId,
        remoteUrl: remoteUrl.trim(),
        authType,
        httpsUsername: httpsUsername.trim(),
        httpsToken: httpsToken.trim() || undefined,
        visibility,
        scaffoldMdTeam,
      });
      setHttpsToken("");
      setStatusMsg(
        isEn
          ? `Saved Git remote & authentication settings for '${activeProjectId}'.`
          : `Git-Remote & Authentifizierung für '${activeProjectId}' gespeichert.`
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleBlankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setStatusMsg("");
    setBusy(true);
    try {
      await createBlankServerProject({
        projectId: projectIdInput.trim(),
        displayName: displayName.trim() || projectIdInput.trim(),
        visibility,
      });
      setIsGitRepoModalOpen(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateSshKey = async () => {
    setBusy(true);
    setErrorMsg("");
    try {
      if (tab === "clone") {
        const preview = await previewPreCloneSshKey();
        setCloneSshPublicKey(preview.sshPublicKey);
        setSshPrivateKeyInput(preview.sshPrivateKey);
      } else {
        await generateServerSshKey(activeProjectId);
      }
      setAuthType("ssh");
      setStatusMsg(
        isEn
          ? "Generated Ed25519 SSH Deploy Key — copy and add it to your Git host."
          : "Ed25519 SSH-Deploy-Key erzeugt — bitte kopieren und im Git-Server hinterlegen."
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCurrentProject = async () => {
    const ok = window.confirm(
      isEn
        ? `Remove server workspace '${activeProjectId}' from this MDTeam server? (Upstream Git repository is untouched.)`
        : `Server-Projekt '${activeProjectId}' von diesem MDTeam-Server entfernen? (Das externe Git-Repository bleibt unberührt.)`
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteServerProject(activeProjectId);
      setIsGitRepoModalOpen(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const canDeleteCurrent =
    activeProjectId !== "default" &&
    Boolean(
      authUser &&
        (authUser.role === "admin" ||
          (currentProjectMeta?.ownerId && currentProjectMeta.ownerId === authUser.id))
    );

  const activeSshPublicKey =
    tab === "remote" ? currentProjectMeta?.sshPublicKey || "" : cloneSshPublicKey;

  return {
    isEn,
    isGitRepoModalOpen,
    setIsGitRepoModalOpen,
    activeProjectId,
    currentProjectMeta,
    tab,
    switchTab,
    remoteUrl,
    handleRemoteUrlChange,
    projectIdInput,
    setProjectIdInput,
    setProjectSlugTouched,
    displayName,
    setDisplayName,
    branch,
    setBranch,
    discoveredBranches,
    authType,
    setAuthType,
    httpsUsername,
    setHttpsUsername,
    httpsToken,
    setHttpsToken,
    sshPrivateKeyInput,
    handleSshPrivateKeyInputChange,
    activeSshPublicKey,
    scaffoldMdTeam,
    setScaffoldMdTeam,
    visibility,
    setVisibility,
    busy,
    testingConn,
    errorMsg,
    statusMsg,
    canDeleteCurrent,
    handleTestConnection,
    handleCloneSubmit,
    handleSaveRemoteSubmit,
    handleBlankSubmit,
    handleGenerateSshKey,
    handleDeleteCurrentProject,
  };
}
