"use client";

import React, { useState } from "react";
import {
  Target,
  Flag,
  ShieldCheck,
  Sliders,
  Workflow,
  CalendarRange,
  Timer,
  Presentation,
  RotateCcw,
  Pencil,
  Check,
  X,
  Settings2,
} from "lucide-react";
import type { AgileSprint, WorkspaceFile } from "../../../utils/issueEngine";
import type {
  ScrumCeremonyId,
  ScrumPolicyConfig,
  ScrumProcessMode,
  ScrumUserRole,
} from "../../../types/scrumPolicy";
import {
  applyProcessModePreset,
  canManageScrumPolicy,
  isProductOwnerOrAdmin,
  parseScrumPolicy,
  serializeScrumPolicyToMarkdown,
} from "../../../utils/scrum-rules/scrumPolicyEngine";
import { ceremoniesCopy } from "./ceremoniesI18n";

export interface ScrumPolicyAndGoalBarProps {
  policy?: ScrumPolicyConfig;
  files?: WorkspaceFile[];
  activeSprint?: AgileSprint;
  currentUser: string;
  userRole?: ScrumUserRole;
  language: "de" | "en";
  onUpdatePolicy?: (updated: ScrumPolicyConfig) => void;
  onUpsertFile?: (file: WorkspaceFile) => void;
  onLaunchCeremony?: (ceremony: ScrumCeremonyId) => void;
  onOpenPlanning?: () => void;
  onOpenDaily?: () => void;
  onOpenReview?: () => void;
  onOpenRetro?: () => void;
}

const MODE_COLORS: Record<ScrumProcessMode, string> = {
  strict: "var(--accent-green)",
  pragmatic: "var(--accent-indigo)",
  kanban: "var(--accent-blue)",
};

const cardBoxStyle: React.CSSProperties = {
  flex: "1 1 290px",
  backgroundColor: "var(--bg-sidebar)",
  border: "1px solid var(--border-color)",
  borderRadius: "8px",
  padding: "8px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const labelBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
};

const ceremonyBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "5px 10px",
  borderRadius: "6px",
  border: "1px solid var(--border-color)",
  backgroundColor: "var(--bg-sidebar)",
  color: "var(--text-primary)",
  fontSize: "11px",
  fontWeight: 600,
  cursor: "pointer",
};

export function ScrumPolicyAndGoalBar({
  policy: policyProp,
  files,
  activeSprint,
  currentUser,
  userRole,
  language,
  onUpdatePolicy,
  onUpsertFile,
  onLaunchCeremony,
  onOpenPlanning,
  onOpenDaily,
  onOpenReview,
  onOpenRetro,
}: ScrumPolicyAndGoalBarProps) {
  const t = ceremoniesCopy[language] || ceremoniesCopy.de;
  const effectivePolicy = policyProp || parseScrumPolicy(files);
  const roleKey = userRole || currentUser;
  const canEditProductGoal = isProductOwnerOrAdmin(roleKey);
  const canEditPolicy = canManageScrumPolicy(roleKey);

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(effectivePolicy.productGoal);
  const [targetDateDraft, setTargetDateDraft] = useState(effectivePolicy.productGoalTargetDate || "");
  const [showRulesDrawer, setShowRulesDrawer] = useState(false);

  const persistPolicy = (next: ScrumPolicyConfig) => {
    onUpdatePolicy?.(next);
    if (onUpsertFile) onUpsertFile(serializeScrumPolicyToMarkdown(next));
  };

  const handleSaveProductGoal = () => {
    const clean = goalDraft.trim();
    if (!clean) return;
    persistPolicy({
      ...effectivePolicy,
      productGoal: clean,
      productGoalTargetDate: targetDateDraft.trim() || undefined,
    });
    setEditingGoal(false);
  };

  const fireCeremony = (id: ScrumCeremonyId) => {
    onLaunchCeremony?.(id);
    if (id === "planning") onOpenPlanning?.();
    if (id === "daily") onOpenDaily?.();
    if (id === "review") onOpenReview?.();
    if (id === "retro") onOpenRetro?.();
  };

  const renderModeIcon = (m: ScrumProcessMode) => {
    if (m === "strict") return <ShieldCheck size={13} style={{ color: MODE_COLORS.strict }} />;
    if (m === "kanban") return <Workflow size={13} style={{ color: MODE_COLORS.kanban }} />;
    return <Sliders size={13} style={{ color: MODE_COLORS.pragmatic }} />;
  };

  const sprintGoalText = (activeSprint?.goal || "").replace(/^_Define sprint goal\.\.\._$/i, "").trim();

  return (
    <div
      style={{
        backgroundColor: "var(--bg-panel)",
        borderBottom: "1px solid var(--border-color)",
        padding: "10px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Product Goal & Sprint Goal Row */}
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div style={cardBoxStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <span style={{ ...labelBadgeStyle, color: "var(--accent-indigo)" }}>
              <Target size={12} />
              {t.bar.productGoalLabel}
              {effectivePolicy.productGoalTargetDate && (
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 500 }}>
                  ({effectivePolicy.productGoalTargetDate})
                </span>
              )}
            </span>

            {canEditProductGoal && !editingGoal ? (
              <button
                type="button"
                onClick={() => {
                  setGoalDraft(effectivePolicy.productGoal);
                  setTargetDateDraft(effectivePolicy.productGoalTargetDate || "");
                  setEditingGoal(true);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: "11px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Pencil size={11} />
                {t.bar.editGoalBtn}
              </button>
            ) : !canEditProductGoal ? (
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }} title={t.bar.poOnlyHint}>
                PO
              </span>
            ) : null}
          </div>

          {editingGoal ? (
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginTop: "2px" }}>
              <input
                type="text"
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                style={{ flex: "1 1 200px", padding: "4px 8px", borderRadius: "5px", border: "1px solid var(--border-focus)", backgroundColor: "var(--bg-editor)", color: "var(--text-primary)", fontSize: "12px" }}
              />
              <input
                type="date"
                value={targetDateDraft}
                onChange={(e) => setTargetDateDraft(e.target.value)}
                title={t.bar.targetDatePlaceholder}
                style={{ padding: "4px 6px", borderRadius: "5px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-editor)", color: "var(--text-secondary)", fontSize: "11px" }}
              />
              <button
                type="button"
                onClick={handleSaveProductGoal}
                style={{ padding: "4px 8px", borderRadius: "5px", border: "none", backgroundColor: "var(--accent-green)", color: "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
              >
                <Check size={12} />
                {t.bar.saveBtn}
              </button>
              <button
                type="button"
                onClick={() => setEditingGoal(false)}
                style={{ padding: "4px 6px", borderRadius: "5px", border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 500 }}>
              {effectivePolicy.productGoal}
            </div>
          )}
        </div>

        {effectivePolicy.mode !== "kanban" && (
          <div
            style={{
              ...cardBoxStyle,
              border: `1px solid ${sprintGoalText ? "var(--border-color)" : "rgba(245, 158, 11, 0.45)"}`,
            }}
          >
            <div style={{ ...labelBadgeStyle, color: sprintGoalText ? "var(--accent-green)" : "var(--accent-yellow)" }}>
              <Flag size={12} />
              {t.bar.sprintGoalLabel}
              {activeSprint ? ` (${activeSprint.name})` : ""}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: sprintGoalText ? "var(--text-primary)" : "var(--text-muted)",
                fontStyle: sprintGoalText ? "normal" : "italic",
              }}
            >
              {sprintGoalText || t.bar.noSprintGoal}
            </div>
          </div>
        )}
      </div>

      {/* Mode Selector + Ceremony Launch Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div
            title={t.modeSubtitles[effectivePolicy.mode]}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              backgroundColor: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              borderRadius: "7px",
              padding: "3px",
            }}
          >
            {(["strict", "pragmatic", "kanban"] as ScrumProcessMode[]).map((m) => {
              const active = effectivePolicy.mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={!canEditPolicy}
                  onClick={() => canEditPolicy && persistPolicy(applyProcessModePreset(effectivePolicy, m))}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "4px 9px",
                    borderRadius: "5px",
                    border: active ? `1px solid ${MODE_COLORS[m]}` : "1px solid transparent",
                    backgroundColor: active ? "var(--bg-active)" : "transparent",
                    color: active ? "var(--text-primary)" : "var(--text-muted)",
                    fontSize: "11px",
                    fontWeight: active ? 700 : 500,
                    cursor: canEditPolicy ? "pointer" : "default",
                  }}
                >
                  {renderModeIcon(m)}
                  {t.modes[m]}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowRulesDrawer((v) => !v)}
            style={{
              ...ceremonyBtnStyle,
              backgroundColor: showRulesDrawer ? "var(--bg-active)" : "var(--bg-sidebar)",
              color: "var(--text-secondary)",
            }}
          >
            <Settings2 size={12} />
            {t.bar.policyConfigBtn}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
            {t.bar.ceremoniesLabel}
          </span>
          {[
            { id: "planning" as const, label: t.bar.btnPlanning, icon: CalendarRange, accent: "var(--accent-indigo)" },
            { id: "daily" as const, label: t.bar.btnDaily, icon: Timer, accent: "var(--accent-blue)" },
            { id: "review" as const, label: t.bar.btnReview, icon: Presentation, accent: "var(--accent-green)" },
            { id: "retro" as const, label: t.bar.btnRetro, icon: RotateCcw, accent: "var(--accent-yellow)" },
          ].map(({ id, label, icon: Icon, accent }) => (
            <button key={id} type="button" onClick={() => fireCeremony(id)} style={ceremonyBtnStyle}>
              <Icon size={13} style={{ color: accent }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {showRulesDrawer && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            padding: "8px 12px",
            borderRadius: "7px",
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            fontSize: "11px",
            color: "var(--text-secondary)",
          }}
        >
          {(
            [
              ["requireDorBeforeSprint", t.bar.toggleDor],
              ["requireDodBeforeDone", t.bar.toggleDod],
              ["enforcePoBacklogOrder", t.bar.togglePoOrder],
              ["requireRetroActionItem", t.bar.toggleRetroAction],
            ] as const
          ).map(([field, label]) => (
            <label
              key={field}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: canEditPolicy ? "pointer" : "default" }}
            >
              <input
                type="checkbox"
                disabled={!canEditPolicy}
                checked={Boolean(effectivePolicy[field])}
                onChange={(e) => persistPolicy({ ...effectivePolicy, [field]: e.target.checked })}
              />
              {label}
            </label>
          ))}

          <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            {t.bar.sprintDays}:
            <input
              type="number"
              min={1}
              max={31}
              disabled={!canEditPolicy}
              value={effectivePolicy.sprintDurationDays}
              onChange={(e) =>
                persistPolicy({
                  ...effectivePolicy,
                  sprintDurationDays: Math.max(1, Math.min(31, Number(e.target.value) || 14)),
                })
              }
              style={{
                width: "52px",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-editor)",
                color: "var(--text-primary)",
                fontSize: "11px",
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export default ScrumPolicyAndGoalBar;
