"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { useWorkspaceContext } from "../../../context/WorkspaceContext";
import {
  parseBacklogItems,
  serializeBacklogItems,
  parseChecklistData,
  parseChecklistMetadata,
  serializeChecklistData,
  type BacklogItem,
  type ChecklistItem,
} from "../../../utils/workspace/agileMarkdownParsers";

export function BacklogVisualForm() {
  const { files, updateMarkdownFileContent } = useWorkspaceContext();
  const items = parseBacklogItems(files);

  const saveBacklog = (updated: BacklogItem[]) => {
    updateMarkdownFileContent("management/sprint-backlog.md", serializeBacklogItems(updated));
  };

  const handleItemChange = (index: number, field: keyof BacklogItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    saveBacklog(updated);
  };

  const handleAddItem = () => {
    saveBacklog([
      ...items,
      { id: `backlog-new-${Date.now()}`, title: "New Task", status: "todo", assignee: "Unassigned" },
    ]);
  };

  const handleDeleteItem = (index: number) => {
    saveBacklog(items.filter((_, idx) => idx !== index));
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
          <h3 style={{ fontSize: "18px", margin: 0 }}>Sprint Backlog Editor</h3>
          <p style={{ fontSize: "13px", margin: "4px 0 0 0" }}>
            Manage tasks and assignments directly through this form.
          </p>
        </div>
        <button className="visual-add-btn" onClick={handleAddItem} style={{ padding: "8px 14px", fontSize: "13px" }}>
          <Plus size={14} /> Add Task
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {items.map((item, idx) => (
          <div
            key={item.id || idx}
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              backgroundColor: "var(--bg-panel)",
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <select
              value={item.status}
              onChange={(e) => handleItemChange(idx, "status", e.target.value as BacklogItem["status"])}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                backgroundColor: "var(--bg-editor)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                fontSize: "13px",
                fontWeight: 600,
                width: "140px",
                outline: "none",
              }}
            >
              <option value="todo">TODO</option>
              <option value="in-progress">IN PROGRESS</option>
              <option value="done">DONE</option>
            </select>

            <input
              type="text"
              value={item.title}
              onChange={(e) => handleItemChange(idx, "title", e.target.value)}
              placeholder="Task description..."
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "6px",
                backgroundColor: "var(--bg-editor)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                fontSize: "13px",
                outline: "none",
              }}
            />

            <select
              value={item.assignee}
              onChange={(e) => handleItemChange(idx, "assignee", e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                backgroundColor: "var(--bg-editor)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                fontSize: "13px",
                width: "160px",
                outline: "none",
              }}
            >
              <option value="Unassigned">Unassigned</option>
              <option value="@developer-a">@developer-a</option>
              <option value="@developer-b">@developer-b</option>
              <option value="@scrummaster">@scrummaster</option>
            </select>

            <button
              onClick={() => handleDeleteItem(idx)}
              className="visual-delete-btn"
              style={{ width: "34px", height: "34px", minWidth: "34px", padding: 0 }}
              title="Delete Task"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "var(--text-secondary)",
              border: "1px dashed var(--border-color)",
              borderRadius: "8px",
              backgroundColor: "var(--bg-panel)",
            }}
          >
            No tasks available. Add a new task using the button on the top right.
          </div>
        )}
      </div>
    </div>
  );
}

export function ChecklistVisualForm({ filePath }: { filePath: string }) {
  const { files, updateMarkdownFileContent } = useWorkspaceContext();
  const items = parseChecklistData(files, filePath);
  const { title, desc } = parseChecklistMetadata(files, filePath);

  const saveChecklist = (updated: ChecklistItem[]) => {
    updateMarkdownFileContent(filePath, serializeChecklistData(title, desc, updated));
  };

  const handleItemChange = (index: number, field: keyof ChecklistItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    saveChecklist(updated);
  };

  const handleAddItem = () => {
    saveChecklist([...items, { checked: false, text: "New Criterion" }]);
  };

  const handleDeleteItem = (index: number) => {
    saveChecklist(items.filter((_, idx) => idx !== index));
  };

  const completedCount = items.filter((i) => i.checked).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <div className="visual-form-container">
      <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "16px", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "18px", color: "var(--text-primary)", marginBottom: "6px" }}>{title}</h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>{desc}</p>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "14px" }}>
          <div
            style={{
              flex: 1,
              height: "6px",
              backgroundColor: "var(--bg-panel)",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                backgroundColor: "var(--accent-green)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              minWidth: "40px",
              textAlign: "right",
            }}
          >
            {completedCount}/{items.length} ({progressPercent}%)
          </span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>Checklist Criteria</span>
        <button className="visual-add-btn" onClick={handleAddItem} style={{ padding: "6px 12px", fontSize: "12px" }}>
          <Plus size={14} /> Add Criterion
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              backgroundColor: "var(--bg-panel)",
              padding: "10px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(e) => handleItemChange(idx, "checked", e.target.checked)}
              style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--accent-indigo)" }}
            />
            <input
              type="text"
              value={item.text}
              onChange={(e) => handleItemChange(idx, "text", e.target.value)}
              placeholder="Enter quality criterion..."
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: "4px",
                backgroundColor: "var(--bg-editor)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                fontSize: "13px",
                outline: "none",
                textDecoration: item.checked ? "line-through" : "none",
                opacity: item.checked ? 0.6 : 1,
                transition: "opacity 0.2s, text-decoration 0.2s",
              }}
            />
            <button
              onClick={() => handleDeleteItem(idx)}
              className="visual-delete-btn"
              style={{ width: "30px", height: "30px", padding: 0 }}
              title="Delete Criterion"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div
            style={{
              padding: "30px 20px",
              textAlign: "center",
              color: "var(--text-secondary)",
              border: "1px dashed var(--border-color)",
              borderRadius: "6px",
              backgroundColor: "var(--bg-panel)",
            }}
          >
            No criteria available. Click &quot;+ Add Criterion&quot;.
          </div>
        )}
      </div>
    </div>
  );
}
