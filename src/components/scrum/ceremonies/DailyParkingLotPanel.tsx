"use client";

import React, { useState } from "react";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import type { DailyParkingLotItem } from "../../../types/scrumPolicy";
import type { CeremoniesCopy } from "./ceremoniesI18n";

export interface DailyParkingLotPanelProps {
  t: CeremoniesCopy;
  currentUser: string;
  items: DailyParkingLotItem[];
  onChangeItems: (next: DailyParkingLotItem[]) => void;
}

export function DailyParkingLotPanel({
  t,
  currentUser,
  items,
  onChangeItems,
}: DailyParkingLotPanelProps) {
  const [topic, setTopic] = useState("");
  const [who, setWho] = useState("");

  const handleAdd = () => {
    const clean = topic.trim();
    if (!clean) return;
    onChangeItems([
      ...items,
      {
        id: `PL-${Date.now()}`,
        topic: clean,
        participants: who.trim() || currentUser,
        resolved: false,
        createdAt: new Date().toISOString(),
      },
    ]);
    setTopic("");
    setWho("");
  };

  return (
    <div
      style={{
        padding: "14px",
        borderRadius: "10px",
        backgroundColor: "var(--bg-panel)",
        border: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: "var(--accent-yellow)",
        }}
      >
        <MessageSquarePlus size={15} />
        {t.daily.parkingLotTitle}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={t.daily.parkingTopicPlaceholder}
          style={{
            padding: "6px 8px",
            borderRadius: "6px",
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-editor)",
            color: "var(--text-primary)",
            fontSize: "12px",
          }}
        />
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            type="text"
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder={t.daily.parkingWhoPlaceholder}
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
            onClick={handleAdd}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--accent-indigo)",
              color: "#fff",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t.daily.addParkingBtn}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", flex: 1 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.daily.emptyParking}</div>
        ) : (
          items.map((pl) => (
            <div
              key={pl.id}
              style={{
                padding: "7px 9px",
                borderRadius: "6px",
                backgroundColor: "var(--bg-sidebar)",
                border: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", flex: 1 }}>
                <input
                  type="checkbox"
                  checked={pl.resolved}
                  onChange={() =>
                    onChangeItems(
                      items.map((x) => (x.id === pl.id ? { ...x, resolved: !x.resolved } : x))
                    )
                  }
                />
                <span
                  style={{
                    textDecoration: pl.resolved ? "line-through" : "none",
                    color: pl.resolved ? "var(--text-muted)" : "var(--text-primary)",
                  }}
                >
                  {pl.topic}{" "}
                  <strong style={{ color: "var(--accent-indigo)", fontSize: "11px" }}>{pl.participants}</strong>
                </span>
              </label>
              <button
                type="button"
                onClick={() => onChangeItems(items.filter((x) => x.id !== pl.id))}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
