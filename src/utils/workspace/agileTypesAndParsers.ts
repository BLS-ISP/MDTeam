import type { WorkspaceFile } from "../issueEngine";

export interface Commit {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

export interface RoadmapItem {
  title: string;
  status: "completed" | "in-progress" | "pending";
  milestone: string;
  start_date: string;
  end_date: string;
  assignee: string;
  color?: string;
}

export interface BacklogItem {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  assignee: string;
}

export interface BurndownDataPoint {
  day: string;
  ideal: number;
  actual: number | null;
}

export interface ImpedimentItem {
  filePath: string;
  fileName: string;
  line: number;
  title: string;
  assignee: string;
}

export interface VelocityItem {
  sprint: string;
  planned: number;
  actual: number;
}

export interface CapacityItem {
  member: string;
  days: number;
  focus: number;
  capacity: number;
}

export interface RetroNote {
  type: "glad" | "sad" | "impediment";
  text: string;
}

export interface ChecklistItem {
  checked: boolean;
  text: string;
}

export function isAgileFile(path: string): boolean {
  if (!path) return false;
  const cleanPath = path.toLowerCase().replace(/\\/g, "/");
  return (
    cleanPath === "management/sprint-backlog.md" ||
    cleanPath === "management/capacity.md" ||
    cleanPath === "management/roadmap.md" ||
    cleanPath === "management/burndown.md" ||
    cleanPath.includes("definition-of-") ||
    cleanPath.includes("retro")
  );
}

export function parseRoadmapItems(files: WorkspaceFile[]): RoadmapItem[] {
  const roadmapFile = files.find((f) => f.path === "management/roadmap.md");
  if (!roadmapFile) return [];

  const blocks = roadmapFile.content.split("---");
  const items: RoadmapItem[] = [];

  blocks.forEach((block) => {
    if (!block.includes("title:") || !block.includes("status:")) return;

    const lines = block.split("\n");
    const item: Partial<RoadmapItem> = {};

    lines.forEach((line) => {
      const parts = line.split(":");
      if (parts.length < 2) return;
      const key = parts[0].trim();
      const value = parts.slice(1).join(":").trim().replace(/"/g, "").replace(/'/g, "");

      if (key === "title") item.title = value;
      if (key === "status") item.status = value as RoadmapItem["status"];
      if (key === "milestone") item.milestone = value;
      if (key === "start_date") item.start_date = value;
      if (key === "end_date") item.end_date = value;
      if (key === "assignee") item.assignee = value;
      if (key === "color") item.color = value;
    });

    if (item.title && item.status) {
      items.push(item as RoadmapItem);
    }
  });

  return items;
}

export function parseBacklogItems(files: WorkspaceFile[]): BacklogItem[] {
  const backlogFile = files.find((f) => f.path === "management/sprint-backlog.md");
  if (!backlogFile) return [];

  const items: BacklogItem[] = [];
  const lines = backlogFile.content.split("\n");

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- [")) return;

    const statusChar = trimmed.substring(3, 4);
    let status: "todo" | "in-progress" | "done" = "todo";
    if (statusChar === "/") status = "in-progress";
    if (statusChar === "x" || statusChar === "X") status = "done";

    let text = trimmed.substring(6).trim();
    if (text.toUpperCase().startsWith("TODO:")) text = text.substring(5).trim();
    else if (text.toUpperCase().startsWith("IN-PROGRESS:")) text = text.substring(12).trim();
    else if (text.toUpperCase().startsWith("DONE:")) text = text.substring(5).trim();

    const assigneeMatch = text.match(/@([a-zA-Z0-9_-]+)$/);
    let assignee = "Unassigned";
    if (assigneeMatch) {
      assignee = `@${assigneeMatch[1]}`;
      text = text.replace(/@([a-zA-Z0-9_-]+)$/, "").trim();
    }

    items.push({
      id: `backlog-${idx}`,
      title: text,
      status,
      assignee,
    });
  });

  return items;
}

export function parseBurndownData(files: WorkspaceFile[]): BurndownDataPoint[] {
  const burndownFile = files.find((f) => f.path === "management/burndown.md");
  if (!burndownFile) return [];

  const data: BurndownDataPoint[] = [];
  const lines = burndownFile.content.split("\n");

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (
      !trimmed.startsWith("|") ||
      trimmed.includes("Tag") ||
      trimmed.includes("Day") ||
      trimmed.includes("---") ||
      trimmed.includes(":---")
    ) {
      return;
    }

    const cols = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cols.length < 2) return;

    const day = cols[0];
    const ideal = parseFloat(cols[1]);
    const actualVal = cols[2] ? parseFloat(cols[2]) : null;

    if (!isNaN(ideal)) {
      data.push({
        day: `Day ${day.replace(/^(Tag|Day)\s+/i, "")}`,
        ideal,
        actual: actualVal === null || isNaN(actualVal) ? null : actualVal,
      });
    }
  });

  return data;
}

export function parseImpedimentItems(files: WorkspaceFile[]): ImpedimentItem[] {
  const impediments: ImpedimentItem[] = [];

  files.forEach((file) => {
    if (file.category !== "meetings" && !file.path.startsWith("meetings/")) return;

    const lines = file.content.split("\n");
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("- [ ] BLOCKED:") || trimmed.startsWith("- [ ] BLOCKER:")) {
        let text = trimmed.substring(14).trim();

        const assigneeMatch = text.match(/@([a-zA-Z0-9_-]+)$/);
        let assignee = "Unassigned";
        if (assigneeMatch) {
          assignee = `@${assigneeMatch[1]}`;
          text = text.replace(/@([a-zA-Z0-9_-]+)$/, "").trim();
        }

        impediments.push({
          filePath: file.path,
          fileName: file.name,
          line: idx + 1,
          title: text,
          assignee,
        });
      }
    });
  });

  return impediments;
}

export function parseVelocityData(files: WorkspaceFile[]): VelocityItem[] {
  const capacityFile = files.find((f) => f.path === "management/capacity.md");
  if (!capacityFile) return [];

  const data: VelocityItem[] = [];
  const lines = capacityFile.content.split("\n");
  let inVelocitySection = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("## Historische Velocity") || trimmed.startsWith("## Historical Velocity")) {
      inVelocitySection = true;
      return;
    }
    if (trimmed.startsWith("## Team-Kapazität") || trimmed.startsWith("## Team Capacity")) {
      inVelocitySection = false;
      return;
    }

    if (inVelocitySection && trimmed.startsWith("|") && !trimmed.includes("Sprint") && !trimmed.includes("---")) {
      const cols = trimmed
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cols.length >= 3) {
        const sprint = cols[0];
        const planned = parseFloat(cols[1]);
        const actual = parseFloat(cols[2]);
        if (!isNaN(planned) && !isNaN(actual)) {
          data.push({ sprint, planned, actual });
        }
      }
    }
  });

  return data;
}

export function parseCapacityData(files: WorkspaceFile[]): CapacityItem[] {
  const capacityFile = files.find((f) => f.path === "management/capacity.md");
  if (!capacityFile) return [];

  const data: CapacityItem[] = [];
  const lines = capacityFile.content.split("\n");
  let inCapacitySection = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("## Team-Kapazität") || trimmed.startsWith("## Team Capacity")) {
      inCapacitySection = true;
      return;
    }
    if (trimmed.startsWith("## Historische Velocity") || trimmed.startsWith("## Historical Velocity")) {
      inCapacitySection = false;
      return;
    }

    if (
      inCapacitySection &&
      trimmed.startsWith("|") &&
      !trimmed.includes("Teammitglied") &&
      !trimmed.includes("Team Member") &&
      !trimmed.includes("---")
    ) {
      const cols = trimmed
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cols.length >= 4) {
        const member = cols[0];
        const days = parseFloat(cols[1]);
        const focus = parseFloat(cols[2]);
        const capacity = parseFloat(cols[3]);
        if (!isNaN(days) && !isNaN(focus) && !isNaN(capacity)) {
          data.push({ member, days, focus, capacity });
        }
      }
    }
  });

  return data;
}

export function parseRetroNotesForFile(files: WorkspaceFile[], filePath: string): RetroNote[] {
  const retroFile = files.find((f) => f.path === filePath);
  if (!retroFile) return [];

  const notes: RetroNote[] = [];
  const lines = retroFile.content.split("\n");
  let currentType: "glad" | "sad" | "impediment" | null = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.includes("1. Was lief gut?") || trimmed.includes("(Glad)")) {
      currentType = "glad";
      return;
    }
    if (trimmed.includes("2. Was lief nicht gut?") || trimmed.includes("(Sad)")) {
      currentType = "sad";
      return;
    }
    if (
      trimmed.includes("3. Impediments / Blocker Log") ||
      trimmed.includes("Blocker Log") ||
      trimmed.includes("(Blocker)")
    ) {
      currentType = "impediment";
      return;
    }
    if (trimmed.startsWith("##")) {
      currentType = null;
      return;
    }

    if (currentType && (trimmed.startsWith("*") || trimmed.startsWith("-"))) {
      let text = trimmed.replace(/^[*+-]\s*/, "");
      if (currentType === "impediment") {
        text = text.replace(/^\[[ x]\]\s*(BLOCKED:|BLOCKER:)?\s*/i, "");
      }
      notes.push({ type: currentType, text });
    }
  });

  return notes;
}

export function parseChecklistData(files: WorkspaceFile[], filePath: string): ChecklistItem[] {
  const file = files.find((f) => f.path === filePath);
  if (!file) return [];

  const items: ChecklistItem[] = [];
  const lines = file.content.split("\n");
  lines.forEach((l) => {
    const trimmed = l.trim();
    if (trimmed.startsWith("*   [") || trimmed.startsWith("- [")) {
      const checked = trimmed.substring(5, 6).toLowerCase() === "x";
      const text = trimmed.replace(/^[-*]\s+\[[ x]\]\s*/i, "").trim();
      items.push({ checked, text });
    }
  });
  return items;
}

export function parseChecklistMetadata(files: WorkspaceFile[], filePath: string): { title: string; desc: string } {
  const file = files.find((f) => f.path === filePath);
  if (!file) return { title: "Checkliste", desc: "" };
  const lines = file.content.split("\n");
  let title = "Checkliste";
  let desc = "";

  if (lines.length > 0 && lines[0].startsWith("# ")) {
    title = lines[0].substring(2).trim();
  }
  if (lines.length > 2 && lines[2].trim()) {
    desc = lines[2].trim();
  }
  return { title, desc };
}
