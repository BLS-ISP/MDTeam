"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import type { PaletteEntry } from "./paletteEntries";

export interface PaletteResultsListProps {
  isEn: boolean;
  filteredEntries: PaletteEntry[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}

export function PaletteResultsList({
  isEn,
  filteredEntries,
  activeIndex,
  onActiveIndexChange,
  listRef,
}: PaletteResultsListProps) {
  const renderGroupHeader = (label: string) => (
    <div
      style={{
        padding: "8px 14px 4px",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.7px",
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}
    >
      {label}
    </div>
  );

  let lastGroup: string | null = null;

  return (
    <div
      ref={listRef}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "6px 0 10px",
      }}
    >
      {filteredEntries.length === 0 ? (
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "13px",
          }}
        >
          {isEn
            ? "No matching commands, issues, or documents found."
            : "Keine passenden Befehle, Issues oder Dokumente gefunden."}
        </div>
      ) : (
        filteredEntries.map((entry, idx) => {
          const showHeader = entry.group !== lastGroup;
          lastGroup = entry.group;
          const isSelected = idx === activeIndex;

          const groupTitle =
            entry.group === "action"
              ? isEn
                ? "Quick Actions"
                : "Schnellaktionen"
              : entry.group === "issue"
                ? isEn
                  ? "Agile Issues"
                  : "Agile Issues & Tickets"
                : isEn
                  ? "Knowledge Base (Wiki, arc42, ADRs)"
                  : "Wissensdatenbank (Wiki, arc42, ADRs)";

          return (
            <React.Fragment key={entry.id}>
              {showHeader && renderGroupHeader(groupTitle)}
              <div
                onMouseEnter={() => onActiveIndexChange(idx)}
                onClick={() => entry.onTrigger()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  margin: "2px 8px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  backgroundColor: isSelected ? "var(--bg-active)" : "transparent",
                  borderLeft: isSelected
                    ? "2px solid var(--accent-indigo)"
                    : "2px solid transparent",
                  transition: "background-color 0.1s",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg-panel)",
                    border: "1px solid var(--border-color)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {entry.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {entry.secondaryBadge && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          backgroundColor: "rgba(99, 102, 241, 0.14)",
                          color: "var(--accent-indigo)",
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {entry.secondaryBadge}
                      </span>
                    )}
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.title}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.subtitle}
                  </div>
                </div>

                {entry.badgeText && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: "999px",
                      backgroundColor:
                        entry.badgeColors?.bg || "rgba(255, 255, 255, 0.06)",
                      color: entry.badgeColors?.fg || "var(--text-secondary)",
                      flexShrink: 0,
                    }}
                  >
                    {entry.badgeText}
                  </span>
                )}

                <ArrowRight
                  size={13}
                  style={{
                    color: isSelected ? "var(--accent-indigo)" : "transparent",
                    flexShrink: 0,
                  }}
                />
              </div>
            </React.Fragment>
          );
        })
      )}
    </div>
  );
}
