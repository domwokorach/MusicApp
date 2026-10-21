import { useLocalSearchParams } from 'expo-router';

import { CollageCover, GradientCover, PlaylistCover } from '@/components/common/Artwork';
import { CollectionView } from '@/components/music/CollectionView';
import { usePlaylistView } from '@/hooks/useMusic';
import { usePlaylistActions, useUserPlaylist } from '@/hooks/usePlaylist';
import { goBack } from '@/utils/nav';

/** Handles Liked Songs (id "liked"), user playlists ("u_…") and curated / category playlists. */
export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { view, loading, error, reload } = usePlaylistView(id);
  const user = useUserPlaylist(view?.userPlaylistId);
  const actions = usePlaylistActions();

  const color = view?.color ?? '#4A00E0';
  const cover = id === 'liked' ? (
    <GradientCover colors={['#4A00E0', '#8E2DE2']} size={220} radius={8} icon="heart" />
  ) : user ? (
    <PlaylistCover playlist={user} size={220} radius={8} />
  ) : (
    <CollageCover urls={view?.playlist?.coverUrls} uri={view?.playlist?.artworkUrl} color={color} size={220} radius={8} />
  );

  return (
    <CollectionView
      kicker={id === 'liked' ? 'PLAYLIST' : user ? 'YOUR PLAYLIST' : 'PLAYLIST'}
      title={view?.title ?? 'Playlist'}
      subtitle={view?.description ?? ''}
      meta={view ? `${view.tracks.length} songs` : undefined}
      color={color}
      cover={cover}
      tracks={view?.tracks ?? []}
      label={view?.title ?? 'Playlist'}
      loading={loading}
      error={error}
      onRetry={reload}
      userPlaylistId={view?.userPlaylistId}
      externalUrl={view?.playlist?.externalUrl}
      onDelete={user ? () => actions.remove(user.id, user.name, goBack) : undefined}
      emptyTitle={id === 'liked' ? 'No liked songs yet' : 'It’s quiet in here'}
      emptyMessage={user ? 'Add songs from any track’s menu, or edit the playlist.' : 'Tap the heart on a song to add it here.'}
    />
  );
}
