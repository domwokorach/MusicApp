import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/common/primitives';
import { colors } from '@/constants/theme';
import { usePlayer } from '@/hooks/usePlayer';

/** Shuffle · previous · play/pause · next · repeat. */
export function PlayerControls() {
  const { isPlaying, isBuffering, shuffle, repeat, togglePlay, next, previous, toggleShuffle, cycleRepeat } = usePlayer();

  return (
    <View style={styles.row}>
      <IconButton name="shuffle" size={26} color={shuffle ? colors.green : colors.text} label={shuffle ? 'Shuffle on' : 'Shuffle off'} onPress={toggleShuffle} />
      <IconButton name="play-skip-back" size={34} label="Previous track" onPress={previous} />
      <Pressable
        onPress={togglePlay}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        style={({ pressed }) => [styles.playBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
        {isBuffering ? <ActivityIndicator color="#000" /> : <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color="#000" style={isPlaying ? undefined : { marginLeft: 4 }} />}
      </Pressable>
      <IconButton name="play-skip-forward" size={34} label="Next track" onPress={() => next()} />
      <Pressable
        onPress={cycleRepeat}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'}
        style={styles.iconBtn}>
        <MaterialCommunityIcons name={repeat === 'one' ? 'repeat-once' : 'repeat'} size={26} color={repeat === 'off' ? colors.text : colors.green} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  iconBtn: { alignItems: 'center', justifyContent: 'center', minWidth: 40, minHeight: 40 },
  playBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
});
