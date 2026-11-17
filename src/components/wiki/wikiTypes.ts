export interface WorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

export type ReviewStatus = "draft" | "in-review" | "approved";

export interface InlineCommentMessage {
  id: string;
  author: string;
  text: string;
  mentions: string[];
  createdAt: string;
}

export interface InlineCommentThread {
  id: string;
  filePath: string;
  quote: string;
  lineNumber?: number;
  status: "open" | "resolved";
  resolved: boolean;
  createdAt: string;
  createdBy: string;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  comments: InlineCommentMessage[];
}

export interface InlineCommentsStore {
  version: number;
  threads: InlineCommentThread[];
}

export interface PageGovernanceBarProps {
  activeFile: WorkspaceFile;
  files?: WorkspaceFile[];
  currentUser: string;
  commentCount?: number;
  isTauri?: boolean;
  language?: "de" | "en";
  onUpdateContent: (newContent: string) => void;
  onOpenComments: () => void;
  onOpenHistory: () => void;
  onOpenTemplates: () => void;
  onExportDocx?: () => void;
  hideLockBanner?: boolean;
}

export interface InlineCommentsDrawerProps {
  isOpen: boolean;
  activeFile: WorkspaceFile;
  files: WorkspaceFile[];
  currentUser: string;
  selectedQuote?: string;
  selectedLineNumber?: number;
  language?: "de" | "en";
  onClose: () => void;
  onUpsertFile: (file: WorkspaceFile) => void;
  onJumpToLine?: (lineNumber: number) => void;
}

export interface WikiTemplateDefinition {
  id: string;
  name: string;
  nameDe: string;
  badge: string;
  defaultFolder: string;
  slugPrefix: string;
  descriptionEn: string;
  descriptionDe: string;
  buildContent: (
    title: string,
    author: string,
    dateIso: string,
    language: "de" | "en"
  ) => string;
}

export interface TemplateGalleryModalProps {
  isOpen: boolean;
  currentUser?: string;
  existingFiles?: WorkspaceFile[];
  language?: "de" | "en";
  onClose: () => void;
  onCreateFile: (newFile: WorkspaceFile) => void;
}

export interface PageVersionEntry {
  id: string;
  commitHash: string;
  message: string;
  author: string;
  date: string;
  source: "git" | "session";
  snapshotContent?: string;
}

export interface PageHistoryModalProps {
  isOpen: boolean;
  activeFile: WorkspaceFile;
  isTauri: boolean;
  tauriRootFolder?: string;
  serverGitEnabled?: boolean;
  onFetchServerHistory?: (
    filePath: string
  ) => Promise<Array<{ hash: string; message: string; author: string; date: string }>>;
  onFetchServerFileAtCommit?: (sha: string, filePath: string) => Promise<string>;
  currentUser?: string;
  language?: "de" | "en";
  onClose: () => void;
  onRestoreVersion: (restoredContent: string, versionLabel?: string) => void;
}

export interface SessionSnapshotRecord {
  id: string;
  commitHash: string;
  message: string;
  author: string;
  date: string;
  content: string;
}
