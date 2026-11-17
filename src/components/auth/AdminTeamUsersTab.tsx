"use client";

import React, { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import type { AuthUser, ScrumRole } from "../../types/auth";
import {
  getRoleBadgeMeta,
  modalInputStyle,
  modalLabelStyle,
  SCRUM_ROLE_OPTIONS,
} from "./authModalStyles";

export interface AdminTeamUsersTabProps {
  isEn: boolean;
  users: AuthUser[];
  currentUser: AuthUser | null;
  isAdmin: boolean;
  isBusy: boolean;
  onRoleChange: (userId: string, role: ScrumRole) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onCreateUser: (input: {
    username: string;
    displayName: string;
    email: string;
    role: ScrumRole;
    password: string;
  }) => Promise<boolean>;
}

export function AdminTeamUsersTab({
  isEn,
  users,
  currentUser,
  isAdmin,
  isBusy,
  onRoleChange,
  onDeleteUser,
  onCreateUser,
}: AdminTeamUsersTabProps) {
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<ScrumRole>("developer");
  const [newPassword, setNewPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;
    const ok = await onCreateUser({
      username: newUsername.trim(),
      displayName: newDisplayName.trim() || newUsername.trim(),
      email: newEmail.trim(),
      role: newRole,
      password: newPassword,
    });
    if (ok) {
      setNewUsername("");
      setNewDisplayName("");
      setNewEmail("");
      setNewPassword("");
    }
  };

  return (
    <>
      <div
        style={{
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {users.map((member) => {
          const badge = getRoleBadgeMeta(member.role);
          return (
            <div
              key={member.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr auto",
                alignItems: "center",
                gap: "10px",
                padding: "9px 12px",
                borderBottom: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-editor)",
                fontSize: "12.5px",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {member.displayName}{" "}
                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                    }}
                  >
                    ({member.handle})
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  {member.email} • {member.authProvider.toUpperCase()}
                </div>
              </div>

              <select
                value={member.role}
                disabled={!isAdmin || isBusy}
                onChange={(e) =>
                  void onRoleChange(member.id, e.target.value as ScrumRole)
                }
                style={{
                  ...modalInputStyle,
                  padding: "5px 8px",
                  fontSize: "12px",
                  color: badge.color,
                  fontWeight: 600,
                }}
              >
                {SCRUM_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.role} value={opt.role}>
                    {isEn ? opt.labelEn : opt.labelDe}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={!isAdmin || isBusy || currentUser?.id === member.id}
                onClick={() => void onDeleteUser(member.id)}
                title={isEn ? "Delete account" : "Konto löschen"}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor:
                    !isAdmin || currentUser?.id === member.id
                      ? "not-allowed"
                      : "pointer",
                  padding: "4px",
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-primary)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px",
        }}
      >
        <div>
          <label style={modalLabelStyle}>{isEn ? "Username" : "Benutzername"}</label>
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="dev-c"
            style={modalInputStyle}
          />
        </div>
        <div>
          <label style={modalLabelStyle}>{isEn ? "Display Name" : "Anzeigename"}</label>
          <input
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            placeholder="Developer C"
            style={modalInputStyle}
          />
        </div>
        <div>
          <label style={modalLabelStyle}>E-Mail</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="dev-c@mdteam.local"
            style={modalInputStyle}
          />
        </div>
        <div>
          <label style={modalLabelStyle}>{isEn ? "Scrum Role" : "Scrum-Rolle"}</label>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as ScrumRole)}
            style={modalInputStyle}
          >
            {SCRUM_ROLE_OPTIONS.map((opt) => (
              <option key={opt.role} value={opt.role}>
                {isEn ? opt.labelEn : opt.labelDe}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>
            {isEn ? "Initial Password" : "Start-Passwort"}
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="min. 6 chars"
            style={modalInputStyle}
          />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            type="submit"
            disabled={!isAdmin || isBusy || !newUsername.trim() || !newPassword}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "7px",
              border: "none",
              backgroundColor: "var(--accent-indigo)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
            }}
          >
            <UserPlus size={13} />
            {isEn ? "Add Account" : "Konto anlegen"}
          </button>
        </div>
      </form>
    </>
  );
}
