import { useEffect, useState } from 'react';

import { config } from '@/constants/config';
import { isLiveCatalogue, musicApi } from '@/services/api/musicApi';
import { spotifyApi, type SpotifySearchType } from '@/services/api/spotifyApi';
import { SpotifyAuthError } from '@/services/spotifyAuth';
import { useLibraryStore } from '@/store/libraryStore';
import { useSpotifyStore } from '@/store/spotifyStore';
import type { Album, Artist, Playlist, Podcast, Track } from '@/types/music';
import { errorMessage } from '@/utils/helpers';

export type SearchProvider = 'jamendo' | 'spotify';
export type SearchFilter = 'all' | 'songs' | 'artists' | 'albums' | 'playlists' | 'podcasts';

export const DEBOUNCE_MS = 400;

export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export interface SearchResultsData {
  songs: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  podcasts: Podcast[];
  episodes: Track[];
}

const EMPTY: SearchResultsData = { songs: [], albums: [], artists: [], playlists: [], podcasts: [], episodes: [] };

interface Loaded {
  key: string;
  results: SearchResultsData;
  hasMore: boolean;
  error: string | null;
  authRequired: boolean;
}

/** Page size for a single-type search (Spotify Development Mode caps at 10). */
const pageSizeFor = (provider: SearchProvider) => (provider === 'spotify' ? config.spotifyPageSize : config.pageSize);

const SPOTIFY_TYPE: Partial<Record<SearchFilter, SpotifySearchType>> = { songs: 'track', artists: 'artist', albums: 'album', playlists: 'playlist' };

interface Fetched {
  results: Partial<SearchResultsData>;
  hasMore: boolean;
  /** Set when every request failed. */
  error?: unknown;
}

async function fetchResults(provider: SearchProvider, filter: SearchFilter, q: string, tag: string | undefined, offset: number): Promise<Fetched> {
  if (provider === 'spotify') {
    const single = SPOTIFY_TYPE[filter];
    const types: SpotifySearchType[] = single ? [single] : ['track', 'artist', 'album', 'playlist'];
    const r = await spotifyApi.search(types, q, { limit: pageSizeFor('spotify'), offset });
    return {
      results: { songs: r.tracks.items, artists: r.artists.items, albums: r.albums.items, playlists: r.playlists.items },
      hasMore: single === 'track' ? r.tracks.hasMore : single === 'artist' ? r.artists.hasMore : single === 'album' ? r.albums.hasMore : single === 'playlist' ? r.playlists.hasMore : false,
    };
  }

  // Jamendo (or the offline demo catalogue when no backend is configured).
  const limit = filter === 'all' ? 10 : pageSizeFor('jamendo');
  const want = (f: SearchFilter) => filter === 'all' || filter === f;
  const jobs = {
    songs: want('songs') ? musicApi.searchSongs(q, { limit, offset, tag }) : null,
    albums: want('albums') ? musicApi.searchAlbums(q, { limit, offset }) : null,
    artists: want('artists') ? musicApi.searchArtists(q, { limit, offset }) : null,
    playlists: want('playlists') ? musicApi.searchPlaylists(q, { limit, offset }) : null,
    // Podcasts only exist in the demo catalogue; never mix them into live Jamendo results.
    podcasts: !isLiveCatalogue && want('podcasts') ? musicApi.searchPodcasts(q) : null,
  };
  const entries = Object.entries(jobs).filter(([, p]) => p !== null) as [keyof typeof jobs, Promise<unknown>][];
  const settled = await Promise.allSettled(entries.map(([, p]) => p));

  const out: Partial<SearchResultsData> = {};
  let hasMore = false;
  let firstError: unknown;
  entries.forEach(([name], i) => {
    const r = settled[i];
    if (r.status === 'rejected') {
      firstError ??= r.reason;
      return;
    }
    if (name === 'podcasts') {
      const v = r.value as { shows: Podcast[]; episodes: Track[] };
      out.podcasts = v.shows;
      out.episodes = v.episodes;
    } else {
      const v = r.value as { items: never[]; hasMore: boolean };
      (out as Record<string, unknown>)[name] = v.items;
      if (filter !== 'all') hasMore = v.hasMore;
    }
  });
  return { results: out, hasMore, error: settled.every((s) => s.status === 'rejected') ? firstError : undefined };
}

/**
 * Debounced live search. Provider catalogues stay separate: `provider` decides which API is queried and results
 * keep their own `source` and provider-specific ids. Out-of-date responses are dropped via the result key.
 */
export function useSearch() {
  const [query, setQuery] = useState('');
  const [committed, setCommitted] = useState('');
  const [provider, setProvider] = useState<SearchProvider>('jamendo');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [tag, setTagState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nonce, setNonce] = useState(0);

  const spotifyStatus = useSpotifyStore((s) => s.status);
  const spotifyConnected = spotifyStatus === 'connected';

  // Automatic search 400ms after the last keystroke.
  useEffect(() => {
    const trimmed = query.trim();
    const t = setTimeout(() => setCommitted(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const activeTag = provider === 'jamendo' ? (tag ?? undefined) : undefined;
  const canSearch = committed.length > 0 || !!activeTag;
  const blockedBySpotifyAuth = provider === 'spotify' && !spotifyConnected;
  const key = `${provider}|${filter}|${committed}|${activeTag ?? ''}#${nonce}`;

  useEffect(() => {
    if (!canSearch || blockedBySpotifyAuth) return;
    let cancelled = false;
    (async () => {
      let data: Loaded;
      try {
        const r = await fetchResults(provider, filter, committed, activeTag, 0);
        data = {
          key,
          results: { ...EMPTY, ...r.results },
          hasMore: r.hasMore,
          error: r.error ? errorMessage(r.error, 'Search failed. Please try again.') : null,
          authRequired: r.error instanceof SpotifyAuthError,
        };
      } catch (e) {
        data = { key, results: EMPTY, hasMore: false, error: errorMessage(e, 'Search failed. Please try again.'), authRequired: e instanceof SpotifyAuthError };
      }
      if (!cancelled) setLoaded(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, canSearch, blockedBySpotifyAuth, provider, filter, committed, activeTag]);

  const current = canSearch && loaded?.key === key ? loaded : null;
  const hasQuery = query.trim().length > 0 || tag !== null;
  // Either the committed query is still being fetched, or the user is mid-typing ahead of the debounce.
  const loading = hasQuery && !blockedBySpotifyAuth && (!current || query.trim() !== committed);

  const loadMore = async () => {
    if (!current || !current.hasMore || loadingMore) return;
    const listKey: Record<SearchFilter, keyof SearchResultsData | null> = { all: null, songs: 'songs', artists: 'artists', albums: 'albums', playlists: 'playlists', podcasts: null };
    const field = listKey[filter];
    if (!field) return;
    setLoadingMore(true);
    try {
      const offset = current.results[field].length;
      const r = await fetchResults(provider, filter, committed, activeTag, offset);
      const incoming = (r.results[field] ?? []) as { id: string }[];
      setLoaded((prev) => {
        if (!prev || prev.key !== current.key) return prev; // query changed meanwhile: drop the stale page
        const existing = prev.results[field] as { id: string }[];
        const merged = [...existing, ...incoming.filter((n) => !existing.some((e) => e.id === n.id))];
        return { ...prev, hasMore: r.hasMore && incoming.length > 0, results: { ...prev.results, [field]: merged } };
      });
    } catch {
      setLoaded((prev) => (prev && prev.key === current.key ? { ...prev, hasMore: false } : prev));
    } finally {
      setLoadingMore(false);
    }
  };

  const history = useLibraryStore((s) => s.searchHistory);
  const { addSearch, removeSearch, clearSearch } = useLibraryStore.getState();

  return {
    query,
    setQuery,
    /** Search now (search button / keyboard "search"), skipping the debounce. */
    submit: () => {
      const q = query.trim();
      setCommitted(q);
      setNonce((n) => n + 1);
      addSearch(q);
    },
    clear: () => {
      setQuery('');
      setCommitted('');
    },
    provider,
    setProvider: (p: SearchProvider) => {
      setProvider(p);
      // Filters differ per catalogue (e.g. demo-only podcasts), so reset to the common one.
      setFilter('all');
    },
    filter,
    setFilter,
    tag,
    setTag: setTagState,
    hasQuery,
    results: current?.results ?? EMPTY,
    loading,
    error: current?.error ?? null,
    authRequired: blockedBySpotifyAuth || (current?.authRequired ?? false),
    hasMore: current?.hasMore ?? false,
    loadingMore,
    loadMore,
    retry: () => setNonce((n) => n + 1),
    history,
    addSearch,
    removeSearch,
    clearSearch,
  };
}
