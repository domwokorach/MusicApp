import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Artwork, GradientCover, PlaylistCover } from '@/components/common/Artwork';
import { BottomSheet } from '@/components/common/BottomSheet';
import { EmptyState } from '@/components/common/EmptyState';
import { Chip, PrimaryButton } from '@/components/common/primitives';
import { TrackRow } from '@/components/music/MusicList';
import { colors, type } from '@/constants/theme';
import { ROUTES } from '@/constants/routes';
import { playTracks } from '@/hooks/usePlayer';
import { usePlaylistActions, usePlaylists } from '@/hooks/usePlaylist';
import { useLibraryStore } from '@/store/libraryStore';
import type { UserPlaylist } from '@/types/playlist';
import { openCollection } from '@/utils/nav';

const TABS = ['Playlists', 'Liked Songs', 'Albums', 'Artists', 'Recently played'] as const;
type Tab = (typeof TABS)[number];

function LibraryRow({ title, subtitle, cover, onPress, onMore }: { title: string; subtitle: string; cover: ReactNode; onPress: () => void; onMore?: () => void }) {
  return (
    <View style={styles.rowWrap}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}`} style={({ pressed }) => [styles.row, pressed && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
        {cover}
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
      {onMore ? (
        <Pressable onPress={onMore} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Options for ${title}`} style={styles.more}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function SheetAction({ icon, label, onPress, color = colors.text }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.sheetAction}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[type.body, { color, fontSize: 16 }]}>{label}</Text>
    </Pressable>
  );
}

export default function LibraryScreen() {
  const [tab, setTab] = useState<Tab>('Playlists');
  const [menuFor, setMenuFor] = useState<UserPlaylist | null>(null);

  const liked = useLibraryStore((s) => s.liked);
  const savedAlbums = useLibraryStore((s) => s.savedAlbums);
  const followed = useLibraryStore((s) => s.followedArtists);
  const recent = useLibraryStore((s) => s.recent);
  const playlists = usePlaylists();
  const actions = usePlaylistActions();

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.heading} accessibilityRole="header">
        Your Library
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}>
        {TABS.map((t) => (
          <Chip key={t} label={t} active={tab === t} onPress={() => setTab(t)} />
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {tab === 'Playlists' ? (
          <>
            <LibraryRow
              title="Liked Songs"
              subtitle={`Playlist · ${liked.length} songs`}
              cover={<GradientCover colors={['#4A00E0', '#8E2DE2']} size={56} radius={6} icon="heart" />}
              onPress={() => openCollection('liked', 'liked')}
            />
            {playlists.map((p) => (
              <LibraryRow key={p.id} title={p.name} subtitle={`Playlist · ${p.tracks.length} songs`} cover={<PlaylistCover playlist={p} size={56} radius={6} />} onPress={() => openCollection('playlist', p.id)} onMore={() => setMenuFor(p)} />
            ))}
            {playlists.length === 0 ? (
              <EmptyState
                icon="musical-notes-outline"
                title="Create your first playlist"
                message="Pick a name, a cover and your favourite songs."
                action={<PrimaryButton label="Create playlist" icon="add" onPress={() => router.push(ROUTES.create)} />}
              />
            ) : (
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <PrimaryButton label="New playlist" icon="add" variant="outline" onPress={() => router.push(ROUTES.create)} />
              </View>
            )}
          </>
        ) : null}

        {tab === 'Liked Songs' ? (
          liked.length === 0 ? (
            <EmptyState icon="heart-outline" title="Songs you like will appear here" message="Tap the heart on any song to save it." />
          ) : (
            liked.map((t) => <TrackRow key={t.id} track={t} onPress={() => playTracks(liked, t, 'Liked Songs')} />)
          )
        ) : null}

        {tab === 'Albums' ? (
          savedAlbums.length === 0 ? (
            <EmptyState icon="albums-outline" title="No saved albums" message="Save an album from its page to keep it here." />
          ) : (
            savedAlbums.map((a) => <LibraryRow key={a.id} title={a.title} subtitle={`Album · ${a.artistName}`} cover={<Artwork uri={a.artworkUrl} color={a.color} size={56} radius={6} />} onPress={() => openCollection('album', a.id)} />)
          )
        ) : null}

        {tab === 'Artists' ? (
          followed.length === 0 ? (
            <EmptyState icon="people-outline" title="No followed artists" message="Follow artists to see them here." />
          ) : (
            followed.map((a) => <LibraryRow key={a.id} title={a.name} subtitle="Artist" cover={<Artwork uri={a.imageUrl} color={a.color} size={56} round />} onPress={() => openCollection('artist', a.id)} />)
          )
        ) : null}

        {tab === 'Recently played' ? (
          recent.length === 0 ? (
            <EmptyState icon="time-outline" title="Nothing played yet" message="Start listening and your history will show up here." />
          ) : (
            recent.map((t) => <TrackRow key={t.id} track={t} onPress={() => playTracks(recent, t, 'Recently played')} />)
          )
        ) : null}
      </ScrollView>

      <BottomSheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.name}>
        <SheetAction
          icon="create-outline"
          label="Edit or rename"
          onPress={() => {
            const p = menuFor;
            setMenuFor(null);
            if (p) router.push({ pathname: '/create', params: { id: p.id } });
          }}
        />
        <SheetAction
          icon="trash-outline"
          label="Delete playlist"
          color={colors.danger}
          onPress={() => {
            const p = menuFor;
            setMenuFor(null);
            if (p) actions.remove(p.id, p.name);
          }}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { ...type.display, color: colors.text, paddingHorizontal: 16, paddingTop: 4 },
  chips: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  rowWrap: { flexDirection: 'row', alignItems: 'center', paddingRight: 16 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingVertical: 8 },
  rowTitle: { ...type.body, fontWeight: '700', color: colors.text },
  rowSub: { ...type.small, color: colors.textSecondary, marginTop: 2 },
  more: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheetAction: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 52 },
});
