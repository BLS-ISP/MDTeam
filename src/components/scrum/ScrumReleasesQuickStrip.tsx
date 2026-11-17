"use client";

import React from "react";
import { Tag } from "lucide-react";
import {
  type AgileIssue,
  type AgileRelease,
  computeReleaseProgress,
} from "../../utils/issueEngine";
import type { ScrumCopy } from "./scrumI18nAndStyles";
import type { ScrumExtendedTabId } from "./ScrumWorkspaceContainer";

export interface ScrumReleasesQuickStripProps {
  t: ScrumCopy;
  activeTab: ScrumExtendedTabId;
  releases: AgileRelease[];
  allIssues: AgileIssue[];
  jqlQuery: string;
  onSetActiveTab: (tab: ScrumExtendedTabId) => void;
  onToggleQuickFilter: (token: string) => void;
}

export function ScrumReleasesQuickStrip({
  t,
  activeTab,
  releases,
  allIssues,
  jqlQuery,
  onSetActiveTab,
  onToggleQuickFilter,
}: ScrumReleasesQuickStripProps) {
  return (
    <div
      style={{
        padding: "6px 24px",
        backgroundColor: "var(--bg-panel)",
        borderBottom: "1px solid var(--border-color)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          onClick={() => onSetActiveTab(activeTab === "releases" ? "board" : "releases")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 11px",
            borderRadius: "6px",
            border:
              activeTab === "releases"
                ? "1px solid var(--accent-indigo)"
                : "1px solid var(--border-color)",
            backgroundColor:
              activeTab === "releases" ? "rgba(99, 102, 241, 0.18)" : "var(--bg-sidebar)",
            color:
              activeTab === "releases" ? "var(--accent-indigo)" : "var(--text-secondary)",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Tag size={13} style={{ color: "var(--accent-green)" }} />
          {t.tabs.releases} ({releases.length})
        </button>
        {activeTab === "releases" && (
          <button
            type="button"
            onClick={() => onSetActiveTab("board")}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              fontSize: "11.5px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {t.backToBoardBtn}
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        {releases.slice(0, 4).map((rel) => {
          const prog = computeReleaseProgress(rel, allIssues);
          const filterTok = `fixversion:${rel.version}`;
          const isFiltered = jqlQuery.toLowerCase().includes(filterTok.toLowerCase());
          return (
            <button
              key={rel.id}
              type="button"
              onClick={() =>
                activeTab === "board" ? onToggleQuickFilter(filterTok) : onSetActiveTab("releases")
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "2px 8px",
                borderRadius: "999px",
                border: isFiltered ? "1px solid var(--accent-green)" : "1px solid var(--border-color)",
                backgroundColor: isFiltered ? "rgba(16, 185, 129, 0.16)" : "var(--bg-sidebar)",
                color: isFiltered ? "var(--accent-green)" : "var(--text-secondary)",
                fontSize: "10.5px",
                fontFamily: "var(--font-mono)",
                cursor: "pointer",
              }}
              title={`${rel.name} (${prog.doneIssues}/${prog.totalIssues} Done)`}
            >
              <strong>{rel.version}</strong>
              <span style={{ color: "var(--text-muted)" }}>{prog.pointsProgressPercent}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
