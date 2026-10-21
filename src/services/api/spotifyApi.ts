import { config } from '@/constants/config';
import { SpotifyAuthError, clearSpotifySession, getSessionToken } from '@/services/spotifyAuth';
import { useSpotifyStore, type SpotifyCapability } from '@/store/spotifyStore';
import type { Page, PageParams } from '@/types/api';
import type { Album, Artist, Playlist, Podcast, Track } from '@/types/music';
import { pickSpotifyImage } from '@/utils/artwork';
import { colorFromString } from '@/utils/helpers';

import { ApiError, buildUrl, type QueryValue } from './client';

/**
 * Spotify Web API, METADATA ONLY (search, artwork, navigation). Spotify tracks are never playable through
 * Expo Audio, so every Spotify track has `audioUrl: null` and is never substituted with another catalogue.
 * Auth: handled by the backend (Authorization Code + PKCE); the app holds no Spotify secret or token.
 *
 * Development Mode limits (2026): the app owner needs Spotify Premium, at most 5 allow-listed users,
 * and search `limit` is capped at 10. Violations surface as 403 and are explained to the user below.
 */

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** Spotify images are sorted large to small; pick one close to card size (300px) rather than always the biggest. */
const image = (v: unknown, target = 300): string | undefined => pickSpotifyImage(v, target);
const link = (v: unknown): string | undefined => (isObj(v) ? str(v.spotify) : undefined);
const strip = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").trim();

const FORBIDDEN =
  'Spotify refused this request. In Development Mode the app owner needs an active Spotify Premium plan, and you must be on the app’s allow-list (max 5 users).';

/**
 * All Spotify calls go through the Sonara backend proxy (`/api/spotify/proxy/...`) with the opaque session
 * token. The backend holds the real Spotify tokens, refreshes them, and only forwards allow-listed read endpoints.
 */
async function request<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
  if (!config.apiUrl) throw new SpotifyAuthError('Spotify needs the Sonara backend. Set EXPO_PUBLIC_API_URL.', 'not_configured');

  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    useSpotifyStore.getState().markDisconnected();
    throw new SpotifyAuthError('Connect your Spotify account to continue.', 'not_connected');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  let res: Response;
  try {
    res = await fetch(buildUrl(config.apiUrl, `/api/spotify/proxy${path}`, query), { headers: { Authorization: `Bearer ${sessionToken}` }, signal: controller.signal });
  } catch {
    throw new ApiError(
      controller.signal.aborted ? 'Spotify took too long to respond.' : `Can’t reach the Sonara backend at ${config.apiUrl}. Make sure it is running.`,
      controller.signal.aborted ? 'timeout' : 'network',
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    // The backend could not refresh the session (revoked / expired / unknown): the user has to sign in again.
    await clearSpotifySession();
    useSpotifyStore.getState().markDisconnected('Your Spotify session expired. Connect again.');
    throw new SpotifyAuthError('Your Spotify session expired. Connect again.', 'expired');
  }
  if (res.status === 403) throw new ApiError(FORBIDDEN, 'http', 403);
  if (res.status === 429) {
    const wait = Number(res.headers.get('Retry-After'));
    throw new ApiError(Number.isFinite(wait) && wait > 0 ? `Spotify is rate limiting requests. Try again in ${wait}s.` : 'Spotify is rate limiting requests. Try again shortly.', 'http', 429);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string | { message?: string } } | null;
    const detail = typeof body?.error === 'string' ? body.error : body?.error?.message;
    throw new ApiError(detail ? `Spotify: ${detail}` : `Spotify returned an error (${res.status}).`, 'http', res.status);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError('Spotify sent an unreadable response.', 'parse');
  }
}

// ---- mapping (validates shape; drops anything malformed or null, which Spotify can return in lists) ----

function mapArtist(raw: unknown): Artist | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  const followers = isObj(raw.followers) && typeof raw.followers.total === 'number' ? raw.followers.total : undefined;
  return {
    id: `sp_${id}`,
    name,
    imageUrl: image(raw.images),
    color: colorFromString(id),
    genre: str(arr(raw.genres)[0]),
    followers: followers !== undefined ? new Intl.NumberFormat('en', { notation: 'compact' }).format(followers) : undefined,
    source: 'spotify',
  };
}

function mapAlbum(raw: unknown): Album | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const title = str(raw.name);
  if (!id || !title) return null;
  const first = arr(raw.artists)[0];
  const artist = isObj(first) ? first : undefined;
  const year = Number(str(raw.release_date)?.slice(0, 4));
  return {
    id: `sp_${id}`,
    title,
    artistId: str(artist?.id) ? `sp_${artist!.id}` : undefined,
    artistName: str(artist?.name) ?? 'Unknown artist',
    year: Number.isFinite(year) && year > 0 ? year : undefined,
    artworkUrl: image(raw.images),
    color: colorFromString(id),
    source: 'spotify',
  };
}

function mapTrack(raw: unknown, fallbackAlbum?: Album): Track | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const title = str(raw.name);
  if (!id || !title) return null;
  const first = arr(raw.artists)[0];
  const artist = isObj(first) ? first : undefined;
  const album = mapAlbum(raw.album) ?? fallbackAlbum;
  return {
    id: `sp_${id}`,
    title,
    kind: 'song',
    artistName: str(artist?.name) ?? 'Unknown artist',
    artistId: str(artist?.id) ? `sp_${artist!.id}` : undefined,
    albumId: album?.id,
    albumName: album?.title,
    durationSec: typeof raw.duration_ms === 'number' ? Math.round(raw.duration_ms / 1000) : undefined,
    audioUrl: null, // Spotify content is never streamed through Expo Audio.
    artworkUrl: album?.artworkUrl,
    externalUrl: link(raw.external_urls),
    color: colorFromString(id),
    source: 'spotify',
  };
}

function mapPlaylist(raw: unknown): Playlist | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const title = str(raw.name);
  if (!id || !title) return null;
  const owner = isObj(raw.owner) ? str(raw.owner.display_name) : undefined;
  const description = str(raw.description);
  return {
    id: `sp_${id}`,
    title,
    description: description ? strip(description) : owner ? `By ${owner}` : 'Playlist',
    artworkUrl: image(raw.images),
    externalUrl: link(raw.external_urls),
    color: colorFromString(id),
    source: 'spotify',
  };
}

const compact = <T,>(list: (T | null)[]): T[] => list.filter((x): x is T => x !== null);
const raw = (id: string) => id.replace(/^sp_/, '');

export type SpotifySearchType = 'track' | 'artist' | 'album' | 'playlist';

export interface SpotifySearchResult {
  tracks: Page<Track>;
  artists: Page<Artist>;
  albums: Page<Album>;
  playlists: Page<Playlist>;
}

function toPage<T>(section: unknown, map: (r: unknown) => T | null, offset: number): Page<T> {
  const s = isObj(section) ? section : {};
  return { items: compact(arr(s.items).map(map)), offset, hasMore: typeof s.next === 'string' };
}

export const spotifyApi = {
  async search(types: SpotifySearchType[], query: string, { limit = config.spotifyPageSize, offset = 0 }: PageParams = {}): Promise<SpotifySearchResult> {
    const body = await request<Raw>('/search', {
      q: query,
      type: types.join(','),
      limit: Math.min(limit, config.spotifyPageSize),
      offset,
    });
    return {
      tracks: toPage(body.tracks, (r) => mapTrack(r), offset),
      artists: toPage(body.artists, mapArtist, offset),
      albums: toPage(body.albums, mapAlbum, offset),
      playlists: toPage(body.playlists, mapPlaylist, offset),
    };
  },

  async getAlbum(id: string): Promise<{ album: Album; tracks: Track[] }> {
    const body = await request<Raw>(`/albums/${encodeURIComponent(raw(id))}`);
    const album = mapAlbum(body);
    if (!album) throw new ApiError('This album could not be found.', 'api', 404);
    const items = isObj(body.tracks) ? arr(body.tracks.items) : [];
    return { album, tracks: compact(items.map((t) => mapTrack(t, album))) };
  },

  async getArtist(id: string): Promise<{ artist: Artist; tracks: Track[]; albums: Album[] }> {
    const [artistBody, albumsBody, topBody] = await Promise.all([
      request<Raw>(`/artists/${encodeURIComponent(raw(id))}`),
      request<Raw>(`/artists/${encodeURIComponent(raw(id))}/albums`, { limit: 20, include_groups: 'album,single' }),
      // Top tracks is restricted for some apps; it is optional.
      request<Raw>(`/artists/${encodeURIComponent(raw(id))}/top-tracks`, { market: 'US' }).catch(() => ({}) as Raw),
    ]);
    const artist = mapArtist(artistBody);
    if (!artist) throw new ApiError('This artist could not be found.', 'api', 404);
    return {
      artist,
      albums: compact(arr(albumsBody.items).map(mapAlbum)),
      tracks: compact(arr(topBody.tracks).map((t) => mapTrack(t))),
    };
  },

  async getPlaylist(id: string): Promise<{ playlist: Playlist; tracks: Track[] }> {
    const body = await request<Raw>(`/playlists/${encodeURIComponent(raw(id))}`, { fields: 'id,name,description,images,owner(display_name)' });
    const playlist = mapPlaylist(body);
    if (!playlist) throw new ApiError('This playlist could not be found.', 'api', 404);
    // Playlist contents can be restricted in Development Mode; show the playlist without tracks in that case.
    const items = await request<Raw>(`/playlists/${encodeURIComponent(raw(id))}/tracks`, { limit: 50 }).catch(() => ({}) as Raw);
    const tracks = compact(arr(items.items).map((i) => (isObj(i) ? mapTrack(i.track) : null)));
    return { playlist, tracks };
  },
};


// ---- podcasts (shows / episodes): catalogue metadata and links only ----

function mapShow(raw: unknown): Podcast | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const title = str(raw.name);
  if (!id || !title) return null;
  return {
    id: `sp_${id}`,
    source: 'spotify',
    title,
    episodeCount: typeof raw.total_episodes === 'number' ? raw.total_episodes : undefined,
    host: str(raw.publisher) ?? 'Unknown publisher',
    publisher: str(raw.publisher),
    category: 'Podcast',
    description: strip(str(raw.description) ?? ''),
    artworkUrl: image(raw.images), // show.images
    externalUrl: link(raw.external_urls),
    color: colorFromString(id),
  };
}

function mapEpisode(raw: unknown, show: Podcast): Track | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const title = str(raw.name);
  if (!id || !title) return null;
  return {
    id: `sp_${id}`,
    title,
    kind: 'episode',
    artistName: show.publisher ?? show.host,
    podcastId: show.id,
    albumName: show.title,
    durationSec: typeof raw.duration_ms === 'number' ? Math.round(raw.duration_ms / 1000) : undefined,
    releaseDate: str(raw.release_date),
    audioUrl: null,
    // episode.images, falling back to the show's own artwork (never to another provider's)
    artworkUrl: image(raw.images) ?? show.artworkUrl,
    externalUrl: link(raw.external_urls),
    color: show.color,
    source: 'spotify',
  };
}

/**
 * Runs an optional endpoint. A 403/404 means this app/user can't use it (Development Mode, missing scope or a
 * removed endpoint), so the capability is remembered and the endpoint isn't requested again until reconnect.
 */
async function optionalEndpoint<T>(cap: SpotifyCapability, run: () => Promise<T>): Promise<T> {
  const known = useSpotifyStore.getState().unavailable[cap];
  if (known) throw new ApiError(known, 'http', 403);
  try {
    return await run();
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
      useSpotifyStore.getState().markUnavailable(cap, e.message);
    }
    throw e;
  }
}

export const spotifyLibraryApi = {
  /** `GET /me/player/recently-played` (scope user-read-recently-played). Newest first, one entry per track. */
  recentlyPlayed(limit = 20): Promise<Track[]> {
    return optionalEndpoint('recentlyPlayed', async () => {
      const body = await request<Raw>('/me/player/recently-played', { limit });
      const seen = new Set<string>();
      const out: Track[] = [];
      for (const item of arr(body.items)) {
        if (!isObj(item)) continue;
        const track = mapTrack(item.track); // item.track.album.images
        if (!track || seen.has(track.id)) continue;
        seen.add(track.id);
        const at = Date.parse(str(item.played_at) ?? '');
        out.push({ ...track, playedAt: Number.isFinite(at) ? at : undefined });
      }
      return out;
    });
  },

  /** `GET /me/playlists` – playlists the signed-in user owns or follows. */
  myPlaylists(limit = 20): Promise<Playlist[]> {
    return optionalEndpoint('myPlaylists', async () => {
      const body = await request<Raw>('/me/playlists', { limit });
      return compact(arr(body.items).map(mapPlaylist));
    });
  },

  /** `GET /me/shows` (scope user-library-read) – podcasts the user saved. */
  savedShows(limit = 20): Promise<Podcast[]> {
    return optionalEndpoint('savedShows', async () => {
      const body = await request<Raw>('/me/shows', { limit });
      return compact(arr(body.items).map((i) => (isObj(i) ? mapShow(i.show) : null)));
    });
  },

  searchShows(query: string, limit = 10): Promise<Podcast[]> {
    return optionalEndpoint('showSearch', async () => {
      const body = await request<Raw>('/search', { q: query, type: 'show', market: 'US', limit: Math.min(limit, config.spotifyPageSize) });
      return isObj(body.shows) ? compact(arr(body.shows.items).map(mapShow)) : [];
    });
  },

  async getShow(id: string): Promise<{ podcast: Podcast; episodes: Track[] }> {
    const [showBody, epBody] = await Promise.all([
      request<Raw>(`/shows/${encodeURIComponent(raw(id))}`, { market: 'US' }),
      request<Raw>(`/shows/${encodeURIComponent(raw(id))}/episodes`, { market: 'US', limit: 20 }).catch(() => ({}) as Raw),
    ]);
    const podcast = mapShow(showBody);
    if (!podcast) throw new ApiError('This podcast could not be found.', 'api', 404);
    return { podcast, episodes: compact(arr(epBody.items).map((e) => mapEpisode(e, podcast))) };
  },
};
