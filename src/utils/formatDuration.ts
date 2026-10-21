/** 83 -> "1:23" */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 2700 -> "45 min", 3900 -> "1 hr 5 min" (podcast episodes). */
export function formatMinutes(seconds: number): string {
  const total = Math.round(seconds / 60);
  if (!Number.isFinite(total) || total <= 0) return '';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} hr${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** "2025-03-14" -> "Mar 14, 2025" (empty string for missing / invalid dates). */
export function formatReleaseDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
