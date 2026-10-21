import { useFocusEffect } from 'expo-router';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { isLiveCatalogue, musicApi } from '@/services/api/musicApi';
import { spotifyLibraryApi } from '@/services/api/spotifyApi';
import { STALE_MS } from '@/services/queryClient';
import { useLibraryStore } from '@/store/libraryStore';
import { usePlaylistStore } from '@/store/playlistStore';
import { useSpotifyStore, type SpotifyCapability } from '@/store/spotifyStore';
import type { Album, Artist, Genre, GenreMix, Playlist, Podcast, Track } from '@/types/music';
import { errorMessage } from '@/utils/helpers';

/**
 * Generic loader backed by TanStack Query: results are cached by `key`, identical in-flight requests are
 * deduplicated, and `reload` forces a refetch.
 */
export function useAsync<T>(key: string, load: () => Promise<T>) {
  const q = useQuery({ queryKey: ['async', key], queryFn: load });
  return { data: q.data, error: q.error ? errorMessage(q.error) : null, loading: q.isPending, reload: () => void q.refetch() };
}

export function useAlbum(id: string) {
  return useAsync(`album:${id}`, () => musicApi.getAlbum(id));
}

export function useArtist(id: string) {
  return useAsync(`artist:${id}`, () => musicApi.getArtist(id));
}

export function usePodcast(id: string) {
  return useAsync(`podcast:${id}`, () => musicApi.getPodcast(id));
}

export interface PlaylistView {
  title: string;
  description: string;
  color: string;
  tracks: Track[];
  /** Set for user-owned playlists (editable). */
  userPlaylistId?: string;
  playlist?: Playlist | null;
}

/** Resolves 'liked', user playlists (local) and curated / provider playlists (API) behind one hook. */
export function usePlaylistView(id: string) {
  const liked = useLibraryStore((s) => s.liked);
  const user = usePlaylistStore((s) => s.playlists.find((p) => p.id === id));
  const remote = useAsync(`playlist:${id}`, () => (id === 'liked' || id.startsWith('u_') ? Promise.resolve(null) : musicApi.getPlaylist(id)));

  if (id === 'liked') {
    const view: PlaylistView = { title: 'Liked Songs', description: 'Songs you’ve saved', color: '#6A2FE0', tracks: liked };
    return { view, loading: false, error: null, reload: remote.reload };
  }
  if (id.startsWith('u_')) {
    const view: PlaylistView | undefined = user && { title: user.name, description: user.description || 'Your playlist', color: '#4A00E0', tracks: user.tracks, userPlaylistId: user.id };
    return { view, loading: false, error: view ? null : 'This playlist no longer exists.', reload: remote.reload };
  }
  const view: PlaylistView | undefined = remote.data
    ? { title: remote.data.playlist.title, description: remote.data.playlist.description, color: remote.data.playlist.color, tracks: remote.data.tracks, playlist: remote.data.playlist }
    : undefined;
  return { view, loading: remote.loading, error: remote.error, reload: remote.reload };
}

// ------------------------------------------------------------------------------------------------
// Home feed
// ------------------------------------------------------------------------------------------------

/** Jamendo tags (live) or demo genre ids shown as "<Genre> Mix" shelves. */
const MAIN_MIXES = isLiveCatalogue ? ['rock', 'pop', 'hiphop', 'electronic', 'jazz'] : ['Rock', 'Pop', 'Hip-Hop', 'Electronic', 'Jazz'];
const ALL_GENRES = isLiveCatalogue
  ? [...MAIN_MIXES, 'chillout', 'classical', 'ambient', 'folk']
  : [...MAIN_MIXES, 'Indie', 'R&B', 'Chill'];

export interface Section<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function section<T>(q: UseQueryResult<T[]>): Section<T> {
  return { data: q.data ?? [], loading: q.isLoading, error: q.error ? errorMessage(q.error) : null, refetch: () => void q.refetch() };
}

/** Featured playlists for Jamendo: app-curated mixes built from live featured tracks (clearly labelled as such). */
export function mixPlaylists(mixes: GenreMix[]): Playlist[] {
  return mixes
    .filter((m) => m.tracks.length > 0)
    .map((m) => ({
      id: `tag:${m.genre.id}`,
      source: isLiveCatalogue ? ('jamendo' as const) : undefined,
      title: `${m.genre.name} Mix`,
      description: isLiveCatalogue ? 'App-curated · featured Jamendo tracks' : 'Demo catalogue',
      color: m.genre.color,
      artworkUrl: m.genre.artworkUrl,
      coverUrls: m.tracks.map((t) => t.artworkUrl).filter((u): u is string => !!u),
    }));
}

export function useHomeData() {
  const spotifyConnected = useSpotifyStore((s) => s.status === 'connected');
  const unavailable = useSpotifyStore((s) => s.unavailable);
  const spotifyOk = (cap: SpotifyCapability) => spotifyConnected && !unavailable[cap];

  const trending = useQuery({ queryKey: ['home', 'trending'], queryFn: async () => (await musicApi.trending({ limit: 20 })).items });
  const featured = useQuery({ queryKey: ['home', 'featured'], queryFn: async () => (await musicApi.tracksBy('featured', { limit: 20 })).items });
  const recommended = useQuery({ queryKey: ['home', 'recommended'], queryFn: async () => (await musicApi.tracksBy('recommended', { limit: 20 })).items });
  const newAlbums = useQuery({ queryKey: ['home', 'albums'], queryFn: async () => (await musicApi.newAlbums({ limit: 20 })).items });
  const artists = useQuery({ queryKey: ['home', 'artists'], queryFn: async () => (await musicApi.popularArtists({ limit: 20 })).items });
  // One request feeds genre tiles, featured playlists and all "<Genre> Mix" shelves (deduplicated + cached).
  const mixes = useQuery({ queryKey: ['home', 'mixes', ALL_GENRES.join(',')], queryFn: () => musicApi.mixes(ALL_GENRES, 10) });

  const demoPodcasts = useQuery({ queryKey: ['home', 'demo-podcasts'], queryFn: () => musicApi.getPodcasts(), enabled: !isLiveCatalogue });
  const demoEpisodes = useQuery({ queryKey: ['home', 'demo-episodes'], queryFn: () => musicApi.getNewEpisodes(), enabled: !isLiveCatalogue });

  // Spotify: metadata only, available only after sign-in and only for endpoints the app is allowed to use.
  const spotifyPlaylists = useQuery({ queryKey: ['spotify', 'playlists'], queryFn: () => spotifyLibraryApi.myPlaylists(), enabled: spotifyOk('myPlaylists'), retry: false });
  const spotifyRecent = useQuery({ queryKey: ['spotify', 'recent'], queryFn: () => spotifyLibraryApi.recentlyPlayed(), enabled: spotifyOk('recentlyPlayed'), retry: false });
  const spotifyShows = useQuery({
    queryKey: ['spotify', 'shows'],
    enabled: spotifyOk('savedShows') || spotifyOk('showSearch'),
    retry: false,
    queryFn: async (): Promise<{ shows: Podcast[]; suggested: boolean }> => {
      const saved = spotifyOk('savedShows') ? await spotifyLibraryApi.savedShows().catch(() => []) : [];
      if (saved.length > 0) return { shows: saved, suggested: false };
      return { shows: await spotifyLibraryApi.searchShows('music'), suggested: true };
    },
  });

  const mixList: GenreMix[] = useMemo(() => mixes.data ?? [], [mixes.data]);
  const genres: Genre[] = useMemo(() => mixList.map((m) => m.genre), [mixList]);
  const playlists = useMemo(() => mixPlaylists(mixList), [mixList]);
  const mainMixes = useMemo(() => MAIN_MIXES.map((id) => mixList.find((m) => m.genre.id === id)).filter((m): m is GenreMix => !!m && m.tracks.length > 0), [mixList]);

  const all = [trending, featured, recommended, newAlbums, artists, mixes, spotifyPlaylists, spotifyRecent, spotifyShows, demoPodcasts, demoEpisodes];
  // Disabled queries (Spotify before sign-in, demo podcasts in live mode) stay idle and must not be refetched.
  const enabled = [trending, featured, recommended, newAlbums, artists, mixes, ...(spotifyOk('myPlaylists') ? [spotifyPlaylists] : []), ...(spotifyOk('recentlyPlayed') ? [spotifyRecent] : []), ...(spotifyOk('savedShows') || spotifyOk('showSearch') ? [spotifyShows] : []), ...(isLiveCatalogue ? [] : [demoPodcasts, demoEpisodes])];

  return {
    trending: section<Track>(trending),
    featured: section<Track>(featured),
    recommended: section<Track>(recommended),
    albums: section<Album>(newAlbums),
    artists: section<Artist>(artists),
    genres: { data: genres, loading: mixes.isLoading, error: mixes.error ? errorMessage(mixes.error) : null, refetch: () => void mixes.refetch() } as Section<Genre>,
    playlists: { data: playlists, loading: mixes.isLoading, error: mixes.error ? errorMessage(mixes.error) : null, refetch: () => void mixes.refetch() } as Section<Playlist>,
    mixes: { data: mainMixes, loading: mixes.isLoading, error: mixes.error ? errorMessage(mixes.error) : null, refetch: () => void mixes.refetch() } as Section<GenreMix>,
    demoPodcasts: section<Podcast>(demoPodcasts),
    demoEpisodes: section<Track>(demoEpisodes),
    spotify: {
      connected: spotifyConnected,
      playlists: section<Playlist>(spotifyPlaylists),
      recent: section<Track>(spotifyRecent),
      shows: { data: spotifyShows.data?.shows ?? [], suggested: spotifyShows.data?.suggested ?? false, loading: spotifyShows.isLoading, error: spotifyShows.error ? errorMessage(spotifyShows.error) : null, refetch: () => void spotifyShows.refetch() },
      unavailable,
    },
    /** True while any section is being refreshed manually / in the background. */
    isFetching: all.some((q) => q.isFetching),
    refetchAll: async () => {
      await Promise.all(enabled.map((q) => q.refetch()));
    },
    /** Refetch only the sections whose data is older than the stale window (used when the screen regains focus). */
    refetchStale: () => {
      for (const q of enabled) {
        if (q.isFetching) continue;
        if (Date.now() - q.dataUpdatedAt > STALE_MS) void q.refetch();
      }
    },
  };
}

/** Calls `refetchStale` each time the screen regains focus (not on first mount, where queries already load). */
export function useRefreshOnFocus(refetchStale: () => void) {
  useFocusEffect(
    useCallback(() => {
      refetchStale();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
}

export type { Album, Artist };
