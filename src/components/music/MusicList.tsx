import { Ionicons } from '@expo/vector-icons';
import { memo, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Artwork } from '@/components/common/Artwork';
import { colors, type } from '@/constants/theme';
import { playTracks } from '@/hooks/usePlayer';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import type { Track } from '@/types/music';
import { openInSpotify } from '@/utils/spotifyLinks';
import { formatMinutes, formatReleaseDate } from '@/utils/formatDuration';

interface RowProps {
  track: Track;
  onPress: () => void;
  /** When rendered inside a user playlist, enables "remove from playlist" in the menu. */
  playlistId?: string;
  index?: number;
  hideMenu?: boolean;
  /** Shows an explicit play/pause button for playable tracks. */
  showPlay?: boolean;
}

export const TrackRow = memo(function TrackRow({ track, onPress, playlistId, index, hideMenu, showPlay }: RowProps) {
  const isCurrent = usePlayerStore((s) => s.current?.id === track.id);
  const isPlaying = usePlayerStore((s) => s.current?.id === track.id && s.isPlaying);
  const openMenu = useUIStore((s) => s.openMenu);
  const unavailable = !track.audioUrl;
  const metadataOnly = unavailable && track.source === 'spotify';

  return (
    <View style={[styles.row, unavailable && !metadataOnly && { opacity: 0.5 }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${track.title} by ${track.artistName}${isCurrent ? ', now playing' : ''}${unavailable ? ', audio unavailable' : ''}`}
        style={({ pressed }) => [styles.main, pressed && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
        {index !== undefined ? <Text style={styles.index}>{index + 1}</Text> : null}
        <Artwork uri={track.artworkUrl} color={track.color} size={50} radius={6} />
        <View style={styles.text}>
          <Text style={[styles.title, isCurrent && { color: colors.green }]} numberOfLines={1}>
            {track.title}
          </Text>
          <View style={styles.subRow}>
            {isPlaying ? <Ionicons name="volume-medium" size={14} color={colors.green} /> : null}
            <Text style={styles.subtitle} numberOfLines={1}>
              {track.kind === 'episode' ? ['Episode', formatReleaseDate(track.releaseDate), track.durationSec ? formatMinutes(track.durationSec) : ''].filter(Boolean).join(' · ') : metadataOnly ? `${track.artistName} · Spotify · metadata only` : unavailable ? `${track.artistName} · no stream available` : track.artistName}
            </Text>
          </View>
        </View>
      </Pressable>
      {showPlay && !unavailable ? (
        <Pressable
          hitSlop={6}
          onPress={() => (isCurrent ? usePlayerStore.getState().togglePlay() : onPress())}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          style={styles.more}>
          <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={32} color={colors.green} />
        </Pressable>
      ) : null}
      {metadataOnly && track.externalUrl ? (
        <Pressable hitSlop={6} onPress={() => void openInSpotify(track.externalUrl)} accessibilityRole="link" accessibilityLabel={`Open ${track.title} in Spotify`} style={styles.more}>
          <Ionicons name="open-outline" size={22} color={colors.green} />
        </Pressable>
      ) : null}
      {hideMenu ? null : (
        <Pressable hitSlop={10} onPress={() => openMenu(track, playlistId)} accessibilityRole="button" accessibilityLabel={`More options for ${track.title}`} style={styles.more}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
});

interface ListProps {
  tracks: Track[];
  label: string;
  playlistId?: string;
  numbered?: boolean;
  header?: ReactElement;
  footer?: ReactElement;
  empty?: ReactElement;
  onEndReached?: () => void;
}

/** Vertical list of tracks. Tapping a row plays the whole list starting from that track. */
export function MusicList({ tracks, label, playlistId, numbered, header, footer, empty, onEndReached }: ListProps) {
  return (
    <FlatList
      data={tracks}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={empty}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item, index }) => (
        <TrackRow track={item} index={numbered ? index : undefined} playlistId={playlistId} onPress={() => playTracks(tracks, item, label)} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 16 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingVertical: 8 },
  index: { width: 20, ...type.small, color: colors.textSecondary, textAlign: 'center' },
  text: { flex: 1 },
  title: { ...type.body, fontWeight: '600', color: colors.text },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  subtitle: { ...type.small, color: colors.textSecondary, flexShrink: 1 },
  more: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
