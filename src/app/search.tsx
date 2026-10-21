import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chip, SectionTitle } from '@/components/common/primitives';
import { TrackRow } from '@/components/music/MusicList';
import { ProviderToggle, SearchBar } from '@/components/search/SearchBar';
import { SearchResults, SpotifyConnectPanel } from '@/components/search/SearchResults';
import { colors, radii, type } from '@/constants/theme';
import { Artwork } from '@/components/common/Artwork';
import { useHomeData } from '@/hooks/useMusic';
import { playTracks } from '@/hooks/usePlayer';
import { useSearch } from '@/hooks/useSearch';
import { isLiveCatalogue } from '@/services/api/musicApi';
import { useSpotifyStore } from '@/store/spotifyStore';

export default function SearchScreen() {
  const search = useSearch();
  const home = useHomeData();
  const genres = home.genres.data;
  const { query, setQuery, submit, clear, provider, setProvider, tag, setTag, hasQuery, history, removeSearch, clearSearch } = search;
  const isSpotify = provider === 'spotify';
  const spotifyConnected = useSpotifyStore((s) => s.status === 'connected');
  const recommended = useMemo(() => home.trending.data.slice(0, 5), [home.trending.data]);

  return (
    <View style={{ flex: 1 }}>
      <SearchBar value={query} onChangeText={setQuery} onSubmit={submit} onClear={clear} />
      <ProviderToggle value={provider} onChange={setProvider} />

      {!isSpotify && genres.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.genreChips} keyboardShouldPersistTaps="handled" accessibilityLabel="Genre filters">
          {genres.map((g) => (
            <Chip key={g.id} label={g.name} active={tag === g.id} onPress={() => setTag(tag === g.id ? null : g.id)} />
          ))}
        </ScrollView>
      ) : null}

      {hasQuery ? (
        <SearchResults search={search} />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 24 }}>
          {isSpotify && !spotifyConnected ? <SpotifyConnectPanel /> : null}
          {history.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <SectionTitle
                action={
                  <Pressable onPress={clearSearch} accessibilityRole="button" accessibilityLabel="Clear search history" hitSlop={8}>
                    <Text style={styles.link}>Clear</Text>
                  </Pressable>
                }>
                Recent searches
              </SectionTitle>
              {history.map((h) => (
                <View key={h} style={styles.historyRow}>
                  <Pressable
                    style={styles.historyMain}
                    onPress={() => {
                      Keyboard.dismiss();
                      setQuery(h);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Search ${h}`}>
                    <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                    <Text style={styles.historyText}>{h}</Text>
                  </Pressable>
                  <Pressable onPress={() => removeSearch(h)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${h} from history`}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {!isSpotify && genres.length > 0 ? (
            <View style={{ marginTop: 24 }}>
              <SectionTitle>Browse all</SectionTitle>
              <View style={styles.genreGrid}>
                {genres.map((g) => (
                  <Pressable
                    key={g.id}
                    onPress={() => setTag(g.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Browse ${g.name}`}
                    style={({ pressed }) => [styles.genre, { backgroundColor: g.color }, pressed && { opacity: 0.8 }]}>
                    <Text style={styles.genreText}>{g.name}</Text>
                    <View style={styles.genreArt}>
                      <Artwork uri={g.artworkUrl} color={g.color} size={64} radius={6} />
                    </View>
                  </Pressable>
                ))}
                {!isLiveCatalogue ? (
                <Pressable
                  onPress={() => setQuery('podcast')}
                  accessibilityRole="button"
                  accessibilityLabel="Browse Podcasts"
                  style={({ pressed }) => [styles.genre, { backgroundColor: '#5C6BC0' }, pressed && { opacity: 0.8 }]}>
                  <Text style={styles.genreText}>Podcasts</Text>
                  <Ionicons name="mic" size={44} color="rgba(0,0,0,0.25)" style={styles.genreMic} />
                </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {!isSpotify && recommended.length > 0 ? (
            <View style={{ marginTop: 24 }}>
              <SectionTitle>Recommended for you</SectionTitle>
              {recommended.map((t) => (
                <TrackRow key={t.id} track={t} onPress={() => playTracks(recommended, t, 'Recommended for you')} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  genreChips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  link: { ...type.body, color: colors.textSecondary, fontWeight: '700' },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 44 },
  historyMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  historyText: { ...type.body, color: colors.text },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  genre: { width: '47.8%', height: 92, borderRadius: radii.md, padding: 12, overflow: 'hidden' },
  genreText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  genreMic: { position: 'absolute', right: -4, bottom: -4, transform: [{ rotate: '25deg' }] },
  genreArt: { position: 'absolute', right: -8, bottom: -6, transform: [{ rotate: '25deg' }], shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
});
