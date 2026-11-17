"use client";

import React from "react";
import { X, Sparkles } from "lucide-react";
import { AgileIssue } from "../../../utils/issueEngine";
import { POKER_DECK, pokerCopy } from "./pokerI18nAndHelpers";
import { usePlanningPokerSession } from "./usePlanningPokerSession";
import { PlanningPokerTable } from "./PlanningPokerTable";

export interface PlanningPokerModalProps {
  isOpen: boolean;
  onClose: () => void;
  issues: AgileIssue[];
  initialIssueId?: string;
  currentUser: string;
  yjsUrl?: string;
  language: "de" | "en";
  onApplyEstimate: (issue: AgileIssue, storyPoints: number) => void;
}

export function PlanningPokerModal({
  isOpen,
  onClose,
  issues,
  initialIssueId,
  currentUser,
  yjsUrl,
  language,
  onApplyEstimate,
}: PlanningPokerModalProps) {
  const t = pokerCopy[language] || pokerCopy.de;

  const session = usePlanningPokerSession({
    isOpen,
    issues,
    initialIssueId,
    currentUser,
    yjsUrl,
    onApplyEstimate,
  });

  if (!isOpen) return null;

  const {
    meHandle,
    estimableIssues,
    selectedIssue,
    votes,
    myVote,
    anyVotesCast,
    revealed,
    selectedPointsToApply,
    setSelectedPointsToApply,
    appliedToast,
    connState,
    stats,
    participants,
    handleCastCard,
    handleSimulatePeers,
    handleSelectIssueChange,
    handleReveal,
    handleReset,
    handleApply,
  } = session;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(3px)",
        zIndex: 160,
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
          width: "min(820px, 96vw)",
          maxHeight: "92vh",
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "14px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "var(--text-primary)",
          fontFamily: "var(--font-sans)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Sparkles size={18} style={{ color: "var(--accent-indigo)" }} />
              <span style={{ fontSize: "16px", fontWeight: 700 }}>{t.title}</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 600,
                  backgroundColor:
                    connState === "live"
                      ? "rgba(16, 185, 129, 0.14)"
                      : connState === "connecting"
                      ? "rgba(59, 130, 246, 0.14)"
                      : "rgba(245, 158, 11, 0.14)",
                  color:
                    connState === "live"
                      ? "var(--accent-green)"
                      : connState === "connecting"
                      ? "var(--accent-blue)"
                      : "var(--accent-yellow)",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "currentColor",
                  }}
                />
                {connState === "live"
                  ? t.liveYjs
                  : connState === "connecting"
                  ? t.connecting
                  : t.offlineSim}
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>
              {t.subtitle}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "20px 22px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* Issue Picker */}
          <div
            style={{
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              borderRadius: "10px",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <label className="settings-label" style={{ marginBottom: 0 }}>
                {t.selectIssue}
              </label>
              {selectedIssue && (
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg-active)",
                    color: selectedIssue.storyPoints > 0 ? "var(--accent-indigo)" : "var(--text-muted)",
                    fontWeight: 700,
                  }}
                >
                  {t.currentSp}:{" "}
                  {selectedIssue.storyPoints > 0
                    ? `${selectedIssue.storyPoints} SP`
                    : t.unestimated}
                </span>
              )}
            </div>

            {estimableIssues.length === 0 ? (
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{t.noIssues}</div>
            ) : (
              <>
                <select
                  className="settings-select"
                  value={selectedIssue?.id || ""}
                  onChange={(e) => handleSelectIssueChange(e.target.value)}
                >
                  {estimableIssues.map((iss) => (
                    <option key={iss.id} value={iss.id}>
                      [{iss.id}] {iss.title} (
                      {iss.storyPoints > 0 ? `${iss.storyPoints} SP` : t.unestimated})
                    </option>
                  ))}
                </select>

                {selectedIssue && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {selectedIssue.description || selectedIssue.title}
                    </div>
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {selectedIssue.acceptanceCriteria.length} {t.acCount}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Poker Table Arena */}
          <PlanningPokerTable
            t={t}
            connState={connState}
            participants={participants}
            votes={votes}
            meHandle={meHandle}
            revealed={revealed}
            anyVotesCast={anyVotesCast}
            stats={stats}
            selectedIssue={selectedIssue}
            selectedPointsToApply={selectedPointsToApply}
            appliedToast={appliedToast}
            onSetPointsToApply={setSelectedPointsToApply}
            onSimulatePeers={handleSimulatePeers}
            onReveal={handleReveal}
            onReset={handleReset}
            onApply={handleApply}
          />

          {/* Interactive Fibonacci Card Deck */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.6px",
                color: "var(--text-secondary)",
              }}
            >
              {t.yourHand}
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                justifyContent: "center",
              }}
            >
              {POKER_DECK.map((card) => {
                const isSelected = myVote === card;
                return (
                  <button
                    key={card}
                    type="button"
                    onClick={() => handleCastCard(card)}
                    style={{
                      width: "58px",
                      height: "82px",
                      borderRadius: "10px",
                      border: isSelected
                        ? "2px solid var(--accent-indigo)"
                        : "1px solid var(--border-color)",
                      backgroundColor: isSelected
                        ? "rgba(99, 102, 241, 0.22)"
                        : "var(--bg-panel)",
                      color: isSelected ? "#ffffff" : "var(--text-primary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "19px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transform: isSelected ? "translateY(-6px)" : "translateY(0)",
                      boxShadow: isSelected ? "var(--shadow-md)" : "var(--shadow-sm)",
                      transition: "transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "2px",
                    }}
                  >
                    <span>{card}</span>
                    {Number.isFinite(Number(card)) && (
                      <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 500 }}>
                        SP
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlanningPokerModal;
