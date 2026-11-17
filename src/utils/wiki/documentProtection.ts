import { extractFrontmatter } from "../query/queryFrontmatterExtractor";
import { upsertDocumentFrontmatter } from "../../components/wiki/wikiStorageUtils";
import type { WorkspaceFile } from "../../components/wiki/wikiTypes";

export type DocumentLockReason = "approved-page" | "accepted-adr" | null;

export interface DocumentProtectionStatus {
  locked: boolean;
  reason: DocumentLockReason;
  approvedBy?: string;
}

function isAdrWorkspaceFile(file: WorkspaceFile): boolean {
  const cleanPath = file.path.replace(/\\/g, "/").replace(/^\/+/, "");
  const cleanCat = (file.category || "").replace(/\\/g, "/").replace(/^\/+/, "");
  return (
    cleanPath.startsWith("adrs/") ||
    cleanPath.includes("/adrs/") ||
    cleanCat === "adrs" ||
    cleanCat.startsWith("adrs/") ||
    /^adr-\d+/i.test(file.name || "")
  );
}

function extractActiveAdrStatusSection(markdownBody: string): string {
  const lines = markdownBody.replace(/\r\n/g, "\n").split("\n");
  let inStatus = false;
  const collected: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+status\b/i.test(trimmed)) {
      inStatus = true;
      continue;
    }
    if (inStatus) {
      if (/^#{1,6}\s+/.test(trimmed)) break;
      collected.push(line);
    }
  }
  return collected
    .join("\n")
    .replace(/~~[\s\S]*?~~/g, "")
    .replace(/\((?:zuvor|previously|vormals|formerly)[^)]*\)/gi, "")
    .trim();
}

function pickStringField(
  frontmatter: Record<string, string | string[]>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const val = frontmatter[key];
    if (typeof val === "string" && val.trim()) return val.trim();
    if (Array.isArray(val) && val.length > 0) {
      const joined = val.filter(Boolean).join(", ").trim();
      if (joined) return joined;
    }
  }
  return undefined;
}

/**
 * Detects `review_status: approved` in YAML frontmatter OR `## Status` containing
 * `Akzeptiert` / `Accepted` in `adrs/*.md`.
 */
export function isDocumentWriteProtected(file: WorkspaceFile | undefined): DocumentProtectionStatus {
  if (!file || !file.content) return { locked: false, reason: null };

  const { frontmatter, body } = extractFrontmatter(file.content);

  if (isAdrWorkspaceFile(file)) {
    const statusSection = extractActiveAdrStatusSection(body);
    const fmStatus = (pickStringField(frontmatter, ["status"]) || "").toLowerCase();
    const isSupersededOrRejected =
      /\b(superseded|abgelöst|deprecated|veraltet|rejected|abgelehnt)\b/i.test(statusSection) ||
      ["superseded", "abgelöst", "deprecated", "rejected"].includes(fmStatus);

    const hasAccepted =
      !isSupersededOrRejected &&
      (/\b(akzeptiert|accepted)\b/i.test(statusSection) ||
        fmStatus === "accepted" ||
        fmStatus === "akzeptiert");

    if (hasAccepted) {
      const adrApprover = pickStringField(frontmatter, ["approved_by", "deciders", "assignee", "author"]);
      return { locked: true, reason: "accepted-adr", ...(adrApprover ? { approvedBy: adrApprover } : {}) };
    }
  }

  const rawReviewStatus = (pickStringField(frontmatter, ["review_status"]) || "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

  if (rawReviewStatus === "approved" || rawReviewStatus === "freigegeben") {
    const approvedBy = pickStringField(frontmatter, ["approved_by", "assignee"]);
    return { locked: true, reason: "approved-page", ...(approvedBy ? { approvedBy } : {}) };
  }

  return { locked: false, reason: null };
}

/**
 * Unlocks an approved page by transitioning `review_status: "in-review"`,
 * bumping `revision` in frontmatter, and recording `last_revision_by: author`.
 */
export function startNewDocumentRevision(file: WorkspaceFile, author: string): WorkspaceFile {
  const { frontmatter } = extractFrontmatter(file.content);
  const rawRev = pickStringField(frontmatter, ["revision"]);
  const parsedRev = rawRev ? parseInt(rawRev, 10) : 1;
  const nextRevision = Number.isFinite(parsedRev) && parsedRev >= 1 ? parsedRev + 1 : 2;
  const today = new Date().toISOString().slice(0, 10);

  const nextContent = upsertDocumentFrontmatter(file.content, {
    review_status: "in-review",
    revision: String(nextRevision),
    last_revision_by: author.trim() || "@editor",
    updated_at: today,
    approved_by: null,
  });

  return { ...file, content: nextContent };
}

function computeNextAdrNumber(allFiles: WorkspaceFile[], acceptedAdr: WorkspaceFile): number {
  let maxAdr = 0;
  for (const f of [...allFiles, acceptedAdr]) {
    const matches = `${f.path} ${f.name}`.match(/ADR-(\d+)/gi);
    if (!matches) continue;
    for (const token of matches) {
      const num = parseInt(token.replace(/ADR-/i, ""), 10);
      if (Number.isFinite(num) && num > maxAdr) maxAdr = num;
    }
  }
  return maxAdr + 1;
}

function replaceAdrStatusSection(markdown: string, replacementLine: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const statusIdx = lines.findIndex((l) => /^##\s+status\b/i.test(l.trim()));
  if (statusIdx === -1) return `${markdown.replace(/\s*$/, "")}\n\n## Status\n${replacementLine}\n`;
  let nextIdx = lines.length;
  for (let j = statusIdx + 1; j < lines.length; j++) {
    if (/^#{1,6}\s+/.test(lines[j].trim())) {
      nextIdx = j;
      break;
    }
  }
  return [...lines.slice(0, statusIdx + 1), replacementLine, "", ...lines.slice(nextIdx)].join("\n");
}

/**
 * Creates `adrs/ADR-000X-....md` (`Status: Proposed`, referencing `Supersedes: <old>`)
 * and marks the old ADR `Superseded by ADR-000X`.
 */
export function createSupersedingAdr(
  acceptedAdr: WorkspaceFile,
  allFiles: WorkspaceFile[],
  author: string,
  language: "de" | "en"
): { newAdr: WorkspaceFile; updatedOldAdr: WorkspaceFile } {
  const newAdrId = `ADR-${String(computeNextAdrNumber(allFiles, acceptedAdr)).padStart(4, "0")}`;
  const oldIdMatch = `${acceptedAdr.name} ${acceptedAdr.path}`.match(/ADR-\d+/i);
  const oldAdrId = oldIdMatch ? oldIdMatch[0].toUpperCase() : acceptedAdr.name.replace(/\.md$/i, "");
  const baseSlug =
    acceptedAdr.name.replace(/\.md$/i, "").replace(/^ADR-\d+-?/i, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") ||
    "decision";

  const folder =
    acceptedAdr.category && !acceptedAdr.category.startsWith(".")
      ? acceptedAdr.category.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
      : "adrs";

  let newFileName = `${newAdrId}-${baseSlug}.md`;
  let newFilePath = `${folder}/${newFileName}`;
  if (allFiles.some((f) => f.path.replace(/\\/g, "/") === newFilePath)) {
    newFileName = `${newAdrId}-${baseSlug}-v2.md`;
    newFilePath = `${folder}/${newFileName}`;
  }

  const { frontmatter } = extractFrontmatter(acceptedAdr.content);
  const h1Match = acceptedAdr.content.match(/^#\s+(.+)$/m);
  const rawTitle = pickStringField(frontmatter, ["title"]) || (h1Match ? h1Match[1].trim() : oldAdrId);
  const cleanTopic = rawTitle.replace(/^ADR-\d+\s*:\s*/i, "").trim() || baseSlug;
  const today = new Date().toISOString().slice(0, 10);
  const cleanAuthor = (author.trim() || "@architect").replace(/"/g, '\\"');
  const oldCleanPath = acceptedAdr.path.replace(/\\/g, "/");
  const newFullTitle = `${newAdrId}: ${cleanTopic}`;
  const isEn = language === "en";

  const newAdrContent = [
    `# ${newFullTitle}`,
    "",
    "---",
    `title: "${newFullTitle.replace(/"/g, '\\"')}"`,
    `status: "proposed"`,
    `supersedes: "${oldAdrId}"`,
    `assignee: "${cleanAuthor}"`,
    `start_date: "${today}"`,
    `updated_at: "${today}"`,
    "---",
    "",
    "## Status",
    isEn ? `Proposed — Supersedes: [${oldAdrId}](${oldCleanPath})` : `Proposed (Vorgeschlagen) — Supersedes: [${oldAdrId}](${oldCleanPath})`,
    "",
    isEn ? "## Context" : "## Kontext",
    isEn
      ? `This decision supersedes [${oldAdrId}](${oldCleanPath}). Describe the updated architectural drivers and constraints here.`
      : `Diese Architekturentscheidung löst [${oldAdrId}](${oldCleanPath}) ab. Beschreiben Sie hier die geänderten Rahmenbedingungen.`,
    "",
    isEn ? "## Decision" : "## Entscheidung",
    isEn ? "State the new architectural decision clearly." : "Formulieren Sie hier die neue Architekturentscheidung.",
    "",
    isEn ? "## Consequences" : "## Konsequenzen",
    isEn ? "* [ ] Document migration steps from the previous decision." : "* [ ] Migrationsschritte aus der abgelösten Entscheidung dokumentieren.",
    "",
  ].join("\n");

  const supersededLine = isEn
    ? `Superseded by ${newAdrId} ([${newAdrId}](${newFilePath}))`
    : `Superseded by ${newAdrId} — Abgelöst durch [${newAdrId}](${newFilePath})`;

  const oldFinalContent = upsertDocumentFrontmatter(replaceAdrStatusSection(acceptedAdr.content, supersededLine), {
    status: "superseded",
    superseded_by: newAdrId,
    updated_at: today,
  });

  return {
    newAdr: { path: newFilePath, name: newFileName, category: folder, content: newAdrContent },
    updatedOldAdr: { ...acceptedAdr, content: oldFinalContent },
  };
}
