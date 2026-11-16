"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Users,
  Eye,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Check,
} from "lucide-react";
import { AgileIssue, FIBONACCI_POINTS } from "../utils/issueEngine";

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

export const POKER_DECK = ["0", "1", "2", "3", "5", "8", "13", "21", "?", "☕"] as const;
export type PokerCardValue = (typeof POKER_DECK)[number];

const SIMULATED_PEERS = [
  "@developer-a",
  "@developer-b",
  "@scrummaster",
  "@product-owner",
];

const copy = {
  de: {
    title: "Scrum Planning Poker",
    subtitle: "Echtzeit-Aufwandsschätzung im Team (Room: mdteam-planning-poker)",
    liveYjs: "Yjs Live verbunden",
    connecting: "Verbinde Yjs...",
    offlineSim: "Lokale Team-Simulation (Offline-Fallback)",
    selectIssue: "Zu schätzendes Ticket auswählen",
    currentSp: "Aktuell",
    unestimated: "Ungeschätzt",
    noIssues: "Keine schätzbaren Tickets vorhanden.",
    tableTitle: "Schätztisch",
    votedHidden: "Gewählt",
    waitingVote: "Wartet...",
    revealBtn: "Karten aufdecken",
    resetBtn: "Neue Runde / Reset",
    simulateBtn: "Team-Stimmen simulieren",
    yourHand: "Deine Karte wählen (verdeckt bis zum Aufdecken)",
    averageLabel: "Durchschnitt",
    recommendedLabel: "Empfohlene Story Points",
    consensusFull: "Voller Konsens! Alle Stimmen identisch.",
    consensusClose: "Hohe Übereinstimmung (max. 1 Fibonacci-Stufe Abweichung).",
    consensusSpread: "Große Abweichung — Ausreißer im Team besprechen!",
    noNumericVotes: "Keine numerischen Karten aufgedeckt (?, ☕).",
    applyEstimate: "Schätzung übernehmen",
    appliedSuccess: "Story Points gespeichert!",
    acCount: "Akzeptanzkriterien",
    youBadge: "Du",
  },
  en: {
    title: "Scrum Planning Poker",
    subtitle: "Real-time Fibonacci estimation (Room: mdteam-planning-poker)",
    liveYjs: "Yjs Live Connected",
    connecting: "Connecting Yjs...",
    offlineSim: "Local Multi-Voter Simulation (Offline Fallback)",
    selectIssue: "Select Issue to Estimate",
    currentSp: "Current",
    unestimated: "Unestimated",
    noIssues: "No estimable issues available.",
    tableTitle: "Poker Table",
    votedHidden: "Voted",
    waitingVote: "Thinking...",
    revealBtn: "Reveal Cards",
    resetBtn: "Reset Votes",
    simulateBtn: "Simulate Team Votes",
    yourHand: "Pick Your Fibonacci Card (hidden until reveal)",
    averageLabel: "Average",
    recommendedLabel: "Final Story Points",
    consensusFull: "Full Consensus! Identical team estimates.",
    consensusClose: "Close Alignment (within 1 Fibonacci step).",
    consensusSpread: "High Variance — Discuss min/max outliers!",
    noNumericVotes: "No numeric cards revealed (?, ☕).",
    applyEstimate: "Apply Estimate",
    appliedSuccess: "Story Points saved!",
    acCount: "Acceptance Criteria",
    youBadge: "You",
  },
};

function nearestFibonacci(val: number): number {
  let best: number = FIBONACCI_POINTS[0];
  let bestDiff = Math.abs(val - best);
  for (const fib of FIBONACCI_POINTS) {
    const diff = Math.abs(val - fib);
    if (diff < bestDiff || (diff === bestDiff && fib > best)) {
      best = fib;
      bestDiff = diff;
    }
  }
  return best;
}

function generateSimulatedPeerVotes(
  issue: AgileIssue | undefined,
  userCard: PokerCardValue,
  meHandle: string
): Record<string, PokerCardValue> {
  const numericFibs: PokerCardValue[] = ["1", "2", "3", "5", "8", "13"];
  const userNum = Number(userCard);

  // Anchor around user's vote or issue heuristic complexity so simulation feels realistic
  let centerIdx = 2; // "3"
  if (Number.isFinite(userNum) && userNum > 0) {
    const found = numericFibs.indexOf(String(nearestFibonacci(userNum)) as PokerCardValue);
    if (found >= 0) centerIdx = found;
  } else if (issue) {
    const complexity =
      (issue.acceptanceCriteria?.length || 1) +
      (issue.priority === "critical" ? 2 : issue.priority === "high" ? 1 : 0);
    centerIdx = Math.min(numericFibs.length - 1, Math.max(0, Math.floor(complexity / 2)));
  }

  // Deterministic-ish hash from issue id + user card so votes don't flicker randomly
  const seedBase = (issue?.id || "MDT").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const peers = SIMULATED_PEERS.filter(
    (p) => p.toLowerCase() !== meHandle.toLowerCase()
  );

  const simVotes: Record<string, PokerCardValue> = {};
  peers.forEach((peer, idx) => {
    const offset = ((seedBase + idx * 7) % 3) - 1; // -1, 0, or +1 Fibonacci step
    const targetIdx = Math.max(0, Math.min(numericFibs.length - 1, centerIdx + offset));
    simVotes[peer] = numericFibs[targetIdx];
  });
  return simVotes;
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
  const t = copy[language] || copy.de;
  const meHandle = currentUser
    ? currentUser.startsWith("@")
      ? currentUser
      : `@${currentUser}`
    : "@developer-a";

  const estimableIssues = useMemo(
    () => issues.filter((i) => i.type !== "epic"),
    [issues]
  );

  const [selectedIssueId, setSelectedIssueId] = useState<string>("");
  const [votes, setVotes] = useState<Record<string, PokerCardValue>>({});
  const [revealed, setRevealed] = useState<boolean>(false);
  const [selectedPointsToApply, setSelectedPointsToApply] = useState<number>(3);
  const [appliedToast, setAppliedToast] = useState<boolean>(false);
  const [connState, setConnState] = useState<"connecting" | "live" | "offline">("offline");

  const yDocRef = useRef<any>(null);
  const yProviderRef = useRef<any>(null);
  const yVotesMapRef = useRef<any>(null);
  const yMetaMapRef = useRef<any>(null);

  // Initialize selected issue when modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (initialIssueId && estimableIssues.some((i) => i.id === initialIssueId)) {
      setSelectedIssueId(initialIssueId);
    } else {
      const firstUnestimated = estimableIssues.find((i) => !i.storyPoints || i.storyPoints === 0);
      setSelectedIssueId(firstUnestimated?.id || estimableIssues[0]?.id || "");
    }
    setVotes({});
    setRevealed(false);
    setAppliedToast(false);
  }, [isOpen, initialIssueId, estimableIssues.length]);

  // Connect to Yjs + y-websocket on room "mdteam-planning-poker" with instant offline fallback
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    let probeWs: WebSocket | null = null;
    let probeTimer: ReturnType<typeof setTimeout> | null = null;

    const setupYjsPoker = async () => {
      try {
        const Y = await import("yjs");
        const { WebsocketProvider } = await import("y-websocket");
        if (cancelled) return;

        const doc = new Y.Doc();
        yDocRef.current = doc;

        const votesMap = doc.getMap<PokerCardValue>("votes");
        const metaMap = doc.getMap<any>("meta");
        yVotesMapRef.current = votesMap;
        yMetaMapRef.current = metaMap;

        const syncFromYjs = () => {
          if (cancelled) return;
          const nextVotes: Record<string, PokerCardValue> = {};
          votesMap.forEach((val: PokerCardValue, key: string) => {
            nextVotes[key] = val;
          });
          setVotes(nextVotes);

          const rev = metaMap.get("revealed");
          if (typeof rev === "boolean") {
            setRevealed(rev);
          }
          const activeId = metaMap.get("issueId");
          if (typeof activeId === "string" && activeId) {
            setSelectedIssueId(activeId);
          }
        };

        votesMap.observe(syncFromYjs);
        metaMap.observe(syncFromYjs);

        // Create WebsocketProvider with connect: false first (BroadcastChannel works immediately across tabs!)
        const serverUrl = (yjsUrl || "").trim();
        const provider = new WebsocketProvider(
          serverUrl || "ws://localhost:1234",
          "mdteam-planning-poker",
          doc,
          { connect: false, maxBackoffTime: 2500 }
        );
        yProviderRef.current = provider;

        provider.awareness.setLocalStateField("user", {
          name: meHandle,
        });

        if (!serverUrl) {
          setConnState("offline");
          return;
        }

        setConnState("connecting");

        probeTimer = setTimeout(() => {
          if (probeWs && probeWs.readyState !== WebSocket.OPEN) {
            try {
              probeWs.close();
            } catch {}
            if (!cancelled) setConnState("offline");
          }
        }, 1200);

        probeWs = new WebSocket(serverUrl);
        probeWs.onopen = () => {
          if (probeTimer) clearTimeout(probeTimer);
          try {
            probeWs?.close();
          } catch {}
          if (cancelled) return;
          provider.on("status", (evt: { status: string }) => {
            if (!cancelled) {
              setConnState(evt.status === "connected" ? "live" : "offline");
            }
          });
          provider.connect();
          setConnState("live");
        };
        probeWs.onerror = () => {
          if (probeTimer) clearTimeout(probeTimer);
          if (!cancelled) setConnState("offline");
        };
      } catch {
        if (!cancelled) setConnState("offline");
      }
    };

    setupYjsPoker();

    return () => {
      cancelled = true;
      if (probeTimer) clearTimeout(probeTimer);
      if (probeWs) {
        try {
          probeWs.close();
        } catch {}
      }
      if (yProviderRef.current) {
        try {
          yProviderRef.current.destroy();
        } catch {}
        yProviderRef.current = null;
      }
      if (yDocRef.current) {
        try {
          yDocRef.current.destroy();
        } catch {}
        yDocRef.current = null;
      }
    };
  }, [isOpen, yjsUrl, meHandle]);

  const selectedIssue = useMemo(
    () => estimableIssues.find((i) => i.id === selectedIssueId) || estimableIssues[0],
    [estimableIssues, selectedIssueId]
  );

  // Compute statistics when revealed
  const stats = useMemo(() => {
    const entries = Object.entries(votes);
    const numericValues = entries
      .map(([, v]) => Number(v))
      .filter((n) => Number.isFinite(n));

    if (numericValues.length === 0) {
      return {
        average: null as number | null,
        recommended: selectedIssue?.storyPoints || 3,
        consensus: "none" as "full" | "close" | "spread" | "none",
        minVote: null as number | null,
        maxVote: null as number | null,
      };
    }

    const sum = numericValues.reduce((a, b) => a + b, 0);
    const avg = Number((sum / numericValues.length).toFixed(1));
    const rec = nearestFibonacci(avg);
    const minV = Math.min(...numericValues);
    const maxV = Math.max(...numericValues);

    const minIdx = FIBONACCI_POINTS.indexOf(nearestFibonacci(minV) as any);
    const maxIdx = FIBONACCI_POINTS.indexOf(nearestFibonacci(maxV) as any);
    const stepSpread = Math.abs(maxIdx - minIdx);

    const consensus: "full" | "close" | "spread" =
      minV === maxV ? "full" : stepSpread <= 1 ? "close" : "spread";

    return {
      average: avg,
      recommended: rec,
      consensus,
      minVote: minV,
      maxVote: maxV,
    };
  }, [votes, selectedIssue]);

  useEffect(() => {
    if (revealed && stats.recommended !== undefined) {
      setSelectedPointsToApply(stats.recommended);
    }
  }, [revealed, stats.recommended]);

  if (!isOpen) return null;

  const updateSharedVotes = (
    nextVotes: Record<string, PokerCardValue>,
    nextRevealed?: boolean,
    nextIssueId?: string
  ) => {
    setVotes(nextVotes);
    if (nextRevealed !== undefined) setRevealed(nextRevealed);
    if (nextIssueId !== undefined) setSelectedIssueId(nextIssueId);

    const doc = yDocRef.current;
    const votesMap = yVotesMapRef.current;
    const metaMap = yMetaMapRef.current;

    if (doc && votesMap && metaMap) {
      doc.transact(() => {
        // Clear removed keys
        Array.from(votesMap.keys() as Iterable<string>).forEach((k) => {
          if (!(k in nextVotes)) {
            votesMap.delete(k);
          }
        });
        Object.entries(nextVotes).forEach(([k, v]) => {
          votesMap.set(k, v);
        });
        if (nextRevealed !== undefined) {
          metaMap.set("revealed", nextRevealed);
        }
        if (nextIssueId !== undefined) {
          metaMap.set("issueId", nextIssueId);
        }
      });
    }
  };

  const handleCastCard = (card: PokerCardValue) => {
    setAppliedToast(false);
    let nextVotes: Record<string, PokerCardValue> = {
      ...votes,
      [meHandle]: card,
    };

    // In offline fallback mode (or if no peer has voted yet in single-user session), populate hidden peer votes
    if (connState === "offline") {
      const peerSim = generateSimulatedPeerVotes(selectedIssue, card, meHandle);
      nextVotes = { ...peerSim, [meHandle]: card };
    }

    updateSharedVotes(nextVotes);
  };

  const handleSimulatePeers = () => {
    const myCard = votes[meHandle] || "5";
    const peerSim = generateSimulatedPeerVotes(selectedIssue, myCard, meHandle);
    updateSharedVotes({ ...peerSim, ...votes, [meHandle]: votes[meHandle] || myCard });
  };

  const handleSelectIssueChange = (newId: string) => {
    setAppliedToast(false);
    updateSharedVotes({}, false, newId);
  };

  const handleReveal = () => {
    if (Object.keys(votes).length === 0 && connState === "offline") {
      const peerSim = generateSimulatedPeerVotes(selectedIssue, "5", meHandle);
      updateSharedVotes(peerSim, true);
      return;
    }
    updateSharedVotes(votes, true);
  };

  const handleReset = () => {
    setAppliedToast(false);
    updateSharedVotes({}, false);
  };

  const handleApply = () => {
    if (!selectedIssue) return;
    onApplyEstimate(selectedIssue, selectedPointsToApply);
    setAppliedToast(true);
    setTimeout(() => setAppliedToast(false), 2000);
  };

  // Build list of seated participants around the poker table
  const participants = Array.from(
    new Set([
      meHandle,
      ...Object.keys(votes),
      ...(connState === "offline" ? SIMULATED_PEERS : []),
    ])
  );

  const myVote = votes[meHandle];
  const anyVotesCast = Object.keys(votes).length > 0;

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
                    onClick={handleSimulatePeers}
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
                  onClick={handleReveal}
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
                  onClick={handleReset}
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
                    onChange={(e) => setSelectedPointsToApply(Number(e.target.value))}
                  >
                    {FIBONACCI_POINTS.map((pts) => (
                      <option key={pts} value={pts}>
                        {pts} SP
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleApply}
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
