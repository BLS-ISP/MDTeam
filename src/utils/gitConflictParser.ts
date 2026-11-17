export type ConflictResolutionStrategy = "ours" | "theirs" | "both";

export interface GitConflictHunk {
  index: number;
  startLine: number;
  endLine: number;
  oursLabel: string;
  theirsLabel: string;
  baseLabel?: string;
  oursContent: string;
  theirsContent: string;
  baseContent?: string;
  rawBlock: string;
}

export interface ParsedGitConflicts {
  hasConflicts: boolean;
  hunks: GitConflictHunk[];
  oursFullContent: string;
  theirsFullContent: string;
  bothFullContent: string;
}

const START_MARKER_RE = /^<{7}(?:\s+(.*))?$/;
const BASE_MARKER_RE = /^\|{7}(?:\s+(.*))?$/;
const SEP_MARKER_RE = /^={7}\s*$/;
const END_MARKER_RE = /^>{7}(?:\s+(.*))?$/;
const LEFTOVER_MARKER_RE = /^(?:<{7}|>{7}|\|{7})(?:\s|$)/m;

/**
 * Checks whether a Markdown/text string contains Git conflict hunks or any
 * leftover `<<<<<<<` / `|||||||` / `>>>>>>>` conflict markers.
 */
export function hasConflictMarkers(content: string): boolean {
  if (!content) return false;
  return LEFTOVER_MARKER_RE.test(content) || parseGitConflictMarkers(content).hasConflicts;
}

/**
 * Pure line-by-line parser detecting standard (`<<<<<<<` / `=======` / `>>>>>>>`)
 * and diff3 (`|||||||`) conflict hunks in Markdown and text documents.
 * Standalone `=======` Markdown Setext headings outside conflict blocks are preserved untouched.
 */
export function parseGitConflictMarkers(rawContent: string): ParsedGitConflicts {
  if (!rawContent) {
    return { hasConflicts: false, hunks: [], oursFullContent: "", theirsFullContent: "", bothFullContent: "" };
  }

  const eol = rawContent.includes("\r\n") ? "\r\n" : "\n";
  const lines = rawContent.split(/\r?\n/);
  const hunks: GitConflictHunk[] = [];
  const oursDocLines: string[] = [];
  const theirsDocLines: string[] = [];
  const bothDocLines: string[] = [];

  let phase: "normal" | "ours" | "base" | "theirs" = "normal";
  let startLine = 0;
  let oursLabel = "";
  let baseLabel: string | undefined;
  let oursLines: string[] = [];
  let baseLines: string[] = [];
  let theirsLines: string[] = [];
  let rawBlockLines: string[] = [];

  const resetBlock = () => {
    phase = "normal";
    baseLabel = undefined;
    oursLines = [];
    baseLines = [];
    theirsLines = [];
    rawBlockLines = [];
  };

  const flushUnclosedAsNormal = () => {
    oursDocLines.push(...rawBlockLines);
    theirsDocLines.push(...rawBlockLines);
    bothDocLines.push(...rawBlockLines);
    resetBlock();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (phase === "normal") {
      const startMatch = START_MARKER_RE.exec(line);
      if (startMatch) {
        phase = "ours";
        startLine = lineNo;
        oursLabel = (startMatch[1] ?? "").trim() || "HEAD";
        rawBlockLines = [line];
      } else {
        oursDocLines.push(line);
        theirsDocLines.push(line);
        bothDocLines.push(line);
      }
      continue;
    }

    const nestedStart = START_MARKER_RE.exec(line);
    if (nestedStart) {
      flushUnclosedAsNormal();
      phase = "ours";
      startLine = lineNo;
      oursLabel = (nestedStart[1] ?? "").trim() || "HEAD";
      rawBlockLines = [line];
      continue;
    }

    rawBlockLines.push(line);

    if (phase === "ours") {
      const baseMatch = BASE_MARKER_RE.exec(line);
      if (baseMatch) {
        phase = "base";
        baseLabel = (baseMatch[1] ?? "").trim() || "base";
      } else if (SEP_MARKER_RE.test(line)) {
        phase = "theirs";
      } else {
        oursLines.push(line);
      }
    } else if (phase === "base") {
      if (SEP_MARKER_RE.test(line)) {
        phase = "theirs";
      } else {
        baseLines.push(line);
      }
    } else {
      const endMatch = END_MARKER_RE.exec(line);
      if (endMatch) {
        hunks.push({
          index: hunks.length,
          startLine,
          endLine: lineNo,
          oursLabel,
          theirsLabel: (endMatch[1] ?? "").trim() || "incoming",
          ...(baseLabel !== undefined ? { baseLabel, baseContent: baseLines.join(eol) } : {}),
          oursContent: oursLines.join(eol),
          theirsContent: theirsLines.join(eol),
          rawBlock: rawBlockLines.join(eol),
        });
        oursDocLines.push(...oursLines);
        theirsDocLines.push(...theirsLines);
        bothDocLines.push(...oursLines, ...theirsLines);
        resetBlock();
      } else {
        theirsLines.push(line);
      }
    }
  }

  if (phase !== "normal") flushUnclosedAsNormal();

  return {
    hasConflicts: hunks.length > 0,
    hunks,
    oursFullContent: oursDocLines.join(eol),
    theirsFullContent: theirsDocLines.join(eol),
    bothFullContent: bothDocLines.join(eol),
  };
}

/**
 * Resolves every conflict hunk in `rawContent` according to `"ours" | "theirs" | "both"`,
 * returning clean Markdown with zero conflict markers.
 */
export function resolveAllConflictHunks(
  rawContent: string,
  strategy: ConflictResolutionStrategy
): string {
  const parsed = parseGitConflictMarkers(rawContent);
  if (!parsed.hasConflicts) return rawContent;
  if (strategy === "ours") return parsed.oursFullContent;
  if (strategy === "theirs") return parsed.theirsFullContent;
  return parsed.bothFullContent;
}

/**
 * Resolves a single conflict hunk by 0-based `hunkIndex` while keeping other hunks intact.
 */
export function resolveSingleConflictHunk(
  rawContent: string,
  hunkIndex: number,
  strategy: ConflictResolutionStrategy
): string {
  const eol = rawContent.includes("\r\n") ? "\r\n" : "\n";
  const target = parseGitConflictMarkers(rawContent).hunks[hunkIndex];
  if (!target) return rawContent;
  const lines = rawContent.split(/\r?\n/);
  const rep =
    strategy === "ours"
      ? target.oursContent
      : strategy === "theirs"
        ? target.theirsContent
        : [target.oursContent, target.theirsContent].filter(Boolean).join(eol);
  const mid = rep === "" ? [] : rep.split(/\r?\n/);
  return [...lines.slice(0, target.startLine - 1), ...mid, ...lines.slice(target.endLine)].join(eol);
}
