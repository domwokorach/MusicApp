import { Pressable, StyleSheet, Text } from 'react-native';

import { CollageCover } from '@/components/common/Artwork';
import { colors, type } from '@/constants/theme';
import type { Playlist, Podcast } from '@/types/music';
import { openCollection } from '@/utils/nav';

import { MediaCard } from './MediaCard';

/** Playlist card: a 2x2 collage of real covers for app-curated mixes, the provider's cover otherwise. */
export function PlaylistCard({ playlist, size = 148 }: { playlist: Playlist; size?: number }) {
  return (
    <Pressable
      onPress={() => openCollection('playlist', playlist.id)}
      accessibilityRole="button"
      accessibilityLabel={`${playlist.title}, ${playlist.description}`}
      style={({ pressed }) => [{ width: size }, pressed && { opacity: 0.7 }]}>
      <CollageCover urls={playlist.coverUrls} uri={playlist.artworkUrl} color={playlist.color} size={size} radius={10} />
      <Text style={styles.title} numberOfLines={1}>
        {playlist.title}
      </Text>
      <Text style={styles.subtitle} numberOfLines={2}>
        {playlist.description}
      </Text>
    </Pressable>
  );
}

export function PodcastCard({ podcast, size }: { podcast: Podcast; size?: number }) {
  return <MediaCard title={podcast.title} subtitle={[podcast.publisher ?? podcast.host, podcast.episodeCount ? `${podcast.episodeCount} episodes` : ''].filter(Boolean).join(' · ')} uri={podcast.artworkUrl} color={podcast.color} size={size} placeholderIcon="mic" onPress={() => openCollection('podcast', podcast.id)} />;
}

const styles = StyleSheet.create({
  title: { ...type.body, fontWeight: '700', color: colors.text, marginTop: 8 },
  subtitle: { ...type.small, color: colors.textSecondary, marginTop: 2 },
});
