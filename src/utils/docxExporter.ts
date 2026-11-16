/**
 * Pure TypeScript, zero-dependency Microsoft Word (.docx / ECMA-376 OpenXML) exporter.
 * Builds a standards-compliant Stored (method 0) + IEEE 802.3 CRC-32 ZIP package containing:
 *   - [Content_Types].xml
 *   - _rels/.rels
 *   - word/_rels/document.xml.rels
 *   - word/styles.xml
 *   - word/document.xml
 */

const UTF8_ENCODER = new TextEncoder();

// Precomputed IEEE 802.3 CRC-32 lookup table (polynomial 0xEDB88320)
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Escapes text for safe inclusion inside XML elements and attributes,
 * stripping illegal XML 1.0 control characters.
 */
export function escapeXml(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface ZipEntryInput {
  name: string;
  data: Uint8Array;
}

function getDosDateTime(date = new Date()): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

/**
 * Packs files into a standards-compliant Stored (method 0) PKZIP archive.
 */
function buildStoredZip(entries: ZipEntryInput[]): Uint8Array {
  const { dosTime, dosDate } = getDosDateTime();

  const prepared = entries.map((entry) => {
    const cleanName = entry.name.replace(/^\/+/, "");
    const nameBytes = UTF8_ENCODER.encode(cleanName);
    const crc = computeCrc32(entry.data);
    return {
      nameBytes,
      data: entry.data,
      crc,
    };
  });

  let localSectionSize = 0;
  let centralDirSize = 0;
  for (const item of prepared) {
    localSectionSize += 30 + item.nameBytes.byteLength + item.data.byteLength;
    centralDirSize += 46 + item.nameBytes.byteLength;
  }

  const totalSize = localSectionSize + centralDirSize + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  const localOffsets: number[] = [];
  let offset = 0;

  // 1. Write Local File Headers + File Payloads
  for (const item of prepared) {
    localOffsets.push(offset);
    const nameLen = item.nameBytes.byteLength;
    const dataLen = item.data.byteLength;

    view.setUint32(offset + 0, 0x04034b50, true); // Local file header signature
    view.setUint16(offset + 4, 20, true); // Version needed to extract (2.0)
    view.setUint16(offset + 6, 0x0800, true); // General purpose bit flag (UTF-8 filenames)
    view.setUint16(offset + 8, 0, true); // Compression method: 0 (Stored)
    view.setUint16(offset + 10, dosTime, true);
    view.setUint16(offset + 12, dosDate, true);
    view.setUint32(offset + 14, item.crc, true);
    view.setUint32(offset + 18, dataLen, true); // Compressed size
    view.setUint32(offset + 22, dataLen, true); // Uncompressed size
    view.setUint16(offset + 26, nameLen, true);
    view.setUint16(offset + 28, 0, true); // Extra field length
    offset += 30;

    out.set(item.nameBytes, offset);
    offset += nameLen;

    out.set(item.data, offset);
    offset += dataLen;
  }

  const centralDirOffset = offset;

  // 2. Write Central Directory Headers
  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i];
    const nameLen = item.nameBytes.byteLength;
    const dataLen = item.data.byteLength;

    view.setUint32(offset + 0, 0x02014b50, true); // Central file header signature
    view.setUint16(offset + 4, 20, true); // Version made by
    view.setUint16(offset + 6, 20, true); // Version needed to extract
    view.setUint16(offset + 8, 0x0800, true); // UTF-8 flag
    view.setUint16(offset + 10, 0, true); // Stored
    view.setUint16(offset + 12, dosTime, true);
    view.setUint16(offset + 14, dosDate, true);
    view.setUint32(offset + 16, item.crc, true);
    view.setUint32(offset + 20, dataLen, true);
    view.setUint32(offset + 24, dataLen, true);
    view.setUint16(offset + 28, nameLen, true);
    view.setUint16(offset + 30, 0, true); // Extra field length
    view.setUint16(offset + 32, 0, true); // File comment length
    view.setUint16(offset + 34, 0, true); // Disk number start
    view.setUint16(offset + 36, 0, true); // Internal file attributes
    view.setUint32(offset + 38, 0, true); // External file attributes
    view.setUint32(offset + 42, localOffsets[i], true); // Local header offset
    offset += 46;

    out.set(item.nameBytes, offset);
    offset += nameLen;
  }

  // 3. Write End of Central Directory Record (EOCD)
  view.setUint32(offset + 0, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true); // Disk number
  view.setUint16(offset + 6, 0, true); // Disk with central dir
  view.setUint16(offset + 8, prepared.length, true); // Entries on disk
  view.setUint16(offset + 10, prepared.length, true); // Total entries
  view.setUint32(offset + 12, centralDirSize, true); // Central dir byte size
  view.setUint32(offset + 16, centralDirOffset, true); // Central dir start offset
  view.setUint16(offset + 20, 0, true); // Comment length

  return out;
}

interface FrontmatterPair {
  key: string;
  value: string;
}

function extractFrontmatterForDocx(markdown: string): {
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

interface InlineRunOptions {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  highlight?: boolean;
  color?: string;
  underline?: boolean;
  fontSizeHalfPt?: number;
}

function buildRunXml(text: string, opts: InlineRunOptions = {}): string {
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

interface HyperlinkRegistry {
  registerExternalUrl: (url: string) => string;
}

/**
 * Tokenizes inline Markdown (`***bolditalic***`, `**bold**`, `*italic*`, `` `code` ``,
 * `~~strike~~`, `==highlight==`, `![alt](src)`, `[label](url)`) into OOXML runs.
 */
function renderInlineRuns(
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

function splitMarkdownTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);

  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "\\" && trimmed[i + 1] === "|") {
      current += "|";
      i++;
    } else if (trimmed[i] === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += trimmed[i];
    }
  }
  cells.push(current.trim());
  return cells;
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|") && !trimmed.includes("-")) return false;
  const cells = splitMarkdownTableRow(trimmed);
  return (
    cells.length > 0 &&
    cells.every((c) => /^:?-{2,}:?$/.test(c.trim()))
  );
}

function parseColumnAlignments(
  sepLine: string,
  colCount: number
): ("left" | "center" | "right")[] {
  const cells = splitMarkdownTableRow(sepLine);
  const alignments: ("left" | "center" | "right")[] = [];
  for (let i = 0; i < colCount; i++) {
    const raw = (cells[i] || "").trim();
    if (raw.startsWith(":") && raw.endsWith(":")) {
      alignments.push("center");
    } else if (raw.endsWith(":")) {
      alignments.push("right");
    } else {
      alignments.push("left");
    }
  }
  return alignments;
}

function formatMetaKey(rawKey: string): string {
  return rawKey
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function renderMetadataTableXml(
  metadata: FrontmatterPair[],
  links: HyperlinkRegistry
): string {
  if (metadata.length === 0) return "";

  const rowsXml = metadata.map((pair) => {
    const keyRun = buildRunXml(formatMetaKey(pair.key), {
      bold: true,
      color: "312E81",
      fontSizeHalfPt: 20,
    });
    const valRuns = renderInlineRuns(pair.value || "–", links, {
      color: "1F2937",
      fontSizeHalfPt: 20,
    });

    return `<w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="2600" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="EEF2FF"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>${keyRun}</w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="6760" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="F9FAFB"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>${valRuns}</w:p>
      </w:tc>
    </w:tr>`;
  });

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9360" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="C7D2FE"/>
        <w:left w:val="single" w:sz="6" w:space="0" w:color="C7D2FE"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="C7D2FE"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="C7D2FE"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E0E7FF"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E0E7FF"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="80" w:type="dxa"/>
        <w:left w:w="140" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:right w:w="140" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="2600"/>
      <w:gridCol w:w="6760"/>
    </w:tblGrid>
    ${rowsXml.join("")}
  </w:tbl>
  <w:p><w:pPr><w:spacing w:before="60" w:after="120"/></w:pPr></w:p>`;
}

function renderMarkdownTableXml(
  headerCells: string[],
  alignments: ("left" | "center" | "right")[],
  bodyRows: string[][],
  links: HyperlinkRegistry
): string {
  const colCount = Math.max(
    headerCells.length,
    ...bodyRows.map((r) => r.length),
    1
  );
  const totalWidthDxa = 9360;
  const colWidth = Math.floor(totalWidthDxa / colCount);

  const gridCols = Array.from({ length: colCount })
    .map(() => `<w:gridCol w:w="${colWidth}"/>`)
    .join("");

  const renderRow = (cells: string[], isHeader: boolean, rowIndex: number) => {
    const fill = isHeader
      ? "EEF2FF"
      : rowIndex % 2 === 1
      ? "F9FAFB"
      : "FFFFFF";

    const cellsXml: string[] = [];
    for (let c = 0; c < colCount; c++) {
      const rawCell = cells[c] ?? "";
      const align = alignments[c] ?? "left";
      const jcVal =
        align === "center" ? "center" : align === "right" ? "right" : "left";

      const runs = renderInlineRuns(rawCell, links, {
        bold: isHeader,
        color: isHeader ? "1E1B4B" : "1F2937",
        fontSizeHalfPt: 20,
      });

      cellsXml.push(`<w:tc>
        <w:tcPr>
          <w:tcW w:w="${colWidth}" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:before="60" w:after="60"/>
            <w:jc w:val="${jcVal}"/>
          </w:pPr>
          ${runs}
        </w:p>
      </w:tc>`);
    }

    const trPr = isHeader ? "<w:trPr><w:tblHeader/></w:trPr>" : "";
    return `<w:tr>${trPr}${cellsXml.join("")}</w:tr>`;
  };

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${totalWidthDxa}" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="80" w:type="dxa"/>
        <w:left w:w="120" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:right w:w="120" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>${gridCols}</w:tblGrid>
    ${renderRow(headerCells, true, 0)}
    ${bodyRows.map((row, idx) => renderRow(row, false, idx)).join("")}
  </w:tbl>
  <w:p><w:pPr><w:spacing w:before="40" w:after="80"/></w:pPr></w:p>`;
}

function renderCodeBlockXml(lang: string, codeLines: string[]): string {
  const headerRow = lang
    ? `<w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="9360" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr>
            ${buildRunXml(lang.toUpperCase(), {
              bold: true,
              code: true,
              color: "334155",
              fontSizeHalfPt: 17,
            })}
          </w:p>
        </w:tc>
      </w:tr>`
    : "";

  const paragraphs = (codeLines.length > 0 ? codeLines : [""]).map(
    (line) => `<w:p>
      <w:pPr>
        <w:pStyle w:val="CodeBlock"/>
        <w:spacing w:before="0" w:after="20" w:line="240" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>
          <w:color w:val="1E293B"/>
          <w:sz w:val="19"/>
          <w:szCs w:val="19"/>
        </w:rPr>
        <w:t xml:space="preserve">${escapeXml(line)}</w:t>
      </w:r>
    </w:p>`
  );

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9360" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:left w:val="single" w:sz="12" w:space="0" w:color="6366F1"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="80" w:type="dxa"/>
        <w:left w:w="160" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:right w:w="160" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="9360"/></w:tblGrid>
    ${headerRow}
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="9360" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
        </w:tcPr>
        ${paragraphs.join("")}
      </w:tc>
    </w:tr>
  </w:tbl>
  <w:p><w:pPr><w:spacing w:before="40" w:after="80"/></w:pPr></w:p>`;
}

function buildDocumentXml(
  title: string,
  markdown: string,
  links: HyperlinkRegistry
): string {
  const { metadata, body } = extractFrontmatterForDocx(markdown);
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];

  // Check if the body already begins with an H1 matching title
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) || "";
  const firstH1Match = firstNonEmpty.match(/^#\s+(.+)$/);
  const cleanTitle = title.trim();

  if (
    cleanTitle &&
    (!firstH1Match ||
      firstH1Match[1].trim().toLowerCase() !== cleanTitle.toLowerCase())
  ) {
    blocks.push(`<w:p>
      <w:pPr>
        <w:pStyle w:val="Title"/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="12" w:space="6" w:color="4F46E5"/>
        </w:pBdr>
        <w:spacing w:before="0" w:after="200"/>
      </w:pPr>
      ${buildRunXml(cleanTitle, {
        bold: true,
        color: "1E1B4B",
        fontSizeHalfPt: 44,
      })}
    </w:p>`);
  }

  // Render stripped YAML frontmatter as clean metadata table at top of document
  if (metadata.length > 0) {
    blocks.push(renderMetadataTableXml(metadata, links));
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Skip raw HTML details/summary wrappers gracefully while keeping their text
    if (/^<\/?details>/i.test(trimmed)) {
      i++;
      continue;
    }
    const summaryMatch = trimmed.match(/^<summary>(.*?)<\/summary>$/i);
    if (summaryMatch) {
      blocks.push(`<w:p>
        <w:pPr><w:spacing w:before="120" w:after="60"/></w:pPr>
        ${buildRunXml(`▸ ${summaryMatch[1].trim()}`, {
          bold: true,
          color: "312E81",
        })}
      </w:p>`);
      i++;
      continue;
    }

    // Fenced code blocks ```lang ... ```
    const fenceMatch = trimmed.match(/^```(.*)$/);
    if (fenceMatch) {
      const lang = fenceMatch[1].trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing ```
      blocks.push(renderCodeBlockXml(lang, codeLines));
      continue;
    }

    // Horizontal rule --- or ***
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(`<w:p>
        <w:pPr>
          <w:pBdr>
            <w:bottom w:val="single" w:sz="6" w:space="1" w:color="CBD5E1"/>
          </w:pBdr>
          <w:spacing w:before="120" w:after="120"/>
        </w:pPr>
      </w:p>`);
      i++;
      continue;
    }

    // Headings # .. ######
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(4, headingMatch[1].length);
      const headingText = headingMatch[2].trim();
      const styleId = `Heading${level}`;
      const sizeMap: Record<number, number> = {
        1: 36,
        2: 28,
        3: 24,
        4: 22,
      };
      const colorMap: Record<number, string> = {
        1: "1E1B4B",
        2: "312E81",
        3: "1F2937",
        4: "374151",
      };
      const borderXml =
        level === 1
          ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="E0E7FF"/></w:pBdr>`
          : "";

      blocks.push(`<w:p>
        <w:pPr>
          <w:pStyle w:val="${styleId}"/>
          <w:keepNext/>
          ${borderXml}
          <w:spacing w:before="${level === 1 ? 280 : 220}" w:after="100"/>
        </w:pPr>
        ${renderInlineRuns(headingText, links, {
          bold: true,
          italic: level === 4,
          color: colorMap[level],
          fontSizeHalfPt: sizeMap[level],
        })}
      </w:p>`);
      i++;
      continue;
    }

    // Markdown Tables | col1 | col2 |
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparatorLine(lines[i + 1])
    ) {
      const headerCells = splitMarkdownTableRow(line);
      const alignments = parseColumnAlignments(lines[i + 1], headerCells.length);
      i += 2;
      const bodyRows: string[][] = [];
      while (
        i < lines.length &&
        lines[i].trim().length > 0 &&
        lines[i].includes("|")
      ) {
        bodyRows.push(splitMarkdownTableRow(lines[i]));
        i++;
      }
      blocks.push(
        renderMarkdownTableXml(headerCells, alignments, bodyRows, links)
      );
      continue;
    }

    // Blockquotes > ...
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const combinedQuote = quoteLines.join(" ");
      blocks.push(`<w:p>
        <w:pPr>
          <w:pStyle w:val="Quote"/>
          <w:pBdr>
            <w:left w:val="single" w:sz="18" w:space="10" w:color="6366F1"/>
          </w:pBdr>
          <w:shd w:val="clear" w:color="auto" w:fill="F5F3FF"/>
          <w:spacing w:before="100" w:after="100"/>
          <w:ind w:left="360" w:right="240"/>
        </w:pPr>
        ${renderInlineRuns(combinedQuote, links, {
          italic: true,
          color: "4338CA",
        })}
      </w:p>`);
      continue;
    }

    // Checklists - [x] / - [ ] / - [/]
    const checkMatch = line.match(
      /^(\s*)[-*+]\s+\[([ xX/])\]\s+(.+)$/
    );
    if (checkMatch) {
      const indentSpaces = checkMatch[1].length;
      const level = Math.min(4, Math.floor(indentSpaces / 2));
      const leftIndent = 360 + level * 360;
      const stateChar = checkMatch[2].toLowerCase();
      const itemText = checkMatch[3].trim();

      const symbol = stateChar === "x" ? "☑ " : stateChar === "/" ? "◐ " : "☐ ";
      const symbolColor =
        stateChar === "x"
          ? "059669"
          : stateChar === "/"
          ? "2563EB"
          : "6B7280";

      blocks.push(`<w:p>
        <w:pPr>
          <w:spacing w:before="40" w:after="40"/>
          <w:ind w:left="${leftIndent}" w:hanging="260"/>
        </w:pPr>
        ${buildRunXml(symbol, { bold: true, color: symbolColor })}
        ${renderInlineRuns(itemText, links, {
          strike: stateChar === "x",
          color: stateChar === "x" ? "6B7280" : "1F2937",
        })}
      </w:p>`);
      i++;
      continue;
    }

    // Bullet lists - / * / +
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (bulletMatch) {
      const indentSpaces = bulletMatch[1].length;
      const level = Math.min(4, Math.floor(indentSpaces / 2));
      const leftIndent = 360 + level * 360;
      const bulletGlyph = level === 0 ? "• " : level === 1 ? "◦ " : "▪ ";
      blocks.push(`<w:p>
        <w:pPr>
          <w:spacing w:before="40" w:after="40"/>
          <w:ind w:left="${leftIndent}" w:hanging="240"/>
        </w:pPr>
        ${buildRunXml(bulletGlyph, { bold: true, color: "4F46E5" })}
        ${renderInlineRuns(bulletMatch[2].trim(), links)}
      </w:p>`);
      i++;
      continue;
    }

    // Numbered lists 1. / 2.
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const indentSpaces = orderedMatch[1].length;
      const level = Math.min(4, Math.floor(indentSpaces / 2));
      const leftIndent = 360 + level * 360;
      const numLabel = `${orderedMatch[2]}. `;
      blocks.push(`<w:p>
        <w:pPr>
          <w:spacing w:before="40" w:after="40"/>
          <w:ind w:left="${leftIndent}" w:hanging="280"/>
        </w:pPr>
        ${buildRunXml(numLabel, { bold: true, color: "312E81" })}
        ${renderInlineRuns(orderedMatch[3].trim(), links)}
      </w:p>`);
      i++;
      continue;
    }

    // Standard paragraph (coalesce consecutive plain lines)
    const paraLines: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const nextTrim = lines[i].trim();
      if (
        !nextTrim ||
        nextTrim.startsWith("#") ||
        nextTrim.startsWith("```") ||
        nextTrim.startsWith(">") ||
        /^(\s*)[-*+]\s+/.test(lines[i]) ||
        /^(\s*)\d+\.\s+/.test(lines[i]) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(nextTrim) ||
        (nextTrim.includes("|") &&
          i + 1 < lines.length &&
          isTableSeparatorLine(lines[i + 1]))
      ) {
        break;
      }
      paraLines.push(nextTrim);
      i++;
    }

    blocks.push(`<w:p>
      <w:pPr>
        <w:pStyle w:val="Normal"/>
        <w:spacing w:before="0" w:after="140" w:line="276" w:lineRule="auto"/>
      </w:pPr>
      ${renderInlineRuns(paraLines.join(" "), links)}
    </w:p>`);
  }

  if (blocks.length === 0) {
    blocks.push("<w:p/>");
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${blocks.join("\n    ")}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1270" w:right="1270" w:bottom="1270" w:left="1270" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>
        <w:color w:val="1F2937"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="140" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="200"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="1E1B4B"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="1E1B4B"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="220" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="312E81"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="180" w:after="60"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="1F2937"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="heading 4"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="140" w:after="40"/></w:pPr>
    <w:rPr><w:b/><w:i/><w:color w:val="374151"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:i/><w:color w:val="4338CA"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CodeBlock">
    <w:name w:val="Code Block"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>
      <w:color w:val="1E293B"/>
      <w:sz w:val="19"/>
      <w:szCs w:val="19"/>
    </w:rPr>
  </w:style>
</w:styles>`;
}

function buildContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function buildRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function buildDocumentRelsXml(
  externalLinks: { id: string; url: string }[]
): string {
  const linkRels = externalLinks
    .map(
      (lnk) =>
        `  <Relationship Id="${escapeXml(
          lnk.id
        )}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(
          lnk.url
        )}" TargetMode="External"/>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
${linkRels ? `${linkRels}\n` : ""}</Relationships>`;
}

/**
 * Generates binary .docx (OpenXML) bytes from a document title and Markdown source.
 */
export function generateDocxBytes(title: string, markdown: string): Uint8Array {
  const externalLinks: { id: string; url: string }[] = [];
  const urlToId = new Map<string, string>();

  const registry: HyperlinkRegistry = {
    registerExternalUrl(url: string): string {
      const existing = urlToId.get(url);
      if (existing) return existing;
      const nextId = `rId${externalLinks.length + 2}`;
      urlToId.set(url, nextId);
      externalLinks.push({ id: nextId, url });
      return nextId;
    },
  };

  const documentXml = buildDocumentXml(title, markdown, registry);
  const stylesXml = buildStylesXml();
  const contentTypesXml = buildContentTypesXml();
  const rootRelsXml = buildRootRelsXml();
  const docRelsXml = buildDocumentRelsXml(externalLinks);

  return buildStoredZip([
    {
      name: "[Content_Types].xml",
      data: UTF8_ENCODER.encode(contentTypesXml),
    },
    {
      name: "_rels/.rels",
      data: UTF8_ENCODER.encode(rootRelsXml),
    },
    {
      name: "word/_rels/document.xml.rels",
      data: UTF8_ENCODER.encode(docRelsXml),
    },
    {
      name: "word/styles.xml",
      data: UTF8_ENCODER.encode(stylesXml),
    },
    {
      name: "word/document.xml",
      data: UTF8_ENCODER.encode(documentXml),
    },
  ]);
}

function normalizeDocxFileName(fileName: string): string {
  const base = fileName
    .trim()
    .replace(/\.md$/i, "")
    .replace(/\.docx$/i, "")
    .replace(/[<>:"/\\|?*]+/g, "_");
  return `${base || "document"}.docx`;
}

/**
 * Exports Markdown content to a real .docx file:
 * - In Tauri mode (`isTauri === true`), opens `@tauri-apps/plugin-dialog` `save`
 *   and writes binary bytes via `@tauri-apps/plugin-fs` `writeFile`.
 * - In browser mode, triggers a native `Blob` download.
 */
export async function exportDocumentToDocx(
  fileName: string,
  title: string,
  markdown: string,
  isTauri: boolean
): Promise<boolean> {
  const safeFileName = normalizeDocxFileName(fileName);
  const bytes = generateDocxBytes(title, markdown);

  if (isTauri) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");

      const targetPath = await save({
        defaultPath: safeFileName,
        filters: [
          {
            name: "Microsoft Word Document (.docx)",
            extensions: ["docx"],
          },
        ],
      });

      if (!targetPath) {
        return false;
      }

      await writeFile(targetPath, bytes);
      return true;
    } catch (err) {
      console.error("Tauri DOCX save failed, falling back to browser download:", err);
    }
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const blobBuffer = new Uint8Array(bytes.byteLength);
  blobBuffer.set(bytes);
  const blob = new Blob([blobBuffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return true;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}
