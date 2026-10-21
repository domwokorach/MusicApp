/**
 * Artwork URL helpers: validation, https enforcement and size selection.
 * Every provider mapper runs image fields through `normalizeArtworkUrl`, so the UI only ever sees a usable
 * https URL or `undefined` (which renders the neutral placeholder).
 */

const BAD = new Set(['', 'null', 'undefined', 'none', 'n/a']);

export function normalizeArtworkUrl(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const raw = input.trim();
  if (BAD.has(raw.toLowerCase())) return undefined;
  try {
    const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
    if (url.protocol === 'http:') url.protocol = 'https:'; // all supported image CDNs serve https
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export const isValidArtworkUrl = (input: unknown): input is string => normalizeArtworkUrl(input) !== undefined;

const JAMENDO_BUCKETS = [100, 200, 300, 400, 600];

/** Ask Jamendo's image service for a size close to what's displayed (it resizes via `width`). */
export function sizedArtworkUrl(url: string, displayPx: number, scale = 2): string {
  try {
    const u = new URL(url);
    if (u.hostname === 'usercontent.jamendo.com' && u.searchParams.has('type')) {
      const want = displayPx * scale;
      u.searchParams.set('width', String(JAMENDO_BUCKETS.find((b) => b >= want) ?? 600));
      return u.toString();
    }
  } catch {
    // fall through
  }
  return url;
}

/** Spotify returns images sorted large -> small (640, 300, 64). Pick the smallest one that is still >= target. */
export function pickSpotifyImage(images: unknown, targetPx = 300): string | undefined {
  if (!Array.isArray(images)) return undefined;
  const list = images
    .map((i) => (typeof i === 'object' && i !== null ? (i as { url?: unknown; width?: unknown }) : {}))
    .map((i) => ({ url: normalizeArtworkUrl(i.url), width: typeof i.width === 'number' ? i.width : undefined }))
    .filter((i): i is { url: string; width: number | undefined } => !!i.url);
  if (list.length === 0) return undefined;
  const sized = list.filter((i) => i.width !== undefined).sort((a, b) => (a.width as number) - (b.width as number));
  return (sized.find((i) => (i.width as number) >= targetPx) ?? sized[sized.length - 1] ?? list[0]).url;
}

const logged = new Set<string>();
/** Log each failing artwork URL once, so broken images are identifiable without flooding the console. */
export function logArtworkFailure(url: string, reason?: string) {
  if (logged.has(url)) return;
  logged.add(url);
  console.warn(`[artwork] failed to load ${url}${reason ? ` (${reason})` : ''}`);
}
