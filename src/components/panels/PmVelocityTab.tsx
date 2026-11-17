"use client";

import React from "react";
import { AlertTriangle, TrendingDown, Users } from "lucide-react";
import { useWorkspaceContext } from "../../context/WorkspaceContext";
import {
  parseBacklogItems,
  parseBurndownData,
  parseCapacityData,
  parseVelocityData,
} from "../../utils/workspace/agileMarkdownParsers";

export function PmVelocityTab() {
  const { files, language } = useWorkspaceContext();
  const burndownData = parseBurndownData(files);
  const capacities = parseCapacityData(files);
  const velocityData = parseVelocityData(files);
  const backlogItems = parseBacklogItems(files);

  const totalCapacity = capacities.reduce((sum, c) => sum + c.capacity, 0);
  const plannedSP = backlogItems.filter((i) => i.status !== "done").length * 3;
  const loadPercent = totalCapacity > 0 ? Math.round((plannedSP / totalCapacity) * 100) : 0;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px" }}>
        {/* Burndown Chart */}
        <div className="timeline-card">
          <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <TrendingDown size={16} style={{ color: "var(--accent-indigo)" }} />
            {language === "en"
              ? "Sprint Burndown Chart (Dynamic from burndown.md)"
              : "Sprint Burndown Chart (Dynamisch aus burndown.md)"}
          </h3>

          <div style={{ height: "180px", position: "relative", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {burndownData.length === 0 ? (
              <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                {language === "en" ? "No burndown data found." : "Keine Burndown-Daten gefunden."}
              </div>
            ) : (
              <svg viewBox="0 0 400 160" style={{ width: "100%", height: "100%" }}>
                <line x1="40" y1="20" x2="380" y2="20" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="40" y1="50" x2="380" y2="50" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="40" y1="80" x2="380" y2="80" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="40" y1="110" x2="380" y2="110" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="40" y1="140" x2="380" y2="140" stroke="var(--border-color)" strokeWidth="1" />
                <line x1="40" y1="20" x2="40" y2="140" stroke="var(--border-color)" strokeWidth="1" />

                <text x="10" y="24" fill="var(--text-muted)" fontSize="8px">60 SP</text>
                <text x="10" y="84" fill="var(--text-muted)" fontSize="8px">30 SP</text>
                <text x="10" y="144" fill="var(--text-muted)" fontSize="8px">0 SP</text>

                <line x1="40" y1="20" x2="380" y2="140" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="5 5" />

                {(() => {
                  const maxVal = Math.max(...burndownData.map((d) => d.ideal), 1);
                  const points: string[] = [];
                  burndownData.forEach((d, idx) => {
                    if (d.actual !== null) {
                      const denom = Math.max(burndownData.length - 1, 1);
                      const x = 40 + idx * (340 / denom);
                      const y = 140 - d.actual * (120 / maxVal);
                      points.push(`${x},${y}`);
                    }
                  });
                  return points.length > 1 ? (
                    <>
                      <polyline points={points.join(" ")} fill="none" stroke="var(--accent-indigo)" strokeWidth="2.5" />
                      {points.map((pt, idx) => {
                        const [x, y] = pt.split(",");
                        return (
                          <circle key={idx} cx={x} cy={y} r="3" fill="var(--accent-indigo)" stroke="var(--bg-sidebar)" strokeWidth="1" />
                        );
                      })}
                    </>
                  ) : null;
                })()}

                {burndownData.map((d, idx, arr) => {
                  const denom = Math.max(arr.length - 1, 1);
                  const x = 40 + idx * (340 / denom);
                  return (
                    <text key={idx} x={x} y="152" fill="var(--text-muted)" fontSize="8px" textAnchor="middle">
                      {d.day.replace("Tag ", "T").replace("Day ", "D")}
                    </text>
                  );
                })}
              </svg>
            )}
          </div>

          <div style={{ display: "flex", gap: "16px", fontSize: "9px", color: "var(--text-secondary)", marginTop: "8px", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ borderTop: "2px dashed var(--text-muted)", width: "12px", display: "inline-block" }} />
              <span>{language === "en" ? "Ideal trend" : "Idealverlauf"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ borderTop: "2px solid var(--accent-indigo)", width: "12px", display: "inline-block" }} />
              <span>{language === "en" ? "Actual trend" : "Tatsächlicher Verlauf"}</span>
            </div>
          </div>
        </div>

        {/* Team Capacity Calculator */}
        <div className="timeline-card">
          <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={16} style={{ color: "var(--accent-indigo)" }} />
            {language === "en"
              ? "Sprint Capacity & Load (capacity.md)"
              : "Sprint-Kapazität & Auslastung (capacity.md)"}
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ backgroundColor: "var(--bg-panel)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  {language === "en" ? "Total Capacity" : "Gesamtkapazität"}
                </div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "var(--accent-green)" }}>
                  {totalCapacity.toFixed(1)} SP
                </div>
              </div>
              <div style={{ backgroundColor: "var(--bg-panel)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  {language === "en" ? "Planned (Open)" : "Geplant (Offen)"}
                </div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "var(--accent-indigo)" }}>{plannedSP} SP</div>
              </div>
            </div>

            <div style={{ margin: "8px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                <span>{language === "en" ? "Team Load:" : "Team-Auslastung:"}</span>
                <span style={{ fontWeight: "bold", color: loadPercent > 100 ? "var(--accent-red)" : "var(--text-primary)" }}>
                  {loadPercent}%
                </span>
              </div>
              <div style={{ width: "100%", height: "8px", backgroundColor: "var(--border-color)", borderRadius: "4px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(loadPercent, 100)}%`,
                    height: "100%",
                    backgroundColor: loadPercent > 100 ? "var(--accent-red)" : "var(--accent-indigo)",
                  }}
                />
              </div>
              {loadPercent > 100 && (
                <div style={{ fontSize: "10px", color: "var(--accent-red)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <AlertTriangle size={10} />
                  <span>{language === "en" ? "Team is overloaded!" : "Team ist überlastet!"}</span>
                </div>
              )}
            </div>

            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              <div style={{ fontWeight: 600, marginBottom: "6px", color: "var(--text-primary)" }}>
                {language === "en" ? "Individual Capacities:" : "Einzelkapazitäten:"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {capacities.map((c, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: "2px" }}>
                    <span>
                      {c.member} ({c.days}d {language === "en" ? "at" : "à"} {c.focus * 100}%)
                    </span>
                    <span style={{ fontWeight: 500 }}>{c.capacity.toFixed(1)} SP</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Velocity SVG Bar Chart */}
      <div className="timeline-card" style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <TrendingDown size={16} style={{ color: "var(--accent-indigo)" }} />
          {language === "en"
            ? "Team Velocity (Historical from capacity.md)"
            : "Team Velocity (Historischer Verlauf aus capacity.md)"}
        </h3>
        <div style={{ height: "180px", display: "flex", justifyContent: "center" }}>
          {velocityData.length === 0 ? (
            <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
              {language === "en" ? "No velocity data found." : "Keine Velocity-Daten gefunden."}
            </div>
          ) : (
            <svg viewBox="0 0 400 160" style={{ width: "100%", height: "100%" }}>
              <line x1="40" y1="20" x2="380" y2="20" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
              <line x1="40" y1="60" x2="380" y2="60" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
              <line x1="40" y1="100" x2="380" y2="100" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
              <line x1="40" y1="140" x2="380" y2="140" stroke="var(--border-color)" strokeWidth="1" />
              <line x1="40" y1="20" x2="40" y2="140" stroke="var(--border-color)" strokeWidth="1" />

              <text x="10" y="24" fill="var(--text-muted)" fontSize="8px">60 SP</text>
              <text x="10" y="64" fill="var(--text-muted)" fontSize="8px">30 SP</text>
              <text x="10" y="104" fill="var(--text-muted)" fontSize="8px">10 SP</text>

              {velocityData.map((d, idx) => {
                const barWidth = 10;
                const spacing = 60;
                const xPlanned = 70 + idx * spacing;
                const xActual = xPlanned + 15;
                const yPlanned = 140 - d.planned * (120 / 60);
                const yActual = 140 - d.actual * (120 / 60);
                return (
                  <g key={idx}>
                    <rect x={xPlanned} y={yPlanned} width={barWidth} height={140 - yPlanned} fill="var(--border-color)" rx="2" stroke="rgba(255,255,255,0.05)" />
                    <rect x={xActual} y={yActual} width={barWidth} height={140 - yActual} fill="var(--accent-indigo)" rx="2" />
                    <text x={xPlanned + 12} y="152" fill="var(--text-muted)" fontSize="8px" textAnchor="middle">
                      {d.sprint}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
        <div style={{ display: "flex", gap: "16px", fontSize: "9px", color: "var(--text-secondary)", marginTop: "8px", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ backgroundColor: "var(--border-color)", width: "12px", height: "8px", display: "inline-block", borderRadius: "2px" }} />
            <span>{language === "en" ? "Planned Story Points" : "Geplante Story Points"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ backgroundColor: "var(--accent-indigo)", width: "12px", height: "8px", display: "inline-block", borderRadius: "2px" }} />
            <span>{language === "en" ? "Completed Story Points" : "Erreichte Story Points"}</span>
          </div>
        </div>
      </div>
    </>
  );
}
