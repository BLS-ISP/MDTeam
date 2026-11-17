#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_LINES = 500;
const EXTENSIONS = new Set([".ts", ".tsx", ".css", ".rs"]);
const IGNORE_DIRS = new Set(["node_modules", ".next", "dist", "target", "out"]);
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["src", "server/src", "src-tauri/src"];

function countLines(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (raw.length === 0) return 0;
  return raw.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

function walkDir(dirPath, collected) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, collected);
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      collected.push({
        relPath: path.relative(ROOT_DIR, fullPath).replace(/\\/g, "/"),
        lines: countLines(fullPath),
      });
    }
  }
}

const allFiles = [];
for (const rel of SCAN_DIRS) {
  walkDir(path.join(ROOT_DIR, rel), allFiles);
}

allFiles.sort((a, b) => b.lines - a.lines || a.relPath.localeCompare(b.relPath));

const top10 = allFiles.slice(0, 10);
const violations = allFiles.filter((f) => f.lines > MAX_LINES);

console.log(`\nMDTeam Modularity Gate — Scanned ${allFiles.length} source files (limit <= ${MAX_LINES} lines)`);
console.log("-".repeat(86));
console.log(`${"Rank".padEnd(6)} ${"Lines".padStart(6)} ${"Limit".padStart(7)}  ${"Status".padEnd(8)} File`);
console.log("-".repeat(86));

top10.forEach((item, idx) => {
  const rank = `#${idx + 1}`.padEnd(6);
  const lines = String(item.lines).padStart(6);
  const limit = String(MAX_LINES).padStart(7);
  const status = (item.lines > MAX_LINES ? "FAIL" : "OK").padEnd(8);
  console.log(`${rank} ${lines} ${limit}  ${status} ${item.relPath}`);
});
console.log("-".repeat(86));

if (violations.length > 0) {
  console.error(`\nModularity gate FAILED: ${violations.length} file(s) exceed ${MAX_LINES} lines:`);
  for (const v of violations) {
    console.error(`  - ${v.relPath} (${v.lines} lines > ${MAX_LINES})`);
  }
  process.exit(1);
}

console.log(`Modularity gate PASSED: all ${allFiles.length} files are <= ${MAX_LINES} lines.\n`);
