import type { WorkspaceFile } from "../../types/workspace";
import { escapeYamlDoubleQuoted } from "../frontmatter";
import { convertJiraWikiToMarkdown, slugifyText } from "./importerNormalizers";

function decodeHtmlEntities(input: string): string {
  if (!input) return "";
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    "#39": "'",
    nbsp: " ",
    mdash: "—",
    ndash: "–",
    rarr: "→",
    larr: "←",
    hellip: "…",
    copy: "©",
  };
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z0-9]+);/g, (full, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (entity.startsWith("#")) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return named[entity] ?? full;
  });
}

function stripTagsToInlineMarkdown(fragment: string): string {
  let s = fragment;

  // Confluence status lozenge <span class="status-macro ...">APPROVED</span>
  s = s.replace(/<span[^>]*class="[^"]*status-macro[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, (_m, txt) => {
    return `\`[${decodeHtmlEntities(txt.replace(/<[^>]+>/g, "").trim())}]\``;
  });

  // Inline code
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, txt) => {
    return `\`${decodeHtmlEntities(txt.replace(/<[^>]+>/g, "").trim())}\``;
  });

  // Links
  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
    const cleanLabel = stripTagsToInlineMarkdown(label).trim() || href;
    return `[${cleanLabel}](${decodeHtmlEntities(href.trim())})`;
  });

  // Images
  s = s.replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi, (full, src) => {
    const altMatch = full.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]) : "image";
    return `![${alt}](${decodeHtmlEntities(src.trim())})`;
  });

  // Strong / Bold
  s = s.replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, (_m, inner) => {
    const clean = stripTagsToInlineMarkdown(inner).trim();
    return clean ? `**${clean}**` : "";
  });

  // Emphasis / Italic
  s = s.replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, (_m, inner) => {
    const clean = stripTagsToInlineMarkdown(inner).trim();
    return clean ? `*${clean}*` : "";
  });

  // Strikethrough
  s = s.replace(/<(?:del|s|strike)\b[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, (_m, inner) => {
    const clean = stripTagsToInlineMarkdown(inner).trim();
    return clean ? `~~${clean}~~` : "";
  });

  // Line breaks
  s = s.replace(/<br\s*\/?>/gi, " ");

  // Strip remaining HTML/XML tags
  s = s.replace(/<[^>]+>/g, "");

  return decodeHtmlEntities(s).replace(/[ \t]+/g, " ");
}

function convertHtmlTableToMarkdown(tableHtml: string): string {
  const rowMatches = Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
  if (rowMatches.length === 0) return "";

  const parsedRows: string[][] = [];
  for (const rMatch of rowMatches) {
    const rowInner = rMatch[1];
    const cells = Array.from(rowInner.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)).map(
      (cMatch) =>
        stripTagsToInlineMarkdown(cMatch[1])
          .replace(/\|/g, "\\|")
          .replace(/\s*\n\s*/g, " ")
          .trim()
    );
    if (cells.length > 0) {
      parsedRows.push(cells);
    }
  }

  if (parsedRows.length === 0) return "";
  const colCount = Math.max(...parsedRows.map((r) => r.length), 1);

  const formatRow = (row: string[]) => {
    const padded = [...row];
    while (padded.length < colCount) padded.push("");
    return `| ${padded.join(" | ")} |`;
  };

  const header = formatRow(parsedRows[0]);
  const separator = `| ${Array(colCount).fill("---").join(" | ")} |`;
  const body = parsedRows.slice(1).map(formatRow);

  return `\n\n${[header, separator, ...body].join("\n")}\n\n`;
}

export function convertConfluenceHtmlToMarkdown(
  html: string,
  fallbackTitle = "Imported Confluence Page"
): { title: string; markdown: string } {
  let work = html.replace(/\r\n/g, "\n");

  // Extract page title from <h1 id="title-text"> or <title> or first <h1>
  let rawTitle = "";
  const titleTextMatch = work.match(/<h1[^>]*id=["']title-text["'][^>]*>([\s\S]*?)<\/h1>/i);
  const headTitleMatch = work.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const firstH1Match = work.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

  if (titleTextMatch) {
    rawTitle = stripTagsToInlineMarkdown(titleTextMatch[1]).trim();
  } else if (headTitleMatch) {
    rawTitle = stripTagsToInlineMarkdown(headTitleMatch[1]).trim();
    // Strip Confluence "Space Name : Page Title" prefix
    if (rawTitle.includes(" : ")) {
      rawTitle = rawTitle.split(" : ").slice(1).join(" : ").trim();
    }
  } else if (firstH1Match) {
    rawTitle = stripTagsToInlineMarkdown(firstH1Match[1]).trim();
  }

  const pageTitle = rawTitle || fallbackTitle;

  // Remove <head>, <script>, <style>, breadcrumbs & Confluence footer chrome
  work = work.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "");
  work = work.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  work = work.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  work = work.replace(/<div[^>]*id=["'](?:breadcrumb-section|footer)["'][^>]*>[\s\S]*?<\/div>/gi, "");

  // Protect code blocks via placeholders so inner HTML/newlines remain untouched
  const codePlaceholders: string[] = [];
  const stashCodeBlock = (lang: string, rawCode: string): string => {
    const decoded = decodeHtmlEntities(rawCode.replace(/<[^>]+>/g, "")).replace(/^\n+|\n+$/g, "");
    const idx = codePlaceholders.length;
    codePlaceholders.push(`\n\n\`\`\`${lang}\n${decoded}\n\`\`\`\n\n`);
    return `@@MDTEAM_CODE_BLOCK_${idx}@@`;
  };

  // Confluence storage-format <ac:structured-macro ac:name="code">
  work = work.replace(
    /<ac:structured-macro[^>]*ac:name=["']code["'][^>]*>([\s\S]*?)<\/ac:structured-macro>/gi,
    (_m, inner) => {
      const langMatch = inner.match(/<ac:parameter[^>]*ac:name=["']language["'][^>]*>([\s\S]*?)<\/ac:parameter>/i);
      const bodyMatch = inner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
      const lang = langMatch ? langMatch[1].trim() : "";
      const code = bodyMatch ? bodyMatch[1] : inner;
      return stashCodeBlock(lang, code);
    }
  );

  // Standard <pre><code class="language-...">...</code></pre> or <pre ...>...</pre>
  work = work.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (_m, preAttrs, inner) => {
    const codeLangMatch =
      String(inner).match(/class=["'][^"']*language-([a-zA-Z0-9_+-]+)/i) ||
      String(preAttrs).match(/brush:\s*([a-zA-Z0-9_+-]+)/i);
    const lang = codeLangMatch ? codeLangMatch[1] : "";
    return stashCodeBlock(lang, inner);
  });

  // Confluence Storage Format info/warning/note/tip macros
  work = work.replace(
    /<ac:structured-macro[^>]*ac:name=["'](info|warning|note|tip)["'][^>]*>([\s\S]*?)<\/ac:structured-macro>/gi,
    (_m, macroType, inner) => {
      const label = String(macroType).charAt(0).toUpperCase() + String(macroType).slice(1).toLowerCase();
      const bodyText = stripTagsToInlineMarkdown(inner).trim();
      return `\n\n> **${label}:** ${bodyText}\n\n`;
    }
  );

  // Confluence HTML export info/warning/note/tip macro divs
  work = work.replace(
    /<div[^>]*class=["'][^"']*confluence-information-macro-(information|warning|note|tip)[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>)?/gi,
    (_m, kind, inner) => {
      const labelMap: Record<string, string> = {
        information: "Info",
        warning: "Warning",
        note: "Note",
        tip: "Tip",
      };
      const label = labelMap[String(kind).toLowerCase()] || "Note";
      const cleanText = stripTagsToInlineMarkdown(inner).trim();
      return `\n\n> **${label}:** ${cleanText}\n\n`;
    }
  );

  // Tables
  work = work.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_m, inner) => {
    return convertHtmlTableToMarkdown(`<table>${inner}</table>`);
  });

  // Blockquotes
  work = work.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner) => {
    const text = stripTagsToInlineMarkdown(inner).trim();
    if (!text) return "";
    return `\n\n${text
      .split("\n")
      .map((l) => `> ${l.trim()}`)
      .join("\n")}\n\n`;
  });

  // Lists (<ul> and <ol>, including Confluence inline-task-list)
  work = work.replace(/<(ul|ol)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (_m, tag, attrs, inner) => {
    const isOrdered = String(tag).toLowerCase() === "ol";
    const isTaskList = /inline-task-list/i.test(String(attrs));
    const items = Array.from(String(inner).matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi));
    const lines = items.map((itemMatch, idx) => {
      const liAttrs = itemMatch[1] || "";
      const liBody = stripTagsToInlineMarkdown(itemMatch[2]).trim();
      const hasTaskAttr = isTaskList || /data-inline-task-id/i.test(liAttrs);
      if (hasTaskAttr) {
        const isChecked = /\bchecked\b/i.test(liAttrs);
        return `- [${isChecked ? "x" : " "}] ${liBody}`;
      }
      return isOrdered ? `${idx + 1}. ${liBody}` : `- ${liBody}`;
    });
    return `\n\n${lines.join("\n")}\n\n`;
  });

  // Headings h1..h6
  work = work.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, inner) => {
    const headingText = stripTagsToInlineMarkdown(inner).trim();
    if (!headingText) return "";
    return `\n\n${"#".repeat(Number(level))} ${headingText}\n\n`;
  });

  // Horizontal rules
  work = work.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

  // Paragraphs & divs
  work = work.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_m, inner) => {
    const txt = stripTagsToInlineMarkdown(inner).trim();
    return txt ? `\n\n${txt}\n\n` : "\n";
  });
  work = work.replace(/<\/div>/gi, "\n");

  // Remaining inline markup & tags
  work = stripTagsToInlineMarkdown(work);

  // Restore stashed code blocks
  work = work.replace(/@@MDTEAM_CODE_BLOCK_(\d+)@@/g, (_m, idxStr) => {
    return codePlaceholders[Number(idxStr)] || "";
  });

  // Clean whitespace and ensure single `# Title` header at top
  let markdown = work
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const escapedTitleRegex = new RegExp(
    `^#\\s+${pageTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:\\n+|$)`,
    "i"
  );
  if (!escapedTitleRegex.test(markdown)) {
    markdown = `# ${pageTitle}\n\n${markdown}`.trim();
  }

  return { title: pageTitle, markdown };
}

function normalizeConfluenceMarkdownInput(
  rawMd: string,
  fallbackTitle: string
): { title: string; body: string } {
  let content = rawMd.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  let extractedTitle = "";

  // Strip existing YAML frontmatter if present, capturing title if available
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n*/);
  if (fmMatch) {
    const titleLine = fmMatch[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
    if (titleLine) extractedTitle = titleLine[1].trim();
    content = content.slice(fmMatch[0].length).trim();
  }

  // Convert Confluence wiki macro shortcodes ({info}, {warning}, {note}, {code}) if present
  content = content.replace(
    /\{(info|warning|note|tip)\}([\s\S]*?)\{\1\}/gi,
    (_m, kind, inner) => {
      const label = String(kind).charAt(0).toUpperCase() + String(kind).slice(1).toLowerCase();
      const text = String(inner).trim().replace(/\n+/g, " ");
      return `> **${label}:** ${text}`;
    }
  );
  content = convertJiraWikiToMarkdown(content);

  if (!extractedTitle) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      extractedTitle = h1Match[1].trim();
    }
  }

  const finalTitle = extractedTitle || fallbackTitle;
  if (!/^#\s+/m.test(content)) {
    content = `# ${finalTitle}\n\n${content}`.trim();
  }

  return { title: finalTitle, body: content };
}

export function importConfluencePages(
  filesInput: { name: string; content: string }[]
): WorkspaceFile[] {
  const usedSlugs = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  const results: WorkspaceFile[] = [];

  for (const input of filesInput) {
    if (!input || !input.content.trim()) continue;

    const baseFileName = (input.name || "confluence-page")
      .replace(/^.*[\\/]/, "")
      .replace(/\.(html?|xhtml|md|markdown)$/i, "");
    const fallbackTitle =
      baseFileName
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim() || "Confluence Page";

    const isHtml =
      /\.(html?|xhtml)$/i.test(input.name) ||
      /<(?:!DOCTYPE|html|body|div|h1|table|ac:structured-macro)\b/i.test(input.content);

    const { title, markdown } = isHtml
      ? convertConfluenceHtmlToMarkdown(input.content, fallbackTitle)
      : (() => {
          const res = normalizeConfluenceMarkdownInput(input.content, fallbackTitle);
          return { title: res.title, markdown: res.body };
        })();

    const baseSlug = slugifyText(title || baseFileName, 56);
    let slug = baseSlug;
    let counter = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${counter++}`;
    }
    usedSlugs.add(slug);

    const fileContent = [
      "---",
      `title: "${escapeYamlDoubleQuoted(title)}"`,
      `review_status: "approved"`,
      `updated_at: "${today}"`,
      "---",
      "",
      markdown,
      "",
    ].join("\n");

    results.push({
      path: `wiki/${slug}.md`,
      name: `${slug}.md`,
      category: "wiki",
      content: fileContent,
    });
  }

  return results;
}
