import type { WorkspaceFile } from "../../types/workspace";
import type {
  AgileIssue,
  AgileSprint,
  TeamCapacityMember,
  VelocityRecord,
  WorkspaceImpediment,
} from "../../types/agile";
import { escapeYamlString, extractFrontmatter, normalizePath } from "../frontmatter";

export function parseSprints(files: WorkspaceFile[]): AgileSprint[] {
  const sprints: AgileSprint[] = [];

  for (const file of files || []) {
    const cleanPath = normalizePath(file.path);
    if (!cleanPath.startsWith("sprints/") || !cleanPath.endsWith(".md")) continue;

    const { scalars, body } = extractFrontmatter(file.content);
    const stem = (file.name || cleanPath.split("/").pop() || "sprint-01").replace(/\.md$/i, "");
    const id = (scalars.id || stem).trim();

    let goalFromBody = "";
    const lines = body.split("\n");
    let inGoal = false;
    for (const line of lines) {
      const t = line.trim();
      if (/^##\s+(sprint\s+goal|sprint-ziel|ziel|goal)/i.test(t)) {
        inGoal = true;
        continue;
      }
      if (inGoal && t.startsWith("## ")) {
        break;
      }
      if (inGoal && t) {
        goalFromBody += (goalFromBody ? " " : "") + t;
      }
    }

    const rawState = (scalars.state || scalars.status || "planned").toLowerCase();
    const state: "planned" | "active" | "closed" =
      rawState === "active" || rawState === "in-progress"
        ? "active"
        : rawState === "closed" || rawState === "completed" || rawState === "done"
        ? "closed"
        : "planned";

    const committedRaw = Number(scalars.committed_points ?? scalars.committedpoints ?? 0);
    const completedRaw =
      scalars.completed_points !== undefined ? Number(scalars.completed_points) : undefined;

    sprints.push({
      id,
      name: (scalars.name || scalars.title || id).trim(),
      goal: (scalars.goal || goalFromBody || "").trim(),
      startDate: (scalars.start_date || scalars.startdate || "2026-06-01").trim(),
      endDate: (scalars.end_date || scalars.enddate || "2026-06-14").trim(),
      state,
      committedPoints: Number.isFinite(committedRaw) ? committedRaw : 0,
      completedPoints: completedRaw !== undefined && Number.isFinite(completedRaw) ? completedRaw : undefined,
      filePath: cleanPath,
    });
  }

  sprints.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return sprints;
}

export function serializeSprintToMarkdown(sprint: AgileSprint): WorkspaceFile {
  const cleanId = (sprint.id || "sprint-01").trim();
  const filePath = sprint.filePath ? normalizePath(sprint.filePath) : `sprints/${cleanId}.md`;
  const fileName = filePath.split("/").pop() || `${cleanId}.md`;

  const lines = [
    "---",
    `id: ${escapeYamlString(cleanId)}`,
    `name: ${escapeYamlString(sprint.name || cleanId)}`,
    `goal: ${escapeYamlString(sprint.goal || "")}`,
    `state: ${escapeYamlString(sprint.state)}`,
    `start_date: ${escapeYamlString(sprint.startDate || "")}`,
    `end_date: ${escapeYamlString(sprint.endDate || "")}`,
    `committed_points: ${Number.isFinite(sprint.committedPoints) ? sprint.committedPoints : 0}`,
  ];

  if (sprint.completedPoints !== undefined && Number.isFinite(sprint.completedPoints)) {
    lines.push(`completed_points: ${sprint.completedPoints}`);
  }
  lines.push("---");
  lines.push("");
  lines.push(`# ${sprint.name || cleanId}`);
  lines.push("");
  lines.push("## Sprint Goal");
  lines.push("");
  lines.push(sprint.goal || "_Define sprint goal..._");
  lines.push("");

  return {
    path: filePath,
    name: fileName,
    category: "sprints",
    content: lines.join("\n"),
  };
}

export function parseCapacityAndVelocity(files: WorkspaceFile[]): {
  capacity: TeamCapacityMember[];
  velocity: VelocityRecord[];
  totalCapacitySp: number;
} {
  const capFile = (files || []).find(
    (f) => normalizePath(f.path) === "management/capacity.md"
  );
  if (!capFile) {
    return { capacity: [], velocity: [], totalCapacitySp: 0 };
  }

  const capacity: TeamCapacityMember[] = [];
  const velocity: VelocityRecord[] = [];
  let section: "none" | "velocity" | "capacity" = "none";

  for (const rawLine of capFile.content.replace(/\r\n/g, "\n").split("\n")) {
    const t = rawLine.trim();
    if (/^##\s+(Historische Velocity|Historical Velocity)/i.test(t)) {
      section = "velocity";
      continue;
    }
    if (/^##\s+(Team-Kapazität|Team Capacity)/i.test(t)) {
      section = "capacity";
      continue;
    }
    if (t.startsWith("## ")) {
      section = "none";
      continue;
    }

    if (!t.startsWith("|") || t.includes("---")) continue;
    const cols = t
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);

    if (section === "velocity" && cols.length >= 3 && !/sprint/i.test(cols[1])) {
      const planned = parseFloat(cols[1]);
      const actual = parseFloat(cols[2]);
      if (Number.isFinite(planned) && Number.isFinite(actual)) {
        velocity.push({ sprint: cols[0], planned, actual });
      }
    } else if (section === "capacity" && cols.length >= 4 && !/tage|days/i.test(cols[1])) {
      const days = parseFloat(cols[1]);
      const focus = parseFloat(cols[2]);
      const cap = parseFloat(cols[3]);
      if (Number.isFinite(days) && Number.isFinite(focus) && Number.isFinite(cap)) {
        capacity.push({ member: cols[0], days, focus, capacity: cap });
      }
    }
  }

  const totalCapacitySp = Number(
    capacity.reduce((sum, m) => sum + m.capacity, 0).toFixed(1)
  );

  return { capacity, velocity, totalCapacitySp };
}

export function appendCompletedSprintToCapacity(
  files: WorkspaceFile[],
  sprintName: string,
  plannedSp: number,
  completedSp: number
): WorkspaceFile {
  const existing = (files || []).find(
    (f) => normalizePath(f.path) === "management/capacity.md"
  );
  const { capacity, velocity } = parseCapacityAndVelocity(files);

  const updatedVelocity = [...velocity];
  const existingIdx = updatedVelocity.findIndex(
    (v) => v.sprint.toLowerCase() === sprintName.toLowerCase()
  );
  if (existingIdx >= 0) {
    updatedVelocity[existingIdx] = {
      sprint: sprintName,
      planned: plannedSp,
      actual: completedSp,
    };
  } else {
    updatedVelocity.push({
      sprint: sprintName,
      planned: plannedSp,
      actual: completedSp,
    });
  }

  const defaultCapacity =
    capacity.length > 0
      ? capacity
      : [
          { member: "@developer-a", days: 10, focus: 0.8, capacity: 8.0 },
          { member: "@developer-b", days: 8, focus: 0.7, capacity: 5.6 },
          { member: "@scrummaster", days: 5, focus: 0.4, capacity: 2.0 },
        ];

  let content = `# Sprint-Kapazität & Velocity\n\nHistorische Velocity und aktuelle Teamberechnungen.\n\n## Historische Velocity\n\n| Sprint | Geplant (Story Points) | Erreicht (Story Points) |\n| :----- | :--------------------- | :---------------------- |\n`;
  for (const v of updatedVelocity) {
    content += `| ${v.sprint} | ${v.planned} | ${v.actual} |\n`;
  }
  content += `\n## Team-Kapazität (Aktueller Sprint)\n\n| Teammitglied | Verfügbare Tage | Fokus-Faktor | Kapazität (SP) |\n| :----------- | :-------------- | :----------- | :------------- |\n`;
  for (const c of defaultCapacity) {
    content += `| ${c.member} | ${c.days} | ${c.focus} | ${c.capacity.toFixed(1)} |\n`;
  }

  return {
    path: existing?.path || "management/capacity.md",
    name: existing?.name || "capacity.md",
    category: existing?.category || "management",
    content,
  };
}

export function extractImpediments(
  files: WorkspaceFile[],
  issues: AgileIssue[]
): WorkspaceImpediment[] {
  const items: WorkspaceImpediment[] = [];

  // 1. Blocked AgileIssues
  for (const issue of issues || []) {
    if (issue.status === "done") continue;
    const isBlocked =
      issue.blockedBy.length > 0 ||
      issue.labels.some((l) => l.toLowerCase() === "blocked") ||
      /\bBLOCKED\b/i.test(issue.title);
    if (isBlocked) {
      items.push({
        id: issue.id,
        source: "issue",
        title: `${issue.id}: ${issue.title}`,
        assignee: issue.assignee || "Unassigned",
        blockedBy: issue.blockedBy,
        filePath: issue.filePath,
      });
    }
  }

  // 2. Markdown - [ ] BLOCKED: lines in meetings/*.md or management/*.md
  for (const file of files || []) {
    const cleanPath = normalizePath(file.path);
    if (cleanPath.startsWith("issues/")) continue;
    const lines = file.content.replace(/\r\n/g, "\n").split("\n");
    lines.forEach((line, idx) => {
      const t = line.trim();
      const m = t.match(/^[-*]\s+\[\s\]\s*(?:BLOCKED|BLOCKER)\s*:\s*(.+)$/i);
      if (m) {
        let text = m[1].trim();
        let assignee = "@scrummaster";
        const handleMatch = text.match(/(@[a-zA-Z0-9_.-]+)/);
        if (handleMatch) {
          assignee = handleMatch[1];
          text = text.replace(handleMatch[1], "").trim();
        }
        items.push({
          id: `MD-${cleanPath}-${idx + 1}`,
          source: "markdown",
          title: text,
          assignee,
          blockedBy: [],
          filePath: cleanPath,
          line: idx + 1,
        });
      }
    });
  }

  return items;
}
