"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { AlertTriangle, Check, FileText, GitMerge, RefreshCw, ShieldAlert, Users, X } from "lucide-react";
import type { WorkspaceFile } from "../../types/workspace";
import {
  hasConflictMarkers,
  parseGitConflictMarkers,
  resolveAllConflictHunks,
  type ConflictResolutionStrategy,
} from "../../utils/gitConflictParser";

export type ConflictSourceKind = "tauri" | "server" | "memory";

export interface ConflictFileItem {
  filePath: string;
  source: ConflictSourceKind;
  base: string;
  ours: string;
  theirs: string;
  workingTree: string;
  hunkCount: number;
}

export interface GitConflictResolverModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: "de" | "en";
  files?: WorkspaceFile[];
  onUpdateFileContent?: (filePath: string, resolvedContent: string) => void | Promise<void>;
  onUpsertFile?: (file: WorkspaceFile) => void | Promise<void>;
  isTauri?: boolean;
  tauriRootFolder?: string | null;
  serverMode?: boolean;
  projectId?: string | null;
  apiBaseUrl?: string;
  authToken?: string | null;
  onConflictResolved?: (filePath: string, resolvedContent: string, remainingCount: number) => void;
  onAllResolved?: () => void;
}

const S = {
  backdrop: {
    position: "fixed" as const, inset: 0, backgroundColor: "rgba(0, 0, 0, 0.76)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, fontFamily: "var(--font-sans)",
  },
  dialog: {
    width: "min(1140px, 95vw)", height: "min(86vh, 840px)", backgroundColor: "var(--bg-sidebar)",
    border: "1px solid var(--border-color)", borderRadius: "12px", boxShadow: "var(--shadow-lg)",
    display: "flex", flexDirection: "column" as const, overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px",
    borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-panel)",
  },
  sidebar: {
    width: "250px", borderRight: "1px solid var(--border-color)", backgroundColor: "var(--bg-panel)",
    padding: "12px", overflowY: "auto" as const, display: "flex", flexDirection: "column" as const, gap: "6px",
  },
  iconBtn: { background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "4px" },
  chipBtn: {
    padding: "2px 7px", borderRadius: "4px", border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-panel)", color: "var(--text-secondary)", fontSize: "11px", cursor: "pointer",
  },
  banner: (col: string, bg: string) => ({
    margin: "10px 16px 0", padding: "8px 12px", borderRadius: "6px", border: `1px solid ${col}`,
    backgroundColor: bg, color: col, fontSize: "12px", display: "flex", alignItems: "center", gap: "8px",
  }),
  quickCard: (borderCol: string, bgCol: string) => ({
    padding: "9px 12px", borderRadius: "8px", border: `1px solid ${borderCol}`, backgroundColor: bgCol,
    color: "var(--text-primary)", fontSize: "12px", fontWeight: 600, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
  }),
};

function buildConflictItem(
  filePath: string, source: ConflictSourceKind, rawText: string, base = "", ours = "", theirs = ""
): ConflictFileItem {
  const parsed = parseGitConflictMarkers(rawText);
  return {
    filePath, source, base: base || parsed.hunks[0]?.baseContent || "",
    ours: ours || parsed.oursFullContent, theirs: theirs || parsed.theirsFullContent,
    workingTree: rawText, hunkCount: Math.max(1, parsed.hunks.length),
  };
}

function buildStrategyText(item: ConflictFileItem, strategy: ConflictResolutionStrategy): string {
  if (item.workingTree && hasConflictMarkers(item.workingTree)) {
    return resolveAllConflictHunks(item.workingTree, strategy);
  }
  if (strategy === "ours") return item.ours || item.workingTree;
  if (strategy === "theirs") return item.theirs || item.workingTree;
  if (item.ours && item.theirs && item.ours !== item.theirs) {
    return `${item.ours.replace(/\s+$/, "")}\n\n${item.theirs.replace(/^\s+/, "")}`;
  }
  return item.ours || item.theirs || item.workingTree;
}

export function GitConflictResolverModal({
  isOpen, onClose, language = "de", files = [], onUpdateFileContent, onUpsertFile,
  isTauri = false, tauriRootFolder = null, serverMode = false, projectId = null,
  apiBaseUrl = "", authToken = null, onConflictResolved, onAllResolved,
}: GitConflictResolverModalProps) {
  const isEn = language === "en";
  const [conflicts, setConflicts] = useState<ConflictFileItem[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [draftSeed, setDraftSeed] = useState<string>("");
  const [draftContent, setDraftContent] = useState<string>("");
  const [seedRev, setSeedRev] = useState<number>(0);
  const [compareSide, setCompareSide] = useState<"theirs" | "base">("theirs");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const diffEditorRef = useRef<any>(null);

  const applyDraftPreset = useCallback((nextText: string) => {
    setDraftSeed(nextText);
    setDraftContent(nextText);
    setSeedRev((r) => r + 1);
  }, []);

  const loadConflicts = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg("");
    const discovered = new Map<string, ConflictFileItem>();
    const memMap = new Map(files.map((f) => [f.path, f]));

    try {
      if (isTauri && tauriRootFolder) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const paths = await invoke<string[]>("git_list_conflicts", { repoPath: tauriRootFolder });
          for (const relPath of paths || []) {
            const ver: any = await invoke("git_get_conflict_versions", { repoPath: tauriRootFolder, filePath: relPath });
            discovered.set(relPath, buildConflictItem(relPath, "tauri", ver?.workingTree || "", ver?.base, ver?.ours, ver?.theirs));
          }
        } catch (err: unknown) {
          setErrorMsg(err instanceof Error ? err.message : String(err));
        }
      }

      const activeProjectId = projectId || (serverMode ? "default" : null);
      if (activeProjectId && (!isTauri || serverMode)) {
        try {
          const headers: Record<string, string> = { Accept: "application/json" };
          if (authToken) headers.Authorization = `Bearer ${authToken}`;
          const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/projects/${encodeURIComponent(activeProjectId)}/git/conflicts`, { credentials: "include", headers });
          if (res.ok) {
            const data: any = await res.json();
            const rawList: any[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : (data?.conflicts ?? data?.files ?? []);
            for (const e of rawList) {
              const p = typeof e === "string" ? e : e?.filePath || e?.path;
              if (!p || discovered.has(p)) continue;
              const obj = typeof e === "object" && e ? e : data?.versions?.[p];
              const raw = (obj && (obj.workingTree ?? obj.working ?? obj.content ?? obj.rawContent)) || memMap.get(p)?.content || "";
              discovered.set(p, buildConflictItem(p, "server", raw, obj?.base || "", obj?.ours ?? obj?.local ?? "", obj?.theirs ?? obj?.remote ?? ""));
            }
          }
        } catch { /* fallback to in-memory conflicts */ }
      }

      for (const file of files) {
        if (!discovered.has(file.path) && hasConflictMarkers(file.content)) {
          discovered.set(file.path, buildConflictItem(file.path, "memory", file.content));
        }
      }

      const list = Array.from(discovered.values());
      setConflicts(list);
      setSelectedPath((prev) => {
        const nextPath = list.some((c) => c.filePath === prev) ? prev : list[0]?.filePath || "";
        const item = list.find((c) => c.filePath === nextPath);
        if (item) applyDraftPreset(buildStrategyText(item, "ours"));
        return nextPath;
      });
    } finally {
      setIsLoading(false);
    }
  }, [files, isTauri, tauriRootFolder, serverMode, projectId, apiBaseUrl, authToken, applyDraftPreset]);

  useEffect(() => {
    if (isOpen) { setStatusMsg(""); setErrorMsg(""); loadConflicts(); }
  }, [isOpen, loadConflicts]);

  const activeConflict = conflicts.find((c) => c.filePath === selectedPath) || conflicts[0] || null;
  const draftHasMarkers = hasConflictMarkers(draftContent);

  const persistResolution = async (
    item: ConflictFileItem, resolvedText: string, strategyHint: ConflictResolutionStrategy | "manual"
  ) => {
    if (hasConflictMarkers(resolvedText)) {
      setErrorMsg(isEn
        ? "Cannot save: document still contains unresolved <<<<<<< conflict markers."
        : "Speichern blockiert: Das Dokument enthält noch ungelöste <<<<<<< Konflikt-Marker.");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");
    try {
      if (item.source === "tauri" && tauriRootFolder) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("git_resolve_conflict_file", { repoPath: tauriRootFolder, filePath: item.filePath, resolvedContent: resolvedText });
      } else if (item.source === "server") {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authToken) headers.Authorization = `Bearer ${authToken}`;
        const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/projects/${encodeURIComponent(projectId || "default")}/git/resolve`, {
          method: "POST", credentials: "include", headers,
          body: JSON.stringify({ path: item.filePath, filePath: item.filePath, content: resolvedText, resolvedContent: resolvedText, strategy: strategyHint }),
        });
        if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
      }

      await onUpdateFileContent?.(item.filePath, resolvedText);
      if (onUpsertFile) {
        const existing = files.find((f) => f.path === item.filePath);
        const parts = item.filePath.split("/");
        await onUpsertFile({
          path: item.filePath,
          name: existing?.name || parts[parts.length - 1] || item.filePath,
          category: existing?.category || (parts.length > 1 ? parts.slice(0, -1).join("/") : "wiki"),
          content: resolvedText,
        });
      }

      const remaining = conflicts.filter((c) => c.filePath !== item.filePath);
      setConflicts(remaining);
      setStatusMsg(isEn ? `Resolved '${item.filePath}' cleanly.` : `'${item.filePath}' wurde als gelöst gespeichert.`);
      onConflictResolved?.(item.filePath, resolvedText, remaining.length);
      if (remaining.length > 0) {
        setSelectedPath(remaining[0].filePath);
        applyDraftPreset(buildStrategyText(remaining[0], "ours"));
      } else {
        setSelectedPath("");
        onAllResolved?.();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;
  const leftText = activeConflict ? (compareSide === "base" && activeConflict.base ? activeConflict.base : activeConflict.theirs) : "";

  return (
    <div onClick={onClose} style={S.backdrop}>
      <div onClick={(e) => e.stopPropagation()} style={S.dialog}>
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <GitMerge size={20} style={{ color: "var(--accent-indigo)" }} />
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                {isEn ? "Guided Conflict Resolution Assistant" : "Geführter Assistent zur Konfliktlösung"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {isEn
                  ? "No changes are lost — choose a 1-click resolution or review side-by-side before saving."
                  : "Keine Arbeit geht verloren — lösen Sie Konflikte mit 1 Klick oder prüfen Sie beide Versionen im Vergleich."}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "999px",
              backgroundColor: conflicts.length === 0 ? "rgba(16, 185, 129, 0.16)" : "rgba(245, 158, 11, 0.16)",
              color: conflicts.length === 0 ? "var(--accent-green)" : "var(--accent-yellow)",
            }}>
              {conflicts.length === 0 ? (isEn ? "0 Open Conflicts" : "0 offene Konflikte") : (isEn ? `${conflicts.length} Open` : `${conflicts.length} offen`)}
            </span>
            <button type="button" onClick={loadConflicts} title={isEn ? "Refresh" : "Neu prüfen"} style={S.iconBtn}><RefreshCw size={16} /></button>
            <button type="button" onClick={onClose} style={S.iconBtn}><X size={18} /></button>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div style={S.sidebar}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>
              {isEn ? "Affected Documents" : "Betroffene Dokumente"}
            </div>
            {conflicts.map((c) => {
              const selected = activeConflict?.filePath === c.filePath;
              return (
                <button
                  key={c.filePath} type="button"
                  onClick={() => { setSelectedPath(c.filePath); setErrorMsg(""); setStatusMsg(""); applyDraftPreset(buildStrategyText(c, "ours")); }}
                  style={{
                    textAlign: "left", padding: "9px 10px", borderRadius: "8px", cursor: "pointer", color: "var(--text-primary)",
                    border: `1px solid ${selected ? "var(--accent-indigo)" : "var(--border-color)"}`,
                    backgroundColor: selected ? "rgba(99, 102, 241, 0.12)" : "var(--bg-sidebar)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}>
                    <FileText size={13} style={{ color: "var(--accent-yellow)", flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.filePath}</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", display: "flex", justifyContent: "space-between" }}>
                    <span>{c.source.toUpperCase()}</span>
                    <span>{isEn ? `${c.hunkCount} section(s)` : `${c.hunkCount} Stelle(n)`}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {errorMsg && <div style={S.banner("var(--accent-red)", "rgba(239, 68, 68, 0.1)")}><ShieldAlert size={15} /> {errorMsg}</div>}
            {statusMsg && <div style={S.banner("var(--accent-green)", "rgba(16, 185, 129, 0.1)")}><Check size={15} /> {statusMsg}</div>}

            {!activeConflict ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", padding: "24px", color: "var(--text-secondary)" }}>
                <Check size={36} style={{ color: "var(--accent-green)" }} />
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {isLoading ? (isEn ? "Scanning for conflicts..." : "Suche nach Konflikten...") : (isEn ? "All conflicts are resolved!" : "Alle Konflikte sind gelöst!")}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  {isEn ? "Every document is clean and free of Git conflict markers." : "Alle Dokumente sind sauber und ohne Konflikt-Marker."}
                </div>
              </div>
            ) : (
              <>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                      {isEn ? "1-Click Guided Resolution:" : "1-Klick-Schnelllösung für dieses Dokument:"}
                    </span>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "11px", color: "var(--text-muted)" }}>
                      <span>{isEn ? "Load into editor:" : "Im Editor vorblenden:"}</span>
                      {(["ours", "theirs", "both"] as ConflictResolutionStrategy[]).map((st) => (
                        <button key={st} type="button" onClick={() => applyDraftPreset(buildStrategyText(activeConflict, st))} style={S.chipBtn}>
                          {st === "ours" ? "Ours" : st === "theirs" ? "Theirs" : isEn ? "Both" : "Beide"}
                        </button>
                      ))}
                      {activeConflict.workingTree && (
                        <button type="button" onClick={() => applyDraftPreset(activeConflict.workingTree)} style={S.chipBtn}>{isEn ? "Raw" : "Rohdatei"}</button>
                      )}
                      {activeConflict.base && (
                        <button type="button" onClick={() => setCompareSide((s) => (s === "theirs" ? "base" : "theirs"))} style={{ ...S.chipBtn, color: "var(--accent-blue)" }}>
                          {compareSide === "theirs" ? (isEn ? "Left: Team" : "Links: Team") : (isEn ? "Left: Base" : "Links: Basis")}
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                    <button type="button" disabled={isSaving} onClick={() => persistResolution(activeConflict, buildStrategyText(activeConflict, "ours"), "ours")} style={S.quickCard("var(--accent-indigo)", "rgba(99, 102, 241, 0.14)")}>
                      {isEn ? "Keep My Changes (Ours)" : "Meine Änderungen behalten (Ours)"}
                    </button>
                    <button type="button" disabled={isSaving} onClick={() => persistResolution(activeConflict, buildStrategyText(activeConflict, "theirs"), "theirs")} style={S.quickCard("var(--accent-blue)", "rgba(59, 130, 246, 0.14)")}>
                      <Users size={14} /> {isEn ? "Accept Team Version (Theirs)" : "Team-Version übernehmen (Theirs)"}
                    </button>
                    <button type="button" disabled={isSaving} onClick={() => persistResolution(activeConflict, buildStrategyText(activeConflict, "both"), "both")} style={S.quickCard("var(--accent-green)", "rgba(16, 185, 129, 0.14)")}>
                      {isEn ? "Combine Both Sections" : "Beide Abschnitte kombinieren"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "5px 16px", backgroundColor: "var(--bg-panel)", borderBottom: "1px solid var(--border-color)", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>
                  <div>{compareSide === "base" ? (isEn ? "Common Ancestor (Base — Read-Only)" : "Gemeinsame Basis (Schreibgeschützt)") : (isEn ? "Team Version (Theirs — Read-Only)" : "Team-Version (Theirs — Schreibgeschützt)")}</div>
                  <div style={{ paddingLeft: "12px", color: "var(--text-primary)" }}>{isEn ? "Resolved Result (Editable)" : "Gelöstes Ergebnis (Direkt bearbeitbar)"}</div>
                </div>

                <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                  <DiffEditor
                    key={`${activeConflict.filePath}:${seedRev}:${compareSide}`}
                    original={leftText}
                    modified={draftSeed}
                    language="markdown"
                    theme="vs-dark"
                    onMount={(editor) => {
                      diffEditorRef.current = editor;
                      const modEditor = editor.getModifiedEditor();
                      modEditor.onDidChangeModelContent(() => setDraftContent(modEditor.getValue()));
                    }}
                    options={{
                      readOnly: false, originalEditable: false, renderSideBySide: true,
                      minimap: { enabled: false }, fontSize: 13, fontFamily: "var(--font-mono)",
                      automaticLayout: true, wordWrap: "on",
                    }}
                  />
                </div>

                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-panel)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: draftHasMarkers ? "var(--accent-red)" : "var(--accent-green)" }}>
                    {draftHasMarkers ? (
                      <><AlertTriangle size={15} /> {isEn ? "Still contains <<<<<<< conflict markers — remove them before saving." : "Enthält noch <<<<<<< Konflikt-Marker — bitte vor dem Speichern bereinigen."}</>
                    ) : (
                      <><Check size={15} /> {isEn ? "Clean Markdown — 0 conflict markers remaining." : "Bereit — 0 Konflikt-Marker übrig."}</>
                    )}
                  </div>
                  <button
                    type="button" disabled={isSaving || draftHasMarkers}
                    onClick={() => persistResolution(activeConflict, diffEditorRef.current?.getModifiedEditor()?.getValue() ?? draftContent, "manual")}
                    style={{
                      padding: "8px 16px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 700,
                      backgroundColor: draftHasMarkers ? "var(--bg-active)" : "var(--accent-green)",
                      color: draftHasMarkers ? "var(--text-muted)" : "#ffffff",
                      cursor: draftHasMarkers || isSaving ? "not-allowed" : "pointer",
                    }}
                  >
                    {isEn ? "Save Conflict as Resolved" : "Konflikt als gelöst speichern"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GitConflictResolverModal;
