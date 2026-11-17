"use client";

import React from "react";
import {
  Users,
  Eye,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Check,
} from "lucide-react";
import { AgileIssue, FIBONACCI_POINTS } from "../../../utils/issueEngine";
import { PokerCardValue, PokerCopy, PokerStats } from "./pokerI18nAndHelpers";

export interface PlanningPokerTableProps {
  t: PokerCopy;
  connState: "connecting" | "live" | "offline";
  participants: string[];
  votes: Record<string, PokerCardValue>;
  meHandle: string;
  revealed: boolean;
  anyVotesCast: boolean;
  stats: PokerStats;
  selectedIssue: AgileIssue | undefined;
  selectedPointsToApply: number;
  appliedToast: boolean;
  onSetPointsToApply: (pts: number) => void;
  onSimulatePeers: () => void;
  onReveal: () => void;
  onReset: () => void;
  onApply: () => void;
}

export function PlanningPokerTable({
  t,
  connState,
  participants,
  votes,
  meHandle,
  revealed,
  anyVotesCast,
  stats,
  selectedIssue,
  selectedPointsToApply,
  appliedToast,
  onSetPointsToApply,
  onSimulatePeers,
  onReveal,
  onReset,
  onApply,
}: PlanningPokerTableProps) {
  return (
    <div
      style={{
        backgroundColor: "var(--bg-panel)",
        border: "1px solid var(--border-color)",
        borderRadius: "12px",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600 }}>
          <Users size={15} style={{ color: "var(--accent-indigo)" }} />
          <span>{t.tableTitle}</span>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {connState === "live" && (
            <button
              type="button"
              onClick={onSimulatePeers}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-sidebar)",
                color: "var(--text-secondary)",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              {t.simulateBtn}
            </button>
          )}

          <button
            type="button"
            onClick={onReveal}
            disabled={revealed && anyVotesCast}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: revealed ? "var(--bg-active)" : "var(--accent-indigo)",
              color: revealed ? "var(--text-muted)" : "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: revealed ? "default" : "pointer",
            }}
          >
            <Eye size={13} />
            {t.revealBtn}
          </button>

          <button
            type="button"
            onClick={onReset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-sidebar)",
              color: "var(--text-secondary)",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={13} />
            {t.resetBtn}
          </button>
        </div>
      </div>

      {/* Participant Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(125px, 1fr))",
          gap: "12px",
        }}
      >
        {participants.map((voter) => {
          const voterCard = votes[voter];
          const hasVoted = voterCard !== undefined;
          const isMe = voter.toLowerCase() === meHandle.toLowerCase();
          const isOutlier =
            revealed &&
            hasVoted &&
            stats.consensus === "spread" &&
            (Number(voterCard) === stats.minVote || Number(voterCard) === stats.maxVote);

          return (
            <div
              key={voter}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                padding: "12px 8px",
                borderRadius: "10px",
                backgroundColor: "var(--bg-sidebar)",
                border: isOutlier
                  ? "1px solid var(--accent-yellow)"
                  : isMe
                  ? "1px solid rgba(99, 102, 241, 0.5)"
                  : "1px solid var(--border-color)",
              }}
            >
              {/* Playing Card */}
              <div
                style={{
                  width: "58px",
                  height: "80px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: revealed && hasVoted ? "22px" : "15px",
                  fontWeight: 700,
                  transition: "all 0.2s ease",
                  background:
                    revealed && hasVoted
                      ? "linear-gradient(145deg, var(--bg-active), var(--bg-editor))"
                      : hasVoted
                      ? "linear-gradient(135deg, var(--accent-indigo), #4338ca)"
                      : "var(--bg-panel)",
                  border:
                    revealed && hasVoted
                      ? "2px solid var(--accent-indigo)"
                      : hasVoted
                      ? "2px solid rgba(255,255,255,0.2)"
                      : "1.5px dashed var(--border-color)",
                  color: hasVoted ? "#ffffff" : "var(--text-muted)",
                  boxShadow: hasVoted ? "var(--shadow-sm)" : "none",
                }}
              >
                {revealed && hasVoted ? voterCard : hasVoted ? "✓" : "…"}
              </div>

              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: isMe ? "var(--accent-indigo)" : "var(--text-primary)",
                  }}
                >
                  {voter} {isMe ? `(${t.youBadge})` : ""}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: hasVoted ? "var(--accent-green)" : "var(--text-muted)",
                  }}
                >
                  {revealed && hasVoted
                    ? `${voterCard} SP`
                    : hasVoted
                    ? t.votedHidden
                    : t.waitingVote}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revealed Consensus & Apply Estimate Panel */}
      {revealed && anyVotesCast && (
        <div
          style={{
            marginTop: "4px",
            padding: "14px 16px",
            borderRadius: "10px",
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                {t.averageLabel}:{" "}
                <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "15px" }}>
                  {stats.average !== null ? `${stats.average} SP` : "—"}
                </strong>
              </span>

              {stats.consensus === "full" && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "3px 10px",
                    borderRadius: "999px",
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    color: "var(--accent-green)",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  <CheckCircle2 size={13} /> {t.consensusFull}
                </span>
              )}

              {stats.consensus === "close" && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "3px 10px",
                    borderRadius: "999px",
                    backgroundColor: "rgba(99, 102, 241, 0.15)",
                    color: "var(--accent-indigo)",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  <CheckCircle2 size={13} /> {t.consensusClose}
                </span>
              )}

              {stats.consensus === "spread" && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "3px 10px",
                    borderRadius: "999px",
                    backgroundColor: "rgba(245, 158, 11, 0.15)",
                    color: "var(--accent-yellow)",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  <AlertTriangle size={13} /> {t.consensusSpread}
                </span>
              )}

              {stats.consensus === "none" && (
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {t.noNumericVotes}
                </span>
              )}
            </div>
          </div>

          {/* Final Fibonacci Selector + Apply Estimate Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
              {t.recommendedLabel}:
            </label>
            <select
              className="settings-select"
              style={{ width: "86px", fontFamily: "var(--font-mono)", fontWeight: 700 }}
              value={selectedPointsToApply}
              onChange={(e) => onSetPointsToApply(Number(e.target.value))}
            >
              {FIBONACCI_POINTS.map((pts) => (
                <option key={pts} value={pts}>
                  {pts} SP
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onApply}
              disabled={!selectedIssue}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: appliedToast ? "var(--accent-green)" : "var(--accent-indigo)",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                cursor: selectedIssue ? "pointer" : "not-allowed",
              }}
            >
              <Check size={14} />
              {appliedToast ? t.appliedSuccess : `${t.applyEstimate} (${selectedPointsToApply} SP)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
