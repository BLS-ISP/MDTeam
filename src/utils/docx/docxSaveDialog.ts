import { generateDocxBytes } from "./ooxmlBlockConverter";

function normalizeDocxFileName(fileName: string): string {
  const base = fileName
    .trim()
    .replace(/\.md$/i, "")
    .replace(/\.docx$/i, "")
    .replace(/[<>:"/\\|?*]+/g, "_");
  return `${base || "document"}.docx`;
}

/**
 * Exports Markdown content to a real .docx file:
 * - In Tauri mode (`isTauri === true`), opens `@tauri-apps/plugin-dialog` `save`
 *   and writes binary bytes via `@tauri-apps/plugin-fs` `writeFile`.
 * - In browser mode, triggers a native `Blob` download.
 */
export async function exportDocumentToDocx(
  fileName: string,
  title: string,
  markdown: string,
  isTauri: boolean
): Promise<boolean> {
  const safeFileName = normalizeDocxFileName(fileName);
  const bytes = generateDocxBytes(title, markdown);

  if (isTauri) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");

      const targetPath = await save({
        defaultPath: safeFileName,
        filters: [
          {
            name: "Microsoft Word Document (.docx)",
            extensions: ["docx"],
          },
        ],
      });

      if (!targetPath) {
        return false;
      }

      await writeFile(targetPath, bytes);
      return true;
    } catch (err) {
      console.error("Tauri DOCX save failed, falling back to browser download:", err);
    }
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const blobBuffer = new Uint8Array(bytes.byteLength);
  blobBuffer.set(bytes);
  const blob = new Blob([blobBuffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return true;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}
