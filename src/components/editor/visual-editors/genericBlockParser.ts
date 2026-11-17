export type CalloutVariant =
  | "note"
  | "tip"
  | "important"
  | "warning"
  | "caution"
  | "quote";

export type TableColumnAlign = "left" | "center" | "right";

export interface GenericBlock {
  type:
    | "h1"
    | "h2"
    | "h3"
    | "paragraph"
    | "list"
    | "code"
    | "yaml"
    | "table"
    | "callout";
  content: string;
  codeLang?: string;
  listType?: "unordered" | "ordered" | "todo";
  listItems?: { checked: boolean; text: string }[];
  tableHeaders?: string[];
  tableAlignments?: TableColumnAlign[];
  tableRows?: string[][];
  calloutType?: CalloutVariant;
  calloutTitle?: string;
}

function splitPipeRow(rawLine: string): string[] {
  const trimmed = rawLine.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "\\" && trimmed[i + 1] === "|") {
      current += "|";
      i++;
    } else if (ch === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isSeparatorPipeRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c.trim()));
}

function parseColumnAlign(sepCell: string): TableColumnAlign {
  const c = sepCell.trim();
  if (c.startsWith(":") && c.endsWith(":")) return "center";
  if (c.endsWith(":")) return "right";
  return "left";
}

function serializeColumnAlign(align?: TableColumnAlign): string {
  if (align === "center") return ":---:";
  if (align === "right") return "---:";
  return ":---";
}

function escapeMarkdownTableCell(val: string): string {
  return (val ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

export function parseGenericMarkdown(rawContent: string): {
  frontmatterPrefix: string;
  blocks: GenericBlock[];
} {
  let frontmatterPrefix = "";
  let bodyContent = rawContent;
  const fmMatch = rawContent.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/);
  if (fmMatch) {
    frontmatterPrefix = fmMatch[0];
    bodyContent = rawContent.slice(fmMatch[0].length);
  }

  const lines = bodyContent.split("\n");
  const blocks: GenericBlock[] = [];
  let currentBlock: GenericBlock | null = null;
  let inFencedCode = false;
  let currentCodeLang = "";
  let codeLines: string[] = [];

  const flushCurrent = () => {
    if (currentBlock) {
      blocks.push(currentBlock);
      currentBlock = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inFencedCode) {
        inFencedCode = false;
        blocks.push({ type: "code", codeLang: currentCodeLang, content: codeLines.join("\n") });
        currentCodeLang = "";
        codeLines = [];
      } else {
        flushCurrent();
        inFencedCode = true;
        currentCodeLang = trimmed.slice(3).trim();
        codeLines = [];
      }
      continue;
    }

    if (inFencedCode) {
      codeLines.push(line.replace(/\r$/, ""));
      continue;
    }

    // Mid-document YAML frontmatter block (e.g. ADR metadata right below H1)
    if (trimmed === "---") {
      let closingIdx = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === "---") {
          closingIdx = j;
          break;
        }
      }
      if (closingIdx !== -1) {
        let looksLikeYaml = true;
        for (let j = i + 1; j < closingIdx; j++) {
          const m = lines[j].trim();
          if (m !== "" && !m.includes(":") && !m.startsWith("-")) {
            looksLikeYaml = false;
            break;
          }
        }
        if (looksLikeYaml) {
          flushCurrent();
          blocks.push({
            type: "yaml",
            content: lines.slice(i + 1, closingIdx).map((l) => l.replace(/\r$/, "")).join("\n"),
          });
          i = closingIdx;
          continue;
        }
      }
    }

    if (trimmed === "") {
      if (currentBlock && currentBlock.type === "paragraph") flushCurrent();
      continue;
    }

    // Markdown Tables (`| Col 1 | Col 2 |`)
    if (trimmed.startsWith("|") && (trimmed.match(/\|/g) || []).length >= 2) {
      flushCurrent();
      const rawTableLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        rawTableLines.push(lines[j]);
        j++;
      }

      const parsedRows = rawTableLines.map(splitPipeRow);
      const hasSeparator = parsedRows.length >= 2 && isSeparatorPipeRow(parsedRows[1]);
      const rawHeaders = parsedRows[0] || ["Column 1", "Column 2"];
      const rawAlignments = hasSeparator
        ? parsedRows[1].map(parseColumnAlign)
        : rawHeaders.map(() => "left" as TableColumnAlign);
      const rawDataRows = hasSeparator ? parsedRows.slice(2) : parsedRows.slice(1);

      const colCount = Math.max(
        rawHeaders.length,
        ...rawDataRows.map((r) => r.length),
        1
      );
      const tableHeaders = Array.from({ length: colCount }, (_, idx) => rawHeaders[idx] ?? `Col ${idx + 1}`);
      const tableAlignments = Array.from(
        { length: colCount },
        (_, idx) => rawAlignments[idx] ?? "left"
      );
      const tableRows = rawDataRows.map((row) =>
        Array.from({ length: colCount }, (_, idx) => row[idx] ?? "")
      );

      blocks.push({
        type: "table",
        content: "",
        tableHeaders,
        tableAlignments,
        tableRows,
      });
      i = j - 1;
      continue;
    }

    // Confluence Callout Panels (`> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!IMPORTANT]`, `> [!CAUTION]`) & Blockquotes
    if (trimmed.startsWith(">")) {
      flushCurrent();
      const strippedLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith(">")) {
        strippedLines.push(lines[j].trim().replace(/^>\s?/, ""));
        j++;
      }

      const alertMatch = strippedLines[0]?.match(
        /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s+(.*))?$/i
      );
      if (alertMatch) {
        const calloutType = alertMatch[1].toLowerCase() as CalloutVariant;
        const calloutTitle = alertMatch[2]?.trim() || undefined;
        const content = strippedLines.slice(1).join("\n").replace(/^\n+|\n+$/g, "");
        blocks.push({
          type: "callout",
          calloutType,
          ...(calloutTitle ? { calloutTitle } : {}),
          content,
        });
      } else {
        blocks.push({
          type: "callout",
          calloutType: "quote",
          content: strippedLines.join("\n").replace(/^\n+|\n+$/g, ""),
        });
      }
      i = j - 1;
      continue;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      flushCurrent();
      blocks.push({ type: "h1", content: trimmed.substring(2).trim() });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushCurrent();
      blocks.push({ type: "h2", content: trimmed.substring(3).trim() });
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushCurrent();
      blocks.push({ type: "h3", content: trimmed.substring(4).trim() });
      continue;
    }

    // Checklists
    if (/^[-*]\s+\[[ xX]\]/.test(trimmed)) {
      if (currentBlock && (currentBlock.type !== "list" || currentBlock.listType !== "todo")) {
        flushCurrent();
      }
      const checked = /^[-*]\s+\[[xX]\]/.test(trimmed);
      const text = trimmed.replace(/^[-*]\s+\[[ xX]\]\s*/, "").trim();
      if (!currentBlock) {
        currentBlock = { type: "list", listType: "todo", content: "", listItems: [{ checked, text }] };
      } else {
        currentBlock.listItems?.push({ checked, text });
      }
      continue;
    }

    // Unordered lists
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      if (currentBlock && (currentBlock.type !== "list" || currentBlock.listType !== "unordered")) {
        flushCurrent();
      }
      const text = trimmed.replace(/^[-*]\s+/, "").trim();
      if (!currentBlock) {
        currentBlock = { type: "list", listType: "unordered", content: "", listItems: [{ checked: false, text }] };
      } else {
        currentBlock.listItems?.push({ checked: false, text });
      }
      continue;
    }

    // Ordered lists
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (orderedMatch) {
      if (currentBlock && (currentBlock.type !== "list" || currentBlock.listType !== "ordered")) {
        flushCurrent();
      }
      const text = orderedMatch[2].trim();
      if (!currentBlock) {
        currentBlock = { type: "list", listType: "ordered", content: "", listItems: [{ checked: false, text }] };
      } else {
        currentBlock.listItems?.push({ checked: false, text });
      }
      continue;
    }

    // Paragraph
    const cleanLine = line.replace(/\r$/, "");
    if (!currentBlock) {
      currentBlock = { type: "paragraph", content: cleanLine };
    } else if (currentBlock.type === "paragraph") {
      currentBlock.content += "\n" + cleanLine;
    } else {
      flushCurrent();
      currentBlock = { type: "paragraph", content: cleanLine };
    }
  }

  if (inFencedCode) {
    blocks.push({ type: "code", codeLang: currentCodeLang, content: codeLines.join("\n") });
  } else if (currentBlock) {
    blocks.push(currentBlock);
  }

  return { frontmatterPrefix, blocks };
}

export function serializeGenericMarkdown(
  frontmatterPrefix: string,
  blocks: GenericBlock[]
): string {
  let bodyOut = "";

  blocks.forEach((block) => {
    if (block.type === "h1") {
      bodyOut += `# ${block.content}\n\n`;
    } else if (block.type === "h2") {
      bodyOut += `## ${block.content}\n\n`;
    } else if (block.type === "h3") {
      bodyOut += `### ${block.content}\n\n`;
    } else if (block.type === "paragraph") {
      bodyOut += `${block.content}\n\n`;
    } else if (block.type === "code") {
      bodyOut += `\`\`\`${block.codeLang || ""}\n${block.content}\n\`\`\`\n\n`;
    } else if (block.type === "yaml") {
      bodyOut += `---\n${block.content}\n---\n\n`;
    } else if (block.type === "table") {
      const headers =
        block.tableHeaders && block.tableHeaders.length > 0
          ? block.tableHeaders
          : ["Column 1", "Column 2"];
      const colCount = headers.length;
      const headerLine = `| ${headers.map((h) => escapeMarkdownTableCell(h) || " ").join(" | ")} |`;
      const sepLine = `| ${Array.from({ length: colCount }, (_, idx) =>
        serializeColumnAlign(block.tableAlignments?.[idx])
      ).join(" | ")} |`;
      const rowLines = (block.tableRows || []).map(
        (row) =>
          `| ${Array.from({ length: colCount }, (_, idx) =>
            escapeMarkdownTableCell(row[idx] ?? "")
          ).join(" | ")} |`
      );
      bodyOut += `${[headerLine, sepLine, ...rowLines].join("\n")}\n\n`;
    } else if (block.type === "callout") {
      const variant = block.calloutType || "note";
      const rawLines = (block.content || "").split("\n");
      const quotedBody = rawLines.map((l) => (l.length > 0 ? `> ${l}` : ">")).join("\n");
      if (variant === "quote") {
        bodyOut += `${quotedBody}\n\n`;
      } else {
        const tag = variant.toUpperCase();
        const titleSuffix = block.calloutTitle?.trim() ? ` ${block.calloutTitle.trim()}` : "";
        bodyOut += `> [!${tag}]${titleSuffix}\n${quotedBody}\n\n`;
      }
    } else if (block.type === "list") {
      block.listItems?.forEach((item, lIdx) => {
        if (block.listType === "todo") {
          bodyOut += `*   [${item.checked ? "x" : " "}] ${item.text}\n`;
        } else if (block.listType === "unordered") {
          bodyOut += `* ${item.text}\n`;
        } else if (block.listType === "ordered") {
          bodyOut += `${lIdx + 1}. ${item.text}\n`;
        }
      });
      bodyOut += "\n";
    }
  });

  const cleanBody = bodyOut.trim();
  const normalizedPrefix = frontmatterPrefix ? `${frontmatterPrefix.replace(/\s*$/, "")}\n\n` : "";
  return `${normalizedPrefix}${cleanBody}\n`;
}
