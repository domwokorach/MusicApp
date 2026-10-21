import { MOCK_ALBUMS, MOCK_ARTISTS } from '@/data/mockAlbums';
import { MOCK_PLAYLIST_DEFS, MOCK_PLAYLISTS, MOCK_GENRES } from '@/data/mockPlaylists';
import { MOCK_SONGS, MOCK_TRACKS_BY_ID } from '@/data/mockSongs';
import type { MusicProvider, Page, PageParams } from '@/types/api';
import { ApiError } from './client';

/** Offline provider backed by the bundled demo catalogue. Used when no Jamendo client id is configured. */

const paginate = <T,>(all: T[], { limit = 20, offset = 0 }: PageParams = {}): Page<T> => ({
  items: all.slice(offset, offset + limit),
  offset,
  hasMore: offset + limit < all.length,
});

const includes = (q: string, ...fields: (string | undefined)[]) => {
  const needle = q.trim().toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(needle));
};

const latency = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 120));

export const mockApi: MusicProvider = {
  name: 'Demo catalogue',

  searchSongs: (q, p) =>
    latency(
      paginate(
        MOCK_SONGS.filter((t) => (!p?.tag || t.genre?.toLowerCase() === p.tag.toLowerCase()) && (!q.trim() || includes(q, t.title, t.artistName, t.genre, t.albumName))),
        p,
      ),
    ),
  searchAlbums: (q, p) => latency(paginate(MOCK_ALBUMS.filter((a) => includes(q, a.title, a.artistName, a.genre)), p)),
  searchArtists: (q, p) => latency(paginate(MOCK_ARTISTS.filter((a) => includes(q, a.name, a.genre)), p)),

  trending: (p) => latency(paginate([...MOCK_SONGS].sort((a, b) => a.id.slice(-1).localeCompare(b.id.slice(-1))), p)),
  searchPlaylists: (q, p) => latency(paginate(MOCK_PLAYLISTS.filter((pl) => includes(q, pl.title, pl.description)), p)),
  tracksBy: (sort, p) => {
    const pool = p?.tag ? MOCK_SONGS.filter((t) => t.genre?.toLowerCase() === p.tag!.toLowerCase()) : MOCK_SONGS;
    const order: Record<string, (a: string, b: string) => number> = {
      trending: (a, b) => a.slice(-1).localeCompare(b.slice(-1)),
      featured: (a, b) => b.localeCompare(a),
      recommended: (a, b) => a.slice(-1).localeCompare(b.slice(-1)) || b.localeCompare(a),
      latest: (a, b) => b.slice(3).localeCompare(a.slice(3)),
    };
    return latency(paginate([...pool].sort((a, b) => order[sort](a.id, b.id)), p));
  },
  newAlbums: (p) => latency(paginate([...MOCK_ALBUMS].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)), p)),
  popularArtists: (p) => latency(paginate(MOCK_ARTISTS, p)),

  categories: () => latency(MOCK_GENRES),
  mixes: (ids, perGenre = 10) =>
    latency(
      ids.flatMap((id) => {
        const genre = MOCK_GENRES.find((g) => g.id === id);
        if (!genre) return [];
        const tracks = MOCK_SONGS.filter((t) => t.genre === id).slice(0, perGenre);
        return [{ genre: { ...genre, artworkUrl: tracks[0]?.artworkUrl }, tracks }];
      }),
    ),

  async getPlaylist(id) {
    if (id.startsWith('tag:')) {
      const tag = id.slice(4);
      return latency({
        playlist: { id, title: `${tag} Mix`, description: `${tag} tracks from the demo catalogue.`, color: MOCK_GENRES.find((g) => g.id === tag)?.color ?? '#4A00E0' },
        tracks: MOCK_SONGS.filter((t) => t.genre?.toLowerCase() === tag.toLowerCase()),
      });
    }
    const def = MOCK_PLAYLIST_DEFS.find((p) => p.id === id);
    const playlist = MOCK_PLAYLISTS.find((p) => p.id === id);
    if (!def || !playlist) throw new ApiError('This playlist could not be found.', 'api', 404);
    return latency({ playlist, tracks: def.trackIds.map((t) => MOCK_TRACKS_BY_ID[t]).filter(Boolean) });
  },

  async getAlbum(id) {
    const album = MOCK_ALBUMS.find((a) => a.id === id);
    if (!album) throw new ApiError('This album could not be found.', 'api', 404);
    return latency({ album, tracks: MOCK_SONGS.filter((t) => t.albumId === id) });
  },

  async getArtist(id) {
    const artist = MOCK_ARTISTS.find((a) => a.id === id);
    if (!artist) throw new ApiError('This artist could not be found.', 'api', 404);
    return latency({ artist, tracks: MOCK_SONGS.filter((t) => t.artistId === id), albums: MOCK_ALBUMS.filter((a) => a.artistId === id) });
  },

  async getTrack(id) {
    const t = MOCK_TRACKS_BY_ID[id];
    if (!t) throw new ApiError('This track could not be found.', 'api', 404);
    return latency(t);
  },
};
