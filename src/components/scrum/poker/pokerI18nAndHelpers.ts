import { AgileIssue, FIBONACCI_POINTS } from "../../../utils/issueEngine";

export const POKER_DECK = ["0", "1", "2", "3", "5", "8", "13", "21", "?", "☕"] as const;
export type PokerCardValue = (typeof POKER_DECK)[number];

export const SIMULATED_PEERS = [
  "@developer-a",
  "@developer-b",
  "@scrummaster",
  "@product-owner",
];

export interface PokerStats {
  average: number | null;
  recommended: number;
  consensus: "full" | "close" | "spread" | "none";
  minVote: number | null;
  maxVote: number | null;
}

export const pokerCopy = {
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

export type PokerCopy = typeof pokerCopy.de;

export function nearestFibonacci(val: number): number {
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

export function generateSimulatedPeerVotes(
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

export function computePokerStats(
  votes: Record<string, PokerCardValue>,
  selectedIssue: AgileIssue | undefined
): PokerStats {
  const entries = Object.entries(votes);
  const numericValues = entries
    .map(([, v]) => Number(v))
    .filter((n) => Number.isFinite(n));

  if (numericValues.length === 0) {
    return {
      average: null,
      recommended: selectedIssue?.storyPoints || 3,
      consensus: "none",
      minVote: null,
      maxVote: null,
    };
  }

  const sum = numericValues.reduce((a, b) => a + b, 0);
  const avg = Number((sum / numericValues.length).toFixed(1));
  const rec = nearestFibonacci(avg);
  const minV = Math.min(...numericValues);
  const maxV = Math.max(...numericValues);

  const minIdx = FIBONACCI_POINTS.indexOf(nearestFibonacci(minV) as (typeof FIBONACCI_POINTS)[number]);
  const maxIdx = FIBONACCI_POINTS.indexOf(nearestFibonacci(maxV) as (typeof FIBONACCI_POINTS)[number]);
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
}
