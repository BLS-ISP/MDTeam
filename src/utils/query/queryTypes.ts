export interface WorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

export type QuerySource =
  | "issues"
  | "adrs"
  | "pages"
  | "roadmap"
  | "arc42"
  | "wiki"
  | "meetings"
  | "sprints"
  | "all";

export type QueryOperator =
  | "="
  | "!="
  | "~"
  | "!~"
  | ">"
  | ">="
  | "<"
  | "<="
  | "in"
  | "contains";

export interface QueryCondition {
  field: string;
  operator: QueryOperator;
  value: string;
}

export type QueryViewMode = "table" | "cards" | "stats";

export interface ParsedQuery {
  source: QuerySource;
  conditions: QueryCondition[];
  sortField: string;
  sortDirection: "asc" | "desc";
  view: QueryViewMode;
  limit?: number;
  columns?: string[];
  raw: string;
  parseError?: string;
}

export interface QueryRecord {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  storyPoints: number;
  sprint: string;
  epic: string;
  assignee: string;
  reporter: string;
  labels: string[];
  blockedBy: string[];
  reviewStatus: string;
  approvedBy: string;
  milestone: string;
  startDate: string;
  endDate: string;
  updatedAt: string;
  createdAt: string;
  category: string;
  path: string;
  excerpt: string;
  rawFrontmatter: Record<string, string | string[]>;
}

export interface QuerySummary {
  totalCount: number;
  doneCount: number;
  inProgressCount: number;
  blockedCount: number;
  totalPoints: number;
  completedPoints: number;
  inProgressPoints: number;
  completionPct: number;
}

export interface QueryExecutionResult {
  parsed: ParsedQuery;
  records: QueryRecord[];
  summary: QuerySummary;
}

export interface LiveQueryBlockProps {
  queryText: string;
  files: WorkspaceFile[];
  onOpenFile: (path: string) => void;
  language?: "de" | "en";
}
