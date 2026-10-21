import { isJamendoEnabled } from '@/constants/config';
import { MOCK_PODCAST_DEFS, MOCK_PODCASTS } from '@/data/mockPlaylists';
import { MOCK_EPISODES, MOCK_TRACKS_BY_ID } from '@/data/mockSongs';
import type { AlbumDetail, ArtistDetail, MusicProvider, Page, PageParams, PlaylistDetail, TrackSort } from '@/types/api';
import type { Album, Artist, Genre, Playlist, Podcast, Track } from '@/types/music';

import { ApiError } from './client';
import { jamendoApi } from './jamendoApi';
import { mockApi } from './mockApi';
import { spotifyApi, spotifyLibraryApi } from './spotifyApi';

/**
 * Single entry point for catalogue data. UI code (hooks/stores) talks only to this module and never
 * knows whether data came from Jamendo, the demo catalogue, or was enriched with Spotify metadata.
 */
const provider: MusicProvider = isJamendoEnabled ? jamendoApi : mockApi;

export const providerName = provider.name;
export const isLiveCatalogue = isJamendoEnabled;

const empty = <T,>(offset = 0): Page<T> => ({ items: [], offset, hasMore: false });

export const musicApi = {
  providerName,

  async searchSongs(query: string, page?: PageParams): Promise<Page<Track>> {
    if (!query.trim() && !page?.tag) return empty();
    return provider.searchSongs(query, page);
  },

  async searchAlbums(query: string, page?: PageParams): Promise<Page<Album>> {
    if (!query.trim()) return empty();
    return provider.searchAlbums(query, page);
  },

  async searchArtists(query: string, page?: PageParams): Promise<Page<Artist>> {
    if (!query.trim()) return empty();
    return provider.searchArtists(query, page);
  },

  async searchPlaylists(query: string, page?: PageParams): Promise<Page<Playlist>> {
    if (!query.trim()) return empty();
    return provider.searchPlaylists(query, page);
  },

  /** Podcasts are not offered by Jamendo, so they always come from the demo catalogue. */
  async searchPodcasts(query: string): Promise<{ shows: Podcast[]; episodes: Track[] }> {
    const q = query.trim().toLowerCase();
    if (!q) return { shows: [], episodes: [] };
    const shows = MOCK_PODCASTS.filter((p) => [p.title, p.host, p.category].some((f) => f.toLowerCase().includes(q)));
    const episodes = MOCK_EPISODES.filter((e) => [e.title, e.artistName, e.albumName ?? ''].some((f) => f.toLowerCase().includes(q)));
    return { shows, episodes };
  },

  trending: (page?: PageParams) => provider.trending(page),
  tracksBy: (sort: TrackSort, page?: PageParams) => provider.tracksBy(sort, page),
  newAlbums: (page?: PageParams) => provider.newAlbums(page),
  popularArtists: (page?: PageParams) => provider.popularArtists(page),
  categories: (): Promise<Genre[]> => provider.categories(),
  mixes: (genreIds: string[], perGenre?: number) => provider.mixes(genreIds, perGenre),
  getPlaylist(id: string): Promise<PlaylistDetail> {
    return id.startsWith('sp_') ? spotifyApi.getPlaylist(id) : provider.getPlaylist(id);
  },
  getTrack: (id: string): Promise<Track> => provider.getTrack(id),

  getAlbum(id: string): Promise<AlbumDetail> {
    return id.startsWith('sp_') ? spotifyApi.getAlbum(id) : provider.getAlbum(id);
  },

  async getArtist(id: string): Promise<ArtistDetail> {
    return id.startsWith('sp_') ? spotifyApi.getArtist(id) : provider.getArtist(id);
  },

  /** Demo-catalogue podcasts only. In live mode podcasts come from Spotify (see spotifyLibraryApi). */
  async getPodcasts(): Promise<Podcast[]> {
    return isJamendoEnabled ? [] : MOCK_PODCASTS;
  },

  async getPodcast(id: string): Promise<{ podcast: Podcast; episodes: Track[] }> {
    if (id.startsWith('sp_')) return spotifyLibraryApi.getShow(id);
    const podcast = MOCK_PODCASTS.find((p) => p.id === id);
    if (!podcast) throw new ApiError('This podcast could not be found.', 'api', 404);
    const def = MOCK_PODCAST_DEFS.find((p) => p.id === id)!;
    const episodes = def.episodes.map((_, i) => MOCK_TRACKS_BY_ID[`e_${id}_${i + 1}`]).filter(Boolean);
    return { podcast, episodes };
  },

  async getNewEpisodes(): Promise<Track[]> {
    return isJamendoEnabled ? [] : MOCK_EPISODES;
  },
};
