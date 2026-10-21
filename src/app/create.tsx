import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Artwork, GradientCover } from '@/components/common/Artwork';
import { ErrorState } from '@/components/common/ErrorState';
import { Loading } from '@/components/common/Loading';
import { IconButton } from '@/components/common/primitives';
import { COVER_OPTIONS, colors, radii, type } from '@/constants/theme';
import { useAsync } from '@/hooks/useMusic';
import { usePlaylistActions, useUserPlaylist } from '@/hooks/usePlaylist';
import { useDebouncedValue } from '@/hooks/useSearch';
import { musicApi } from '@/services/api/musicApi';
import { useUIStore } from '@/store/uiStore';
import type { Track } from '@/types/music';
import { goBack } from '@/utils/nav';

const NAME_MAX = 60;

/** Create a playlist, or edit one when opened with ?id=. A track chosen from a menu is pre-selected. */
export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useUserPlaylist(id);
  const editing = !!existing;
  const actions = usePlaylistActions();

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [cover, setCover] = useState(existing?.cover ?? 'violet');
  // Selection keeps full Track objects so playlists from any source (Jamendo, demo) can be stored.
  const [selected, setSelected] = useState<Track[]>(() => existing?.tracks ?? (useUIStore.getState().pendingTrack ? [useUIStore.getState().pendingTrack!] : []));
  const [filter, setFilter] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    useUIStore.getState().setPendingTrack(null);
  }, []);

  // Song picker: trending by default, live search results when filtering.
  const q = useDebouncedValue(filter.trim(), 350);
  const songs = useAsync(`picker:${q}`, async () => (q ? (await musicApi.searchSongs(q, { limit: 30 })).items : (await musicApi.trending({ limit: 30 })).items));

  const nameError = touched && name.trim().length === 0 ? 'Give your playlist a name' : null;
  const isSelected = (t: Track) => selected.some((s) => s.id === t.id);
  const toggle = (t: Track) => setSelected((cur) => (cur.some((s) => s.id === t.id) ? cur.filter((s) => s.id !== t.id) : [...cur, t]));

  const save = () => {
    setTouched(true);
    if (!name.trim()) return;
    if (existing) {
      actions.update(existing.id, { name: name.trim(), description: description.trim(), cover, tracks: selected });
      goBack();
    } else {
      const newId = actions.create({ name, description, cover, tracks: selected });
      goBack();
      setTimeout(() => router.push({ pathname: '/playlist/[id]', params: { id: newId } }), 300);
    }
  };

  // Selected tracks first so they stay visible while browsing/searching.
  const visible = [...selected.filter((t) => !q || t.title.toLowerCase().includes(q.toLowerCase())), ...(songs.data ?? []).filter((t) => !isSelected(t))];

  const form = (
    <View>
      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={(v) => setName(v.slice(0, NAME_MAX))}
        onBlur={() => setTouched(true)}
        placeholder="My playlist"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, nameError ? { borderColor: colors.danger } : null]}
        accessibilityLabel="Playlist name"
        maxLength={NAME_MAX}
      />
      {nameError ? <Text style={styles.error}>{nameError}</Text> : null}

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Add an optional description"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { height: 84, textAlignVertical: 'top', paddingTop: 12 }]}
        multiline
        accessibilityLabel="Playlist description"
      />

      <Text style={styles.label}>Cover</Text>
      <FlatList
        horizontal
        data={[{ id: 'auto', colors: ['#333', '#555'] as [string, string] }, ...COVER_OPTIONS]}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
        renderItem={({ item }) => {
          const active = cover === item.id;
          return (
            <Pressable
              onPress={() => setCover(item.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={item.id === 'auto' ? 'Cover from songs' : `${item.id} cover`}
              style={[styles.coverOption, active && { borderColor: colors.green }]}>
              <GradientCover colors={item.colors} size={64} radius={8} icon={item.id === 'auto' ? 'images' : 'musical-notes'} />
              {active ? (
                <View style={styles.check}>
                  <Ionicons name="checkmark" size={14} color="#000" />
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
      <Text style={styles.hint}>The first option builds a cover from your songs once you’ve added four.</Text>

      <View style={styles.songsHeader}>
        <Text style={[styles.label, { marginTop: 0 }]}>Songs</Text>
        <Text style={styles.count}>{selected.length} selected</Text>
      </View>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput value={filter} onChangeText={setFilter} placeholder="Search songs to add" placeholderTextColor={colors.textMuted} style={{ flex: 1, color: colors.text, fontSize: 15, height: 40 }} accessibilityLabel="Search songs to add" autoCorrect={false} />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { paddingTop: insets.top + 4 }]}>
      <View style={styles.header}>
        <IconButton name="close" size={26} label="Close" onPress={goBack} />
        <Text style={styles.title} accessibilityRole="header">
          {editing ? 'Edit playlist' : 'New playlist'}
        </Text>
        <Pressable onPress={save} hitSlop={8} accessibilityRole="button" accessibilityLabel={editing ? 'Save changes' : 'Create playlist'} style={[styles.saveBtn, !name.trim() && { opacity: 0.4 }]}>
          <Text style={styles.saveText}>{editing ? 'Save' : 'Create'}</Text>
        </Pressable>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(s) => s.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={form}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={songs.loading ? <Loading inline /> : songs.error ? <ErrorState message={songs.error} onRetry={songs.reload} /> : <Text style={styles.hint}>No songs match “{filter}”.</Text>}
        ListFooterComponent={songs.loading && visible.length > 0 ? <Loading inline /> : undefined}
        renderItem={({ item }) => {
          const on = isSelected(item);
          return (
            <Pressable onPress={() => toggle(item)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${item.title} by ${item.artistName}`} style={styles.songRow}>
              <Artwork uri={item.artworkUrl} color={item.color} size={46} radius={6} />
              <View style={{ flex: 1 }}>
                <Text style={styles.songTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.songSub} numberOfLines={1}>
                  {item.artistName}
                </Text>
              </View>
              <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? colors.green : colors.textMuted} />
            </Pressable>
          );
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 48 },
  title: { ...type.heading, color: colors.text },
  saveBtn: { backgroundColor: colors.green, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.pill },
  saveText: { fontWeight: '800', color: '#000' },
  label: { ...type.small, fontWeight: '700', color: colors.textSecondary, marginTop: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { backgroundColor: colors.surface, color: colors.text, fontSize: 16, paddingHorizontal: 14, height: 48, borderRadius: radii.md, borderWidth: 1, borderColor: 'transparent' },
  error: { ...type.small, color: colors.danger, marginTop: 6 },
  hint: { ...type.small, color: colors.textMuted, marginTop: 8 },
  coverOption: { borderWidth: 2, borderColor: 'transparent', borderRadius: 10, padding: 2 },
  check: { position: 'absolute', right: 2, top: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  songsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 },
  count: { ...type.small, color: colors.green, fontWeight: '700' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radii.md, paddingHorizontal: 12, marginBottom: 8 },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  songTitle: { ...type.body, fontWeight: '600', color: colors.text },
  songSub: { ...type.small, color: colors.textSecondary, marginTop: 2 },
});
