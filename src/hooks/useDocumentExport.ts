"use client";

import { useState } from "react";
import { exportDocumentToDocx } from "../utils/docxExporter";
import type { WorkspaceFile } from "../utils/issueEngine";
import type { WorkspaceLanguage } from "../constants/translations";

interface UseDocumentExportParams {
  files: WorkspaceFile[];
  activeFile: WorkspaceFile;
  isTauri: boolean;
  tauriRootFolder: string;
  language: WorkspaceLanguage;
}

export function useDocumentExport({
  files,
  activeFile,
  isTauri,
  tauriRootFolder,
  language,
}: UseDocumentExportParams) {
  const [exportScope, setExportScope] = useState<"single" | "book">("single");
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx" | "html">("pdf");
  const [printScope, setPrintScope] = useState<"single" | "book" | null>(null);

  const triggerDownload = async (format: string, scope: "single" | "book" = "single") => {
    let content = "";
    let downloadName = "";

    if (scope === "book") {
      const arc42Files = files
        .filter((f) => f.category === "arc42")
        .sort((a, b) => a.name.localeCompare(b.name));
      let toc = "# Inhaltsverzeichnis\n\n";
      let body = "";

      arc42Files.forEach((f, idx) => {
        const title = f.name.replace(".md", "").replace(/^\d+_/, "").replace(/_/g, " ");
        const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1);
        toc += `${idx + 1}. [${formattedTitle}](#chapter-${idx + 1})\n`;
        body += `\n\n<a name="chapter-${idx + 1}"></a>\n` + f.content;
      });
      content = `# MDTeam arc42 Architekturdokumentation (Gesamtausgabe)\n\n${toc}\n\n${body}`;
      downloadName = `arc42_Architecture_Book.${format}`;
    } else {
      content = activeFile.content;
      downloadName = `${activeFile.name.replace(".md", "")}.${format}`;
    }

    if (format === "docx") {
      const docTitle =
        scope === "book"
          ? language === "en"
            ? "MDTeam arc42 Architecture Manual"
            : "MDTeam arc42 Architekturdokumentation"
          : content.match(/^#\s+(.+)$/m)?.[1]?.trim() || activeFile.name.replace(/\.md$/i, "");
      await exportDocumentToDocx(downloadName, docTitle, content, isTauri);
      setShowExportModal(false);
      return;
    }

    if (format === "pdf") {
      setPrintScope(scope);
      setTimeout(() => {
        const printStyles = document.createElement("style");
        printStyles.id = "print-only-styles";
        printStyles.innerHTML = `
          @media print {
            body > *:not(#print-capture-container) {
              display: none !important;
            }
            #print-capture-container {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              height: auto;
              color: #000000 !important;
              background-color: #ffffff !important;
            }
            pre, code {
              background-color: #f3f4f6 !important;
              color: #1f2937 !important;
              border: 1px solid #d1d5db !important;
            }
            blockquote {
              border-left-color: #d1d5db !important;
              background-color: #f9fafb !important;
            }
          }
        `;
        document.head.appendChild(printStyles);
        window.print();
        setTimeout(() => {
          printStyles.remove();
          setPrintScope(null);
        }, 500);
      }, 200);
      setShowExportModal(false);
      return;
    }

    if (tauriRootFolder) {
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");

        const defaultPath = downloadName;
        const filters =
          format === "html"
            ? [{ name: "HTML Document", extensions: ["html"] }]
            : [{ name: "Markdown Document", extensions: ["md"] }];

        const selectedPath = await save({
          defaultPath,
          filters,
          title: language === "en" ? "Save Exported File" : "Exportierte Datei speichern",
        });

        if (selectedPath) {
          let exportContent = content;
          if (format === "html") {
            const previewEl = document.querySelector(".preview-container");
            const innerHTML = previewEl ? previewEl.innerHTML : "";
            exportContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${downloadName.replace(".html", "")}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }
    pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }
    code { font-family: Consolas, Monaco, monospace; }
    blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 10px; color: #666; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  ${scope === "book" ? `<h1>MDTeam arc42 Architekturdokumentation (Gesamtausgabe)</h1>` : ""}
  ${scope === "single" ? innerHTML : `<div>${innerHTML}</div>`}
</body>
</html>`;
          }

          await writeTextFile(selectedPath, exportContent);
          alert(language === "en" ? "Export successful!" : "Export erfolgreich!");
        }
      } catch (err) {
        console.error("Native export failed:", err);
      }
    } else {
      let exportContent = content;
      if (format === "html") {
        const previewEl = document.querySelector(".preview-container");
        const innerHTML = previewEl ? previewEl.innerHTML : "";
        exportContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Export</title></head><body>${innerHTML}</body></html>`;
      }

      const blob = new Blob([exportContent], {
        type: format === "html" ? "text/html" : "text/markdown",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setShowExportModal(false);
  };

  return {
    exportScope,
    setExportScope,
    showExportModal,
    setShowExportModal,
    exportFormat,
    setExportFormat,
    printScope,
    setPrintScope,
    triggerDownload,
  };
}
