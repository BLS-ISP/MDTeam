export const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDateMs(dateStr?: string): number | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const isoDay = trimmed.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) {
    const [y, m, d] = isoDay.split("-").map(Number);
    const ms = Date.UTC(y, m - 1, d);
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatUtcDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatShortDayLabel(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day}.${m}`;
}
