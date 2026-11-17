"use client";

import React from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import {
  AgileIssue,
  IssueType,
  IssueStatus,
  IssuePriority,
  FIBONACCI_POINTS,
  parseIssueFromFile,
  extractAllIssues,
  parseSprints,
  serializeIssueToMarkdown,
} from "../../../utils/issueEngine";
import { useWorkspaceContext } from "../../../context/WorkspaceContext";
import { GenericBlockEditor } from "./GenericBlockEditor";

export function AgileIssueVisualForm({ filePath }: { filePath: string }) {
  const { files, language, handleUpsertWorkspaceFile, openExistingIssueInDrawer } = useWorkspaceContext();

  const fileObj = files.find((f) => f.path === filePath);
  const parsedIssue = fileObj ? parseIssueFromFile(fileObj) : null;
  if (!parsedIssue) {
    return <GenericBlockEditor filePath={filePath} />;
  }

  const allIssuesList = extractAllIssues(files);
  const epicsList = allIssuesList.filter((i) => i.type === "epic" && i.id !== parsedIssue.id);
  const sprintsList = parseSprints(files);

  const updateIssueField = <K extends keyof AgileIssue>(key: K, value: AgileIssue[K]) => {
    const updated: AgileIssue = {
      ...parsedIssue,
      [key]: value,
      updatedAt: new Date().toISOString(),
    };
    handleUpsertWorkspaceFile(serializeIssueToMarkdown(updated));
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    marginBottom: "4px",
    display: "block",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "6px",
    backgroundColor: "var(--bg-editor)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
    fontSize: "13px",
    outline: "none",
  };

  return (
    <div className="visual-form-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "14px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--accent-indigo)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {parsedIssue.id} • {language === "en" ? "Jira Issue Visual Form" : "Jira-Ticket Formular"}
          </div>
          <h3 style={{ fontSize: "18px", color: "var(--text-primary)", margin: "4px 0 0 0" }}>
            {parsedIssue.title}
          </h3>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="git-btn"
            onClick={() => openExistingIssueInDrawer(parsedIssue)}
            style={{ padding: "7px 12px", fontSize: "12px" }}
          >
            <Sparkles size={13} />
            {language === "en" ? "Open Full Jira Drawer" : "Im Jira-Drawer öffnen"}
          </button>
        </div>
      </div>

      <div
        style={{
          backgroundColor: "var(--bg-panel)",
          padding: "16px",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div>
          <label style={fieldLabelStyle}>{language === "en" ? "Title" : "Titel"}</label>
          <input
            type="text"
            value={parsedIssue.title}
            onChange={(e) => updateIssueField("title", e.target.value)}
            style={{ ...inputStyle, fontWeight: 600, fontSize: "15px" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
          <div>
            <label style={fieldLabelStyle}>{language === "en" ? "Type" : "Typ"}</label>
            <select
              value={parsedIssue.type}
              onChange={(e) => updateIssueField("type", e.target.value as IssueType)}
              style={inputStyle}
            >
              <option value="epic">Epic</option>
              <option value="story">Story</option>
              <option value="task">Task</option>
              <option value="bug">Bug</option>
              <option value="spike">Spike</option>
            </select>
          </div>

          <div>
            <label style={fieldLabelStyle}>Status</label>
            <select
              value={parsedIssue.status}
              onChange={(e) => updateIssueField("status", e.target.value as IssueStatus)}
              style={inputStyle}
            >
              <option value="backlog">Backlog</option>
              <option value="ready">Ready</option>
              <option value="in-progress">In Progress</option>
              <option value="review">In Review</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div>
            <label style={fieldLabelStyle}>{language === "en" ? "Priority" : "Priorität"}</label>
            <select
              value={parsedIssue.priority}
              onChange={(e) => updateIssueField("priority", e.target.value as IssuePriority)}
              style={inputStyle}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label style={fieldLabelStyle}>Story Points</label>
            <select
              value={parsedIssue.storyPoints}
              onChange={(e) => updateIssueField("storyPoints", Number(e.target.value) || 0)}
              style={inputStyle}
            >
              {FIBONACCI_POINTS.map((pt) => (
                <option key={pt} value={pt}>
                  {pt} SP
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={fieldLabelStyle}>{language === "en" ? "Assignee" : "Bearbeiter"}</label>
            <input
              type="text"
              value={parsedIssue.assignee}
              onChange={(e) => updateIssueField("assignee", e.target.value)}
              placeholder="@developer-a"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={fieldLabelStyle}>Sprint</label>
            <select
              value={parsedIssue.sprint}
              onChange={(e) => updateIssueField("sprint", e.target.value)}
              style={inputStyle}
            >
              <option value="">{language === "en" ? "Unassigned (Backlog)" : "Kein Sprint (Backlog)"}</option>
              {sprintsList.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={fieldLabelStyle}>Epic</label>
            <select
              value={parsedIssue.epic}
              onChange={(e) => updateIssueField("epic", e.target.value)}
              style={inputStyle}
            >
              <option value="">{language === "en" ? "None" : "Kein Epic"}</option>
              {epicsList.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.id}: {ep.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={fieldLabelStyle}>{language === "en" ? "Start Date" : "Startdatum"}</label>
            <input
              type="date"
              value={parsedIssue.startDate || ""}
              onChange={(e) => updateIssueField("startDate", e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={fieldLabelStyle}>{language === "en" ? "Due Date" : "Enddatum"}</label>
            <input
              type="date"
              value={parsedIssue.endDate || ""}
              onChange={(e) => updateIssueField("endDate", e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={fieldLabelStyle}>{language === "en" ? "Description" : "Beschreibung"}</label>
          <textarea
            value={parsedIssue.description}
            onChange={(e) => updateIssueField("description", e.target.value)}
            style={{
              ...inputStyle,
              minHeight: "110px",
              resize: "vertical",
              fontFamily: "var(--font-sans)",
              lineHeight: 1.5,
            }}
          />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ ...fieldLabelStyle, marginBottom: 0 }}>
              {language === "en" ? "Acceptance Criteria" : "Akzeptanzkriterien"}
            </label>
            <button
              className="visual-add-btn"
              onClick={() =>
                updateIssueField("acceptanceCriteria", [
                  ...parsedIssue.acceptanceCriteria,
                  { text: language === "en" ? "New criterion" : "Neues Kriterium", checked: false },
                ])
              }
              style={{ padding: "4px 10px", fontSize: "11px" }}
            >
              <Plus size={12} /> {language === "en" ? "Add" : "Hinzufügen"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {parsedIssue.acceptanceCriteria.map((ac, acIdx) => (
              <div key={acIdx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={ac.checked}
                  onChange={(e) => {
                    const next = [...parsedIssue.acceptanceCriteria];
                    next[acIdx] = { ...ac, checked: e.target.checked };
                    updateIssueField("acceptanceCriteria", next);
                  }}
                  style={{ width: "15px", height: "15px", accentColor: "var(--accent-indigo)", cursor: "pointer" }}
                />
                <input
                  type="text"
                  value={ac.text}
                  onChange={(e) => {
                    const next = [...parsedIssue.acceptanceCriteria];
                    next[acIdx] = { ...ac, text: e.target.value };
                    updateIssueField("acceptanceCriteria", next);
                  }}
                  style={{
                    ...inputStyle,
                    flex: 1,
                    padding: "6px 10px",
                    textDecoration: ac.checked ? "line-through" : "none",
                    opacity: ac.checked ? 0.65 : 1,
                  }}
                />
                <button
                  className="visual-delete-btn"
                  onClick={() =>
                    updateIssueField(
                      "acceptanceCriteria",
                      parsedIssue.acceptanceCriteria.filter((_, idx) => idx !== acIdx)
                    )
                  }
                  style={{ width: "28px", height: "28px", padding: 0 }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
