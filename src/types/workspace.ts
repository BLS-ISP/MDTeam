export interface WorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

export interface CommitEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

export type Commit = CommitEntry;

export interface CollaboratorCursor {
  name: string;
  color: string;
  activeFile: string;
  cursorLine: number;
}
