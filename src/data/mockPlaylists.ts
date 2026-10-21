import type { Genre, Playlist, Podcast } from '@/types/music';

import { placeholderArt } from './mockAlbums';

export const MOCK_GENRES: Genre[] = [
  { id: 'Pop', name: 'Pop', color: '#E91E63' },
  { id: 'Indie', name: 'Indie', color: '#1E88E5' },
  { id: 'Hip-Hop', name: 'Hip-Hop', color: '#F9A825' },
  { id: 'R&B', name: 'R&B', color: '#8E24AA' },
  { id: 'Electronic', name: 'Electronic', color: '#00ACC1' },
  { id: 'Jazz', name: 'Jazz', color: '#8D6E63' },
  { id: 'Rock', name: 'Rock', color: '#E64A19' },
  { id: 'Chill', name: 'Chill', color: '#43A047' },
];

interface PlaylistDef extends Omit<Playlist, 'artworkUrl'> {
  trackIds: string[];
}

export const MOCK_PLAYLIST_DEFS: PlaylistDef[] = [
  { id: 'pl1', title: 'Today’s Top Hits', description: 'The biggest tracks right now.', color: '#E91E63', trackIds: ['t_al1_1', 't_al3_1', 't_al5_1', 't_al7_1', 't_al4_1', 't_al8_3', 't_al2_1', 't_al1_2'] },
  { id: 'pl2', title: 'Late Night Drive', description: 'Neon lights and open roads.', color: '#5E35B1', trackIds: ['t_al5_2', 't_al4_2', 't_al1_3', 't_al7_2', 't_al3_3', 't_al5_3'] },
  { id: 'pl3', title: 'Focus Flow', description: 'Deep concentration, zero distractions.', color: '#00897B', trackIds: ['t_al6_1', 't_al6_2', 't_al8_1', 't_al5_1', 't_al6_3', 't_al8_2'] },
  { id: 'pl4', title: 'Workout Energy', description: 'Push harder with high-tempo bangers.', color: '#F4511E', trackIds: ['t_al7_1', 't_al3_2', 't_al5_2', 't_al7_3', 't_al1_1', 't_al3_1'] },
  { id: 'pl5', title: 'Chill Vibes', description: 'Easy, breezy and sun-soaked.', color: '#43A047', trackIds: ['t_al8_1', 't_al8_2', 't_al8_3', 't_al2_2', 't_al4_3', 't_al6_2'] },
  { id: 'pl6', title: 'Indie Sunrise', description: 'Warm guitars for new mornings.', color: '#1E88E5', trackIds: ['t_al2_1', 't_al2_2', 't_al2_3', 't_al8_3', 't_al1_2'] },
];

export const MOCK_PLAYLISTS: Playlist[] = MOCK_PLAYLIST_DEFS.map(({ trackIds: _ids, ...p }) => ({ ...p, artworkUrl: placeholderArt(`pl-${p.id}`) }));

interface PodcastDef extends Omit<Podcast, 'artworkUrl'> {
  episodes: string[];
}

export const MOCK_PODCAST_DEFS: PodcastDef[] = [
  { id: 'p1', title: 'The Daily Groove', host: 'Mia Okonkwo', category: 'Music Culture', color: '#5C6BC0', description: 'Short, sharp conversations about the records shaping today.', episodes: ['Why Basslines Matter', 'The Return of the Album', 'Inside a Studio Session'] },
  { id: 'p2', title: 'Code & Coffee', host: 'Sam Ito', category: 'Technology', color: '#26A69A', description: 'Developers, designers and the products they ship.', episodes: ['Shipping on Fridays', 'Mobile Performance Myths', 'Design Systems at Scale'] },
  { id: 'p3', title: 'Mindful Minutes', host: 'Dr. Ana Reyes', category: 'Wellness', color: '#EC407A', description: 'Ten-minute practices for calmer days.', episodes: ['Morning Reset', 'Breathing Under Pressure', 'Sleep Wind-Down'] },
  { id: 'p4', title: 'Story Lab', host: 'Jules Park', category: 'Storytelling', color: '#FFA726', description: 'True stories, told by the people who lived them.', episodes: ['The Last Ferry', 'A Stranger’s Recipe', 'Lost and Found'] },
  { id: 'p5', title: 'Match Day Talk', host: 'Ravi & Ben', category: 'Sports', color: '#EF5350', description: 'Weekly analysis, banter and bold predictions.', episodes: ['Derby Day Preview', 'Transfer Window Chaos', 'Underdog Season'] },
];

export const MOCK_PODCASTS: Podcast[] = MOCK_PODCAST_DEFS.map(({ episodes: _eps, ...p }) => ({ ...p, artworkUrl: placeholderArt(p.id) }));
