import { Request, RequestHandler, Response, Router } from 'express';
import { z } from 'zod';

import { config } from '../config';
import { AuthError, disconnect, getSession, handleCallback, redeemTicket, startAuth, validAccessToken } from '../services/spotifyAuthService';

const wrap = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler => (req, res, next) => {
  fn(req, res).catch(next);
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// ---------------------------------------------------------------------------------------------
// Browser-facing: the ONE redirect URI registered in the Spotify dashboard.
//   {PUBLIC_BASE_URL}/auth/spotify/callback
// ---------------------------------------------------------------------------------------------
export const spotifyCallbackRouter = Router();

spotifyCallbackRouter.get('/callback', wrap(async (req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  const outcome = await handleCallback(req.query);

  if (outcome.failure || !outcome.redirectTo) {
    res.status(400).type('html').send(page('Sign-in could not be completed', outcome.failure ?? 'Please return to the app and try again.'));
    return;
  }
  // A 302 returns the user to the app automatically; the page is a fallback if the browser blocks the custom scheme.
  const target = outcome.redirectTo;
  res.status(302).set('Location', target).type('html').send(
    page('Returning to Sonara…', `If the app does not open automatically, <a href="${esc(target)}">tap here to return to Sonara</a>.`, `<meta http-equiv="refresh" content="0;url=${esc(target)}">`),
  );
}));

function page(title: string, body: string, head = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${head}
<style>body{background:#121212;color:#fff;font-family:-apple-system,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center}
main{max-width:420px}h1{font-size:22px}p{color:#b3b3b3;line-height:1.5}a{color:#1db954;font-weight:700}</style></head>
<body><main><h1>${esc(title)}</h1><p>${body}</p></main></body></html>`;
}

// ---------------------------------------------------------------------------------------------
// App-facing JSON API (mounted at /api/spotify)
// ---------------------------------------------------------------------------------------------
export const spotifyApiRouter = Router();

spotifyApiRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const startBody = z.object({ returnUrl: z.string().min(1).max(512) });
const redeemBody = z.object({ ticket: z.string().min(20).max(200) });

spotifyApiRouter.post('/auth/start', wrap(async (req, res) => {
  const { returnUrl } = startBody.parse(req.body);
  res.json({ authorizeUrl: startAuth(returnUrl) });
}));

spotifyApiRouter.post('/auth/redeem', wrap(async (req, res) => {
  const { ticket } = redeemBody.parse(req.body);
  res.json({ sessionToken: redeemTicket(ticket) });
}));

function sessionIdFrom(req: Request): string {
  const header = req.get('authorization') ?? '';
  const match = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(header);
  if (!match) throw new AuthError('Connect your Spotify account first.', 401, 'not_connected');
  return match[1];
}

spotifyApiRouter.get('/auth/status', wrap(async (req, res) => {
  const s = getSession(sessionIdFrom(req));
  res.json({ connected: true, scope: s.scope });
}));

spotifyApiRouter.post('/auth/disconnect', wrap(async (req, res) => {
  disconnect(sessionIdFrom(req));
  res.json({ ok: true });
}));

// Read-only Spotify Web API proxy. Only these endpoints and query parameters are forwarded.
const ID = '[A-Za-z0-9]{8,32}';
const ALLOWED_PATHS = [
  /^\/search$/,
  new RegExp(`^/shows/${ID}$`),
  new RegExp(`^/shows/${ID}/episodes$`),
  /^\/me\/shows$/,
  /^\/me\/playlists$/,
  /^\/me\/player\/recently-played$/,
  new RegExp(`^/albums/${ID}$`),
  new RegExp(`^/artists/${ID}$`),
  new RegExp(`^/artists/${ID}/albums$`),
  new RegExp(`^/artists/${ID}/top-tracks$`),
  new RegExp(`^/playlists/${ID}$`),
  new RegExp(`^/playlists/${ID}/tracks$`),
];
const ALLOWED_QUERY = new Set(['q', 'type', 'limit', 'offset', 'market', 'fields', 'include_groups']);

async function spotifyGet(sessionId: string, path: string, query: URLSearchParams, forceRefresh = false): Promise<globalThis.Response> {
  const token = await validAccessToken(sessionId, forceRefresh);
  const url = `${config.spotifyApiUrl}${path}${query.size ? `?${query}` : ''}`;
  try {
    return await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(config.upstreamTimeoutMs) });
  } catch {
    throw new AuthError('Spotify is unreachable right now.', 504, 'upstream_unreachable');
  }
}

spotifyApiRouter.get(/^\/proxy(\/.*)$/, wrap(async (req, res) => {
  const sessionId = sessionIdFrom(req);
  const path = (req.params as unknown as string[])[0];
  if (!ALLOWED_PATHS.some((re) => re.test(path))) throw new AuthError('This Spotify endpoint is not available.', 404, 'not_allowed');

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (!ALLOWED_QUERY.has(k) || typeof v !== 'string' || v.length > 200) throw new AuthError(`Unsupported parameter: ${k}`, 400, 'bad_query');
    query.set(k, v);
  }

  let upstream = await spotifyGet(sessionId, path, query);
  if (upstream.status === 401) upstream = await spotifyGet(sessionId, path, query, true); // token revoked early: refresh once

  if (upstream.status === 401) {
    disconnect(sessionId);
    throw new AuthError('Your Spotify session expired. Connect again.', 401, 'session_expired');
  }
  const retryAfter = upstream.headers.get('retry-after');
  if (retryAfter) res.set('Retry-After', retryAfter);
  if (upstream.status >= 500) throw new AuthError('Spotify had a problem. Try again shortly.', 502, 'upstream_error');
  res.status(upstream.status).json(await upstream.json().catch(() => ({})));
}));
