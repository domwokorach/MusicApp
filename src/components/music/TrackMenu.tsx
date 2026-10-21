import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Artwork, PlaylistCover } from '@/components/common/Artwork';
import { BottomSheet } from '@/components/common/BottomSheet';
import { colors, type } from '@/constants/theme';
import { usePlaylistActions, usePlaylists } from '@/hooks/usePlaylist';
import { useIsLiked, useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { openCollection } from '@/utils/nav';
import { shareTrack } from '@/utils/share';

type IconName = keyof typeof Ionicons.glyphMap;

function Action({ icon, label, onPress, color = colors.text }: { icon: IconName; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** Global "more options" sheet for any track plus the add-to-playlist picker. Mounted once at the root. */
export function TrackMenu() {
  const menu = useUIStore((s) => s.menu);
  const closeMenu = useUIStore((s) => s.closeMenu);
  const pickTrack = useUIStore((s) => s.playlistPickerFor);
  const closePicker = useUIStore((s) => s.closePlaylistPicker);
  const openPicker = useUIStore((s) => s.openPlaylistPicker);
  const toast = useUIStore((s) => s.showToast);

  const track = menu?.track ?? null;
  const liked = useIsLiked(track?.id);
  const playlists = usePlaylists();
  const actions = usePlaylistActions();

  const run = (fn: () => void) => () => {
    closeMenu();
    fn();
  };

  return (
    <>
      <BottomSheet visible={!!track} onClose={closeMenu}>
        {track ? (
          <ScrollView bounces={false}>
            <View style={styles.header}>
              <Artwork uri={track.artworkUrl} color={track.color} size={56} radius={6} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {track.artistName}
                </Text>
              </View>
            </View>
            <Action
              icon={liked ? 'heart' : 'heart-outline'}
              color={liked ? colors.green : colors.text}
              label={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
              onPress={run(() => toast(useLibraryStore.getState().toggleLike(track) ? 'Added to Liked Songs' : 'Removed from Liked Songs'))}
            />
            <Action
              icon="add-circle-outline"
              label="Add to playlist"
              onPress={() => {
                closeMenu();
                openPicker(track);
              }}
            />
            {menu?.playlistId ? <Action icon="remove-circle-outline" label="Remove from this playlist" onPress={run(() => actions.removeTrack(menu.playlistId!, track.id))} /> : null}
            <Action
              icon="list-outline"
              label="Add to queue"
              onPress={run(() => {
                usePlayerStore.getState().addToQueue(track);
                toast('Added to queue');
              })}
            />
            <Action
              icon="play-forward-outline"
              label="Play next"
              onPress={run(() => {
                usePlayerStore.getState().playNext(track);
                toast('Playing next');
              })}
            />
            {track.artistId ? <Action icon="person-outline" label="Go to artist" onPress={run(() => openCollection('artist', track.artistId!))} /> : null}
            {track.albumId ? <Action icon="albums-outline" label={`Go to album${track.albumName ? ` · ${track.albumName}` : ''}`} onPress={run(() => openCollection('album', track.albumId!))} /> : null}
            {track.podcastId ? <Action icon="mic-outline" label={`Go to show${track.albumName ? ` · ${track.albumName}` : ''}`} onPress={run(() => openCollection('podcast', track.podcastId!))} /> : null}
            <Action icon="share-outline" label="Share" onPress={run(() => void shareTrack(track))} />
          </ScrollView>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={!!pickTrack} onClose={closePicker} title="Add to playlist">
        <ScrollView bounces={false}>
          <Action
            icon="add"
            label="New playlist"
            onPress={() => {
              // Route params can only carry strings, so the full track goes through the UI store.
              useUIStore.getState().setPendingTrack(pickTrack);
              closePicker();
              router.push('/create');
            }}
          />
          {playlists.length === 0 ? <Text style={styles.hint}>You haven’t created any playlists yet.</Text> : null}
          {playlists.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Add to ${p.name}`}
              style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
              onPress={() => {
                if (!pickTrack) return;
                actions.addTrack(p.id, p.name, pickTrack);
                closePicker();
              }}>
              <PlaylistCover playlist={p} size={40} radius={4} />
              <View style={{ flex: 1 }}>
                <Text style={styles.actionText} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.subtitle}>{p.tracks.length} songs</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { ...type.heading, color: colors.text },
  subtitle: { ...type.small, color: colors.textSecondary, marginTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 52, paddingVertical: 6 },
  actionText: { ...type.body, fontSize: 16, color: colors.text },
  hint: { ...type.small, color: colors.textSecondary, paddingVertical: 8 },
});
