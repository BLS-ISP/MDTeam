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
  Lock,
  Minus,
  Quote,
  Sparkles,
  Table as TableIcon,
} from "lucide-react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import { isDocumentWriteProtected } from "../../utils/wiki/documentProtection";

export function EditorToolbar() {
  const {
    files,
    activeFile,
    splitActive,
    activeEditorPane,
    activeFilePathB,
    isStakeholderReadOnly,
    language,
    insertTemplateBlock,
    setShowCheatsheetModal,
  } = useWorkspaceContext();

  const targetFile =
    activeEditorPane === "B" && splitActive && activeFilePathB
      ? files.find((f) => f.path === activeFilePathB) || activeFile
      : activeFile;

  const protection = isDocumentWriteProtected(targetFile);
  const isLocked = protection.locked || isStakeholderReadOnly;
  const isEn = language === "en";

  const btnStyle: React.CSSProperties | undefined = isLocked
    ? { opacity: 0.4, cursor: "not-allowed" }
    : undefined;

  const triggerInsert = (blockType: string) => {
    if (isLocked) return;
    insertTemplateBlock(blockType);
  };

  return (
    <div className="editor-toolbar">
      {isLocked && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 8px",
            marginRight: "4px",
            borderRadius: "4px",
            backgroundColor: "rgba(245, 158, 11, 0.16)",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            color: "var(--accent-yellow)",
            fontSize: "10.5px",
            fontWeight: 700,
          }}
        >
          <Lock size={11} />
          <span>{isEn ? "Read-Only" : "Schreibgeschützt"}</span>
        </span>
      )}

      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("todo")} title="Aufgabe / Checkliste">
        <CheckSquare size={14} />
      </button>
      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("table")} title="Tabelle einfügen">
        <TableIcon size={14} />
      </button>
      <button
        className="action-icon-btn"
        disabled={isLocked}
        style={btnStyle}
        onClick={() => triggerInsert("query")}
        title="Live Query Macro (Jira/ADR/Pages Tabelle) einfügen"
      >
        <Database size={14} style={{ color: "var(--accent-green)" }} />
      </button>
      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("mermaid")} title="Mermaid UML Diagramm">
        <CodeIcon size={14} />
      </button>
      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("drawio")} title="Draw.io Diagramm einfügen">
        <Box size={14} style={{ color: "var(--accent-indigo)" }} />
      </button>
      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("adr")} title="ADR Architektur-Vorlage">
        <Sparkles size={14} />
      </button>
      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("roadmap-item")} title="Roadmap-Meilenstein Block">
        <Calendar size={14} />
      </button>
      <button
        className="action-icon-btn"
        disabled={isLocked}
        style={btnStyle}
        onClick={() => triggerInsert("reference")}
        title="Referenz aus anderem Dokument einbetten (@[pfad#L1-L5])"
      >
        <FileText size={14} style={{ color: "var(--accent-indigo)" }} />
      </button>

      <div className="toolbar-separator" />

      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("bold")} title="Fett markieren">
        <Bold size={14} />
      </button>
      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("italic")} title="Kursiv markieren">
        <Italic size={14} />
      </button>
      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("link")} title="Link einfügen">
        <Link size={14} />
      </button>
      <button
        className="action-icon-btn"
        disabled={isLocked}
        style={btnStyle}
        onClick={() => triggerInsert("image")}
        title="Bild einfügen (oder Screenshot per Ctrl+V / Drag & Drop)"
      >
        <ImageIcon size={14} />
      </button>
      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("bullet-list")} title="Aufzählungliste">
        <List size={14} />
      </button>
      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("ordered-list")} title="Nummerierte Liste">
        <ListOrdered size={14} />
      </button>
      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("code-block")} title="Codeblock einfügen">
        <CodeIcon size={14} style={{ opacity: 0.8 }} />
      </button>
      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("quote")} title="Zitat-Block">
        <Quote size={14} />
      </button>
      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("horizontal-rule")} title="Trennlinie einfügen">
        <Minus size={14} />
      </button>
      <button className="action-icon-btn" disabled={isLocked} style={btnStyle} onClick={() => triggerInsert("details")} title="Dropdown-Details Block">
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
