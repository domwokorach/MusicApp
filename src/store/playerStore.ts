import { create } from 'zustand';

import { musicApi } from '@/services/api/musicApi';
import * as audio from '@/services/audioService';
import type { Track } from '@/types/music';
import type { RepeatMode } from '@/types/player';
import { shuffled } from '@/utils/helpers';

import { useLibraryStore } from './libraryStore';
import { useUIStore } from './uiStore';

interface PlayerState {
  /** Play order (already shuffled when shuffle is on). */
  queue: Track[];
  /** Un-shuffled order, used to restore when shuffle is switched off. */
  baseQueue: Track[];
  index: number;
  current: Track | null;
  contextLabel: string;

  isPlaying: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  error: string | null;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;

  playQueue: (tracks: Track[], start?: Track, label?: string) => void;
  togglePlay: () => void;
  next: (auto?: boolean) => void;
  previous: () => void;
  seek: (seconds: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (v: number) => void;

  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  jumpTo: (index: number) => void;
  clearUpcoming: () => void;
}

const PLAY_ERROR = 'Couldn’t play this track. Check your connection.';
const NO_AUDIO = 'No licensed audio is available for this track.';

export const usePlayerStore = create<PlayerState>((set, get) => {
  const fail = (message: string) => {
    set({ isPlaying: false, isBuffering: false, error: message });
    useUIStore.getState().showToast(message);
  };

  // Jamendo stream URLs can be signed and time-limited, so a track replayed from history may carry a stale one.
  // On failure we ask the API for a fresh copy of the track once, then give up with an error.
  const refreshed = new Set<string>();
  const recover = async (track: Track): Promise<boolean> => {
    if (track.source !== 'jamendo' || refreshed.has(track.id)) return false;
    refreshed.add(track.id);
    try {
      const fresh = await musicApi.getTrack(track.id);
      if (!fresh.audioUrl || get().current?.id !== track.id) return false;
      const merged: Track = { ...track, ...fresh, artworkUrl: fresh.artworkUrl ?? track.artworkUrl };
      set({ current: merged, error: null, isBuffering: true });
      await audio.load(fresh.audioUrl, { title: merged.title, artist: merged.artistName, album: merged.albumName, artwork: merged.artworkUrl }, true);
      return true;
    } catch {
      return false;
    }
  };
  const onPlaybackError = (track: Track | null) => {
    if (!track) return fail(PLAY_ERROR);
    void recover(track).then((ok) => {
      if (!ok && get().current?.id === track.id) fail(PLAY_ERROR);
    });
  };

  const startTrack = (track: Track, autoplay = true) => {
    set({ current: track, position: 0, duration: track.durationSec ?? 0, error: null, isBuffering: !!track.audioUrl, isPlaying: false });
    if (!track.audioUrl) {
      audio.pause();
      fail(NO_AUDIO);
      return;
    }
    set({ isPlaying: autoplay });
    useLibraryStore.getState().addRecent(track);
    audio
      .load(track.audioUrl, { title: track.title, artist: track.artistName, album: track.albumName, artwork: track.artworkUrl }, autoplay)
      .catch(() => onPlaybackError(track));
  };

  const goTo = (index: number, autoplay = true) => {
    const track = get().queue[index];
    if (!track) return;
    set({ index });
    startTrack(track, autoplay);
  };

  audio.onStatus((s) => {
    if (s.error) {
      if (!get().error) onPlaybackError(get().current);
      return;
    }
    if (s.playing) refreshed.delete(get().current?.id ?? '');
    set({
      isPlaying: s.playing,
      isBuffering: s.buffering && !s.playing,
      position: s.position,
      duration: s.duration || get().duration,
    });
    if (s.finished) get().next(true);
  });

  return {
    queue: [],
    baseQueue: [],
    index: 0,
    current: null,
    contextLabel: '',
    isPlaying: false,
    isBuffering: false,
    position: 0,
    duration: 0,
    error: null,
    shuffle: false,
    repeat: 'off',
    volume: 1,

    playQueue: (all, start, label = '') => {
      // Metadata-only tracks (e.g. Spotify) have no licensed stream: they never enter the queue.
      const tracks = all.filter((t) => !!t.audioUrl);
      if (start && !start.audioUrl) {
        useUIStore.getState().showToast(start.source === 'spotify' ? 'Spotify tracks can’t be played in this app.' : NO_AUDIO);
        return;
      }
      if (tracks.length === 0) return;
      const first =
        (start && tracks.find((t) => t.id === start.id)) || (get().shuffle ? tracks[Math.floor(Math.random() * tracks.length)] : tracks[0]);
      const firstAt = tracks.indexOf(first);
      const queue = get().shuffle ? [first, ...shuffled(tracks.filter((_, i) => i !== firstAt))] : tracks;
      set({ queue, baseQueue: tracks, contextLabel: label });
      goTo(queue.indexOf(first));
    },

    togglePlay: () => {
      const { current, isPlaying, error } = get();
      if (!current) return;
      if (error) {
        startTrack(current);
        return;
      }
      if (isPlaying) {
        audio.pause();
        set({ isPlaying: false });
      } else {
        audio.play();
        set({ isPlaying: true });
      }
    },

    next: (auto = false) => {
      const { queue, index, repeat } = get();
      if (queue.length === 0) return;
      if (auto && repeat === 'one') {
        audio.seek(0).then(() => audio.play());
        return;
      }
      const nextIndex = index + 1;
      if (nextIndex < queue.length) return goTo(nextIndex);
      if (repeat === 'all' || !auto) return goTo(0);
      // End of queue with repeat off: rewind to the first track and stop.
      goTo(0, false);
    },

    previous: () => {
      const { position, index, queue, repeat } = get();
      if (position > 3 || queue.length === 0) {
        audio.seek(0);
        set({ position: 0 });
        return;
      }
      if (index > 0) return goTo(index - 1);
      if (repeat === 'all') return goTo(queue.length - 1);
      audio.seek(0);
      set({ position: 0 });
    },

    seek: (seconds) => {
      set({ position: seconds });
      audio.seek(seconds).catch(() => undefined);
    },

    toggleShuffle: () => {
      const { shuffle, current, baseQueue } = get();
      if (!shuffle) {
        const rest = shuffled(baseQueue.filter((t, i) => !(current && t.id === current.id && i === baseQueue.findIndex((x) => x.id === current.id))));
        set({ shuffle: true, queue: current ? [current, ...rest] : rest, index: 0 });
      } else {
        set({ shuffle: false, queue: baseQueue, index: Math.max(0, baseQueue.findIndex((t) => t.id === current?.id)) });
      }
    },

    cycleRepeat: () => set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),

    setVolume: (v) => {
      audio.setVolume(v);
      set({ volume: v });
    },

    addToQueue: (track) => {
      const { current, queue, baseQueue } = get();
      if (!current) return get().playQueue([track], track);
      set({ queue: [...queue, track], baseQueue: [...baseQueue, track] });
    },

    playNext: (track) => {
      const { current, queue, baseQueue, index } = get();
      if (!current) return get().playQueue([track], track);
      const q = [...queue];
      q.splice(index + 1, 0, track);
      set({ queue: q, baseQueue: [...baseQueue, track] });
    },

    removeFromQueue: (i) => {
      const { queue, index } = get();
      if (i === index || i < 0 || i >= queue.length) return;
      const q = queue.filter((_, n) => n !== i);
      set({ queue: q, baseQueue: get().shuffle ? get().baseQueue : q, index: i < index ? index - 1 : index });
    },

    moveInQueue: (from, to) => {
      const { queue, index } = get();
      if (to < 0 || to >= queue.length || from === index || to === index) return;
      const q = [...queue];
      const [item] = q.splice(from, 1);
      q.splice(to, 0, item);
      set({ queue: q, baseQueue: get().shuffle ? get().baseQueue : q });
    },

    jumpTo: (i) => goTo(i),

    clearUpcoming: () => {
      const { queue, index } = get();
      const q = queue.slice(0, index + 1);
      set({ queue: q, baseQueue: get().shuffle ? get().baseQueue : q });
    },
  };
});
