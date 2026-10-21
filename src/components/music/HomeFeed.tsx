import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Artwork, GradientCover, PlaylistCover } from '@/components/common/Artwork';
import { PrimaryButton } from '@/components/common/primitives';
import { colors, radii, type } from '@/constants/theme';
import { isSpotifyEnabled } from '@/constants/config';
import { ROUTES } from '@/constants/routes';
import { useHomeData, useRefreshOnFocus } from '@/hooks/useMusic';
import { playTracks } from '@/hooks/usePlayer';
import { usePlaylists } from '@/hooks/usePlaylist';
import { isLiveCatalogue, providerName } from '@/services/api/musicApi';
import { useLibraryStore } from '@/store/libraryStore';
import { useSpotifyStore } from '@/store/spotifyStore';
import { greeting } from '@/utils/helpers';
import { openCollection } from '@/utils/nav';

import { AlbumCard } from './AlbumCard';
import { ArtistCard } from './ArtistCard';
import { MediaCard } from './MediaCard';
import { PlaylistCard, PodcastCard } from './PlaylistCard';
import { Shelf } from './Shelf';
import { SongCard } from './SongCard';

export type FeedMode = 'all' | 'music' | 'podcasts';

const TITLES: Record<FeedMode, string> = { all: 'Home', music: 'Music', podcasts: 'Podcasts' };
const SPOTIFY_CAPTION = 'Artwork & metadata from Spotify';

/** Home feed shared by the All, Music and Podcasts screens. Every section loads independently from the live APIs. */
export function HomeFeed({ mode }: { mode: FeedMode }) {
  const home = useHomeData();
  useRefreshOnFocus(home.refetchStale);
  const [refreshing, setRefreshing] = useState(false);

  const recentAll = useLibraryStore((s) => s.recent);
  const likedCount = useLibraryStore((s) => s.liked.length);
  const followedCount = useLibraryStore((s) => s.followedArtists.length);
  const userPlaylists = usePlaylists();
  const spotifyStatus = useSpotifyStore((s) => s.status);
  const connectSpotify = useSpotifyStore((s) => s.connect);
  const connecting = useSpotifyStore((s) => s.connecting);

  const showMusic = mode !== 'podcasts';
  const showPodcasts = mode !== 'music';
  const recent = recentAll.filter((t) => (mode === 'podcasts' ? t.kind === 'episode' : mode === 'music' ? t.kind === 'song' : true)).slice(0, 12);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await home.refetchAll();
    } finally {
      setRefreshing(false);
    }
  };

  const quick = [
    { key: 'liked', title: 'Liked Songs', onPress: () => openCollection('liked', 'liked'), cover: <GradientCover colors={['#4A00E0', '#8E2DE2']} size={56} radius={0} icon="heart" /> },
    ...userPlaylists.slice(0, 2).map((p) => ({ key: p.id, title: p.name, onPress: () => openCollection('playlist', p.id), cover: <PlaylistCover playlist={p} size={56} radius={0} /> })),
    ...home.playlists.data.slice(0, 5).map((p) => ({ key: p.id, title: p.title, onPress: () => openCollection('playlist', p.id), cover: <Artwork uri={p.artworkUrl} color={p.color} size={56} radius={0} /> })),
  ].slice(0, 6);

  const spotifyReady = isSpotifyEnabled && spotifyStatus === 'connected';

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.green} colors={[colors.green]} progressBackgroundColor={colors.surface} />}>
      <View style={styles.titleRow}>
        <Text style={styles.greeting} accessibilityRole="header">
          {mode === 'all' ? greeting() : TITLES[mode]}
        </Text>
        <Text style={styles.sub}>
          {likedCount} liked songs · {followedCount} artists followed
        </Text>
        {showMusic && !isLiveCatalogue ? <Text style={styles.notice}>Showing the demo catalogue ({providerName}). Set EXPO_PUBLIC_API_URL to stream licensed Jamendo music.</Text> : null}
      </View>

      {mode === 'all' && quick.length > 1 ? (
        <View style={styles.grid}>
          {quick.map((q) => (
            <Pressable key={q.key} onPress={q.onPress} accessibilityRole="button" accessibilityLabel={q.title} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}>
              {q.cover}
              <Text style={styles.tileText} numberOfLines={2}>
                {q.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* 9. Recently played: local history (genuine covers, newest first) and, when allowed, Spotify's own history */}
      <Shelf title="Recently played" items={recent} renderItem={(t) => <SongCard track={t} onPress={() => playTracks(recent, t, 'Recently played')} />} />
      {mode !== 'podcasts' && spotifyReady ? (
        <Shelf
          title="Recently played on Spotify"
          caption={SPOTIFY_CAPTION}
          items={home.spotify.recent.data}
          loading={home.spotify.recent.loading}
          error={home.spotify.unavailable.recentlyPlayed ? null : home.spotify.recent.error}
          onRetry={home.spotify.recent.refetch}
          renderItem={(t) => <SongCard track={t} onPress={() => playTracks([t], t, 'Spotify')} />}
        />
      ) : null}

      {showMusic ? (
        <>
          <Shelf title="Featured tracks" items={home.featured.data} loading={home.featured.loading} error={home.featured.error} onRetry={home.featured.refetch} renderItem={(t) => <SongCard track={t} onPress={() => playTracks(home.featured.data, t, 'Featured tracks')} />} />
          <Shelf title="Popular music" items={home.trending.data} loading={home.trending.loading} error={home.trending.error} onRetry={home.trending.refetch} renderItem={(t) => <SongCard track={t} onPress={() => playTracks(home.trending.data, t, 'Popular music')} />} />

          {/* 2. Featured playlists: Jamendo = app-curated mixes from live featured tracks; Spotify = the user's own playlists when permitted */}
          <Shelf
            title="Featured playlists"
            caption={isLiveCatalogue ? 'App-curated from featured Jamendo tracks' : undefined}
            items={home.playlists.data}
            loading={home.playlists.loading}
            error={home.playlists.error}
            onRetry={home.playlists.refetch}
            renderItem={(p) => <PlaylistCard playlist={p} />}
          />
          {spotifyReady && !home.spotify.unavailable.myPlaylists ? (
            <Shelf title="Your Spotify playlists" caption={SPOTIFY_CAPTION} items={home.spotify.playlists.data} loading={home.spotify.playlists.loading} error={home.spotify.playlists.error} onRetry={home.spotify.playlists.refetch} renderItem={(p) => <PlaylistCard playlist={p} />} />
          ) : null}

          {/* 1. Music by genre: tiles use real artwork from a live track of that genre */}
          <Shelf
            title="Music by genre"
            cardSize={120}
            items={home.genres.data}
            loading={home.genres.loading}
            error={home.genres.error}
            onRetry={home.genres.refetch}
            renderItem={(g) => <MediaCard title={g.name} subtitle="Genre" uri={g.artworkUrl} color={g.color} size={120} onPress={() => openCollection('playlist', `tag:${g.id}`)} />}
          />

          {/* 4-8. Rock / Pop / Hip-Hop / Electronic / Jazz mixes: live featured tracks with their own covers */}
          {home.mixes.loading && home.mixes.data.length === 0 ? (
            <Shelf title="Genre mixes" items={[]} loading />
          ) : (
            home.mixes.data.map((m) => (
              <Shelf key={m.genre.id} title={`${m.genre.name} Mix`} items={m.tracks} renderItem={(t) => <SongCard track={t} onPress={() => playTracks(m.tracks, t, `${m.genre.name} Mix`)} />} />
            ))
          )}

          <Shelf title="New releases" items={home.albums.data} loading={home.albums.loading} error={home.albums.error} onRetry={home.albums.refetch} renderItem={(a) => <AlbumCard album={a} />} />
          <Shelf title="Recommended songs" items={home.recommended.data} loading={home.recommended.loading} error={home.recommended.error} onRetry={home.recommended.refetch} renderItem={(t) => <SongCard track={t} onPress={() => playTracks(home.recommended.data, t, 'Recommended songs')} />} />
          <Shelf title="Artist collections" cardSize={128} round items={home.artists.data} loading={home.artists.loading} error={home.artists.error} onRetry={home.artists.refetch} renderItem={(a) => <ArtistCard artist={a} />} />
        </>
      ) : null}

      {/* 3. Podcasts: Spotify shows when signed in; the labelled demo catalogue only when no live backend is configured */}
      {showPodcasts ? (
        <>
          {!isLiveCatalogue ? (
            <>
              <Shelf title={mode === 'podcasts' ? 'Your shows' : 'Podcasts'} items={home.demoPodcasts.data} loading={home.demoPodcasts.loading} renderItem={(p) => <PodcastCard podcast={p} />} />
              {mode === 'podcasts' ? <Shelf title="New episodes" items={home.demoEpisodes.data} renderItem={(e) => <SongCard track={e} onPress={() => playTracks(home.demoEpisodes.data, e, 'New episodes')} />} /> : null}
            </>
          ) : spotifyReady ? (
            <Shelf
              title={home.spotify.shows.suggested ? 'Podcasts on Spotify' : 'Your podcasts'}
              caption={SPOTIFY_CAPTION}
              items={home.spotify.shows.data}
              loading={home.spotify.shows.loading}
              error={home.spotify.shows.error}
              onRetry={home.spotify.shows.refetch}
              renderItem={(p) => <PodcastCard podcast={p} />}
            />
          ) : (
            <View style={styles.connect}>
              <Ionicons name="mic-outline" size={28} color={colors.textSecondary} />
              <Text style={styles.connectTitle}>Podcasts come from Spotify</Text>
              <Text style={styles.connectBody}>
                {isSpotifyEnabled ? 'Connect your Spotify account to see show artwork and details. Episodes open in Spotify.' : 'Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID to enable Spotify podcasts.'}
              </Text>
              {isSpotifyEnabled ? <PrimaryButton label={connecting ? 'Opening Spotify…' : 'Connect Spotify'} icon="link" disabled={connecting} onPress={() => void connectSpotify()} /> : null}
            </View>
          )}
        </>
      ) : null}

      <Pressable onPress={() => router.navigate(ROUTES.search)} accessibilityRole="button" accessibilityLabel="Find something new" style={styles.cta}>
        <Ionicons name="search" size={18} color={colors.text} />
        <Text style={styles.ctaText}>Find something new</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  titleRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  greeting: { ...type.display, color: colors.text },
  sub: { ...type.small, color: colors.textSecondary, marginTop: 4 },
  notice: { ...type.small, color: colors.textMuted, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, justifyContent: 'space-between' },
  tile: { width: '48.5%', height: 56, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 6, overflow: 'hidden', paddingRight: 8 },
  tileText: { flex: 1, ...type.small, fontWeight: '700', color: colors.text },
  connect: { alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, padding: 20, borderRadius: radii.lg, backgroundColor: colors.surface },
  connectTitle: { ...type.heading, color: colors.text },
  connectBody: { ...type.small, color: colors.textSecondary, textAlign: 'center', marginBottom: 6 },
  cta: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 32, paddingHorizontal: 20, paddingVertical: 12, borderRadius: radii.pill, backgroundColor: colors.surface },
  ctaText: { ...type.body, color: colors.text, fontWeight: '700' },
});
