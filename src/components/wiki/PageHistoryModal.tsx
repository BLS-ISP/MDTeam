"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { History, RotateCcw, X } from "lucide-react";
import type { PageHistoryModalProps, PageVersionEntry } from "./wikiTypes";
import { recordPageSessionSnapshot } from "./wikiStorageUtils";
import {
  fetchGitFileAtCommit,
  loadCombinedPageVersions,
} from "./gitHistoryHelpers";
import { PageHistoryTimeline } from "./PageHistoryTimeline";

/**
 * 4. <PageHistoryModal />
 * Confluence-style Page Version History & Time Machine with Monaco Side-by-Side DiffEditor
 * and 1-click "Restore this version" button.
 */
export function PageHistoryModal({
  isOpen,
  activeFile,
  isTauri,
  tauriRootFolder,
  serverGitEnabled = false,
  onFetchServerHistory,
  onFetchServerFileAtCommit,
  currentUser = "@developer-a",
  language = "de",
  onClose,
  onRestoreVersion,
}: PageHistoryModalProps) {
  const isEn = language === "en";
  const [versions, setVersions] = useState<PageVersionEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [historicalContent, setHistoricalContent] = useState<string>("");
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [loadingDiff, setLoadingDiff] = useState<boolean>(false);
  const [sideBySide, setSideBySide] = useState<boolean>(true);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);

  // Load version history when opened
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    setLoadingList(true);
    loadCombinedPageVersions(
      activeFile,
      isTauri,
      tauriRootFolder,
      currentUser,
      serverGitEnabled ? onFetchServerHistory : undefined
    ).then((combined) => {
      if (!cancelled) {
        setVersions(combined);
        setSelectedId(combined[0]?.id || "");
        setLoadingList(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    activeFile.path,
    isTauri,
    tauriRootFolder,
    currentUser,
    refreshCounter,
  ]);

  const selectedEntry = useMemo(
    () => versions.find((v) => v.id === selectedId) || null,
    [versions, selectedId]
  );

  // Fetch file content for the selected historical commit / snapshot
  useEffect(() => {
    if (!isOpen || !selectedEntry) {
      setHistoricalContent("");
      return;
    }

    if (selectedEntry.source === "session") {
      setHistoricalContent(selectedEntry.snapshotContent ?? "");
      return;
    }

    if (serverGitEnabled && onFetchServerFileAtCommit) {
      let cancelled = false;
      setLoadingDiff(true);
      onFetchServerFileAtCommit(selectedEntry.commitHash, activeFile.path)
        .then((content) => {
          if (!cancelled) {
            setHistoricalContent(content);
            setLoadingDiff(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setHistoricalContent(activeFile.content);
            setLoadingDiff(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }

    if (isTauri && tauriRootFolder) {
      let cancelled = false;
      setLoadingDiff(true);
      fetchGitFileAtCommit(
        tauriRootFolder,
        selectedEntry.commitHash,
        activeFile.path
      )
        .then((content) => {
          if (!cancelled) {
            setHistoricalContent(content);
            setLoadingDiff(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load commit content:", err);
          if (!cancelled) {
            setHistoricalContent(activeFile.content);
            setLoadingDiff(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }
  }, [
    isOpen,
    selectedEntry,
    isTauri,
    tauriRootFolder,
    activeFile.path,
    activeFile.content,
  ]);

  if (!isOpen) return null;

  const handleSaveManualSnapshot = () => {
    const label = isEn ? "Manual checkpoint" : "Manueller Sicherungspunkt";
    recordPageSessionSnapshot(activeFile, currentUser, label);
    setRefreshCounter((c) => c + 1);
  };

  const handleRestoreClick = () => {
    if (!selectedEntry) return;
    recordPageSessionSnapshot(
      activeFile,
      currentUser,
      isEn ? "Backup before restore" : "Backup vor Wiederherstellung"
    );
    onRestoreVersion(historicalContent, selectedEntry.commitHash);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1150,
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "94vw",
          height: "86vh",
          backgroundColor: "var(--bg-editor)",
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
            padding: "12px 20px",
            backgroundColor: "var(--bg-panel)",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <History size={18} style={{ color: "var(--accent-indigo)" }} />
            <div>
              <div
                style={{
                  fontSize: "14.5px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {isEn
                  ? `Page Version History — ${activeFile.name}`
                  : `Versionshistorie & Zeitmaschine — ${activeFile.name}`}
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                {serverGitEnabled || (isTauri && tauriRootFolder)
                  ? isEn
                    ? "Git commit history + local session checkpoints"
                    : "Git-Commit-Historie + lokale Sitzungs-Snapshots"
                  : isEn
                  ? "Browser mode: local sessionStorage Time Machine snapshots"
                  : "Browser-Modus: lokale sessionStorage Zeitmaschinen-Snapshots"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setSideBySide((s) => !s)}
              style={{
                padding: "5px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-sidebar)",
                color: "var(--text-secondary)",
                fontSize: "11.5px",
                cursor: "pointer",
              }}
            >
              {sideBySide
                ? isEn
                  ? "Side-by-Side Diff"
                  : "Nebeneinander-Diff"
                : isEn
                ? "Inline Diff"
                : "Inline-Diff"}
            </button>

            <button
              type="button"
              onClick={handleSaveManualSnapshot}
              style={{
                padding: "5px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-sidebar)",
                color: "var(--text-secondary)",
                fontSize: "11.5px",
                cursor: "pointer",
              }}
            >
              {isEn ? "+ Save Snapshot" : "+ Snapshot sichern"}
            </button>

            <button
              type="button"
              onClick={handleRestoreClick}
              disabled={!selectedEntry || loadingDiff}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: selectedEntry
                  ? "var(--accent-indigo)"
                  : "var(--bg-active)",
                color: selectedEntry ? "#ffffff" : "var(--text-muted)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: selectedEntry ? "pointer" : "not-allowed",
              }}
            >
              <RotateCcw size={13} />
              {isEn ? "Restore this version" : "Diese Version wiederherstellen"}
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body: Left Timeline + Right Monaco DiffEditor */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <PageHistoryTimeline
            versions={versions}
            selectedId={selectedId}
            loadingList={loadingList}
            isEn={isEn}
            onSelectVersion={setSelectedId}
          />

          {/* Right Diff Pane */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                padding: "6px 16px",
                backgroundColor: "var(--bg-sidebar)",
                borderBottom: "1px solid var(--border-color)",
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              <div>
                {selectedEntry
                  ? `${
                      isEn ? "Selected Version" : "Ausgewählte Version"
                    } (${selectedEntry.commitHash})`
                  : isEn
                  ? "Historical Version"
                  : "Historische Version"}
              </div>
              <div style={{ paddingLeft: "12px" }}>
                {isEn
                  ? "Current Working Document"
                  : "Aktuelle Arbeitsversion"}
              </div>
            </div>

            <div style={{ flex: 1, position: "relative" }}>
              {loadingDiff ? (
                <div
                  style={{
                    padding: "24px",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                  }}
                >
                  {isEn
                    ? "Loading commit snapshot..."
                    : "Lade Dateiinhalt aus Git-Historie..."}
                </div>
              ) : (
                <DiffEditor
                  original={historicalContent}
                  modified={activeFile.content}
                  language="markdown"
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "var(--font-mono)",
                    automaticLayout: true,
                    renderSideBySide: sideBySide,
                    originalEditable: false,
                    ignoreTrimWhitespace: false,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
