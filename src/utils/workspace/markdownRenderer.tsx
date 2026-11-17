"use client";

import React from "react";
import { LiveQueryBlock } from "../queryMacro";
import type { WorkspaceFile } from "../issueEngine";
import type { WorkspaceLanguage } from "../../constants/translations";
import {
  MermaidElement,
  parseInlineMarkdown,
  formatInlineMarkdownText,
  renderYamlMetadataCard,
  type InlineMarkdownOptions,
} from "./markdownInlineAndMermaid";
import { renderTransclusionCard } from "./markdownTransclusionCard";

export { MermaidElement, parseInlineMarkdown, formatInlineMarkdownText, type InlineMarkdownOptions };

export interface MarkdownRenderOptions {
  files: WorkspaceFile[];
  activeFilePath: string;
  language: WorkspaceLanguage;
  onOpenFile: (filePath: string, lineRange?: string) => void;
  onOpenFileFromQuery?: (filePath: string) => void;
}

export function parseMarkdown(markdown: string, options: MarkdownRenderOptions): React.ReactNode[] {
  const { files, activeFilePath, language, onOpenFile, onOpenFileFromQuery } = options;
  const inlineOpts: InlineMarkdownOptions = { activeFilePath, onOpenFile };

  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];

  let inYamlBlock = false;
  let yamlLines: string[] = [];

  let inDetails = false;
  let detailsSummary = "";
  let detailsContent: string[] = [];

  let inCode = false;
  let codeType = "";
  let accumulatedCode = "";

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  let listType: "ul" | "ol" | null = null;
  let listItems: React.ReactNode[] = [];

  const flushList = (key: string | number) => {
    if (listType && listItems.length > 0) {
      const items = [...listItems];
      const type = listType;
      listType = null;
      listItems = [];
      if (type === "ul") {
        elements.push(
          <ul key={`ul-${key}`} style={{ marginBottom: "16px", paddingLeft: "20px", listStyleType: "disc" }}>
            {items}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${key}`} style={{ marginBottom: "16px", paddingLeft: "20px", listStyleType: "decimal" }}>
            {items}
          </ol>
        );
      }
    }
  };

  const flushTable = (key: string | number) => {
    if (tableHeaders.length > 0) {
      const headers = [...tableHeaders];
      const rows = [...tableRows];
      tableHeaders = [];
      tableRows = [];
      elements.push(
        <table key={`table-${key}`}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{parseInlineMarkdown(h, inlineOpts)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx}>{parseInlineMarkdown(cell, inlineOpts)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Details Block check
    if (trimmed.startsWith("<details>")) {
      flushList(i);
      flushTable(i);
      inDetails = true;
      detailsSummary = "";
      detailsContent = [];
      continue;
    }

    if (inDetails) {
      if (trimmed.startsWith("</details>")) {
        inDetails = false;
        const summaryText = detailsSummary;
        const contentText = detailsContent.join("\n");
        detailsSummary = "";
        detailsContent = [];

        elements.push(
          <details
            key={`details-${i}`}
            style={{
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "8px 12px",
              margin: "12px 0",
              backgroundColor: "var(--bg-sidebar)",
            }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 600, outline: "none", color: "var(--text-primary)" }}>
              {parseInlineMarkdown(summaryText || "Details einblenden", inlineOpts)}
            </summary>
            <div
              style={{
                marginTop: "8px",
                paddingLeft: "12px",
                borderLeft: "2px solid var(--border-color)",
                color: "var(--text-secondary)",
              }}
            >
              {parseMarkdown(contentText, options)}
            </div>
          </details>
        );
        continue;
      }

      const summaryMatch = line.match(/<summary>(.*?)<\/summary>/i);
      if (summaryMatch) {
        detailsSummary = summaryMatch[1];
      } else {
        detailsContent.push(line);
      }
      continue;
    }

    // Quoting / Reference transclusion check: @[path/to/file.md#L10-L15]
    const transclusionMatch = trimmed.match(/^@\[(.*?)(?:#(L\d+(?:-\d+)?))?\]$/i);
    if (transclusionMatch) {
      flushList(i);
      flushTable(i);
      const refPath = transclusionMatch[1];
      const hash = transclusionMatch[2] || "";
      const lineRange = hash && hash.startsWith("L") ? hash.substring(1) : "";
      elements.push(renderTransclusionCard(refPath, lineRange, files, `transclude-${i}`, onOpenFile));
      continue;
    }

    // YAML Block Checking
    if (trimmed === "---" && !inCode) {
      if (inYamlBlock) {
        inYamlBlock = false;
        const card = renderYamlMetadataCard(yamlLines, `yaml-card-${i}`, language);
        if (card) {
          elements.push(card);
        }
        continue;
      }

      let isYaml = false;
      let matchIndex = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === "---") {
          matchIndex = j;
          break;
        }
      }

      if (matchIndex !== -1) {
        isYaml = true;
        for (let j = i + 1; j < matchIndex; j++) {
          const midLine = lines[j].trim();
          if (midLine !== "" && !midLine.includes(":") && !midLine.startsWith("-")) {
            isYaml = false;
            break;
          }
        }
      }

      if (isYaml) {
        flushList(i);
        flushTable(i);
        inYamlBlock = true;
        yamlLines = [];
        continue;
      }
    }

    if (inYamlBlock) {
      yamlLines.push(line);
      continue;
    }

    // Code Block Toggle
    if (trimmed.startsWith("```")) {
      flushList(i);
      flushTable(i);
      if (inCode) {
        inCode = false;
        const currentCode = accumulatedCode;
        const currentType = codeType;
        accumulatedCode = "";
        codeType = "";

        if (currentType === "mermaid") {
          elements.push(<MermaidElement key={`mermaid-${i}`} chart={currentCode} />);
        } else if (currentType === "query" || currentType === "jql") {
          elements.push(
            <LiveQueryBlock
              key={`query-${i}`}
              queryText={currentCode}
              files={files}
              onOpenFile={(targetPath) => {
                if (onOpenFileFromQuery) {
                  onOpenFileFromQuery(targetPath);
                } else {
                  onOpenFile(targetPath);
                }
              }}
              language={language}
            />
          );
        } else if (currentType === "drawio") {
          const url = currentCode.trim();
          elements.push(
            <iframe
              key={`drawio-${i}`}
              src={url}
              title="Draw.io Diagram"
              style={{
                width: "100%",
                height: "450px",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                margin: "16px 0",
                backgroundColor: "#ffffff",
              }}
            />
          );
        } else {
          elements.push(
            <pre key={`code-${i}`}>
              <code>{currentCode}</code>
            </pre>
          );
        }
      } else {
        inCode = true;
        codeType = trimmed.substring(3).trim().toLowerCase();
      }
      continue;
    }

    if (inCode) {
      accumulatedCode += line + "\n";
      continue;
    }

    // Horizontal Rules
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      flushList(i);
      flushTable(i);
      elements.push(<hr key={`hr-${i}`} style={{ borderColor: "var(--border-color)", margin: "20px 0" }} />);
      continue;
    }

    // Tables
    if (trimmed.startsWith("|")) {
      flushList(i);
      inTable = true;
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c !== "");
      if (cells.every((c) => c.startsWith(":") || c.startsWith("-"))) {
        continue;
      }
      if (tableHeaders.length === 0) {
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      inTable = false;
      flushTable(i);
    }

    // Headers
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      flushList(i);
      flushTable(i);
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      elements.push(<Tag key={i}>{parseInlineMarkdown(text, inlineOpts)}</Tag>);
      continue;
    }

    // Checklists
    const checklistMatch = line.match(/^(\s*)[-*]\s+\[([ x])\]\s*(.*)$/i);
    if (checklistMatch) {
      flushList(i);
      flushTable(i);
      const isChecked = checklistMatch[2].toLowerCase() === "x";
      const text = checklistMatch[3];
      elements.push(
        <div className="task-list-item" key={i} style={{ paddingLeft: `${checklistMatch[1].length * 10}px` }}>
          <input type="checkbox" className="task-list-checkbox" readOnly checked={isChecked} />
          <span style={isChecked ? { textDecoration: "line-through", color: "var(--text-muted)" } : undefined}>
            {parseInlineMarkdown(text, inlineOpts)}
          </span>
        </div>
      );
      continue;
    }

    // Unordered Lists
    if ((trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("+ ")) && !checklistMatch) {
      flushTable(i);
      if (listType !== "ul") {
        flushList(i);
        listType = "ul";
      }
      const content = trimmed.replace(/^[*+-]\s*/, "");
      listItems.push(<li key={`li-${i}`}>{parseInlineMarkdown(content, inlineOpts)}</li>);
      continue;
    }

    // Ordered Lists
    const orderedListMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedListMatch) {
      flushTable(i);
      if (listType !== "ol") {
        flushList(i);
        listType = "ol";
      }
      const content = orderedListMatch[1];
      listItems.push(<li key={`li-${i}`}>{parseInlineMarkdown(content, inlineOpts)}</li>);
      continue;
    }

    // Blockquotes
    if (trimmed.startsWith(">")) {
      flushList(i);
      flushTable(i);
      elements.push(<blockquote key={i}>{parseInlineMarkdown(trimmed.replace(/^>\s*/, ""), inlineOpts)}</blockquote>);
      continue;
    }

    // Empty Lines
    if (trimmed === "") {
      flushList(i);
      flushTable(i);
      elements.push(<br key={i} />);
      continue;
    }

    // Paragraph
    flushList(i);
    flushTable(i);
    elements.push(<p key={i}>{parseInlineMarkdown(line, inlineOpts)}</p>);
  }

  flushTable("end");
  flushList("end");
  return elements;
}
