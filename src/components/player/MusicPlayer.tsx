import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Dimensions, Linking, PanResponder, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/common/BottomSheet';
import { EmptyState } from '@/components/common/EmptyState';
import { IconButton, PrimaryButton } from '@/components/common/primitives';
import { colors, radii, type } from '@/constants/theme';
import { ROUTES } from '@/constants/routes';
import { usePlayer } from '@/hooks/usePlayer';
import { useUIStore } from '@/store/uiStore';
import { formatDuration } from '@/utils/formatDuration';
import { shade } from '@/utils/helpers';
import { goBack, openCollection } from '@/utils/nav';
import { shareTrack } from '@/utils/share';

import { AlbumArtwork } from './AlbumArtwork';
import { PlayerControls } from './PlayerControls';
import { ProgressBar } from './ProgressBar';

/** Full-screen player: dynamic gradient, large artwork, scrubber, controls, credits and swipe-down dismissal. */
export function MusicPlayer() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { track, error, position, duration, volume, contextLabel, liked, toggleLike, seek, setVolume } = usePlayer();

  const [dragPos, setDragPos] = useState<number | null>(null);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  // Swipe-down-to-dismiss on the header + artwork area.
  const translateY = useSharedValue(0);
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => translateY.set(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 1) {
          translateY.set(withTiming(Dimensions.get('window').height, { duration: 200 }));
          setTimeout(goBack, 190);
        } else {
          translateY.set(withSpring(0, { damping: 18, stiffness: 220 }));
        }
      },
      onPanResponderTerminate: () => translateY.set(withSpring(0)),
    }),
  );
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  if (!track) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <IconButton name="chevron-down" label="Close player" onPress={goBack} style={{ margin: 8 }} />
        <EmptyState icon="musical-notes-outline" title="Nothing playing" message="Pick a song to start listening." action={<PrimaryButton label="Browse music" onPress={goBack} />} />
      </View>
    );
  }

  const artSize = Math.min(width - 48, height * 0.4, 420);
  const shown = dragPos ?? position;
  const max = duration > 0 ? duration : 1;

  return (
    <Animated.View style={[styles.fill, sheetStyle]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />
      <Animated.View key={track.color} entering={FadeIn.duration(600)} exiting={FadeOut.duration(600)} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[shade(track.color, 0.85), shade(track.color, 0.4), colors.bg]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <View style={{ paddingTop: insets.top + 4 }} {...pan.panHandlers}>
        <View style={styles.header}>
          <IconButton name="chevron-down" label="Close player" size={28} onPress={goBack} />
          <View style={styles.headerCenter}>
            <Text style={styles.playingFrom}>{track.kind === 'episode' ? 'PLAYING EPISODE' : 'PLAYING FROM'}</Text>
            <Text style={styles.playingName} numberOfLines={1}>
              {contextLabel || track.albumName || track.artistName}
            </Text>
          </View>
          <IconButton name="ellipsis-horizontal" label="More options" onPress={() => useUIStore.getState().openMenu(track)} />
        </View>
        <AlbumArtwork track={track} size={artSize} />
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: insets.bottom + 24 }}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
              {track.title}
            </Text>
            <Pressable
              disabled={!track.artistId}
              onPress={() => {
                if (!track.artistId) return;
                goBack();
                setTimeout(() => openCollection('artist', track.artistId!), 250);
              }}
              accessibilityRole="link"
              accessibilityLabel={`Artist ${track.artistName}`}>
              <Text style={styles.artist} numberOfLines={1}>
                {track.artistName}
              </Text>
            </Pressable>
          </View>
          <IconButton name={liked ? 'heart' : 'heart-outline'} color={liked ? colors.green : colors.text} size={28} label={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'} onPress={toggleLike} />
        </View>

        <View style={{ marginTop: 12 }}>
          <ProgressBar label="Playback position" valueText={`${formatDuration(shown)} of ${formatDuration(duration)}`} value={position} max={max} onDrag={setDragPos} onSeek={seek} />
          <View style={styles.times}>
            <Text style={styles.time}>{formatDuration(shown)}</Text>
            <Text style={styles.time}>{duration > 0 ? `-${formatDuration(duration - shown)}` : '--:--'}</Text>
          </View>
        </View>

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <PlayerControls />

        <View style={styles.bottomRow}>
          <IconButton name="volume-medium-outline" label="Audio output and volume" onPress={() => setOutputOpen(true)} />
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <IconButton name="share-outline" label="Share" onPress={() => void shareTrack(track)} />
            <IconButton name="list" label="Open queue" onPress={() => router.push(ROUTES.queue)} />
          </View>
        </View>

        <View style={[styles.credits, { backgroundColor: shade(track.color, 0.5) }]}>
          <Pressable
            onPress={() => {
              setCreditsOpen((o) => !o);
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: creditsOpen }}
            accessibilityLabel="Credits"
            style={styles.creditsHeader}>
            <Text style={styles.creditsTitle}>Credits</Text>
            <Ionicons name={creditsOpen ? 'chevron-up' : 'chevron-down'} size={22} color={colors.text} />
          </Pressable>
          {creditsOpen ? (
            <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 14, marginTop: 14 }}>
              <CreditGroup label="Performed by" names={track.credits?.performers ?? [track.artistName]} />
              {track.credits?.writers.length ? <CreditGroup label="Written by" names={track.credits.writers} /> : null}
              {track.credits?.producers.length ? <CreditGroup label="Produced by" names={track.credits.producers} /> : null}
              {track.albumName ? <CreditGroup label={track.kind === 'episode' ? 'Show' : 'Album'} names={[track.albumName]} /> : null}
              {track.genre ? <CreditGroup label="Genre" names={[track.genre]} /> : null}
              {track.source === 'jamendo' ? (
                <View style={{ gap: 8 }}>
                  <Text style={styles.creditLabel}>Licence & attribution</Text>
                  <Text style={styles.creditName}>“{track.title}” by {track.artistName}, via Jamendo</Text>
                  {track.shareUrl ? (
                    <Pressable onPress={() => void Linking.openURL(track.shareUrl!)} accessibilityRole="link" accessibilityLabel="Open track on Jamendo">
                      <Text style={[styles.creditLabel, { color: colors.green }]}>Open on Jamendo</Text>
                    </Pressable>
                  ) : null}
                  {track.licenseUrl ? (
                    <Pressable onPress={() => void Linking.openURL(track.licenseUrl!)} accessibilityRole="link" accessibilityLabel="View Creative Commons licence">
                      <Text style={[styles.creditLabel, { color: colors.green }]}>View Creative Commons licence</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </Animated.View>
          ) : (
            <Text style={styles.creditsPreview} numberOfLines={1}>
              {(track.credits?.performers ?? [track.artistName]).join(', ')} · tap to expand
            </Text>
          )}
        </View>
      </ScrollView>

      <BottomSheet visible={outputOpen} onClose={() => setOutputOpen(false)} title="Audio output">
        <View style={styles.outputRow}>
          <Ionicons name="phone-portrait-outline" size={24} color={colors.green} />
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { color: colors.green, fontWeight: '700' }]}>This device</Text>
            <Text style={styles.outputSub}>Currently playing through the active system output</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <Ionicons name="volume-low" size={20} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <ProgressBar label="Volume" value={volume} max={1} onSeek={setVolume} onDrag={(v) => v !== null && setVolume(v)} />
          </View>
          <Ionicons name="volume-high" size={20} color={colors.textSecondary} />
        </View>
        <Text style={styles.outputNote}>Bluetooth, AirPlay and cast devices are chosen from your phone’s system controls, and playback follows automatically.</Text>
        <PrimaryButton label="Open device settings" variant="outline" onPress={() => void Linking.openSettings()} />
      </BottomSheet>
    </Animated.View>
  );
}

function CreditGroup({ label, names }: { label: string; names: string[] }) {
  return (
    <View>
      <Text style={styles.creditLabel}>{label}</Text>
      <Text style={styles.creditName}>{names.join(', ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 52 },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  playingFrom: { ...type.tiny, color: 'rgba(255,255,255,0.7)' },
  playingName: { ...type.small, fontWeight: '700', color: colors.text, marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  artist: { ...type.heading, fontSize: 16, fontWeight: '500', color: 'rgba(255,255,255,0.72)', marginTop: 2 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  time: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.7)', fontVariant: ['tabular-nums'] },
  error: { ...type.small, color: colors.danger, textAlign: 'center', marginTop: 8 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  credits: { marginTop: 20, borderRadius: radii.lg, padding: 16 },
  creditsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  creditsTitle: { ...type.heading, color: colors.text },
  creditsPreview: { ...type.small, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
  creditLabel: { ...type.tiny, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' },
  creditName: { ...type.body, fontWeight: '700', color: colors.text, marginTop: 3 },
  outputRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  outputSub: { ...type.small, color: colors.textSecondary, marginTop: 2 },
  outputNote: { ...type.small, color: colors.textSecondary, marginVertical: 16 },
});
