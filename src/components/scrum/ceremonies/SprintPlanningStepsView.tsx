"use client";

import React from "react";
import {
  Target,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  ExternalLink,
  Users,
  TrendingUp,
  Layers,
} from "lucide-react";
import type { AgileIssue, AgileSprint, TeamCapacityMember } from "../../../utils/issueEngine";
import type {
  CeremonySubtaskItem,
  GateCheckResult,
  ScrumPolicyConfig,
} from "../../../types/scrumPolicy";
import type { CeremoniesCopy } from "./ceremoniesI18n";

export interface SprintPlanningStepsViewProps {
  step: 1 | 2 | 3;
  t: CeremoniesCopy;
  policy: ScrumPolicyConfig;
  sprints: AgileSprint[];
  draftSprint: AgileSprint;
  capacity: TeamCapacityMember[];
  totalCapacitySp: number;
  avgVelocitySp: number;
  selectedIssues: AgileIssue[];
  backlogCandidates: AgileIssue[];
  selectedSp: number;
  pendingOverrideIssueId: string | null;
  overrideReason: string;
  subtaskMap: Record<string, CeremonySubtaskItem[]>;
  newSubtaskTitles: Record<string, string>;
  newSubtaskHours: Record<string, string>;
  newSubtaskAssignees: Record<string, string>;
  evaluateDor: (issue: AgileIssue) => GateCheckResult;
  onSelectTargetSprintId: (sprintId: string) => void;
  onUpdateSprintField: (patch: Partial<AgileSprint>) => void;
  onPullIssue: (issue: AgileIssue) => void;
  onConfirmOverridePull: (issue: AgileIssue) => void;
  onCancelOverridePull: () => void;
  onSetOverrideReason: (val: string) => void;
  onRemoveIssueFromSprint: (issueId: string) => void;
  onOpenIssueToFix?: (issue: AgileIssue) => void;
  onSetNewSubtaskTitle: (issueId: string, val: string) => void;
  onSetNewSubtaskHours: (issueId: string, val: string) => void;
  onSetNewSubtaskAssignee: (issueId: string, val: string) => void;
  onAddSubtask: (issueId: string) => void;
  onToggleSubtask: (issueId: string, subtaskId: string) => void;
  onDeleteSubtask: (issueId: string, subtaskId: string) => void;
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: "6px",
  border: "1px solid var(--border-color)",
  backgroundColor: "var(--bg-editor)",
  color: "var(--text-primary)",
  fontSize: "12px",
  fontFamily: "var(--font-sans)",
};

export function SprintPlanningStepsView(props: SprintPlanningStepsViewProps) {
  const { step, t, policy, draftSprint, totalCapacitySp, avgVelocitySp, selectedSp } = props;
  const loadRatio = totalCapacitySp > 0 ? Math.round((selectedSp / totalCapacitySp) * 100) : 0;
  const isOverloaded = totalCapacitySp > 0 && selectedSp > totalCapacitySp;
  const barColor = isOverloaded ? "var(--accent-red)" : loadRatio >= 85 ? "var(--accent-yellow)" : "var(--accent-green)";

  if (step === 1) {
    const goalCleanLen = draftSprint.goal.trim().length;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-indigo)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <Target size={13} />
            {t.planning.productGoalAlign}
          </div>
          <div style={{ fontSize: "13px", fontWeight: 500 }}>{policy.productGoal}</div>
        </div>

        {/* KPI Cards: Capacity, Avg Velocity, Selected Load */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          <div style={{ padding: "10px 12px", borderRadius: "8px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
              <Users size={12} style={{ color: "var(--accent-green)" }} />
              {t.planning.teamCapacityCard}
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-green)", marginTop: "4px" }}>
              {totalCapacitySp.toFixed(1)} SP
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
              {props.capacity.map((c) => `${c.member}: ${c.capacity} SP`).join(" • ") || "—"}
            </div>
          </div>

          <div style={{ padding: "10px 12px", borderRadius: "8px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
              <TrendingUp size={12} style={{ color: "var(--accent-blue)" }} />
              {t.planning.avgVelocityCard}
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-blue)", marginTop: "4px" }}>
              {avgVelocitySp.toFixed(1)} SP
            </div>
          </div>

          <div style={{ padding: "10px 12px", borderRadius: "8px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
              <Layers size={12} style={{ color: barColor }} />
              {t.planning.selectedLoadCard}
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: barColor, marginTop: "4px" }}>
              {selectedSp} SP {totalCapacitySp > 0 ? `(${loadRatio}%)` : ""}
            </div>
          </div>
        </div>

        {/* Sprint Selector + Name + Dates */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", color: "var(--text-secondary)" }}>
            {t.planning.selectSprint}
            <select
              value={draftSprint.id}
              onChange={(e) => props.onSelectTargetSprintId(e.target.value)}
              style={inputStyle}
            >
              {props.sprints
                .filter((s) => s.state !== "closed")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.state})
                  </option>
                ))}
              {!props.sprints.some((s) => s.id === draftSprint.id) && (
                <option value={draftSprint.id}>{draftSprint.name} (new)</option>
              )}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", color: "var(--text-secondary)" }}>
            {t.planning.sprintNameLabel}
            <input
              type="text"
              value={draftSprint.name}
              onChange={(e) => props.onUpdateSprintField({ name: e.target.value })}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", color: "var(--text-secondary)" }}>
            {t.planning.startDateLabel}
            <input
              type="date"
              value={draftSprint.startDate}
              onChange={(e) => props.onUpdateSprintField({ startDate: e.target.value })}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", color: "var(--text-secondary)" }}>
            {t.planning.endDateLabel}
            <input
              type="date"
              value={draftSprint.endDate}
              onChange={(e) => props.onUpdateSprintField({ endDate: e.target.value })}
              style={inputStyle}
            />
          </label>
        </div>

        {/* Binding Sprint Goal */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600 }}>
            <span>{t.planning.sprintGoalInputLabel}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: goalCleanLen >= 10 ? "var(--accent-green)" : "var(--accent-yellow)" }}>
              {goalCleanLen}/10+ chars
            </span>
          </div>
          <textarea
            rows={3}
            value={draftSprint.goal}
            onChange={(e) => props.onUpdateSprintField({ goal: e.target.value })}
            placeholder={t.planning.sprintGoalPlaceholder}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* Live SP Capacity Bar */}
        <div style={{ padding: "10px 14px", borderRadius: "8px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
            <span>
              {t.planning.selectedLoadCard}:{" "}
              <strong style={{ color: barColor, fontFamily: "var(--font-mono)" }}>{selectedSp} SP</strong>
            </span>
            <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
              Cap: {totalCapacitySp.toFixed(1)} SP • Ø Vel: {avgVelocitySp.toFixed(1)} SP
            </span>
          </div>
          <div style={{ width: "100%", height: "8px", borderRadius: "999px", backgroundColor: "var(--bg-sidebar)", overflow: "hidden", border: "1px solid var(--border-color)" }}>
            <div style={{ width: `${Math.min(100, loadRatio)}%`, height: "100%", backgroundColor: barColor, transition: "width 0.2s" }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* Backlog Candidates */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>
              {t.planning.backlogCandidates} ({props.backlogCandidates.length})
            </div>
            {props.backlogCandidates.map((issue) => {
              const gate = props.evaluateDor(issue);
              const isHealthy = gate.violations.length === 0;
              const isOverriding = props.pendingOverrideIssueId === issue.id;
              return (
                <div key={issue.id} style={{ padding: "9px 11px", borderRadius: "7px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>
                      <strong style={{ fontFamily: "var(--font-mono)", color: "var(--accent-indigo)" }}>{issue.id}</strong>{" "}
                      {issue.title}
                    </span>
                    <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", flexShrink: 0 }}>
                      {issue.storyPoints} SP
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span
                      title={gate.violations.join("\n")}
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", backgroundColor: isHealthy ? "rgba(16, 185, 129, 0.14)" : "rgba(245, 158, 11, 0.16)", color: isHealthy ? "var(--accent-green)" : "var(--accent-yellow)" }}
                    >
                      {isHealthy ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                      {isHealthy ? t.planning.dorReady : `${t.planning.dorIssues} (${gate.violations.length})`}
                    </span>

                    <div style={{ display: "flex", gap: "5px" }}>
                      {!isHealthy && props.onOpenIssueToFix && (
                        <button
                          type="button"
                          onClick={() => props.onOpenIssueToFix?.(issue)}
                          style={{ padding: "3px 7px", borderRadius: "5px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-sidebar)", color: "var(--text-secondary)", fontSize: "10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        >
                          <ExternalLink size={10} />
                          Fix
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!gate.allowed && !gate.canOverrideWithReason}
                        onClick={() => props.onPullIssue(issue)}
                        style={{ padding: "3px 9px", borderRadius: "5px", border: "none", backgroundColor: !gate.allowed && !gate.canOverrideWithReason ? "var(--bg-active)" : "var(--accent-indigo)", color: !gate.allowed && !gate.canOverrideWithReason ? "var(--text-muted)" : "#fff", fontSize: "11px", fontWeight: 600, cursor: !gate.allowed && !gate.canOverrideWithReason ? "not-allowed" : "pointer" }}
                      >
                        {t.planning.pullBtn}
                      </button>
                    </div>
                  </div>

                  {!isHealthy && (
                    <div style={{ fontSize: "10px", color: "var(--accent-red)" }}>
                      {gate.violations.join(" • ")}
                    </div>
                  )}

                  {isOverriding && (
                    <div style={{ display: "flex", gap: "5px", marginTop: "2px" }}>
                      <input
                        type="text"
                        value={props.overrideReason}
                        onChange={(e) => props.onSetOverrideReason(e.target.value)}
                        placeholder={t.planning.overridePullPrompt}
                        style={{ ...inputStyle, flex: 1, padding: "4px 7px", fontSize: "11px" }}
                      />
                      <button
                        type="button"
                        disabled={props.overrideReason.trim().length < 5}
                        onClick={() => props.onConfirmOverridePull(issue)}
                        style={{ padding: "4px 8px", borderRadius: "5px", border: "none", backgroundColor: "var(--accent-yellow)", color: "#111827", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}
                      >
                        {t.planning.confirmOverridePull}
                      </button>
                      <button
                        type="button"
                        onClick={props.onCancelOverridePull}
                        style={{ padding: "4px 6px", borderRadius: "5px", border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-muted)", fontSize: "10px", cursor: "pointer" }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected Sprint Scope */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent-green)" }}>
              {t.planning.sprintSelected} ({props.selectedIssues.length} • {selectedSp} SP)
            </div>
            {props.selectedIssues.map((issue) => (
              <div key={issue.id} style={{ padding: "9px 11px", borderRadius: "7px", backgroundColor: "var(--bg-panel)", border: "1px solid rgba(16, 185, 129, 0.3)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                <div style={{ fontSize: "12px" }}>
                  <strong style={{ fontFamily: "var(--font-mono)", color: "var(--accent-green)" }}>{issue.id}</strong>{" "}
                  {issue.title}{" "}
                  <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                    ({issue.storyPoints} SP • {issue.assignee || "—"})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => props.onRemoveIssueFromSprint(issue.id)}
                  style={{ padding: "3px 8px", borderRadius: "5px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-sidebar)", color: "var(--text-secondary)", fontSize: "11px", cursor: "pointer" }}
                >
                  {t.planning.removeBtn}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 3: How (Technical Subtask Breakdown)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{t.planning.subtaskHint}</div>
      {props.selectedIssues.length === 0 ? (
        <div style={{ padding: "18px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
          {t.planning.noIssuesSelected}
        </div>
      ) : (
        props.selectedIssues.map((issue) => {
          const list = props.subtaskMap[issue.id] || [];
          return (
            <div key={issue.id} style={{ padding: "11px 14px", borderRadius: "8px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: 700 }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-indigo)" }}>{issue.id}</span>{" "}
                  {issue.title}
                </span>
                <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  {list.filter((s) => s.done).length}/{list.length} Subtasks • {issue.storyPoints} SP
                </span>
              </div>

              {list.map((st) => (
                <div key={st.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "4px 8px", borderRadius: "5px", backgroundColor: "var(--bg-sidebar)", fontSize: "12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "7px", cursor: "pointer", flex: 1 }}>
                    <input type="checkbox" checked={st.done} onChange={() => props.onToggleSubtask(issue.id, st.id)} />
                    <span style={{ textDecoration: st.done ? "line-through" : "none", color: st.done ? "var(--text-muted)" : "var(--text-primary)" }}>
                      <strong style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>{st.id}:</strong> {st.title}
                    </span>
                    {st.assignee && <span style={{ color: "var(--accent-indigo)", fontSize: "11px" }}>{st.assignee}</span>}
                    {st.remainingHours !== undefined && (
                      <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>{st.remainingHours}h</span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => props.onDeleteSubtask(issue.id, st.id)}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={props.newSubtaskTitles[issue.id] || ""}
                  onChange={(e) => props.onSetNewSubtaskTitle(issue.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      props.onAddSubtask(issue.id);
                    }
                  }}
                  placeholder={t.planning.newSubtaskPlaceholder}
                  style={{ ...inputStyle, flex: "1 1 220px", padding: "5px 8px" }}
                />
                <input
                  type="text"
                  value={props.newSubtaskAssignees[issue.id] ?? (issue.assignee || "")}
                  onChange={(e) => props.onSetNewSubtaskAssignee(issue.id, e.target.value)}
                  placeholder="@dev"
                  style={{ ...inputStyle, width: "110px", padding: "5px 8px" }}
                />
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={props.newSubtaskHours[issue.id] || ""}
                  onChange={(e) => props.onSetNewSubtaskHours(issue.id, e.target.value)}
                  placeholder={t.planning.hoursPlaceholder}
                  style={{ ...inputStyle, width: "68px", padding: "5px 8px" }}
                />
                <button
                  type="button"
                  onClick={() => props.onAddSubtask(issue.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "5px 10px", borderRadius: "6px", border: "none", backgroundColor: "var(--accent-indigo)", color: "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                >
                  <Plus size={12} />
                  {t.planning.addSubtaskBtn}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
