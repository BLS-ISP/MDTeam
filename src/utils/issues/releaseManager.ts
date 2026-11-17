import type { WorkspaceFile } from "../../types/workspace";
import type {
  AgileIssue,
  AgileRelease,
  ReleaseProgress,
  ReleaseState,
} from "../../types/agile";
import { escapeYamlString, extractFrontmatter, normalizePath, unquoteYamlString } from "../frontmatter";

export const RELEASES_FILE_PATH = ".mdteam/releases.md";

function normalizeReleaseState(raw?: string): ReleaseState {
  const v = (raw || "").trim().toLowerCase();
  if (v === "released" || v === "shipped" || v === "published" || v === "done") {
    return "released";
  }
  if (v === "unreleased" || v === "active" || v === "in-progress" || v === "rc") {
    return "unreleased";
  }
  return "planned";
}

export function releaseVersionToSlug(version: string): string {
  const clean = (version || "release")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "release";
}

function parseYamlBlock(rawBlock: string, fallbackIdx: number): AgileRelease | null {
  const map: Record<string, string> = {};
  for (const line of rawBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx <= 0) continue;
    const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const val = unquoteYamlString(trimmed.slice(colonIdx + 1));
    map[key] = val;
  }

  const version = (map.version || map.tag || map.fix_version || "").trim();
  if (!version) return null;

  const slug = releaseVersionToSlug(version);
  return {
    id: (map.id || `rel-${slug}-${fallbackIdx}`).trim(),
    version,
    name: (map.name || map.title || `Release ${version}`).trim(),
    targetDate: (map.target_date || map.targetdate || map.date || "2026-06-30").trim(),
    state: normalizeReleaseState(map.state || map.status),
    description: (map.description || map.summary || "").trim(),
  };
}

function defaultSeedReleases(): AgileRelease[] {
  return [
    {
      id: "rel-v1-0-0",
      version: "v1.0.0",
      name: "Enterprise Security & Core Workspace",
      targetDate: "2026-06-21",
      state: "unreleased",
      description:
        "Production rollout of Keycloak OIDC SSO, Yjs real-time collaboration, and Git-native Scrum board.",
    },
    {
      id: "rel-v1-1-0",
      version: "v1.1.0",
      name: "Deep Jira Mechanics & Confluence Governance",
      targetDate: "2026-07-05",
      state: "planned",
      description:
        "Subtasks, time tracking, binary ticket attachments, release notes automation, and page approvals.",
    },
  ];
}

/**
 * Parses `.mdteam/releases.md` and auto-discovers any `fixVersion` values present across `AgileIssue[]`.
 */
export function parseReleases(
  files: WorkspaceFile[],
  issues: AgileIssue[] = []
): AgileRelease[] {
  const relFile = (files || []).find(
    (f) => normalizePath(f.path) === RELEASES_FILE_PATH
  );

  const releases: AgileRelease[] = [];
  const seenVersions = new Set<string>();

  if (relFile && typeof relFile.content === "string") {
    const normalized = relFile.content.replace(/\r\n/g, "\n");
    const blockRegex = /^---\n([\s\S]*?)\n---/gm;
    let match: RegExpExecArray | null;
    let idx = 1;
    while ((match = blockRegex.exec(normalized)) !== null) {
      const parsed = parseYamlBlock(match[1], idx++);
      if (parsed && !seenVersions.has(parsed.version.toLowerCase())) {
        seenVersions.add(parsed.version.toLowerCase());
        releases.push(parsed);
      }
    }
  } else {
    for (const seed of defaultSeedReleases()) {
      seenVersions.add(seed.version.toLowerCase());
      releases.push(seed);
    }
  }

  // Auto-discover any fixVersion values on issues that are not yet registered in releases.md
  for (const issue of issues || []) {
    const fv = (issue.fixVersion || "").trim();
    if (!fv) continue;
    const lower = fv.toLowerCase();
    if (!seenVersions.has(lower)) {
      seenVersions.add(lower);
      const slug = releaseVersionToSlug(fv);
      releases.push({
        id: `rel-${slug}`,
        version: fv,
        name: `Release ${fv}`,
        targetDate: issue.endDate || "2026-06-30",
        state: issue.status === "done" ? "unreleased" : "planned",
        description: `Auto-discovered release from tickets tagged with FixVersion ${fv}.`,
      });
    }
  }

  releases.sort((a, b) =>
    a.version.localeCompare(b.version, undefined, { numeric: true })
  );
  return releases;
}

export function serializeReleasesToMarkdown(releases: AgileRelease[]): WorkspaceFile {
  const sections: string[] = [
    "# MDTeam Releases & FixVersions",
    "",
    "Managed automatically by the MDTeam Scrum & Release Engine.",
    "",
  ];

  for (const rel of releases) {
    const cleanVer = (rel.version || "v1.0.0").trim();
    const cleanId = (rel.id || `rel-${releaseVersionToSlug(cleanVer)}`).trim();
    sections.push(
      "---",
      `id: ${escapeYamlString(cleanId)}`,
      `version: ${escapeYamlString(cleanVer)}`,
      `name: ${escapeYamlString(rel.name || `Release ${cleanVer}`)}`,
      `target_date: ${escapeYamlString(rel.targetDate || "")}`,
      `state: ${escapeYamlString(rel.state || "planned")}`,
      `description: ${escapeYamlString(rel.description || "")}`,
      "---",
      ""
    );
  }

  return {
    path: RELEASES_FILE_PATH,
    name: "releases.md",
    category: ".mdteam",
    content: sections.join("\n").trimEnd() + "\n",
  };
}

export function getIssuesForRelease(
  releaseVersion: string,
  issues: AgileIssue[]
): AgileIssue[] {
  const target = (releaseVersion || "").trim().toLowerCase();
  if (!target) return [];
  return (issues || []).filter(
    (iss) => (iss.fixVersion || "").trim().toLowerCase() === target
  );
}

export function computeReleaseProgress(
  release: AgileRelease,
  issues: AgileIssue[]
): ReleaseProgress {
  const matching = getIssuesForRelease(release.version, issues);
  // Avoid double-counting Epic SP when child stories are also assigned to the same release
  const countable = matching.filter(
    (iss) =>
      iss.type !== "epic" ||
      !matching.some((child) => child.epic.toLowerCase() === iss.id.toLowerCase())
  );

  let doneIssues = 0;
  let inProgressIssues = 0;
  let openIssues = 0;
  let totalPoints = 0;
  let donePoints = 0;

  for (const iss of countable) {
    const sp = Number.isFinite(iss.storyPoints) ? iss.storyPoints : 0;
    totalPoints += sp;
    if (iss.status === "done") {
      doneIssues++;
      donePoints += sp;
    } else if (iss.status === "in-progress" || iss.status === "review") {
      inProgressIssues++;
    } else {
      openIssues++;
    }
  }

  const totalIssues = countable.length;
  const issueProgressPercent =
    totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;
  const pointsProgressPercent =
    totalPoints > 0
      ? Math.round((donePoints / totalPoints) * 100)
      : issueProgressPercent;

  return {
    version: release.version,
    totalIssues,
    doneIssues,
    inProgressIssues,
    openIssues,
    issueProgressPercent,
    totalPoints,
    donePoints,
    pointsProgressPercent,
  };
}

function discoverLinkedAdrs(
  releaseIssues: AgileIssue[],
  allFiles: WorkspaceFile[]
): { id: string; title: string; path: string }[] {
  const adrFiles = (allFiles || []).filter((f) => {
    const p = normalizePath(f.path);
    return p.startsWith("adrs/") && p.endsWith(".md");
  });
  if (adrFiles.length === 0) return [];

  const combinedCorpus = releaseIssues
    .map(
      (i) =>
        `${i.description}\n${i.comments.map((c) => c.text).join("\n")}\n${i.labels.join(" ")}`
    )
    .join("\n")
    .toLowerCase();

  const matched: { id: string; title: string; path: string }[] = [];
  for (const adrFile of adrFiles) {
    const cleanPath = normalizePath(adrFile.path);
    const stem = (adrFile.name || cleanPath.split("/").pop() || "").replace(/\.md$/i, "");
    const adrCodeMatch = stem.match(/^(ADR-\d+)/i);
    const adrCode = adrCodeMatch ? adrCodeMatch[1].toUpperCase() : stem.toUpperCase();

    const isReferenced =
      combinedCorpus.includes(cleanPath.toLowerCase()) ||
      combinedCorpus.includes(stem.toLowerCase()) ||
      combinedCorpus.includes(adrCode.toLowerCase());

    if (isReferenced) {
      const { scalars, body } = extractFrontmatter(adrFile.content);
      const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
      matched.push({
        id: adrCode,
        title: (scalars.title || h1 || stem).trim(),
        path: cleanPath,
      });
    }
  }

  return matched;
}

export function generateReleaseNotesMarkdown(
  release: AgileRelease,
  issues: AgileIssue[],
  allFiles: WorkspaceFile[],
  language: "de" | "en"
): WorkspaceFile {
  const isDe = language === "de";
  const slug = releaseVersionToSlug(release.version);
  const filePath = `wiki/releases/${slug}.md`;
  const fileName = `${slug}.md`;
  const nowIso = new Date().toISOString();

  const releaseIssues = getIssuesForRelease(release.version, issues);
  const progress = computeReleaseProgress(release, issues);

  const featuresAndStories = releaseIssues.filter((i) => i.type !== "bug");
  const bugfixes = releaseIssues.filter((i) => i.type === "bug");
  const linkedAdrs = discoverLinkedAdrs(releaseIssues, allFiles);

  const formatIssueLine = (iss: AgileIssue): string => {
    const statusBadge = iss.status.toUpperCase();
    const assigneeStr = iss.assignee ? ` · ${iss.assignee}` : "";
    const spStr = iss.storyPoints > 0 ? `${iss.storyPoints} SP · ` : "";
    return `- **[${iss.id}](${normalizePath(iss.filePath)})** — ${iss.title} *(${spStr}${statusBadge}${assigneeStr})*`;
  };

  const stateLabel =
    release.state === "released"
      ? isDe
        ? "Veröffentlicht (Released)"
        : "Released"
      : release.state === "unreleased"
      ? isDe
        ? "In Vorbereitung (Unreleased)"
        : "Unreleased"
      : isDe
      ? "Geplant (Planned)"
      : "Planned";

  const title = isDe
    ? `Release Notes ${release.version} — ${release.name}`
    : `Release Notes ${release.version} — ${release.name}`;

  const frontmatter = [
    "---",
    `title: ${escapeYamlString(title)}`,
    `type: "release-notes"`,
    `version: ${escapeYamlString(release.version)}`,
    `state: ${escapeYamlString(release.state)}`,
    `target_date: ${escapeYamlString(release.targetDate)}`,
    `review_status: ${escapeYamlString(release.state === "released" ? "approved" : "in-review")}`,
    `updated_at: ${escapeYamlString(nowIso)}`,
    "---",
  ].join("\n");

  const summaryHeading = isDe ? "## Zusammenfassung (Summary)" : "## Summary";
  const featuresHeading = isDe ? "## Features & User Stories" : "## Features & Stories";
  const bugsHeading = isDe ? "## Fehlerbehebungen (Bugfixes)" : "## Bugfixes";
  const adrsHeading = isDe
    ? "## Verknüpfte Architekturentscheidungen (Linked ADRs)"
    : "## Linked Architecture Decisions (ADRs)";
  const liveQueryHeading = isDe
    ? "## Live-Ticket-Matrix (Confluence Query Macro)"
    : "## Live Release Ticket Matrix";

  const featuresBody =
    featuresAndStories.length > 0
      ? featuresAndStories.map(formatIssueLine).join("\n")
      : isDe
      ? "_Noch keine Features oder User Stories für dieses Release zugewiesen._"
      : "_No features or stories assigned to this release yet._";

  const bugsBody =
    bugfixes.length > 0
      ? bugfixes.map(formatIssueLine).join("\n")
      : isDe
      ? "_Keine Bugfixes in diesem Release verzeichnet._"
      : "_No bugfixes recorded in this release._";

  const adrsBody =
    linkedAdrs.length > 0
      ? linkedAdrs.map((adr) => `- **[${adr.id}](${adr.path})** — ${adr.title}`).join("\n")
      : isDe
      ? "_Keine direkt referenzierten ADRs in den Tickets dieser Version gefunden._"
      : "_No directly referenced ADRs detected across tickets in this version._";

  const kpiTable = isDe
    ? [
        "| Kennzahl | Wert |",
        "| :--- | :--- |",
        `| **Version** | \`${release.version}\` |`,
        `| **Status** | ${stateLabel} |`,
        `| **Zieldatum** | ${release.targetDate || "—"} |`,
        `| **Abgeschlossene Tickets** | ${progress.doneIssues} / ${progress.totalIssues} (${progress.issueProgressPercent}%) |`,
        `| **Gelieferte Story Points** | ${progress.donePoints} / ${progress.totalPoints} SP (${progress.pointsProgressPercent}%) |`,
      ].join("\n")
    : [
        "| Metric | Value |",
        "| :--- | :--- |",
        `| **Version** | \`${release.version}\` |`,
        `| **Release State** | ${stateLabel} |`,
        `| **Target Date** | ${release.targetDate || "—"} |`,
        `| **Completed Issues** | ${progress.doneIssues} / ${progress.totalIssues} (${progress.issueProgressPercent}%) |`,
        `| **Story Points Delivered** | ${progress.donePoints} / ${progress.totalPoints} SP (${progress.pointsProgressPercent}%) |`,
      ].join("\n");

  const queryBlock = [
    "```query",
    "FROM issues",
    `WHERE fix_version = "${release.version.replace(/"/g, "")}"`,
    "SORT priority DESC",
    "VIEW table",
    "```",
  ].join("\n");

  const md = [
    frontmatter, "", `# ${title}`, "",
    summaryHeading, "",
    release.description || (isDe
      ? `Offizielle Release-Dokumentation für Version **${release.version}**.`
      : `Official release documentation for version **${release.version}**.`),
    "", kpiTable, "",
    featuresHeading, "", featuresBody, "",
    bugsHeading, "", bugsBody, "",
    adrsHeading, "", adrsBody, "",
    liveQueryHeading, "", queryBlock, "",
  ].join("\n");

  return { path: filePath, name: fileName, category: "wiki/releases", content: md };
}
