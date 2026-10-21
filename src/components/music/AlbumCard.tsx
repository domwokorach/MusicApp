import type { Album } from '@/types/music';
import { openCollection } from '@/utils/nav';

import { MediaCard } from './MediaCard';

export function AlbumCard({ album, size }: { album: Album; size?: number }) {
  return (
    <MediaCard
      title={album.title}
      subtitle={[album.year, album.artistName].filter(Boolean).join(' · ')}
      uri={album.artworkUrl}
      color={album.color}
      size={size}
      onPress={() => openCollection('album', album.id)}
    />
  );
}
