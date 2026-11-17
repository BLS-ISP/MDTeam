import type { QueryRecord, QuerySource, WorkspaceFile } from "./queryTypes";
import {
  asString,
  asStringArray,
  extractAdrBodyStatus,
  extractExcerpt,
  extractFirstHeading,
  extractFrontmatter,
  normalizeStatus,
  parseYamlLines,
} from "./queryFrontmatterExtractor";

function extractFileRecord(file: WorkspaceFile): QueryRecord {
  const { frontmatter: fm, body } = extractFrontmatter(file.content);
  const headingTitle = extractFirstHeading(file.content);
  const fallbackTitle = file.name.replace(/\.md$/i, "").replace(/_/g, " ");

  const isIssue = file.path.startsWith("issues/");
  const isAdr = file.path.startsWith("adrs/");
  const isArc42 = file.path.startsWith("arc42/");
  const isWiki = file.path.startsWith("wiki/");
  const isMeeting = file.path.startsWith("meetings/");
  const isSprint = file.path.startsWith("sprints/");

  const defaultId =
    isIssue || isAdr
      ? file.name.replace(/\.md$/i, "")
      : isArc42
      ? file.name.match(/^(\d+)/)?.[1]
        ? `ARC-${file.name.match(/^(\d+)/)?.[1]}`
        : file.name.replace(/\.md$/i, "")
      : file.name.replace(/\.md$/i, "").toUpperCase().slice(0, 14);

  const defaultType = isIssue
    ? "story"
    : isAdr
    ? "adr"
    : isArc42
    ? "arc42"
    : isWiki
    ? "wiki"
    : isMeeting
    ? "meeting"
    : isSprint
    ? "sprint"
    : "page";

  const rawStatus =
    asString(fm.status) ||
    asString(fm.state) ||
    asString(fm.review_status) ||
    (isAdr ? extractAdrBodyStatus(body) : "") ||
    (isIssue ? "backlog" : "draft");

  const blockedBy = asStringArray(fm.blocked_by);
  const normalizedStatus =
    blockedBy.length > 0 && rawStatus !== "done" && rawStatus !== "completed"
      ? normalizeStatus(rawStatus)
      : normalizeStatus(rawStatus);

  const pointsRaw =
    asString(fm.story_points) ||
    asString(fm.points) ||
    asString(fm.committed_points) ||
    "0";
  const parsedPoints = Number.parseFloat(pointsRaw);

  return {
    id: asString(fm.id, defaultId),
    title: asString(fm.title) || headingTitle || fallbackTitle,
    type: asString(fm.type, defaultType).toLowerCase(),
    status: normalizedStatus,
    priority: asString(fm.priority, isIssue ? "medium" : "normal").toLowerCase(),
    storyPoints: Number.isFinite(parsedPoints) ? parsedPoints : 0,
    sprint: asString(fm.sprint),
    epic: asString(fm.epic),
    assignee: asString(fm.assignee) || asString(fm.author),
    reporter: asString(fm.reporter) || asString(fm.author),
    labels: asStringArray(fm.labels ?? fm.tags),
    blockedBy,
    reviewStatus: normalizeStatus(
      asString(fm.review_status, asString(fm.status, "draft"))
    ),
    approvedBy: asString(fm.approved_by),
    milestone: asString(fm.milestone),
    startDate: asString(fm.start_date),
    endDate: asString(fm.end_date),
    updatedAt:
      asString(fm.updated_at) || asString(fm.date) || asString(fm.end_date),
    createdAt: asString(fm.created_at) || asString(fm.start_date),
    category: file.category || file.path.split("/")[0] || "root",
    path: file.path,
    excerpt: extractExcerpt(body),
    rawFrontmatter: fm,
  };
}

function extractRoadmapRecords(files: WorkspaceFile[]): QueryRecord[] {
  const records: QueryRecord[] = [];
  const roadmapFile = files.find((f) => f.path === "management/roadmap.md");

  if (roadmapFile) {
    const normalized = roadmapFile.content.replace(/\r\n/g, "\n");
    const blockRegex = /^---\n([\s\S]*?)\n---/gm;
    let match: RegExpExecArray | null;
    let idx = 1;
    while ((match = blockRegex.exec(normalized)) !== null) {
      const fm = parseYamlLines(match[1].split("\n"));
      if (Object.keys(fm).length === 0) continue;
      const status = normalizeStatus(asString(fm.status, "pending"));
      const points = Number.parseFloat(asString(fm.story_points, "0"));
      records.push({
        id: asString(fm.id, `RM-${String(idx).padStart(2, "0")}`),
        title: asString(fm.title, `Milestone ${idx}`),
        type: "milestone",
        status,
        priority: asString(fm.priority, "high").toLowerCase(),
        storyPoints: Number.isFinite(points) ? points : 0,
        sprint: asString(fm.sprint),
        epic: asString(fm.epic),
        assignee: asString(fm.assignee),
        reporter: "",
        labels: asStringArray(fm.labels),
        blockedBy: [],
        reviewStatus: status,
        approvedBy: "",
        milestone: asString(fm.milestone),
        startDate: asString(fm.start_date),
        endDate: asString(fm.end_date),
        updatedAt: asString(fm.end_date) || asString(fm.start_date),
        createdAt: asString(fm.start_date),
        category: "roadmap",
        path: roadmapFile.path,
        excerpt: asString(fm.milestone),
        rawFrontmatter: fm,
      });
      idx++;
    }
  }

  // Also include Epic issues that define roadmap start/end dates
  const epicFiles = files.filter((f) => f.path.startsWith("issues/"));
  for (const ef of epicFiles) {
    const rec = extractFileRecord(ef);
    if (rec.type === "epic") {
      records.push(rec);
    }
  }

  return records;
}

function extractLegacyBacklogRecords(files: WorkspaceFile[]): QueryRecord[] {
  const backlogFile = files.find(
    (f) => f.path === "management/sprint-backlog.md"
  );
  if (!backlogFile) return [];

  const records: QueryRecord[] = [];
  const lines = backlogFile.content.replace(/\r\n/g, "\n").split("\n");
  let idx = 1;

  for (const line of lines) {
    const match = line.match(
      /^[-*]\s+\[([ xX/])\]\s+(?:(TODO|IN-PROGRESS|DONE|BLOCKED):\s*)?(.+)$/i
    );
    if (!match) continue;
    const checkChar = match[1];
    const explicitTag = (match[2] || "").toUpperCase();
    let rest = match[3].trim();

    let assignee = "";
    const mentionMatch = rest.match(/(@[a-zA-Z0-9_-]+)/);
    if (mentionMatch) {
      assignee = mentionMatch[1];
      rest = rest.replace(mentionMatch[1], "").trim();
    }

    let status = "backlog";
    if (checkChar.toLowerCase() === "x" || explicitTag === "DONE") {
      status = "done";
    } else if (checkChar === "/" || explicitTag === "IN-PROGRESS") {
      status = "in-progress";
    } else if (explicitTag === "BLOCKED") {
      status = "blocked";
    }

    records.push({
      id: `BKL-${String(idx).padStart(2, "0")}`,
      title: rest,
      type: "task",
      status,
      priority: status === "blocked" ? "high" : "medium",
      storyPoints: 3,
      sprint: "sprint-01",
      epic: "",
      assignee,
      reporter: "",
      labels: ["legacy"],
      blockedBy: status === "blocked" ? ["impediment"] : [],
      reviewStatus: status,
      approvedBy: "",
      milestone: "",
      startDate: "",
      endDate: "",
      updatedAt: "",
      createdAt: "",
      category: "issues",
      path: backlogFile.path,
      excerpt: rest,
      rawFrontmatter: {},
    });
    idx++;
  }

  return records;
}

/**
 * Extracts normalized records for a requested source across WorkspaceFile[].
 */
export function extractWorkspaceRecords(
  files: WorkspaceFile[],
  source: QuerySource
): QueryRecord[] {
  const visibleFiles = files.filter(
    (f) => !f.path.startsWith(".mdteam/") && f.path.endsWith(".md")
  );

  if (source === "roadmap") {
    return extractRoadmapRecords(files);
  }

  if (source === "issues") {
    const issueFiles = visibleFiles.filter((f) => f.path.startsWith("issues/"));
    if (issueFiles.length > 0) {
      return issueFiles.map(extractFileRecord);
    }
    return extractLegacyBacklogRecords(files);
  }

  if (source === "adrs") {
    return visibleFiles
      .filter((f) => f.path.startsWith("adrs/"))
      .map(extractFileRecord);
  }

  if (source === "arc42") {
    return visibleFiles
      .filter((f) => f.path.startsWith("arc42/"))
      .map(extractFileRecord);
  }

  if (source === "wiki") {
    return visibleFiles
      .filter((f) => f.path.startsWith("wiki/"))
      .map(extractFileRecord);
  }

  if (source === "meetings") {
    return visibleFiles
      .filter((f) => f.path.startsWith("meetings/"))
      .map(extractFileRecord);
  }

  if (source === "sprints") {
    return visibleFiles
      .filter((f) => f.path.startsWith("sprints/"))
      .map(extractFileRecord);
  }

  if (source === "pages") {
    return visibleFiles
      .filter(
        (f) => !f.path.startsWith("issues/") && !f.path.startsWith("sprints/")
      )
      .map(extractFileRecord);
  }

  // source === "all"
  return visibleFiles.map(extractFileRecord);
}
