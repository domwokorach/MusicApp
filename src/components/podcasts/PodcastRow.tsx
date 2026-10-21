import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Artwork } from '@/components/common/Artwork';
import { colors, type } from '@/constants/theme';
import type { Podcast } from '@/types/music';
import { openCollection } from '@/utils/nav';

/** Search-result style row for a podcast show: artwork, title, publisher, episode count and description. */
export function PodcastRow({ podcast }: { podcast: Podcast }) {
  const meta = [podcast.publisher ?? podcast.host, podcast.episodeCount ? `${podcast.episodeCount} episodes` : ''].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => openCollection('podcast', podcast.id)}
      accessibilityRole="button"
      accessibilityLabel={`${podcast.title}, ${meta}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
      <Artwork uri={podcast.artworkUrl} color={podcast.color} size={72} radius={8} placeholderIcon="mic" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {podcast.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
        {podcast.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {podcast.description}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  title: { ...type.body, fontWeight: '700', color: colors.text },
  meta: { ...type.small, color: colors.textSecondary, marginTop: 2 },
  desc: { ...type.small, color: colors.textMuted, marginTop: 4 },
});
