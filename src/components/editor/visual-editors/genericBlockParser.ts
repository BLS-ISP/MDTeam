export interface GenericBlock {
  type: "h1" | "h2" | "h3" | "paragraph" | "list" | "code" | "yaml";
  content: string;
  codeLang?: string;
  listType?: "unordered" | "ordered" | "todo";
  listItems?: { checked: boolean; text: string }[];
}

export function parseGenericMarkdown(rawContent: string): {
  frontmatterPrefix: string;
  blocks: GenericBlock[];
} {
  // Preserve any leading YAML frontmatter (`--- ... ---`) verbatim so Visual Form edits never strip metadata
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code blocks (e.g. ```query, ```mermaid, ```drawio, ```ts)
    if (trimmed.startsWith("```")) {
      if (inFencedCode) {
        inFencedCode = false;
        blocks.push({
          type: "code",
          codeLang: currentCodeLang,
          content: codeLines.join("\n"),
        });
        currentCodeLang = "";
        codeLines = [];
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
        inFencedCode = true;
        currentCodeLang = trimmed.slice(3).trim();
        codeLines = [];
      }
      continue;
    }

    if (inFencedCode) {
      codeLines.push(line);
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
          if (currentBlock) {
            blocks.push(currentBlock);
            currentBlock = null;
          }
          blocks.push({
            type: "yaml",
            content: lines.slice(i + 1, closingIdx).join("\n"),
          });
          i = closingIdx;
          continue;
        }
      }
    }

    if (trimmed === "") {
      if (currentBlock && currentBlock.type === "paragraph") {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    // Headers
    if (trimmed.startsWith("# ")) {
      if (currentBlock) blocks.push(currentBlock);
      blocks.push({ type: "h1", content: trimmed.substring(2).trim() });
      currentBlock = null;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      if (currentBlock) blocks.push(currentBlock);
      blocks.push({ type: "h2", content: trimmed.substring(3).trim() });
      currentBlock = null;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      if (currentBlock) blocks.push(currentBlock);
      blocks.push({ type: "h3", content: trimmed.substring(4).trim() });
      currentBlock = null;
      continue;
    }

    // Checklists
    if (trimmed.startsWith("*   [") || trimmed.startsWith("- [")) {
      if (currentBlock && (currentBlock.type !== "list" || currentBlock.listType !== "todo")) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      const checked = trimmed.includes("[x]") || trimmed.includes("[X]");
      const text = trimmed.replace(/^[-*]\s+\[[ xX]\]\s*/, "").trim();

      if (!currentBlock) {
        currentBlock = { type: "list", listType: "todo", content: "", listItems: [{ checked, text }] };
      } else {
        currentBlock.listItems?.push({ checked, text });
      }
      continue;
    }

    // Bullet lists
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      if (currentBlock && (currentBlock.type !== "list" || currentBlock.listType !== "unordered")) {
        blocks.push(currentBlock);
        currentBlock = null;
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
        blocks.push(currentBlock);
        currentBlock = null;
      }
      const text = orderedMatch[2].trim();

      if (!currentBlock) {
        currentBlock = { type: "list", listType: "ordered", content: "", listItems: [{ checked: false, text }] };
      } else {
        currentBlock.listItems?.push({ checked: false, text });
      }
      continue;
    }

    // Standard text / paragraph
    if (!currentBlock) {
      currentBlock = { type: "paragraph", content: line.replace(/\r$/, "") };
    } else if (currentBlock.type === "paragraph") {
      currentBlock.content += "\n" + line.replace(/\r$/, "");
    } else {
      blocks.push(currentBlock);
      currentBlock = { type: "paragraph", content: line.replace(/\r$/, "") };
    }
  }

  if (inFencedCode) {
    blocks.push({
      type: "code",
      codeLang: currentCodeLang,
      content: codeLines.join("\n"),
    });
  } else if (currentBlock) {
    blocks.push(currentBlock);
  }

  return { frontmatterPrefix, blocks };
}

export function serializeGenericMarkdown(frontmatterPrefix: string, blocks: GenericBlock[]): string {
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
    } else if (block.type === "list") {
      block.listItems?.forEach((item, lIdx) => {
        if (block.listType === "todo") {
          const char = item.checked ? "x" : " ";
          bodyOut += `*   [${char}] ${item.text}\n`;
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
