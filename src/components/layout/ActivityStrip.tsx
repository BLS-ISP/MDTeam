"use client";

import React from "react";
import { Calendar, Folder, GitBranch, HelpCircle, Search, Settings, Share2, Users } from "lucide-react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

export function ActivityStrip() {
  const { activePanel, setActivePanel, roleMode, t } = useWorkspaceContext();

  return (
    <div className="sidebar-strip">
      <div className="strip-group">
        <button
          className={`strip-btn ${activePanel === "explorer" ? "active" : ""}`}
          onClick={() => setActivePanel("explorer")}
          title={t.titleExplorer}
        >
          <Folder size={20} />
        </button>

        <button
          className={`strip-btn ${activePanel === "search" ? "active" : ""}`}
          onClick={() => setActivePanel("search")}
          title={t.titleSearch}
        >
          <Search size={20} />
        </button>

        {roleMode !== "stakeholder" && (
          <button
            className={`strip-btn ${activePanel === "git" ? "active" : ""}`}
            onClick={() => setActivePanel("git")}
            title={t.titleGit}
          >
            <GitBranch size={20} />
          </button>
        )}

        <button
          className={`strip-btn ${activePanel === "graph" ? "active" : ""}`}
          onClick={() => setActivePanel("graph")}
          title={t.titleGraph}
        >
          <Share2 size={20} />
        </button>

        <button
          className={`strip-btn ${activePanel === "pm" ? "active" : ""}`}
          onClick={() => setActivePanel("pm")}
          title={t.titlePM}
        >
          <Calendar size={20} />
        </button>

        <button
          className={`strip-btn ${activePanel === "meetings" ? "active" : ""}`}
          onClick={() => setActivePanel("meetings")}
          title={t.titleMeetings}
        >
          <Users size={20} />
        </button>
      </div>

      {roleMode !== "stakeholder" && (
        <button
          className={`strip-btn ${activePanel === "cheatsheet" ? "active" : ""}`}
          onClick={() => setActivePanel("cheatsheet")}
          title={t.titleCheatsheet}
          style={{ marginBottom: "8px" }}
        >
          <HelpCircle size={20} />
        </button>
      )}

      {roleMode !== "stakeholder" && (
        <button
          className={`strip-btn ${activePanel === "settings" ? "active" : ""}`}
          onClick={() => setActivePanel("settings")}
          title={t.titleSettings}
        >
          <Settings size={20} />
        </button>
      )}
    </div>
  );
}
