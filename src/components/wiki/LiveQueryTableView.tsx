"use client";

import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from "lucide-react";
import type { QueryRecord } from "../../utils/query/queryTypes";
import { QueryPriorityPill, QueryStatusPill } from "./LiveQueryPills";

export interface LiveQueryTableViewProps {
  records: QueryRecord[];
  isEn: boolean;
  activeSortField: string;
  activeSortDir: "asc" | "desc";
  showPriorityColumn: boolean;
  showPointsColumn: boolean;
  onToggleSort: (field: string) => void;
  onOpenFile: (path: string) => void;
}

export function LiveQueryTableView({
  records,
  isEn,
  activeSortField,
  activeSortDir,
  showPriorityColumn,
  showPointsColumn,
  onToggleSort,
  onOpenFile,
}: LiveQueryTableViewProps) {
  const thStyle: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "var(--text-muted)",
    backgroundColor: "var(--bg-sidebar)",
    borderBottom: "1px solid var(--border-color)",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: "12.5px",
    borderBottom: "1px solid var(--border-color)",
    verticalAlign: "middle",
  };

  const renderSortIcon = (field: string) => {
    if (activeSortField !== field) {
      return <ArrowUpDown size={11} style={{ opacity: 0.45, flexShrink: 0 }} />;
    }
    return activeSortDir === "asc" ? (
      <ArrowUp
        size={11}
        style={{ color: "var(--accent-indigo)", flexShrink: 0 }}
      />
    ) : (
      <ArrowDown
        size={11}
        style={{ color: "var(--accent-indigo)", flexShrink: 0 }}
      />
    );
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}
      >
        <thead>
          <tr>
            <th style={thStyle} onClick={() => onToggleSort("id")}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                ID {renderSortIcon("id")}
              </span>
            </th>
            <th style={thStyle} onClick={() => onToggleSort("title")}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {isEn ? "Title" : "Titel"} {renderSortIcon("title")}
              </span>
            </th>
            <th style={thStyle} onClick={() => onToggleSort("type")}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {isEn ? "Type" : "Typ"} {renderSortIcon("type")}
              </span>
            </th>
            <th style={thStyle} onClick={() => onToggleSort("status")}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                Status {renderSortIcon("status")}
              </span>
            </th>
            {showPriorityColumn && (
              <th style={thStyle} onClick={() => onToggleSort("priority")}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  {isEn ? "Priority" : "Priorität"}{" "}
                  {renderSortIcon("priority")}
                </span>
              </th>
            )}
            {showPointsColumn && (
              <th
                style={{ ...thStyle, textAlign: "right" }}
                onClick={() => onToggleSort("story_points")}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  SP {renderSortIcon("story_points")}
                </span>
              </th>
            )}
            <th style={thStyle} onClick={() => onToggleSort("assignee")}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {isEn ? "Owner" : "Verantwortlich"}{" "}
                {renderSortIcon("assignee")}
              </span>
            </th>
            <th style={thStyle} onClick={() => onToggleSort("updated_at")}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {isEn ? "Context / Date" : "Kontext / Datum"}{" "}
                {renderSortIcon("updated_at")}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((rec) => (
            <tr
              key={`${rec.path}::${rec.id}`}
              style={{
                backgroundColor: "transparent",
                transition: "background-color 0.15s",
              }}
            >
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                <button
                  type="button"
                  onClick={() => onOpenFile(rec.path)}
                  style={{
                    background: "rgba(99, 102, 241, 0.12)",
                    border: "1px solid rgba(99, 102, 241, 0.3)",
                    color: "#a5b4fc",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title={rec.path}
                >
                  {rec.id}
                  <ExternalLink size={10} />
                </button>
              </td>
              <td style={tdStyle}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  <span
                    onClick={() => onOpenFile(rec.path)}
                    style={{
                      color: "var(--text-primary)",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {rec.title}
                  </span>
                  {rec.labels.length > 0 && (
                    <div
                      style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}
                    >
                      {rec.labels.map((lbl) => (
                        <span
                          key={lbl}
                          style={{
                            fontSize: "10px",
                            padding: "1px 5px",
                            borderRadius: "3px",
                            backgroundColor: "var(--bg-active)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          #{lbl}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </td>
              <td style={tdStyle}>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {rec.type}
                </span>
              </td>
              <td style={tdStyle}>
                <QueryStatusPill
                  status={rec.status}
                  isBlocked={rec.blockedBy.length > 0}
                  isEn={isEn}
                />
              </td>
              {showPriorityColumn && (
                <td style={tdStyle}>
                  <QueryPriorityPill priority={rec.priority} />
                </td>
              )}
              {showPointsColumn && (
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    color:
                      rec.storyPoints > 0
                        ? "var(--text-primary)"
                        : "var(--text-muted)",
                  }}
                >
                  {rec.storyPoints > 0 ? String(rec.storyPoints) : "–"}
                </td>
              )}
              <td
                style={{
                  ...tdStyle,
                  color: "var(--text-secondary)",
                  fontSize: "12px",
                }}
              >
                {rec.assignee || "–"}
              </td>
              <td
                style={{
                  ...tdStyle,
                  color: "var(--text-muted)",
                  fontSize: "11.5px",
                  whiteSpace: "nowrap",
                }}
              >
                {rec.epic || rec.milestone || rec.sprint || rec.updatedAt || "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
