import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Artwork } from '@/components/common/Artwork';
import { EmptyState } from '@/components/common/EmptyState';
import { IconButton } from '@/components/common/primitives';
import { colors, type } from '@/constants/theme';
import { usePlayerStore } from '@/store/playerStore';

/** Now-playing row plus the upcoming queue, with jump / reorder / remove controls. */
export function QueueList({ bottomInset = 0 }: { bottomInset?: number }) {
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.index);
  const current = usePlayerStore((s) => s.current);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const label = usePlayerStore((s) => s.contextLabel);
  const { removeFromQueue, moveInQueue, jumpTo, clearUpcoming } = usePlayerStore.getState();

  const upcoming = queue.slice(index + 1);

  return (
    <FlatList
      data={upcoming}
      keyExtractor={(t, i) => `${t.id}-${i}`}
      contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
      ListHeaderComponent={
        <View>
          <Text style={styles.section}>Now playing</Text>
          {current ? (
            <View style={styles.row}>
              <Artwork uri={current.artworkUrl} color={current.color} size={50} radius={6} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.green }]} numberOfLines={1}>
                  {current.title}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {current.artistName}
                  {isPlaying ? ' · playing' : ' · paused'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.sub, { paddingHorizontal: 16 }]}>Nothing is playing.</Text>
          )}
          <View style={styles.nextHeader}>
            <Text style={styles.section}>{label ? `Next from ${label}` : 'Next up'}</Text>
            {upcoming.length > 0 ? (
              <Pressable onPress={clearUpcoming} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear upcoming queue">
                <Text style={styles.clear}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      }
      ListEmptyComponent={<EmptyState icon="list-outline" title="Your queue is empty" message="Use “Add to queue” or “Play next” on any song." />}
      renderItem={({ item: t, index: i }) => {
        const abs = index + 1 + i;
        return (
          <View style={styles.row}>
            <Pressable
              onPress={() => jumpTo(abs)}
              accessibilityRole="button"
              accessibilityLabel={`Play ${t.title} by ${t.artistName}`}
              style={({ pressed }) => [styles.main, pressed && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Artwork uri={t.artworkUrl} color={t.color} size={50} radius={6} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {t.title}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {t.artistName}
                </Text>
              </View>
            </Pressable>
            <IconButton name="chevron-up" size={20} label={`Move ${t.title} up`} disabled={i === 0} onPress={() => moveInQueue(abs, abs - 1)} />
            <IconButton name="chevron-down" size={20} label={`Move ${t.title} down`} disabled={i === upcoming.length - 1} onPress={() => moveInQueue(abs, abs + 1)} />
            <IconButton name="close" size={20} label={`Remove ${t.title} from queue`} onPress={() => removeFromQueue(abs)} />
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  section: { ...type.heading, color: colors.text, paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  nextHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 },
  clear: { ...type.body, color: colors.textSecondary, fontWeight: '700', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingLeft: 16 },
  title: { ...type.body, fontWeight: '600', color: colors.text, marginLeft: 6 },
  sub: { ...type.small, color: colors.textSecondary, marginTop: 2, marginLeft: 6 },
});
