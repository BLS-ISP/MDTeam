import React from "react";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { Diagnostic } from "../utils/linter";

interface ProblemsPanelProps {
  diagnostics: Diagnostic[];
  onSelectProblem: (filePath: string, line: number) => void;
  onClose: () => void;
  language?: "de" | "en";
}

export default function ProblemsPanel({ diagnostics, onSelectProblem, onClose, language = "de" }: ProblemsPanelProps) {
  const errors = diagnostics.filter(d => d.severity === "error");
  const warnings = diagnostics.filter(d => d.severity === "warning");
  const infos = diagnostics.filter(d => d.severity === "info");
  const isEn = language === "en";

  return (
    <div 
      style={{ 
        borderTop: '1px solid var(--border-color)', 
        backgroundColor: 'var(--bg-sidebar)', 
        color: 'var(--text-secondary)',
        height: '240px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
        fontSize: '13px'
      }}
    >
      {/* Panel Tab Header */}
      <div 
        style={{ 
          height: '36px', 
          backgroundColor: 'var(--bg-panel)', 
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          justifyContent: 'space-between',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', gap: '16px', fontWeight: 600 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
            {isEn ? "Problems" : "Probleme"}
            <span 
              style={{ 
                fontSize: '10px', 
                backgroundColor: diagnostics.length > 0 ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.1)', 
                color: '#ffffff',
                padding: '1px 6px',
                borderRadius: '10px'
              }}
            >
              {diagnostics.length}
            </span>
          </span>

          {errors.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-red)', fontSize: '12px' }}>
              <AlertCircle size={12} /> {errors.length} {isEn ? "Errors" : "Errors"}
            </span>
          )}

          {warnings.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-yellow)', fontSize: '12px' }}>
              <AlertTriangle size={12} /> {warnings.length} {isEn ? "Warnings" : "Warnings"}
            </span>
          )}

          {infos.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-blue)', fontSize: '12px' }}>
              <Info size={12} /> {infos.length} {isEn ? "Infos" : "Infos"}
            </span>
          )}
        </div>

        <button 
          onClick={onClose}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-muted)', 
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '4px'
          }}
          className="action-icon-btn"
          title={isEn ? "Close Panel" : "Panel schließen"}
        >
          <X size={14} />
        </button>
      </div>

      {/* Problems List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {diagnostics.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '13px' }}>
            {isEn ? "No problems found in the workspace. Good job!" : "Keine Probleme im Workspace gefunden. Gute Arbeit!"}
          </div>
        ) : (
          diagnostics.map((problem, idx) => {
            const isError = problem.severity === "error";
            const isWarning = problem.severity === "warning";
            const iconColor = isError ? 'var(--accent-red)' : isWarning ? 'var(--accent-yellow)' : 'var(--accent-blue)';
            const IconComponent = isError ? AlertCircle : isWarning ? AlertTriangle : Info;

            return (
              <div 
                key={idx}
                onClick={() => onSelectProblem(problem.filePath, problem.line)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '6px 20px', 
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                  transition: 'background-color 0.15s ease'
                }}
                className="problem-item"
              >
                <span style={{ color: iconColor, display: 'flex', alignItems: 'center' }}>
                  <IconComponent size={14} />
                </span>

                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', width: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {problem.filePath}:{problem.line}
                </span>

                <span style={{ flex: 1, color: 'var(--text-secondary)' }}>
                  {problem.message}
                </span>

                <span 
                  style={{ 
                    fontSize: '10px', 
                    padding: '2px 6px', 
                    backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                    borderRadius: '4px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)'
                  }}
                >
                  {problem.code || "LINT"}
                </span>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .problem-item:hover {
          background-color: rgba(99, 102, 241, 0.05);
        }
      `}</style>
    </div>
  );
}
