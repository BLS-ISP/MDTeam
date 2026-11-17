"use client";

import React from "react";
import { CheckCircle2, CornerDownRight, Send, Trash2 } from "lucide-react";
import type { InlineCommentThread } from "./wikiTypes";

export interface InlineCommentThreadCardProps {
  thread: InlineCommentThread;
  isEn: boolean;
  replyDraft: string;
  onReplyDraftChange: (text: string) => void;
  onAddReply: () => void;
  onToggleResolve: () => void;
  onDeleteThread: () => void;
  onJumpToLine?: (lineNumber: number) => void;
}

function renderCommentBodyWithMentions(text: string) {
  const parts = text.split(/(@[a-zA-Z0-9_-]+)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("@")) {
      return (
        <span
          key={idx}
          style={{
            backgroundColor: "rgba(99, 102, 241, 0.2)",
            color: "#a5b4fc",
            padding: "1px 5px",
            borderRadius: "4px",
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            fontSize: "11.5px",
          }}
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function InlineCommentThreadCard({
  thread,
  isEn,
  replyDraft,
  onReplyDraftChange,
  onAddReply,
  onToggleResolve,
  onDeleteThread,
  onJumpToLine,
}: InlineCommentThreadCardProps) {
  return (
    <div
      style={{
        backgroundColor: "var(--bg-panel)",
        border: `1px solid ${
          thread.resolved ? "rgba(16, 185, 129, 0.3)" : "var(--border-color)"
        }`,
        borderRadius: "8px",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Quoted text & line badge */}
      {(thread.quote || thread.lineNumber) && (
        <div
          onClick={() => {
            if (thread.lineNumber && onJumpToLine) {
              onJumpToLine(thread.lineNumber);
            }
          }}
          style={{
            borderLeft: "3px solid var(--accent-indigo)",
            backgroundColor: "rgba(99, 102, 241, 0.08)",
            padding: "6px 10px",
            borderRadius: "0 6px 6px 0",
            fontSize: "11.5px",
            color: "var(--text-secondary)",
            cursor: thread.lineNumber && onJumpToLine ? "pointer" : "default",
          }}
        >
          {thread.lineNumber && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                fontWeight: 700,
                color: "#a5b4fc",
                marginRight: "6px",
              }}
            >
              #L{thread.lineNumber}
            </span>
          )}
          <span style={{ fontStyle: "italic" }}>
            {thread.quote ? `“${thread.quote}”` : ""}
          </span>
        </div>
      )}

      {/* Comments in thread */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {thread.comments.map((msg, idx) => (
          <div
            key={msg.id}
            style={{
              paddingLeft: idx > 0 ? "12px" : 0,
              borderLeft: idx > 0 ? "2px solid var(--border-color)" : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "11px",
                marginBottom: "3px",
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {idx > 0 && (
                  <CornerDownRight
                    size={10}
                    style={{
                      display: "inline",
                      marginRight: "4px",
                      color: "var(--text-muted)",
                    }}
                  />
                )}
                {msg.author}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "10.5px" }}>
                {msg.createdAt.slice(0, 16).replace("T", " ")}
              </span>
            </div>
            <div
              style={{
                fontSize: "12.5px",
                color: "var(--text-primary)",
                lineHeight: 1.45,
              }}
            >
              {renderCommentBodyWithMentions(msg.text)}
            </div>
          </div>
        ))}
      </div>

      {/* Reply Input + Thread Actions */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          paddingTop: "6px",
          borderTop: "1px solid var(--border-color)",
        }}
      >
        <input
          type="text"
          value={replyDraft}
          onChange={(e) => onReplyDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddReply();
            }
          }}
          placeholder={isEn ? "Reply to thread..." : "Antwort schreiben..."}
          style={{
            flex: 1,
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            borderRadius: "5px",
            padding: "5px 8px",
            fontSize: "11.5px",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={onAddReply}
          style={{
            padding: "5px 8px",
            borderRadius: "5px",
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-sidebar)",
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
          title={isEn ? "Send reply" : "Antwort senden"}
        >
          <Send size={12} />
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "11px",
        }}
      >
        <button
          type="button"
          onClick={onToggleResolve}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "3px 8px",
            borderRadius: "4px",
            border: "1px solid var(--border-color)",
            backgroundColor: thread.resolved
              ? "rgba(245, 158, 11, 0.12)"
              : "rgba(16, 185, 129, 0.14)",
            color: thread.resolved
              ? "var(--accent-yellow)"
              : "var(--accent-green)",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <CheckCircle2 size={12} />
          {thread.resolved
            ? isEn
              ? "Reopen Thread"
              : "Wieder öffnen"
            : isEn
            ? "Resolve"
            : "Als erledigt markieren"}
        </button>

        <button
          type="button"
          onClick={onDeleteThread}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "3px",
          }}
          title={isEn ? "Delete thread" : "Thread löschen"}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
