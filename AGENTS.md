<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Modularity & File Size Rule

- Every source file in `src/` and `src-tauri/src/` must maintain a single, clear responsibility and stay strictly `<= 500` lines (target `<= 450` lines).
- Proactively split large components, custom hooks, state/context modules, parsers/exporters, and stylesheet domains into focused sub-modules before approaching 500 lines.
- Preserve clean public module boundaries using thin barrel re-exports when decomposing existing APIs so downstream consumers remain unaffected.
