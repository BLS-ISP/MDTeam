"use client";

import React from "react";
import { Filter, X } from "lucide-react";
import { AgileSprint } from "../../utils/issueEngine";
import { ScrumCopy, SwimlaneMode } from "./scrumI18nAndStyles";

export interface KanbanFilterBarProps {
  t: ScrumCopy;
  boardScope: string;
  activeSprint: AgileSprint | undefined;
  sprints: AgileSprint[];
  jqlQuery: string;
  swimlaneMode: SwimlaneMode;
  onSetBoardScope: (scope: string) => void;
  onSetJqlQuery: (query: string) => void;
  onToggleQuickFilter: (token: string) => void;
  onSetSwimlaneMode: (mode: SwimlaneMode) => void;
}

export function KanbanFilterBar({
  t,
  boardScope,
  activeSprint,
  sprints,
  jqlQuery,
  swimlaneMode,
  onSetBoardScope,
  onSetJqlQuery,
  onToggleQuickFilter,
  onSetSwimlaneMode,
}: KanbanFilterBarProps) {
  const quickMeActive = /\bassignee:@me\b/i.test(jqlQuery);
  const quickBlockedActive = /\bis:blocked\b/i.test(jqlQuery);
  const quickBugsActive = /\btype:bug\b/i.test(jqlQuery);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "wrap",
        backgroundColor: "var(--bg-panel)",
        border: "1px solid var(--border-color)",
        borderRadius: "10px",
        padding: "10px 14px",
      }}
    >
      {/* Left: Sprint Scope + JQL Input + Quick Chips */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, flexWrap: "wrap" }}>
        <select
          className="settings-select"
          style={{ width: "auto", minWidth: "180px", padding: "6px 10px", fontSize: "12px" }}
          value={boardScope}
          onChange={(e) => onSetBoardScope(e.target.value)}
        >
          {activeSprint && (
            <option value="active">
              {activeSprint.name} ({t.sprintStates[activeSprint.state]})
            </option>
          )}
          <option value="all">{t.allIssuesScope}</option>
          {sprints
            .filter((s) => s.id !== activeSprint?.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({t.sprintStates[s.state]})
              </option>
            ))}
        </select>

        {/* JQL-lite Input */}
        <div style={{ position: "relative", flex: 1, minWidth: "230px" }}>
          <Filter
            size={13}
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            type="text"
            className="settings-input"
            style={{
              paddingLeft: "30px",
              paddingRight: jqlQuery ? "28px" : "10px",
              paddingTop: "6px",
              paddingBottom: "6px",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
            }}
            placeholder={t.jqlPlaceholder}
            value={jqlQuery}
            onChange={(e) => onSetJqlQuery(e.target.value)}
          />
          {jqlQuery && (
            <button
              type="button"
              onClick={() => onSetJqlQuery("")}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Quick Filter Chips */}
        <button
          type="button"
          onClick={() => onToggleQuickFilter("assignee:@me")}
          style={{
            padding: "5px 10px",
            borderRadius: "999px",
            border: quickMeActive
              ? "1px solid var(--accent-indigo)"
              : "1px solid var(--border-color)",
            backgroundColor: quickMeActive
              ? "rgba(99, 102, 241, 0.2)"
              : "var(--bg-sidebar)",
            color: quickMeActive ? "#ffffff" : "var(--text-secondary)",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t.quickMe}
        </button>

        <button
          type="button"
          onClick={() => onToggleQuickFilter("is:blocked")}
          style={{
            padding: "5px 10px",
            borderRadius: "999px",
            border: quickBlockedActive
              ? "1px solid var(--accent-red)"
              : "1px solid var(--border-color)",
            backgroundColor: quickBlockedActive
              ? "rgba(239, 68, 68, 0.2)"
              : "var(--bg-sidebar)",
            color: quickBlockedActive ? "var(--accent-red)" : "var(--text-secondary)",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t.quickBlocked}
        </button>

        <button
          type="button"
          onClick={() => onToggleQuickFilter("type:bug")}
          style={{
            padding: "5px 10px",
            borderRadius: "999px",
            border: quickBugsActive
              ? "1px solid var(--accent-red)"
              : "1px solid var(--border-color)",
            backgroundColor: quickBugsActive
              ? "rgba(239, 68, 68, 0.16)"
              : "var(--bg-sidebar)",
            color: quickBugsActive ? "var(--accent-red)" : "var(--text-secondary)",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t.quickBugs}
        </button>
      </div>

      {/* Right: Swimlane Selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
          {t.swimlaneLabel}:
        </span>
        <select
          className="settings-select"
          style={{ width: "auto", padding: "6px 10px", fontSize: "12px" }}
          value={swimlaneMode}
          onChange={(e) => onSetSwimlaneMode(e.target.value as SwimlaneMode)}
        >
          {(["none", "assignee", "epic", "priority"] as SwimlaneMode[]).map((m) => (
            <option key={m} value={m}>
              {t.swimlanes[m]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
