import type {
  ParsedQuery,
  QueryCondition,
  QueryOperator,
  QuerySource,
  QueryViewMode,
} from "./queryTypes";
import { stripQuotes } from "./queryFrontmatterExtractor";

function normalizeSourceToken(token: string): QuerySource | null {
  const t = token.trim().toLowerCase();
  if (t === "issue" || t === "issues" || t === "tickets" || t === "backlog") {
    return "issues";
  }
  if (t === "adr" || t === "adrs" || t === "decisions") {
    return "adrs";
  }
  if (t === "page" || t === "pages" || t === "docs" || t === "documents") {
    return "pages";
  }
  if (t === "roadmap" || t === "milestones") {
    return "roadmap";
  }
  if (t === "arc42") return "arc42";
  if (t === "wiki") return "wiki";
  if (t === "meeting" || t === "meetings") return "meetings";
  if (t === "sprint" || t === "sprints") return "sprints";
  if (t === "all" || t === "*") return "all";
  return null;
}

function parseWhereClause(whereExpr: string): QueryCondition[] {
  const conditions: QueryCondition[] = [];
  if (!whereExpr.trim()) return conditions;

  // Split by case-insensitive AND
  const parts = whereExpr.split(/\s+AND\s+/i);

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;

    // Handle `field IN (a, b, c)`
    const inMatch = part.match(/^([a-zA-Z0-9_.-]+)\s+IN\s*\(([^)]+)\)$/i);
    if (inMatch) {
      conditions.push({
        field: inMatch[1].trim().toLowerCase(),
        operator: "in",
        value: inMatch[2].trim(),
      });
      continue;
    }

    // Handle `field CONTAINS val`
    const containsMatch = part.match(
      /^([a-zA-Z0-9_.-]+)\s+CONTAINS\s+(.+)$/i
    );
    if (containsMatch) {
      conditions.push({
        field: containsMatch[1].trim().toLowerCase(),
        operator: "contains",
        value: stripQuotes(containsMatch[2]),
      });
      continue;
    }

    // Handle standard comparison operators: !=, !~, >=, <=, =, ~, >, <, :
    const opMatch = part.match(
      /^([a-zA-Z0-9_.-]+)\s*(!=|!~|>=|<=|=|~|>|<|:)\s*(.+)$/
    );
    if (opMatch) {
      const rawOp = opMatch[2] === ":" ? "=" : (opMatch[2] as QueryOperator);
      conditions.push({
        field: opMatch[1].trim().toLowerCase(),
        operator: rawOp,
        value: stripQuotes(opMatch[3]),
      });
    }
  }

  return conditions;
}

export function defaultSortDirectionForField(field: string): "asc" | "desc" {
  const f = field.toLowerCase();
  if (
    f === "priority" ||
    f === "updated_at" ||
    f === "updatedat" ||
    f === "updated" ||
    f === "created_at" ||
    f === "story_points" ||
    f === "points"
  ) {
    return "desc";
  }
  return "asc";
}

/**
 * Parses declarative multi-line ```query``` blocks as well as single-line shorthand
 * such as `issues where status=in-progress` or `FROM issues WHERE status != done AND epic = MDT-101`.
 */
export function parseQueryMacro(queryText: string): ParsedQuery {
  const cleaned = queryText
    .replace(/^```query\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const result: ParsedQuery = {
    source: "issues",
    conditions: [],
    sortField: "id",
    sortDirection: "asc",
    view: "table",
    raw: cleaned,
  };

  if (!cleaned) {
    return result;
  }

  const lines = cleaned
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));

  // Single-line shorthand detector (e.g., `issues where status=in-progress` or `FROM issues WHERE ... SORT ... VIEW ...`)
  if (lines.length === 1) {
    const single = lines[0];
    const clauseTokens = single.match(
      /^(?:FROM\s+)?([a-zA-Z*]+)(?:\s+WHERE\s+(.+?))?(?:\s+(?:SORT|ORDER\s+BY)\s+([a-zA-Z0-9_.-]+)(?:\s+(ASC|DESC))?)?(?:\s+VIEW\s+(table|cards|stats))?(?:\s+LIMIT\s+(\d+))?$/i
    );
    if (clauseTokens) {
      const src = normalizeSourceToken(clauseTokens[1]);
      if (src) {
        result.source = src;
        if (clauseTokens[2]) {
          result.conditions.push(...parseWhereClause(clauseTokens[2]));
        }
        if (clauseTokens[3]) {
          result.sortField = clauseTokens[3].toLowerCase();
          result.sortDirection = clauseTokens[4]
            ? (clauseTokens[4].toLowerCase() as "asc" | "desc")
            : defaultSortDirectionForField(result.sortField);
        }
        if (clauseTokens[5]) {
          result.view = clauseTokens[5].toLowerCase() as QueryViewMode;
        }
        if (clauseTokens[6]) {
          result.limit = Number.parseInt(clauseTokens[6], 10);
        }
        return result;
      }
    }

    // JQL-style single-line shorthand e.g. `issues status:in-progress type:bug`
    const spaceParts = single.split(/\s+/);
    const maybeSrc = normalizeSourceToken(spaceParts[0] || "");
    if (maybeSrc && spaceParts.length > 1) {
      result.source = maybeSrc;
      for (const tok of spaceParts.slice(1)) {
        result.conditions.push(...parseWhereClause(tok));
      }
      return result;
    }
  }

  // Multi-line declarative parser
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith("FROM ")) {
      const srcToken = line.slice(5).trim().split(/\s+/)[0] || "issues";
      const parsedSrc = normalizeSourceToken(srcToken);
      if (parsedSrc) {
        result.source = parsedSrc;
      } else {
        result.parseError = `Unknown source "${srcToken}"`;
      }
    } else if (upper.startsWith("WHERE ")) {
      result.conditions.push(...parseWhereClause(line.slice(6)));
    } else if (upper.startsWith("AND ")) {
      result.conditions.push(...parseWhereClause(line.slice(4)));
    } else if (upper.startsWith("SORT ") || upper.startsWith("ORDER BY ")) {
      const rest = upper.startsWith("ORDER BY ")
        ? line.slice(9).trim()
        : line.slice(5).trim();
      const parts = rest.split(/\s+/);
      if (parts[0]) {
        result.sortField = parts[0].toLowerCase();
        result.sortDirection =
          parts[1]?.toLowerCase() === "asc"
            ? "asc"
            : parts[1]?.toLowerCase() === "desc"
            ? "desc"
            : defaultSortDirectionForField(result.sortField);
      }
    } else if (upper.startsWith("VIEW ")) {
      const v = line.slice(5).trim().toLowerCase();
      if (v === "table" || v === "cards" || v === "stats") {
        result.view = v;
      }
    } else if (upper.startsWith("LIMIT ")) {
      const n = Number.parseInt(line.slice(6).trim(), 10);
      if (Number.isFinite(n) && n > 0) {
        result.limit = n;
      }
    } else if (upper.startsWith("COLUMNS ") || upper.startsWith("SELECT ")) {
      const rest = upper.startsWith("COLUMNS ")
        ? line.slice(8)
        : line.slice(7);
      result.columns = rest
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
    } else {
      // Bare source name on first line (e.g. `issues`)
      const bareSrc = normalizeSourceToken(line);
      if (bareSrc) {
        result.source = bareSrc;
      } else {
        const fallbackConds = parseWhereClause(line);
        if (fallbackConds.length > 0) {
          result.conditions.push(...fallbackConds);
        }
      }
    }
  }

  return result;
}
