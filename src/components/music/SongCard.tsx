import type { Track } from '@/types/music';

import { MediaCard } from './MediaCard';

export function SongCard({ track, onPress, size }: { track: Track; onPress: () => void; size?: number }) {
  return <MediaCard title={track.title} subtitle={track.kind === 'episode' ? (track.albumName ?? track.artistName) : track.artistName} uri={track.artworkUrl} color={track.color} size={size} onPress={onPress} />;
}
