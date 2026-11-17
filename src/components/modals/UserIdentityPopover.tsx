"use client";

import React, { useState } from "react";
import { User, Check, ChevronDown } from "lucide-react";
import {
  PRESET_TEAM_HANDLES,
  normalizeHandleForMatch,
} from "./modalTypesAndBadges";

export interface UserIdentityPopoverProps {
  isEn: boolean;
  currentUser: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelectUser: (rawHandle: string) => void;
}

export function UserIdentityPopover({
  isEn,
  currentUser,
  isOpen,
  onToggle,
  onSelectUser,
}: UserIdentityPopoverProps) {
  const [customHandleInput, setCustomHandleInput] = useState("");

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={onToggle}
        title={isEn ? "Active @handle (persisted locally)" : "Aktives @Handle (lokal gespeichert)"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          height: "28px",
          padding: "0 9px",
          borderRadius: "6px",
          border: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-panel)",
          color: "var(--text-primary)",
          fontSize: "11px",
          fontFamily: "var(--font-mono)",
          cursor: "pointer",
        }}
      >
        <User size={12} style={{ color: "var(--accent-indigo)" }} />
        <span>{currentUser || "@developer-a"}</span>
        <ChevronDown size={11} style={{ color: "var(--text-muted)" }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "34px",
            width: "250px",
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            boxShadow: "var(--shadow-lg)",
            padding: "8px",
            zIndex: 400,
          }}
        >
          <div
            style={{
              padding: "4px 8px 6px",
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {isEn ? "Switch Active Team Identity" : "Aktive Team-Identität wählen"}
          </div>
          {PRESET_TEAM_HANDLES.map((item) => {
            const active = normalizeHandleForMatch(currentUser) === item.handle;
            return (
              <button
                key={item.handle}
                type="button"
                onClick={() => onSelectUser(item.handle)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 8px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: active ? "rgba(99, 102, 241, 0.14)" : "transparent",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--accent-indigo)",
                    }}
                  >
                    {item.handle}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                    {isEn ? item.labelEn : item.labelDe}
                  </div>
                </div>
                {active && <Check size={13} style={{ color: "var(--accent-green)" }} />}
              </button>
            );
          })}

          <div
            style={{
              borderTop: "1px solid var(--border-color)",
              marginTop: "6px",
              paddingTop: "6px",
              display: "flex",
              gap: "4px",
            }}
          >
            <input
              type="text"
              value={customHandleInput}
              onChange={(e) => setCustomHandleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customHandleInput.trim()) {
                  onSelectUser(customHandleInput);
                  setCustomHandleInput("");
                }
              }}
              placeholder="@custom-handle"
              style={{
                flex: 1,
                padding: "4px 7px",
                borderRadius: "5px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-panel)",
                color: "var(--text-primary)",
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (customHandleInput.trim()) {
                  onSelectUser(customHandleInput);
                  setCustomHandleInput("");
                }
              }}
              style={{
                padding: "4px 8px",
                borderRadius: "5px",
                border: "none",
                backgroundColor: "var(--accent-indigo)",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
