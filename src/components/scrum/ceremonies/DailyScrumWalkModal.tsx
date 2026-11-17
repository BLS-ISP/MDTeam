"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Flag,
  AlertOctagon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
} from "lucide-react";
import type { AgileIssue, AgileSprint, IssueStatus, WorkspaceFile } from "../../../utils/issueEngine";
import type { DailyParkingLotItem } from "../../../types/scrumPolicy";
import {
  getIssueSubtasks,
  loadParkingLotItems,
  serializeIssueWithCeremonyData,
  serializeParkingLotFile,
} from "../../../utils/scrum-rules/ceremonyIssueHelpers";
import { ceremoniesCopy } from "./ceremoniesI18n";
import { DailyParkingLotPanel } from "./DailyParkingLotPanel";

export interface DailyScrumWalkModalProps {
  isOpen: boolean;
  onClose: () => void;
  files?: WorkspaceFile[];
  issues: AgileIssue[];
  activeSprint?: AgileSprint;
  currentUser: string;
  language: "de" | "en";
  onUpsertFile: (file: WorkspaceFile) => void;
  onOpenIssue?: (issue: AgileIssue) => void;
}

const WALK_COLUMN_ORDER: Record<IssueStatus, number> = {
  review: 0,
  "in-progress": 1,
  ready: 2,
  done: 3,
  backlog: 4,
};

function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function DailyScrumWalkModal({
  isOpen,
  onClose,
  files,
  issues,
  activeSprint,
  currentUser,
  language,
  onUpsertFile,
  onOpenIssue,
}: DailyScrumWalkModalProps) {
  const t = ceremoniesCopy[language] || ceremoniesCopy.de;

  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const [running, setRunning] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [discussedIds, setDiscussedIds] = useState<Record<string, boolean>>({});
  const [blockerInput, setBlockerInput] = useState("");
  const [parkingItems, setParkingItems] = useState<DailyParkingLotItem[]>([]);

  // Walk the board strictly right-to-left: Review -> In Progress -> Ready
  const walkQueue = useMemo(() => {
    return (issues || [])
      .filter((i) => {
        if (i.type === "epic") return false;
        if (activeSprint && i.sprint.toLowerCase() !== activeSprint.id.toLowerCase()) return false;
        return i.status === "review" || i.status === "in-progress" || i.status === "ready";
      })
      .sort((a, b) => WALK_COLUMN_ORDER[a.status] - WALK_COLUMN_ORDER[b.status]);
  }, [issues, activeSprint]);

  useEffect(() => {
    if (!isOpen) {
      setRunning(false);
      return;
    }
    setActiveIndex(0);
    setBlockerInput("");
    setParkingItems(loadParkingLotItems(files));
  }, [isOpen, files]);

  useEffect(() => {
    if (!isOpen || !running) return;
    const handle = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(handle);
  }, [isOpen, running]);

  if (!isOpen) return null;

  const safeIdx = Math.min(activeIndex, Math.max(0, walkQueue.length - 1));
  const currentIssue = walkQueue[safeIdx] || null;
  const subtasks = currentIssue ? getIssueSubtasks(currentIssue, files) : [];

  const timerColor =
    secondsLeft < 60
      ? "var(--accent-red)"
      : secondsLeft < 180
      ? "var(--accent-yellow)"
      : "var(--accent-green)";

  const isCurrentBlocked = Boolean(
    currentIssue &&
      (currentIssue.blockedBy.length > 0 ||
        currentIssue.labels.some((l) => l.toLowerCase() === "blocked"))
  );

  const handleFlagBlocker = () => {
    if (!currentIssue) return;
    const note = blockerInput.trim() || "Impediment flagged in Daily Scrum";
    const idMatch = note.match(/^([A-Z]+-\d+)$/i);
    const nextBlockedBy = idMatch
      ? Array.from(new Set([...currentIssue.blockedBy, idMatch[1].toUpperCase()]))
      : currentIssue.blockedBy;
    const nextLabels = currentIssue.labels.some((l) => l.toLowerCase() === "blocked")
      ? currentIssue.labels
      : [...currentIssue.labels, "blocked"];
    const nowIso = new Date().toISOString();
    const updated: AgileIssue = {
      ...currentIssue,
      blockedBy: nextBlockedBy,
      labels: nextLabels,
      updatedAt: nowIso,
      comments: [
        ...(currentIssue.comments || []),
        {
          author: currentUser || "@scrum-master",
          timestamp: nowIso.slice(0, 16).replace("T", " "),
          text: `[DAILY-BLOCKER] ${note}`,
        },
      ],
    };
    onUpsertFile(serializeIssueWithCeremonyData(updated, files));
    setBlockerInput("");
  };

  const handleClearBlocker = () => {
    if (!currentIssue) return;
    const nowIso = new Date().toISOString();
    const updated: AgileIssue = {
      ...currentIssue,
      blockedBy: [],
      labels: currentIssue.labels.filter((l) => l.toLowerCase() !== "blocked"),
      updatedAt: nowIso,
    };
    onUpsertFile(serializeIssueWithCeremonyData(updated, files));
  };

  const syncParkingLot = (next: DailyParkingLotItem[]) => {
    setParkingItems(next);
    onUpsertFile(serializeParkingLotFile(next));
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(3px)",
        zIndex: 170,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(960px, 96vw)",
          maxHeight: "92vh",
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "14px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "var(--text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header + Live 15:00 Timer */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-panel)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: 700 }}>
              <Timer size={18} style={{ color: timerColor }} />
              {t.daily.title}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              {t.daily.walkOrderHint}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                padding: "5px 12px",
                borderRadius: "8px",
                border: `1px solid ${timerColor}`,
                backgroundColor: "var(--bg-sidebar)",
                color: timerColor,
                fontFamily: "var(--font-mono)",
                fontSize: "18px",
                fontWeight: 700,
              }}
            >
              {formatCountdown(secondsLeft)}
            </div>
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 11px", borderRadius: "6px", border: "none", backgroundColor: running ? "var(--accent-yellow)" : "var(--accent-indigo)", color: running ? "#111827" : "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              {running ? <Pause size={13} /> : <Play size={13} />}
              {running ? t.daily.timerPause : t.daily.timerStart}
            </button>
            <button
              type="button"
              onClick={() => {
                setRunning(false);
                setSecondsLeft(15 * 60);
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-sidebar)", color: "var(--text-secondary)", fontSize: "11px", cursor: "pointer" }}
            >
              <RotateCcw size={12} />
              {t.daily.timerReset}
            </button>
            <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", marginLeft: "4px" }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sprint Goal Banner */}
        <div style={{ padding: "9px 20px", backgroundColor: "rgba(16, 185, 129, 0.08)", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
          <Flag size={14} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
          <strong style={{ color: "var(--accent-green)" }}>{t.daily.sprintGoalBanner}</strong>
          <span>{activeSprint?.goal || "—"}</span>
        </div>

        {secondsLeft === 0 && (
          <div style={{ padding: "7px 20px", backgroundColor: "rgba(239, 68, 68, 0.18)", color: "var(--accent-red)", fontSize: "12px", fontWeight: 700 }}>
            {t.daily.overtimeAlert}
          </div>
        )}

        {/* Main Split: Walk Queue & Active Card (Left) + Parking Lot Scratchpad (Right) */}
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {!currentIssue ? (
              <div style={{ padding: "24px", borderRadius: "8px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "13px", textAlign: "center" }}>
                {t.daily.emptyWalk}
              </div>
            ) : (
              <>
                {/* Queue Pills */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {walkQueue.map((item, idx) => {
                    const active = idx === safeIdx;
                    const doneMark = Boolean(discussedIds[item.id]);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveIndex(idx)}
                        style={{
                          padding: "4px 9px",
                          borderRadius: "999px",
                          border: active ? "1px solid var(--accent-indigo)" : "1px solid var(--border-color)",
                          backgroundColor: active ? "rgba(99, 102, 241, 0.18)" : "var(--bg-panel)",
                          color: doneMark ? "var(--accent-green)" : "var(--text-primary)",
                          fontSize: "11px",
                          fontFamily: "var(--font-mono)",
                          fontWeight: active ? 700 : 500,
                          cursor: "pointer",
                        }}
                      >
                        {doneMark ? "✓ " : ""}
                        {item.id} [{item.status}]
                      </button>
                    );
                  })}
                </div>

                {/* Active Walk Card */}
                <div style={{ padding: "14px 16px", borderRadius: "10px", backgroundColor: "var(--bg-panel)", border: `1px solid ${isCurrentBlocked ? "rgba(239, 68, 68, 0.5)" : "var(--border-color)"}`, display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", padding: "2px 7px", borderRadius: "4px", backgroundColor: "var(--bg-active)", color: "var(--accent-blue)", marginRight: "8px" }}>
                        {currentIssue.status}
                      </span>
                      <strong style={{ fontFamily: "var(--font-mono)", color: "var(--accent-indigo)" }}>{currentIssue.id}</strong>
                      <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "4px" }}>{currentIssue.title}</div>
                    </div>
                    <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                      {currentIssue.assignee || "Unassigned"} • {currentIssue.storyPoints} SP
                    </span>
                  </div>

                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    AC: {currentIssue.acceptanceCriteria.filter((a) => a.checked).length}/{currentIssue.acceptanceCriteria.length}
                    {subtasks.length > 0 && ` • Subtasks: ${subtasks.filter((s) => s.done).length}/${subtasks.length}`}
                    {currentIssue.blockedBy.length > 0 && (
                      <span style={{ color: "var(--accent-red)", fontWeight: 700 }}>
                        {" "}• Blocked by: {currentIssue.blockedBy.join(", ")}
                      </span>
                    )}
                  </div>

                  {/* 1-Click Flag Blocker Input */}
                  <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "var(--bg-sidebar)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-red)", display: "flex", alignItems: "center", gap: "5px" }}>
                      <AlertOctagon size={13} />
                      {t.daily.flagBlockerTitle}
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <input
                        type="text"
                        value={blockerInput}
                        onChange={(e) => setBlockerInput(e.target.value)}
                        placeholder={t.daily.blockerInputPlaceholder}
                        style={{ flex: 1, padding: "6px 8px", borderRadius: "5px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-editor)", color: "var(--text-primary)", fontSize: "12px" }}
                      />
                      <button
                        type="button"
                        onClick={handleFlagBlocker}
                        style={{ padding: "6px 10px", borderRadius: "5px", border: "none", backgroundColor: "var(--accent-red)", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                      >
                        {t.daily.flagBlockerBtn}
                      </button>
                      {isCurrentBlocked && (
                        <button
                          type="button"
                          onClick={handleClearBlocker}
                          style={{ padding: "6px 10px", borderRadius: "5px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-panel)", color: "var(--accent-green)", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                        >
                          {t.daily.clearBlockerBtn}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Navigation Controls */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        disabled={safeIdx === 0}
                        onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-sidebar)", color: "var(--text-primary)", fontSize: "11px", cursor: safeIdx === 0 ? "default" : "pointer" }}
                      >
                        <ChevronLeft size={13} />
                        {t.daily.prevCard}
                      </button>
                      <button
                        type="button"
                        disabled={safeIdx >= walkQueue.length - 1}
                        onClick={() => setActiveIndex((i) => Math.min(walkQueue.length - 1, i + 1))}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 10px", borderRadius: "6px", border: "none", backgroundColor: "var(--accent-indigo)", color: "#fff", fontSize: "11px", fontWeight: 600, cursor: safeIdx >= walkQueue.length - 1 ? "default" : "pointer" }}
                      >
                        {t.daily.nextCard}
                        <ChevronRight size={13} />
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() =>
                          setDiscussedIds((p) => ({ ...p, [currentIssue.id]: !p[currentIssue.id] }))
                        }
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: discussedIds[currentIssue.id] ? "rgba(16, 185, 129, 0.16)" : "var(--bg-sidebar)", color: discussedIds[currentIssue.id] ? "var(--accent-green)" : "var(--text-secondary)", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                      >
                        <CheckCircle2 size={13} />
                        {discussedIds[currentIssue.id] ? t.daily.discussedDone : t.daily.markDiscussed}
                      </button>
                      {onOpenIssue && (
                        <button
                          type="button"
                          onClick={() => onOpenIssue(currentIssue)}
                          style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 9px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-sidebar)", color: "var(--text-secondary)", fontSize: "11px", cursor: "pointer" }}
                        >
                          <ExternalLink size={12} />
                          {t.daily.openTicketBtn}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DailyParkingLotPanel
            t={t}
            currentUser={currentUser}
            items={parkingItems}
            onChangeItems={syncParkingLot}
          />
        </div>
      </div>
    </div>
  );
}

export default DailyScrumWalkModal;
