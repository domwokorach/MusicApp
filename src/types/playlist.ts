import type { Track } from './music';

export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  /** 'auto' uses a mosaic of the first tracks, otherwise an id from COVER_OPTIONS. */
  cover: string;
  tracks: Track[];
  createdAt: number;
}

export interface PlaylistInput {
  name: string;
  description?: string;
  cover: string;
  tracks: Track[];
}
