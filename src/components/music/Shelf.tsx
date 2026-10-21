import type { ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionTitle } from '@/components/common/primitives';
import { Skeleton } from '@/components/common/Skeleton';
import { colors, type } from '@/constants/theme';

interface ShelfProps<T> {
  title: string;
  items: T[];
  renderItem?: (item: T) => ReactElement;
  /** Show skeleton cards while the first load is in flight. */
  loading?: boolean;
  /** Inline error (only shown when there is nothing to display). */
  error?: string | null;
  onRetry?: () => void;
  /** Attribution / provenance line, e.g. "Artwork and metadata from Spotify". */
  caption?: string;
  cardSize?: number;
  round?: boolean;
}

/** Titled horizontal row with skeleton, error and empty handling. Renders nothing when there is nothing to show. */
export function Shelf<T extends { id: string }>({ title, items, renderItem, loading, error, onRetry, caption, cardSize = 148, round }: ShelfProps<T>) {
  if (items.length === 0 && !loading && !error) return null;
  return (
    <View style={{ marginTop: 24 }}>
      <SectionTitle>{title}</SectionTitle>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      {items.length === 0 && loading ? (
        <View style={styles.row} accessibilityLabel={`Loading ${title}`}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: cardSize }}>
              <Skeleton width={cardSize} height={cardSize} radius={round ? cardSize / 2 : 10} />
              <Skeleton width={cardSize * 0.75} height={12} radius={4} style={{ marginTop: 10 }} />
              <Skeleton width={cardSize * 0.5} height={10} radius={4} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      ) : items.length === 0 && error ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
          {onRetry ? (
            <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={`Retry loading ${title}`} hitSlop={8}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(i) => i.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          renderItem={({ item }) => (renderItem ? renderItem(item) : null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 14, flexDirection: 'row' },
  caption: { ...type.tiny, color: colors.textMuted, paddingHorizontal: 16, marginTop: -8, marginBottom: 10, textTransform: 'uppercase' },
  errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginHorizontal: 16, padding: 14, borderRadius: 10, backgroundColor: colors.surface },
  errorText: { ...type.small, color: colors.textSecondary, flex: 1 },
  retry: { ...type.body, color: colors.green, fontWeight: '700' },
});
