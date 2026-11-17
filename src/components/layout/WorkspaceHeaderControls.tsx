"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, GitBranch, Upload, Code, Eye, Layers } from "lucide-react";
import {
  PRESET_TEAM_HANDLES,
  type WorkspaceFile,
  type WorkspaceRoleMode,
  normalizeHandleForMatch,
} from "../modals/modalTypesAndBadges";
import { scanWorkspaceNotifications } from "../modals/notificationScanner";
import { UserIdentityPopover } from "../modals/UserIdentityPopover";
import { NotificationInboxPopover } from "./NotificationInboxPopover";

export { PRESET_TEAM_HANDLES, type WorkspaceRoleMode };

const USER_HANDLE_STORAGE_KEY = "mdteam_current_user";
const ROLE_MODE_STORAGE_KEY = "mdteam_role_mode";
const READ_NOTIFS_STORAGE_KEY = "mdteam_read_notifications";

const PILL_BTN_BASE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: "28px",
  borderRadius: "6px",
  border: "1px solid var(--border-color)",
  backgroundColor: "var(--bg-panel)",
  color: "var(--text-secondary)",
  fontSize: "11px",
  cursor: "pointer",
};

export interface WorkspaceHeaderControlsProps {
  roleMode: WorkspaceRoleMode;
  onRoleModeChange: (mode: WorkspaceRoleMode) => void;
  currentUser: string;
  onCurrentUserChange: (userHandle: string) => void;
  files: WorkspaceFile[];
  onOpenFile?: (filePath: string) => void;
  language?: "de" | "en";
  currentBranch?: string;
  onOpenGitBranchModal?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenImportModal?: () => void;
}

export function WorkspaceHeaderControls({
  roleMode,
  onRoleModeChange,
  currentUser,
  onCurrentUserChange,
  files,
  onOpenFile,
  language = "de",
  currentBranch,
  onOpenGitBranchModal,
  onOpenCommandPalette,
  onOpenImportModal,
}: WorkspaceHeaderControlsProps) {
  const isEn = language === "en";
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [readIds, setReadIds] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Hydrate persisted currentUser, roleMode & read notification IDs from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedUser = localStorage.getItem(USER_HANDLE_STORAGE_KEY);
      if (savedUser && savedUser.startsWith("@") && savedUser !== currentUser) {
        onCurrentUserChange(savedUser);
      }
      const savedRole = localStorage.getItem(ROLE_MODE_STORAGE_KEY) as WorkspaceRoleMode | null;
      if (
        savedRole &&
        (savedRole === "developer" || savedRole === "scrum" || savedRole === "stakeholder") &&
        savedRole !== roleMode
      ) {
        onRoleModeChange(savedRole);
      }
      const savedRead = localStorage.getItem(READ_NOTIFS_STORAGE_KEY);
      if (savedRead) {
        const parsed = JSON.parse(savedRead);
        if (parsed && typeof parsed === "object") {
          setReadIds(parsed);
        }
      }
    } catch {
      // ignore storage access issues
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsInboxOpen(false);
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleSelectRole = (nextMode: WorkspaceRoleMode) => {
    onRoleModeChange(nextMode);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(ROLE_MODE_STORAGE_KEY, nextMode);
      } catch {
        // ignore
      }
    }
  };

  const handleSelectUser = (rawHandle: string) => {
    const normalized = normalizeHandleForMatch(rawHandle) || "@developer-a";
    onCurrentUserChange(normalized);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(USER_HANDLE_STORAGE_KEY, normalized);
      } catch {
        // ignore
      }
    }
    setIsUserMenuOpen(false);
  };

  const notifications = useMemo(
    () => scanWorkspaceNotifications(files, currentUser, language),
    [files, currentUser, language]
  );

  const persistReadIds = (next: Record<string, boolean>) => {
    setReadIds(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(READ_NOTIFS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
  };

  const markSingleRead = (id: string) => {
    if (readIds[id]) return;
    persistReadIds({ ...readIds, [id]: true });
  };

  const markAllRead = () => {
    const next = { ...readIds };
    notifications.forEach((n) => {
      next[n.id] = true;
    });
    persistReadIds(next);
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        position: "relative",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Optional Ctrl+K Omnibox Pill */}
      {onOpenCommandPalette && (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          title={isEn ? "Search & Commands (Ctrl+K)" : "Suche & Befehle (Strg+K)"}
          style={{ ...PILL_BTN_BASE, gap: "6px", padding: "0 10px" }}
        >
          <Search size={12} style={{ color: "var(--accent-indigo)" }} />
          <span>{isEn ? "Search..." : "Suche..."}</span>
          <kbd
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              padding: "1px 4px",
              borderRadius: "3px",
              backgroundColor: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            Ctrl+K
          </kbd>
        </button>
      )}

      {/* Optional Active Git Branch Pill */}
      {onOpenGitBranchModal && (
        <button
          type="button"
          onClick={onOpenGitBranchModal}
          title={isEn ? "Switch or create Git branch" : "Git-Branch wechseln oder anlegen"}
          style={{ ...PILL_BTN_BASE, gap: "5px", padding: "0 9px", fontFamily: "var(--font-mono)" }}
        >
          <GitBranch size={12} style={{ color: "var(--accent-green)" }} />
          <span
            style={{
              maxWidth: "120px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {currentBranch || "main"}
          </span>
        </button>
      )}

      {/* Optional Atlassian Import Quick Trigger */}
      {onOpenImportModal && (
        <button
          type="button"
          onClick={onOpenImportModal}
          title={isEn ? "Import from Jira / Confluence" : "Aus Jira / Confluence importieren"}
          style={{ ...PILL_BTN_BASE, gap: "5px", padding: "0 8px" }}
        >
          <Upload size={12} style={{ color: "var(--accent-blue)" }} />
          <span>{isEn ? "Import" : "Import"}</span>
        </button>
      )}

      {/* 1. Workspace Role Mode Switcher ("developer" | "scrum" | "stakeholder") */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2px",
          padding: "2px",
          height: "28px",
          borderRadius: "6px",
          backgroundColor: "var(--bg-panel)",
          border: "1px solid var(--border-color)",
        }}
        title={
          isEn
            ? "Switch Workspace Role Mode (Developer / Scrum / Stakeholder Clean Mode)"
            : "Workspace-Rollenmodus wechseln (Entwickler / Scrum / Stakeholder Clean Mode)"
        }
      >
        {(
          [
            { id: "developer", label: "Dev", icon: <Code size={11} /> },
            { id: "scrum", label: "Scrum", icon: <Layers size={11} /> },
            { id: "stakeholder", label: isEn ? "Stakeholder" : "PM / Clean", icon: <Eye size={11} /> },
          ] as const
        ).map((m) => {
          const active = roleMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSelectRole(m.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                height: "22px",
                padding: "0 7px",
                border: "none",
                borderRadius: "4px",
                backgroundColor: active
                  ? m.id === "stakeholder"
                    ? "var(--accent-green)"
                    : "var(--accent-indigo)"
                  : "transparent",
                color: active ? "#ffffff" : "var(--text-muted)",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Current User Handle Selector (@developer-a, etc.) */}
      <UserIdentityPopover
        isEn={isEn}
        currentUser={currentUser}
        isOpen={isUserMenuOpen}
        onToggle={() => {
          setIsUserMenuOpen((v) => !v);
          setIsInboxOpen(false);
        }}
        onSelectUser={handleSelectUser}
      />

      {/* 3. Notification Inbox Bell */}
      <NotificationInboxPopover
        isEn={isEn}
        currentUser={currentUser}
        notifications={notifications}
        readIds={readIds}
        isOpen={isInboxOpen}
        onToggle={() => {
          setIsInboxOpen((v) => !v);
          setIsUserMenuOpen(false);
        }}
        onClose={() => setIsInboxOpen(false)}
        onMarkSingleRead={markSingleRead}
        onMarkAllRead={markAllRead}
        onOpenFile={onOpenFile}
      />
    </div>
  );
}
