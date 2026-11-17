"use client";

import React from "react";
import { Box, Calendar, HelpCircle, Link, Plus, Share2, Users } from "lucide-react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

export function CheatsheetPanel() {
  const { t, language, insertTemplateBlock } = useWorkspaceContext();

  return (
    <>
      <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{t.cheatsheetTitle}</span>
        <span className="logo-badge" style={{ fontSize: "9px", backgroundColor: "rgba(99, 102, 241, 0.1)" }}>
          MD Extensions
        </span>
      </div>
      <div className="cheatsheet-container">
        <div className="cheatsheet-section">
          <div className="cheatsheet-header">
            <Link size={14} style={{ color: "var(--accent-indigo)" }} />
            <span>{language === "en" ? "File Reference & Transclusion" : "Dateiverweis & Transklusion"}</span>
          </div>
          <div className="cheatsheet-desc">
            {language === "en"
              ? "Quotes lines or complete files live from the repository. Clicking in preview opens file at that line."
              : "Zitiert Zeilen oder komplette Dateien live aus dem Repository. Klicks in der Vorschau öffnen die Datei an der Stelle."}
          </div>
          <div className="cheatsheet-preview">
            <code>{"@[arc42/02_constraints.md#L4-L8]"}</code>
          </div>
          <div className="cheatsheet-actions">
            <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("reference")}>
              <Plus size={10} /> {language === "en" ? "Insert" : "Einfügen"}
            </button>
          </div>
        </div>

        <div className="cheatsheet-section">
          <div className="cheatsheet-header">
            <Box size={14} style={{ color: "var(--accent-blue)" }} />
            <span>{language === "en" ? "Draw.io Diagrams" : "Draw.io Diagramme"}</span>
          </div>
          <div className="cheatsheet-desc">
            {language === "en"
              ? "Embeds interactive diagrams.net / draw.io charts directly into the Markdown preview via URL or code block."
              : "Bettet interaktive diagrams.net / draw.io Grafiken über URL oder Code-Blöcke direkt in die Markdown-Vorschau ein."}
          </div>
          <div className="cheatsheet-preview">
            <code>{"```drawio\n[Draw.io Embed URL]\n```"}</code>
          </div>
          <div className="cheatsheet-actions">
            <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("drawio")}>
              <Plus size={10} /> {language === "en" ? "Insert" : "Einfügen"}
            </button>
          </div>
        </div>

        <div className="cheatsheet-section">
          <div className="cheatsheet-header">
            <Calendar size={14} style={{ color: "var(--accent-green)" }} />
            <span>{language === "en" ? "Roadmap Milestones" : "Roadmap-Meilensteine"}</span>
          </div>
          <div className="cheatsheet-desc">
            {language === "en"
              ? "Creates structured milestone cards in the document and automatically feeds dates into the dashboard."
              : "Erstellt strukturierte Meilenstein-Karten im Dokument und füttert das Projekt-Dashboard automatisch mit Terminen."}
          </div>
          <div className="cheatsheet-preview">
            <code>
              {
                '---\ntitle: "Meilenstein Name"\nstatus: "pending"\nmilestone: "M1: Konzept"\nstart_date: "2026-06-01"\nend_date: "2026-06-15"\nassignee: "Developer A"\ncolor: "#a855f7"\n---'
              }
            </code>
          </div>
          <div className="cheatsheet-actions">
            <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("roadmap-item")}>
              <Plus size={10} /> {language === "en" ? "Insert" : "Einfügen"}
            </button>
          </div>
        </div>

        <div className="cheatsheet-section">
          <div className="cheatsheet-header">
            <Share2 size={14} style={{ color: "var(--accent-indigo)" }} />
            <span>{language === "en" ? "Mermaid UML Diagrams" : "Mermaid UML Diagramme"}</span>
          </div>
          <div className="cheatsheet-desc">
            {language === "en"
              ? "Renders UML, flowcharts, Gantt charts, or sequence diagrams directly from plain-text code blocks."
              : "Rendert UML, Ablaufdiagramme, Gantt-Diagramme oder Sequenzdiagramme direkt aus plain-text Codeblöcken."}
          </div>
          <div className="cheatsheet-preview">
            <code>{"```mermaid\ngraph TD\n    A[Start] --> B[Prozess]\n```"}</code>
          </div>
          <div className="cheatsheet-actions">
            <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("mermaid")}>
              <Plus size={10} /> {language === "en" ? "Insert" : "Einfügen"}
            </button>
          </div>
        </div>

        <div className="cheatsheet-section">
          <div className="cheatsheet-header">
            <Users size={14} style={{ color: "var(--accent-indigo)" }} />
            <span>{language === "en" ? "Agile & Scrum Syntax" : "Agile & Scrum-Syntax"}</span>
          </div>
          <div className="cheatsheet-desc">
            {language === "en"
              ? "Use prefixes for the Kanban board and blockers in logs."
              : "Verwende Präfixe für das Kanban-Board und Blocker in Protokollen."}
          </div>
          <div className="cheatsheet-preview">
            <div>
              Backlog: <code>- [ ] TODO: Text @dev</code>
            </div>
            <div>
              Blocker: <code>- [ ] BLOCKED: Text @sm</code>
            </div>
          </div>
          <div className="cheatsheet-actions" style={{ gap: "8px" }}>
            <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("backlog")} style={{ marginRight: "8px" }}>
              <Plus size={10} /> Backlog
            </button>
            <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("blocker")}>
              <Plus size={10} /> Blocker
            </button>
          </div>
        </div>

        <div className="cheatsheet-section">
          <div className="cheatsheet-header">
            <HelpCircle size={14} style={{ color: "var(--text-muted)" }} />
            <span>{language === "en" ? "Advanced Formatting" : "Erweiterte Formatierung"}</span>
          </div>
          <div className="cheatsheet-desc">
            {language === "en"
              ? "Special text highlight classes for marking or crossing out content."
              : "Spezielle Text-Highlight-Klassen zur Markierung oder Streichung von Inhalten."}
          </div>
          <div className="cheatsheet-preview">
            <div>
              Highlight: <code>{"==Text=="}</code>
            </div>
            <div>
              Strikethrough: <code>{"~~Text~~"}</code>
            </div>
          </div>
          <div className="cheatsheet-actions" style={{ gap: "8px" }}>
            <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("highlight")} style={{ marginRight: "8px" }}>
              <Plus size={10} /> Highlight
            </button>
            <button className="cheatsheet-btn" onClick={() => insertTemplateBlock("strikethrough")}>
              <Plus size={10} /> Strike
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
