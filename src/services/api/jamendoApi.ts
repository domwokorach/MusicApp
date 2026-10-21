import { config } from '@/constants/config';
import type { AlbumDetail, ArtistDetail, MusicProvider, Page, PageParams, PlaylistDetail, TrackSort } from '@/types/api';
import type { Album, Artist, Genre, GenreMix, Playlist, Track } from '@/types/music';
import { normalizeArtworkUrl } from '@/utils/artwork';
import { colorFromString } from '@/utils/helpers';

import { ApiError, buildUrl, getJson, type QueryValue } from './client';

/**
 * Jamendo catalogue via the Sonara backend (/backend). The app never talks to Jamendo directly and
 * never holds any Jamendo credential; the backend adds the client id and validates upstream data.
 * This file additionally validates the backend's responses before they reach the UI.
 */

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

async function get(path: string, query: Record<string, QueryValue> = {}): Promise<Raw> {
  const body = await getJson<unknown>(buildUrl(config.apiUrl, `/api${path}`, query));
  if (!isObj(body)) throw new ApiError('The music service sent an unexpected response.', 'parse');
  return body;
}

function mapTrack(raw: unknown): Track | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const title = str(raw.title);
  if (!id || !title) return null;
  return {
    id: `jm_${id}`,
    title,
    kind: 'song',
    artistName: str(raw.artistName) ?? 'Unknown artist',
    artistId: str(raw.artistId) ? `jm_${raw.artistId}` : undefined,
    albumId: str(raw.albumId) ? `jm_${raw.albumId}` : undefined,
    albumName: str(raw.albumName),
    genre: str(raw.genre),
    durationSec: num(raw.durationSec),
    // Tracks without a stream URL stay listed but are not playable (we never try to bypass restrictions).
    audioUrl: str(raw.audioUrl) ?? null,
    artworkUrl: normalizeArtworkUrl(raw.artworkUrl),
    color: colorFromString(id),
    source: 'jamendo',
    licenseUrl: str(raw.licenseUrl),
    shareUrl: str(raw.shareUrl),
  };
}

function mapAlbum(raw: unknown): Album | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const title = str(raw.title);
  if (!id || !title) return null;
  return {
    id: `jm_${id}`,
    title,
    artistId: str(raw.artistId) ? `jm_${raw.artistId}` : undefined,
    artistName: str(raw.artistName) ?? 'Unknown artist',
    year: num(raw.year),
    artworkUrl: normalizeArtworkUrl(raw.artworkUrl),
    color: colorFromString(id),
    source: 'jamendo',
  };
}

function mapArtist(raw: unknown): Artist | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  return { id: `jm_${id}`, name, imageUrl: normalizeArtworkUrl(raw.imageUrl), color: colorFromString(id), source: 'jamendo' };
}

function mapPlaylist(raw: unknown): Playlist | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const title = str(raw.title);
  if (!id || !title) return null;
  return {
    id: `jp_${id}`,
    source: 'jamendo',
    title,
    description: str(raw.ownerName) ? `By ${raw.ownerName}` : 'Jamendo playlist',
    color: colorFromString(id),
  };
}

const compact = <T,>(list: (T | null)[]): T[] => list.filter((x): x is T => x !== null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const raw = (id: string) => id.replace(/^jm_/, '');

function toPage<T>(body: Raw, map: (r: unknown) => T | null, offset: number): Page<T> {
  return { items: compact(list(body.items).map(map)), offset, hasMore: body.hasMore === true };
}

const ORDER: Record<TrackSort, string> = { trending: 'popularity_week', featured: 'buzzrate', recommended: 'popularity_month', latest: 'releasedate_desc' };

const GENRE_COLORS: Record<string, string> = {
  pop: '#E91E63', rock: '#E64A19', electronic: '#00ACC1', hiphop: '#F9A825', jazz: '#8D6E63',
  chillout: '#43A047', classical: '#5C6BC0', ambient: '#26A69A', folk: '#FFA726',
};
const FALLBACK_GENRES: Genre[] = Object.keys(GENRE_COLORS).map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), color: GENRE_COLORS[id] }));

const limitOf = (p?: PageParams) => p?.limit ?? config.pageSize;
const offsetOf = (p?: PageParams) => p?.offset ?? 0;

async function tracks(query: Record<string, QueryValue>, p?: PageParams): Promise<Page<Track>> {
  const offset = offsetOf(p);
  return toPage(await get('/tracks', { limit: limitOf(p), offset, tags: p?.tag, ...query }), mapTrack, offset);
}

export const jamendoApi: MusicProvider = {
  name: 'Jamendo',

  searchSongs: (q, p) => tracks({ q: q.trim() || undefined }, p),
  trending: (p) => tracks({ order: ORDER.trending }, p),
  tracksBy: (sort, p) => tracks({ order: ORDER[sort] }, p),

  async searchAlbums(q, p) {
    const offset = offsetOf(p);
    return toPage(await get('/albums', { q, limit: limitOf(p), offset }), mapAlbum, offset);
  },
  async newAlbums(p) {
    const offset = offsetOf(p);
    return toPage(await get('/albums', { order: 'releasedate_desc', limit: limitOf(p), offset }), mapAlbum, offset);
  },
  async searchPlaylists(q, p) {
    const offset = offsetOf(p);
    return toPage(await get('/playlists', { q, limit: limitOf(p), offset }), mapPlaylist, offset);
  },
  async searchArtists(q, p) {
    const offset = offsetOf(p);
    return toPage(await get('/artists', { q, limit: limitOf(p), offset }), mapArtist, offset);
  },
  async popularArtists(p) {
    const offset = offsetOf(p);
    return toPage(await get('/artists', { order: 'popularity_week', limit: limitOf(p), offset }), mapArtist, offset);
  },

  async categories(): Promise<Genre[]> {
    try {
      const items = list((await get('/genres')).items).flatMap((g) => {
        if (!isObj(g) || !str(g.id) || !str(g.name)) return [];
        const id = g.id as string;
        return [{ id, name: g.name as string, color: GENRE_COLORS[id] ?? colorFromString(id) }];
      });
      return items.length > 0 ? items : FALLBACK_GENRES;
    } catch {
      return FALLBACK_GENRES;
    }
  },

  async mixes(genreIds, perGenre = 10): Promise<GenreMix[]> {
    const body = await get('/mixes', { tags: genreIds.join(','), perTag: perGenre });
    return list(body.items).flatMap((m): GenreMix[] => {
      if (!isObj(m)) return [];
      const id = str(m.id);
      const name = str(m.name);
      if (!id || !name) return [];
      const tracks = compact(list(m.tracks).map(mapTrack));
      return [{ genre: { id, name, color: GENRE_COLORS[id] ?? colorFromString(id), artworkUrl: normalizeArtworkUrl(m.coverUrl) ?? tracks[0]?.artworkUrl }, tracks }];
    });
  },

  async getPlaylist(id): Promise<PlaylistDetail> {
    if (id.startsWith('jp_')) {
      const body = await get(`/playlists/${encodeURIComponent(id.slice(3))}`);
      const playlist = mapPlaylist(body.playlist);
      if (!playlist) throw new ApiError('This playlist could not be found.', 'api', 404);
      return { playlist, tracks: compact(list(body.tracks).map(mapTrack)) };
    }
    // "tag:rock" -> the live featured-track mix for that genre (app-curated from Jamendo's featured tracks).
    const tag = id.replace(/^tag:/, '');
    const [mix] = await this.mixes([tag], 20);
    if (!mix) throw new ApiError('This mix could not be found.', 'api', 404);
    return {
      playlist: { id, source: 'jamendo', title: `${mix.genre.name} Mix`, description: `Featured ${mix.genre.name.toLowerCase()} tracks from Jamendo`, color: mix.genre.color, artworkUrl: mix.genre.artworkUrl, coverUrls: mix.tracks.map((t) => t.artworkUrl).filter((u): u is string => !!u) },
      tracks: mix.tracks,
    };
  },

  async getAlbum(id): Promise<AlbumDetail> {
    const body = await get(`/albums/${encodeURIComponent(raw(id))}`);
    const album = mapAlbum(body.album);
    if (!album) throw new ApiError('This album could not be found.', 'api', 404);
    // Album track rows carry no artwork/colour of their own; inherit it from the album.
    const items = compact(list(body.tracks).map(mapTrack)).map((t) => ({ ...t, artworkUrl: t.artworkUrl ?? album.artworkUrl, color: album.color }));
    return { album, tracks: items };
  },

  async getArtist(id): Promise<ArtistDetail> {
    const body = await get(`/artists/${encodeURIComponent(raw(id))}`);
    const artist = mapArtist(body.artist);
    if (!artist) throw new ApiError('This artist could not be found.', 'api', 404);
    return { artist, tracks: compact(list(body.tracks).map(mapTrack)), albums: compact(list(body.albums).map(mapAlbum)) };
  },

  async getTrack(id) {
    const result = await tracks({ id: raw(id) }, { limit: 1 });
    const t = result.items[0];
    if (!t) throw new ApiError('This track could not be found.', 'api', 404);
    return t;
  },
};
