import { create } from 'zustand';

import type { Track } from '@/types/music';

interface UIState {
  /** Track options sheet. `playlistId` enables "Remove from this playlist". */
  menu: { track: Track; playlistId?: string } | null;
  openMenu: (track: Track, playlistId?: string) => void;
  closeMenu: () => void;

  playlistPickerFor: Track | null;
  openPlaylistPicker: (track: Track) => void;
  closePlaylistPicker: () => void;

  /** Track to pre-select when the create-playlist screen opens. */
  pendingTrack: Track | null;
  setPendingTrack: (t: Track | null) => void;

  toast: { id: number; message: string } | null;
  showToast: (message: string) => void;
  hideToast: () => void;
}

let toastSeq = 0;

export const useUIStore = create<UIState>((set) => ({
  menu: null,
  openMenu: (track, playlistId) => set({ menu: { track, playlistId } }),
  closeMenu: () => set({ menu: null }),

  playlistPickerFor: null,
  openPlaylistPicker: (track) => set({ playlistPickerFor: track }),
  closePlaylistPicker: () => set({ playlistPickerFor: null }),

  pendingTrack: null,
  setPendingTrack: (pendingTrack) => set({ pendingTrack }),

  toast: null,
  showToast: (message) => set({ toast: { id: ++toastSeq, message } }),
  hideToast: () => set({ toast: null }),
}));
