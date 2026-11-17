"use client";

import React from "react";
import {
  AlertTriangle,
  FileText,
  Map as MapIcon,
  Rocket,
  Sparkles,
  Users,
} from "lucide-react";
import type { WikiTemplateDefinition } from "./wikiTypes";

function renderTemplateIcon(id: string) {
  switch (id) {
    case "prd":
      return <FileText size={16} style={{ color: "var(--accent-indigo)" }} />;
    case "rfc":
      return <Sparkles size={16} style={{ color: "var(--accent-blue)" }} />;
    case "postmortem":
      return (
        <AlertTriangle size={16} style={{ color: "var(--accent-yellow)" }} />
      );
    case "release-notes":
      return <Rocket size={16} style={{ color: "var(--accent-green)" }} />;
    case "story-map":
      return <MapIcon size={16} style={{ color: "#c084fc" }} />;
    default:
      return <Users size={16} style={{ color: "#38bdf8" }} />;
  }
}

export function TemplateGallerySidebar({
  templates,
  selectedId,
  isEn,
  onSelectTemplate,
}: {
  templates: WikiTemplateDefinition[];
  selectedId: string;
  isEn: boolean;
  onSelectTemplate: (tpl: WikiTemplateDefinition) => void;
}) {
  return (
    <div
      style={{
        width: "340px",
        borderRight: "1px solid var(--border-color)",
        backgroundColor: "var(--bg-sidebar)",
        overflowY: "auto",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {templates.map((tpl) => {
        const active = tpl.id === selectedId;
        return (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelectTemplate(tpl)}
            style={{
              textAlign: "left",
              padding: "11px 12px",
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
              gap: "6px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {renderTemplateIcon(tpl.id)}
                {isEn ? tpl.name : tpl.nameDe}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: "4px",
                  backgroundColor: "var(--bg-active)",
                  color: "#a5b4fc",
                  textTransform: "uppercase",
                }}
              >
                {tpl.badge}
              </span>
            </div>
            <div
              style={{
                fontSize: "11.5px",
                color: "var(--text-secondary)",
                lineHeight: 1.4,
              }}
            >
              {isEn ? tpl.descriptionEn : tpl.descriptionDe}
            </div>
          </button>
        );
      })}
    </div>
  );
}
