import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { z } from 'zod';

import { AuthError } from '../services/spotifyAuthService';
import { GENRES, TRACK_ORDERS, UpstreamError, getAlbum, getArtist, getMixes, getPlaylist, listAlbums, listArtists, listPlaylists, listTracks } from '../services/jamendoService';

const text = z.string().trim().min(1).max(100);
const tag = z.string().trim().regex(/^[a-z0-9_+-]{1,40}$/i, 'invalid tag');
const numericId = z.string().regex(/^\d{1,12}$/, 'invalid id');

const paging = {
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
};

const tracksQuery = z.object({
  q: text.optional(),
  tags: tag.optional(),
  featured: z.enum(['1', 'true']).optional(),
  order: z.enum(TRACK_ORDERS).optional(),
  artistId: numericId.optional(),
  albumId: numericId.optional(),
  id: numericId.optional(),
  ...paging,
});
const albumsQuery = z.object({ q: text.optional(), order: z.enum(['releasedate_desc', 'popularity_week']).optional(), artistId: numericId.optional(), ...paging });
const mixesQuery = z.object({
  tags: z.string().transform((s) => s.split(',').map((t) => t.trim()).filter(Boolean)).pipe(z.array(tag).min(1).max(12)),
  perTag: z.coerce.number().int().min(1).max(20).default(10),
});
const playlistsQuery = z.object({ q: text.optional(), ...paging });
const artistsQuery = z.object({ q: text.optional(), order: z.enum(['popularity_week']).optional(), ...paging });

/** Wraps async handlers so rejections reach the error middleware. */
const handler = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler => (req, res, next) => {
  fn(req, res).catch(next);
};

export const musicRoutes = Router();

musicRoutes.get('/health', (_req, res) => {
  res.json({ ok: true });
});

musicRoutes.get('/genres', (_req, res) => {
  res.json({ items: GENRES });
});

musicRoutes.get('/mixes', handler(async (req, res) => {
  const q = mixesQuery.parse(req.query);
  res.json({ items: await getMixes(q.tags, q.perTag) });
}));

musicRoutes.get('/tracks', handler(async (req, res) => {
  const q = tracksQuery.parse(req.query);
  res.json(await listTracks({ ...q, featured: q.featured !== undefined }));
}));

musicRoutes.get('/albums', handler(async (req, res) => {
  res.json(await listAlbums(albumsQuery.parse(req.query)));
}));

musicRoutes.get('/albums/:id', handler(async (req, res) => {
  const id = numericId.parse(req.params.id);
  const result = await getAlbum(id);
  if (!result) {
    res.status(404).json({ error: 'Album not found' });
    return;
  }
  res.json(result);
}));

musicRoutes.get('/playlists', handler(async (req, res) => {
  res.json(await listPlaylists(playlistsQuery.parse(req.query)));
}));

musicRoutes.get('/playlists/:id', handler(async (req, res) => {
  const result = await getPlaylist(numericId.parse(req.params.id));
  if (!result) {
    res.status(404).json({ error: 'Playlist not found' });
    return;
  }
  res.json(result);
}));

musicRoutes.get('/artists', handler(async (req, res) => {
  res.json(await listArtists(artistsQuery.parse(req.query)));
}));

musicRoutes.get('/artists/:id', handler(async (req, res) => {
  const id = numericId.parse(req.params.id);
  const result = await getArtist(id);
  if (!result) {
    res.status(404).json({ error: 'Artist not found' });
    return;
  }
  res.json(result);
}));

/** Central error mapping: validation -> 400, upstream -> its status, anything else -> generic 500. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: 'Invalid request', details: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
    return;
  }
  if (err instanceof AuthError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof UpstreamError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[server] unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
}
