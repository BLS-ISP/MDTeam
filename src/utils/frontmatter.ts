export interface ParsedFrontmatter {
  scalars: Record<string, string>;
  arrays: Record<string, string[]>;
  body: string;
  hasFrontmatter: boolean;
}

export type FrontmatterValue = string | number | boolean | string[] | undefined;

export function normalizePath(p: string): string {
  return (p || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

export function unquoteYamlString(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\");
  }
  return trimmed;
}

export function escapeYamlDoubleQuoted(val: string): string {
  return (val ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ")
    .trim();
}

export function escapeYamlString(val: string): string {
  const clean = (val ?? "").replace(/\r?\n/g, " ").trim();
  const escaped = clean.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function parseYamlArray(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]" || trimmed === "none" || trimmed === "null") {
    return [];
  }
  const inner =
    trimmed.startsWith("[") && trimmed.endsWith("]")
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  if (!inner) return [];

  const items: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if ((ch === '"' || ch === "'") && inner[i - 1] !== "\\") {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = ch;
      } else if (ch === quoteChar) {
        inQuotes = false;
        quoteChar = "";
      }
      current += ch;
    } else if (ch === "," && !inQuotes) {
      const cleaned = unquoteYamlString(current);
      if (cleaned) items.push(cleaned);
      current = "";
    } else {
      current += ch;
    }
  }
  const last = unquoteYamlString(current);
  if (last) items.push(last);
  return items;
}

export function serializeYamlArray(items: string[]): string {
  const valid = (items || []).map((s) => s.trim()).filter(Boolean);
  if (valid.length === 0) return "[]";
  return `[${valid.map((item) => escapeYamlString(item)).join(", ")}]`;
}

export function extractFrontmatter(markdown: string): ParsedFrontmatter {
  const normalized = (markdown || "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  let startIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const t = lines[i].trim();
    if (t === "---") {
      startIdx = i;
      break;
    }
    if (t !== "" && !t.startsWith("# ")) {
      break;
    }
  }

  if (startIdx === -1) {
    return { scalars: {}, arrays: {}, body: normalized, hasFrontmatter: false };
  }

  let endIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) {
    return { scalars: {}, arrays: {}, body: normalized, hasFrontmatter: false };
  }

  const scalars: Record<string, string> = {};
  const arrays: Record<string, string[]> = {};
  let activeListKey: string | null = null;

  for (let i = startIdx + 1; i < endIdx; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const listItemMatch = line.match(/^\s+-\s+(.*)$/);
    if (listItemMatch && activeListKey) {
      const itemVal = unquoteYamlString(listItemMatch[1]);
      if (itemVal) {
        if (!arrays[activeListKey]) arrays[activeListKey] = [];
        arrays[activeListKey].push(itemVal);
      }
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const rawVal = line.slice(colonIdx + 1).trim();
      if (rawVal === "") {
        activeListKey = key;
        if (!arrays[key]) arrays[key] = [];
        scalars[key] = "";
      } else {
        activeListKey = null;
        scalars[key] = unquoteYamlString(rawVal);
        if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
          arrays[key] = parseYamlArray(rawVal);
        }
      }
    }
  }

  const before = lines.slice(0, startIdx).join("\n").trim();
  const after = lines.slice(endIdx + 1).join("\n").trim();
  const body = [before, after].filter(Boolean).join("\n\n");

  return { scalars, arrays, body, hasFrontmatter: true };
}

function formatFrontmatterEntry(key: string, value: FrontmatterValue): string | null {
  if (value === undefined) return null;
  if (Array.isArray(value)) {
    return `${key}: ${serializeYamlArray(value)}`;
  }
  if (typeof value === "number") {
    return `${key}: ${Number.isFinite(value) ? value : 0}`;
  }
  if (typeof value === "boolean") {
    return `${key}: ${value}`;
  }
  return `${key}: ${escapeYamlString(value)}`;
}

export function serializeFrontmatter(fields: Record<string, FrontmatterValue>): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    const formatted = formatFrontmatterEntry(key, value);
    if (formatted !== null) {
      lines.push(formatted);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

export function upsertFrontmatter(
  markdown: string,
  updates: Record<string, FrontmatterValue>
): string {
  const parsed = extractFrontmatter(markdown);
  const merged: Record<string, FrontmatterValue> = {};

  for (const [key, val] of Object.entries(parsed.scalars)) {
    if (parsed.arrays[key]) {
      merged[key] = parsed.arrays[key];
    } else {
      merged[key] = val;
    }
  }

  for (const [rawKey, val] of Object.entries(updates)) {
    const key = rawKey.trim().toLowerCase();
    if (val === undefined) {
      delete merged[key];
    } else {
      merged[key] = val;
    }
  }

  const header = serializeFrontmatter(merged);
  const trimmedBody = parsed.body.trim();
  return trimmedBody ? `${header}\n\n${trimmedBody}\n` : `${header}\n`;
}
