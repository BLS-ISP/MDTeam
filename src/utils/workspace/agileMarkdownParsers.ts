import type { WorkspaceFile } from "../issueEngine";
import type {
  BacklogItem,
  BurndownDataPoint,
  CapacityItem,
  ChecklistItem,
  RetroNote,
  RoadmapItem,
  VelocityItem,
} from "./agileTypesAndParsers";

export * from "./agileTypesAndParsers";

export function serializeBacklogItems(items: BacklogItem[]): string {
  let content = `# Sprint Backlog\n\nSprint-Aufgaben des Teams. Bearbeiten Sie die Aufgabenliste unten, um das Kanban-Board im Dashboard live zu aktualisieren.\n\n## Aufgaben\n\n`;
  items.forEach((item) => {
    const statusChar = item.status === "done" ? "x" : item.status === "in-progress" ? "/" : " ";
    const prefix = item.status === "done" ? "DONE" : item.status === "in-progress" ? "IN-PROGRESS" : "TODO";
    content += `- [${statusChar}] ${prefix}: ${item.title} ${item.assignee}\n`;
  });
  return content;
}

export function serializeCapacityData(velocity: VelocityItem[], capacity: CapacityItem[]): string {
  let content = `# Sprint-Kapazität & Velocity\n\nHistorische Velocity und aktuelle Teamberechnungen.\n\n## Historische Velocity\n\n| Sprint | Geplant (Story Points) | Erreicht (Story Points) |\n| :----- | :--------------------- | :---------------------- |\n`;
  velocity.forEach((v) => {
    content += `| ${v.sprint} | ${v.planned} | ${v.actual} |\n`;
  });
  content += `\n## Team-Kapazität (Aktueller Sprint)\n\n| Teammitglied | Verfügbare Tage | Fokus-Faktor | Kapazität (SP) |\n| :----------- | :-------------- | :----------- | :------------- |\n`;
  capacity.forEach((c) => {
    content += `| ${c.member} | ${c.days} | ${c.focus} | ${c.capacity.toFixed(1)} |\n`;
  });
  return content;
}

export function serializeRoadmapItems(items: RoadmapItem[]): string {
  let content = `# Projekt-Roadmap & Meilensteine\n\nPMs nutzen dieses Dokument, um Meilensteine zu überwachen. Ändern Sie die YAML-Blöcke unten, um die Timeline im Dashboard live zu aktualisieren.\n\n`;
  items.forEach((item) => {
    content += `---\ntitle: "${item.title}"\nstatus: "${item.status}"\nmilestone: "${item.milestone}"\nstart_date: "${item.start_date}"\nend_date: "${item.end_date}"\nassignee: "${item.assignee}"\n`;
    if (item.color) {
      content += `color: "${item.color}"\n`;
    }
    content += `---\n\n`;
  });
  return content;
}

export function serializeChecklistData(title: string, desc: string, items: ChecklistItem[]): string {
  let content = `# ${title}\n\n${desc}\n\n## Kriterien\n\n`;
  items.forEach((i) => {
    const char = i.checked ? "x" : " ";
    content += `*   [${char}] ${i.text}\n`;
  });
  return content;
}

export function serializeBurndownData(data: BurndownDataPoint[]): string {
  let content = `# Sprint Burndown Metrics\n\nDaily tracking of remaining efforts (Story Points). Change the table below to update the burndown chart in the dashboard live.\n\n## Sprint Data\n\n| Day | Ideal Line | Remaining Effort (Actual) |\n| :-- | :--------- | :------------------------ |\n`;
  data.forEach((d) => {
    const dayNumber = d.day.replace(/^Day\s+/i, "").trim();
    const actualStr = d.actual !== null && !isNaN(d.actual) ? d.actual.toString() : "";
    content += `| ${dayNumber} | ${d.ideal} | ${actualStr} |\n`;
  });
  return content;
}

export function serializeRetroNotesForFile(files: WorkspaceFile[], filePath: string, notes: RetroNote[]): string {
  const file = files.find((f) => f.path === filePath);
  let title = "# Retrospective";
  if (file) {
    const firstLine = file.content.split("\n")[0];
    if (firstLine && firstLine.startsWith("# ")) {
      title = firstLine;
    }
  }

  let content = `${title}\n\n## 1. What went well? (Glad)\n\n`;
  notes
    .filter((n) => n.type === "glad")
    .forEach((n) => {
      content += `- ${n.text}\n`;
    });

  content += `\n## 2. What did not go well? (Sad)\n\n`;
  notes
    .filter((n) => n.type === "sad")
    .forEach((n) => {
      content += `- ${n.text}\n`;
    });

  content += `\n## 3. Impediments / Blocker Log\n\n`;
  notes
    .filter((n) => n.type === "impediment")
    .forEach((n) => {
      const prefix = n.text.toUpperCase().startsWith("BLOCKED:") ? "" : "BLOCKED: ";
      content += `- [ ] ${prefix}${n.text}\n`;
    });

  return content;
}
