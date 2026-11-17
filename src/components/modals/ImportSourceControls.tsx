"use client";

import React, { useRef } from "react";
import { Upload, Sparkles, Code, BookOpen, FileSpreadsheet } from "lucide-react";
import type { AtlassianSourceType } from "./modalTypesAndBadges";

export interface ImportSourceControlsProps {
  isEn: boolean;
  sourceType: AtlassianSourceType;
  projectPrefix: string;
  onProjectPrefixChange: (value: string) => void;
  onSwitchSource: (nextSource: AtlassianSourceType) => void;
  onLoadSampleJira: () => void;
  onLoadSampleConfluence: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ImportSourceControls({
  isEn,
  sourceType,
  projectPrefix,
  onProjectPrefixChange,
  onSwitchSource,
  onLoadSampleJira,
  onLoadSampleConfluence,
  onFileUpload,
}: ImportSourceControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Step 1: Choose Source */}
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.6px",
            color: "var(--text-muted)",
            marginBottom: "8px",
          }}
        >
          {isEn ? "Step 1 — Select Export Format" : "Schritt 1 — Export-Format wählen"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          {(
            [
              {
                id: "jira-csv",
                title: "Jira CSV (.csv)",
                desc: isEn
                  ? "RFC-4180 CSV export with Epics, Story Points & Comments"
                  : "RFC-4180 CSV-Export inkl. Epics, Story Points & Kommentaren",
                icon: <FileSpreadsheet size={18} style={{ color: "var(--accent-blue)" }} />,
              },
              {
                id: "jira-json",
                title: "Jira REST JSON (.json)",
                desc: isEn
                  ? "REST search export including Atlassian Document Format (ADF)"
                  : "Jira REST-Export inkl. Atlassian Document Format (ADF)",
                icon: <Code size={18} style={{ color: "var(--accent-indigo)" }} />,
              },
              {
                id: "confluence",
                title: "Confluence (.html / .md)",
                desc: isEn
                  ? "HTML or Markdown pages with macros, tables & code blocks"
                  : "HTML- oder Markdown-Seiten inkl. Makros, Tabellen & Code",
                icon: <BookOpen size={18} style={{ color: "var(--accent-green)" }} />,
              },
            ] as const
          ).map((opt) => {
            const active = sourceType === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => onSwitchSource(opt.id)}
                style={{
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${active ? "var(--accent-indigo)" : "var(--border-color)"}`,
                  backgroundColor: active ? "rgba(99, 102, 241, 0.1)" : "var(--bg-panel)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontWeight: 600,
                    fontSize: "13px",
                    color: "var(--text-primary)",
                  }}
                >
                  {opt.icon}
                  <span>{opt.title}</span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.35 }}>
                  {opt.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 2: Upload or 1-Click Sample */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "14px 16px",
          borderRadius: "8px",
          backgroundColor: "var(--bg-panel)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple={sourceType === "confluence"}
            accept={
              sourceType === "jira-csv"
                ? ".csv,text/csv"
                : sourceType === "jira-json"
                  ? ".json,application/json"
                  : ".html,.htm,.xhtml,.md,.markdown"
            }
            onChange={onFileUpload}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "7px 13px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-sidebar)",
              color: "var(--text-primary)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Upload size={14} style={{ color: "var(--accent-indigo)" }} />
            {isEn ? "Choose File(s) from Disk" : "Datei(en) von Festplatte wählen"}
          </button>

          <button
            type="button"
            onClick={onLoadSampleJira}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(59, 130, 246, 0.35)",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              color: "var(--accent-blue)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Sparkles size={13} />
            {isEn ? "Load Sample Jira Export" : "Beispiel-Jira-Export laden"}
          </button>

          <button
            type="button"
            onClick={onLoadSampleConfluence}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              color: "var(--accent-green)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <BookOpen size={13} />
            {isEn ? "Load Sample Confluence Page" : "Beispiel-Confluence-Seite laden"}
          </button>
        </div>

        {sourceType !== "confluence" && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
              {isEn ? "Key Prefix:" : "Key-Präfix:"}
            </label>
            <input
              type="text"
              value={projectPrefix}
              onChange={(e) => onProjectPrefixChange(e.target.value)}
              placeholder={isEn ? "Keep original (or e.g. MDT)" : "Original (oder z.B. MDT)"}
              style={{
                width: "165px",
                padding: "5px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-sidebar)",
                color: "var(--text-primary)",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
