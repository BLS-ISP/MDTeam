import React from "react";
import { DiffEditor } from "@monaco-editor/react";
import { X, GitBranch } from "lucide-react";

interface DiffViewerProps {
  originalContent: string;
  modifiedContent: string;
  fileName: string;
  onClose: () => void;
  language?: "de" | "en";
}

export default function DiffViewer({ originalContent, modifiedContent, fileName, onClose, language = "de" }: DiffViewerProps) {
  const isEn = language === "en";

  return (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)'
      }}
    >
      <div 
        style={{ 
          width: '90vw', 
          height: '85vh', 
          backgroundColor: 'var(--bg-editor)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Header */}
        <div 
          style={{ 
            height: '48px', 
            backgroundColor: 'var(--bg-panel)', 
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600 }}>
            <GitBranch size={16} style={{ color: 'var(--accent-indigo)' }} />
            <span>Git Diff - {fileName}</span>
            <span style={{ fontSize: '10px', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: 'var(--accent-yellow)', padding: '2px 8px', borderRadius: '4px', marginLeft: '8px' }}>
              {isEn ? "Local Changes" : "Lokale Änderungen"}
            </span>
          </div>

          <button 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-muted)', 
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
            className="action-icon-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Labels bar */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            backgroundColor: 'var(--bg-sidebar)',
            borderBottom: '1px solid var(--border-color)',
            padding: '4px 20px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          <div>{isEn ? "Last Commit (Original)" : "Letzter Commit (Original)"}</div>
          <div style={{ paddingLeft: '16px' }}>{isEn ? "Working Copy (Modified)" : "Arbeitskopie (Modifiziert)"}</div>
        </div>

        {/* Monaco DiffEditor */}
        <div style={{ flex: 1, position: 'relative' }}>
          <DiffEditor
            original={originalContent}
            modified={modifiedContent}
            language="markdown"
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              automaticLayout: true,
              renderSideBySide: true,
              originalEditable: false,
              ignoreTrimWhitespace: false
            }}
          />
        </div>
      </div>
    </div>
  );
}
