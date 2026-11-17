import { escapeXml } from "./zipBuilder";
import {
  buildRunXml,
  renderInlineRuns,
  type FrontmatterPair,
  type HyperlinkRegistry,
} from "./ooxmlInlineRuns";

export function splitMarkdownTableRow(line: string): string[] {
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

export function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|") && !trimmed.includes("-")) return false;
  const cells = splitMarkdownTableRow(trimmed);
  return (
    cells.length > 0 &&
    cells.every((c) => /^:?-{2,}:?$/.test(c.trim()))
  );
}

export function parseColumnAlignments(
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

export function renderMetadataTableXml(
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

export function renderMarkdownTableXml(
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

export function renderCodeBlockXml(lang: string, codeLines: string[]): string {
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
