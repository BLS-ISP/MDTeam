"use client";

import React from "react";
import { Download, FileDown, FileText, X } from "lucide-react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";

export function WorkspaceQuickDialogs() {
  const {
    language,
    t,
    activeFile,
    categories,
    generatedMeetingText,
    setGeneratedMeetingText,
    saveGeneratedMeeting,
    showExportModal,
    setShowExportModal,
    exportFormat,
    setExportFormat,
    exportScope,
    setExportScope,
    triggerDownload,
    showNewFileModal,
    setShowNewFileModal,
    newFileName,
    setNewFileName,
    newFileCategory,
    setNewFileCategory,
    handleCreateFile,
    showNewFolderModal,
    setShowNewFolderModal,
    newFolderName,
    setNewFolderName,
    newFolderParent,
    setNewFolderParent,
    handleCreateFolder,
  } = useWorkspaceContext();

  return (
    <>
      {/* Meeting assistant generated templates display */}
      {generatedMeetingText && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: "600px" }}>
            <div className="modal-header">
              <span>
                {language === "en" ? "Generated Meeting Minutes Template" : "Generierte Besprechungs-Protokoll Vorlage"}
              </span>
              <button className="modal-close" onClick={() => setGeneratedMeetingText("")}>
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                maxHeight: "350px",
                overflowY: "auto",
                padding: "12px",
                backgroundColor: "var(--bg-editor)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                whiteSpace: "pre-wrap",
                color: "var(--text-secondary)",
              }}
            >
              {generatedMeetingText}
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button className="git-btn git-btn-secondary" onClick={() => setGeneratedMeetingText("")}>
                {t.cancel}
              </button>
              <button className="git-btn" onClick={saveGeneratedMeeting}>
                {language === "en" ? "Save Minutes in Workspace" : "Vorlage in Workspace speichern"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal overlay */}
      {showExportModal && activeFile && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>{language === "en" ? "Export Documentation" : "Dokumentation exportieren"}</span>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
              {language === "en"
                ? "Choose formatting and scope for the export:"
                : "Wählen Sie das Format und den Umfang für den Export:"}
            </p>

            <div className="export-options-grid" style={{ marginBottom: "16px" }}>
              <div
                className={`export-option-card ${exportFormat === "pdf" ? "active" : ""}`}
                onClick={() => setExportFormat("pdf")}
              >
                <FileDown size={28} style={{ color: "var(--accent-indigo)" }} />
                <span className="export-option-title">{language === "en" ? "PDF Report" : "PDF Bericht"}</span>
                <span className="export-option-desc">
                  {language === "en"
                    ? "Ideal for PMs, clients, and offline printing."
                    : "Ideal für PMs, Kunden und Offlinedruck."}
                </span>
              </div>

              <div
                className={`export-option-card ${exportFormat === "docx" ? "active" : ""}`}
                onClick={() => setExportFormat("docx")}
              >
                <FileText size={28} style={{ color: "var(--accent-blue)" }} />
                <span className="export-option-title">Word (DOCX)</span>
                <span className="export-option-desc">
                  {language === "en"
                    ? "Ideal for office document post-processing."
                    : "Ideal für Nachbearbeitungen in Office."}
                </span>
              </div>
            </div>

            <div className="settings-group" style={{ marginBottom: "8px" }}>
              <label className="settings-label" style={{ marginBottom: "8px" }}>
                {language === "en" ? "Export Scope" : "Export-Umfang"}
              </label>
              <div style={{ display: "flex", gap: "20px", fontSize: "12px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === "single"}
                    onChange={() => setExportScope("single")}
                    style={{ accentColor: "var(--accent-indigo)" }}
                  />
                  <span>
                    {language === "en" ? "Active Document" : "Aktives Dokument"} ({activeFile.name})
                  </span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === "book"}
                    onChange={() => setExportScope("book")}
                    style={{ accentColor: "var(--accent-indigo)" }}
                  />
                  <span>{language === "en" ? "arc42 Manual (Compiled)" : "arc42 Handbuch (Kompiliert)"}</span>
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button className="git-btn git-btn-secondary" onClick={() => setShowExportModal(false)}>
                {t.cancel}
              </button>
              <button className="git-btn" onClick={() => triggerDownload(exportFormat, exportScope)}>
                <Download size={14} /> {language === "en" ? "Download" : "Herunterladen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: "400px" }}>
            <div className="modal-header">
              <span>{t.createFileTitle}</span>
              <button className="modal-close" onClick={() => setShowNewFileModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="settings-group">
              <label className="settings-label">{t.folderSelectLabel}</label>
              <select
                className="settings-select"
                value={newFileCategory}
                onChange={(e) => setNewFileCategory(e.target.value)}
              >
                {categories
                  .filter((cat) => !cat.startsWith("."))
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>
            </div>

            <div className="settings-group">
              <label className="settings-label">
                {language === "en" ? "File name (e.g. 13_documentation.md)" : "Dateiname (z. B. 13_dokumentation.md)"}
              </label>
              <input
                type="text"
                className="settings-input"
                placeholder="neues_kapitel.md"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFile();
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button className="git-btn git-btn-secondary" onClick={() => setShowNewFileModal(false)}>
                {t.cancel}
              </button>
              <button className="git-btn" onClick={handleCreateFile}>
                {t.create}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: "400px" }}>
            <div className="modal-header">
              <span>{t.createFolderTitle}</span>
              <button className="modal-close" onClick={() => setShowNewFolderModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="settings-group">
              <label className="settings-label">
                {language === "en" ? "Parent folder" : "Übergeordneter Ordner (Parent)"}
              </label>
              <select
                className="settings-select"
                value={newFolderParent}
                onChange={(e) => setNewFolderParent(e.target.value)}
              >
                <option value="none">{language === "en" ? "None (Root folder)" : "Kein (Hauptordner)"}</option>
                {categories
                  .filter((cat) => !cat.startsWith("."))
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>
            </div>

            <div className="settings-group">
              <label className="settings-label">
                {language === "en" ? "Folder name (lowercase)" : "Ordnername (Kleinbuchstaben)"}
              </label>
              <input
                type="text"
                className="settings-input"
                placeholder="z. B. drafts"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button className="git-btn git-btn-secondary" onClick={() => setShowNewFolderModal(false)}>
                {t.cancel}
              </button>
              <button className="git-btn" onClick={handleCreateFolder}>
                {t.create}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
