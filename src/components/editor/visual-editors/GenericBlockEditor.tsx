"use client";

import React from "react";
import { ChevronDown, ChevronUp, Database, Plus, Trash2, X } from "lucide-react";
import { useWorkspaceContext } from "../../../context/WorkspaceContext";
import {
  parseGenericMarkdown,
  serializeGenericMarkdown,
  type GenericBlock,
} from "./genericBlockParser";

export { parseGenericMarkdown, serializeGenericMarkdown, type GenericBlock };

export function GenericBlockEditor({ filePath }: { filePath: string }) {
  const { files, language, handleUpsertWorkspaceFile, updateMarkdownFileContent } = useWorkspaceContext();

  const rawContent = files.find((f) => f.path === filePath)?.content || "";
  const { frontmatterPrefix, blocks } = parseGenericMarkdown(rawContent);

  const persistBlocks = (nextBlocks: GenericBlock[]) => {
    const content = serializeGenericMarkdown(frontmatterPrefix, nextBlocks);
    const existingFile = files.find((f) => f.path === filePath);
    if (existingFile) {
      handleUpsertWorkspaceFile({ ...existingFile, content });
    } else {
      updateMarkdownFileContent(filePath, content);
    }
  };

  const handleBlockChange = (index: number, field: "content" | "listItems", value: any) => {
    const updated = [...blocks];
    updated[index] = { ...updated[index], [field]: value } as GenericBlock;
    persistBlocks(updated);
  };

  const handleAddBlock = (type: "h2" | "paragraph" | "todo" | "query") => {
    const newBlock: GenericBlock =
      type === "query"
        ? {
            type: "code",
            codeLang: "query",
            content: "FROM issues\nWHERE sprint = sprint-01\nSORT priority desc\nVIEW table",
          }
        : {
            type: type === "todo" ? "list" : type,
            content: type === "todo" ? "" : "New text...",
            listType: type === "todo" ? "todo" : undefined,
            listItems: type === "todo" ? [{ checked: false, text: "New Item" }] : undefined,
          };
    persistBlocks([...blocks, newBlock]);
  };

  const handleDeleteBlock = (index: number) => {
    persistBlocks(blocks.filter((_, idx) => idx !== index));
  };

  const handleMoveBlock = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const updated = [...blocks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    persistBlocks(updated);
  };

  return (
    <div className="visual-form-container" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "8px" }}>
        <h3 style={{ fontSize: "18px", color: "var(--text-primary)", margin: 0 }}>
          {language === "en" ? "Visual Document Editor" : "Visueller Dokument-Editor"}
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
          {language === "en"
            ? "Edit headings, paragraphs, checklists, and Confluence Live Query blocks without losing YAML metadata."
            : "Überschriften, Absätze, Checklisten und Live-Query-Blöcke strukturiert bearbeiten (YAML-Metadaten bleiben erhalten)."}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {blocks.map((block, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              gap: "12px",
              backgroundColor: "var(--bg-panel)",
              padding: "14px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              position: "relative",
            }}
          >
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              {block.type === "h1" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "var(--accent-indigo)", fontWeight: "bold" }}>
                    MAIN TITLE (H1)
                  </span>
                  <input
                    type="text"
                    value={block.content}
                    onChange={(e) => handleBlockChange(idx, "content", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-editor)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "20px",
                      fontWeight: "bold",
                      outline: "none",
                    }}
                  />
                </div>
              )}
              {block.type === "h2" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "var(--accent-indigo)", fontWeight: "bold" }}>
                    SECTION HEADING (H2)
                  </span>
                  <input
                    type="text"
                    value={block.content}
                    onChange={(e) => handleBlockChange(idx, "content", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-editor)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "16px",
                      fontWeight: "bold",
                      outline: "none",
                    }}
                  />
                </div>
              )}
              {block.type === "h3" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "var(--accent-indigo)", fontWeight: "bold" }}>
                    SUBHEADING (H3)
                  </span>
                  <input
                    type="text"
                    value={block.content}
                    onChange={(e) => handleBlockChange(idx, "content", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-editor)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "14px",
                      fontWeight: "bold",
                      outline: "none",
                    }}
                  />
                </div>
              )}
              {block.type === "paragraph" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: "bold" }}>
                    PARAGRAPH (TEXT)
                  </span>
                  <textarea
                    value={block.content}
                    onChange={(e) => handleBlockChange(idx, "content", e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: "80px",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-editor)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      lineHeight: 1.5,
                      resize: "vertical",
                      outline: "none",
                      fontFamily: "var(--font-sans)",
                    }}
                  />
                </div>
              )}
              {block.type === "code" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      color: block.codeLang === "query" ? "var(--accent-green)" : "var(--accent-blue)",
                      fontWeight: "bold",
                    }}
                  >
                    {block.codeLang === "query"
                      ? "CONFLUENCE LIVE QUERY MACRO (```query)"
                      : `EMBEDDED BLOCK (\`\`\`${block.codeLang || "code"})`}
                  </span>
                  <textarea
                    value={block.content}
                    onChange={(e) => handleBlockChange(idx, "content", e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: "88px",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-editor)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "12px",
                      lineHeight: 1.5,
                      resize: "vertical",
                      outline: "none",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </div>
              )}
              {block.type === "yaml" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "10px", color: "var(--accent-yellow)", fontWeight: "bold" }}>
                    METADATA CARD (YAML)
                  </span>
                  <textarea
                    value={block.content}
                    onChange={(e) => handleBlockChange(idx, "content", e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: "84px",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-editor)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "12px",
                      lineHeight: 1.5,
                      resize: "vertical",
                      outline: "none",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </div>
              )}
              {block.type === "list" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: "bold" }}>
                    LIST (
                    {block.listType === "todo"
                      ? "Checklist"
                      : block.listType === "ordered"
                        ? "Numbered List"
                        : "Bullet List"}
                    )
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {block.listItems?.map((item, lIdx) => (
                      <div key={lIdx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {block.listType === "todo" && (
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => {
                              const updatedItems = [...(block.listItems || [])];
                              updatedItems[lIdx] = { ...item, checked: e.target.checked };
                              handleBlockChange(idx, "listItems", updatedItems);
                            }}
                            style={{ width: "14px", height: "14px", cursor: "pointer" }}
                          />
                        )}
                        {block.listType === "ordered" && (
                          <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-secondary)", width: "20px" }}>
                            {lIdx + 1}.
                          </span>
                        )}
                        {block.listType === "unordered" && (
                          <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-secondary)", width: "12px" }}>
                            •
                          </span>
                        )}
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => {
                            const updatedItems = [...(block.listItems || [])];
                            updatedItems[lIdx] = { ...item, text: e.target.value };
                            handleBlockChange(idx, "listItems", updatedItems);
                          }}
                          style={{
                            flex: 1,
                            padding: "5px 8px",
                            borderRadius: "4px",
                            backgroundColor: "var(--bg-editor)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-primary)",
                            fontSize: "13px",
                            outline: "none",
                          }}
                        />
                        <button
                          onClick={() => {
                            const updatedItems = block.listItems?.filter((_, lIndex) => lIndex !== lIdx) || [];
                            if (updatedItems.length === 0) {
                              handleDeleteBlock(idx);
                            } else {
                              handleBlockChange(idx, "listItems", updatedItems);
                            }
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--accent-red)",
                            cursor: "pointer",
                            fontSize: "11px",
                            display: "flex",
                            alignItems: "center",
                          }}
                          title="Remove Line"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const updatedItems = [...(block.listItems || []), { checked: false, text: "New Element" }];
                      handleBlockChange(idx, "listItems", updatedItems);
                    }}
                    className="git-btn"
                    style={{ alignSelf: "flex-start", padding: "4px 8px", fontSize: "11px", marginTop: "4px" }}
                  >
                    + Add Line
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", justifyContent: "flex-start" }}>
              <button
                onClick={() => handleMoveBlock(idx, "up")}
                disabled={idx === 0}
                className="action-icon-btn"
                style={{
                  width: "28px",
                  height: "28px",
                  padding: 0,
                  opacity: idx === 0 ? 0.3 : 1,
                  cursor: idx === 0 ? "not-allowed" : "pointer",
                }}
                title="Move Block Up"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => handleMoveBlock(idx, "down")}
                disabled={idx === blocks.length - 1}
                className="action-icon-btn"
                style={{
                  width: "28px",
                  height: "28px",
                  padding: 0,
                  opacity: idx === blocks.length - 1 ? 0.3 : 1,
                  cursor: idx === blocks.length - 1 ? "not-allowed" : "pointer",
                }}
              >
                <ChevronDown size={14} />
              </button>
              {block.type !== "h1" && (
                <button
                  onClick={() => handleDeleteBlock(idx)}
                  className="visual-delete-btn"
                  style={{ width: "28px", height: "28px", padding: 0, marginTop: "4px" }}
                  title="Delete Block"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginTop: "16px",
          borderTop: "1px solid var(--border-color)",
          paddingTop: "16px",
        }}
      >
        <button className="visual-add-btn" onClick={() => handleAddBlock("paragraph")} style={{ padding: "8px 14px", fontSize: "13px" }}>
          <Plus size={14} /> + {language === "en" ? "Paragraph" : "Absatz"}
        </button>
        <button
          className="visual-add-btn"
          onClick={() => handleAddBlock("h2")}
          style={{
            padding: "8px 14px",
            fontSize: "13px",
            backgroundColor: "var(--bg-active)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          <Plus size={14} /> + {language === "en" ? "Heading" : "Überschrift"}
        </button>
        <button
          className="visual-add-btn"
          onClick={() => handleAddBlock("todo")}
          style={{
            padding: "8px 14px",
            fontSize: "13px",
            backgroundColor: "var(--bg-active)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          <Plus size={14} /> + {language === "en" ? "Checklist" : "Checkliste"}
        </button>
        <button
          className="visual-add-btn"
          onClick={() => handleAddBlock("query")}
          style={{
            padding: "8px 14px",
            fontSize: "13px",
            backgroundColor: "rgba(16, 185, 129, 0.14)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            color: "var(--accent-green)",
          }}
        >
          <Database size={14} /> + {language === "en" ? "Live Query Macro" : "Live-Query-Makro"}
        </button>
      </div>
    </div>
  );
}
