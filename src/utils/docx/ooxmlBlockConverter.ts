import { buildStoredZip, UTF8_ENCODER } from "./zipBuilder";
import {
  buildContentTypesXml,
  buildDocumentRelsXml,
  buildRootRelsXml,
  buildStylesXml,
} from "./ooxmlTemplates";
import {
  buildRunXml,
  extractFrontmatterForDocx,
  renderInlineRuns,
  type HyperlinkRegistry,
} from "./ooxmlInlineRuns";
import {
  isTableSeparatorLine,
  parseColumnAlignments,
  renderCodeBlockXml,
  renderMarkdownTableXml,
  renderMetadataTableXml,
  splitMarkdownTableRow,
} from "./ooxmlTableRenderer";

export function buildDocumentXml(
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
