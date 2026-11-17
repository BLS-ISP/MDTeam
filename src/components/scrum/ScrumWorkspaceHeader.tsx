"use client";

import React from "react";
import {
  Sparkles,
  Users,
  BarChart3,
  GanttChart,
  Columns3,
  ListTodo,
  X,
} from "lucide-react";
import { AgileSprint, SprintMetrics } from "../../utils/issueEngine";
import { ScrumCopy } from "./scrumI18nAndStyles";

export type ScrumTabId = "board" | "backlog" | "roadmap" | "metrics";

export interface ScrumWorkspaceHeaderProps {
  t: ScrumCopy;
  activeTab: ScrumTabId;
  activeSprint: AgileSprint | undefined;
  activeSprintMetrics: SprintMetrics;
  toastMsg: string | null;
  onSelectTab: (tab: ScrumTabId) => void;
  onOpenPoker: () => void;
  onOpenCreateIssue: () => void;
  onDismissToast: () => void;
}

export function ScrumWorkspaceHeader({
  t,
  activeTab,
  activeSprint,
  activeSprintMetrics,
  toastMsg,
  onSelectTab,
  onOpenPoker,
  onOpenCreateIssue,
  onDismissToast,
}: ScrumWorkspaceHeaderProps) {
  return (
    <div
      style={{
        padding: "14px 24px 0 24px",
        backgroundColor: "var(--bg-sidebar)",
        borderBottom: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h1
            style={{
              fontSize: "18px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              margin: 0,
            }}
          >
            <Sparkles size={19} style={{ color: "var(--accent-indigo)" }} />
            {t.workspaceTitle}
          </h1>

          {activeSprint && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "3px 10px",
                borderRadius: "999px",
                backgroundColor: "rgba(99, 102, 241, 0.12)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                fontSize: "11px",
                color: "var(--text-primary)",
              }}
            >
              <strong style={{ color: "var(--accent-indigo)" }}>{activeSprint.name}</strong>
              <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {activeSprintMetrics.completedPoints}/{activeSprintMetrics.totalPoints} SP
              </span>
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={onOpenPoker}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-panel)",
              color: "var(--text-primary)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Users size={14} style={{ color: "var(--accent-indigo)" }} />
            {t.planningPoker}
          </button>

          <button
            type="button"
            onClick={onOpenCreateIssue}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--accent-indigo)",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.createIssue}
          </button>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {toastMsg && (
        <div
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            color: "var(--accent-green)",
            fontSize: "12px",
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={onDismissToast}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: "6px" }}>
        {(
          [
            { id: "board", icon: <Columns3 size={14} />, label: t.tabs.board },
            { id: "backlog", icon: <ListTodo size={14} />, label: t.tabs.backlog },
            { id: "roadmap", icon: <GanttChart size={14} />, label: t.tabs.roadmap },
            { id: "metrics", icon: <BarChart3 size={14} />, label: t.tabs.metrics },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "9px 14px",
                background: "none",
                border: "none",
                borderBottom: active
                  ? "2px solid var(--accent-indigo)"
                  : "2px solid transparent",
                color: active ? "var(--accent-indigo)" : "var(--text-secondary)",
                fontWeight: active ? 700 : 500,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
