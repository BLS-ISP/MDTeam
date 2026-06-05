import React, { useState, useEffect } from "react";
import { Search, FileText, ChevronDown, ChevronRight, CaseSensitive, Regex } from "lucide-react";

interface WorkspaceFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

interface SearchMatch {
  lineNum: number;
  content: string;
  matchStart: number;
  matchLength: number;
}

interface FileSearchMatches {
  file: WorkspaceFile;
  matches: SearchMatch[];
}

interface GlobalSearchProps {
  files: WorkspaceFile[];
  onSelectResult: (filePath: string, line: number) => void;
  language?: "de" | "en";
}

export default function GlobalSearch({ files, onSelectResult, language = "de" }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [results, setResults] = useState<FileSearchMatches[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<{ [path: string]: boolean }>({});
  const isEn = language === "en";

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchResults: FileSearchMatches[] = [];
    const initialExpanded: { [path: string]: boolean } = {};

    files.forEach(file => {
      const fileMatches: SearchMatch[] = [];
      const lines = file.content.split("\n");

      lines.forEach((line, index) => {
        const lineNum = index + 1;
        let matchIndex = -1;
        let matchLength = query.length;

        if (isRegex) {
          try {
            const flags = isCaseSensitive ? "g" : "gi";
            const regex = new RegExp(query, flags);
            const match = regex.exec(line);
            if (match) {
              matchIndex = match.index;
              matchLength = match[0].length;
            }
          } catch (e) {
            // Invalid regex, ignore
          }
        } else {
          const searchLine = isCaseSensitive ? line : line.toLowerCase();
          const searchQuery = isCaseSensitive ? query : query.toLowerCase();
          matchIndex = searchLine.indexOf(searchQuery);
        }

        if (matchIndex !== -1) {
          fileMatches.push({
            lineNum,
            content: line.trim(),
            matchStart: matchIndex,
            matchLength
          });
        }
      });

      if (fileMatches.length > 0) {
        searchResults.push({
          file,
          matches: fileMatches
        });
        initialExpanded[file.path] = true; // Auto-expand found files
      }
    });

    setResults(searchResults);
    setExpandedFiles(initialExpanded);
  }, [query, isCaseSensitive, isRegex, files]);

  const toggleExpand = (filePath: string) => {
    setExpandedFiles(prev => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  const totalMatches = results.reduce((acc, r) => acc + r.matches.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "var(--font-sans)", color: "var(--text-secondary)" }}>
      <div className="panel-header" style={{ borderBottom: "1px solid var(--border-color)", padding: "10px 16px", fontSize: "12px", fontWeight: 600 }}>
        {isEn ? "Workspace Search" : "Workspace-weite Suche"}
      </div>

      {/* Input section */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px", borderBottom: "1px solid var(--border-color)" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <input
            type="text"
            className="settings-input"
            style={{ paddingLeft: "30px", paddingRight: "70px", width: "100%" }}
            placeholder={isEn ? "Search..." : "Suchen..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Search size={14} style={{ position: "absolute", left: "10px", color: "var(--text-muted)" }} />
          
          <div style={{ position: "absolute", right: "8px", display: "flex", gap: "4px" }}>
            <button
              onClick={() => setIsCaseSensitive(!isCaseSensitive)}
              className={`search-toggle-btn ${isCaseSensitive ? "active" : ""}`}
              title={isEn ? "Match Case" : "Groß-/Kleinschreibung beachten (Match Case)"}
            >
              <CaseSensitive size={14} />
            </button>
            <button
              onClick={() => setIsRegex(!isRegex)}
              className={`search-toggle-btn ${isRegex ? "active" : ""}`}
              title={isEn ? "Use Regular Expression" : "Regulärer Ausdruck (Use Regular Expression)"}
            >
              <Regex size={14} />
            </button>
          </div>
        </div>

        {query.trim() && (
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {isEn 
              ? `${totalMatches} result${totalMatches === 1 ? "" : "s"} in ${results.length} file${results.length === 1 ? "" : "s"}` 
              : `${totalMatches} Treffer in ${results.length} Dateien`}
          </div>
        )}
      </div>

      {/* Results view */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {results.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100px", color: "var(--text-muted)", fontSize: "12px", textAlign: "center", padding: "0 20px" }}>
            {query.trim() 
              ? (isEn ? "No results found." : "Keine Ergebnisse gefunden.") 
              : (isEn ? "Type search query above." : "Suchbegriff oben eingeben.")}
          </div>
        ) : (
          results.map(({ file, matches }) => {
            const isExpanded = expandedFiles[file.path];
            return (
              <div key={file.path} style={{ marginBottom: "8px" }}>
                {/* Collapsible File Header */}
                <div
                  onClick={() => toggleExpand(file.path)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 12px",
                    cursor: "pointer",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-primary)"
                  }}
                  className="search-file-header"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <FileText size={13} style={{ color: "var(--accent-indigo)" }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.path}>
                    {file.name}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "auto", backgroundColor: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: "10px" }}>
                    {matches.length}
                  </span>
                </div>

                {/* File Matches list */}
                {isExpanded && (
                  <div style={{ paddingLeft: "24px", marginTop: "2px" }}>
                    {matches.map((match, mIdx) => (
                      <div
                        key={mIdx}
                        onClick={() => onSelectResult(file.path, match.lineNum)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                          padding: "4px 8px",
                          cursor: "pointer",
                          fontSize: "12px",
                          borderRadius: "4px",
                          transition: "background-color 0.1s"
                        }}
                        className="search-match-item"
                      >
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-indigo)", fontSize: "11px", width: "24px", textAlign: "right" }}>
                          {match.lineNum}
                        </span>
                        <span 
                          style={{ 
                            fontFamily: "var(--font-mono)", 
                            whiteSpace: "pre-wrap", 
                            color: "var(--text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {match.content}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .search-toggle-btn {
          background: none;
          border: 1px solid transparent;
          color: var(--text-muted);
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .search-toggle-btn:hover {
          background-color: rgba(255,255,255,0.05);
          color: var(--text-primary);
        }
        .search-toggle-btn.active {
          background-color: var(--accent-indigo);
          color: #ffffff;
        }
        .search-file-header:hover {
          background-color: rgba(255,255,255,0.05) !important;
        }
        .search-match-item:hover {
          background-color: rgba(99, 102, 241, 0.08);
        }
      `}</style>
    </div>
  );
}
