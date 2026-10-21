import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { COVER_OPTIONS } from '@/constants/theme';
import type { UserPlaylist } from '@/types/playlist';
import { logArtworkFailure, normalizeArtworkUrl, sizedArtworkUrl } from '@/utils/artwork';
import { shade } from '@/utils/helpers';

import { Shimmer } from './Skeleton';

interface ArtworkProps {
  uri?: string;
  color: string;
  size: number;
  radius?: number;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Icon for the placeholder (shown when there is no artwork or it fails to load). */
  placeholderIcon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Remote artwork with graceful degradation:
 *  - the URL is validated / forced to https and resized for the displayed size;
 *  - a shimmer shows while it loads;
 *  - a missing or broken image (logged once) falls back to a neutral music-note placeholder.
 * State is keyed by URL, so new data for the same card (e.g. after a refresh) is picked up automatically.
 */
export const Artwork = memo(function Artwork({ uri, color, size, radius = 8, round, style, placeholderIcon = 'musical-notes' }: ArtworkProps) {
  const url = useMemo(() => {
    const clean = normalizeArtworkUrl(uri);
    return clean ? sizedArtworkUrl(clean, size) : undefined;
  }, [uri, size]);
  const [result, setResult] = useState<{ url?: string; status: 'loaded' | 'failed' } | null>(null);
  const status = !url ? 'none' : result?.url === url ? result.status : 'loading';
  const r = round ? size / 2 : radius;

  return (
    <View style={[{ width: size, height: size, borderRadius: r, overflow: 'hidden', backgroundColor: '#1f1f1f' }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {status !== 'loaded' ? (
        <>
          <LinearGradient colors={[shade(color, 0.32), shade(color, 0.18)]} style={StyleSheet.absoluteFill} />
          <Ionicons name={placeholderIcon} size={size * 0.35} color="rgba(255,255,255,0.28)" style={{ position: 'absolute', alignSelf: 'center', top: size * 0.325 }} />
        </>
      ) : null}
      {url && status !== 'failed' ? (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
          cachePolicy="memory-disk"
          recyclingKey={url}
          onLoad={() => setResult({ url, status: 'loaded' })}
          onError={(e) => {
            logArtworkFailure(url, e.error);
            setResult({ url, status: 'failed' });
          }}
        />
      ) : null}
      {status === 'loading' ? <Shimmer radius={r} /> : null}
    </View>
  );
});

export function GradientCover({ colors, size, radius = 8, icon = 'musical-notes' }: { colors: [string, string]; size: number; radius?: number; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.4} color="rgba(255,255,255,0.9)" />
    </LinearGradient>
  );
}

export function PlaylistCover({ playlist, size, radius = 8 }: { playlist: UserPlaylist; size: number; radius?: number }) {
  const option = COVER_OPTIONS.find((c) => c.id === playlist.cover);
  const first = playlist.tracks.slice(0, 4);

  if (playlist.cover === 'auto' && first.length >= 4) {
    const half = size / 2;
    return (
      <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>
        {first.map((t) => (
          <Artwork key={t.id} uri={t.artworkUrl} color={t.color} size={half} radius={0} />
        ))}
      </View>
    );
  }
  if (playlist.cover === 'auto' && first.length > 0) return <Artwork uri={first[0].artworkUrl} color={first[0].color} size={size} radius={radius} />;
  return <GradientCover colors={option?.colors ?? COVER_OPTIONS[3].colors} size={size} radius={radius} />;
}

/** Cover for curated playlists: a 2x2 collage of real track covers when available, otherwise the single cover. */
export function CollageCover({ urls, uri, color, size, radius = 8 }: { urls?: string[]; uri?: string; color: string; size: number; radius?: number }) {
  const distinct = Array.from(new Set((urls ?? []).map((u) => normalizeArtworkUrl(u)).filter((u): u is string => !!u))).slice(0, 4);
  if (distinct.length >= 4) {
    const half = size / 2;
    return (
      <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>
        {distinct.map((u) => (
          <Artwork key={u} uri={u} color={color} size={half} radius={0} />
        ))}
      </View>
    );
  }
  return <Artwork uri={uri ?? distinct[0]} color={color} size={size} radius={radius} />;
}
