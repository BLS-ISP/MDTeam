"use client";

import React from "react";
import { AlignCenter, AlignLeft, AlignRight, Minus, Plus, Table2, X } from "lucide-react";
import type { TableColumnAlign } from "./genericBlockParser";

export interface VisualTableEditorBlockProps {
  headers: string[];
  alignments?: TableColumnAlign[];
  rows: string[][];
  disabled?: boolean;
  language: "de" | "en";
  onTrackFocus?: (
    target: { kind: "tableHeader" | "tableCell"; rowIdx?: number; colIdx: number },
    el: HTMLInputElement
  ) => void;
  onChange: (next: {
    tableHeaders: string[];
    tableAlignments: TableColumnAlign[];
    tableRows: string[][];
  }) => void;
}

const ALIGN_CYCLE: TableColumnAlign[] = ["left", "center", "right"];

export function VisualTableEditorBlock({
  headers,
  alignments = [],
  rows,
  disabled = false,
  language,
  onTrackFocus,
  onChange,
}: VisualTableEditorBlockProps) {
  const isEn = language === "en";
  const safeHeaders = headers.length > 0 ? headers : ["Column 1", "Column 2"];
  const colCount = safeHeaders.length;
  const safeAlignments: TableColumnAlign[] = Array.from(
    { length: colCount },
    (_, idx) => alignments[idx] ?? "left"
  );

  const handleHeaderChange = (colIdx: number, value: string) => {
    const nextHeaders = [...safeHeaders];
    nextHeaders[colIdx] = value;
    onChange({ tableHeaders: nextHeaders, tableAlignments: safeAlignments, tableRows: rows });
  };

  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    const nextRows = rows.map((r, rIdx) => {
      if (rIdx !== rowIdx) return r;
      const copy = Array.from({ length: colCount }, (_, cIdx) => r[cIdx] ?? "");
      copy[colIdx] = value;
      return copy;
    });
    onChange({ tableHeaders: safeHeaders, tableAlignments: safeAlignments, tableRows: nextRows });
  };

  const handleCycleAlign = (colIdx: number) => {
    const curr = safeAlignments[colIdx] ?? "left";
    const next = ALIGN_CYCLE[(ALIGN_CYCLE.indexOf(curr) + 1) % ALIGN_CYCLE.length];
    const nextAlignments = [...safeAlignments];
    nextAlignments[colIdx] = next;
    onChange({ tableHeaders: safeHeaders, tableAlignments: nextAlignments, tableRows: rows });
  };

  const handleAddRow = () => {
    const blankRow = Array.from({ length: colCount }, () => "");
    onChange({
      tableHeaders: safeHeaders,
      tableAlignments: safeAlignments,
      tableRows: [...rows, blankRow],
    });
  };

  const handleRemoveLastRow = () => {
    if (rows.length === 0) return;
    onChange({
      tableHeaders: safeHeaders,
      tableAlignments: safeAlignments,
      tableRows: rows.slice(0, -1),
    });
  };

  const handleRemoveRowAt = (rowIdx: number) => {
    onChange({
      tableHeaders: safeHeaders,
      tableAlignments: safeAlignments,
      tableRows: rows.filter((_, idx) => idx !== rowIdx),
    });
  };

  const handleAddColumn = () => {
    const nextColTitle = isEn ? `Column ${colCount + 1}` : `Spalte ${colCount + 1}`;
    onChange({
      tableHeaders: [...safeHeaders, nextColTitle],
      tableAlignments: [...safeAlignments, "left"],
      tableRows: rows.map((r) => [...Array.from({ length: colCount }, (_, i) => r[i] ?? ""), ""]),
    });
  };

  const handleRemoveLastColumn = () => {
    if (colCount <= 1) return;
    onChange({
      tableHeaders: safeHeaders.slice(0, -1),
      tableAlignments: safeAlignments.slice(0, -1),
      tableRows: rows.map((r) => r.slice(0, colCount - 1)),
    });
  };

  const handleRemoveColumnAt = (colIdx: number) => {
    if (colCount <= 1) return;
    onChange({
      tableHeaders: safeHeaders.filter((_, i) => i !== colIdx),
      tableAlignments: safeAlignments.filter((_, i) => i !== colIdx),
      tableRows: rows.map((r) => r.filter((_, i) => i !== colIdx)),
    });
  };

  const smallBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 8px",
    borderRadius: "5px",
    fontSize: "11px",
    fontWeight: 600,
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-sidebar)",
    color: "var(--text-secondary)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "10px", color: "var(--accent-indigo)", fontWeight: 700 }}>
          <Table2 size={13} />
          <span>
            {isEn ? "VISUAL TABLE" : "VISUELLE TABELLE"} ({rows.length}×{colCount})
          </span>
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <button type="button" disabled={disabled} onClick={handleAddRow} style={smallBtnStyle}>
            <Plus size={11} /> {isEn ? "+ Row" : "+ Zeile"}
          </button>
          <button
            type="button"
            disabled={disabled || rows.length === 0}
            onClick={handleRemoveLastRow}
            style={{ ...smallBtnStyle, opacity: disabled || rows.length === 0 ? 0.45 : 1 }}
          >
            <Minus size={11} /> {isEn ? "- Row" : "- Zeile"}
          </button>
          <button type="button" disabled={disabled} onClick={handleAddColumn} style={smallBtnStyle}>
            <Plus size={11} /> {isEn ? "+ Column" : "+ Spalte"}
          </button>
          <button
            type="button"
            disabled={disabled || colCount <= 1}
            onClick={handleRemoveLastColumn}
            style={{ ...smallBtnStyle, opacity: disabled || colCount <= 1 ? 0.45 : 1 }}
          >
            <Minus size={11} /> {isEn ? "- Column" : "- Spalte"}
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--border-color)", borderRadius: "6px", backgroundColor: "var(--bg-editor)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: `${colCount * 140}px` }}>
          <thead>
            <tr style={{ backgroundColor: "var(--bg-sidebar)", borderBottom: "1px solid var(--border-color)" }}>
              {safeHeaders.map((headerText, colIdx) => {
                const align = safeAlignments[colIdx] ?? "left";
                return (
                  <th key={colIdx} style={{ padding: "6px", borderRight: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="text"
                        disabled={disabled}
                        value={headerText}
                        onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                        onFocus={(e) => onTrackFocus?.({ kind: "tableHeader", colIdx }, e.currentTarget)}
                        onSelect={(e) => onTrackFocus?.({ kind: "tableHeader", colIdx }, e.currentTarget)}
                        placeholder={isEn ? `Header ${colIdx + 1}` : `Spalte ${colIdx + 1}`}
                        style={{
                          flex: 1,
                          minWidth: "80px",
                          padding: "4px 6px",
                          borderRadius: "4px",
                          border: "1px solid transparent",
                          backgroundColor: "transparent",
                          color: "var(--text-primary)",
                          fontSize: "12px",
                          fontWeight: 700,
                          textAlign: align,
                          outline: "none",
                        }}
                      />
                      {!disabled && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCycleAlign(colIdx)}
                            title={isEn ? `Alignment: ${align}` : `Ausrichtung: ${align}`}
                            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", display: "flex" }}
                          >
                            {align === "center" ? <AlignCenter size={11} /> : align === "right" ? <AlignRight size={11} /> : <AlignLeft size={11} />}
                          </button>
                          {colCount > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveColumnAt(colIdx)}
                              title={isEn ? "Remove column" : "Spalte löschen"}
                              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", display: "flex" }}
                            >
                              <X size={11} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </th>
                );
              })}
              {!disabled && <th style={{ width: "28px" }} />}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount + (disabled ? 0 : 1)} style={{ padding: "12px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                  {isEn ? "No data rows yet — click '+ Row' to add one." : "Noch keine Zeilen — klicken Sie auf ‚+ Zeile‘."}
                </td>
              </tr>
            ) : (
              rows.map((row, rIdx) => (
                <tr key={rIdx} style={{ borderBottom: rIdx < rows.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                  {safeHeaders.map((_, colIdx) => {
                    const align = safeAlignments[colIdx] ?? "left";
                    return (
                      <td key={colIdx} style={{ padding: "4px 6px", borderRight: "1px solid var(--border-color)" }}>
                        <input
                          type="text"
                          disabled={disabled}
                          value={row[colIdx] ?? ""}
                          onChange={(e) => handleCellChange(rIdx, colIdx, e.target.value)}
                          onFocus={(e) => onTrackFocus?.({ kind: "tableCell", rowIdx: rIdx, colIdx }, e.currentTarget)}
                          onSelect={(e) => onTrackFocus?.({ kind: "tableCell", rowIdx: rIdx, colIdx }, e.currentTarget)}
                          placeholder="..."
                          style={{
                            width: "100%",
                            padding: "5px 6px",
                            borderRadius: "4px",
                            border: "1px solid transparent",
                            backgroundColor: "transparent",
                            color: "var(--text-primary)",
                            fontSize: "12.5px",
                            textAlign: align,
                            outline: "none",
                          }}
                        />
                      </td>
                    );
                  })}
                  {!disabled && (
                    <td style={{ textAlign: "center", padding: "0 4px" }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveRowAt(rIdx)}
                        title={isEn ? "Delete row" : "Zeile löschen"}
                        style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", padding: "3px", display: "inline-flex" }}
                      >
                        <X size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
