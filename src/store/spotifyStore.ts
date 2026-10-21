import { create } from 'zustand';

import { isSpotifyEnabled } from '@/constants/config';
import { SpotifyAuthError, connectSpotify, disconnectSpotify, hasSpotifySession } from '@/services/spotifyAuth';

/** Endpoints that may be blocked for the current Spotify app (Development Mode / missing scope / removed). */
export type SpotifyCapability = 'recentlyPlayed' | 'myPlaylists' | 'savedShows' | 'showSearch';

interface SpotifyState {
  /** Endpoints that answered 403/404 once; we don't hit them again until the user reconnects. */
  unavailable: Partial<Record<SpotifyCapability, string>>;
  markUnavailable: (cap: SpotifyCapability, reason: string) => void;
  status: 'unknown' | 'connected' | 'disconnected';
  connecting: boolean;
  error: string | null;
  init: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  /** Called by the API layer when a token turns out to be unusable. */
  markDisconnected: (reason?: string) => void;
}

export const useSpotifyStore = create<SpotifyState>((set, get) => ({
  unavailable: {},
  markUnavailable: (cap, reason) => set((s) => ({ unavailable: { ...s.unavailable, [cap]: reason } })),
  status: 'unknown',
  connecting: false,
  error: null,

  init: async () => {
    if (get().status !== 'unknown') return;
    set({ status: isSpotifyEnabled && (await hasSpotifySession()) ? 'connected' : 'disconnected' });
  },

  connect: async () => {
    if (get().connecting) return;
    set({ connecting: true, error: null });
    try {
      await connectSpotify();
      set({ status: 'connected', connecting: false, unavailable: {} });
    } catch (e) {
      const cancelled = e instanceof SpotifyAuthError && e.code === 'cancelled';
      set({ connecting: false, error: cancelled ? null : e instanceof Error ? e.message : 'Spotify sign-in failed.' });
    }
  },

  disconnect: async () => {
    await disconnectSpotify();
    set({ status: 'disconnected', error: null, unavailable: {} });
  },

  markDisconnected: (reason) => set({ status: 'disconnected', error: reason ?? null }),
}));
