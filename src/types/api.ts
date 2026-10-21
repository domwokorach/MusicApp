import type { Album, Artist, Genre, GenreMix, Playlist, Track } from './music';

export interface PageParams {
  limit?: number;
  offset?: number;
  /** Genre / tag filter (e.g. "rock"). */
  tag?: string;
}

export type TrackSort = 'trending' | 'featured' | 'recommended' | 'latest';

export interface Page<T> {
  items: T[];
  offset: number;
  hasMore: boolean;
}

export interface AlbumDetail {
  album: Album;
  tracks: Track[];
}

export interface ArtistDetail {
  artist: Artist;
  tracks: Track[];
  albums: Album[];
}

export interface PlaylistDetail {
  playlist: Playlist;
  tracks: Track[];
}

/** Contract implemented by the Jamendo provider and the offline mock provider. */
export interface MusicProvider {
  readonly name: string;
  searchSongs(query: string, page?: PageParams): Promise<Page<Track>>;
  searchAlbums(query: string, page?: PageParams): Promise<Page<Album>>;
  searchArtists(query: string, page?: PageParams): Promise<Page<Artist>>;
  searchPlaylists(query: string, page?: PageParams): Promise<Page<Playlist>>;
  trending(page?: PageParams): Promise<Page<Track>>;
  tracksBy(sort: TrackSort, page?: PageParams): Promise<Page<Track>>;
  newAlbums(page?: PageParams): Promise<Page<Album>>;
  popularArtists(page?: PageParams): Promise<Page<Artist>>;
  categories(): Promise<Genre[]>;
  /** Live tracks per genre; `genreIds` are provider genre ids. */
  mixes(genreIds: string[], perGenre?: number): Promise<GenreMix[]>;
  getPlaylist(id: string): Promise<PlaylistDetail>;
  getAlbum(id: string): Promise<AlbumDetail>;
  getArtist(id: string): Promise<ArtistDetail>;
  getTrack(id: string): Promise<Track>;
}
