import type { Artist } from '@/types/music';
import { openCollection } from '@/utils/nav';

import { MediaCard } from './MediaCard';

export function ArtistCard({ artist, size = 128 }: { artist: Artist; size?: number }) {
  return (
    <MediaCard
      title={artist.name}
      subtitle={artist.followers ? `${artist.followers} followers` : 'Artist'}
      uri={artist.imageUrl}
      color={artist.color}
      size={size}
      round
      onPress={() => openCollection('artist', artist.id)}
    />
  );
}
