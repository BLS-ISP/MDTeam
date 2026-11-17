"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, AlertTriangle, ExternalLink, CheckCircle2, X } from "lucide-react";
import type { AgileIssue } from "../../../utils/issueEngine";
import type { GateCheckResult, ScrumProcessMode } from "../../../types/scrumPolicy";
import { ceremoniesCopy } from "./ceremoniesI18n";

export interface ScrumGateModalProps {
  isOpen: boolean;
  gateResult: GateCheckResult | null;
  mode?: ScrumProcessMode;
  issue?: AgileIssue | null;
  currentUser?: string;
  language: "de" | "en";
  onClose: () => void;
  onOpenIssueToFix?: (issue: AgileIssue) => void;
  onOverrideWithReason?: (reason: string) => void;
}

export function ScrumGateModal({
  isOpen,
  gateResult,
  mode = "pragmatic",
  issue,
  currentUser = "@scrum-master",
  language,
  onClose,
  onOpenIssueToFix,
  onOverrideWithReason,
}: ScrumGateModalProps) {
  const t = ceremoniesCopy[language] || ceremoniesCopy.de;
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReason("");
    }
  }, [isOpen, gateResult?.ruleCode, issue?.id]);

  if (!isOpen || !gateResult || gateResult.allowed) return null;

  const canOverride = Boolean(gateResult.canOverrideWithReason && mode !== "strict");
  const cleanReason = reason.trim();
  const canSubmitOverride = canOverride && cleanReason.length >= 5 && Boolean(onOverrideWithReason);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(3px)",
        zIndex: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(580px, 96vw)",
          maxHeight: "90vh",
          backgroundColor: "var(--bg-sidebar)",
          border: `1px solid ${canOverride ? "rgba(245, 158, 11, 0.45)" : "rgba(239, 68, 68, 0.5)"}`,
          borderRadius: "12px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "var(--text-primary)",
          fontFamily: "var(--font-sans)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "15px 20px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "10px",
                  fontWeight: 700,
                  backgroundColor: canOverride
                    ? "rgba(245, 158, 11, 0.16)"
                    : "rgba(239, 68, 68, 0.18)",
                  color: canOverride ? "var(--accent-yellow)" : "var(--accent-red)",
                }}
              >
                {canOverride ? <AlertTriangle size={11} /> : <ShieldAlert size={11} />}
                {canOverride ? t.gate.pragmaticBadge : t.gate.strictBadge}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-muted)",
                }}
              >
                [{gateResult.ruleCode}]
              </span>
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700 }}>{gateResult.title}</div>
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
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "18px 20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "8px",
              }}
            >
              {t.gate.violationsHeading}
            </div>
            <ul
              style={{
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                padding: 0,
                margin: 0,
              }}
            >
              {gateResult.violations.map((v, idx) => (
                <li
                  key={idx}
                  style={{
                    padding: "8px 11px",
                    borderRadius: "7px",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.28)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                  }}
                >
                  <ShieldAlert
                    size={14}
                    style={{ color: "var(--accent-red)", flexShrink: 0, marginTop: "2px" }}
                  />
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </div>

          {issue && onOpenIssueToFix && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenIssueToFix(issue);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
                padding: "9px 14px",
                borderRadius: "7px",
                border: "1px solid var(--accent-indigo)",
                backgroundColor: "rgba(99, 102, 241, 0.14)",
                color: "var(--text-primary)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <ExternalLink size={14} style={{ color: "var(--accent-indigo)" }} />
              {t.gate.openIssueBtn} ({issue.id})
            </button>
          )}

          {!canOverride ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "7px",
                backgroundColor: "var(--bg-panel)",
                border: "1px solid var(--border-color)",
                fontSize: "12px",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              {t.gate.strictExplanation}
            </div>
          ) : (
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                backgroundColor: "var(--bg-panel)",
                border: "1px solid var(--border-color)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                {t.gate.overrideLabel}
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t.gate.overridePlaceholder}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-editor)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  fontFamily: "var(--font-sans)",
                  resize: "vertical",
                }}
              />
              {cleanReason.length > 0 && (
                <div
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                    wordBreak: "break-word",
                  }}
                >
                  {t.gate.auditPreviewPrefix} {currentUser}: [SCRUM-OVERRIDE: {gateResult.ruleCode}]{" "}
                  {cleanReason}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-panel)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-sidebar)",
              color: "var(--text-secondary)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.gate.closeBtn}
          </button>

          {canOverride && onOverrideWithReason && (
            <button
              type="button"
              disabled={!canSubmitOverride}
              onClick={() => {
                if (!canSubmitOverride) return;
                onOverrideWithReason(cleanReason);
                onClose();
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: canSubmitOverride ? "var(--accent-yellow)" : "var(--bg-active)",
                color: canSubmitOverride ? "#111827" : "var(--text-muted)",
                fontSize: "12px",
                fontWeight: 700,
                cursor: canSubmitOverride ? "pointer" : "not-allowed",
              }}
            >
              <CheckCircle2 size={14} />
              {t.gate.overrideSubmitBtn}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScrumGateModal;
