"use client";

import React from "react";
import { MessageSquarePlus, Quote } from "lucide-react";
import { MENTION_HANDLES } from "./wikiStorageUtils";

export interface InlineCommentComposerProps {
  isEn: boolean;
  currentUser: string;
  quoteText: string;
  lineNumber: string;
  newCommentText: string;
  documentLines: string[];
  onQuoteChange: (val: string) => void;
  onLinePickerChange: (val: string) => void;
  onCommentTextChange: React.Dispatch<React.SetStateAction<string>>;
  onCaptureSelection: () => void;
  onCreateThread: () => void;
}

export function InlineCommentComposer({
  isEn,
  currentUser,
  quoteText,
  lineNumber,
  newCommentText,
  documentLines,
  onQuoteChange,
  onLinePickerChange,
  onCommentTextChange,
  onCaptureSelection,
  onCreateThread,
}: InlineCommentComposerProps) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border-color)",
        backgroundColor: "var(--bg-editor)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          {isEn ? "New Review Thread" : "Neuer Kommentar-Thread"}
        </span>
        <button
          type="button"
          onClick={onCaptureSelection}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            backgroundColor: "rgba(99, 102, 241, 0.14)",
            border: "1px solid rgba(99, 102, 241, 0.35)",
            color: "#a5b4fc",
            cursor: "pointer",
          }}
        >
          <Quote size={11} />
          {isEn ? "Quote Selection" : "Auswahl zitieren"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "6px" }}>
        <input
          type="text"
          value={quoteText}
          onChange={(e) => onQuoteChange(e.target.value)}
          placeholder={
            isEn
              ? "Quoted text or section (optional)..."
              : "Zitierte Textstelle (optional)..."
          }
          style={{
            flex: 1,
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            padding: "6px 8px",
            fontSize: "12px",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <select
          value={lineNumber}
          onChange={(e) => onLinePickerChange(e.target.value)}
          style={{
            width: "92px",
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            padding: "6px 6px",
            fontSize: "11.5px",
            color: "var(--text-secondary)",
            outline: "none",
          }}
          title={isEn ? "Anchor to line" : "Zeile verknüpfen"}
        >
          <option value="">{isEn ? "Line..." : "Zeile..."}</option>
          {documentLines.map((ln, idx) =>
            ln.trim() ? (
              <option key={idx + 1} value={String(idx + 1)}>
                L{idx + 1}: {ln.trim().slice(0, 24)}
              </option>
            ) : null
          )}
        </select>
      </div>

      <textarea
        value={newCommentText}
        onChange={(e) => onCommentTextChange(e.target.value)}
        placeholder={
          isEn
            ? `Comment as ${currentUser || "@developer-a"} (use @handle to notify)...`
            : `Kommentar als ${currentUser || "@developer-a"} (@handle für Erwähnung)...`
        }
        style={{
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "6px",
          padding: "8px",
          fontSize: "12.5px",
          color: "var(--text-primary)",
          fontFamily: "var(--font-sans)",
          resize: "vertical",
          minHeight: "62px",
          outline: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {MENTION_HANDLES.map((handle) => (
            <button
              key={handle}
              type="button"
              onClick={() =>
                onCommentTextChange((prev) =>
                  prev.endsWith(" ") || !prev
                    ? `${prev}${handle} `
                    : `${prev} ${handle} `
                )
              }
              style={{
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "10.5px",
                fontFamily: "var(--font-mono)",
                backgroundColor: "var(--bg-panel)",
                border: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              {handle}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCreateThread}
          disabled={!newCommentText.trim()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            border: "none",
            backgroundColor: newCommentText.trim()
              ? "var(--accent-indigo)"
              : "var(--bg-active)",
            color: newCommentText.trim() ? "#ffffff" : "var(--text-muted)",
            cursor: newCommentText.trim() ? "pointer" : "not-allowed",
          }}
        >
          <MessageSquarePlus size={13} />
          {isEn ? "Post" : "Senden"}
        </button>
      </div>
    </div>
  );
}
