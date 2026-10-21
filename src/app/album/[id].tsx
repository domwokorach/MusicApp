import { useLocalSearchParams } from 'expo-router';

import { Artwork } from '@/components/common/Artwork';
import { CollectionView } from '@/components/music/CollectionView';
import { useAlbum } from '@/hooks/useMusic';
import { useLibraryStore } from '@/store/libraryStore';
import { useUIStore } from '@/store/uiStore';
import { colorFromString } from '@/utils/helpers';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useAlbum(id);
  const saved = useLibraryStore((s) => s.savedAlbums.some((a) => a.id === id));
  const album = data?.album;
  const color = album?.color ?? colorFromString(id);

  return (
    <CollectionView
      kicker="ALBUM"
      title={album?.title ?? 'Album'}
      subtitle={album ? album.artistName : ''}
      meta={album ? [album.year, data?.tracks.length ? `${data.tracks.length} songs` : undefined].filter(Boolean).join(' · ') : undefined}
      color={color}
      cover={<Artwork uri={album?.artworkUrl} color={color} size={220} radius={8} />}
      tracks={data?.tracks ?? []}
      label={album?.title ?? 'Album'}
      loading={loading}
      error={error}
      onRetry={reload}
      save={album ? { saved, kind: 'heart', onToggle: () => useUIStore.getState().showToast(useLibraryStore.getState().toggleAlbum(album) ? 'Saved to Your Library' : 'Removed from Your Library') } : undefined}
      emptyTitle="No tracks"
      emptyMessage="This album doesn’t list any tracks."
      footer={undefined}
    />
  );
}
