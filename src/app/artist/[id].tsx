import { useLocalSearchParams } from 'expo-router';

import { Artwork } from '@/components/common/Artwork';
import { AlbumCard } from '@/components/music/AlbumCard';
import { CollectionView } from '@/components/music/CollectionView';
import { Shelf } from '@/components/music/Shelf';
import { useArtist } from '@/hooks/useMusic';
import { useLibraryStore } from '@/store/libraryStore';
import { useUIStore } from '@/store/uiStore';
import { colorFromString } from '@/utils/helpers';

export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useArtist(id);
  const following = useLibraryStore((s) => s.followedArtists.some((a) => a.id === id));
  const artist = data?.artist;
  const color = artist?.color ?? colorFromString(id);

  return (
    <CollectionView
      kicker="ARTIST"
      title={artist?.name ?? 'Artist'}
      subtitle={artist?.bio ?? ''}
      meta={artist ? [artist.followers && `${artist.followers} followers`, artist.genre].filter(Boolean).join(' · ') : undefined}
      color={color}
      cover={<Artwork uri={artist?.imageUrl} color={color} size={220} round />}
      tracks={data?.tracks ?? []}
      label={artist?.name ?? 'Artist'}
      loading={loading}
      error={error}
      onRetry={reload}
      tracksTitle="Popular"
      save={artist ? { saved: following, kind: 'follow', onToggle: () => useUIStore.getState().showToast(useLibraryStore.getState().toggleArtist(artist) ? 'Following' : 'Unfollowed') } : undefined}
      emptyTitle="No playable tracks"
      emptyMessage="Browse this artist’s albums below."
      footer={data && data.albums.length > 0 ? <Shelf title="Albums" items={data.albums} renderItem={(a) => <AlbumCard album={a} />} /> : undefined}
    />
  );
}
