import type { Album, Artist } from '@/types/music';

/** Placeholder artwork (random photos seeded by a string, so each item keeps the same image). */
export const placeholderArt = (seed: string, size = 600) => `https://picsum.photos/seed/${seed}/${size}/${size}`;

/** All names are original placeholders. */
export const MOCK_ARTISTS: Artist[] = [
  { id: 'a1', name: 'Nova Lane', genre: 'Pop', color: '#E91E63', followers: '4.2M', bio: 'Synth-pop storyteller known for glittering hooks and late-night confessions.' },
  { id: 'a2', name: 'The Midnight Tides', genre: 'Indie', color: '#1E88E5', followers: '1.8M', bio: 'Four friends, one van and a shared love of coastal reverb.' },
  { id: 'a3', name: 'Kairo Vale', genre: 'Hip-Hop', color: '#F9A825', followers: '2.9M', bio: 'Rooftop poet turned city chronicler with a razor-sharp flow.' },
  { id: 'a4', name: 'Luna Ward', genre: 'R&B', color: '#8E24AA', followers: '3.1M', bio: 'Velvet vocals over minimalist grooves.' },
  { id: 'a5', name: 'Echo Harbor', genre: 'Electronic', color: '#00ACC1', followers: '2.2M', bio: 'Producer duo building cinematic club soundscapes.' },
  { id: 'a6', name: 'Sable & Smoke', genre: 'Jazz', color: '#8D6E63', followers: '640K', bio: 'A modern jazz quartet at home in dimly lit rooms.' },
  { id: 'a7', name: 'Rook Atlas', genre: 'Rock', color: '#E64A19', followers: '1.5M', bio: 'Big riffs, bigger choruses, zero apologies.' },
  { id: 'a8', name: 'Mira Solis', genre: 'Chill', color: '#43A047', followers: '980K', bio: 'Sun-washed acoustic textures for slow afternoons.' },
].map((a) => ({ ...a, imageUrl: placeholderArt(`artist-${a.id}`), source: 'mock' as const }));

export interface AlbumDef {
  id: string;
  title: string;
  artistId: string;
  year: number;
  genre: string;
  color: string;
  tracks: string[];
  writers: string[];
  producers: string[];
}

export const ALBUM_DEFS: AlbumDef[] = [
  { id: 'al1', title: 'Neon Afterglow', artistId: 'a1', year: 2025, genre: 'Pop', color: '#E91E63', tracks: ['Electric Daydream', 'Glass Hearts', 'Afterglow'], writers: ['Nova Lane', 'Jonah Reyes'], producers: ['Jonah Reyes'] },
  { id: 'al2', title: 'Harbor Lights', artistId: 'a2', year: 2024, genre: 'Indie', color: '#1E88E5', tracks: ['Salt on the Wind', 'Paper Boats', 'Lighthouse Hours'], writers: ['Theo Marsh', 'Ines Calder'], producers: ['Ines Calder'] },
  { id: 'al3', title: 'Concrete Gardens', artistId: 'a3', year: 2025, genre: 'Hip-Hop', color: '#F9A825', tracks: ['Rooftop Sermon', 'City Bloom', 'Late Bus Home'], writers: ['Kairo Vale'], producers: ['Dre Okafor', 'Kairo Vale'] },
  { id: 'al4', title: 'Velvet Static', artistId: 'a4', year: 2024, genre: 'R&B', color: '#8E24AA', tracks: ['Slow Burn', 'Satin Skies', 'Voicemail'], writers: ['Luna Ward', 'Priya Anand'], producers: ['Priya Anand'] },
  { id: 'al5', title: 'Pulse Theory', artistId: 'a5', year: 2025, genre: 'Electronic', color: '#00ACC1', tracks: ['Signal Fade', 'Orbit Run', 'Binary Sunrise'], writers: ['Echo Harbor'], producers: ['Echo Harbor'] },
  { id: 'al6', title: 'Blue Hour Sessions', artistId: 'a6', year: 2023, genre: 'Jazz', color: '#8D6E63', tracks: ['Smoke & Mirrors', 'Corner Table', 'Last Call Waltz'], writers: ['Elias Sable'], producers: ['Marguerite Voss'] },
  { id: 'al7', title: 'Wildfire Road', artistId: 'a7', year: 2025, genre: 'Rock', color: '#E64A19', tracks: ['Burn the Map', 'Highway Hymn', 'Ember'], writers: ['Rook Atlas', 'Cade Holloway'], producers: ['Cade Holloway'] },
  { id: 'al8', title: 'Sol y Mar', artistId: 'a8', year: 2024, genre: 'Chill', color: '#43A047', tracks: ['Tide Pools', 'Siesta', 'Golden Coast'], writers: ['Mira Solis'], producers: ['Mira Solis', 'Tomas Ibarra'] },
];

export const MOCK_ALBUMS: Album[] = ALBUM_DEFS.map((d) => ({
  id: d.id,
  title: d.title,
  artistId: d.artistId,
  artistName: MOCK_ARTISTS.find((a) => a.id === d.artistId)!.name,
  year: d.year,
  genre: d.genre,
  color: d.color,
  artworkUrl: placeholderArt(d.id),
  source: 'mock' as const,
}));
