import type { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Artwork } from '@/components/common/Artwork';
import { colors, radii, type } from '@/constants/theme';

export interface MediaCardProps {
  title: string;
  subtitle: string;
  uri?: string;
  color: string;
  size?: number;
  round?: boolean;
  placeholderIcon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

/** Square (or round) artwork card with a title and subtitle. SongCard / AlbumCard / etc. are thin wrappers. */
export const MediaCard = memo(function MediaCard({ title, subtitle, uri, color, size = 148, round, placeholderIcon, onPress }: MediaCardProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}`} style={({ pressed }) => [{ width: size }, pressed && { opacity: 0.7 }]}>
      <Artwork uri={uri} color={color} size={size} round={round} radius={radii.md} placeholderIcon={placeholderIcon} />
      <Text style={[styles.title, round && styles.center]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.subtitle, round && styles.center]} numberOfLines={2}>
        {subtitle}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  title: { ...type.body, fontWeight: '700', color: colors.text, marginTop: 8 },
  subtitle: { ...type.small, color: colors.textSecondary, marginTop: 2 },
  center: { textAlign: 'center' },
});
