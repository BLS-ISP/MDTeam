"use client";

import React from "react";
import {
  Bold,
  Box,
  Calendar,
  CheckSquare,
  ChevronDown,
  Code as CodeIcon,
  Database,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sparkles,
  Table as TableIcon,
} from "lucide-react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

export function EditorToolbar() {
  const { insertTemplateBlock, setShowCheatsheetModal } = useWorkspaceContext();

  return (
    <div className="editor-toolbar">
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("todo")} title="Aufgabe / Checkliste">
        <CheckSquare size={14} />
      </button>
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("table")} title="Tabelle einfügen">
        <TableIcon size={14} />
      </button>
      <button
        className="action-icon-btn"
        onClick={() => insertTemplateBlock("query")}
        title="Live Query Macro (Jira/ADR/Pages Tabelle) einfügen"
      >
        <Database size={14} style={{ color: "var(--accent-green)" }} />
      </button>
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("mermaid")} title="Mermaid UML Diagramm">
        <CodeIcon size={14} />
      </button>
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("drawio")} title="Draw.io Diagramm einfügen">
        <Box size={14} style={{ color: "var(--accent-indigo)" }} />
      </button>
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("adr")} title="ADR Architektur-Vorlage">
        <Sparkles size={14} />
      </button>
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("roadmap-item")} title="Roadmap-Meilenstein Block">
        <Calendar size={14} />
      </button>
      <button
        className="action-icon-btn"
        onClick={() => insertTemplateBlock("reference")}
        title="Referenz aus anderem Dokument einbetten (@[pfad#L1-L5])"
      >
        <FileText size={14} style={{ color: "var(--accent-indigo)" }} />
      </button>

      <div className="toolbar-separator" />

      <button className="action-icon-btn" onClick={() => insertTemplateBlock("bold")} title="Fett markieren">
        <Bold size={14} />
      </button>
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("italic")} title="Kursiv markieren">
        <Italic size={14} />
      </button>
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("link")} title="Link einfügen">
        <Link size={14} />
      </button>
      <button
        className="action-icon-btn"
        onClick={() => insertTemplateBlock("image")}
        title="Bild einfügen (oder Screenshot per Ctrl+V / Drag & Drop)"
      >
        <ImageIcon size={14} />
      </button>
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("bullet-list")} title="Aufzählungliste">
        <List size={14} />
      </button>
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("ordered-list")} title="Nummerierte Liste">
        <ListOrdered size={14} />
      </button>
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("code-block")} title="Codeblock einfügen">
        <CodeIcon size={14} style={{ opacity: 0.8 }} />
      </button>
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("quote")} title="Zitat-Block">
        <Quote size={14} />
      </button>
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("horizontal-rule")} title="Trennlinie einfügen">
        <Minus size={14} />
      </button>
      <button className="action-icon-btn" onClick={() => insertTemplateBlock("details")} title="Dropdown-Details Block">
        <ChevronDown size={14} />
      </button>
      <div style={{ width: "1px", height: "16px", backgroundColor: "var(--border-color)", margin: "0 4px" }} />
      <button
        className="action-icon-btn"
        onClick={() => setShowCheatsheetModal(true)}
        title="Syntax-Hilfe & Cheatsheet öffnen (Ctrl+/)"
        style={{ color: "var(--accent-indigo)" }}
      >
        <HelpCircle size={14} />
      </button>
    </div>
  );
}
