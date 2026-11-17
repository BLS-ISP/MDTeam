function inferImageExtension(mimeType: string, rawName: string): string {
  const existingMatch = rawName.match(/\.(png|jpe?g|gif|webp|svg|bmp)$/i);
  if (existingMatch) return existingMatch[1].toLowerCase();
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/svg+xml") return "svg";
  return "png";
}

function sanitizeImageFileName(blob: File): string {
  const ext = inferImageExtension(blob.type, blob.name || "");
  const baseRaw = (blob.name || "screenshot")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `${baseRaw || "screenshot"}.${ext}`;
}

async function compressImageToDataUrl(blob: File): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "";
  }

  // SVG or tiny files (< 35 KB): read directly as Data-URL without lossy rasterization
  if (blob.type === "image/svg+xml" || blob.size < 35_000) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = (err) => reject(err);
      el.src = objectUrl;
    });

    const maxDim = 1280;
    let width = img.naturalWidth || img.width || 800;
    let height = img.naturalHeight || img.height || 600;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context unavailable");
    }
    ctx.drawImage(img, 0, 0, width, height);

    const webpUrl = canvas.toDataURL("image/webp", 0.82);
    if (webpUrl.startsWith("data:image/webp")) {
      return webpUrl;
    }
    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * 5. handlePasteOrDropImage
 * Handles Ctrl+V clipboard screenshots or dropped image files:
 * - In Tauri (`isTauri && tauriRootFolder`): writes binary file to `${tauriRootFolder}/assets/<timestamp>-<safeName>`
 *   via `@tauri-apps/plugin-fs` (`mkdir` + `writeFile`) and returns `{ markdown: "![screenshot](assets/...)" }`.
 * - In Browser mode: compresses onto an offscreen canvas and returns `{ markdown: "![screenshot](data:image/...)" }`.
 */
export async function handlePasteOrDropImage(
  blob: File,
  isTauri: boolean,
  tauriRootFolder: string
): Promise<{ markdown: string } | null> {
  if (!blob) return null;

  const isImage =
    blob.type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(blob.name || "");
  if (!isImage) {
    return null;
  }

  const safeName = sanitizeImageFileName(blob);
  const stampedName = `${Date.now()}-${safeName}`;

  if (isTauri && tauriRootFolder.trim()) {
    try {
      const { mkdir, writeFile } = await import("@tauri-apps/plugin-fs");
      const cleanRoot = tauriRootFolder.trim().replace(/[\\/]+$/, "");
      const assetsDir = `${cleanRoot}/assets`;
      await mkdir(assetsDir, { recursive: true });

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const fullPath = `${assetsDir}/${stampedName}`;
      await writeFile(fullPath, bytes);

      return {
        markdown: `![screenshot](assets/${stampedName})`,
      };
    } catch (err) {
      console.warn(
        "Tauri asset write failed, falling back to compressed Data-URL:",
        err
      );
    }
  }

  try {
    const dataUrl = await compressImageToDataUrl(blob);
    if (!dataUrl) return null;
    return {
      markdown: `![screenshot](${dataUrl})`,
    };
  } catch (err) {
    console.error("Failed to process pasted/dropped image:", err);
    return null;
  }
}
