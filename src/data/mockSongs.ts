import type { Track } from '@/types/music';

import { ALBUM_DEFS, MOCK_ARTISTS, placeholderArt } from './mockAlbums';
import { MOCK_PODCAST_DEFS } from './mockPlaylists';

/**
 * Royalty-free SoundHelix demo tracks (https://www.soundhelix.com/examples), cycled across the catalogue
 * so the app plays real audio with no API key. Check their terms before shipping, or use Jamendo.
 */
const AUDIO = Array.from({ length: 16 }, (_, i) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${i + 1}.mp3`);
let cursor = 0;
const nextAudio = () => AUDIO[cursor++ % AUDIO.length];

export const MOCK_SONGS: Track[] = ALBUM_DEFS.flatMap((def) => {
  const artist = MOCK_ARTISTS.find((a) => a.id === def.artistId)!;
  return def.tracks.map((title, i) => ({
    id: `t_${def.id}_${i + 1}`,
    title,
    kind: 'song' as const,
    artistName: artist.name,
    artistId: artist.id,
    albumId: def.id,
    albumName: def.title,
    genre: def.genre,
    audioUrl: nextAudio(),
    artworkUrl: placeholderArt(`${def.id}-${i}`),
    color: def.color,
    source: 'mock' as const,
    credits: { performers: [artist.name], writers: def.writers, producers: def.producers },
  }));
});

export const MOCK_EPISODES: Track[] = MOCK_PODCAST_DEFS.flatMap((def) =>
  def.episodes.map((title, i) => ({
    id: `e_${def.id}_${i + 1}`,
    title,
    kind: 'episode' as const,
    artistName: def.host,
    podcastId: def.id,
    albumName: def.title,
    genre: 'Podcasts',
    audioUrl: nextAudio(),
    artworkUrl: placeholderArt(`${def.id}-ep${i}`),
    color: def.color,
    source: 'mock' as const,
    credits: { performers: [def.host], writers: [def.host], producers: [`${def.title} Team`] },
  })),
);

export const MOCK_TRACKS_BY_ID: Record<string, Track> = Object.fromEntries([...MOCK_SONGS, ...MOCK_EPISODES].map((t) => [t.id, t]));
