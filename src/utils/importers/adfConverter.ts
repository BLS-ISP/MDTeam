import { convertJiraWikiToMarkdown, normalizeUserHandle } from "./importerNormalizers";

interface AdfMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface AdfNode {
  type?: string;
  text?: string;
  marks?: AdfMark[];
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
}

export function convertAdfToMarkdown(adfInput: unknown): string {
  if (!adfInput) return "";
  if (typeof adfInput === "string") {
    return convertJiraWikiToMarkdown(adfInput);
  }
  if (typeof adfInput !== "object") {
    return String(adfInput);
  }

  const renderInlineMarks = (text: string, marks?: AdfMark[]): string => {
    if (!marks || marks.length === 0) return text;
    let out = text;
    for (const mark of marks) {
      switch (mark.type) {
        case "code":
          out = `\`${out}\``;
          break;
        case "strong":
          out = `**${out}**`;
          break;
        case "em":
          out = `*${out}*`;
          break;
        case "strike":
          out = `~~${out}~~`;
          break;
        case "link": {
          const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "#";
          out = `[${out}](${href})`;
          break;
        }
        default:
          break;
      }
    }
    return out;
  };

  const walk = (node: AdfNode, listDepth = 0): string => {
    if (!node || typeof node !== "object") return "";
    const children = Array.isArray(node.content) ? node.content : [];

    switch (node.type) {
      case "doc":
        return children
          .map((child) => walk(child, listDepth))
          .filter(Boolean)
          .join("\n\n")
          .trim();

      case "paragraph":
        return children.map((child) => walk(child, listDepth)).join("");

      case "text":
        return renderInlineMarks(node.text || "", node.marks);

      case "hardBreak":
        return "\n";

      case "mention": {
        const mentionText =
          typeof node.attrs?.text === "string"
            ? node.attrs.text
            : typeof node.attrs?.id === "string"
              ? `@${node.attrs.id}`
              : "@user";
        return normalizeUserHandle(mentionText) || mentionText;
      }

      case "emoji":
        return typeof node.attrs?.text === "string"
          ? node.attrs.text
          : typeof node.attrs?.shortName === "string"
            ? node.attrs.shortName
            : "";

      case "status": {
        const label = typeof node.attrs?.text === "string" ? node.attrs.text : "STATUS";
        return `\`[${label.toUpperCase()}]\``;
      }

      case "inlineCard":
      case "blockCard": {
        const url = typeof node.attrs?.url === "string" ? node.attrs.url : "";
        return url ? `[${url}](${url})` : "";
      }

      case "heading": {
        const rawLevel = Number(node.attrs?.level) || 2;
        const level = Math.min(6, Math.max(1, rawLevel));
        const headingText = children.map((c) => walk(c, listDepth)).join("").trim();
        return `${"#".repeat(level)} ${headingText}`;
      }

      case "bulletList": {
        return children
          .map((item) => {
            const indent = "  ".repeat(listDepth);
            const itemContent = (item.content || [])
              .map((sub) => {
                if (sub.type === "bulletList" || sub.type === "orderedList") {
                  return `\n${walk(sub, listDepth + 1)}`;
                }
                return walk(sub, listDepth + 1);
              })
              .join(" ");
            return `${indent}- ${itemContent.trimStart()}`;
          })
          .join("\n");
      }

      case "orderedList": {
        return children
          .map((item, idx) => {
            const indent = "  ".repeat(listDepth);
            const itemContent = (item.content || [])
              .map((sub) => {
                if (sub.type === "bulletList" || sub.type === "orderedList") {
                  return `\n${walk(sub, listDepth + 1)}`;
                }
                return walk(sub, listDepth + 1);
              })
              .join(" ");
            return `${indent}${idx + 1}. ${itemContent.trimStart()}`;
          })
          .join("\n");
      }

      case "taskList": {
        return children
          .map((item) => {
            const isDone = String(item.attrs?.state || "").toUpperCase() === "DONE";
            const itemText = (item.content || []).map((c) => walk(c, listDepth)).join("").trim();
            return `- [${isDone ? "x" : " "}] ${itemText}`;
          })
          .join("\n");
      }

      case "taskItem": {
        const isDone = String(node.attrs?.state || "").toUpperCase() === "DONE";
        const itemText = children.map((c) => walk(c, listDepth)).join("").trim();
        return `- [${isDone ? "x" : " "}] ${itemText}`;
      }

      case "codeBlock": {
        const lang = typeof node.attrs?.language === "string" ? node.attrs.language : "";
        const codeText = children.map((c) => c.text || walk(c, listDepth)).join("");
        return `\`\`\`${lang}\n${codeText.replace(/\n+$/, "")}\n\`\`\``;
      }

      case "blockquote": {
        const inner = children
          .map((c) => walk(c, listDepth))
          .join("\n")
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");
        return inner;
      }

      case "panel": {
        const panelType = String(node.attrs?.panelType || "info").toUpperCase();
        const innerText = children
          .map((c) => walk(c, listDepth))
          .join("\n")
          .trim();
        const lines = innerText.split("\n");
        lines[0] = `**[${panelType}]** ${lines[0] || ""}`.trim();
        return lines.map((l) => `> ${l}`).join("\n");
      }

      case "rule":
        return "---";

      case "table": {
        const tableRows = children
          .filter((r) => r.type === "tableRow")
          .map((row) =>
            (row.content || []).map((cell) =>
              (cell.content || [])
                .map((c) => walk(c, listDepth))
                .join(" ")
                .replace(/\|/g, "\\|")
                .replace(/\s*\n\s*/g, " ")
                .trim()
            )
          );
        if (tableRows.length === 0) return "";
        const colCount = Math.max(...tableRows.map((r) => r.length), 1);
        const padRow = (r: string[]) => {
          const padded = [...r];
          while (padded.length < colCount) padded.push("");
          return `| ${padded.join(" | ")} |`;
        };
        const headerLine = padRow(tableRows[0]);
        const sepLine = `| ${Array(colCount).fill("---").join(" | ")} |`;
        const bodyLines = tableRows.slice(1).map(padRow);
        return [headerLine, sepLine, ...bodyLines].join("\n");
      }

      default:
        return children.map((c) => walk(c, listDepth)).join("");
    }
  };

  return walk(adfInput as AdfNode);
}
