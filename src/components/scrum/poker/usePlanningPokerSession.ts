"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { AgileIssue } from "../../../utils/issueEngine";
import {
  PokerCardValue,
  SIMULATED_PEERS,
  generateSimulatedPeerVotes,
  computePokerStats,
} from "./pokerI18nAndHelpers";

export interface UsePlanningPokerSessionParams {
  isOpen: boolean;
  issues: AgileIssue[];
  initialIssueId?: string;
  currentUser: string;
  yjsUrl?: string;
  onApplyEstimate: (issue: AgileIssue, storyPoints: number) => void;
}

export function usePlanningPokerSession({
  isOpen,
  issues,
  initialIssueId,
  currentUser,
  yjsUrl,
  onApplyEstimate,
}: UsePlanningPokerSessionParams) {
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

  const stats = useMemo(
    () => computePokerStats(votes, selectedIssue),
    [votes, selectedIssue]
  );

  useEffect(() => {
    if (revealed && stats.recommended !== undefined) {
      setSelectedPointsToApply(stats.recommended);
    }
  }, [revealed, stats.recommended]);

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

  const participants = Array.from(
    new Set([
      meHandle,
      ...Object.keys(votes),
      ...(connState === "offline" ? SIMULATED_PEERS : []),
    ])
  );

  return {
    meHandle,
    estimableIssues,
    selectedIssue,
    votes,
    myVote: votes[meHandle],
    anyVotesCast: Object.keys(votes).length > 0,
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
  };
}
