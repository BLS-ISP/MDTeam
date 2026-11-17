"use client";

import React, { useState, useMemo } from "react";
import { Bell, CheckCircle, AtSign, Clock, ChevronRight, AlertCircle } from "lucide-react";
import type { WorkspaceNotificationItem } from "../modals/modalTypesAndBadges";

export interface NotificationInboxPopoverProps {
  isEn: boolean;
  currentUser: string;
  notifications: WorkspaceNotificationItem[];
  readIds: Record<string, boolean>;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onMarkSingleRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenFile?: (filePath: string) => void;
}

function getNotifIcon(kind: WorkspaceNotificationItem["kind"]) {
  switch (kind) {
    case "blocked":
      return <AlertCircle size={14} style={{ color: "var(--accent-red)", flexShrink: 0 }} />;
    case "mention":
      return <AtSign size={14} style={{ color: "var(--accent-indigo)", flexShrink: 0 }} />;
    case "review":
      return <Clock size={14} style={{ color: "var(--accent-yellow)", flexShrink: 0 }} />;
    default:
      return <CheckCircle size={14} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />;
  }
}

export function NotificationInboxPopover({
  isEn,
  currentUser,
  notifications,
  readIds,
  isOpen,
  onToggle,
  onClose,
  onMarkSingleRead,
  onMarkAllRead,
  onOpenFile,
}: NotificationInboxPopoverProps) {
  const [inboxFilter, setInboxFilter] = useState<"all" | "unread">("all");

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds[n.id]).length,
    [notifications, readIds]
  );

  const visibleNotifications = useMemo(
    () =>
      inboxFilter === "unread"
        ? notifications.filter((n) => !readIds[n.id])
        : notifications,
    [notifications, inboxFilter, readIds]
  );

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={onToggle}
        title={
          isEn
            ? `Workspace Notifications (${unreadCount} unread)`
            : `Benachrichtigungen (${unreadCount} ungelesen)`
        }
        style={{
          position: "relative",
          width: "30px",
          height: "28px",
          borderRadius: "6px",
          border: "1px solid var(--border-color)",
          backgroundColor: isOpen ? "var(--bg-active)" : "var(--bg-panel)",
          color: unreadCount > 0 ? "var(--text-primary)" : "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              minWidth: "16px",
              height: "16px",
              padding: "0 4px",
              borderRadius: "999px",
              backgroundColor: "var(--accent-red)",
              color: "#ffffff",
              fontSize: "9px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px var(--bg-sidebar)",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "34px",
            width: "360px",
            maxHeight: "430px",
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            boxShadow: "var(--shadow-lg)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 400,
          }}
        >
          {/* Inbox Header */}
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-panel)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
              {isEn ? "Inbox" : "Posteingang"}{" "}
              <span style={{ color: "var(--accent-indigo)", fontFamily: "var(--font-mono)" }}>
                {currentUser}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                onClick={() => setInboxFilter(inboxFilter === "all" ? "unread" : "all")}
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-sidebar)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                {inboxFilter === "all"
                  ? isEn
                    ? "Unread only"
                    : "Nur ungelesene"
                  : isEn
                    ? "Show all"
                    : "Alle zeigen"}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: "rgba(99, 102, 241, 0.16)",
                    color: "var(--accent-indigo)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {isEn ? "Mark all read" : "Alle gelesen"}
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
            {visibleNotifications.length === 0 ? (
              <div
                style={{
                  padding: "28px 16px",
                  textAlign: "center",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                }}
              >
                {isEn
                  ? `All caught up for ${currentUser}!`
                  : `Keine offenen Meldungen für ${currentUser}!`}
              </div>
            ) : (
              visibleNotifications.map((item) => {
                const isUnread = !readIds[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onMarkSingleRead(item.id);
                      onOpenFile?.(item.filePath);
                      onClose();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "9px 10px",
                      marginBottom: "3px",
                      borderRadius: "8px",
                      backgroundColor: isUnread
                        ? "rgba(99, 102, 241, 0.08)"
                        : "transparent",
                      border: `1px solid ${
                        isUnread ? "rgba(99, 102, 241, 0.22)" : "transparent"
                      }`,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ marginTop: "2px" }}>{getNotifIcon(item.kind)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: isUnread ? 600 : 500,
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.subtitle}
                      </div>
                    </div>
                    <ChevronRight
                      size={13}
                      style={{ color: "var(--text-muted)", marginTop: "3px", flexShrink: 0 }}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
