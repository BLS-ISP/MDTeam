import {
  type WorkspaceFile,
  type WorkspaceNotificationItem,
  parseMarkdownSummary,
  normalizeHandleForMatch,
} from "./modalTypesAndBadges";

export function scanWorkspaceNotifications(
  files: WorkspaceFile[],
  currentUser: string,
  language: "de" | "en" = "de"
): WorkspaceNotificationItem[] {
  const isEn = language === "en";
  const normalizedUser = normalizeHandleForMatch(currentUser || "@developer-a");
  const bareUser = normalizedUser.slice(1);
  const notifications: WorkspaceNotificationItem[] = [];
  const seenIds = new Set<string>();

  const pushNotif = (item: WorkspaceNotificationItem) => {
    if (seenIds.has(item.id)) return;
    seenIds.add(item.id);
    notifications.push(item);
  };

  const mentionRegex = bareUser
    ? new RegExp(`@${bareUser.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9_-])`, "i")
    : null;

  for (const file of files) {
    const lowerPath = file.path.toLowerCase();

    // 1. Inline review threads in `.mdteam/inline-comments.json`
    if (lowerPath.endsWith("inline-comments.json")) {
      try {
        const rawJson = JSON.parse(file.content);
        const threads: Record<string, unknown>[] = [];

        if (Array.isArray(rawJson)) {
          rawJson.forEach((t) => {
            if (t && typeof t === "object") threads.push(t as Record<string, unknown>);
          });
        } else if (rawJson && typeof rawJson === "object") {
          const obj = rawJson as Record<string, unknown>;
          if (Array.isArray(obj.threads)) {
            obj.threads.forEach((t) => {
              if (t && typeof t === "object") threads.push(t as Record<string, unknown>);
            });
          } else {
            for (const [docKey, val] of Object.entries(obj)) {
              if (Array.isArray(val)) {
                val.forEach((t) => {
                  if (t && typeof t === "object") {
                    threads.push({ filePath: docKey, ...(t as Record<string, unknown>) });
                  }
                });
              }
            }
          }
        }

        threads.forEach((thread, idx) => {
          const isResolved =
            thread.resolved === true ||
            String(thread.status || "").toLowerCase() === "resolved";
          if (isResolved) return;

          const targetPath = String(
            thread.filePath || thread.path || thread.docPath || file.path
          );
          const threadId = String(thread.id || `${targetPath}-${idx}`);

          const allMessages: string[] = [];
          if (typeof thread.text === "string") allMessages.push(thread.text);
          if (typeof thread.comment === "string") allMessages.push(thread.comment);
          if (typeof thread.body === "string") allMessages.push(thread.body);

          const nestedLists = [thread.comments, thread.replies, thread.messages];
          for (const list of nestedLists) {
            if (Array.isArray(list)) {
              for (const msg of list) {
                if (msg && typeof msg === "object") {
                  const mObj = msg as Record<string, unknown>;
                  const txt = String(mObj.text || mObj.body || mObj.content || "");
                  if (txt) allMessages.push(txt);
                }
              }
            }
          }

          const combinedText = allMessages.join(" ");
          if (mentionRegex && mentionRegex.test(combinedText)) {
            pushNotif({
              id: `inline-mention-${threadId}`,
              kind: "mention",
              title: isEn
                ? `Mentioned in review thread`
                : `Erwähnung in Review-Kommentar`,
              subtitle: `${targetPath} — "${combinedText.slice(0, 72)}${combinedText.length > 72 ? "…" : ""}"`,
              filePath: targetPath,
              severity: "warning",
            });
          } else if (combinedText.trim()) {
            pushNotif({
              id: `inline-open-${threadId}`,
              kind: "review",
              title: isEn ? `Open inline comment` : `Offener Inline-Kommentar`,
              subtitle: `${targetPath} — "${combinedText.slice(0, 68)}${combinedText.length > 68 ? "…" : ""}"`,
              filePath: targetPath,
              severity: "info",
            });
          }
        });
      } catch {
        // Ignore malformed inline-comments.json while user is editing
      }
      continue;
    }

    if (!lowerPath.endsWith(".md")) continue;
    const summary = parseMarkdownSummary(file);

    // 2. Agile Issues (`issues/*.md`)
    if (lowerPath.startsWith("issues/")) {
      const isDone = summary.status === "done" || summary.status === "completed";
      const normalizedAssignee = normalizeHandleForMatch(summary.assignee);

      // Blocked check
      const isBlocked =
        !isDone &&
        (summary.blockedBy.length > 0 ||
          summary.status === "blocked" ||
          summary.labels.some((l) => l.toLowerCase() === "blocked") ||
          /\bBLOCKED\b/.test(summary.body));

      if (isBlocked) {
        const blockerHint =
          summary.blockedBy.length > 0 ? ` (${summary.blockedBy.join(", ")})` : "";
        pushNotif({
          id: `blocked-${file.path}`,
          kind: "blocked",
          title: `BLOCKED: ${summary.id} — ${summary.title}`,
          subtitle: isEn
            ? `Blocked issue requires attention${blockerHint}`
            : `Blockiertes Ticket erfordert Klärung${blockerHint}`,
          filePath: file.path,
          severity: "critical",
        });
      }

      // Assigned to currentUser
      if (!isDone && normalizedAssignee && normalizedAssignee === normalizedUser) {
        pushNotif({
          id: `assigned-${file.path}-${summary.status}`,
          kind: "assigned",
          title: `${summary.id}: ${summary.title}`,
          subtitle: isEn
            ? `Assigned to ${normalizedUser} • Status: ${summary.status || "backlog"}`
            : `Zugewiesen an ${normalizedUser} • Status: ${summary.status || "backlog"}`,
          filePath: file.path,
          severity: summary.priority === "critical" ? "critical" : "info",
        });
      }

      // Issue In Review
      if (summary.status === "review" || summary.status === "in-review") {
        pushNotif({
          id: `issue-review-${file.path}`,
          kind: "review",
          title: isEn
            ? `In Review: ${summary.id} — ${summary.title}`
            : `In Prüfung: ${summary.id} — ${summary.title}`,
          subtitle: isEn
            ? `Ready for peer review / QA sign-off`
            : `Bereit für Code-Review / Abnahme`,
          filePath: file.path,
          severity: "warning",
        });
      }

      // @currentUser mention in description or comments
      if (mentionRegex && mentionRegex.test(summary.body)) {
        pushNotif({
          id: `issue-mention-${file.path}`,
          kind: "mention",
          title: isEn
            ? `${normalizedUser} mentioned in ${summary.id}`
            : `${normalizedUser} erwähnt in ${summary.id}`,
          subtitle: summary.title,
          filePath: file.path,
          severity: "warning",
        });
      }
      continue;
    }

    // 3. Meeting notes (`meetings/*.md`) + legacy sprint backlog mentions
    if (lowerPath.startsWith("meetings/") || lowerPath.startsWith("management/")) {
      if (mentionRegex && mentionRegex.test(file.content)) {
        const matchingLine =
          file.content
            .split(/\r?\n/)
            .find((line) => mentionRegex.test(line) && !/^\s*-\s*\[x\]/i.test(line)) || "";
        if (matchingLine) {
          pushNotif({
            id: `doc-mention-${file.path}-${matchingLine.slice(0, 24)}`,
            kind: "mention",
            title: isEn
              ? `Action / Mention in ${summary.title}`
              : `Aufgabe / Erwähnung in ${summary.title}`,
            subtitle: matchingLine.replace(/^[-*\s[/\]]+/, "").trim().slice(0, 80),
            filePath: file.path,
            severity: "info",
          });
        }
      }
    }

    // 4. Documents in `In Review` lifecycle state (`review_status: in-review` / `review`)
    const isDocInReview =
      summary.reviewStatus === "in-review" ||
      summary.reviewStatus === "in_review" ||
      summary.reviewStatus === "review" ||
      summary.reviewStatus === "in review";

    if (isDocInReview) {
      pushNotif({
        id: `doc-review-${file.path}`,
        kind: "review",
        title: isEn ? `Doc In Review: ${summary.title}` : `Dokument in Prüfung: ${summary.title}`,
        subtitle: file.path,
        filePath: file.path,
        severity: "warning",
      });
    } else if (
      !lowerPath.startsWith("meetings/") &&
      !lowerPath.startsWith("management/") &&
      mentionRegex &&
      mentionRegex.test(summary.body)
    ) {
      pushNotif({
        id: `wiki-mention-${file.path}`,
        kind: "mention",
        title: isEn
          ? `${normalizedUser} mentioned in ${summary.title}`
          : `${normalizedUser} erwähnt in ${summary.title}`,
        subtitle: file.path,
        filePath: file.path,
        severity: "info",
      });
    }
  }

  // Sort critical -> warning -> info
  const weight: Record<WorkspaceNotificationItem["severity"], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  return notifications.sort((a, b) => weight[a.severity] - weight[b.severity]);
}
