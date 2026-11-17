"use client";

import React, { useState, useMemo } from "react";
import {
  Presentation,
  Flag,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  PlusCircle,
  X,
} from "lucide-react";
import {
  type AgileIssue,
  type AgileSprint,
  type IssuePriority,
  type IssueType,
  type WorkspaceFile,
  FIBONACCI_POINTS,
  createBlankIssue,
  serializeIssueToMarkdown,
} from "../../../utils/issueEngine";
import type { ScrumPolicyConfig, ScrumUserRole } from "../../../types/scrumPolicy";
import {
  evaluateStrictSprintVelocityBreakdown,
  isProductOwnerOrAdmin,
  parseScrumPolicy,
} from "../../../utils/scrum-rules/scrumPolicyEngine";
import {
  isIssueReviewAccepted,
  serializeIssueWithCeremonyData,
  withIssueReviewAccepted,
} from "../../../utils/scrum-rules/ceremonyIssueHelpers";
import { ceremoniesCopy } from "./ceremoniesI18n";

export interface SprintReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: WorkspaceFile[];
  issues: AgileIssue[];
  activeSprint?: AgileSprint;
  policy?: ScrumPolicyConfig;
  currentUser: string;
  userRole?: ScrumUserRole;
  language: "de" | "en";
  onUpsertFile: (file: WorkspaceFile) => void;
}

const inputStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: "6px",
  border: "1px solid var(--border-color)",
  backgroundColor: "var(--bg-editor)",
  color: "var(--text-primary)",
  fontSize: "12px",
};

export function SprintReviewModal({
  isOpen,
  onClose,
  files,
  issues,
  activeSprint,
  policy: policyProp,
  currentUser,
  userRole,
  language,
  onUpsertFile,
}: SprintReviewModalProps) {
  const t = ceremoniesCopy[language] || ceremoniesCopy.de;
  const effectivePolicy = useMemo(() => policyProp || parseScrumPolicy(files), [policyProp, files]);
  const canPoDecide =
    effectivePolicy.mode !== "strict" || isProductOwnerOrAdmin(userRole || currentUser);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [fbTitle, setFbTitle] = useState("");
  const [fbDesc, setFbDesc] = useState("");
  const [fbType, setFbType] = useState<IssueType>("story");
  const [fbPriority, setFbPriority] = useState<IssuePriority>("medium");
  const [fbPoints, setFbPoints] = useState<number>(3);
  const [createdFeedbackIds, setCreatedFeedbackIds] = useState<string[]>([]);

  const sprintIssues = useMemo(
    () =>
      (issues || []).filter(
        (i) =>
          i.type !== "epic" &&
          (!activeSprint || i.sprint.toLowerCase() === activeSprint.id.toLowerCase())
      ),
    [issues, activeSprint]
  );

  const breakdown = useMemo(
    () => evaluateStrictSprintVelocityBreakdown(sprintIssues),
    [sprintIssues]
  );

  if (!isOpen) return null;

  const undoneCombined = [...breakdown.dodViolatingDoneIssues, ...breakdown.unfinishedIssues];

  const handleAcceptStory = (issue: AgileIssue) => {
    if (!canPoDecide) return;
    const nowIso = new Date().toISOString();
    const stamped = withIssueReviewAccepted(
      {
        ...issue,
        updatedAt: nowIso,
        comments: [
          ...(issue.comments || []),
          {
            author: currentUser || "@product-owner",
            timestamp: nowIso.slice(0, 16).replace("T", " "),
            text: "[SPRINT-REVIEW: ACCEPTED] Increment accepted by Product Owner.",
          },
        ],
      },
      true
    );
    onUpsertFile(serializeIssueWithCeremonyData(stamped, files));
  };

  const handleConfirmRejectStory = (issue: AgileIssue) => {
    if (!canPoDecide || rejectNote.trim().length < 3) return;
    const nowIso = new Date().toISOString();
    const stamped = withIssueReviewAccepted(
      {
        ...issue,
        status: "in-progress",
        updatedAt: nowIso,
        comments: [
          ...(issue.comments || []),
          {
            author: currentUser || "@product-owner",
            timestamp: nowIso.slice(0, 16).replace("T", " "),
            text: `[SPRINT-REVIEW: REJECTED] ${rejectNote.trim()}`,
          },
        ],
      },
      false
    );
    onUpsertFile(serializeIssueWithCeremonyData(stamped, files));
    setRejectingId(null);
    setRejectNote("");
  };

  const handleCreateFeedbackStory = () => {
    const cleanTitle = fbTitle.trim();
    if (!cleanTitle) return;
    const newIssue = createBlankIssue(files, currentUser, {
      title: cleanTitle,
      type: fbType,
      priority: fbPriority,
      storyPoints: fbPoints,
      status: "backlog",
      sprint: "",
      labels: ["stakeholder-feedback"],
      description: fbDesc.trim() || `Captured during Sprint Review (${activeSprint?.name || "Sprint"}).`,
      acceptanceCriteria: [{ text: "Validated against stakeholder feedback", checked: false }],
    });
    onUpsertFile(serializeIssueToMarkdown(newIssue));
    setCreatedFeedbackIds((prev) => [...prev, `${newIssue.id}: ${newIssue.title}`]);
    setFbTitle("");
    setFbDesc("");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(3px)",
        zIndex: 170,
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
          width: "min(960px, 96vw)",
          maxHeight: "92vh",
          backgroundColor: "var(--bg-sidebar)",
          border: "1px solid var(--border-color)",
          borderRadius: "14px",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "var(--text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-panel)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: 700 }}>
            <Presentation size={18} style={{ color: "var(--accent-green)" }} />
            {t.review.title} {activeSprint ? `— ${activeSprint.name}` : ""}
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Sprint Goal & Strict Velocity Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
            <div style={{ padding: "11px 14px", borderRadius: "8px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent-green)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "5px" }}>
                <Flag size={12} />
                Sprint Goal
              </div>
              <div style={{ fontSize: "13px", fontWeight: 500, marginTop: "4px" }}>
                {activeSprint?.goal || "—"}
              </div>
            </div>

            <div style={{ padding: "11px 14px", borderRadius: "8px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                {t.review.strictVelocityCard}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-green)", marginTop: "3px" }}>
                {breakdown.velocityPoints} / {breakdown.totalScopePoints} SP
              </div>
            </div>
          </div>

          {/* 0 SP Warning Banner for Undone Items */}
          {breakdown.undonePointsZeroed > 0 && (
            <div style={{ padding: "10px 12px", borderRadius: "8px", backgroundColor: "rgba(245, 158, 11, 0.14)", border: "1px solid rgba(245, 158, 11, 0.35)", color: "var(--accent-yellow)", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>
                {t.review.undoneZeroSpWarning} ({breakdown.undonePointsZeroed} SP → 0 SP)
              </span>
            </div>
          )}

          {/* Done Increment Inspection (PO Accept / Reject) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent-green)" }}>
              {t.review.doneIncrementHeading} ({breakdown.acceptedDoneIssues.length})
            </div>
            {breakdown.acceptedDoneIssues.map((issue) => {
              const accepted = isIssueReviewAccepted(issue, files);
              const isRejecting = rejectingId === issue.id;
              return (
                <div key={issue.id} style={{ padding: "10px 12px", borderRadius: "8px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "13px" }}>
                      <strong style={{ fontFamily: "var(--font-mono)", color: "var(--accent-indigo)" }}>{issue.id}</strong>{" "}
                      {issue.title}{" "}
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-green)" }}>
                        (+{issue.storyPoints} SP)
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {accepted ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700, color: "var(--accent-green)", padding: "3px 8px", borderRadius: "999px", backgroundColor: "rgba(16, 185, 129, 0.14)" }}>
                          <CheckCircle2 size={12} />
                          {t.review.acceptedBadge}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!canPoDecide}
                          onClick={() => handleAcceptStory(issue)}
                          style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "5px 10px", borderRadius: "6px", border: "none", backgroundColor: canPoDecide ? "var(--accent-green)" : "var(--bg-active)", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: canPoDecide ? "pointer" : "not-allowed" }}
                        >
                          <CheckCircle2 size={12} />
                          {t.review.acceptBtn}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={!canPoDecide}
                        onClick={() => {
                          setRejectingId(isRejecting ? null : issue.id);
                          setRejectNote("");
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "5px 10px", borderRadius: "6px", border: "1px solid rgba(239, 68, 68, 0.4)", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--accent-red)", fontSize: "11px", fontWeight: 600, cursor: canPoDecide ? "pointer" : "not-allowed" }}
                      >
                        <RotateCcw size={12} />
                        {t.review.rejectBtn}
                      </button>
                    </div>
                  </div>

                  {isRejecting && (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="text"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder={t.review.rejectNotePlaceholder}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        type="button"
                        disabled={rejectNote.trim().length < 3}
                        onClick={() => handleConfirmRejectStory(issue)}
                        style={{ padding: "6px 12px", borderRadius: "6px", border: "none", backgroundColor: "var(--accent-red)", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                      >
                        {t.review.confirmRejectBtn}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Undone Sprint Items (0 SP Contribution) */}
          {undoneCombined.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>
                {t.review.undoneItemsHeading} ({undoneCombined.length})
              </div>
              {undoneCombined.map((issue) => (
                <div key={issue.id} style={{ padding: "8px 11px", borderRadius: "7px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)" }}>
                  <span>
                    <strong style={{ fontFamily: "var(--font-mono)" }}>{issue.id}</strong> [{issue.status}] — {issue.title}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-yellow)", fontWeight: 700 }}>
                    0 SP (planned {issue.storyPoints} SP)
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Stakeholder Feedback -> Create Backlog Story Quick Form */}
          <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: "var(--bg-panel)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", color: "var(--accent-indigo)" }}>
              <PlusCircle size={15} />
              {t.review.feedbackTitle}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                value={fbTitle}
                onChange={(e) => setFbTitle(e.target.value)}
                placeholder={t.review.feedbackSummaryPlaceholder}
                style={{ ...inputStyle, flex: "1 1 260px" }}
              />
              <select value={fbType} onChange={(e) => setFbType(e.target.value as IssueType)} style={inputStyle}>
                <option value="story">Story</option>
                <option value="bug">Bug</option>
                <option value="task">Task</option>
              </select>
              <select value={fbPriority} onChange={(e) => setFbPriority(e.target.value as IssuePriority)} style={inputStyle}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="critical">Critical</option>
              </select>
              <select value={fbPoints} onChange={(e) => setFbPoints(Number(e.target.value))} style={inputStyle}>
                {FIBONACCI_POINTS.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt} SP
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={fbDesc}
                onChange={(e) => setFbDesc(e.target.value)}
                placeholder={t.review.feedbackDescPlaceholder}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                disabled={!fbTitle.trim()}
                onClick={handleCreateFeedbackStory}
                style={{ padding: "6px 14px", borderRadius: "6px", border: "none", backgroundColor: fbTitle.trim() ? "var(--accent-indigo)" : "var(--bg-active)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: fbTitle.trim() ? "pointer" : "not-allowed" }}
              >
                {t.review.createFeedbackBtn}
              </button>
            </div>
            {createdFeedbackIds.length > 0 && (
              <div style={{ fontSize: "11px", color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
                {t.review.createdFeedbackList} {createdFeedbackIds.join(" • ")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SprintReviewModal;
