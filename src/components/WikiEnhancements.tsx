"use client";

export type {
  WorkspaceFile,
  ReviewStatus,
  InlineCommentMessage,
  InlineCommentThread,
  InlineCommentsStore,
  PageGovernanceBarProps,
  InlineCommentsDrawerProps,
  WikiTemplateDefinition,
  TemplateGalleryModalProps,
  PageVersionEntry,
  PageHistoryModalProps,
} from "./wiki/wikiTypes";

export {
  INLINE_COMMENTS_FILE_PATH,
  upsertDocumentFrontmatter,
  parseInlineCommentsStore,
  countOpenInlineComments,
  recordPageSessionSnapshot,
} from "./wiki/wikiStorageUtils";

export { PageGovernanceBar } from "./wiki/PageGovernanceBar";
export { InlineCommentsDrawer } from "./wiki/InlineCommentsDrawer";
export { WIKI_TEMPLATES } from "../constants/wikiTemplates";
export { TemplateGalleryModal } from "./wiki/TemplateGalleryModal";
export { PageHistoryModal } from "./wiki/PageHistoryModal";
export { handlePasteOrDropImage } from "./wiki/imageAssetHandler";
