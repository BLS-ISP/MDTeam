/**
 * Pure TypeScript, zero-dependency IEEE 802.3 CRC-32 + Stored (method 0) PKZIP builder
 * and XML 1.0 escaping utility for Microsoft Word (.docx / ECMA-376 OpenXML) packages.
 */

export const UTF8_ENCODER = new TextEncoder();

// Precomputed IEEE 802.3 CRC-32 lookup table (polynomial 0xEDB88320)
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Escapes text for safe inclusion inside XML elements and attributes,
 * stripping illegal XML 1.0 control characters.
 */
export function escapeXml(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface ZipEntryInput {
  name: string;
  data: Uint8Array;
}

function getDosDateTime(date = new Date()): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

/**
 * Packs files into a standards-compliant Stored (method 0) PKZIP archive.
 */
export function buildStoredZip(entries: ZipEntryInput[]): Uint8Array {
  const { dosTime, dosDate } = getDosDateTime();

  const prepared = entries.map((entry) => {
    const cleanName = entry.name.replace(/^\/+/, "");
    const nameBytes = UTF8_ENCODER.encode(cleanName);
    const crc = computeCrc32(entry.data);
    return {
      nameBytes,
      data: entry.data,
      crc,
    };
  });

  let localSectionSize = 0;
  let centralDirSize = 0;
  for (const item of prepared) {
    localSectionSize += 30 + item.nameBytes.byteLength + item.data.byteLength;
    centralDirSize += 46 + item.nameBytes.byteLength;
  }

  const totalSize = localSectionSize + centralDirSize + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  const localOffsets: number[] = [];
  let offset = 0;

  // 1. Write Local File Headers + File Payloads
  for (const item of prepared) {
    localOffsets.push(offset);
    const nameLen = item.nameBytes.byteLength;
    const dataLen = item.data.byteLength;

    view.setUint32(offset + 0, 0x04034b50, true); // Local file header signature
    view.setUint16(offset + 4, 20, true); // Version needed to extract (2.0)
    view.setUint16(offset + 6, 0x0800, true); // General purpose bit flag (UTF-8 filenames)
    view.setUint16(offset + 8, 0, true); // Compression method: 0 (Stored)
    view.setUint16(offset + 10, dosTime, true);
    view.setUint16(offset + 12, dosDate, true);
    view.setUint32(offset + 14, item.crc, true);
    view.setUint32(offset + 18, dataLen, true); // Compressed size
    view.setUint32(offset + 22, dataLen, true); // Uncompressed size
    view.setUint16(offset + 26, nameLen, true);
    view.setUint16(offset + 28, 0, true); // Extra field length
    offset += 30;

    out.set(item.nameBytes, offset);
    offset += nameLen;

    out.set(item.data, offset);
    offset += dataLen;
  }

  const centralDirOffset = offset;

  // 2. Write Central Directory Headers
  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i];
    const nameLen = item.nameBytes.byteLength;
    const dataLen = item.data.byteLength;

    view.setUint32(offset + 0, 0x02014b50, true); // Central file header signature
    view.setUint16(offset + 4, 20, true); // Version made by
    view.setUint16(offset + 6, 20, true); // Version needed to extract
    view.setUint16(offset + 8, 0x0800, true); // UTF-8 flag
    view.setUint16(offset + 10, 0, true); // Stored
    view.setUint16(offset + 12, dosTime, true);
    view.setUint16(offset + 14, dosDate, true);
    view.setUint32(offset + 16, item.crc, true);
    view.setUint32(offset + 20, dataLen, true);
    view.setUint32(offset + 24, dataLen, true);
    view.setUint16(offset + 28, nameLen, true);
    view.setUint16(offset + 30, 0, true); // Extra field length
    view.setUint16(offset + 32, 0, true); // File comment length
    view.setUint16(offset + 34, 0, true); // Disk number start
    view.setUint16(offset + 36, 0, true); // Internal file attributes
    view.setUint32(offset + 38, 0, true); // External file attributes
    view.setUint32(offset + 42, localOffsets[i], true); // Local header offset
    offset += 46;

    out.set(item.nameBytes, offset);
    offset += nameLen;
  }

  // 3. Write End of Central Directory Record (EOCD)
  view.setUint32(offset + 0, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true); // Disk number
  view.setUint16(offset + 6, 0, true); // Disk with central dir
  view.setUint16(offset + 8, prepared.length, true); // Entries on disk
  view.setUint16(offset + 10, prepared.length, true); // Total entries
  view.setUint32(offset + 12, centralDirSize, true); // Central dir byte size
  view.setUint32(offset + 16, centralDirOffset, true); // Central dir start offset
  view.setUint16(offset + 20, 0, true); // Comment length

  return out;
}
