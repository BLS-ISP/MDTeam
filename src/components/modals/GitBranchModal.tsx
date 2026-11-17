"use client";

import React from "react";
import { Plus, GitBranch, X, RefreshCw } from "lucide-react";
import { useGitBranchManager } from "./useGitBranchManager";

export interface GitBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTauri?: boolean;
  tauriRootFolder?: string | null;
  initialNewBranchName?: string;
  currentBranch?: string;
  activeBranch?: string;
  onBranchChange?: (branchName: string) => void;
  onBranchChanged?: (branchName: string) => void;
  language?: "de" | "en";
}

export function GitBranchModal({
  isOpen,
  onClose,
  isTauri = false,
  tauriRootFolder = null,
  initialNewBranchName = "",
  currentBranch: externalBranch,
  activeBranch: externalActiveBranch,
  onBranchChange,
  onBranchChanged,
  language = "de",
}: GitBranchModalProps) {
  const isEn = language === "en";
  const useNativeGit = Boolean(isTauri && tauriRootFolder);
  const resolvedExternalBranch = externalBranch || externalActiveBranch;

  const {
    branches,
    activeBranch,
    newBranchName,
    setNewBranchName,
    isLoading,
    errorMsg,
    statusMsg,
    loadBranches,
    handleCheckout,
    applyBranchPrefix,
  } = useGitBranchManager({
    isOpen,
    isEn,
    useNativeGit,
    tauriRootFolder,
    initialNewBranchName,
    resolvedExternalBranch,
    onBranchChange,
    onBranchChanged,
  });

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(540px, 92vw)",
          maxHeight: "82vh",
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "15px 18px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <GitBranch size={18} style={{ color: "var(--accent-indigo)" }} />
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                {isEn ? "GitOps Branch Manager" : "GitOps Branch-Verwaltung"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {useNativeGit
                  ? isEn
                    ? "Connected to local Git repository via Tauri"
                    : "Verbunden mit lokalem Git-Repository (Tauri)"
                  : isEn
                    ? "Browser Sandbox Mode (open folder in Tauri for native Git CLI)"
                    : "Browser-Sandbox-Modus (in Tauri Ordner öffnen für natives Git)"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {useNativeGit && (
              <button
                type="button"
                onClick={loadBranches}
                title={isEn ? "Refresh branches" : "Branches aktualisieren"}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <RefreshCw size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Create Branch Box */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "8px",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                }}
              >
                {initialNewBranchName
                  ? isEn
                    ? "Create Branch from Issue"
                    : "Branch aus Issue erstellen"
                  : isEn
                    ? "Create & Checkout New Branch"
                    : "Neuen Branch erstellen & auschecken"}
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                {["feat/", "fix/", "docs/", "chore/"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyBranchPrefix(p)}
                    style={{
                      fontSize: "10px",
                      fontFamily: "var(--font-mono)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--bg-sidebar)",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newBranchName.trim()) {
                    handleCheckout(newBranchName, true);
                  }
                }}
                placeholder="feat/MDT-102-keycloak-sso"
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-sidebar)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
              />
              <button
                type="button"
                disabled={!newBranchName.trim() || isLoading}
                onClick={() => handleCheckout(newBranchName, true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: newBranchName.trim()
                    ? "var(--accent-indigo)"
                    : "var(--bg-active)",
                  color: newBranchName.trim() ? "#ffffff" : "var(--text-muted)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: newBranchName.trim() ? "pointer" : "not-allowed",
                  whiteSpace: "nowrap",
                }}
              >
                <Plus size={14} />
                {isEn ? "Create Branch" : "Branch anlegen"}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--accent-red)",
                backgroundColor: "rgba(239, 68, 68, 0.08)",
                color: "var(--accent-red)",
                fontSize: "12px",
              }}
            >
              {errorMsg}
            </div>
          )}

          {statusMsg && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--accent-green)",
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                color: "var(--accent-green)",
                fontSize: "12px",
              }}
            >
              {statusMsg}
            </div>
          )}

          {/* Existing Branches List */}
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: "8px",
              }}
            >
              {isEn
                ? `Local Branches (${branches.length}) — Active: ${activeBranch}`
                : `Lokale Branches (${branches.length}) — Aktiv: ${activeBranch}`}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                maxHeight: "260px",
                overflowY: "auto",
              }}
            >
              {branches.map((b) => (
                <div
                  key={b.name}
                  onClick={() => {
                    if (!b.isCurrent && !isLoading) {
                      handleCheckout(b.name, false);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${
                      b.isCurrent ? "var(--accent-indigo)" : "var(--border-color)"
                    }`,
                    backgroundColor: b.isCurrent
                      ? "rgba(99, 102, 241, 0.1)"
                      : "var(--bg-panel)",
                    cursor: b.isCurrent ? "default" : "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <GitBranch
                      size={14}
                      style={{
                        color: b.isCurrent ? "var(--accent-green)" : "var(--text-muted)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "12px",
                        fontWeight: b.isCurrent ? 600 : 400,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b.name}
                    </span>
                  </div>

                  {b.isCurrent ? (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "999px",
                        backgroundColor: "rgba(16, 185, 129, 0.16)",
                        color: "var(--accent-green)",
                      }}
                    >
                      {isEn ? "ACTIVE" : "AKTIV"}
                    </span>
                  ) : (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {isEn ? "Switch" : "Wechseln"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
