import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { zustandStorage } from '@/services/storageService';
import type { Track } from '@/types/music';
import type { PlaylistInput, UserPlaylist } from '@/types/playlist';

interface PlaylistState {
  playlists: UserPlaylist[];
  createPlaylist: (input: PlaylistInput) => string;
  updatePlaylist: (id: string, patch: Partial<Omit<UserPlaylist, 'id' | 'createdAt'>>) => void;
  deletePlaylist: (id: string) => void;
  addTrack: (id: string, track: Track) => 'added' | 'duplicate' | 'missing';
  removeTrack: (id: string, trackId: string) => void;
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set, get) => ({
      playlists: [],

      createPlaylist: ({ name, description = '', cover, tracks }) => {
        const id = `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const playlist: UserPlaylist = { id, name: name.trim(), description: description.trim(), cover, tracks, createdAt: Date.now() };
        set((s) => ({ playlists: [playlist, ...s.playlists] }));
        return id;
      },
      updatePlaylist: (id, patch) => set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deletePlaylist: (id) => set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),
      addTrack: (id, track) => {
        const target = get().playlists.find((p) => p.id === id);
        if (!target) return 'missing';
        if (target.tracks.some((t) => t.id === track.id)) return 'duplicate';
        set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, tracks: [...p.tracks, track] } : p)) }));
        return 'added';
      },
      removeTrack: (id, trackId) =>
        set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p)) })),
    }),
    { name: 'sonara-playlists-v2', version: 2, storage: zustandStorage },
  ),
);
