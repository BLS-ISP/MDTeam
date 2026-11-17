/**
 * Microsoft Word (.docx / ECMA-376 OpenXML) exporter barrel re-export.
 */
export { computeCrc32, escapeXml } from "./docx/zipBuilder";
export { generateDocxBytes } from "./docx/ooxmlBlockConverter";
export { exportDocumentToDocx } from "./docx/docxSaveDialog";
