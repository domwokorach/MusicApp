import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Loading } from '@/components/common/Loading';
import { IconButton } from '@/components/common/primitives';
import { colors, radii, type } from '@/constants/theme';
import { usePlayerStore } from '@/store/playerStore';
import type { Track } from '@/types/music';
import { alpha } from '@/utils/helpers';
import { goBack } from '@/utils/nav';
import { openInSpotify } from '@/utils/spotifyLinks';

import { MusicList } from './MusicList';

export interface CollectionViewProps {
  kicker: string;
  title: string;
  subtitle: string;
  meta?: string;
  color: string;
  cover: ReactNode;
  tracks: Track[];
  label: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Heart (album) or follow (artist) toggle. */
  save?: { saved: boolean; kind: 'heart' | 'follow'; onToggle: () => void };
  /** Editable user playlist: shows edit/delete and enables per-track removal. */
  userPlaylistId?: string;
  onDelete?: () => void;
  tracksTitle?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  footer?: ReactNode;
  /** Page on the provider's own site/app (shown as "Open in Spotify"). */
  externalUrl?: string;
  externalLabel?: string;
}

/** Shared detail layout for albums, artists, playlists, podcasts and Liked Songs. */
export function CollectionView(p: CollectionViewProps) {
  const current = usePlayerStore((s) => s.current);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const shuffle = usePlayerStore((s) => s.shuffle);

  const playingHere = isPlaying && !!current && p.tracks.some((t) => t.id === current.id);

  const playAll = () => {
    const player = usePlayerStore.getState();
    if (p.tracks.length === 0) return;
    if (current && p.tracks.some((t) => t.id === current.id)) player.togglePlay();
    else player.playQueue(p.tracks, p.tracks[0], p.label);
  };
  const shuffleAll = () => {
    const player = usePlayerStore.getState();
    if (p.tracks.length === 0) return;
    if (!player.shuffle) player.toggleShuffle();
    player.playQueue(p.tracks, undefined, p.label);
  };

  const header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.coverShadow}>{p.cover}</View>
        <Text style={styles.kicker}>{p.kicker}</Text>
        <Text style={styles.title}>{p.title}</Text>
        {p.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={3}>
            {p.subtitle}
          </Text>
        ) : null}
        {p.meta ? <Text style={styles.meta}>{p.meta}</Text> : null}
        {p.externalUrl ? (
          <Pressable
            onPress={() => void openInSpotify(p.externalUrl)}
            accessibilityRole="link"
            accessibilityLabel={p.externalLabel ?? 'Open in Spotify'}
            style={styles.external}>
            <Ionicons name="open-outline" size={16} color={colors.text} />
            <Text style={styles.externalText}>{p.externalLabel ?? 'Open in Spotify'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.actions}>
        {p.save ? (
          <IconButton
            name={p.save.saved ? (p.save.kind === 'follow' ? 'checkmark-circle' : 'heart') : p.save.kind === 'follow' ? 'add-circle-outline' : 'heart-outline'}
            color={p.save.saved ? colors.green : colors.text}
            label={p.save.kind === 'follow' ? (p.save.saved ? 'Unfollow artist' : 'Follow artist') : p.save.saved ? 'Remove album from library' : 'Save album to library'}
            size={28}
            onPress={p.save.onToggle}
          />
        ) : null}
        {p.userPlaylistId ? (
          <>
            <IconButton name="create-outline" label="Edit playlist" onPress={() => router.push({ pathname: '/create', params: { id: p.userPlaylistId! } })} />
            <IconButton name="trash-outline" label="Delete playlist" onPress={() => p.onDelete?.()} />
          </>
        ) : null}
        <View style={{ flex: 1 }} />
        <IconButton name="shuffle" label="Shuffle play" color={shuffle ? colors.green : colors.text} size={26} onPress={shuffleAll} disabled={p.tracks.length === 0} />
        <Pressable
          onPress={playAll}
          disabled={p.tracks.length === 0}
          accessibilityRole="button"
          accessibilityLabel={playingHere ? 'Pause' : 'Play'}
          style={({ pressed }) => [styles.playBtn, pressed && { transform: [{ scale: 0.96 }] }, p.tracks.length === 0 && { opacity: 0.4 }]}>
          <Ionicons name={playingHere ? 'pause' : 'play'} size={30} color="#000" style={playingHere ? undefined : { marginLeft: 3 }} />
        </Pressable>
      </View>
      {p.tracksTitle && p.tracks.length > 0 ? <Text style={styles.sectionTitle}>{p.tracksTitle}</Text> : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={[alpha(p.color, 0.55), colors.bg]} style={StyleSheet.absoluteFill} locations={[0, 0.55]} />
      <View style={styles.back}>
        <IconButton name="chevron-back" label="Go back" onPress={goBack} />
      </View>
      {p.error ? (
        <ErrorState message={p.error} onRetry={p.onRetry} />
      ) : (
        <MusicList
          tracks={p.tracks}
          label={p.label}
          playlistId={p.userPlaylistId}
          numbered
          header={header}
          footer={p.loading ? <Loading label="Loading tracks…" /> : <View>{p.footer}<View style={{ height: 24 }} /></View>}
          empty={
            p.loading ? undefined : (
              <EmptyState icon="musical-notes-outline" title={p.emptyTitle ?? 'It’s quiet in here'} message={p.emptyMessage ?? 'There are no tracks here yet.'} />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { paddingHorizontal: 8, paddingTop: 4 },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 4 },
  coverShadow: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  kicker: { ...type.tiny, color: colors.textSecondary, marginTop: 20 },
  title: { ...type.display, color: colors.text, textAlign: 'center', marginTop: 4 },
  subtitle: { ...type.body, color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
  meta: { ...type.small, color: colors.textSecondary, marginTop: 6 },
  external: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  externalText: { ...type.small, color: colors.text, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  playBtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...type.title, color: colors.text, paddingHorizontal: 16, marginBottom: 6 },
});
