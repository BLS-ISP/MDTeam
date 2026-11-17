"use client";

import React, { useState } from "react";
import {
  Tag,
  Plus,
  CheckCircle2,
  FileText,
  ExternalLink,
  Edit3,
  Trash2,
  X,
  Calendar,
} from "lucide-react";
import {
  AgileIssue,
  AgileRelease,
  ReleaseState,
  WorkspaceFile,
  computeReleaseProgress,
  generateReleaseNotesMarkdown,
  getIssuesForRelease,
  releaseVersionToSlug,
} from "../../utils/issueEngine";
import { ScrumCopy, renderIssueTypeIcon } from "./scrumI18nAndStyles";

export interface ReleasesTabProps {
  t: ScrumCopy;
  language: "de" | "en";
  files: WorkspaceFile[];
  allIssues: AgileIssue[];
  releases: AgileRelease[];
  onSaveReleases: (nextReleases: AgileRelease[], toastMsg?: string) => void;
  onSaveIssue: (issue: AgileIssue) => void;
  onUpsertFile: (file: WorkspaceFile) => void;
  onOpenFile: (path: string) => void;
  onSelectIssue: (issue: AgileIssue) => void;
  onShowToast?: (msg: string) => void;
}

function stateColors(state: ReleaseState): { bg: string; border: string; fg: string } {
  if (state === "released") return { bg: "rgba(16, 185, 129, 0.16)", border: "rgba(16, 185, 129, 0.4)", fg: "var(--accent-green)" };
  if (state === "unreleased") return { bg: "rgba(99, 102, 241, 0.16)", border: "rgba(99, 102, 241, 0.4)", fg: "var(--accent-indigo)" };
  return { bg: "rgba(245, 158, 11, 0.14)", border: "rgba(245, 158, 11, 0.35)", fg: "var(--accent-yellow)" };
}

export function ReleasesTab({
  t,
  language,
  files,
  allIssues,
  releases,
  onSaveReleases,
  onSaveIssue,
  onUpsertFile,
  onOpenFile,
  onSelectIssue,
  onShowToast,
}: ReleasesTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [versionInput, setVersionInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [dateInput, setDateInput] = useState("2026-07-01");
  const [stateInput, setStateInput] = useState<ReleaseState>("planned");
  const [descInput, setDescInput] = useState("");
  const [selectedAssignIssueByRel, setSelectedAssignIssueByRel] = useState<Record<string, string>>({});

  const openCreateForm = () => {
    setEditingId(null);
    setVersionInput(`v1.${releases.length}.0`);
    setNameInput("");
    setDateInput(new Date().toISOString().slice(0, 10));
    setStateInput("unreleased");
    setDescInput("");
    setFormOpen(true);
  };

  const openEditForm = (rel: AgileRelease) => {
    setEditingId(rel.id);
    setVersionInput(rel.version);
    setNameInput(rel.name);
    setDateInput(rel.targetDate);
    setStateInput(rel.state);
    setDescInput(rel.description);
    setFormOpen(true);
  };

  const handleSubmitForm = () => {
    const cleanVer = versionInput.trim();
    if (!cleanVer) return;
    const slug = releaseVersionToSlug(cleanVer);
    const nextItem: AgileRelease = {
      id: editingId || `rel-${slug}-${Date.now().toString(36)}`,
      version: cleanVer,
      name: nameInput.trim() || `Release ${cleanVer}`,
      targetDate: dateInput || "2026-06-30",
      state: stateInput,
      description: descInput.trim(),
    };

    let nextList: AgileRelease[];
    if (editingId) {
      const prevRel = releases.find((r) => r.id === editingId);
      nextList = releases.map((r) => (r.id === editingId ? nextItem : r));
      if (prevRel && prevRel.version !== cleanVer) {
        allIssues
          .filter((i) => (i.fixVersion || "").toLowerCase() === prevRel.version.toLowerCase())
          .forEach((i) => onSaveIssue({ ...i, fixVersion: cleanVer }));
      }
    } else {
      nextList = [...releases.filter((r) => r.version.toLowerCase() !== cleanVer.toLowerCase()), nextItem];
    }

    onSaveReleases(nextList, t.releaseSavedToast);
    setFormOpen(false);
    setEditingId(null);
  };

  const handleToggleReleaseState = (rel: AgileRelease) => {
    const nextState: ReleaseState = rel.state === "released" ? "unreleased" : "released";
    const nextList = releases.map((r) => (r.id === rel.id ? { ...r, state: nextState } : r));
    onSaveReleases(nextList, t.releaseSavedToast);
  };

  const handleDeleteRelease = (rel: AgileRelease) => {
    const nextList = releases.filter((r) => r.id !== rel.id);
    allIssues
      .filter((i) => (i.fixVersion || "").toLowerCase() === rel.version.toLowerCase())
      .forEach((i) => onSaveIssue({ ...i, fixVersion: undefined }));
    onSaveReleases(nextList, t.releaseSavedToast);
  };

  const handleGenerateReleaseNotes = (rel: AgileRelease) => {
    const notesFile = generateReleaseNotesMarkdown(rel, allIssues, files, language);
    onUpsertFile(notesFile);
    onShowToast?.(`${t.releaseNotesGeneratedToast} (${notesFile.path})`);
  };

  const handleAssignIssue = (rel: AgileRelease) => {
    const issueId = selectedAssignIssueByRel[rel.id];
    if (!issueId) return;
    const found = allIssues.find((i) => i.id === issueId);
    if (!found) return;
    onSaveIssue({ ...found, fixVersion: rel.version });
    setSelectedAssignIssueByRel((prev) => ({ ...prev, [rel.id]: "" }));
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px", display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* Top Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 700 }}>
          <Tag size={17} style={{ color: "var(--accent-green)" }} />
          <span>{t.releasesHeading}</span>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 14px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: "var(--accent-indigo)",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Plus size={14} /> {t.newReleaseBtn}
        </button>
      </div>

      {/* Create / Edit Release Drawer Card */}
      {formOpen && (
        <div style={{ backgroundColor: "var(--bg-sidebar)", border: "1px solid var(--accent-indigo)", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
            <div>
              <label className="settings-label">{t.releaseVersionLabel}</label>
              <input type="text" className="settings-input" style={{ fontFamily: "var(--font-mono)" }} placeholder="v1.2.0" value={versionInput} onChange={(e) => setVersionInput(e.target.value)} />
            </div>
            <div>
              <label className="settings-label">{t.releaseNameLabel}</label>
              <input type="text" className="settings-input" placeholder="Enterprise Release..." value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
            </div>
            <div>
              <label className="settings-label">{t.releaseTargetDateLabel}</label>
              <input type="date" className="settings-input" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
            </div>
            <div>
              <label className="settings-label">{t.releaseStateLabel}</label>
              <select className="settings-select" value={stateInput} onChange={(e) => setStateInput(e.target.value as ReleaseState)}>
                {(["planned", "unreleased", "released"] as ReleaseState[]).map((st) => (
                  <option key={st} value={st}>{t.releaseStates[st]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="settings-label">{t.releaseDescLabel}</label>
            <input type="text" className="settings-input" value={descInput} onChange={(e) => setDescInput(e.target.value)} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button type="button" onClick={() => setFormOpen(false)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-panel)", color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer" }}>
              {t.cancelBtn}
            </button>
            <button type="button" onClick={handleSubmitForm} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", backgroundColor: "var(--accent-indigo)", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              {t.saveReleaseBtn}
            </button>
          </div>
        </div>
      )}

      {/* Release Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {releases.map((rel) => {
          const progress = computeReleaseProgress(rel, allIssues);
          const relIssues = getIssuesForRelease(rel.version, allIssues);
          const candidateIssues = allIssues.filter(
            (i) => !i.isVirtualLegacy && (i.fixVersion || "").toLowerCase() !== rel.version.toLowerCase()
          );
          const colors = stateColors(rel.state);
          const notesPath = `wiki/releases/${releaseVersionToSlug(rel.version)}.md`;
          const notesExist = files.some((f) => f.path.replace(/\\/g, "/") === notesPath);

          return (
            <div key={rel.id} style={{ backgroundColor: "var(--bg-sidebar)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Card Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ padding: "3px 9px", borderRadius: "6px", backgroundColor: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.35)", color: "var(--accent-green)", fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700 }}>
                      {rel.version}
                    </span>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>{rel.name}</span>
                    <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: colors.bg, border: `1px solid ${colors.border}`, color: colors.fg, fontSize: "10px", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                      {t.releaseStates[rel.state]}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      <Calendar size={11} /> {rel.targetDate}
                    </span>
                  </div>
                  {rel.description && (
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{rel.description}</div>
                  )}
                </div>

                {/* Release Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => handleToggleReleaseState(rel)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "6px 11px",
                      borderRadius: "6px",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      backgroundColor: rel.state === "released" ? "var(--bg-panel)" : "rgba(16, 185, 129, 0.14)",
                      color: rel.state === "released" ? "var(--text-secondary)" : "var(--accent-green)",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <CheckCircle2 size={13} />
                    {rel.state === "released" ? t.reopenReleaseBtn : t.markReleasedBtn}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGenerateReleaseNotes(rel)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid rgba(99, 102, 241, 0.45)",
                      backgroundColor: "rgba(99, 102, 241, 0.16)",
                      color: "var(--text-primary)",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <FileText size={13} style={{ color: "var(--accent-indigo)" }} />
                    {t.generateReleaseNotesBtn}
                  </button>

                  {notesExist && (
                    <button
                      type="button"
                      onClick={() => onOpenFile(notesPath)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-panel)",
                        color: "var(--accent-indigo)",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <ExternalLink size={12} /> {t.openReleaseNotesBtn}
                    </button>
                  )}

                  <button type="button" onClick={() => openEditForm(rel)} title={t.editReleaseBtn} style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-panel)", color: "var(--text-secondary)", cursor: "pointer" }}>
                    <Edit3 size={13} />
                  </button>
                  <button type="button" onClick={() => handleDeleteRelease(rel)} title={t.deleteReleaseBtn} style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.08)", color: "var(--accent-red)", cursor: "pointer" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                  <span>{progress.doneIssues} / {progress.totalIssues} Done ({progress.issueProgressPercent}%)</span>
                  <span>{progress.donePoints} / {progress.totalPoints} SP ({progress.pointsProgressPercent}%)</span>
                </div>
                <div style={{ width: "100%", height: "8px", borderRadius: "999px", overflow: "hidden", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)" }}>
                  <div style={{ width: `${progress.pointsProgressPercent}%`, height: "100%", backgroundColor: progress.pointsProgressPercent === 100 ? "var(--accent-green)" : "var(--accent-indigo)", transition: "width 0.2s ease" }} />
                </div>
              </div>

              {/* Assigned Issues List */}
              {relIssues.length === 0 ? (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>{t.noReleaseIssues}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {relIssues.map((iss) => (
                    <div
                      key={iss.id}
                      onClick={() => onSelectIssue(iss)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        backgroundColor: "var(--bg-panel)",
                        border: "1px solid var(--border-color)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        {renderIssueTypeIcon(iss.type, 13)}
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: "var(--accent-indigo)" }}>{iss.id}</span>
                        <span style={{ fontSize: "12.5px", color: iss.status === "done" ? "var(--text-muted)" : "var(--text-primary)", textDecoration: iss.status === "done" ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {iss.title}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: iss.status === "done" ? "var(--accent-green)" : "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>
                          {t.columns[iss.status]}
                        </span>
                        <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", padding: "1px 6px", borderRadius: "999px", backgroundColor: "rgba(99,102,241,0.14)", color: "var(--accent-indigo)", fontWeight: 700 }}>
                          {iss.storyPoints} SP
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSaveIssue({ ...iss, fixVersion: undefined });
                          }}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", padding: "2px" }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Assign Issue to FixVersion */}
              {candidateIssues.length > 0 && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    className="settings-select"
                    style={{ flex: 1, maxWidth: "420px" }}
                    value={selectedAssignIssueByRel[rel.id] || ""}
                    onChange={(e) => setSelectedAssignIssueByRel((prev) => ({ ...prev, [rel.id]: e.target.value }))}
                  >
                    <option value="">{t.assignIssuePlaceholder}</option>
                    {candidateIssues.map((cand) => (
                      <option key={cand.id} value={cand.id}>
                        {cand.id}: {cand.title} ({cand.storyPoints} SP)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleAssignIssue(rel)}
                    style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-panel)", color: "var(--text-primary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    {t.assignIssueBtn}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
