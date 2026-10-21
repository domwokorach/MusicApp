export type MusicSource = 'mock' | 'jamendo' | 'spotify';

export interface Track {
  id: string;
  title: string;
  kind: 'song' | 'episode';
  artistName: string;
  artistId?: string;
  albumId?: string;
  albumName?: string;
  podcastId?: string;
  genre?: string;
  /** Seconds, when the provider reports it. The player replaces it with the real value once loaded. */
  durationSec?: number;
  /** ISO date (episodes). */
  releaseDate?: string;
  /** Epoch ms; present on entries of the local play history. */
  playedAt?: number;
  /** Null when the source only provides metadata (no licensed audio). */
  audioUrl: string | null;
  artworkUrl?: string;
  /** Accent colour used for placeholders and the player gradient. */
  color: string;
  source: MusicSource;
  licenseUrl?: string;
  /** Link back to the track page (Jamendo requires attribution to the artist / source). */
  shareUrl?: string;
  /** Link to the item on its own service (e.g. open.spotify.com). */
  externalUrl?: string;
  credits?: { performers: string[]; writers: string[]; producers: string[] };
}

export interface Artist {
  id: string;
  name: string;
  imageUrl?: string;
  color: string;
  genre?: string;
  followers?: string;
  bio?: string;
  source: MusicSource;
}

export interface Album {
  id: string;
  title: string;
  artistId?: string;
  artistName: string;
  year?: number;
  artworkUrl?: string;
  color: string;
  genre?: string;
  source: MusicSource;
}

/** Curated / category playlist. Tracks are fetched separately via the API. */
export interface Playlist {
  id: string;
  /** Distinct real cover images (e.g. from the tracks of a mix) for a 2x2 collage. */
  coverUrls?: string[];
  externalUrl?: string;
  /** Catalogue the playlist came from (undefined = demo). */
  source?: MusicSource;
  title: string;
  description: string;
  artworkUrl?: string;
  color: string;
}

export interface Podcast {
  id: string;
  episodeCount?: number;
  source?: MusicSource;
  publisher?: string;
  externalUrl?: string;
  title: string;
  host: string;
  category: string;
  description: string;
  artworkUrl?: string;
  color: string;
}

export interface Genre {
  id: string;
  name: string;
  color: string;
  /** Real artwork from a track in this genre. */
  artworkUrl?: string;
}

/** A genre with live tracks (used for genre tiles and the "<Genre> Mix" shelves). */
export interface GenreMix {
  genre: Genre;
  tracks: Track[];
}

export type CollectionKind = 'album' | 'artist' | 'playlist' | 'podcast' | 'liked';

export function isPlayable(track: Track): boolean {
  return !!track.audioUrl;
}
