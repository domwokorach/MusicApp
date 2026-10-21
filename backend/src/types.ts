/** Normalised shapes returned to the mobile app. */
export interface ApiTrack {
  id: string;
  title: string;
  artistId?: string;
  artistName: string;
  albumId?: string;
  albumName?: string;
  genre?: string;
  durationSec?: number;
  /** Streamable MP3 URL supplied by Jamendo. Absent when the track has no stream. */
  audioUrl?: string;
  artworkUrl?: string;
  /** Creative Commons licence URL; shown to listeners as attribution. */
  licenseUrl?: string;
  /** Link back to the track on jamendo.com. */
  shareUrl?: string;
}
export interface ApiAlbum {
  id: string;
  title: string;
  artistId?: string;
  artistName: string;
  year?: number;
  artworkUrl?: string;
}
export interface ApiArtist {
  id: string;
  name: string;
  imageUrl?: string;
}
export interface ApiMix {
  id: string;
  name: string;
  /** Artwork of a real track in this mix, distinct from the other mixes' covers when possible. */
  coverUrl?: string;
  tracks: ApiTrack[];
}
export interface ApiPlaylist {
  id: string;
  title: string;
  ownerName?: string;
  shareUrl?: string;
}
export interface Page<T> {
  items: T[];
  offset: number;
  hasMore: boolean;
}
