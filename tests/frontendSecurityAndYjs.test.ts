import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  BLOCKED_UNSAFE_URL,
  escapeHtmlEntities,
  sanitizeDrawioEmbedUrl,
  sanitizeMarkdownUrl,
} from "../src/utils/workspace/markdownSecurity";
import {
  formatInlineMarkdownText,
  parseInlineMarkdown,
} from "../src/utils/workspace/markdownInlineAndMermaid";
import { buildYjsRoomName } from "../src/hooks/useYjsCollaboration";

test("escapeHtmlEntities escapes &, <, >, \", and ' without double-escaping", () => {
  const raw = `<div class="x" data-q='y'>A & B</div>`;
  assert.equal(
    escapeHtmlEntities(raw),
    "&lt;div class=&quot;x&quot; data-q=&#39;y&#39;&gt;A &amp; B&lt;/div&gt;"
  );
  assert.equal(escapeHtmlEntities(""), "");
});

test("formatInlineMarkdownText neutralizes Stored XSS payloads while preserving inline Markdown", () => {
  const scriptPayload = "Hello <script>alert(1)</script> **bold** *italic* `code`";
  const renderedScript = formatInlineMarkdownText(scriptPayload);

  assert.equal(renderedScript.includes("<script>"), false);
  assert.equal(renderedScript.includes("</script>"), false);
  assert.match(renderedScript, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(renderedScript, /<strong>bold<\/strong>/);
  assert.match(renderedScript, /<em>italic<\/em>/);
  assert.match(renderedScript, /<code>code<\/code>/);

  const imgOnerrorPayload = `<img src=x onerror=alert(1)> and <svg onload="alert('xss_test_var')"> ~~done~~ ==hi==`;
  const renderedImg = formatInlineMarkdownText(imgOnerrorPayload);

  assert.equal(renderedImg.includes("<img"), false);
  assert.equal(renderedImg.includes("<svg"), false);
  assert.match(renderedImg, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(renderedImg, /&lt;svg onload=&quot;alert\(&#39;/);
  assert.match(renderedImg, /<del>done<\/del>/);
  assert.match(renderedImg, /<mark /);
});

test("sanitizeMarkdownUrl blocks unsafe schemes and SVG/HTML data URIs while allowing safe URLs", () => {
  // Unsafe schemes & obfuscated bypass attempts
  assert.equal(sanitizeMarkdownUrl("javascript:alert(1)"), BLOCKED_UNSAFE_URL);
  assert.equal(sanitizeMarkdownUrl("  \tJaVaScRiPt:alert(1)  "), BLOCKED_UNSAFE_URL);
  assert.equal(sanitizeMarkdownUrl("java\nscript:alert(1)"), BLOCKED_UNSAFE_URL);
  assert.equal(sanitizeMarkdownUrl("java\u0000script:alert(1)"), BLOCKED_UNSAFE_URL);
  assert.equal(sanitizeMarkdownUrl("javascript%3aalert(1)"), BLOCKED_UNSAFE_URL);
  assert.equal(sanitizeMarkdownUrl("vbscript:msgbox(1)"), BLOCKED_UNSAFE_URL);
  assert.equal(sanitizeMarkdownUrl("file:///etc/passwd"), BLOCKED_UNSAFE_URL);

  // Dangerous data: URIs must be blocked even when allowDataImage === true
  const htmlDataUri = "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==";
  const svgDataUri = "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+";
  assert.equal(sanitizeMarkdownUrl(htmlDataUri, false), BLOCKED_UNSAFE_URL);
  assert.equal(sanitizeMarkdownUrl(htmlDataUri, true), BLOCKED_UNSAFE_URL);
  assert.equal(sanitizeMarkdownUrl(svgDataUri, false), BLOCKED_UNSAFE_URL);
  assert.equal(sanitizeMarkdownUrl(svgDataUri, true), BLOCKED_UNSAFE_URL);

  // Safe external, relative API, and anchor links
  assert.equal(
    sanitizeMarkdownUrl("https://docs.nethserver.org/projects/ns8/"),
    "https://docs.nethserver.org/projects/ns8/"
  );
  assert.equal(
    sanitizeMarkdownUrl("/api/projects/default/assets/arch.png"),
    "/api/projects/default/assets/arch.png"
  );
  assert.equal(sanitizeMarkdownUrl("#heading-overview"), "#heading-overview");

  // Raster base64 data:image/* allowed ONLY when allowDataImage === true
  const pngDataUri =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  assert.equal(sanitizeMarkdownUrl(pngDataUri, false), BLOCKED_UNSAFE_URL);
  assert.equal(sanitizeMarkdownUrl(pngDataUri, true), pngDataUri);
});

test("sanitizeDrawioEmbedUrl enforces strict HTTPS Draw.io / diagrams.net host allowlist", () => {
  assert.equal(sanitizeDrawioEmbedUrl("https://evil.com/?diagrams.net"), null);
  assert.equal(sanitizeDrawioEmbedUrl("https://diagrams.net.evil.com/embed"), null);
  assert.equal(sanitizeDrawioEmbedUrl("https://diagrams.net@evil.com/embed"), null);
  assert.equal(sanitizeDrawioEmbedUrl("http://viewer.diagrams.net/?highlight=0000ff"), null);
  assert.equal(sanitizeDrawioEmbedUrl("javascript:alert(1)//viewer.diagrams.net"), null);

  assert.equal(
    sanitizeDrawioEmbedUrl("https://viewer.diagrams.net/?highlight=0000ff&nav=1"),
    "https://viewer.diagrams.net/?highlight=0000ff&nav=1"
  );
  assert.equal(
    sanitizeDrawioEmbedUrl("https://app.diagrams.net/?lightbox=1"),
    "https://app.diagrams.net/?lightbox=1"
  );
  assert.equal(
    sanitizeDrawioEmbedUrl("https://www.draw.io/?lightbox=1"),
    "https://www.draw.io/?lightbox=1"
  );
});

test("parseInlineMarkdown sandboxes valid Draw.io iframes, blocks unsafe links/images, and preserves file:/// routing", () => {
  let openedTarget = "";
  let openedRange: string | undefined;
  const opts = {
    activeFilePath: "README.md",
    onOpenFile: (fp: string, lr?: string) => {
      openedTarget = fp;
      openedRange = lr;
    },
  };

  // Valid Draw.io iframe gets sandbox + referrerPolicy
  const validDrawioNodes = parseInlineMarkdown(
    "![Arch](https://viewer.diagrams.net/?lightbox=1)",
    opts
  );
  assert.equal(validDrawioNodes.length, 1);
  const iframeEl = validDrawioNodes[0] as React.ReactElement<Record<string, unknown>>;
  assert.equal(iframeEl.type, "iframe");
  assert.equal(iframeEl.props.sandbox, "allow-scripts allow-same-origin");
  assert.equal(iframeEl.props.referrerPolicy, "no-referrer");

  // Spoofed Draw.io URL is blocked from rendering an iframe
  const spoofedDrawioNodes = parseInlineMarkdown(
    "![Spoof](https://evil.com/?diagrams.net)",
    opts
  );
  const blockedEl = spoofedDrawioNodes[0] as React.ReactElement<Record<string, unknown>>;
  assert.notEqual(blockedEl.type, "iframe");

  // Malicious javascript: link and SVG data image are neutralized
  const unsafeLinkNodes = parseInlineMarkdown("[Click](javascript:alert(1))", opts);
  const anchorEl = unsafeLinkNodes[0] as React.ReactElement<Record<string, unknown>>;
  assert.equal(anchorEl.type, "a");
  assert.equal(anchorEl.props.href, BLOCKED_UNSAFE_URL);
  assert.equal(anchorEl.props.rel, "noopener noreferrer");

  const unsafeImgNodes = parseInlineMarkdown(
    "![Bad](data:image/svg+xml;base64,PHN2Zy8+)",
    opts
  );
  const imgEl = unsafeImgNodes[0] as React.ReactElement<Record<string, unknown>>;
  assert.equal(imgEl.type, "img");
  assert.equal(imgEl.props.src, BLOCKED_UNSAFE_URL);

  // Internal file:/// workspace navigation never emits raw file: in DOM href
  const internalNodes = parseInlineMarkdown("[Intro](file:///arc42/01_intro.md#L10-20)", opts);
  const internalAnchor = internalNodes[0] as React.ReactElement<Record<string, unknown>>;
  assert.equal(internalAnchor.props.href, "#");
  (internalAnchor.props.onClick as (e: { preventDefault: () => void }) => void)({
    preventDefault: () => undefined,
  });
  assert.equal(openedTarget, "arc42/01_intro.md");
  assert.equal(openedRange, "10-20");
});

test("buildYjsRoomName strictly isolates rooms across projectIds, branches, and paths", () => {
  const roomProjAMain = buildYjsRoomName("project-alpha", "main", "README.md");
  const roomProjBMain = buildYjsRoomName("project-beta", "main", "README.md");
  const roomProjAFeat = buildYjsRoomName("project-alpha", "feat/login", "README.md");
  const roomProjAFeatUnderscore = buildYjsRoomName("project-alpha", "feat_login", "README.md");
  const roomProjAOtherFile = buildYjsRoomName("project-alpha", "main", "docs/README.md");

  assert.match(roomProjAMain, /^mdteam-/);
  assert.notEqual(roomProjAMain, roomProjBMain);
  assert.notEqual(roomProjAMain, roomProjAFeat);
  assert.notEqual(roomProjAFeat, roomProjAFeatUnderscore);
  assert.notEqual(roomProjAMain, roomProjAOtherFile);

  // Hyphen boundary ambiguity check: ("proj-a", "main") vs ("proj", "a-main")
  assert.notEqual(
    buildYjsRoomName("proj-a", "main", "README.md"),
    buildYjsRoomName("proj", "a-main", "README.md")
  );

  // Windows backslash vs POSIX forward slash normalize to identical room
  assert.equal(
    buildYjsRoomName("project-alpha", "main", "arc42\\01_goals.md"),
    buildYjsRoomName("project-alpha", "main", "arc42/01_goals.md")
  );
});
