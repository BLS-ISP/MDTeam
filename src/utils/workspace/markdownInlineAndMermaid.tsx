"use client";

import React, { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";
import { ArrowRight, Calendar } from "lucide-react";
import type { WorkspaceLanguage } from "../../constants/translations";

// Initialize mermaid on client side
if (typeof window !== "undefined") {
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "loose",
    fontFamily: "var(--font-sans)",
  });
}

export const MermaidElement = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const cleanChart = chart.trim();
        const { svg: renderedSvg } = await mermaid.render(id, cleanChart);
        if (isMounted) {
          setSvg(renderedSvg);
          setError("");
        }
      } catch (err: any) {
        console.error("Mermaid render error:", err);
        if (isMounted) {
          setError("Fehler beim Rendern des Diagramms.");
        }
        const badElements = document.querySelectorAll('[id^="dmermaid-"]');
        badElements.forEach((el) => el.remove());
      }
    };

    renderChart();
    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (error) {
    return (
      <div
        style={{
          padding: "8px 12px",
          border: "1px solid var(--accent-red)",
          borderRadius: "6px",
          fontSize: "12px",
          color: "var(--accent-red)",
          backgroundColor: "rgba(239, 68, 68, 0.05)",
          margin: "12px 0",
        }}
      >
        <span>{error}</span>
        <pre style={{ fontSize: "10px", marginTop: "4px", background: "transparent", border: "none", padding: 0 }}>
          {chart}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Rendere Diagramm...</div>;
  }

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: svg }} style={{ margin: "16px 0", overflowX: "auto" }} />;
};

export function formatInlineMarkdownText(text: string): string {
  let formatted = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/__(.*?)__/g, "<strong>$1</strong>");
  formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
  formatted = formatted.replace(/_(.*?)_/g, "<em>$1</em>");
  formatted = formatted.replace(/~~(.*?)~~/g, "<del>$1</del>");
  formatted = formatted.replace(
    /==(.*?)==/g,
    "<mark style='background-color: rgba(99, 102, 241, 0.3); color: var(--text-primary); padding: 0 4px; border-radius: 3px;'>$1</mark>"
  );
  formatted = formatted.replace(/`(.*?)`/g, "<code>$1</code>");
  return formatted;
}

export interface InlineMarkdownOptions {
  activeFilePath: string;
  onOpenFile: (filePath: string, lineRange?: string) => void;
}

export function parseInlineMarkdown(text: string, options: InlineMarkdownOptions): React.ReactNode[] {
  const tokenRegex = /(!)?\[(.*?)\]\((.*?)\)/g;
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  tokenRegex.lastIndex = 0;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      segments.push(
        <span
          key={`text-${keyIdx++}`}
          dangerouslySetInnerHTML={{ __html: formatInlineMarkdownText(text.substring(lastIndex, matchIndex)) }}
        />
      );
    }

    const isImage = match[1] === "!";
    const linkText = match[2];
    const linkUrl = match[3];

    if (isImage) {
      if (linkUrl.includes("diagrams.net") || linkUrl.includes("draw.io")) {
        segments.push(
          <iframe
            key={`drawio-${keyIdx++}`}
            src={linkUrl}
            title={linkText || "Draw.io Diagram"}
            style={{
              width: "100%",
              height: "400px",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              margin: "12px 0",
              backgroundColor: "#ffffff",
            }}
          />
        );
      } else {
        segments.push(
          <img
            key={`img-${keyIdx++}`}
            src={linkUrl}
            alt={linkText}
            style={{ maxWidth: "100%", height: "auto", borderRadius: "6px", margin: "8px 0", display: "block" }}
          />
        );
      }
    } else if (linkUrl.startsWith("file:///") || linkUrl.includes(".md") || linkUrl.startsWith("#L")) {
      const cleanPath = linkUrl.replace("file:///", "");
      let filePath = "";
      let hash = "";

      if (cleanPath.startsWith("#L")) {
        filePath = options.activeFilePath;
        hash = cleanPath;
      } else {
        const parts = cleanPath.split("#");
        filePath = parts[0];
        hash = parts[1] || "";
      }

      const lineRange = hash && hash.startsWith("L") ? hash.substring(1) : "";

      segments.push(
        <a
          key={`link-${keyIdx++}`}
          href="#"
          onClick={(e) => {
            e.preventDefault();
            options.onOpenFile(filePath, lineRange || undefined);
          }}
          style={{ color: "var(--accent-indigo)", textDecoration: "underline", fontWeight: 500 }}
          title={`Öffne Datei: ${filePath}${lineRange ? ` (Zeile ${lineRange})` : ""}`}
        >
          {linkText}
        </a>
      );
    } else {
      segments.push(
        <a
          key={`link-${keyIdx++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent-blue)", textDecoration: "underline" }}
        >
          {linkText}
        </a>
      );
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push(
      <span
        key={`text-${keyIdx++}`}
        dangerouslySetInnerHTML={{ __html: formatInlineMarkdownText(text.substring(lastIndex)) }}
      />
    );
  }

  return segments;
}

export function renderYamlMetadataCard(
  yamlLines: string[],
  cardKey: string,
  language: WorkspaceLanguage
): React.ReactNode | null {
  const data: Record<string, string> = {};
  yamlLines.forEach((l) => {
    const pts = l.split(":");
    if (pts.length >= 2) {
      const k = pts[0].trim();
      const v = pts.slice(1).join(":").trim().replace(/"/g, "").replace(/'/g, "");
      data[k] = v;
    }
  });

  if (Object.keys(data).length === 0) return null;

  const isIssueCard = Boolean(data.id && data.type);
  const isSprintCard = Boolean(data.state && (data.goal || data.committed_points));
  const isWikiMetaOnly = Boolean(data.review_status && !data.milestone && !isIssueCard && !isSprintCard);

  const statusColors: Record<string, { bg: string; text: string }> = {
    completed: { bg: "rgba(16, 185, 129, 0.15)", text: "var(--accent-green)" },
    done: { bg: "rgba(16, 185, 129, 0.15)", text: "var(--accent-green)" },
    approved: { bg: "rgba(16, 185, 129, 0.15)", text: "var(--accent-green)" },
    accepted: { bg: "rgba(16, 185, 129, 0.15)", text: "var(--accent-green)" },
    active: { bg: "rgba(59, 130, 246, 0.15)", text: "var(--accent-blue)" },
    "in-progress": { bg: "rgba(59, 130, 246, 0.15)", text: "var(--accent-blue)" },
    review: { bg: "rgba(245, 158, 11, 0.16)", text: "var(--accent-yellow)" },
    "in-review": { bg: "rgba(245, 158, 11, 0.16)", text: "var(--accent-yellow)" },
    ready: { bg: "rgba(168, 85, 247, 0.16)", text: "#a855f7" },
    pending: { bg: "rgba(107, 114, 128, 0.15)", text: "var(--text-muted)" },
    backlog: { bg: "rgba(107, 114, 128, 0.15)", text: "var(--text-muted)" },
    draft: { bg: "rgba(245, 158, 11, 0.14)", text: "var(--accent-yellow)" },
  };

  const currentStatus = (data.status || data.state || data.review_status || "pending").toLowerCase();
  const colors = data.color
    ? { bg: `color-mix(in srgb, ${data.color.trim()} 15%, transparent)`, text: data.color.trim() }
    : statusColors[currentStatus] || statusColors.pending;

  const cardHeaderLabel = isIssueCard
    ? `${data.id} • ${(data.type || "issue").toUpperCase()}${data.story_points ? ` • ${data.story_points} SP` : ""}`
    : isSprintCard
      ? language === "en"
        ? "Agile Sprint Metadata"
        : "Agile Sprint-Metadaten"
      : isWikiMetaOnly
        ? language === "en"
          ? "Confluence Page Governance"
          : "Confluence Seiten-Governance"
        : language === "en"
          ? "Milestone / Roadmap Data"
          : "Meilenstein / Roadmap-Daten";

  return (
    <div
      key={cardKey}
      style={{
        border: "1px solid var(--border-color)",
        borderLeft: `4px solid ${colors.text}`,
        borderRadius: "8px",
        padding: "12px 16px",
        backgroundColor: "var(--bg-sidebar)",
        margin: "16px 0",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--accent-indigo)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          <Calendar size={12} />
          <span>{cardHeaderLabel}</span>
        </div>
        <span
          style={{
            fontSize: "9px",
            padding: "2px 8px",
            borderRadius: "4px",
            fontWeight: 700,
            backgroundColor: colors.bg,
            color: colors.text,
          }}
        >
          {currentStatus.toUpperCase()}
        </span>
      </div>
      {(data.title || data.name) && (
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
          {data.title || data.name}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: "12px", color: "var(--text-secondary)" }}>
        {data.milestone && (
          <div>
            <span style={{ color: "var(--text-muted)" }}>{language === "en" ? "Milestone:" : "Meilenstein:"}</span> {data.milestone}
          </div>
        )}
        {data.priority && (
          <div>
            <span style={{ color: "var(--text-muted)" }}>{language === "en" ? "Priority:" : "Priorität:"}</span> {data.priority.toUpperCase()}
          </div>
        )}
        {data.assignee && (
          <div>
            <span style={{ color: "var(--text-muted)" }}>{language === "en" ? "Assignee:" : "Zuständig:"}</span> {data.assignee}
          </div>
        )}
        {data.sprint && (
          <div>
            <span style={{ color: "var(--text-muted)" }}>Sprint:</span> {data.sprint}
          </div>
        )}
        {data.epic && (
          <div>
            <span style={{ color: "var(--text-muted)" }}>Epic:</span> {data.epic}
          </div>
        )}
        {data.branch && (
          <div>
            <span style={{ color: "var(--text-muted)" }}>Branch:</span> <code>{data.branch}</code>
          </div>
        )}
        {data.approved_by && (
          <div>
            <span style={{ color: "var(--text-muted)" }}>{language === "en" ? "Approved by:" : "Freigegeben von:"}</span> {data.approved_by}
          </div>
        )}
        {data.committed_points && (
          <div>
            <span style={{ color: "var(--text-muted)" }}>Committed SP:</span> {data.committed_points} SP
          </div>
        )}
        {data.start_date && data.end_date && (
          <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
            <span style={{ color: "var(--text-muted)" }}>{language === "en" ? "Timeline:" : "Zeitraum:"}</span>
            <span style={{ fontWeight: 500 }}>{data.start_date}</span>
            <ArrowRight size={12} style={{ color: "var(--text-muted)", margin: "0 4px" }} />
            <span style={{ fontWeight: 500 }}>{data.end_date}</span>
          </div>
        )}
      </div>
    </div>
  );
}
