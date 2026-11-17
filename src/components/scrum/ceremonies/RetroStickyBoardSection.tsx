"use client";

import React, { useState } from "react";
import { ThumbsUp, Trash2, Smile, Frown, AlertTriangle } from "lucide-react";
import type { RetroStickyCard, RetroStickyCategory } from "../../../types/scrumPolicy";
import type { CeremoniesCopy } from "./ceremoniesI18n";

export interface RetroStickyBoardSectionProps {
  t: CeremoniesCopy;
  cards: RetroStickyCard[];
  currentUser: string;
  onAddCard: (category: RetroStickyCategory, text: string) => void;
  onVoteCard: (cardId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onPickForAction?: (text: string) => void;
}

export function RetroStickyBoardSection({
  t,
  cards,
  currentUser,
  onAddCard,
  onVoteCard,
  onDeleteCard,
  onPickForAction,
}: RetroStickyBoardSectionProps) {
  const [inputs, setInputs] = useState<Record<RetroStickyCategory, string>>({
    glad: "",
    sad: "",
    impediment: "",
  });

  const columns: {
    key: RetroStickyCategory;
    label: string;
    color: string;
    Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  }[] = [
    { key: "glad", label: t.retro.gladCol, color: "var(--accent-green)", Icon: Smile },
    { key: "sad", label: t.retro.sadCol, color: "var(--accent-yellow)", Icon: Frown },
    { key: "impediment", label: t.retro.impedimentCol, color: "var(--accent-red)", Icon: AlertTriangle },
  ];

  const submitSticky = (cat: RetroStickyCategory) => {
    const clean = inputs[cat].trim();
    if (!clean) return;
    onAddCard(cat, clean);
    setInputs((prev) => ({ ...prev, [cat]: "" }));
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px" }}>
      {columns.map(({ key, label, color, Icon }) => {
        const colCards = cards
          .filter((c) => c.category === key)
          .sort((a, b) => b.votes - a.votes);

        return (
          <div
            key={key}
            style={{
              padding: "12px",
              borderRadius: "10px",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, color, display: "flex", alignItems: "center", gap: "6px" }}>
              <Icon size={14} style={{ color }} />
              {label} ({colCards.length})
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="text"
                value={inputs[key]}
                onChange={(e) => setInputs((p) => ({ ...p, [key]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitSticky(key);
                  }
                }}
                placeholder={t.retro.stickyPlaceholder}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-editor)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                }}
              />
              <button
                type="button"
                onClick={() => submitSticky(key)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: color,
                  color: key === "sad" ? "#111827" : "#fff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t.retro.addStickyBtn}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto" }}>
              {colCards.map((card) => {
                const hasVoted = card.voters.includes(currentUser);
                return (
                  <div
                    key={card.id}
                    onClick={() => key !== "glad" && onPickForAction?.(card.text)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "7px",
                      backgroundColor: "var(--bg-sidebar)",
                      border: `1px solid ${hasVoted ? color : "var(--border-color)"}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      cursor: key !== "glad" && onPickForAction ? "pointer" : "default",
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "var(--text-primary)" }}>{card.text}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                      <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {card.author}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button
                          type="button"
                          title={t.retro.voteTooltip}
                          onClick={(e) => {
                            e.stopPropagation();
                            onVoteCard(card.id);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 7px",
                            borderRadius: "999px",
                            border: "1px solid var(--border-color)",
                            backgroundColor: hasVoted ? "rgba(99, 102, 241, 0.2)" : "var(--bg-panel)",
                            color: "var(--text-primary)",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <ThumbsUp size={11} style={{ color: "var(--accent-indigo)" }} />
                          +{card.votes}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCard(card.id);
                          }}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
