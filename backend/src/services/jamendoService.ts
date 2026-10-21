import { z } from 'zod';

import { config } from '../config';
import type { ApiAlbum, ApiArtist, ApiMix, ApiPlaylist, ApiTrack, Page } from '../types';

/**
 * Jamendo API v3.0 client (https://developer.jamendo.com/v3.0).
 * Catalogue reads authenticate with the client_id only; the secret is not used here.
 */

export class UpstreamError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

const envelope = z.object({
  headers: z.object({ status: z.string(), code: z.number().optional(), error_message: z.string().optional(), results_count: z.number().optional() }),
  results: z.array(z.unknown()),
});

const str = z.string().optional().nullable();
const jmTrack = z.object({
  id: z.coerce.string(),
  name: z.string(),
  duration: z.coerce.number().optional(),
  artist_id: z.coerce.string().optional(),
  artist_name: str,
  album_id: z.coerce.string().optional(),
  album_name: str,
  album_image: str,
  image: str,
  audio: str,
  license_ccurl: str,
  shareurl: str,
  musicinfo: z.object({ tags: z.object({ genres: z.array(z.string()).optional() }).optional() }).optional(),
});
const jmAlbum = z.object({ id: z.coerce.string(), name: z.string(), releasedate: str, artist_id: z.coerce.string().optional(), artist_name: str, image: str });
const jmArtist = z.object({ id: z.coerce.string(), name: z.string(), image: str });
const jmAlbumTracks = z.object({
  id: z.coerce.string(),
  tracks: z.array(z.object({ id: z.coerce.string(), name: z.string(), duration: z.coerce.number().optional(), audio: str, license_ccurl: str })).optional(),
});

type Query = Record<string, string | number | undefined>;

// Tiny TTL cache: protects the Jamendo rate limit and speeds up repeated browsing.
const cache = new Map<string, { at: number; value: unknown }>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Jamendo's list endpoints are intermittently flaky: the *same* request sometimes returns zero results
 * (roughly 20-50% of tracks queries in testing, for both search and browse orderings). We therefore retry
 * empty answers a few times and never cache them. Genuinely empty results cost ~0.5s extra.
 */
const EMPTY_RETRIES = 4;

async function call(path: string, query: Query): Promise<z.infer<typeof envelope>> {
  for (let attempt = 0; ; attempt++) {
    const body = await callOnce(path, query, false);
    if (body.results.length > 0) {
      remember(path, query, body);
      return body;
    }
    if (attempt >= EMPTY_RETRIES) return body;
    await sleep(120);
  }
}

function urlFor(path: string, query: Query): string {
  const params = new URLSearchParams({ client_id: config.jamendoClientId, format: 'json' });
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, String(v));
  return `${config.jamendoBaseUrl}${path}?${params}`;
}

function remember(path: string, query: Query, body: z.infer<typeof envelope>) {
  cache.set(urlFor(path, query), { at: Date.now(), value: body });
}

async function callOnce(path: string, query: Query, cacheable: boolean): Promise<z.infer<typeof envelope>> {
  const url = urlFor(path, query);

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < config.cacheTtlMs) return hit.value as z.infer<typeof envelope>;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(config.upstreamTimeoutMs), headers: { Accept: 'application/json' } });
  } catch {
    throw new UpstreamError('Jamendo is unreachable right now.', 504);
  }
  if (res.status === 429) throw new UpstreamError('Jamendo rate limit reached. Try again shortly.', 429);
  if (!res.ok) throw new UpstreamError(`Jamendo responded with HTTP ${res.status}.`);

  const parsed = envelope.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new UpstreamError('Jamendo returned an unexpected response.');
  if (parsed.data.headers.status !== 'success') {
    // Never forward upstream error text verbatim: it can mention credentials.
    console.error('[jamendo] upstream error', parsed.data.headers.code, parsed.data.headers.error_message);
    throw new UpstreamError('Jamendo rejected the request.');
  }
  if (cacheable) cache.set(url, { at: Date.now(), value: parsed.data });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return parsed.data;
}

/** Parse each result, silently dropping malformed ones instead of failing the whole page. */
function parseAll<T>(schema: z.ZodType<T>, results: unknown[]): T[] {
  return results.flatMap((r) => {
    const p = schema.safeParse(r);
    return p.success ? [p.data] : [];
  });
}

/** Jamendo returns some text HTML-escaped (e.g. &quot;). The app renders plain text, so decode it. */
const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
export const decode = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const page = <T>(items: T[], offset: number, limit: number, count?: number): Page<T> => ({ items, offset, hasMore: (count ?? items.length) >= limit });

const mapTrack = (t: z.infer<typeof jmTrack>): ApiTrack => ({
  id: t.id,
  title: decode(t.name),
  artistId: t.artist_id,
  artistName: decode(t.artist_name || 'Unknown artist'),
  albumId: t.album_id || undefined,
  albumName: t.album_name ? decode(t.album_name) : undefined,
  genre: t.musicinfo?.tags?.genres?.[0],
  durationSec: t.duration,
  audioUrl: t.audio || undefined,
  artworkUrl: t.image || t.album_image || undefined,
  licenseUrl: t.license_ccurl || undefined,
  shareUrl: t.shareurl || undefined,
});

const mapAlbum = (a: z.infer<typeof jmAlbum>): ApiAlbum => ({
  id: a.id,
  title: decode(a.name),
  artistId: a.artist_id,
  artistName: decode(a.artist_name || 'Unknown artist'),
  year: a.releasedate ? Number(a.releasedate.slice(0, 4)) || undefined : undefined,
  artworkUrl: a.image || undefined,
});

const mapArtist = (a: z.infer<typeof jmArtist>): ApiArtist => ({ id: a.id, name: decode(a.name), imageUrl: a.image || undefined });

export const TRACK_ORDERS = ['relevance', 'popularity_week', 'popularity_month', 'popularity_total', 'buzzrate', 'releasedate_desc'] as const;
export type TrackOrder = (typeof TRACK_ORDERS)[number];

export interface TrackQuery {
  q?: string;
  tags?: string;
  /** Only Jamendo's editorially featured tracks. */
  featured?: boolean;
  order?: TrackOrder;
  artistId?: string;
  albumId?: string;
  id?: string;
  limit: number;
  offset: number;
}

export async function listTracks(p: TrackQuery): Promise<Page<ApiTrack>> {
  const body = await call('/tracks/', {
    // audioformat=mp32 -> streamable MP3 in `audio`; imagesize for artwork; musicinfo for the genre tag.
    audioformat: 'mp32',
    imagesize: 500,
    include: 'musicinfo',
    search: p.q,
    tags: p.tags,
    featured: p.featured ? 1 : undefined,
    // With a text query, omit `order`: Jamendo's default is relevance, and passing order=relevance
    // explicitly makes some searches (e.g. "piano") return zero results.
    order: p.order && p.order !== 'relevance' ? p.order : p.q ? undefined : 'popularity_week',
    artist_id: p.artistId,
    album_id: p.albumId,
    id: p.id,
    limit: p.limit,
    offset: p.offset,
  });
  return page(parseAll(jmTrack, body.results).map(mapTrack), p.offset, p.limit, body.headers.results_count);
}

export interface AlbumQuery { q?: string; order?: 'releasedate_desc' | 'popularity_week'; artistId?: string; id?: string; limit: number; offset: number }

async function albums(p: AlbumQuery): Promise<Page<ApiAlbum>> {
  const body = await call('/albums/', { imagesize: 500, namesearch: p.q, order: p.order, artist_id: p.artistId, id: p.id, limit: p.limit, offset: p.offset });
  return page(parseAll(jmAlbum, body.results).map(mapAlbum), p.offset, p.limit, body.headers.results_count);
}
export const listAlbums = albums;

export interface ArtistQuery { q?: string; order?: 'popularity_week'; id?: string; limit: number; offset: number }

async function artists(p: ArtistQuery): Promise<Page<ApiArtist>> {
  const body = await call('/artists/', { imagesize: 500, namesearch: p.q, order: p.order, id: p.id, limit: p.limit, offset: p.offset });
  const items = await withArtistImages(parseAll(jmArtist, body.results).map(mapArtist));
  return page(items, p.offset, p.limit, body.headers.results_count);
}

/**
 * About half of Jamendo's artists have no profile picture. For those we use the cover of the artist's own
 * most popular track (genuine artwork for that artist, never another artist's), cached for 10 minutes.
 */
const artistImageCache = new Map<string, { at: number; url: string | null }>();
const IMAGE_TTL_MS = 10 * 60_000;

async function artistFallbackImage(artistId: string): Promise<string | undefined> {
  const hit = artistImageCache.get(artistId);
  if (hit && Date.now() - hit.at < IMAGE_TTL_MS) return hit.url ?? undefined;
  try {
    const top = await listTracks({ artistId, order: 'popularity_total', limit: 1, offset: 0 });
    const url = top.items[0]?.artworkUrl ?? null;
    artistImageCache.set(artistId, { at: Date.now(), url });
    return url ?? undefined;
  } catch {
    return undefined; // not cached: try again next time
  }
}

async function withArtistImages(list: ApiArtist[]): Promise<ApiArtist[]> {
  const out = [...list];
  const missing = out.map((a, i) => (a.imageUrl ? -1 : i)).filter((i) => i >= 0);
  // Small worker pool so a page of artists doesn't fire 20 simultaneous upstream requests.
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, missing.length) }, async () => {
      while (next < missing.length) {
        const i = missing[next++];
        const url = await artistFallbackImage(out[i].id);
        if (url) out[i] = { ...out[i], imageUrl: url };
      }
    }),
  );
  return out;
}
export const listArtists = artists;

export async function getAlbum(id: string): Promise<{ album: ApiAlbum; tracks: ApiTrack[] } | null> {
  const [albumPage, tracksBody] = await Promise.all([albums({ id, limit: 1, offset: 0 }), call('/albums/tracks/', { id, audioformat: 'mp32' })]);
  const album = albumPage.items[0];
  if (!album) return null;
  const list = parseAll(jmAlbumTracks, tracksBody.results)[0]?.tracks ?? [];
  return {
    album,
    tracks: list.map((t) => ({
      id: t.id,
      title: decode(t.name),
      artistId: album.artistId,
      artistName: album.artistName,
      albumId: album.id,
      albumName: album.title,
      durationSec: t.duration,
      audioUrl: t.audio || undefined,
      artworkUrl: album.artworkUrl,
      licenseUrl: t.license_ccurl || undefined,
    })),
  };
}

export async function getArtist(id: string): Promise<{ artist: ApiArtist; tracks: ApiTrack[]; albums: ApiAlbum[] } | null> {
  const [artistPage, top, albumPage] = await Promise.all([
    artists({ id, limit: 1, offset: 0 }),
    listTracks({ artistId: id, order: 'popularity_total', limit: 20, offset: 0 }),
    albums({ artistId: id, limit: 20, offset: 0 }),
  ]);
  const artist = artistPage.items[0];
  return artist ? { artist: (await withArtistImages([artist]))[0], tracks: top.items, albums: albumPage.items } : null;
}

const jmPlaylist = z.object({ id: z.coerce.string(), name: z.string(), user_name: str, shareurl: str });
const jmPlaylistTracks = z.object({ id: z.coerce.string(), name: z.string().optional(), tracks: z.array(jmTrack).optional() });

export interface PlaylistQuery { q?: string; limit: number; offset: number }

export async function listPlaylists(p: PlaylistQuery): Promise<Page<ApiPlaylist>> {
  const body = await call('/playlists/', { namesearch: p.q, order: p.q ? undefined : 'creationdate_desc', limit: p.limit, offset: p.offset });
  const items = parseAll(jmPlaylist, body.results).map((pl): ApiPlaylist => ({ id: pl.id, title: decode(pl.name), ownerName: pl.user_name ? decode(pl.user_name) : undefined, shareUrl: pl.shareurl || undefined }));
  return page(items, p.offset, p.limit, body.headers.results_count);
}

export async function getPlaylist(id: string): Promise<{ playlist: ApiPlaylist; tracks: ApiTrack[] } | null> {
  const [meta, tracksBody] = await Promise.all([call('/playlists/', { id, limit: 1 }), call('/playlists/tracks/', { id, audioformat: 'mp32', imagesize: 500 })]);
  const pl = parseAll(jmPlaylist, meta.results)[0];
  if (!pl) return null;
  const list = parseAll(jmPlaylistTracks, tracksBody.results)[0]?.tracks ?? [];
  return {
    playlist: { id: pl.id, title: decode(pl.name), ownerName: pl.user_name ? decode(pl.user_name) : undefined, shareUrl: pl.shareurl || undefined },
    tracks: list.map(mapTrack),
  };
}

const GENRE_NAMES: Record<string, string> = {
  pop: 'Pop', rock: 'Rock', electronic: 'Electronic', hiphop: 'Hip-Hop', jazz: 'Jazz', chillout: 'Chill',
  classical: 'Classical', ambient: 'Ambient', folk: 'Folk',
};

const mixCache = new Map<string, { at: number; value: ApiMix[] }>();
const MIX_TTL_MS = 10 * 60_000;

/** First `n` tracks with playable audio and artwork, no two sharing the same cover. */
function pickDistinct(tracks: ApiTrack[], n: number): ApiTrack[] {
  const seen = new Set<string>();
  const out: ApiTrack[] = [];
  for (const t of tracks) {
    if (!t.audioUrl || !t.artworkUrl || seen.has(t.artworkUrl)) continue;
    seen.add(t.artworkUrl);
    out.push(t);
    if (out.length >= n) break;
  }
  return out;
}

/**
 * Per-genre "mixes" built from Jamendo's featured tracks for each tag (`tags=<tag>&featured=1`), topped up with
 * the week's most popular tracks when a genre has few featured ones. Genres are fetched a few at a time and
 * the whole result is cached, so Home does not hammer the upstream API.
 */
export async function getMixes(tags: string[], perTag: number): Promise<ApiMix[]> {
  const cacheKey = `${tags.join(',')}|${perTag}`;
  const hit = mixCache.get(cacheKey);
  if (hit && Date.now() - hit.at < MIX_TTL_MS) return hit.value;

  const results: ApiMix[] = new Array(tags.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, tags.length) }, async () => {
      while (next < tags.length) {
        const i = next++;
        const tag = tags[i];
        const featured = await listTracks({ tags: tag, featured: true, order: 'popularity_week', limit: perTag * 3, offset: 0 }).catch(() => null);
        let picked = pickDistinct(featured?.items ?? [], perTag);
        if (picked.length < perTag) {
          const popular = await listTracks({ tags: tag, order: 'popularity_week', limit: perTag * 3, offset: 0 }).catch(() => null);
          const ids = new Set(picked.map((t) => t.id));
          picked = pickDistinct([...picked, ...(popular?.items ?? []).filter((t) => !ids.has(t.id))], perTag);
        }
        results[i] = { id: tag, name: GENRE_NAMES[tag] ?? tag, tracks: picked };
      }
    }),
  );

  // Give every genre a different cover where possible.
  const usedCovers = new Set<string>();
  for (const mix of results) {
    const cover = mix.tracks.find((t) => t.artworkUrl && !usedCovers.has(t.artworkUrl)) ?? mix.tracks[0];
    if (cover?.artworkUrl) {
      mix.coverUrl = cover.artworkUrl;
      usedCovers.add(cover.artworkUrl);
    }
  }

  // Do not cache a result in which every genre came back empty (upstream hiccup).
  if (results.some((m) => m.tracks.length > 0)) mixCache.set(cacheKey, { at: Date.now(), value: results });
  return results;
}

/** Jamendo tags used as browse genres. */
export const GENRES = [
  { id: 'pop', name: 'Pop' },
  { id: 'rock', name: 'Rock' },
  { id: 'electronic', name: 'Electronic' },
  { id: 'hiphop', name: 'Hip-Hop' },
  { id: 'jazz', name: 'Jazz' },
  { id: 'chillout', name: 'Chill' },
  { id: 'classical', name: 'Classical' },
  { id: 'ambient', name: 'Ambient' },
  { id: 'folk', name: 'Folk' },
];
