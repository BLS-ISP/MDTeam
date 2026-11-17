import type { WorkspaceFile } from "../../types/workspace";
import {
  convertJiraWikiToMarkdown,
  normalizeDateString,
  normalizeIssuePriority,
  normalizeIssueStatus,
  normalizeIssueType,
  normalizeSprintName,
  normalizeUserHandle,
  splitDescriptionAndAcceptanceCriteria,
  type RawNormalizedIssue,
} from "./importerNormalizers";
import { finalizeIssuesToWorkspaceFiles, parseJiraCsvComment } from "./issueFinalizer";

export function parseRfc4180Csv(csvContent: string): string[][] {
  const clean = csvContent.replace(/^\uFEFF/, "");
  if (!clean.trim()) return [];

  // Detect delimiter on first logical header line outside quotes (comma default, semicolon fallback)
  let commaCount = 0;
  let semicolonCount = 0;
  let scanQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"') {
      scanQuotes = !scanQuotes;
    } else if (!scanQuotes) {
      if (ch === ",") commaCount++;
      else if (ch === ";") semicolonCount++;
      else if (ch === "\n" || ch === "\r") break;
    }
  }
  const delimiter = commaCount === 0 && semicolonCount >= 2 ? ";" : ",";

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < clean.length && clean[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (ch === "\r") {
        if (i + 1 < clean.length && clean[i + 1] === "\n") {
          i++;
        }
        currentField += "\n";
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"' && currentField.length === 0) {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(currentField);
        currentField = "";
      } else if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && i + 1 < clean.length && clean[i + 1] === "\n") {
          i++;
        }
        currentRow.push(currentField);
        currentField = "";
        if (currentRow.some((cell) => cell.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((cell) => cell.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function importJiraCsv(csvContent: string, projectPrefix?: string): WorkspaceFile[] {
  const rows = parseRfc4180Csv(csvContent);
  if (rows.length < 2) return [];

  const rawHeaders = rows[0].map((h) => h.trim().toLowerCase());

  const getAllByHeader = (row: string[], ...candidates: string[]): string[] => {
    const normalizedCandidates = candidates.map((c) => c.toLowerCase());
    const values: string[] = [];
    for (let colIdx = 0; colIdx < rawHeaders.length; colIdx++) {
      const header = rawHeaders[colIdx];
      if (normalizedCandidates.some((cand) => header === cand || header.startsWith(`${cand} (`))) {
        const cell = (row[colIdx] || "").trim();
        if (cell) values.push(cell);
      }
    }
    return values;
  };

  const getFirstByHeader = (row: string[], ...candidates: string[]): string => {
    const vals = getAllByHeader(row, ...candidates);
    return vals[0] || "";
  };

  const rawIssues: RawNormalizedIssue[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const summary = getFirstByHeader(row, "summary", "title", "zusammenfassung", "titel");
    const rawKey = getFirstByHeader(row, "issue key", "key", "issue id", "vorgangsschlüssel", "id");

    if (!summary && !rawKey) continue;

    const title = summary || rawKey;
    const type = normalizeIssueType(
      getFirstByHeader(row, "issue type", "issuetype", "type", "vorgangstyp", "typ")
    );
    const status = normalizeIssueStatus(getFirstByHeader(row, "status"));
    const priority = normalizeIssuePriority(getFirstByHeader(row, "priority", "priorität"));

    const spRaw = getFirstByHeader(
      row,
      "story points",
      "custom field (story points)",
      "custom field (story point estimate)",
      "story point estimate",
      "story_points",
      "aufwand"
    );
    const parsedSp = parseFloat(spRaw.replace(",", "."));
    const storyPoints = Number.isFinite(parsedSp) && parsedSp >= 0 ? Math.round(parsedSp) : 0;

    const assignee = normalizeUserHandle(getFirstByHeader(row, "assignee", "bearbeiter"));
    const reporter = normalizeUserHandle(getFirstByHeader(row, "reporter", "autor", "creator"));

    const labelCells = getAllByHeader(row, "labels", "label", "stichwörter");
    const labels = labelCells
      .flatMap((cell) => cell.split(/[,;\s]+/))
      .map((l) => l.trim())
      .filter(Boolean);

    const sprintCells = getAllByHeader(row, "sprint", "custom field (sprint)");
    const sprint = sprintCells.length > 0 ? normalizeSprintName(sprintCells[sprintCells.length - 1]) : "";

    const rawEpic = getFirstByHeader(
      row,
      "epic link",
      "custom field (epic link)",
      "parent key",
      "parent",
      "epic"
    );

    const blockedCells = getAllByHeader(
      row,
      "blocked by",
      "inward issue link (blocks)",
      "custom field (flagged)",
      "blocks"
    );
    const rawBlockedBy = blockedCells
      .flatMap((cell) => cell.split(/[,;\s]+/))
      .map((s) => s.trim())
      .filter((s) => /^[A-Za-z]+-\d+$/.test(s));

    const createdAt = normalizeDateString(getFirstByHeader(row, "created", "created_at", "erstellt"));
    const updatedAt = normalizeDateString(
      getFirstByHeader(row, "updated", "updated_at", "aktualisiert"),
      createdAt
    );

    const rawDescription = convertJiraWikiToMarkdown(
      getFirstByHeader(row, "description", "beschreibung")
    );
    const explicitAc = convertJiraWikiToMarkdown(
      getFirstByHeader(
        row,
        "acceptance criteria",
        "custom field (acceptance criteria)",
        "akzeptanzkriterien"
      )
    );
    const { cleanDescription, criteria } = splitDescriptionAndAcceptanceCriteria(
      rawDescription,
      explicitAc
    );

    const commentCells = getAllByHeader(row, "comment", "comments", "kommentar");
    const comments = commentCells
      .map((cell) => parseJiraCsvComment(cell))
      .filter((c): c is { author: string; timestamp: string; text: string } => c !== null);

    const explicitBranch = getFirstByHeader(row, "branch", "git branch");

    rawIssues.push({
      rawKey,
      type,
      title,
      description: cleanDescription,
      status,
      priority,
      storyPoints,
      sprint,
      rawEpic,
      assignee,
      reporter,
      labels,
      rawBlockedBy,
      branch: explicitBranch,
      createdAt,
      updatedAt,
      acceptanceCriteria: criteria,
      comments,
    });
  }

  return finalizeIssuesToWorkspaceFiles(rawIssues, projectPrefix);
}
