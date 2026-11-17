import test from "node:test";
import assert from "node:assert/strict";
import type { WorkspaceFile } from "../src/types/workspace";
import {
  buildWikiPageTree,
  createNestedSubpage,
  previewLinkRefactorImpact,
  renameOrMoveWorkspaceFile,
} from "../src/utils/wiki/pageTreeAndRefactor";
import {
  createSupersedingAdr,
  isDocumentWriteProtected,
  startNewDocumentRevision,
} from "../src/utils/wiki/documentProtection";
import {
  parseGenericMarkdown,
  serializeGenericMarkdown,
} from "../src/components/editor/visual-editors/genericBlockParser";
import {
  hasConflictMarkers,
  parseGitConflictMarkers,
  resolveAllConflictHunks,
  resolveSingleConflictHunk,
} from "../src/utils/gitConflictParser";

test("Arbitrary-depth Wiki page tree & workspace-wide link/transclusion refactoring", () => {
  const files: WorkspaceFile[] = [
    {
      path: "wiki/architecture.md",
      name: "architecture.md",
      category: "wiki",
      content: "# System Architecture\n\nOverview page.\n",
    },
    createNestedSubpage("wiki/architecture.md", "OAuth2 PKCE Flow", "en"),
    {
      path: "arc42/05_building_block_view.md",
      name: "05_building_block_view.md",
      category: "arc42",
      content: [
        "# 5. Building Block View",
        "",
        "See [OAuth Spec](wiki/architecture/oauth2-pkce-flow.md#tokens) for details.",
        "Embedded snippet:",
        "@[wiki/architecture/oauth2-pkce-flow.md#L1-L8]",
      ].join("\n"),
    },
  ];

  const tree = buildWikiPageTree(files, ["arc42", "wiki"]);
  const wikiRoot = tree.find((n) => n.path === "wiki");
  assert.ok(wikiRoot);
  const archNode = wikiRoot.children.find((n) => n.path === "wiki/architecture.md");
  assert.ok(archNode, "Parent page should exist in wiki root");
  assert.equal(archNode.children.length, 1, "Subpage should nest under parent page");
  assert.equal(archNode.children[0].path, "wiki/architecture/oauth2-pkce-flow.md");

  const impact = previewLinkRefactorImpact(files, "wiki/architecture/oauth2-pkce-flow.md");
  assert.ok(impact.totalLinks >= 2);
  assert.deepEqual(impact.affectedFilePaths, ["arc42/05_building_block_view.md"]);

  const { updatedFiles, rewrittenLinkCount } = renameOrMoveWorkspaceFile(
    files,
    "wiki/architecture/oauth2-pkce-flow.md",
    "wiki/security/oidc-pkce.md"
  );
  assert.ok(rewrittenLinkCount >= 2);

  const movedPage = updatedFiles.find((f) => f.path === "wiki/security/oidc-pkce.md");
  assert.ok(movedPage);
  assert.equal(movedPage.category, "wiki/security");

  const updatedArc42 = updatedFiles.find((f) => f.path === "arc42/05_building_block_view.md")!;
  assert.match(updatedArc42.content, /\[OAuth Spec\]\(wiki\/security\/oidc-pkce\.md#tokens\)/);
  assert.match(updatedArc42.content, /@\[wiki\/security\/oidc-pkce\.md#L1-L8\]/);
});

test("Approved Confluence page & Accepted ADR write-protection, revision bump & supersede", () => {
  const approvedWiki: WorkspaceFile = {
    path: "wiki/security-baseline.md",
    name: "security-baseline.md",
    category: "wiki",
    content: [
      "---",
      'title: "Security Baseline"',
      'review_status: "approved"',
      'approved_by: "@product-owner"',
      'revision: "2"',
      "---",
      "",
      "# Security Baseline",
      "Mandatory TLS 1.3 and OIDC PKCE.",
    ].join("\n"),
  };

  const lockWiki = isDocumentWriteProtected(approvedWiki);
  assert.equal(lockWiki.locked, true);
  assert.equal(lockWiki.reason, "approved-page");
  assert.equal(lockWiki.approvedBy, "@product-owner");

  const nextRev = startNewDocumentRevision(approvedWiki, "@developer-a");
  assert.equal(isDocumentWriteProtected(nextRev).locked, false);
  assert.match(nextRev.content, /review_status:\s*"?in-review"?/);
  assert.match(nextRev.content, /revision:\s*"?3"?/);
  assert.match(nextRev.content, /last_revision_by:\s*"?@developer-a"?/);

  const acceptedAdr: WorkspaceFile = {
    path: "adrs/ADR-0001-session-tokens.md",
    name: "ADR-0001-session-tokens.md",
    category: "adrs",
    content: [
      "# ADR-0001: Session Tokens",
      "",
      "## Status",
      "Accepted",
      "",
      "## Decision",
      "Use HMAC-SHA256 cookies.",
    ].join("\n"),
  };

  const lockAdr = isDocumentWriteProtected(acceptedAdr);
  assert.equal(lockAdr.locked, true);
  assert.equal(lockAdr.reason, "accepted-adr");

  const { newAdr, updatedOldAdr } = createSupersedingAdr(
    acceptedAdr,
    [approvedWiki, acceptedAdr],
    "@architect",
    "en"
  );
  assert.equal(newAdr.path, "adrs/ADR-0002-session-tokens.md");
  assert.equal(isDocumentWriteProtected(newAdr).locked, false);
  assert.match(newAdr.content, /supersedes:\s*"ADR-0001"/);
  assert.equal(isDocumentWriteProtected(updatedOldAdr).locked, false);
  assert.match(updatedOldAdr.content, /Superseded by ADR-0002/);
});

test("WYSIWYG Visual Table & Confluence Callout lossless Markdown round-trip", () => {
  const sampleMd = [
    "---",
    'title: "Architecture Spec"',
    "---",
    "",
    "# Overview",
    "",
    "> [!WARNING] Breaking API Notice",
    "> Clients must include the `HttpOnly` session cookie.",
    "",
    "| Service | Port | Auth |",
    "| :--- | :---: | ---: |",
    "| Web | 3000 | OIDC |",
    "| API | 4000 | JWT |",
  ].join("\n");

  const { frontmatterPrefix, blocks } = parseGenericMarkdown(sampleMd);
  assert.ok(blocks.some((b) => b.type === "callout" && b.calloutType === "warning"));
  assert.ok(blocks.some((b) => b.type === "table" && b.tableRows?.length === 2));

  const roundTripped = serializeGenericMarkdown(frontmatterPrefix, blocks);
  assert.match(roundTripped, /> \[!WARNING\] Breaking API Notice/);
  assert.match(roundTripped, /\| Web \| 3000 \| OIDC \|/);
});

test("Git conflict parser & hunk resolver (standard + diff3 + Setext preservation)", () => {
  const cleanSetext = "Heading Title\n=======\n\nNormal paragraph without conflict markers.\n";
  assert.equal(hasConflictMarkers(cleanSetext), false);

  const conflictedDoc = [
    "# Sprint Goal",
    "<<<<<<< HEAD",
    "Deliver OIDC SSO and Teams webhooks.",
    "||||||| base",
    "Deliver basic login.",
    "=======",
    "Deliver OIDC SSO and Slack Block Kit.",
    ">>>>>>> feat/slack-webhooks",
    "",
    "<<<<<<< HEAD",
    "Target: June 14",
    "=======",
    "Target: June 21",
    ">>>>>>> feat/slack-webhooks",
  ].join("\n");

  assert.equal(hasConflictMarkers(conflictedDoc), true);
  const parsed = parseGitConflictMarkers(conflictedDoc);
  assert.equal(parsed.hasConflicts, true);
  assert.equal(parsed.hunks.length, 2);
  assert.equal(parsed.hunks[0].baseContent, "Deliver basic login.");
  assert.equal(parsed.hunks[0].oursContent, "Deliver OIDC SSO and Teams webhooks.");
  assert.equal(parsed.hunks[0].theirsContent, "Deliver OIDC SSO and Slack Block Kit.");

  const firstResolved = resolveSingleConflictHunk(conflictedDoc, 0, "both");
  assert.equal(hasConflictMarkers(firstResolved), true);
  assert.equal(parseGitConflictMarkers(firstResolved).hunks.length, 1);

  const fullyResolved = resolveAllConflictHunks(firstResolved, "theirs");
  assert.equal(hasConflictMarkers(fullyResolved), false);
  assert.match(fullyResolved, /Deliver OIDC SSO and Teams webhooks\./);
  assert.match(fullyResolved, /Deliver OIDC SSO and Slack Block Kit\./);
  assert.match(fullyResolved, /Target: June 21/);
});
