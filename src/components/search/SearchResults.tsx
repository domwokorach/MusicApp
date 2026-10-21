import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Artwork } from '@/components/common/Artwork';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Loading } from '@/components/common/Loading';
import { Chip, PrimaryButton, SectionTitle } from '@/components/common/primitives';
import { TrackRow } from '@/components/music/MusicList';
import { colors, type } from '@/constants/theme';
import { isSpotifyEnabled } from '@/constants/config';
import { playTracks } from '@/hooks/usePlayer';
import type { SearchFilter, useSearch } from '@/hooks/useSearch';
import { isLiveCatalogue } from '@/services/api/musicApi';
import { useSpotifyStore } from '@/store/spotifyStore';
import { useUIStore } from '@/store/uiStore';
import type { CollectionKind, Track } from '@/types/music';
import { openCollection } from '@/utils/nav';

type Search = ReturnType<typeof useSearch>;

function EntityRow({ title, subtitle, uri, color, round, onPress }: { title: string; subtitle: string; uri?: string; color: string; round?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}`} style={({ pressed }) => [styles.entity, pressed && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
      <Artwork uri={uri} color={color} size={50} round={round} radius={6} />
      <View style={{ flex: 1 }}>
        <Text style={styles.entityTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.entitySub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function Section({ title, provider, children }: { title: string; provider: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 16 }}>
      <SectionTitle>{title}</SectionTitle>
      <Text style={styles.providerTag}>{provider}</Text>
      {children}
    </View>
  );
}

/** Prompt shown when searching Spotify without a connected account. */
export function SpotifyConnectPanel() {
  const connecting = useSpotifyStore((s) => s.connecting);
  const error = useSpotifyStore((s) => s.error);
  const connect = useSpotifyStore((s) => s.connect);

  if (!isSpotifyEnabled) {
    return (
      <EmptyState
        icon="settings-outline"
        title="Spotify isn’t configured"
        message="Spotify sign-in runs through the Sonara backend. Set EXPO_PUBLIC_API_URL and configure the backend (see README)."
      />
    );
  }
  return (
    <View>
      <EmptyState
        icon="logo-electron"
        title="Connect Spotify to search it"
        message="Spotify results show artwork and details only. Tracks can’t be played inside this app; use Jamendo for playable music."
        action={<PrimaryButton label={connecting ? 'Opening Spotify…' : 'Connect Spotify'} icon="link" disabled={connecting} onPress={() => void connect()} />}
      />
      {error ? (
        <Text style={styles.authError} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function SearchResults({ search }: { search: Search }) {
  const { results, query, tag, provider, filter, setFilter, loading, error, authRequired, hasMore, loadingMore, loadMore, retry, addSearch } = search;
  const isSpotify = provider === 'spotify';
  const providerLabel = isSpotify ? 'Spotify' : isLiveCatalogue ? 'Jamendo' : 'Demo catalogue';
  const total = Object.values(results).reduce((n, l) => n + l.length, 0);
  const show = (f: SearchFilter) => filter === 'all' || filter === f;

  const filters: { id: SearchFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'songs', label: 'Songs' },
    { id: 'artists', label: 'Artists' },
    { id: 'albums', label: 'Albums' },
    { id: 'playlists', label: 'Playlists' },
    ...(!isSpotify && !isLiveCatalogue ? [{ id: 'podcasts' as const, label: 'Podcasts' }] : []),
  ];

  const open = (kind: CollectionKind, id: string) => {
    addSearch(query);
    openCollection(kind, id);
  };

  const onTrack = (track: Track, list: Track[]) => {
    addSearch(query);
    if (track.audioUrl) {
      playTracks(list, track, `Search “${query.trim() || tag || ''}”`);
    } else if (track.albumId) {
      // Metadata-only (Spotify) track: browse its album instead of attempting playback.
      openCollection('album', track.albumId);
    } else {
      useUIStore.getState().showToast('This track can’t be played in the app.');
    }
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled" accessibilityLabel="Result filters">
        {filters.map((f) => (
          <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </ScrollView>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 24 }}
        scrollEventThrottle={200}
        onScroll={({ nativeEvent: e }) => {
          // Infinite scrolling: when a single type is selected, fetch the next page near the end.
          if (filter !== 'all' && e.contentOffset.y + e.layoutMeasurement.height > e.contentSize.height - 400) void loadMore();
        }}>
        {authRequired ? <SpotifyConnectPanel /> : null}
        {!authRequired && isSpotify ? <Text style={styles.note}>Spotify results are metadata only. Tracks open their album and can’t be played here.</Text> : null}
        {tag && !isSpotify ? <Text style={styles.note}>Genre: {tag}</Text> : null}

        {!authRequired && loading && total === 0 ? <Loading label="Searching…" /> : null}
        {!authRequired && !loading && error ? <ErrorState message={error} onRetry={retry} /> : null}
        {!authRequired && !loading && !error && total === 0 ? (
          <EmptyState
            icon="search-outline"
            title={query.trim() ? `No results for “${query.trim()}”` : 'No songs in this genre'}
            message={`Nothing found on ${providerLabel}. Check the spelling or try a different keyword.`}
          />
        ) : null}

        {!authRequired && show('songs') && results.songs.length > 0 ? (
          <Section title="Songs" provider={providerLabel}>
            {results.songs.slice(0, filter === 'all' ? 5 : undefined).map((t) => (
              <TrackRow key={t.id} track={t} showPlay onPress={() => onTrack(t, results.songs)} />
            ))}
            {filter === 'all' && results.songs.length > 5 ? (
              <View style={styles.more}>
                <PrimaryButton label="Show all songs" variant="outline" onPress={() => setFilter('songs')} />
              </View>
            ) : null}
          </Section>
        ) : null}
        {!authRequired && show('artists') && results.artists.length > 0 ? (
          <Section title="Artists" provider={providerLabel}>
            {results.artists.map((a) => (
              <EntityRow key={a.id} title={a.name} subtitle={a.followers ? `Artist · ${a.followers} followers` : 'Artist'} uri={a.imageUrl} color={a.color} round onPress={() => open('artist', a.id)} />
            ))}
          </Section>
        ) : null}
        {!authRequired && show('albums') && results.albums.length > 0 ? (
          <Section title="Albums" provider={providerLabel}>
            {results.albums.map((a) => (
              <EntityRow key={a.id} title={a.title} subtitle={`Album · ${a.artistName}`} uri={a.artworkUrl} color={a.color} onPress={() => open('album', a.id)} />
            ))}
          </Section>
        ) : null}
        {!authRequired && show('playlists') && results.playlists.length > 0 ? (
          <Section title="Playlists" provider={providerLabel}>
            {results.playlists.map((p) => (
              <EntityRow key={p.id} title={p.title} subtitle={`Playlist · ${p.description}`} uri={p.artworkUrl} color={p.color} onPress={() => open('playlist', p.id)} />
            ))}
          </Section>
        ) : null}
        {!authRequired && show('podcasts') && results.podcasts.length > 0 ? (
          <Section title="Podcasts" provider={providerLabel}>
            {results.podcasts.map((p) => (
              <EntityRow key={p.id} title={p.title} subtitle={`Podcast · ${p.host}`} uri={p.artworkUrl} color={p.color} onPress={() => open('podcast', p.id)} />
            ))}
          </Section>
        ) : null}
        {!authRequired && show('podcasts') && results.episodes.length > 0 ? (
          <Section title="Episodes" provider={providerLabel}>
            {results.episodes.map((t) => (
              <TrackRow key={t.id} track={t} showPlay onPress={() => onTrack(t, results.episodes)} />
            ))}
          </Section>
        ) : null}

        {filter !== 'all' && loadingMore ? <Loading inline /> : null}
        {filter !== 'all' && !hasMore && total > 0 && !loadingMore ? <Text style={styles.end}>That’s everything for “{query.trim() || tag}”.</Text> : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  more: { alignItems: 'center', marginTop: 12 },
  note: { ...type.small, color: colors.textSecondary, paddingHorizontal: 16, paddingTop: 4 },
  providerTag: { ...type.tiny, color: colors.textMuted, paddingHorizontal: 16, marginTop: -8, marginBottom: 8, textTransform: 'uppercase' },
  entity: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  entityTitle: { ...type.body, fontWeight: '600', color: colors.text },
  entitySub: { ...type.small, color: colors.textSecondary, marginTop: 2 },
  authError: { ...type.small, color: colors.danger, textAlign: 'center', paddingHorizontal: 24 },
  hint: { ...type.small, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24, marginTop: 12 },
  end: { ...type.small, color: colors.textMuted, textAlign: 'center', marginTop: 16 },
});
