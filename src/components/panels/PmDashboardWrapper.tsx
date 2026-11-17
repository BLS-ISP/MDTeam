"use client";

import React from "react";
import { Folder, Sparkles } from "lucide-react";
import ScrumWorkspace from "../ScrumWorkspace";
import { useWorkspaceContext, type PmSubTabId } from "../../context/WorkspaceContext";
import { parseBacklogItems, parseRoadmapItems } from "../../utils/workspace/agileMarkdownParsers";
import { PmVelocityTab } from "./PmVelocityTab";
import { PmRetroTab, PmStandupTab } from "./PmRetroAndStandupTabs";

export function PmDashboardWrapper() {
  const {
    files,
    language,
    pmSubTab,
    setPmSubTab,
    handleUpsertWorkspaceFile,
    handleUpsertMultipleFiles,
    handleDeleteWorkspaceFile,
    handleOpenFile,
    setActivePanel,
    handleCreateBranchFromIssue,
    yjsUrl,
    currentUser,
    effectiveScrumRole,
  } = useWorkspaceContext();

  const roadmapItems = parseRoadmapItems(files);
  const backlogItems = parseBacklogItems(files);

  const tabButton = (id: PmSubTabId, label: string, withIcon = false) => (
    <button
      key={id}
      className={`pm-tab-btn ${pmSubTab === id ? "active" : ""}`}
      onClick={() => setPmSubTab(id)}
      style={{
        background: "none",
        border: "none",
        color: pmSubTab === id ? "var(--accent-indigo)" : "var(--text-secondary)",
        borderBottom: pmSubTab === id ? "2px solid var(--accent-indigo)" : "none",
        padding: "8px 16px",
        fontWeight: pmSubTab === id ? 600 : 400,
        cursor: "pointer",
        fontSize: "13px",
        display: withIcon ? "flex" : undefined,
        alignItems: withIcon ? "center" : undefined,
        gap: withIcon ? "6px" : undefined,
      }}
    >
      {withIcon && <Sparkles size={14} />}
      {label}
    </button>
  );

  return (
    <div className="pm-dashboard">
      <div className="dashboard-title-section" style={{ marginBottom: "16px" }}>
        <h1 className="dashboard-title">
          <Sparkles size={22} style={{ color: "var(--accent-indigo)" }} />
          Scrum Master &amp; PM Dashboard
        </h1>

        <div className="timeline-legend">
          <div className="legend-item">
            <span className="legend-color completed" />
            <span>{language === "en" ? "Completed" : "Erledigt"}</span>
          </div>
          <div className="legend-item">
            <span className="legend-color in-progress" />
            <span>{language === "en" ? "In Progress" : "In Arbeit"}</span>
          </div>
          <div className="legend-item">
            <span className="legend-color pending" />
            <span>{language === "en" ? "Pending" : "Ausstehend"}</span>
          </div>
        </div>
      </div>

      {/* PM Sub Tabs Navigation */}
      <div
        className="pm-tabs"
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--border-color)",
          marginBottom: "20px",
          paddingBottom: "1px",
        }}
      >
        {tabButton("scrum", "Jira & Scrum Workspace", true)}
        {tabButton("retro", language === "en" ? "Retrospective & Blockers" : "Retrospektive & Blocker")}
        {tabButton("standup", language === "en" ? "Standup Assistant" : "Standup Assistent")}
        {tabButton("roadmap", language === "en" ? "arc42 Radar & Milestones" : "arc42 Radar & Meilensteine")}
        {tabButton("kanban", language === "en" ? "Classic Markdown Backlog" : "Klassisches Backlog")}
        {tabButton("velocity", language === "en" ? "Capacity Table" : "Kapazitäts-Tabelle")}
      </div>

      {pmSubTab === "scrum" && (
        <div
          style={{
            margin: "-8px 0 0 0",
            borderRadius: "12px",
            border: "1px solid var(--border-color)",
            overflow: "hidden",
            minHeight: "620px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <ScrumWorkspace
            files={files}
            onUpsertFile={handleUpsertWorkspaceFile}
            onUpsertMultipleFiles={handleUpsertMultipleFiles}
            onDeleteFile={handleDeleteWorkspaceFile}
            onOpenFile={(targetPath) => {
              handleOpenFile(targetPath);
              setActivePanel("explorer");
            }}
            onCreateBranchFromIssue={handleCreateBranchFromIssue}
            yjsUrl={yjsUrl}
            currentUser={currentUser}
            userRole={effectiveScrumRole}
            language={language}
          />
        </div>
      )}

      {pmSubTab === "roadmap" && (
        <>
          <div className="timeline-card">
            <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "16px", color: "var(--text-primary)" }}>
              {language === "en"
                ? "Project Milestones & Roadmap (Dynamic from roadmap.md)"
                : "Projekt-Meilensteine & Roadmap (Dynamisch aus roadmap.md)"}
            </h2>

            <div className="timeline-axis">
              <div className="timeline-axis-label">{language === "en" ? "June 1-5" : "Juni 1-5"}</div>
              <div className="timeline-axis-label">{language === "en" ? "June 6-12" : "Juni 6-12"}</div>
              <div className="timeline-axis-label">{language === "en" ? "June 13-20" : "Juni 13-20"}</div>
              <div className="timeline-axis-label">{language === "en" ? "June 21-28" : "Juni 21-28"}</div>
            </div>

            <div className="timeline-rows">
              {roadmapItems.map((item, idx) => {
                let width = "25%";
                let left = "0%";
                if (idx === 0) {
                  width = "18%";
                  left = "0%";
                } else if (idx === 1) {
                  width = "25%";
                  left = "18%";
                } else if (idx === 2) {
                  width = "28%";
                  left = "43%";
                } else if (idx === 3) {
                  width = "28%";
                  left = "71%";
                }

                return (
                  <div className="timeline-row" key={idx}>
                    <div className="timeline-row-info">
                      <span>{item.title}</span>
                      <span className="timeline-row-assignee">
                        {item.assignee} ({item.milestone})
                      </span>
                    </div>

                    <div className="timeline-bar-track">
                      <div
                        className={`timeline-bar ${item.status}`}
                        style={{
                          left,
                          width,
                          background: item.color
                            ? `linear-gradient(135deg, ${item.color.trim()}, color-mix(in srgb, ${item.color.trim()} 80%, black))`
                            : undefined,
                          borderColor: item.color || undefined,
                        }}
                      >
                        {item.status.toUpperCase()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" }}>
            <div className="timeline-card">
              <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px" }}>
                Qualitätsziele Radar (arc42 §1.2)
              </h3>
              <div style={{ height: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div
                  style={{
                    border: "2px solid var(--border-color)",
                    borderRadius: "50%",
                    width: "120px",
                    height: "120px",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ border: "1px solid rgba(99, 102, 241, 0.4)", borderRadius: "50%", width: "70px", height: "70px", position: "relative" }} />
                  <span style={{ position: "absolute", top: "-15px", fontSize: "9px", fontWeight: 600 }}>
                    Entwickler-Zufriedenheit
                  </span>
                  <span style={{ position: "absolute", bottom: "-15px", fontSize: "9px", fontWeight: 600 }}>
                    PM-Transparenz
                  </span>
                  <span style={{ position: "absolute", right: "-35px", fontSize: "9px", fontWeight: 600 }}>
                    Live-Sync
                  </span>
                  <svg style={{ position: "absolute", width: "100%", height: "100%", top: 0, left: 0 }}>
                    <polygon points="60,20 100,60 60,95" fill="rgba(99, 102, 241, 0.25)" stroke="var(--accent-indigo)" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="timeline-card">
              <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px" }}>
                Neueste Architekturentscheidungen (ADR)
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, marginBottom: "2px" }}>
                    <span>ADR-0001: Modulare Authentifizierung</span>
                    <span className="git-change-badge added" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "var(--accent-green)" }}>
                      Akzeptiert
                    </span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                    Einführung von Passport.js / NextAuth zur modularen Integration von Keycloak SSO und LDAP.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {pmSubTab === "kanban" && (
        <div className="timeline-card">
          <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "16px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Folder size={18} style={{ color: "var(--accent-blue)" }} />
            {language === "en"
              ? "Sprint Backlog & Kanban Board (Dynamic from sprint-backlog.md)"
              : "Sprint Backlog & Kanban-Board (Dynamisch aus sprint-backlog.md)"}
          </h2>

          <div className="kanban-board">
            <div className="kanban-column">
              <div className="kanban-column-header">
                <span>{language === "en" ? "Open (TODO)" : "Offen (TODO)"}</span>
                <span className="kanban-badge">{backlogItems.filter((i) => i.status === "todo").length}</span>
              </div>
              {backlogItems
                .filter((i) => i.status === "todo")
                .map((item) => (
                  <div key={item.id} className="kanban-card">
                    <div className="kanban-card-title">{item.title}</div>
                    <div className="kanban-card-footer">
                      <span className="kanban-card-assignee">{item.assignee}</span>
                      <span className="kanban-card-status-badge">TODO</span>
                    </div>
                  </div>
                ))}
            </div>

            <div className="kanban-column">
              <div className="kanban-column-header in-progress">
                <span>{language === "en" ? "In Progress (IN PROGRESS)" : "In Arbeit (IN PROGRESS)"}</span>
                <span className="kanban-badge">{backlogItems.filter((i) => i.status === "in-progress").length}</span>
              </div>
              {backlogItems
                .filter((i) => i.status === "in-progress")
                .map((item) => (
                  <div key={item.id} className="kanban-card in-progress">
                    <div className="kanban-card-title">{item.title}</div>
                    <div className="kanban-card-footer">
                      <span className="kanban-card-assignee">{item.assignee}</span>
                      <span className="kanban-card-status-badge">IN PROG</span>
                    </div>
                  </div>
                ))}
            </div>

            <div className="kanban-column">
              <div className="kanban-column-header done">
                <span>{language === "en" ? "Completed (DONE)" : "Erledigt (DONE)"}</span>
                <span className="kanban-badge">{backlogItems.filter((i) => i.status === "done").length}</span>
              </div>
              {backlogItems
                .filter((i) => i.status === "done")
                .map((item) => (
                  <div key={item.id} className="kanban-card done">
                    <div className="kanban-card-title">{item.title}</div>
                    <div className="kanban-card-footer">
                      <span className="kanban-card-assignee">{item.assignee}</span>
                      <span className="kanban-card-status-badge">DONE</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {pmSubTab === "velocity" && <PmVelocityTab />}
      {pmSubTab === "retro" && <PmRetroTab />}
      {pmSubTab === "standup" && <PmStandupTab />}
    </div>
  );
}
