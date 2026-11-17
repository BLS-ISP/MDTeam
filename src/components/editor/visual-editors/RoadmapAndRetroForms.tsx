"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { useWorkspaceContext } from "../../../context/WorkspaceContext";
import {
  parseRoadmapItems,
  serializeRoadmapItems,
  parseRetroNotesForFile,
  serializeRetroNotesForFile,
  type RoadmapItem,
  type RetroNote,
} from "../../../utils/workspace/agileMarkdownParsers";

export function RoadmapVisualForm() {
  const { files, updateMarkdownFileContent } = useWorkspaceContext();
  const items = parseRoadmapItems(files);

  const saveRoadmap = (updated: RoadmapItem[]) => {
    updateMarkdownFileContent("management/roadmap.md", serializeRoadmapItems(updated));
  };

  const handleItemChange = (index: number, field: keyof RoadmapItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    saveRoadmap(updated);
  };

  const handleAddItem = () => {
    saveRoadmap([
      ...items,
      {
        title: "New Milestone",
        status: "pending",
        milestone: "M: Milestone",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
        assignee: "Unassigned",
        color: "#6366f1",
      },
    ]);
  };

  const handleDeleteItem = (index: number) => {
    saveRoadmap(items.filter((_, idx) => idx !== index));
  };

  return (
    <div className="visual-form-container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "12px",
        }}
      >
        <div>
          <h3 style={{ fontSize: "18px", margin: 0 }}>Roadmap &amp; Milestones</h3>
          <p style={{ fontSize: "13px", margin: "4px 0 0 0" }}>
            Plan project phases and assign them to owners.
          </p>
        </div>
        <button className="visual-add-btn" onClick={handleAddItem} style={{ padding: "8px 14px", fontSize: "13px" }}>
          <Plus size={14} /> Add Milestone
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            className="visual-card-milestone"
            style={{
              backgroundColor: "var(--bg-panel)",
              borderRadius: "8px",
              padding: "16px",
              border: `1px solid ${item.color || "var(--border-color)"}`,
              borderLeft: `5px solid ${item.color || "var(--accent-indigo)"}`,
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="text"
                value={item.title}
                onChange={(e) => handleItemChange(idx, "title", e.target.value)}
                placeholder="Milestone Title..."
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: "4px",
                  backgroundColor: "var(--bg-editor)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                  fontWeight: "bold",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
              <button
                onClick={() => handleDeleteItem(idx)}
                className="visual-delete-btn"
                style={{ width: "28px", height: "28px", padding: 0 }}
                title="Delete Milestone"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>Status</label>
                <select
                  value={item.status}
                  onChange={(e) => handleItemChange(idx, "status", e.target.value as RoadmapItem["status"])}
                  style={{
                    padding: "6px",
                    borderRadius: "4px",
                    backgroundColor: "var(--bg-editor)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    outline: "none",
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>Milestone</label>
                <input
                  type="text"
                  value={item.milestone}
                  onChange={(e) => handleItemChange(idx, "milestone", e.target.value)}
                  placeholder="e.g. M1"
                  style={{
                    padding: "6px 8px",
                    borderRadius: "4px",
                    backgroundColor: "var(--bg-editor)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>Start</label>
                <input
                  type="date"
                  value={item.start_date}
                  onChange={(e) => handleItemChange(idx, "start_date", e.target.value)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "4px",
                    backgroundColor: "var(--bg-editor)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    fontSize: "11px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>End</label>
                <input
                  type="date"
                  value={item.end_date}
                  onChange={(e) => handleItemChange(idx, "end_date", e.target.value)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "4px",
                    backgroundColor: "var(--bg-editor)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    fontSize: "11px",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>Assignee</label>
                <input
                  type="text"
                  value={item.assignee}
                  onChange={(e) => handleItemChange(idx, "assignee", e.target.value)}
                  placeholder="Name/Role..."
                  style={{
                    padding: "6px 8px",
                    borderRadius: "4px",
                    backgroundColor: "var(--bg-editor)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>Color</label>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <input
                    type="color"
                    value={item.color || "#6366f1"}
                    onChange={(e) => handleItemChange(idx, "color", e.target.value)}
                    style={{ border: "none", background: "transparent", width: "28px", height: "28px", cursor: "pointer", padding: 0 }}
                  />
                  <input
                    type="text"
                    value={item.color || ""}
                    onChange={(e) => handleItemChange(idx, "color", e.target.value)}
                    placeholder="#hex"
                    style={{
                      flex: 1,
                      padding: "5px 6px",
                      borderRadius: "4px",
                      backgroundColor: "var(--bg-editor)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "10px",
                      outline: "none",
                      minWidth: 0,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RetroVisualForm({ filePath }: { filePath: string }) {
  const { files, updateMarkdownFileContent } = useWorkspaceContext();
  const notes = parseRetroNotesForFile(files, filePath);

  const saveRetro = (updated: RetroNote[]) => {
    updateMarkdownFileContent(filePath, serializeRetroNotesForFile(files, filePath, updated));
  };

  const handleNoteChange = (index: number, text: string) => {
    const updated = [...notes];
    updated[index] = { ...updated[index], text };
    saveRetro(updated);
  };

  const handleAddNote = (type: "glad" | "sad" | "impediment") => {
    const text = type === "glad" ? "What went well..." : type === "sad" ? "What went wrong..." : "Blocker...";
    saveRetro([...notes, { type, text }]);
  };

  const handleDeleteNote = (index: number) => {
    saveRetro(notes.filter((_, idx) => idx !== index));
  };

  const indexedNotes = notes.map((n, idx) => ({ ...n, originalIndex: idx }));
  const glads = indexedNotes.filter((n) => n.type === "glad");
  const sads = indexedNotes.filter((n) => n.type === "sad");
  const impediments = indexedNotes.filter((n) => n.type === "impediment");

  const renderColumn = (
    columnTitle: string,
    type: "glad" | "sad" | "impediment",
    items: typeof glads,
    headerColor: string,
    bgColor: string
  ) => (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minWidth: "240px",
        backgroundColor: bgColor,
        borderRadius: "8px",
        padding: "16px",
        border: "1px solid var(--border-color)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `2px solid ${headerColor}`,
          paddingBottom: "8px",
          marginBottom: "8px",
        }}
      >
        <span style={{ fontWeight: "bold", fontSize: "14px", color: "var(--text-primary)" }}>
          {columnTitle} ({items.length})
        </span>
        <button className="action-icon-btn" onClick={() => handleAddNote(type)} title="Add Card" style={{ color: headerColor }}>
          <Plus size={16} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, overflowY: "auto", minHeight: "300px" }}>
        {items.map((item) => (
          <div
            key={item.originalIndex}
            style={{
              backgroundColor: "var(--bg-panel)",
              borderLeft: `4px solid ${headerColor}`,
              borderRadius: "6px",
              padding: "12px",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              position: "relative",
            }}
          >
            <textarea
              value={item.text}
              onChange={(e) => handleNoteChange(item.originalIndex, e.target.value)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                resize: "none",
                outline: "none",
                height: "60px",
              }}
              placeholder="Write a note..."
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => handleDeleteNote(item.originalIndex)}
                className="visual-delete-btn"
                style={{ width: "24px", height: "24px", padding: 0 }}
                title="Delete Note"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: "12px",
              border: "1px dashed var(--border-color)",
              borderRadius: "6px",
            }}
          >
            No entries
          </div>
        )}
      </div>
    </div>
  );

  const file = files.find((f) => f.path === filePath);
  const retroTitle = file ? (file.content.split("\n")[0] || "# Retrospective").replace("# ", "") : "Retrospective";

  return (
    <div className="visual-form-container">
      <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "18px", color: "var(--text-primary)", margin: 0 }}>{retroTitle}</h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
          Conduct the sprint retrospective directly on this interactive sticky-note board.
        </p>
      </div>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {renderColumn("1. What went well? (Glad)", "glad", glads, "var(--accent-green)", "rgba(16, 185, 129, 0.01)")}
        {renderColumn("2. What did not go well? (Sad)", "sad", sads, "var(--accent-red)", "rgba(239, 68, 68, 0.01)")}
        {renderColumn("3. Impediments / Blocker Log", "impediment", impediments, "var(--accent-yellow)", "rgba(245, 158, 11, 0.01)")}
      </div>
    </div>
  );
}
