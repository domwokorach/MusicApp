import { useIsLiked, useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import type { Track } from '@/types/music';
import { openInSpotify } from '@/utils/spotifyLinks';

/** Convenience bundle of player state + actions for UI components. All screens share the same store, hence the same audio. */
export function usePlayer() {
  const track = usePlayerStore((s) => s.current);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const error = usePlayerStore((s) => s.error);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const volume = usePlayerStore((s) => s.volume);
  const contextLabel = usePlayerStore((s) => s.contextLabel);
  const liked = useIsLiked(track?.id);

  const { togglePlay, next, previous, seek, toggleShuffle, cycleRepeat, setVolume } = usePlayerStore.getState();
  const toggleLike = () => {
    if (!track) return;
    const now = useLibraryStore.getState().toggleLike(track);
    useUIStore.getState().showToast(now ? 'Added to Liked Songs' : 'Removed from Liked Songs');
  };

  return { track, isPlaying, isBuffering, error, position, duration, shuffle, repeat, volume, contextLabel, liked, toggleLike, togglePlay, next, previous, seek, toggleShuffle, cycleRepeat, setVolume };
}

/** Starts playback of `tracks` beginning at `start`, e.g. when a row is tapped. */
export function playTracks(tracks: Track[], start: Track, label: string) {
  // Metadata-only items (Spotify) are never played in-app; open them in Spotify instead.
  if (!start.audioUrl && start.source === 'spotify') {
    void openInSpotify(start.externalUrl);
    return;
  }
  usePlayerStore.getState().playQueue(tracks, start, label);
}
