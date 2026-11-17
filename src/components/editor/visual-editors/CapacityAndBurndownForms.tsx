"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { useWorkspaceContext } from "../../../context/WorkspaceContext";
import {
  parseVelocityData,
  parseCapacityData,
  serializeCapacityData,
  parseBurndownData,
  serializeBurndownData,
  type VelocityItem,
  type CapacityItem,
  type BurndownDataPoint,
} from "../../../utils/workspace/agileMarkdownParsers";

export function CapacityVisualForm() {
  const { files, updateMarkdownFileContent } = useWorkspaceContext();
  const velocity = parseVelocityData(files);
  const capacity = parseCapacityData(files);

  const saveCapacity = (nextVelocity: VelocityItem[], nextCapacity: CapacityItem[]) => {
    updateMarkdownFileContent("management/capacity.md", serializeCapacityData(nextVelocity, nextCapacity));
  };

  const handleVelocityChange = (index: number, field: keyof VelocityItem, value: any) => {
    const updatedVelocity = [...velocity];
    updatedVelocity[index] = { ...updatedVelocity[index], [field]: value };
    saveCapacity(updatedVelocity, capacity);
  };

  const handleCapacityChange = (index: number, field: keyof CapacityItem, value: any) => {
    const updatedCapacity = [...capacity];
    const item = { ...updatedCapacity[index], [field]: value };
    if (field === "days" || field === "focus") {
      item.capacity = Number(item.days) * Number(item.focus);
    }
    updatedCapacity[index] = item;
    saveCapacity(velocity, updatedCapacity);
  };

  const handleAddVelocity = () => {
    const nextSprintNum = velocity.length + 1;
    saveCapacity([...velocity, { sprint: `Sprint ${nextSprintNum}`, planned: 0, actual: 0 }], capacity);
  };

  const handleDeleteVelocity = (index: number) => {
    saveCapacity(
      velocity.filter((_, idx) => idx !== index),
      capacity
    );
  };

  const handleAddCapacity = () => {
    saveCapacity(velocity, [...capacity, { member: "@new-member", days: 10, focus: 0.8, capacity: 8.0 }]);
  };

  const handleDeleteCapacity = (index: number) => {
    saveCapacity(
      velocity,
      capacity.filter((_, idx) => idx !== index)
    );
  };

  return (
    <div className="visual-form-container" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: "12px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "18px", margin: 0 }}>Historical Velocity</h3>
            <p style={{ fontSize: "13px", margin: "4px 0 0 0" }}>
              Adjust planned and actual Story Points of past sprints.
            </p>
          </div>
          <button className="visual-add-btn" onClick={handleAddVelocity} style={{ padding: "8px 14px", fontSize: "13px" }}>
            <Plus size={14} /> Add Sprint
          </button>
        </div>
        <table
          className="visual-table"
          style={{
            width: "100%",
            borderCollapse: "collapse",
            backgroundColor: "var(--bg-panel)",
            borderRadius: "8px",
            border: "1px solid var(--border-color)",
            overflow: "hidden",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid var(--border-color)" }}>
              <th style={{ padding: "12px", textAlign: "left" }}>Sprint Name</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Planned (SP)</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Actual (SP)</th>
              <th style={{ padding: "12px", textAlign: "center", width: "80px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {velocity.map((v, idx) => (
              <tr key={idx} style={{ borderBottom: idx < velocity.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                <td style={{ padding: "12px" }}>
                  <input
                    type="text"
                    value={v.sprint}
                    onChange={(e) => handleVelocityChange(idx, "sprint", e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-editor)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      width: "100%",
                      maxWidth: "200px",
                      outline: "none",
                    }}
                  />
                </td>
                <td style={{ padding: "12px" }}>
                  <input
                    type="number"
                    value={v.planned}
                    onChange={(e) => handleVelocityChange(idx, "planned", parseFloat(e.target.value) || 0)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-editor)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      width: "120px",
                      outline: "none",
                    }}
                  />
                </td>
                <td style={{ padding: "12px" }}>
                  <input
                    type="number"
                    value={v.actual}
                    onChange={(e) => handleVelocityChange(idx, "actual", parseFloat(e.target.value) || 0)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-editor)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      width: "120px",
                      outline: "none",
                    }}
                  />
                </td>
                <td style={{ padding: "12px", textAlign: "center" }}>
                  <button
                    onClick={() => handleDeleteVelocity(idx)}
                    className="visual-delete-btn"
                    style={{ width: "32px", height: "32px", display: "inline-flex", padding: 0 }}
                    title="Delete Sprint"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {velocity.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                  No velocity data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: "12px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "18px", margin: 0 }}>Team Capacity (Current Sprint)</h3>
            <p style={{ fontSize: "13px", margin: "4px 0 0 0" }}>
              Story points calculation based on available days and focus factor.
            </p>
          </div>
          <button className="visual-add-btn" onClick={handleAddCapacity} style={{ padding: "8px 14px", fontSize: "13px" }}>
            <Plus size={14} /> Add Member
          </button>
        </div>
        <table
          className="visual-table"
          style={{
            width: "100%",
            borderCollapse: "collapse",
            backgroundColor: "var(--bg-panel)",
            borderRadius: "8px",
            border: "1px solid var(--border-color)",
            overflow: "hidden",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid var(--border-color)" }}>
              <th style={{ padding: "12px", textAlign: "left" }}>Member</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Available Days</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Focus Factor</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Capacity (SP)</th>
              <th style={{ padding: "12px", textAlign: "center", width: "80px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {capacity.map((c, idx) => (
              <tr key={idx} style={{ borderBottom: idx < capacity.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                <td style={{ padding: "12px" }}>
                  <input
                    type="text"
                    value={c.member}
                    onChange={(e) => handleCapacityChange(idx, "member", e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-editor)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      width: "100%",
                      maxWidth: "200px",
                      outline: "none",
                    }}
                  />
                </td>
                <td style={{ padding: "12px" }}>
                  <input
                    type="number"
                    step="0.5"
                    value={c.days}
                    onChange={(e) => handleCapacityChange(idx, "days", parseFloat(e.target.value) || 0)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-editor)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      width: "100px",
                      outline: "none",
                    }}
                  />
                </td>
                <td style={{ padding: "12px" }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={c.focus}
                    onChange={(e) => handleCapacityChange(idx, "focus", parseFloat(e.target.value) || 0)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-editor)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      width: "100px",
                      outline: "none",
                    }}
                  />
                </td>
                <td style={{ padding: "12px", fontWeight: 600, color: "var(--accent-green)", fontSize: "14px" }}>
                  {c.capacity.toFixed(1)} SP
                </td>
                <td style={{ padding: "12px", textAlign: "center" }}>
                  <button
                    onClick={() => handleDeleteCapacity(idx)}
                    className="visual-delete-btn"
                    style={{ width: "32px", height: "32px", display: "inline-flex", padding: 0 }}
                    title="Delete Member"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {capacity.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                  No capacity data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BurndownVisualForm() {
  const { files, updateMarkdownFileContent } = useWorkspaceContext();
  const data = parseBurndownData(files);

  const saveBurndown = (updated: BurndownDataPoint[]) => {
    updateMarkdownFileContent("management/burndown.md", serializeBurndownData(updated));
  };

  const handleDataChange = (index: number, field: keyof BurndownDataPoint, value: any) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    saveBurndown(updated);
  };

  const handleAddDay = () => {
    const nextDay = data.length + 1;
    const lastIdeal = data.length > 0 ? data[data.length - 1].ideal : 60;
    const nextIdeal = Math.max(0, lastIdeal - 10);
    saveBurndown([...data, { day: `Day ${nextDay}`, ideal: nextIdeal, actual: null }]);
  };

  const handleDeleteDay = (index: number) => {
    const updated = data.filter((_, idx) => idx !== index);
    saveBurndown(updated.map((d, idx) => ({ ...d, day: `Day ${idx + 1}` })));
  };

  return (
    <div className="visual-form-container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "12px",
        }}
      >
        <div>
          <h3 style={{ fontSize: "18px", margin: 0 }}>Sprint Burndown Editor</h3>
          <p style={{ fontSize: "13px", margin: "4px 0 0 0" }}>
            Enter daily remaining efforts to update the burndown chart.
          </p>
        </div>
        <button className="visual-add-btn" onClick={handleAddDay} style={{ padding: "8px 14px", fontSize: "13px" }}>
          <Plus size={14} /> Add Day
        </button>
      </div>

      <table
        className="visual-table"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          backgroundColor: "var(--bg-panel)",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
          overflow: "hidden",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid var(--border-color)" }}>
            <th style={{ padding: "12px", textAlign: "left" }}>Sprint Day</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Ideal Value (Story Points)</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Actual Remaining Effort (Story Points)</th>
            <th style={{ padding: "12px", textAlign: "center", width: "80px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, idx) => (
            <tr key={idx} style={{ borderBottom: idx < data.length - 1 ? "1px solid var(--border-color)" : "none" }}>
              <td style={{ padding: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>{d.day}</td>
              <td style={{ padding: "12px" }}>
                <input
                  type="number"
                  value={d.ideal}
                  onChange={(e) => handleDataChange(idx, "ideal", parseFloat(e.target.value) || 0)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg-editor)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    width: "120px",
                    outline: "none",
                  }}
                />
              </td>
              <td style={{ padding: "12px" }}>
                <input
                  type="number"
                  value={d.actual === null ? "" : d.actual}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleDataChange(idx, "actual", val === "" ? null : parseFloat(val) || 0);
                  }}
                  placeholder="Not recorded yet"
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg-editor)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    width: "160px",
                    outline: "none",
                  }}
                />
              </td>
              <td style={{ padding: "12px", textAlign: "center" }}>
                <button
                  onClick={() => handleDeleteDay(idx)}
                  className="visual-delete-btn"
                  style={{ width: "32px", height: "32px", display: "inline-flex", padding: 0 }}
                  title="Delete Day"
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                No burndown data available. Click &quot;Add Day&quot;.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
