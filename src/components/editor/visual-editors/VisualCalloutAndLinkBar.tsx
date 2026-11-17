"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bold,
  Code,
  FileText,
  Flame,
  Highlighter,
  Info,
  Italic,
  Lightbulb,
  Quote,
  Sparkles,
  Strikethrough,
  Ticket,
} from "lucide-react";
import { extractFrontmatter } from "../../../utils/query/queryFrontmatterExtractor";
import type { WorkspaceFile } from "../../wiki/wikiTypes";
import type { CalloutVariant } from "./genericBlockParser";

const CALLOUT_THEMES: Record<
  CalloutVariant,
  { labelEn: string; labelDe: string; color: string; border: string; bg: string; Icon: React.ComponentType<{ size?: number }> }
> = {
  note: { labelEn: "Note (Info)", labelDe: "Hinweis (Note)", color: "var(--accent-blue)", border: "rgba(59, 130, 246, 0.45)", bg: "rgba(59, 130, 246, 0.09)", Icon: Info },
  tip: { labelEn: "Tip / Best Practice", labelDe: "Tipp / Best Practice", color: "var(--accent-green)", border: "rgba(16, 185, 129, 0.45)", bg: "rgba(16, 185, 129, 0.09)", Icon: Lightbulb },
  important: { labelEn: "Important", labelDe: "Wichtig (Important)", color: "var(--accent-indigo)", border: "rgba(99, 102, 241, 0.48)", bg: "rgba(99, 102, 241, 0.1)", Icon: Sparkles },
  warning: { labelEn: "Warning", labelDe: "Warnung (Warning)", color: "var(--accent-yellow)", border: "rgba(245, 158, 11, 0.48)", bg: "rgba(245, 158, 11, 0.09)", Icon: AlertTriangle },
  caution: { labelEn: "Caution / Danger", labelDe: "Gefahr (Caution)", color: "var(--accent-red)", border: "rgba(239, 68, 68, 0.48)", bg: "rgba(239, 68, 68, 0.09)", Icon: Flame },
  quote: { labelEn: "Blockquote", labelDe: "Zitat (Blockquote)", color: "var(--text-secondary)", border: "var(--border-color)", bg: "rgba(255, 255, 255, 0.02)", Icon: Quote },
};

export interface VisualCalloutCardProps {
  variant: CalloutVariant;
  title?: string;
  content: string;
  disabled?: boolean;
  language: "de" | "en";
  onTrackFocus?: (kind: "calloutTitle" | "content", el: HTMLInputElement | HTMLTextAreaElement) => void;
  onChange: (next: { calloutType: CalloutVariant; calloutTitle?: string; content: string }) => void;
}

export function VisualCalloutCard({
  variant,
  title,
  content,
  disabled = false,
  language,
  onTrackFocus,
  onChange,
}: VisualCalloutCardProps) {
  const isEn = language === "en";
  const theme = CALLOUT_THEMES[variant] || CALLOUT_THEMES.note;
  const IconComp = theme.Icon;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "12px",
        borderRadius: "8px",
        backgroundColor: theme.bg,
        border: `1px solid ${theme.border}`,
        borderLeft: `4px solid ${theme.color}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: theme.color, fontWeight: 700, fontSize: "11px" }}>
          <IconComp size={14} />
          <span>{isEn ? "CONFLUENCE CALLOUT PANEL" : "CONFLUENCE HINWEIS-BOX"}</span>
        </div>

        <select
          disabled={disabled}
          value={variant}
          onChange={(e) => onChange({ calloutType: e.target.value as CalloutVariant, calloutTitle: title, content })}
          style={{
            padding: "3px 8px",
            borderRadius: "6px",
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            color: theme.color,
            fontSize: "11.5px",
            fontWeight: 600,
            outline: "none",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {(Object.keys(CALLOUT_THEMES) as CalloutVariant[]).map((key) => (
            <option key={key} value={key}>
              {isEn ? CALLOUT_THEMES[key].labelEn : CALLOUT_THEMES[key].labelDe}
            </option>
          ))}
        </select>
      </div>

      {variant !== "quote" && (
        <input
          type="text"
          disabled={disabled}
          value={title || ""}
          onChange={(e) => onChange({ calloutType: variant, calloutTitle: e.target.value || undefined, content })}
          onFocus={(e) => onTrackFocus?.("calloutTitle", e.currentTarget)}
          onSelect={(e) => onTrackFocus?.("calloutTitle", e.currentTarget)}
          placeholder={isEn ? "Optional callout headline..." : "Optionale Callout-Überschrift..."}
          style={{
            width: "100%",
            padding: "5px 8px",
            borderRadius: "5px",
            backgroundColor: "var(--bg-editor)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
            fontSize: "12.5px",
            fontWeight: 600,
            outline: "none",
          }}
        />
      )}

      <textarea
        disabled={disabled}
        value={content}
        onChange={(e) => onChange({ calloutType: variant, calloutTitle: title, content: e.target.value })}
        onFocus={(e) => onTrackFocus?.("content", e.currentTarget)}
        onSelect={(e) => onTrackFocus?.("content", e.currentTarget)}
        placeholder={isEn ? "Enter callout message..." : "Hinweistext eingeben..."}
        style={{
          width: "100%",
          minHeight: "66px",
          padding: "8px 10px",
          borderRadius: "6px",
          backgroundColor: "var(--bg-editor)",
          border: "1px solid var(--border-color)",
          color: "var(--text-primary)",
          fontSize: "13px",
          lineHeight: 1.5,
          resize: "vertical",
          outline: "none",
          fontFamily: "var(--font-sans)",
        }}
      />
    </div>
  );
}

export interface VisualCalloutAndLinkBarProps {
  files: WorkspaceFile[];
  disabled?: boolean;
  language: "de" | "en";
  onWrapInlineFormat: (prefix: string, suffix: string, fallbackText: string) => void;
  onInsertSnippet: (markdownSnippet: string) => void;
}

const FORMAT_SPECS = [
  { id: "bold", prefix: "**", suffix: "**", en: "bold text", de: "fett", titleEn: "Bold (**text**)", titleDe: "Fett (**Text**)", Icon: Bold },
  { id: "italic", prefix: "*", suffix: "*", en: "italic", de: "kursiv", titleEn: "Italic (*text*)", titleDe: "Kursiv (*Text*)", Icon: Italic },
  { id: "strike", prefix: "~~", suffix: "~~", en: "strikethrough", de: "durchgestrichen", titleEn: "Strikethrough", titleDe: "Durchgestrichen", Icon: Strikethrough },
  { id: "code", prefix: "`", suffix: "`", en: "code", de: "code", titleEn: "Inline Code (`code`)", titleDe: "Inline-Code (`code`)", Icon: Code },
  { id: "mark", prefix: "==", suffix: "==", en: "highlighted", de: "markiert", titleEn: "Highlight (==text==)", titleDe: "Markierung (==Text==)", Icon: Highlighter },
];

const POPOVER_ITEM_STYLE: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderRadius: "5px",
  border: "none",
  backgroundColor: "transparent",
  color: "var(--text-primary)",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

export function VisualCalloutAndLinkBar({
  files,
  disabled = false,
  language,
  onWrapInlineFormat,
  onInsertSnippet,
}: VisualCalloutAndLinkBarProps) {
  const isEn = language === "en";
  const [openMenu, setOpenMenu] = useState<"page" | "ticket" | null>(null);
  const [query, setQuery] = useState("");

  const { pageItems, ticketItems } = useMemo(() => {
    const pages: { path: string; label: string }[] = [];
    const tickets: { path: string; id: string; title: string; status: string }[] = [];

    for (const f of files) {
      const clean = f.path.replace(/\\/g, "/");
      if (clean.startsWith(".") || !clean.toLowerCase().endsWith(".md")) continue;
      const { frontmatter } = extractFrontmatter(f.content);
      if (clean.startsWith("issues/")) {
        const id = (typeof frontmatter.id === "string" && frontmatter.id) || f.name.replace(/\.md$/i, "");
        const title = (typeof frontmatter.title === "string" && frontmatter.title) || id;
        const status = (typeof frontmatter.status === "string" && frontmatter.status) || "backlog";
        tickets.push({ path: clean, id, title, status });
      } else {
        const h1 = f.content.match(/^#\s+(.+)$/m);
        const label = (typeof frontmatter.title === "string" && frontmatter.title) || (h1 ? h1[1].trim() : f.name.replace(/\.md$/i, ""));
        pages.push({ path: clean, label });
      }
    }
    return { pageItems: pages, ticketItems: tickets };
  }, [files]);

  const qLower = query.trim().toLowerCase();
  const filteredPages = pageItems.filter((p) => !qLower || p.label.toLowerCase().includes(qLower) || p.path.toLowerCase().includes(qLower));
  const filteredTickets = ticketItems.filter((t) => !qLower || t.id.toLowerCase().includes(qLower) || t.title.toLowerCase().includes(qLower));

  const btnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 8px",
    borderRadius: "5px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-sidebar)",
    color: "var(--text-secondary)",
    fontSize: "11.5px",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "8px",
        backgroundColor: "var(--bg-panel)",
        border: "1px solid var(--border-color)",
        position: "sticky",
        top: 0,
        zIndex: 15,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
        {FORMAT_SPECS.map(({ id, prefix, suffix, en, de, titleEn, titleDe, Icon }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onWrapInlineFormat(prefix, suffix, isEn ? en : de)}
            style={btnStyle}
            title={isEn ? titleEn : titleDe}
          >
            <Icon size={13} />
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "6px", position: "relative" }}>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery("");
            setOpenMenu((prev) => (prev === "page" ? null : "page"));
          }}
          style={{ ...btnStyle, borderColor: openMenu === "page" ? "var(--accent-indigo)" : "var(--border-color)", color: "#c7d2fe" }}
        >
          <FileText size={12} />
          <span>{isEn ? "@Page Link" : "@Seiten-Link"}</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery("");
            setOpenMenu((prev) => (prev === "ticket" ? null : "ticket"));
          }}
          style={{ ...btnStyle, borderColor: openMenu === "ticket" ? "var(--accent-green)" : "var(--border-color)", color: "var(--accent-green)" }}
        >
          <Ticket size={12} />
          <span>{isEn ? "@Ticket Link" : "@Ticket-Link"}</span>
        </button>

        {openMenu && !disabled && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              width: "310px",
              maxHeight: "260px",
              backgroundColor: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              boxShadow: "var(--shadow-lg)",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              zIndex: 70,
            }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                openMenu === "page"
                  ? isEn ? "Search Wiki / arc42 / ADR pages..." : "Wiki-, arc42- oder ADR-Seite suchen..."
                  : isEn ? "Search Jira / Scrum issue (e.g. MDT-101)..." : "Jira-/Scrum-Ticket suchen (z.B. MDT-101)..."
              }
              className="settings-input"
              style={{ padding: "5px 8px", fontSize: "12px" }}
              autoFocus
            />

            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "3px" }}>
              {openMenu === "page"
                ? filteredPages.map((p) => (
                    <button
                      key={p.path}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onInsertSnippet(`[${p.label}](${p.path})`);
                        setOpenMenu(null);
                      }}
                      style={POPOVER_ITEM_STYLE}
                    >
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>{p.label}</span>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{p.path}</span>
                    </button>
                  ))
                : filteredTickets.map((tItem) => (
                    <button
                      key={tItem.path}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onInsertSnippet(`[${tItem.id}: ${tItem.title}](${tItem.path})`);
                        setOpenMenu(null);
                      }}
                      style={POPOVER_ITEM_STYLE}
                    >
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>
                        <strong style={{ color: "var(--accent-green)" }}>{tItem.id}</strong> — {tItem.title}
                      </span>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Status: {tItem.status}</span>
                    </button>
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
