import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { zustandStorage } from '@/services/storageService';
import type { Album, Artist, Track } from '@/types/music';

interface LibraryState {
  liked: Track[];
  savedAlbums: Album[];
  followedArtists: Artist[];
  recent: Track[];
  searchHistory: string[];

  toggleLike: (track: Track) => boolean;
  toggleAlbum: (album: Album) => boolean;
  toggleArtist: (artist: Artist) => boolean;
  addRecent: (track: Track) => void;
  addSearch: (query: string) => void;
  removeSearch: (query: string) => void;
  clearSearch: () => void;
}

/** Add to the front, or remove if already present. Returns the new list. */
const toggleById = <T extends { id: string }>(list: T[], item: T) => (list.some((x) => x.id === item.id) ? list.filter((x) => x.id !== item.id) : [item, ...list]);

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      liked: [],
      savedAlbums: [],
      followedArtists: [],
      recent: [],
      searchHistory: [],

      toggleLike: (track) => {
        const liked = toggleById(get().liked, track);
        set({ liked });
        return liked.some((t) => t.id === track.id);
      },
      toggleAlbum: (album) => {
        const savedAlbums = toggleById(get().savedAlbums, album);
        set({ savedAlbums });
        return savedAlbums.some((a) => a.id === album.id);
      },
      toggleArtist: (artist) => {
        const followedArtists = toggleById(get().followedArtists, artist);
        set({ followedArtists });
        return followedArtists.some((a) => a.id === artist.id);
      },
      // One entry per track (provider-prefixed id, so Jamendo and Spotify never collide), newest first.
      // The full Track is kept: provider (source), id, title, artist, artwork URL and stream reference (audioUrl).
      addRecent: (track) => set((s) => ({ recent: [{ ...track, playedAt: Date.now() }, ...s.recent.filter((t) => t.id !== track.id)].slice(0, 30) })),

      addSearch: (query) => {
        const q = query.trim();
        if (!q) return;
        set((s) => ({ searchHistory: [q, ...s.searchHistory.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 12) }));
      },
      removeSearch: (query) => set((s) => ({ searchHistory: s.searchHistory.filter((x) => x !== query) })),
      clearSearch: () => set({ searchHistory: [] }),
    }),
    {
      name: 'sonara-library-v2',
      version: 3,
      storage: zustandStorage,
      migrate: (persisted, version) => {
        const state = persisted as { recent?: { playedAt?: number }[] };
        // v2 history had no timestamps: keep the order by back-dating entries one minute apart.
        if (version < 3 && Array.isArray(state.recent)) state.recent = state.recent.map((t, i) => ({ ...t, playedAt: t.playedAt ?? Date.now() - (i + 1) * 60_000 }));
        return state as never;
      },
    },
  ),
);

export const useIsLiked = (trackId: string | undefined) => useLibraryStore((s) => (trackId ? s.liked.some((t) => t.id === trackId) : false));
