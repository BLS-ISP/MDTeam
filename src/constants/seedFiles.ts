import type { WorkspaceFile } from "../utils/issueEngine";
import { SEED_ARC42_AND_ADRS } from "./seeds/seedArc42AndAdrs";
import { SEED_MANAGEMENT_AND_MEETINGS } from "./seeds/seedManagementAndMeetings";
import { SEED_ISSUES_AND_WIKI } from "./seeds/seedIssuesAndWiki";

export const DEFAULT_CATEGORIES: string[] = [
  "arc42",
  "adrs",
  "issues",
  "sprints",
  "wiki",
  "management",
  "meetings",
];

export const INITIAL_FILES: WorkspaceFile[] = [
  ...SEED_ARC42_AND_ADRS,
  ...SEED_MANAGEMENT_AND_MEETINGS,
  ...SEED_ISSUES_AND_WIKI,
];

export { SEED_ARC42_AND_ADRS, SEED_MANAGEMENT_AND_MEETINGS, SEED_ISSUES_AND_WIKI };
