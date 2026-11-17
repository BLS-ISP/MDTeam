"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Database,
  Filter,
  LayoutGrid,
  Search,
  Sparkles,
  Table as TableIcon,
} from "lucide-react";
import type {
  LiveQueryBlockProps,
  QueryViewMode,
} from "../../utils/query/queryTypes";
import { defaultSortDirectionForField } from "../../utils/query/queryParser";
import {
  executeQueryMacro,
  sortQueryRecords,
} from "../../utils/query/queryExecutor";
import { LiveQueryTableView } from "./LiveQueryTableView";
import {
  LiveQueryCardsView,
  LiveQueryStatsView,
} from "./LiveQueryCardsAndStats";

export function LiveQueryBlock({
  queryText,
  files,
  onOpenFile,
  language = "de",
}: LiveQueryBlockProps): React.ReactElement {
  const isEn = language === "en";
  const baseExecution = useMemo(
    () => executeQueryMacro(queryText, files),
    [queryText, files]
  );

  const [viewOverride, setViewOverride] = useState<QueryViewMode | null>(null);
  const [sortOverride, setSortOverride] = useState<{
    field: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>("");

  const activeView = viewOverride ?? baseExecution.parsed.view;
  const activeSortField = sortOverride?.field ?? baseExecution.parsed.sortField;
  const activeSortDir =
    sortOverride?.direction ?? baseExecution.parsed.sortDirection;

  const displayedRecords = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    const filtered = q
      ? baseExecution.records.filter(
          (r) =>
            r.id.toLowerCase().includes(q) ||
            r.title.toLowerCase().includes(q) ||
            r.status.toLowerCase().includes(q) ||
            r.assignee.toLowerCase().includes(q) ||
            r.epic.toLowerCase().includes(q) ||
            r.milestone.toLowerCase().includes(q) ||
            r.labels.some((l) => l.toLowerCase().includes(q))
        )
      : baseExecution.records;

    return sortQueryRecords(filtered, activeSortField, activeSortDir);
  }, [baseExecution.records, searchFilter, activeSortField, activeSortDir]);

  const showPointsColumn =
    baseExecution.parsed.source === "issues" ||
    baseExecution.summary.totalPoints > 0;
  const showPriorityColumn =
    baseExecution.parsed.source === "issues" ||
    baseExecution.parsed.source === "roadmap";

  const handleToggleSort = (field: string) => {
    if (activeSortField === field) {
      setSortOverride({
        field,
        direction: activeSortDir === "asc" ? "desc" : "asc",
      });
    } else {
      setSortOverride({
        field,
        direction: defaultSortDirectionForField(field),
      });
    }
  };

  const viewBtn = (
    mode: QueryViewMode,
    label: string,
    IconComp: React.ElementType
  ) => {
    const active = activeView === mode;
    return (
      <button
        type="button"
        onClick={() => setViewOverride(mode)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 8px",
          borderRadius: "5px",
          fontSize: "11px",
          fontWeight: 600,
          cursor: "pointer",
          border: active
            ? "1px solid rgba(99, 102, 241, 0.5)"
            : "1px solid transparent",
          backgroundColor: active
            ? "rgba(99, 102, 241, 0.18)"
            : "transparent",
          color: active ? "#c7d2fe" : "var(--text-muted)",
        }}
      >
        <IconComp size={12} />
        {label}
      </button>
    );
  };

  return (
    <div
      style={{
        margin: "16px 0",
        border: "1px solid var(--border-color)",
        borderRadius: "10px",
        backgroundColor: "var(--bg-editor)",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Top Macro Header Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "10px 14px",
          backgroundColor: "var(--bg-sidebar)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "2px 8px",
              borderRadius: "4px",
              backgroundColor: "rgba(99, 102, 241, 0.16)",
              color: "#a5b4fc",
              fontSize: "10.5px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            <Database size={11} />
            {isEn ? "Live Query" : "Live-Abfrage"}
          </span>
          <span
            style={{
              fontSize: "11.5px",
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
              fontWeight: 600,
            }}
          >
            {`FROM ${baseExecution.parsed.source.toUpperCase()}`}
          </span>
          {baseExecution.parsed.conditions.map((c, idx) => (
            <span
              key={`${c.field}-${idx}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                padding: "1px 6px",
                borderRadius: "4px",
                backgroundColor: "var(--bg-panel)",
                border: "1px solid var(--border-color)",
                fontSize: "10.5px",
                fontFamily: "var(--font-mono)",
                color: "var(--text-secondary)",
              }}
            >
              <Filter size={9} />
              {`${c.field} ${c.operator} ${c.value}`}
            </span>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 8px",
              borderRadius: "5px",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
            }}
          >
            <Search size={11} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={isEn ? "Filter rows..." : "Zeilen filtern..."}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: "11px",
                width: "105px",
              }}
            />
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
              padding: "2px",
              borderRadius: "6px",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
            }}
          >
            {viewBtn("table", isEn ? "Table" : "Tabelle", TableIcon)}
            {viewBtn("cards", isEn ? "Cards" : "Karten", LayoutGrid)}
            {viewBtn("stats", isEn ? "Stats" : "Statistik", BarChart3)}
          </div>
        </div>
      </div>

      {/* Parse warning if any */}
      {baseExecution.parsed.parseError && (
        <div
          style={{
            padding: "8px 14px",
            backgroundColor: "rgba(245, 158, 11, 0.1)",
            borderBottom: "1px solid var(--border-color)",
            color: "var(--accent-yellow)",
            fontSize: "11.5px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <AlertCircle size={13} />
          {baseExecution.parsed.parseError}
        </div>
      )}

      {/* Body content */}
      {displayedRecords.length === 0 ? (
        <div
          style={{
            padding: "24px 16px",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "12.5px",
          }}
        >
          {isEn
            ? "No workspace documents or issues match this query."
            : "Keine Dokumente oder Tickets entsprechen dieser Abfrage."}
        </div>
      ) : activeView === "cards" ? (
        <LiveQueryCardsView
          records={displayedRecords}
          isEn={isEn}
          showPriorityColumn={showPriorityColumn}
          onOpenFile={onOpenFile}
        />
      ) : activeView === "stats" ? (
        <LiveQueryStatsView
          records={displayedRecords}
          summary={baseExecution.summary}
          isEn={isEn}
        />
      ) : (
        <LiveQueryTableView
          records={displayedRecords}
          isEn={isEn}
          activeSortField={activeSortField}
          activeSortDir={activeSortDir}
          showPriorityColumn={showPriorityColumn}
          showPointsColumn={showPointsColumn}
          onToggleSort={handleToggleSort}
          onOpenFile={onOpenFile}
        />
      )}

      {/* Footer Progress & Totals Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "8px 14px",
          backgroundColor: "var(--bg-panel)",
          borderTop: "1px solid var(--border-color)",
          fontSize: "11.5px",
          color: "var(--text-secondary)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
          >
            <Sparkles size={12} style={{ color: "var(--accent-indigo)" }} />
            {`${displayedRecords.length} ${isEn ? "items" : "Einträge"}`}
          </span>
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            <CheckCircle2 size={12} style={{ color: "var(--accent-green)" }} />
            {`${baseExecution.summary.doneCount}/${baseExecution.summary.totalCount} ${
              isEn ? "done" : "erledigt"
            }`}
          </span>
          {showPointsColumn && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                color: "#a5b4fc",
              }}
            >
              {`${baseExecution.summary.completedPoints} / ${baseExecution.summary.totalPoints} SP`}
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: "160px",
          }}
        >
          <div
            style={{
              flex: 1,
              height: "6px",
              borderRadius: "999px",
              backgroundColor: "var(--bg-active)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${baseExecution.summary.completionPct}%`,
                height: "100%",
                background:
                  "linear-gradient(90deg, var(--accent-indigo), var(--accent-green))",
                borderRadius: "999px",
                transition: "width 0.25s ease",
              }}
            />
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {`${baseExecution.summary.completionPct}%`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default LiveQueryBlock;
