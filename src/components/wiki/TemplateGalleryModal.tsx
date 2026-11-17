"use client";

import React, { useMemo, useState } from "react";
import { FilePlus2, LayoutTemplate, X } from "lucide-react";
import { slugifyFileName, WIKI_TEMPLATES } from "../../constants/wikiTemplates";
import type {
  TemplateGalleryModalProps,
  WikiTemplateDefinition,
} from "./wikiTypes";
import { TemplateGallerySidebar } from "./TemplateGallerySidebar";

/**
 * 3. <TemplateGalleryModal />
 * Confluence-style modal to create new pages from 6 rich knowledge-base templates.
 */
export function TemplateGalleryModal({
  isOpen,
  currentUser = "@developer-a",
  existingFiles = [],
  language = "de",
  onClose,
  onCreateFile,
}: TemplateGalleryModalProps) {
  const isEn = language === "en";
  const [selectedId, setSelectedId] = useState<string>(WIKI_TEMPLATES[0].id);
  const [pageTitle, setPageTitle] = useState<string>("");
  const [targetFolder, setTargetFolder] = useState<string>(
    WIKI_TEMPLATES[0].defaultFolder
  );

  const selectedTemplate = useMemo(
    () =>
      WIKI_TEMPLATES.find((t) => t.id === selectedId) || WIKI_TEMPLATES[0],
    [selectedId]
  );

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const effectiveTitle =
    pageTitle.trim() ||
    (isEn ? selectedTemplate.name : selectedTemplate.nameDe);

  const targetPath = useMemo(() => {
    const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, "") || "wiki";
    const baseSlug = pageTitle.trim()
      ? slugifyFileName(pageTitle)
      : `${selectedTemplate.slugPrefix}-${todayIso}`;
    let candidate = `${cleanFolder}/${baseSlug}.md`;
    let suffix = 2;
    while (existingFiles.some((f) => f.path === candidate)) {
      candidate = `${cleanFolder}/${baseSlug}-${suffix}.md`;
      suffix++;
    }
    return candidate;
  }, [targetFolder, pageTitle, selectedTemplate, todayIso, existingFiles]);

  const previewMarkdown = useMemo(
    () =>
      selectedTemplate.buildContent(
        effectiveTitle,
        currentUser,
        todayIso,
        language
      ),
    [selectedTemplate, effectiveTitle, currentUser, todayIso, language]
  );

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl: WikiTemplateDefinition) => {
    setSelectedId(tpl.id);
    setTargetFolder(tpl.defaultFolder);
  };

  const handleCreate = () => {
    const parts = targetPath.split("/");
    const fileName = parts[parts.length - 1];
    const category = parts[0] || "wiki";
    onCreateFile({
      path: targetPath,
      name: fileName,
      category,
      content: previewMarkdown,
    });
    setPageTitle("");
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "920px",
          maxWidth: "96vw",
          height: "82vh",
          backgroundColor: "var(--bg-editor)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 20px",
            backgroundColor: "var(--bg-panel)",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <LayoutTemplate
              size={18}
              style={{ color: "var(--accent-indigo)" }}
            />
            <div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {isEn
                  ? "Confluence Knowledge Base Templates"
                  : "Wissensdatenbank-Vorlagen (Templates)"}
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                {isEn
                  ? "Choose one of 6 structured engineering & product templates"
                  : "6 strukturierte Vorlagen für Produkt, Architektur & Betrieb"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Split Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <TemplateGallerySidebar
            templates={WIKI_TEMPLATES}
            selectedId={selectedId}
            isEn={isEn}
            onSelectTemplate={handleSelectTemplate}
          />

          {/* Right: Configuration & Live Markdown Preview */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              padding: "16px 20px",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 165px",
                gap: "12px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "5px",
                  }}
                >
                  {isEn ? "Document Title" : "Seitentitel"}
                </label>
                <input
                  type="text"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder={
                    isEn ? selectedTemplate.name : selectedTemplate.nameDe
                  }
                  style={{
                    width: "100%",
                    backgroundColor: "var(--bg-sidebar)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    fontSize: "13px",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "5px",
                  }}
                >
                  {isEn ? "Space / Folder" : "Bereich / Ordner"}
                </label>
                <select
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: "var(--bg-sidebar)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    fontSize: "13px",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                >
                  <option value="wiki">wiki/</option>
                  <option value="arc42">arc42/</option>
                  <option value="adrs">adrs/</option>
                  <option value="management">management/</option>
                  <option value="meetings">meetings/</option>
                </select>
              </div>
            </div>

            <div
              style={{
                fontSize: "11.5px",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {isEn ? "Target path:" : "Zielpfad:"}{" "}
              <span style={{ color: "#a5b4fc" }}>{targetPath}</span>
            </div>

            <div
              style={{
                flex: 1,
                backgroundColor: "var(--bg-sidebar)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "14px",
                overflowY: "auto",
              }}
            >
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  color: "var(--text-secondary)",
                }}
              >
                {previewMarkdown}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            backgroundColor: "var(--bg-panel)",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "transparent",
              color: "var(--text-secondary)",
              fontSize: "12.5px",
              cursor: "pointer",
            }}
          >
            {isEn ? "Cancel" : "Abbrechen"}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--accent-indigo)",
              color: "#ffffff",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <FilePlus2 size={14} />
            {isEn ? "Create Page from Template" : "Seite aus Vorlage erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}
