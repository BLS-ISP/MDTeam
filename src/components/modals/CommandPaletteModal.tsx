"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Search } from "lucide-react";
import type { WorkspaceFile, WorkspaceRoleMode } from "./modalTypesAndBadges";
import {
  type PaletteFilterScope,
  buildCommandPaletteEntries,
  filterCommandPaletteEntries,
} from "./paletteEntries";
import { PaletteResultsList } from "./PaletteResultsList";

export interface CommandPaletteModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onOpen?: () => void;
  files: WorkspaceFile[];
  onSelectFile: (filePath: string) => void;
  language?: "de" | "en";
  roleMode?: WorkspaceRoleMode;
  enableGlobalShortcut?: boolean;
  onCreateIssue?: () => void;
  onOpenScrumBoard?: () => void;
  onOpenImportModal?: () => void;
  onOpenGitBranchModal?: () => void;
  onOpenTemplateGallery?: () => void;
  onExportDocx?: () => void;
  onToggleStakeholderMode?: () => void;
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  onOpen,
  files,
  onSelectFile,
  language = "de",
  roleMode = "developer",
  enableGlobalShortcut = true,
  onCreateIssue,
  onOpenScrumBoard,
  onOpenImportModal,
  onOpenGitBranchModal,
  onOpenTemplateGallery,
  onExportDocx,
  onToggleStakeholderMode,
}: CommandPaletteModalProps) {
  const isEn = language === "en";
  const isControlled = typeof isOpen === "boolean";
  const [internalOpen, setInternalOpen] = useState(false);
  const effectiveOpen = isControlled ? Boolean(isOpen) : internalOpen;

  const [query, setQuery] = useState("");
  const [filterScope, setFilterScope] = useState<PaletteFilterScope>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const closePalette = useCallback(() => {
    if (!isControlled) setInternalOpen(false);
    onClose();
  }, [isControlled, onClose]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    if (!enableGlobalShortcut) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (effectiveOpen) {
          closePalette();
        } else if (isControlled) {
          onOpen?.();
        } else {
          setInternalOpen(true);
        }
      } else if (e.key === "Escape" && effectiveOpen) {
        e.preventDefault();
        closePalette();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableGlobalShortcut, effectiveOpen, isControlled, onOpen, closePalette]);

  // Reset & focus when opened
  useEffect(() => {
    if (effectiveOpen) {
      setQuery("");
      setFilterScope("all");
      setActiveIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(timer);
    }
  }, [effectiveOpen]);

  const allEntries = useMemo(
    () =>
      buildCommandPaletteEntries({
        files,
        isEn,
        roleMode,
        closePalette,
        onSelectFile,
        onCreateIssue,
        onOpenScrumBoard,
        onOpenImportModal,
        onOpenGitBranchModal,
        onOpenTemplateGallery,
        onExportDocx,
        onToggleStakeholderMode,
      }),
    [
      files,
      isEn,
      roleMode,
      closePalette,
      onSelectFile,
      onCreateIssue,
      onOpenScrumBoard,
      onOpenImportModal,
      onOpenGitBranchModal,
      onOpenTemplateGallery,
      onExportDocx,
      onToggleStakeholderMode,
    ]
  );

  const filteredEntries = useMemo(
    () => filterCommandPaletteEntries(allEntries, query, filterScope),
    [allEntries, query, filterScope]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filterScope]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filteredEntries.length === 0 ? 0 : (prev + 1) % filteredEntries.length
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filteredEntries.length === 0
          ? 0
          : (prev - 1 + filteredEntries.length) % filteredEntries.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = filteredEntries[activeIndex];
      if (chosen) {
        chosen.onTrigger();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
    }
  };

  if (!effectiveOpen) return null;

  return (
    <div
      onClick={closePalette}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
        zIndex: 1000,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(660px, 92vw)",
          maxHeight: "76vh",
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Omnibox Search Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <Search size={17} style={{ color: "var(--accent-indigo)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={
              isEn
                ? "Search issues (MDT-...), Wiki/arc42/ADR docs, or run a command..."
                : "Issues (MDT-...), Wiki/arc42/ADR-Dokumente suchen oder Befehl ausführen..."
            }
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "14px",
              fontFamily: "var(--font-sans)",
            }}
          />
          <kbd
            style={{
              fontSize: "10px",
              fontFamily: "var(--font-mono)",
              padding: "2px 6px",
              borderRadius: "4px",
              backgroundColor: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Scope Filter Pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-sidebar)",
            fontSize: "11px",
          }}
        >
          {(
            [
              { id: "all", label: isEn ? "All" : "Alle" },
              { id: "actions", label: isEn ? "Quick Actions" : "Schnellaktionen" },
              { id: "issues", label: isEn ? "Issues (MDT-*)" : "Issues (MDT-*)" },
              { id: "docs", label: isEn ? "Wiki / arc42 / ADR" : "Wiki / arc42 / ADR" },
            ] as const
          ).map((tab) => {
            const active = filterScope === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterScope(tab.id)}
                style={{
                  border: `1px solid ${active ? "var(--accent-indigo)" : "var(--border-color)"}`,
                  backgroundColor: active ? "rgba(99, 102, 241, 0.16)" : "var(--bg-panel)",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  borderRadius: "6px",
                  padding: "3px 9px",
                  fontSize: "11px",
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            );
          })}
          <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "11px" }}>
            {filteredEntries.length} {isEn ? "items" : "Einträge"}
          </span>
        </div>

        <PaletteResultsList
          isEn={isEn}
          filteredEntries={filteredEntries}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
          listRef={listRef}
        />

        {/* Footer Hints */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            borderTop: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          <span>
            <strong style={{ color: "var(--text-secondary)" }}>↑↓</strong>{" "}
            {isEn ? "Navigate" : "Navigieren"} &nbsp;•&nbsp;{" "}
            <strong style={{ color: "var(--text-secondary)" }}>↵</strong>{" "}
            {isEn ? "Open / Run" : "Öffnen / Ausführen"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}>Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
