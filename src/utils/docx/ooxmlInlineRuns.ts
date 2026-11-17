import { escapeXml } from "./zipBuilder";

export interface FrontmatterPair {
  key: string;
  value: string;
}

export function extractFrontmatterForDocx(markdown: string): {
  metadata: FrontmatterPair[];
  body: string;
} {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  let startIdx = -1;
  let endIdx = -1;

  if (lines[0]?.trim() === "---") {
    startIdx = 0;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        endIdx = i;
        break;
      }
    }
  } else {
    // Support `# Heading` followed immediately by `--- ... ---` (e.g. ADRs)
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
    return { metadata: [], body: normalized };
  }

  const fmLines = lines.slice(startIdx + 1, endIdx);
  const metadata: FrontmatterPair[] = [];
  let activeKey: string | null = null;

  for (const rawLine of fmLines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("- ") && activeKey) {
      const itemVal = trimmed.slice(2).trim().replace(/^["']|["']$/g, "");
      const prev = metadata[metadata.length - 1];
      if (prev && prev.key === activeKey) {
        prev.value = prev.value ? `${prev.value}, ${itemVal}` : itemVal;
      }
      continue;
    }

    const colonIdx = rawLine.indexOf(":");
    if (colonIdx === -1) {
      activeKey = null;
      continue;
    }

    const rawKey = rawLine.slice(0, colonIdx).trim();
    let rawVal = rawLine.slice(colonIdx + 1).trim();
    if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
      rawVal = rawVal
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
        .join(", ");
    } else {
      rawVal = rawVal.replace(/^["']|["']$/g, "");
    }

    activeKey = rawKey;
    metadata.push({ key: rawKey, value: rawVal });
  }

  const remaining = [
    ...lines.slice(0, startIdx),
    ...lines.slice(endIdx + 1),
  ].join("\n");

  return { metadata, body: remaining.trim() };
}

export interface InlineRunOptions {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  highlight?: boolean;
  color?: string;
  underline?: boolean;
  fontSizeHalfPt?: number;
}

export interface HyperlinkRegistry {
  registerExternalUrl: (url: string) => string;
}

export function buildRunXml(text: string, opts: InlineRunOptions = {}): string {
  if (!text) return "";
  const rPrParts: string[] = [];

  // Strict ECMA-376 <w:rPr> element ordering:
  // rFonts -> b -> i -> strike -> u -> bdr -> color -> sz -> szCs -> shd
  if (opts.code) {
    rPrParts.push(
      '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>'
    );
  }
  if (opts.bold) {
    rPrParts.push("<w:b/>");
  }
  if (opts.italic) {
    rPrParts.push("<w:i/>");
  }
  if (opts.strike) {
    rPrParts.push("<w:strike/>");
  }
  if (opts.underline) {
    rPrParts.push('<w:u w:val="single"/>');
  }
  if (opts.color) {
    rPrParts.push(`<w:color w:val="${escapeXml(opts.color)}"/>`);
  } else if (opts.code) {
    rPrParts.push('<w:color w:val="BE185D"/>');
  }
  if (opts.fontSizeHalfPt) {
    rPrParts.push(`<w:sz w:val="${opts.fontSizeHalfPt}"/>`);
    rPrParts.push(`<w:szCs w:val="${opts.fontSizeHalfPt}"/>`);
  } else if (opts.code) {
    rPrParts.push('<w:sz w:val="20"/><w:szCs w:val="20"/>');
  }
  if (opts.code) {
    rPrParts.push('<w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/>');
  } else if (opts.highlight) {
    rPrParts.push('<w:shd w:val="clear" w:color="auto" w:fill="FEF08A"/>');
  }

  const rPrXml = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : "";
  return `<w:r>${rPrXml}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/**
 * Tokenizes inline Markdown (`***bolditalic***`, `**bold**`, `*italic*`, `` `code` ``,
 * `~~strike~~`, `==highlight==`, `![alt](src)`, `[label](url)`) into OOXML runs.
 */
export function renderInlineRuns(
  input: string,
  links: HyperlinkRegistry,
  baseOpts: InlineRunOptions = {}
): string {
  if (!input) return "";

  const tokenRegex =
    /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*\*([^*]+)\*\*\*)|(___([^_]+)___)|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(~~([^~]+)~~)|(==([^=]+)==)|(\*([^*\n]+)\*)|(_([^_\n]+)_)/g;

  const chunks: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      chunks.push(buildRunXml(input.slice(lastIndex, match.index), baseOpts));
    }

    if (match[1] !== undefined) {
      // Image ![alt](src) -> concise caption so data-URLs never flood text
      const alt = match[2]?.trim() || "image";
      const srcHint = match[3]?.startsWith("data:")
        ? "embedded screenshot"
        : match[3]?.trim() || "";
      const caption = srcHint ? `[Image: ${alt} (${srcHint})]` : `[Image: ${alt}]`;
      chunks.push(
        buildRunXml(caption, {
          ...baseOpts,
          italic: true,
          color: "4F46E5",
        })
      );
    } else if (match[4] !== undefined) {
      // Link [label](url)
      const label = match[5];
      const url = match[6].trim();
      if (/^(https?:\/\/|mailto:)/i.test(url)) {
        const rId = links.registerExternalUrl(url);
        const innerRun = buildRunXml(label, {
          ...baseOpts,
          color: "2563EB",
          underline: true,
        });
        chunks.push(`<w:hyperlink r:id="${escapeXml(rId)}">${innerRun}</w:hyperlink>`);
      } else {
        chunks.push(
          buildRunXml(label, {
            ...baseOpts,
            color: "4F46E5",
            underline: true,
          })
        );
      }
    } else if (match[7] !== undefined) {
      // Inline code `...`
      chunks.push(buildRunXml(match[8], { ...baseOpts, code: true }));
    } else if (match[9] !== undefined || match[11] !== undefined) {
      // Bold + Italic ***...*** or ___...___
      const content = match[10] ?? match[12] ?? "";
      chunks.push(
        buildRunXml(content, { ...baseOpts, bold: true, italic: true })
      );
    } else if (match[13] !== undefined || match[15] !== undefined) {
      // Bold **...** or __...__
      const content = match[14] ?? match[16] ?? "";
      chunks.push(buildRunXml(content, { ...baseOpts, bold: true }));
    } else if (match[17] !== undefined) {
      // Strikethrough ~~...~~
      chunks.push(buildRunXml(match[18], { ...baseOpts, strike: true }));
    } else if (match[19] !== undefined) {
      // Highlight ==...==
      chunks.push(buildRunXml(match[20], { ...baseOpts, highlight: true }));
    } else if (match[21] !== undefined || match[23] !== undefined) {
      // Italic *...* or _..._
      const content = match[22] ?? match[24] ?? "";
      chunks.push(buildRunXml(content, { ...baseOpts, italic: true }));
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < input.length) {
    chunks.push(buildRunXml(input.slice(lastIndex), baseOpts));
  }

  return chunks.join("");
}
