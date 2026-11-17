"use client";

import React, { useRef } from "react";
import { ChevronDown, ChevronUp, Database, Info, Plus, Table2, Trash2, X } from "lucide-react";
import { useWorkspaceContext } from "../../../context/WorkspaceContext";
import {
  createSupersedingAdr,
  isDocumentWriteProtected,
  startNewDocumentRevision,
} from "../../../utils/wiki/documentProtection";
import { ApprovalLockBanner } from "../../wiki/ApprovalLockBanner";
import { recordPageSessionSnapshot } from "../../wiki/wikiStorageUtils";
import {
  parseGenericMarkdown,
  serializeGenericMarkdown,
  type CalloutVariant,
  type GenericBlock,
  type TableColumnAlign,
} from "./genericBlockParser";
import { VisualCalloutAndLinkBar, VisualCalloutCard } from "./VisualCalloutAndLinkBar";
import { VisualTableEditorBlock } from "./VisualTableEditorBlock";

export { parseGenericMarkdown, serializeGenericMarkdown, type CalloutVariant, type GenericBlock, type TableColumnAlign };

interface ActiveInputCursor {
  blockIdx: number;
  kind: "content" | "listItem" | "tableHeader" | "tableCell" | "calloutTitle";
  subIdx?: number;
  colIdx?: number;
  selStart: number;
  selEnd: number;
}

const BASE_FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  borderRadius: "6px",
  backgroundColor: "var(--bg-editor)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
  outline: "none",
};

const CARD_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  backgroundColor: "var(--bg-panel)",
  padding: "14px",
  borderRadius: "8px",
  border: "1px solid var(--border-color)",
};

function applyCursorTransform(
  blocks: GenericBlock[],
  cur: ActiveInputCursor | null,
  fn: (val: string, start: number, end: number) => string
): GenericBlock[] {
  if (!cur || !blocks[cur.blockIdx]) {
    const pIdx = blocks.findIndex((b) => b.type === "paragraph");
    if (pIdx === -1) return [...blocks, { type: "paragraph", content: fn("", 0, 0) }];
    const next = [...blocks];
    const prev = next[pIdx].content;
    next[pIdx] = { ...next[pIdx], content: fn(prev, prev.length, prev.length) };
    return next;
  }

  const next = [...blocks];
  const blk = next[cur.blockIdx];
  if (cur.kind === "content") {
    next[cur.blockIdx] = { ...blk, content: fn(blk.content || "", cur.selStart, cur.selEnd) };
  } else if (cur.kind === "calloutTitle") {
    next[cur.blockIdx] = { ...blk, calloutTitle: fn(blk.calloutTitle || "", cur.selStart, cur.selEnd) };
  } else if (cur.kind === "listItem" && cur.subIdx !== undefined && blk.listItems) {
    next[cur.blockIdx] = {
      ...blk,
      listItems: blk.listItems.map((it, i) => (i === cur.subIdx ? { ...it, text: fn(it.text, cur.selStart, cur.selEnd) } : it)),
    };
  } else if (cur.kind === "tableHeader" && cur.colIdx !== undefined && blk.tableHeaders) {
    next[cur.blockIdx] = {
      ...blk,
      tableHeaders: blk.tableHeaders.map((h, i) => (i === cur.colIdx ? fn(h || "", cur.selStart, cur.selEnd) : h)),
    };
  } else if (cur.kind === "tableCell" && cur.subIdx !== undefined && cur.colIdx !== undefined && blk.tableRows) {
    next[cur.blockIdx] = {
      ...blk,
      tableRows: blk.tableRows.map((r, rIdx) =>
        rIdx === cur.subIdx ? r.map((c, cIdx) => (cIdx === cur.colIdx ? fn(c || "", cur.selStart, cur.selEnd) : c)) : r
      ),
    };
  }
  return next;
}

export function GenericBlockEditor({ filePath }: { filePath: string }) {
  const {
    files,
    language,
    currentUser,
    handleUpsertWorkspaceFile,
    handleUpsertMultipleFiles,
    handleOpenFile,
    updateMarkdownFileContent,
  } = useWorkspaceContext();

  const isEn = language === "en";
  const activeFile = files.find((f) => f.path === filePath);
  const protection = isDocumentWriteProtected(activeFile);
  const isLocked = protection.locked;

  const { frontmatterPrefix, blocks } = parseGenericMarkdown(activeFile?.content || "");
  const cursorRef = useRef<ActiveInputCursor | null>(null);

  const persistBlocks = (nextBlocks: GenericBlock[]) => {
    if (isLocked) return;
    const content = serializeGenericMarkdown(frontmatterPrefix, nextBlocks);
    if (activeFile) void handleUpsertWorkspaceFile({ ...activeFile, content });
    else updateMarkdownFileContent(filePath, content);
  };

  const updateBlockAt = (index: number, patch: Partial<GenericBlock>) => {
    if (isLocked) return;
    const updated = [...blocks];
    updated[index] = { ...updated[index], ...patch };
    persistBlocks(updated);
  };

  const trackInput = (meta: Omit<ActiveInputCursor, "selStart" | "selEnd">, el: HTMLInputElement | HTMLTextAreaElement) => {
    cursorRef.current = { ...meta, selStart: el.selectionStart ?? el.value.length, selEnd: el.selectionEnd ?? el.value.length };
  };

  const handleWrapInlineFormat = (prefix: string, suffix: string, fallbackText: string) => {
    if (isLocked) return;
    persistBlocks(
      applyCursorTransform(blocks, cursorRef.current, (val, start, end) => {
        const s = Math.max(0, Math.min(start, val.length));
        const e = Math.max(s, Math.min(end, val.length));
        return `${val.slice(0, s)}${prefix}${val.slice(s, e) || fallbackText}${suffix}${val.slice(e)}`;
      })
    );
  };

  const handleInsertSnippet = (snippet: string) => {
    if (isLocked) return;
    persistBlocks(
      applyCursorTransform(blocks, cursorRef.current, (val, start, end) => {
        const s = Math.max(0, Math.min(start, val.length));
        const e = Math.max(s, Math.min(end, val.length));
        const spacer = s > 0 && !/\s$/.test(val.slice(0, s)) ? " " : "";
        return `${val.slice(0, s)}${spacer}${snippet}${val.slice(e)}`;
      })
    );
  };

  const handleAddBlock = (type: "h2" | "paragraph" | "todo" | "table" | "callout" | "query") => {
    if (isLocked) return;
    const newBlock: GenericBlock =
      type === "query"
        ? { type: "code", codeLang: "query", content: "FROM issues\nWHERE sprint = sprint-01\nSORT priority desc\nVIEW table" }
        : type === "table"
          ? {
              type: "table",
              content: "",
              tableHeaders: isEn ? ["Topic", "Owner", "Status"] : ["Thema", "Verantwortlich", "Status"],
              tableAlignments: ["left", "left", "left"],
              tableRows: [["", "", ""], ["", "", ""]],
            }
          : type === "callout"
            ? { type: "callout", calloutType: "note", content: isEn ? "Important context for the team..." : "Wichtiger Hinweis für das Team..." }
            : type === "todo"
              ? { type: "list", content: "", listType: "todo", listItems: [{ checked: false, text: isEn ? "New action item" : "Neuer Punkt" }] }
              : { type, content: type === "h2" ? (isEn ? "New Section" : "Neuer Abschnitt") : isEn ? "New paragraph..." : "Neuer Absatz..." };
    persistBlocks([...blocks, newBlock]);
  };

  const handleMoveBlock = (index: number, direction: "up" | "down") => {
    if (isLocked) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const updated = [...blocks];
    [updated[index], updated[targetIdx]] = [updated[targetIdx], updated[index]];
    persistBlocks(updated);
  };

  const handleStartNewRevision = () => {
    if (!activeFile) return;
    const unlocked = startNewDocumentRevision(activeFile, currentUser || "@editor");
    recordPageSessionSnapshot(unlocked, currentUser, "Started new revision (In Review)");
    void handleUpsertWorkspaceFile(unlocked);
  };

  const handleSupersedeAdr = async () => {
    if (!activeFile) return;
    const { newAdr, updatedOldAdr } = createSupersedingAdr(activeFile, files, currentUser || "@architect", language);
    recordPageSessionSnapshot(updatedOldAdr, currentUser, `Superseded by ${newAdr.name}`);
    await handleUpsertMultipleFiles([updatedOldAdr, newAdr]);
    handleOpenFile(newAdr.path);
  };

  return (
    <div className="visual-form-container" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {isLocked && activeFile && (
        <ApprovalLockBanner
          file={activeFile}
          reason={protection.reason}
          approvedBy={protection.approvedBy}
          language={language}
          onStartNewRevision={handleStartNewRevision}
          onSupersedeAdr={handleSupersedeAdr}
        />
      )}

      <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
        <h3 style={{ fontSize: "18px", color: "var(--text-primary)", margin: 0 }}>
          {isEn ? "Visual Confluence Document Editor" : "Visueller Confluence-Dokument-Editor"}
        </h3>
        <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
          {isEn
            ? "Edit headings, rich tables, Confluence callout panels, checklists, and @Page/@Ticket links visually."
            : "Überschriften, Tabellen, Callout-Boxen, Checklisten und @Seiten-/@Ticket-Links ohne Markdown-Syntax bearbeiten."}
        </p>
      </div>

      <VisualCalloutAndLinkBar
        files={files}
        disabled={isLocked}
        language={language}
        onWrapInlineFormat={handleWrapInlineFormat}
        onInsertSnippet={handleInsertSnippet}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {blocks.map((block, idx) => (
          <div key={idx} style={{ ...CARD_ROW_STYLE, opacity: isLocked ? 0.85 : 1 }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
              {(block.type === "h1" || block.type === "h2" || block.type === "h3") && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "var(--accent-indigo)", fontWeight: 700 }}>
                    {block.type === "h1" ? "MAIN TITLE (H1)" : block.type === "h2" ? "SECTION HEADING (H2)" : "SUBHEADING (H3)"}
                  </span>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={block.content}
                    onChange={(e) => updateBlockAt(idx, { content: e.target.value })}
                    onFocus={(e) => trackInput({ blockIdx: idx, kind: "content" }, e.currentTarget)}
                    onSelect={(e) => trackInput({ blockIdx: idx, kind: "content" }, e.currentTarget)}
                    style={{
                      ...BASE_FIELD_STYLE,
                      padding: block.type === "h1" ? "10px 12px" : "7px 10px",
                      fontSize: block.type === "h1" ? "19px" : block.type === "h2" ? "16px" : "14px",
                      fontWeight: 700,
                    }}
                  />
                </div>
              )}

              {block.type === "paragraph" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 700 }}>{isEn ? "PARAGRAPH" : "ABSATZ"}</span>
                  <textarea
                    disabled={isLocked}
                    value={block.content}
                    onChange={(e) => updateBlockAt(idx, { content: e.target.value })}
                    onFocus={(e) => trackInput({ blockIdx: idx, kind: "content" }, e.currentTarget)}
                    onSelect={(e) => trackInput({ blockIdx: idx, kind: "content" }, e.currentTarget)}
                    style={{ ...BASE_FIELD_STYLE, minHeight: "76px", padding: "10px 12px", fontSize: "13px", lineHeight: 1.5, resize: "vertical", fontFamily: "var(--font-sans)" }}
                  />
                </div>
              )}

              {block.type === "table" && (
                <VisualTableEditorBlock
                  headers={block.tableHeaders || ["Column 1", "Column 2"]}
                  alignments={block.tableAlignments}
                  rows={block.tableRows || []}
                  disabled={isLocked}
                  language={language}
                  onTrackFocus={(tMeta, el) => trackInput({ blockIdx: idx, kind: tMeta.kind, subIdx: tMeta.rowIdx, colIdx: tMeta.colIdx }, el)}
                  onChange={(nextTable) => updateBlockAt(idx, nextTable)}
                />
              )}

              {block.type === "callout" && (
                <VisualCalloutCard
                  variant={block.calloutType || "note"}
                  title={block.calloutTitle}
                  content={block.content}
                  disabled={isLocked}
                  language={language}
                  onTrackFocus={(kind, el) => trackInput({ blockIdx: idx, kind }, el)}
                  onChange={(nextCallout) => updateBlockAt(idx, nextCallout)}
                />
              )}

              {(block.type === "code" || block.type === "yaml") && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: block.type === "yaml" ? "var(--accent-yellow)" : block.codeLang === "query" ? "var(--accent-green)" : "var(--accent-blue)",
                    }}
                  >
                    {block.type === "yaml" ? "METADATA CARD (YAML)" : block.codeLang === "query" ? "CONFLUENCE LIVE QUERY MACRO (```query)" : `EMBEDDED BLOCK (\`\`\`${block.codeLang || "code"})`}
                  </span>
                  <textarea
                    disabled={isLocked}
                    value={block.content}
                    onChange={(e) => updateBlockAt(idx, { content: e.target.value })}
                    style={{ ...BASE_FIELD_STYLE, minHeight: "84px", padding: "10px 12px", fontSize: "12px", lineHeight: 1.5, resize: "vertical", fontFamily: "var(--font-mono)" }}
                  />
                </div>
              )}

              {block.type === "list" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 700 }}>
                    LIST ({block.listType === "todo" ? "Checklist" : block.listType === "ordered" ? "Numbered" : "Bullet"})
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {block.listItems?.map((item, lIdx) => (
                      <div key={lIdx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {block.listType === "todo" && (
                          <input
                            type="checkbox"
                            disabled={isLocked}
                            checked={item.checked}
                            onChange={(e) => {
                              const items = [...(block.listItems || [])];
                              items[lIdx] = { ...item, checked: e.target.checked };
                              updateBlockAt(idx, { listItems: items });
                            }}
                            style={{ width: "14px", height: "14px", cursor: isLocked ? "not-allowed" : "pointer" }}
                          />
                        )}
                        {block.listType === "ordered" && <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", width: "20px" }}>{lIdx + 1}.</span>}
                        {block.listType === "unordered" && <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", width: "12px" }}>•</span>}
                        <input
                          type="text"
                          disabled={isLocked}
                          value={item.text}
                          onChange={(e) => {
                            const items = [...(block.listItems || [])];
                            items[lIdx] = { ...item, text: e.target.value };
                            updateBlockAt(idx, { listItems: items });
                          }}
                          onFocus={(e) => trackInput({ blockIdx: idx, kind: "listItem", subIdx: lIdx }, e.currentTarget)}
                          onSelect={(e) => trackInput({ blockIdx: idx, kind: "listItem", subIdx: lIdx }, e.currentTarget)}
                          style={{ ...BASE_FIELD_STYLE, flex: 1, padding: "5px 8px", borderRadius: "4px", fontSize: "13px" }}
                        />
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => {
                              const items = block.listItems?.filter((_, i) => i !== lIdx) || [];
                              if (items.length === 0) persistBlocks(blocks.filter((_, i) => i !== idx));
                              else updateBlockAt(idx, { listItems: items });
                            }}
                            style={{ background: "transparent", border: "none", color: "var(--accent-red)", cursor: "pointer", display: "flex" }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => updateBlockAt(idx, { listItems: [...(block.listItems || []), { checked: false, text: isEn ? "New item" : "Neuer Eintrag" }] })}
                      className="git-btn"
                      style={{ alignSelf: "flex-start", padding: "4px 8px", fontSize: "11px" }}
                    >
                      + {isEn ? "Add Line" : "Zeile hinzufügen"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {!isLocked && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", justifyContent: "flex-start" }}>
                <button type="button" onClick={() => handleMoveBlock(idx, "up")} disabled={idx === 0} className="action-icon-btn" style={{ width: "28px", height: "28px", padding: 0, opacity: idx === 0 ? 0.3 : 1 }} title="Move Block Up">
                  <ChevronUp size={14} />
                </button>
                <button type="button" onClick={() => handleMoveBlock(idx, "down")} disabled={idx === blocks.length - 1} className="action-icon-btn" style={{ width: "28px", height: "28px", padding: 0, opacity: idx === blocks.length - 1 ? 0.3 : 1 }} title="Move Block Down">
                  <ChevronDown size={14} />
                </button>
                {block.type !== "h1" && (
                  <button type="button" onClick={() => persistBlocks(blocks.filter((_, i) => i !== idx))} className="visual-delete-btn" style={{ width: "28px", height: "28px", padding: 0, marginTop: "4px" }} title="Delete Block">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!isLocked && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px", borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
          <button type="button" className="visual-add-btn" onClick={() => handleAddBlock("paragraph")} style={{ padding: "8px 14px", fontSize: "13px" }}>
            <Plus size={14} /> + {isEn ? "Paragraph" : "Absatz"}
          </button>
          <button type="button" className="visual-add-btn" onClick={() => handleAddBlock("h2")} style={{ padding: "8px 14px", fontSize: "13px", backgroundColor: "var(--bg-active)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
            <Plus size={14} /> + {isEn ? "Heading" : "Überschrift"}
          </button>
          <button type="button" className="visual-add-btn" onClick={() => handleAddBlock("table")} style={{ padding: "8px 14px", fontSize: "13px", backgroundColor: "rgba(99, 102, 241, 0.14)", border: "1px solid rgba(99, 102, 241, 0.38)", color: "#c7d2fe" }}>
            <Table2 size={14} /> + {isEn ? "Table" : "Tabelle"}
          </button>
          <button type="button" className="visual-add-btn" onClick={() => handleAddBlock("callout")} style={{ padding: "8px 14px", fontSize: "13px", backgroundColor: "rgba(59, 130, 246, 0.14)", border: "1px solid rgba(59, 130, 246, 0.38)", color: "var(--accent-blue)" }}>
            <Info size={14} /> + {isEn ? "Callout Panel" : "Callout-Box"}
          </button>
          <button type="button" className="visual-add-btn" onClick={() => handleAddBlock("todo")} style={{ padding: "8px 14px", fontSize: "13px", backgroundColor: "var(--bg-active)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
            <Plus size={14} /> + {isEn ? "Checklist" : "Checkliste"}
          </button>
          <button type="button" className="visual-add-btn" onClick={() => handleAddBlock("query")} style={{ padding: "8px 14px", fontSize: "13px", backgroundColor: "rgba(16, 185, 129, 0.14)", border: "1px solid rgba(16, 185, 129, 0.35)", color: "var(--accent-green)" }}>
            <Database size={14} /> + {isEn ? "Live Query Macro" : "Live-Query-Makro"}
          </button>
        </div>
      )}
    </div>
  );
}
