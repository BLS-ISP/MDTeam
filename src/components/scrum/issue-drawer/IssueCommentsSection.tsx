"use client";

import React from "react";
import { Trash2, MessageSquare } from "lucide-react";
import { AgileIssue } from "../../../utils/issueEngine";
import { IssueDrawerCopy } from "./issueDrawerI18n";

export interface IssueCommentsSectionProps {
  draft: AgileIssue;
  currentUser: string;
  commentText: string;
  t: IssueDrawerCopy;
  onSetCommentText: (val: string) => void;
  onPostComment: () => void;
  onDeleteComment: (idx: number) => void;
}

export function IssueCommentsSection({
  draft,
  currentUser,
  commentText,
  t,
  onSetCommentText,
  onPostComment,
  onDeleteComment,
}: IssueCommentsSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "var(--text-secondary)",
        }}
      >
        <MessageSquare size={14} style={{ color: "var(--accent-indigo)" }} />
        {t.comments} ({draft.comments.length})
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {draft.comments.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
            {t.noComments}
          </div>
        ) : (
          draft.comments.map((c, idx) => (
            <div
              key={idx}
              style={{
                padding: "10px 12px",
                backgroundColor: "var(--bg-panel)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(99, 102, 241, 0.25)",
                      color: "var(--accent-indigo)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {c.author.replace(/^@/, "").slice(0, 2).toUpperCase()}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-indigo)" }}>
                    {c.author}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {c.timestamp}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteComment(idx)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: "2px",
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {c.text}
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Comment Composer */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          backgroundColor: "var(--bg-panel)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "10px",
        }}
      >
        <textarea
          value={commentText}
          placeholder={`${t.commentPlaceholder} ${currentUser || "@developer-a"}...`}
          onChange={(e) => onSetCommentText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              onPostComment();
            }
          }}
          rows={2}
          style={{
            width: "100%",
            backgroundColor: "var(--bg-editor)",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            padding: "8px 10px",
            fontSize: "12px",
            color: "var(--text-primary)",
            fontFamily: "var(--font-sans)",
            resize: "vertical",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onPostComment}
            disabled={!commentText.trim()}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: commentText.trim() ? "var(--accent-indigo)" : "var(--bg-active)",
              color: commentText.trim() ? "#ffffff" : "var(--text-muted)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: commentText.trim() ? "pointer" : "not-allowed",
            }}
          >
            {t.postComment}
          </button>
        </div>
      </div>
    </div>
  );
}
