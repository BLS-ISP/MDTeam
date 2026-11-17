"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import type {
  InlineCommentsDrawerProps,
  InlineCommentThread,
} from "./wikiTypes";
import {
  extractMentions,
  INLINE_COMMENTS_FILE_PATH,
  parseInlineCommentsStore,
  serializeInlineCommentsFile,
} from "./wikiStorageUtils";
import { InlineCommentComposer } from "./InlineCommentComposer";
import { InlineCommentThreadCard } from "./InlineCommentThreadCard";

/**
 * 2. <InlineCommentsDrawer />
 * Git-backed threaded document review comments stored in `.mdteam/inline-comments.json`.
 */
export function InlineCommentsDrawer({
  isOpen,
  activeFile,
  files,
  currentUser,
  selectedQuote = "",
  selectedLineNumber,
  language = "de",
  onClose,
  onUpsertFile,
  onJumpToLine,
}: InlineCommentsDrawerProps) {
  const isEn = language === "en";
  const [quoteText, setQuoteText] = useState<string>(selectedQuote);
  const [lineNumber, setLineNumber] = useState<string>(
    selectedLineNumber ? String(selectedLineNumber) : ""
  );
  const [newCommentText, setNewCommentText] = useState<string>("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [filterTab, setFilterTab] = useState<"open" | "resolved" | "all">(
    "open"
  );

  useEffect(() => {
    if (selectedQuote) setQuoteText(selectedQuote);
  }, [selectedQuote]);

  useEffect(() => {
    if (selectedLineNumber) setLineNumber(String(selectedLineNumber));
  }, [selectedLineNumber]);

  const allThreads = useMemo(() => parseInlineCommentsStore(files), [files]);

  const fileThreads = useMemo(
    () => allThreads.filter((t) => t.filePath === activeFile.path),
    [allThreads, activeFile.path]
  );

  const visibleThreads = useMemo(() => {
    if (filterTab === "open") return fileThreads.filter((t) => !t.resolved);
    if (filterTab === "resolved") return fileThreads.filter((t) => t.resolved);
    return fileThreads;
  }, [fileThreads, filterTab]);

  const documentLines = useMemo(
    () => activeFile.content.replace(/\r\n/g, "\n").split("\n"),
    [activeFile.content]
  );

  if (!isOpen) return null;

  const persistThreads = (nextThreads: InlineCommentThread[]) => {
    onUpsertFile(serializeInlineCommentsFile(nextThreads));
  };

  const handleCaptureSelection = () => {
    if (typeof window === "undefined") return;
    const sel = window.getSelection()?.toString().trim() || "";
    if (sel) {
      setQuoteText(sel.slice(0, 280));
      const idx = documentLines.findIndex((l) =>
        l.includes(sel.split("\n")[0].trim())
      );
      if (idx !== -1) {
        setLineNumber(String(idx + 1));
      }
    }
  };

  const handleLinePickerChange = (lineStr: string) => {
    setLineNumber(lineStr);
    const num = Number.parseInt(lineStr, 10);
    if (Number.isFinite(num) && num >= 1 && num <= documentLines.length) {
      const picked = documentLines[num - 1].trim();
      if (picked && !quoteText.trim()) {
        setQuoteText(picked.slice(0, 240));
      }
    }
  };

  const handleCreateThread = () => {
    const trimmedComment = newCommentText.trim();
    if (!trimmedComment) return;

    const nowIso = new Date().toISOString();
    const parsedLine = Number.parseInt(lineNumber, 10);
    const author = currentUser || "@developer-a";

    const newThread: InlineCommentThread = {
      id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      filePath: activeFile.path,
      quote: quoteText.trim(),
      lineNumber:
        Number.isFinite(parsedLine) && parsedLine > 0 ? parsedLine : undefined,
      status: "open",
      resolved: false,
      createdAt: nowIso,
      createdBy: author,
      resolvedBy: null,
      resolvedAt: null,
      comments: [
        {
          id: `msg-${Date.now()}`,
          author,
          text: trimmedComment,
          mentions: extractMentions(trimmedComment),
          createdAt: nowIso,
        },
      ],
    };

    persistThreads([newThread, ...allThreads]);
    setNewCommentText("");
    setQuoteText("");
    setLineNumber("");
  };

  const handleAddReply = (threadId: string) => {
    const draft = (replyDrafts[threadId] || "").trim();
    if (!draft) return;

    const nowIso = new Date().toISOString();
    const author = currentUser || "@developer-a";
    const nextThreads = allThreads.map((t) => {
      if (t.id !== threadId) return t;
      return {
        ...t,
        comments: [
          ...t.comments,
          {
            id: `msg-${Date.now()}`,
            author,
            text: draft,
            mentions: extractMentions(draft),
            createdAt: nowIso,
          },
        ],
      };
    });

    persistThreads(nextThreads);
    setReplyDrafts((prev) => ({ ...prev, [threadId]: "" }));
  };

  const handleToggleResolve = (threadId: string) => {
    const nowIso = new Date().toISOString();
    const nextThreads: InlineCommentThread[] = allThreads.map((t) => {
      if (t.id !== threadId) return t;
      const nextResolved = !t.resolved;
      return {
        ...t,
        resolved: nextResolved,
        status: nextResolved ? "resolved" : "open",
        resolvedBy: nextResolved ? currentUser || "@developer-a" : null,
        resolvedAt: nextResolved ? nowIso : null,
      };
    });
    persistThreads(nextThreads);
  };

  const handleDeleteThread = (threadId: string) => {
    persistThreads(allThreads.filter((t) => t.id !== threadId));
  };

  const openCount = fileThreads.filter((t) => !t.resolved).length;
  const resolvedCount = fileThreads.filter((t) => t.resolved).length;

  return (
    <div
      style={{
        position: "fixed",
        top: "48px",
        right: 0,
        bottom: 0,
        width: "400px",
        maxWidth: "95vw",
        backgroundColor: "var(--bg-sidebar)",
        borderLeft: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-lg)",
        display: "flex",
        flexDirection: "column",
        zIndex: 900,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-panel)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <MessageSquare size={16} style={{ color: "var(--accent-indigo)" }} />
          <div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {isEn ? "Inline Review Threads" : "Inline-Review-Kommentare"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {activeFile.path}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="action-icon-btn"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "4px",
          }}
        >
          <X size={17} />
        </button>
      </div>

      {/* New Comment Composer */}
      <InlineCommentComposer
        isEn={isEn}
        currentUser={currentUser}
        quoteText={quoteText}
        lineNumber={lineNumber}
        newCommentText={newCommentText}
        documentLines={documentLines}
        onQuoteChange={setQuoteText}
        onLinePickerChange={handleLinePickerChange}
        onCommentTextChange={setNewCommentText}
        onCaptureSelection={handleCaptureSelection}
        onCreateThread={handleCreateThread}
      />

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          padding: "8px 16px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-panel)",
        }}
      >
        {(
          [
            {
              key: "open",
              label: isEn ? `Open (${openCount})` : `Offen (${openCount})`,
            },
            {
              key: "resolved",
              label: isEn
                ? `Resolved (${resolvedCount})`
                : `Erledigt (${resolvedCount})`,
            },
            {
              key: "all",
              label: isEn
                ? `All (${fileThreads.length})`
                : `Alle (${fileThreads.length})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilterTab(tab.key)}
            style={{
              flex: 1,
              padding: "5px 8px",
              borderRadius: "5px",
              fontSize: "11.5px",
              fontWeight: 600,
              border:
                filterTab === tab.key
                  ? "1px solid rgba(99, 102, 241, 0.45)"
                  : "1px solid transparent",
              backgroundColor:
                filterTab === tab.key
                  ? "rgba(99, 102, 241, 0.16)"
                  : "transparent",
              color: filterTab === tab.key ? "#c7d2fe" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Threads List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {visibleThreads.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "12.5px",
            }}
          >
            {isEn
              ? "No inline review threads in this view yet."
              : "Noch keine Inline-Kommentare in dieser Ansicht vorhanden."}
          </div>
        ) : (
          visibleThreads.map((thread) => (
            <InlineCommentThreadCard
              key={thread.id}
              thread={thread}
              isEn={isEn}
              replyDraft={replyDrafts[thread.id] || ""}
              onReplyDraftChange={(val) =>
                setReplyDrafts((prev) => ({ ...prev, [thread.id]: val }))
              }
              onAddReply={() => handleAddReply(thread.id)}
              onToggleResolve={() => handleToggleResolve(thread.id)}
              onDeleteThread={() => handleDeleteThread(thread.id)}
              onJumpToLine={onJumpToLine}
            />
          ))
        )}
      </div>

      {/* Footer note */}
      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-panel)",
          fontSize: "10.5px",
          color: "var(--text-muted)",
        }}
      >
        {isEn
          ? `Version-controlled in Git via ${INLINE_COMMENTS_FILE_PATH}`
          : `Git-versioniert in ${INLINE_COMMENTS_FILE_PATH}`}
      </div>
    </div>
  );
}
