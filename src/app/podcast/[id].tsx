import { useLocalSearchParams } from 'expo-router';

import { Artwork } from '@/components/common/Artwork';
import { CollectionView } from '@/components/music/CollectionView';
import { usePodcast } from '@/hooks/useMusic';
import { colorFromString } from '@/utils/helpers';

export default function PodcastScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = usePodcast(id);
  const podcast = data?.podcast;
  const color = podcast?.color ?? colorFromString(id);

  return (
    <CollectionView
      kicker="PODCAST"
      title={podcast?.title ?? 'Podcast'}
      subtitle={podcast?.description ?? ''}
      meta={podcast ? [podcast.publisher ?? podcast.host, podcast.source === 'spotify' ? 'Spotify podcast' : podcast.category].join(' · ') : undefined}
      color={color}
      cover={<Artwork uri={podcast?.artworkUrl} color={color} size={220} radius={8} placeholderIcon="mic" />}
      tracks={data?.episodes ?? []}
      label={podcast?.title ?? 'Podcast'}
      loading={loading}
      error={error}
      onRetry={reload}
      tracksTitle="Episodes"
      externalUrl={podcast?.externalUrl}
      emptyTitle="No episodes"
      emptyMessage="This show has no episodes yet."
    />
  );
}
