import { StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/common/Artwork';
import type { Track } from '@/types/music';

/** Large centred cover with a soft drop shadow, as on the full-screen player. */
export function AlbumArtwork({ track, size }: { track: Track; size: number }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.shadow}>
        <Artwork uri={track.artworkUrl} color={track.color} size={size} radius={10} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 12 },
  shadow: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 28, shadowOffset: { width: 0, height: 16 }, elevation: 16 },
});
