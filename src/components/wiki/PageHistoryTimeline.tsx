"use client";

import React from "react";
import { Clock, GitCommit } from "lucide-react";
import type { PageVersionEntry } from "./wikiTypes";

export function PageHistoryTimeline({
  versions,
  selectedId,
  loadingList,
  isEn,
  onSelectVersion,
}: {
  versions: PageVersionEntry[];
  selectedId: string;
  loadingList: boolean;
  isEn: boolean;
  onSelectVersion: (id: string) => void;
}) {
  return (
    <div
      style={{
        width: "300px",
        borderRight: "1px solid var(--border-color)",
        backgroundColor: "var(--bg-sidebar)",
        overflowY: "auto",
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      {loadingList ? (
        <div
          style={{
            padding: "20px",
            fontSize: "12px",
            color: "var(--text-muted)",
          }}
        >
          {isEn ? "Loading history..." : "Lade Versionsverlauf..."}
        </div>
      ) : versions.length === 0 ? (
        <div
          style={{
            padding: "20px",
            fontSize: "12px",
            color: "var(--text-muted)",
          }}
        >
          {isEn
            ? "No snapshots recorded yet."
            : "Noch keine Versionen aufgezeichnet."}
        </div>
      ) : (
        versions.map((ver) => {
          const active = ver.id === selectedId;
          return (
            <button
              key={ver.id}
              type="button"
              onClick={() => onSelectVersion(ver.id)}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: "8px",
                border: active
                  ? "1px solid var(--accent-indigo)"
                  : "1px solid var(--border-color)",
                backgroundColor: active
                  ? "rgba(99, 102, 241, 0.14)"
                  : "var(--bg-panel)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "6px",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    fontWeight: 700,
                    color:
                      ver.source === "git" ? "#a5b4fc" : "var(--accent-green)",
                  }}
                >
                  <GitCommit size={12} />
                  {ver.commitHash}
                </span>
                <span
                  style={{
                    fontSize: "9.5px",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: "4px",
                    backgroundColor: "var(--bg-active)",
                    color: "var(--text-muted)",
                  }}
                >
                  {ver.source}
                </span>
              </div>

              <div
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {ver.message}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "10.5px",
                  color: "var(--text-muted)",
                }}
              >
                <span>{ver.author}</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  <Clock size={10} />
                  {ver.date}
                </span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
