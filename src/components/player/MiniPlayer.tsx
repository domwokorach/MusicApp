import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Artwork } from '@/components/common/Artwork';
import { colors, radii, type } from '@/constants/theme';
import { usePlayer } from '@/hooks/usePlayer';
import { usePlayerStore } from '@/store/playerStore';
import { shade } from '@/utils/helpers';
import { openPlayer } from '@/utils/nav';

/** Persistent mini-player; shares the same player store (and native audio instance) as the full-screen player. */
export function MiniPlayer() {
  const { track, isPlaying, isBuffering, error, liked, toggleLike, togglePlay } = usePlayer();
  const progress = usePlayerStore((s) => (s.duration > 0 ? s.position / s.duration : 0));

  if (!track) return null;

  return (
    <Animated.View entering={FadeInDown.duration(220)} style={styles.outer}>
      <View style={[styles.card, { backgroundColor: shade(track.color, 0.55) }]}>
        <Pressable
          onPress={openPlayer}
          accessibilityRole="button"
          accessibilityLabel={`Now playing ${track.title} by ${track.artistName}. Open player`}
          style={styles.main}>
          <Artwork uri={track.artworkUrl} color={track.color} size={42} radius={6} />
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={[styles.artist, error ? { color: colors.danger } : null]} numberOfLines={1}>
              {error ? 'Playback error · tap play to retry' : track.artistName}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={toggleLike} hitSlop={8} accessibilityRole="button" accessibilityLabel={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'} style={styles.btn}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color={liked ? colors.green : colors.text} />
        </Pressable>
        <Pressable onPress={togglePlay} hitSlop={8} accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pause' : 'Play'} style={styles.btn}>
          {isBuffering ? <ActivityIndicator color={colors.text} /> : <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color={colors.text} />}
        </Pressable>
        <View style={styles.progressTrack} pointerEvents="none">
          <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 8, paddingBottom: 6 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: radii.md, overflow: 'hidden' },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1 },
  title: { ...type.small, fontWeight: '700', color: colors.text },
  artist: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { position: 'absolute', left: 8, right: 8, bottom: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1 },
  progressFill: { height: 2, backgroundColor: colors.text, borderRadius: 1 },
});
