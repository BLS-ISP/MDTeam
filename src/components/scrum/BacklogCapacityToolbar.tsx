"use client";

import React from "react";
import { AlertTriangle, Users, ArrowRight } from "lucide-react";
import {
  AgileSprint,
  SprintMetrics,
  TeamCapacityMember,
} from "../../utils/issueEngine";
import { ScrumCopy } from "./scrumI18nAndStyles";

export interface BacklogCapacityToolbarProps {
  t: ScrumCopy;
  activeSprint: AgileSprint | undefined;
  activeSprintMetrics: SprintMetrics;
  capacity: TeamCapacityMember[];
  totalCapacitySp: number;
  unmigratedLegacyCount: number;
  onConvertLegacyBacklog: () => void;
  onOpenPoker: (issueId?: string) => void;
  onCreateNewSprint: () => void;
}

export function BacklogCapacityToolbar({
  t,
  activeSprint,
  activeSprintMetrics,
  capacity,
  totalCapacitySp,
  unmigratedLegacyCount,
  onConvertLegacyBacklog,
  onOpenPoker,
  onCreateNewSprint,
}: BacklogCapacityToolbarProps) {
  const activeLoadSp = activeSprintMetrics.totalPoints;
  const ratio =
    totalCapacitySp > 0 ? Math.round((activeLoadSp / totalCapacitySp) * 100) : 0;
  const overloaded = totalCapacitySp > 0 && activeLoadSp > totalCapacitySp;

  return (
    <div
      style={{
        backgroundColor: "var(--bg-panel)",
        border: "1px solid var(--border-color)",
        borderRadius: "10px",
        padding: "14px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "22px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            {t.teamCapacity}
          </div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
            {totalCapacitySp.toFixed(1)} SP
          </div>
        </div>

        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            {t.sprintLoad} ({activeSprint?.id || "—"})
          </div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: overloaded ? "var(--accent-red)" : "var(--accent-indigo)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {activeLoadSp} SP ({ratio}%)
          </div>
        </div>

        <div style={{ minWidth: "180px" }}>
          <div
            style={{
              width: "100%",
              height: "8px",
              backgroundColor: "var(--bg-sidebar)",
              borderRadius: "999px",
              overflow: "hidden",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{
                width: `${Math.min(100, ratio)}%`,
                height: "100%",
                backgroundColor: overloaded ? "var(--accent-red)" : "var(--accent-indigo)",
              }}
            />
          </div>
          {overloaded ? (
            <div
              style={{
                fontSize: "10px",
                color: "var(--accent-red)",
                marginTop: "4px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
              }}
            >
              <AlertTriangle size={11} />
              {t.overloadedAlert}
            </div>
          ) : (
            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
              {capacity.map((c) => `${c.member}: ${c.capacity} SP`).join(" • ")}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons: Convert Legacy Backlog, Planning Poker, New Sprint */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onConvertLegacyBacklog}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 12px",
            borderRadius: "6px",
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-sidebar)",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <ArrowRight size={13} style={{ color: "var(--accent-yellow)" }} />
          {t.convertLegacyBtn}
          {unmigratedLegacyCount > 0 && (
            <span
              style={{
                padding: "1px 6px",
                borderRadius: "999px",
                backgroundColor: "rgba(245, 158, 11, 0.2)",
                color: "var(--accent-yellow)",
                fontSize: "10px",
                fontFamily: "var(--font-mono)",
              }}
            >
              {unmigratedLegacyCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onOpenPoker(undefined)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(99, 102, 241, 0.4)",
            backgroundColor: "rgba(99, 102, 241, 0.12)",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Users size={13} style={{ color: "var(--accent-indigo)" }} />
          {t.planningPoker}
        </button>

        <button
          type="button"
          onClick={onCreateNewSprint}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 12px",
            borderRadius: "6px",
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-sidebar)",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t.newSprintBtn}
        </button>
      </div>
    </div>
  );
}
