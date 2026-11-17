export function stripQuotes(val: string): string {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseYamlValue(rawVal: string): string | string[] {
  const trimmed = rawVal.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(",")
      .map((item) => stripQuotes(item))
      .filter(Boolean);
  }
  return stripQuotes(trimmed);
}

export function parseYamlLines(
  fmLines: string[]
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  let currentListKey: string | null = null;

  for (const rawLine of fmLines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("- ") && currentListKey) {
      const itemVal = stripQuotes(trimmed.slice(2));
      const existing = result[currentListKey];
      if (Array.isArray(existing)) {
        existing.push(itemVal);
      } else {
        result[currentListKey] = itemVal ? [itemVal] : [];
      }
      continue;
    }

    const colonIdx = rawLine.indexOf(":");
    if (colonIdx === -1) {
      currentListKey = null;
      continue;
    }

    const key = rawLine
      .slice(0, colonIdx)
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    const valPart = rawLine.slice(colonIdx + 1).trim();

    if (valPart === "") {
      currentListKey = key;
      result[key] = [];
    } else {
      currentListKey = null;
      result[key] = parseYamlValue(valPart);
    }
  }

  return result;
}

/**
 * Self-contained YAML frontmatter & markdown metadata extractor.
 * Supports both top-of-file YAML frontmatter and frontmatter blocks placed right below an H1 heading.
 */
export function extractFrontmatter(markdown: string): {
  frontmatter: Record<string, string | string[]>;
  body: string;
} {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  let startIdx = -1;
  let endIdx = -1;

  // Case 1: Standard frontmatter on line 0
  if (lines[0]?.trim() === "---") {
    startIdx = 0;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        endIdx = i;
        break;
      }
    }
  } else {
    // Case 2: H1 title followed by blank lines and a --- frontmatter block (e.g. ADR files)
    let cursor = 0;
    while (cursor < lines.length && lines[cursor].trim() === "") cursor++;
    if (cursor < lines.length && /^#\s+/.test(lines[cursor])) {
      cursor++;
      while (cursor < lines.length && lines[cursor].trim() === "") cursor++;
      if (cursor < lines.length && lines[cursor].trim() === "---") {
        startIdx = cursor;
        for (let i = cursor + 1; i < lines.length; i++) {
          if (lines[i].trim() === "---") {
            endIdx = i;
            break;
          }
        }
      }
    }
  }

  if (startIdx === -1 || endIdx === -1) {
    return { frontmatter: {}, body: normalized };
  }

  const fmLines = lines.slice(startIdx + 1, endIdx);
  const frontmatter = parseYamlLines(fmLines);
  const remaining = [
    ...lines.slice(0, startIdx),
    ...lines.slice(endIdx + 1),
  ].join("\n");

  return { frontmatter, body: remaining.trim() };
}

export function asString(
  val: string | string[] | undefined,
  fallback = ""
): string {
  if (val === undefined) return fallback;
  if (Array.isArray(val)) return val.join(", ");
  return val;
}

export function asStringArray(val: string | string[] | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((v) => v.trim()).filter(Boolean);
  return val
    .split(",")
    .map((v) => stripQuotes(v))
    .filter(Boolean);
}

export function normalizeStatus(raw: string): string {
  const clean = raw
    .trim()
    .toLowerCase()
    .replace(/==/g, "")
    .replace(/\s+/g, "-");
  if (!clean) return "draft";
  if (clean === "in_progress" || clean === "inprogress" || clean === "doing") {
    return "in-progress";
  }
  if (clean === "in_review" || clean === "inreview") {
    return "in-review";
  }
  if (clean === "akzeptiert" || clean === "accepted") {
    return "accepted";
  }
  if (clean === "abgeschlossen" || clean === "erledigt") {
    return "done";
  }
  if (clean === "vorgeschlagen") {
    return "proposed";
  }
  return clean;
}

export function extractFirstHeading(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

export function extractExcerpt(body: string): string {
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !l.startsWith("#") &&
        !l.startsWith("---") &&
        !l.startsWith("|") &&
        !l.startsWith("```")
    );
  const first = lines[0] || "";
  const stripped = first
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/==(.*?)==/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1");
  return stripped.length > 140 ? `${stripped.slice(0, 137)}...` : stripped;
}

export function extractAdrBodyStatus(body: string): string {
  const statusSec = body.match(/##\s+Status\s*\n+([^\n#]+)/i);
  if (!statusSec) return "";
  const rawLine = statusSec[1]
    .replace(/\(.*?\)/g, "")
    .replace(/==/g, "")
    .replace(/\*\*/g, "")
    .trim();
  return normalizeStatus(rawLine.split(/\s+/)[0] || "");
}
