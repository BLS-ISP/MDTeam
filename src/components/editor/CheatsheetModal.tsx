"use client";

import React from "react";
import { Box, Calendar, HelpCircle, Link, Plus, Share2, Sparkles, Users, X } from "lucide-react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

export function CheatsheetModal() {
  const { showCheatsheetModal, setShowCheatsheetModal, insertTemplateBlock } = useWorkspaceContext();

  if (!showCheatsheetModal) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      onClick={() => setShowCheatsheetModal(false)}
    >
      <div
        style={{
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "900px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <HelpCircle size={20} style={{ color: "var(--accent-indigo)" }} />
            <span style={{ fontWeight: 600, fontSize: "16px", color: "var(--text-primary)" }}>
              Syntax-Hilfe &amp; Editor Cheatsheet
            </span>
          </div>
          <button
            onClick={() => setShowCheatsheetModal(false)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
            className="action-icon-btn"
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "20px",
            backgroundColor: "var(--bg-sidebar)",
          }}
        >
          {/* Column 1: Markdown Basics */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3
              style={{
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "6px",
                margin: 0,
              }}
            >
              Markdown Basics
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600 }}>Überschriften</div>
              <pre style={{ margin: 0, padding: "6px", fontSize: "11px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
                {"# H1 Überschrift\n## H2 Überschrift\n### H3 Überschrift"}
              </pre>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600 }}>Formatierung &amp; Listen</div>
              <pre style={{ margin: 0, padding: "6px", fontSize: "11px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
                {"**Fett** oder *Kursiv*\n- Liste Punkt 1\n- Liste Punkt 2\n1. Nummeriert 1\n2. Nummeriert 2"}
              </pre>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600 }}>Tabellen &amp; Checklisten</div>
              <pre style={{ margin: 0, padding: "6px", fontSize: "11px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "4px", whiteSpace: "pre-wrap" }}>
                {"| Spalte 1 | Spalte 2 |\n| :--- | :--- |\n| Wert 1 | Wert 2 |\n\n- [ ] Offene Aufgabe\n- [x] Erledigte Aufgabe"}
              </pre>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600 }}>Formatierungserweiterung</div>
              <pre style={{ margin: 0, padding: "6px", fontSize: "11px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
                {"==Gelber Highlight-Text==\n~~Durchgestrichener Text~~"}
              </pre>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  className="cheatsheet-btn"
                  onClick={() => {
                    insertTemplateBlock("highlight");
                    setShowCheatsheetModal(false);
                  }}
                  style={{ padding: "2px 6px", fontSize: "9px" }}
                >
                  == Highlight
                </button>
                <button
                  className="cheatsheet-btn"
                  onClick={() => {
                    insertTemplateBlock("strikethrough");
                    setShowCheatsheetModal(false);
                  }}
                  style={{ padding: "2px 6px", fontSize: "9px" }}
                >
                  ~~ Strike
                </button>
              </div>
            </div>
          </div>

          {/* Column 2: Advanced MDTeam Features */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3
              style={{
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "6px",
                margin: 0,
              }}
            >
              Workspace Features
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                <Link size={12} style={{ color: "var(--accent-indigo)" }} />
                <span>Dateireferenz (Transklusion)</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Zitiert Abschnitte live aus anderen Dateien:</div>
              <pre style={{ margin: 0, padding: "6px", fontSize: "11px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
                {"@[arc42/02_constraints.md#L4-L8]"}
              </pre>
              <button
                className="cheatsheet-btn"
                onClick={() => {
                  insertTemplateBlock("reference");
                  setShowCheatsheetModal(false);
                }}
                style={{ alignSelf: "flex-start", marginTop: "4px" }}
              >
                <Plus size={10} /> Einfügen
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                <Box size={12} style={{ color: "var(--accent-blue)" }} />
                <span>Draw.io / diagrams.net</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Bettet interaktive Vektorgrafiken ein:</div>
              <pre style={{ margin: 0, padding: "6px", fontSize: "11px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
                {"```drawio\n[Draw.io Embed URL]\n```"}
              </pre>
              <button
                className="cheatsheet-btn"
                onClick={() => {
                  insertTemplateBlock("drawio");
                  setShowCheatsheetModal(false);
                }}
                style={{ alignSelf: "flex-start", marginTop: "4px" }}
              >
                <Plus size={10} /> Einfügen
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                <Share2 size={12} style={{ color: "var(--accent-indigo)" }} />
                <span>Mermaid Diagramme</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Erstellt Grafiken direkt aus Text-Code:</div>
              <pre style={{ margin: 0, padding: "6px", fontSize: "11px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
                {"```mermaid\ngraph TD\n    A[Start] --> B[Ziel]\n```"}
              </pre>
              <button
                className="cheatsheet-btn"
                onClick={() => {
                  insertTemplateBlock("mermaid");
                  setShowCheatsheetModal(false);
                }}
                style={{ alignSelf: "flex-start", marginTop: "4px" }}
              >
                <Plus size={10} /> Einfügen
              </button>
            </div>
          </div>

          {/* Column 3: Roadmap & Milestones */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3
              style={{
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "6px",
                margin: 0,
              }}
            >
              Roadmap &amp; YAML
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                <Calendar size={12} style={{ color: "var(--accent-green)" }} />
                <span>YAML Meilenstein-Block</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                Füttert die Dashboard-Timeline und generiert Milestone-Cards:
              </div>
              <pre style={{ margin: 0, padding: "6px", fontSize: "11px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "4px", whiteSpace: "pre-wrap" }}>
                {"---\ntitle: \"Titel\"\nstatus: \"pending\"\nmilestone: \"M1\"\nstart_date: \"2026-06-01\"\nend_date: \"2026-06-15\"\nassignee: \"Developer\"\ncolor: \"#a855f7\"\n---"}
              </pre>
              <button
                className="cheatsheet-btn"
                onClick={() => {
                  insertTemplateBlock("roadmap-item");
                  setShowCheatsheetModal(false);
                }}
                style={{ alignSelf: "flex-start", marginTop: "4px" }}
              >
                <Plus size={10} /> Einfügen
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                <Users size={12} style={{ color: "var(--accent-indigo)" }} />
                <span>Agile &amp; Scrum-Syntax</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Kanban-Tasks &amp; Impediment-Blocker:</div>
              <pre style={{ margin: 0, padding: "6px", fontSize: "11px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "4px", whiteSpace: "pre-wrap" }}>
                {"- [ ] TODO: OAuth2-Verbindung testen @developer-a\n- [ ] BLOCKED: Firewall gesperrt @scrummaster"}
              </pre>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  className="cheatsheet-btn"
                  onClick={() => {
                    insertTemplateBlock("backlog");
                    setShowCheatsheetModal(false);
                  }}
                >
                  <Plus size={10} /> Backlog
                </button>
                <button
                  className="cheatsheet-btn"
                  onClick={() => {
                    insertTemplateBlock("blocker");
                    setShowCheatsheetModal(false);
                  }}
                >
                  <Plus size={10} /> Blocker
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                border: "1px solid var(--border-color)",
                padding: "10px",
                borderRadius: "6px",
                backgroundColor: "rgba(99, 102, 241, 0.05)",
                fontSize: "11px",
                color: "var(--text-secondary)",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "4px" }}>
                <Sparkles size={12} style={{ color: "var(--accent-indigo)" }} />
                <span>Monaco Autocomplete (Tipp!)</span>
              </div>
              Tippen Sie einfach <code>@</code> oder <code>@[</code> um Dateipfade zu vervollständigen, oder schreiben Sie YAML-Schlüssel inside <code>---</code> um Feldnamen und Statuswerte direkt einzufügen.
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Tastenkombination: Drücken Sie{" "}
            <kbd style={{ padding: "2px 4px", border: "1px solid var(--border-color)", borderRadius: "3px", fontSize: "10px", backgroundColor: "var(--bg-sidebar)" }}>
              Ctrl
            </kbd>{" "}
            +{" "}
            <kbd style={{ padding: "2px 4px", border: "1px solid var(--border-color)", borderRadius: "3px", fontSize: "10px", backgroundColor: "var(--bg-sidebar)" }}>
              /
            </kbd>{" "}
            zum Umschalten
          </span>
          <button className="git-btn" onClick={() => setShowCheatsheetModal(false)} style={{ padding: "6px 16px", margin: 0 }}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
