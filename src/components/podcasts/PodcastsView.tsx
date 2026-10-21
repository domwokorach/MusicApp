import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Artwork } from '@/components/common/Artwork';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PrimaryButton } from '@/components/common/primitives';
import { Skeleton } from '@/components/common/Skeleton';
import { PodcastCard } from '@/components/music/PlaylistCard';
import { Shelf } from '@/components/music/Shelf';
import { colors, radii, type } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/useSearch';
import { spotifyLibraryApi } from '@/services/api/spotifyApi';
import { useSpotifyStore } from '@/store/spotifyStore';
import type { Podcast } from '@/types/music';
import { errorMessage } from '@/utils/helpers';
import { openCollection } from '@/utils/nav';

import { PodcastRow } from './PodcastRow';

/** Topics used to discover shows. Each is a real Spotify search; Spotify has no "featured shows" endpoint. */
const TOPICS = ['News', 'Comedy', 'Technology', 'True crime', 'Business'];
const CAPTION = 'Artwork & metadata from Spotify';

export function PodcastsView() {
  const status = useSpotifyStore((s) => s.status);
  const connecting = useSpotifyStore((s) => s.connecting);
  const authError = useSpotifyStore((s) => s.error);
  const unavailable = useSpotifyStore((s) => s.unavailable);
  const { connect, disconnect } = useSpotifyStore.getState();
  const queryClient = useQueryClient();
  const connected = status === 'connected';

  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim(), 400);
  const [refreshing, setRefreshing] = useState(false);

  const saved = useQuery({ queryKey: ['spotify', 'saved-shows'], queryFn: () => spotifyLibraryApi.savedShows(30), enabled: connected && !unavailable.savedShows, retry: false });
  const search = useQuery({ queryKey: ['spotify', 'show-search', q], queryFn: () => spotifyLibraryApi.searchShows(q, 10), enabled: connected && q.length > 1 && !unavailable.showSearch, retry: false });
  const discover = TOPICS.map((topic) => ({
    topic,
    // eslint-disable-next-line react-hooks/rules-of-hooks -- TOPICS is a constant, so the hook count never changes
    query: useQuery({ queryKey: ['spotify', 'discover', topic], queryFn: () => spotifyLibraryApi.searchShows(topic, 10), enabled: connected && !unavailable.showSearch, retry: false }),
  }));

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ queryKey: ['spotify'], type: 'active' });
    } finally {
      setRefreshing(false);
    }
  };

  const onDisconnect = async () => {
    await disconnect();
    queryClient.removeQueries({ queryKey: ['spotify'] });
    setQuery('');
  };

  const spotlight = discover.flatMap((d) => d.query.data ?? []).find((p) => !!p.artworkUrl);
  const searching = q.length > 1;
  const noAccess = unavailable.showSearch && unavailable.savedShows;
  const firstDenied = unavailable.showSearch ?? unavailable.savedShows;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={connected ? <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.green} colors={[colors.green]} progressBackgroundColor={colors.surface} /> : undefined}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Podcasts
        </Text>
        {connected ? (
          <View style={styles.statusRow}>
            <View style={styles.pill} accessibilityLabel="Spotify account connected">
              <Ionicons name="checkmark-circle" size={16} color={colors.green} />
              <Text style={styles.pillText}>Spotify connected</Text>
            </View>
            <Pressable onPress={() => void onDisconnect()} accessibilityRole="button" accessibilityLabel="Disconnect Spotify" hitSlop={8}>
              <Text style={styles.disconnect}>Disconnect</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {!connected ? (
        <View style={styles.connect}>
          <Ionicons name="mic-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.connectTitle}>Podcasts come from Spotify</Text>
          <Text style={styles.connectBody}>Connect your Spotify account to see show artwork, descriptions and episodes. Episodes open in Spotify.</Text>
          <PrimaryButton label={connecting ? 'Opening Spotify…' : 'Connect Spotify'} icon="link" disabled={connecting || status === 'unknown'} onPress={() => void connect()} />
          {authError ? (
            <Text style={styles.authError} accessibilityLiveRegion="polite">
              {authError}
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#000" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search podcasts"
              placeholderTextColor="#535353"
              style={styles.input}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Search podcasts on Spotify"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear podcast search">
                <Ionicons name="close-circle" size={20} color="#535353" />
              </Pressable>
            ) : null}
          </View>

          {noAccess ? (
            <ErrorState message={firstDenied ?? 'Spotify did not allow podcast access for this app.'} />
          ) : searching ? (
            <View style={{ marginTop: 16 }}>
              {search.isLoading || query.trim() !== q ? (
                [0, 1, 2, 3].map((i) => (
                  <View key={i} style={styles.skelRow}>
                    <Skeleton width={72} height={72} radius={8} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <Skeleton width="60%" height={14} radius={4} />
                      <Skeleton width="40%" height={11} radius={4} />
                    </View>
                  </View>
                ))
              ) : search.error ? (
                <ErrorState message={errorMessage(search.error)} onRetry={() => void search.refetch()} />
              ) : (search.data ?? []).length === 0 ? (
                <EmptyState icon="mic-off-outline" title={`No podcasts for “${q}”`} message="Try a different name or topic." />
              ) : (
                (search.data ?? []).map((p) => <PodcastRow key={p.id} podcast={p} />)
              )}
            </View>
          ) : (
            <>
              {spotlight ? <Spotlight podcast={spotlight} /> : null}
              {!unavailable.savedShows ? (
                <Shelf title="Your podcasts" caption={CAPTION} items={saved.data ?? []} loading={saved.isLoading} error={saved.error ? errorMessage(saved.error) : null} onRetry={() => void saved.refetch()} renderItem={(p) => <PodcastCard podcast={p} />} />
              ) : null}
              {discover.map(({ topic, query: dq }) => (
                <Shelf key={topic} title={`Discover: ${topic}`} caption={CAPTION} items={dq.data ?? []} loading={dq.isLoading} error={dq.error ? errorMessage(dq.error) : null} onRetry={() => void dq.refetch()} renderItem={(p) => <PodcastCard podcast={p} />} />
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Spotlight({ podcast }: { podcast: Podcast }) {
  return (
    <Pressable onPress={() => openCollection('podcast', podcast.id)} accessibilityRole="button" accessibilityLabel={`Spotlight: ${podcast.title} by ${podcast.publisher ?? podcast.host}`} style={styles.spotlight}>
      <Artwork uri={podcast.artworkUrl} color={podcast.color} size={110} radius={10} placeholderIcon="mic" />
      <View style={{ flex: 1 }}>
        <Text style={styles.spotKicker}>SPOTLIGHT</Text>
        <Text style={styles.spotTitle} numberOfLines={2}>
          {podcast.title}
        </Text>
        <Text style={styles.spotMeta} numberOfLines={1}>
          {[podcast.publisher ?? podcast.host, podcast.episodeCount ? `${podcast.episodeCount} episodes` : ''].filter(Boolean).join(' · ')}
        </Text>
        <Text style={styles.spotDesc} numberOfLines={3}>
          {podcast.description}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  title: { ...type.display, color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.surface },
  pillText: { ...type.small, color: colors.text, fontWeight: '700' },
  disconnect: { ...type.body, color: colors.textSecondary, fontWeight: '700' },
  connect: { alignItems: 'center', gap: 10, margin: 16, padding: 24, borderRadius: radii.lg, backgroundColor: colors.surface },
  connectTitle: { ...type.heading, color: colors.text },
  connectBody: { ...type.small, color: colors.textSecondary, textAlign: 'center', marginBottom: 6 },
  authError: { ...type.small, color: colors.danger, textAlign: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.text, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, height: 44, borderRadius: radii.md },
  input: { flex: 1, fontSize: 15, fontWeight: '600', color: '#000', height: 44 },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  spotlight: { flexDirection: 'row', gap: 14, marginHorizontal: 16, marginTop: 20, padding: 14, borderRadius: radii.lg, backgroundColor: colors.surface },
  spotKicker: { ...type.tiny, color: colors.green },
  spotTitle: { ...type.heading, color: colors.text, marginTop: 4 },
  spotMeta: { ...type.small, color: colors.textSecondary, marginTop: 2 },
  spotDesc: { ...type.small, color: colors.textMuted, marginTop: 6 },
});
