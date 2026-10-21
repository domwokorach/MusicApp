import { createHash, randomBytes } from 'node:crypto';

import { config } from '../config';
import { SessionStore, type SpotifySession } from './sessionStore';

/**
 * Spotify Authorization Code flow with PKCE, executed entirely on the server:
 *
 *   app -> POST /api/spotify/auth/start  -> authorize URL (state + PKCE challenge generated here)
 *   Spotify -> GET /auth/spotify/callback?code&state   (the single registered HTTPS redirect URI)
 *   server validates state, exchanges the code (client secret + code_verifier), stores the tokens
 *   server -> 302 to the app's return URL carrying only a short-lived, single-use TICKET
 *   app -> POST /api/spotify/auth/redeem {ticket} -> opaque session token (never a Spotify token)
 *
 * Spotify access/refresh tokens, the authorization code and the client secret never reach the device.
 */

export class AuthError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

const STATE_TTL_MS = 10 * 60_000;
const TICKET_TTL_MS = 60_000;

const b64url = (buf: Buffer) => buf.toString('base64url');
const random = (bytes = 32) => b64url(randomBytes(bytes));

interface Pending {
  verifier: string;
  returnUrl: string;
  createdAt: number;
}

const pending = new Map<string, Pending>();
const tickets = new Map<string, { sessionId: string; createdAt: number }>();
export const sessions = new SessionStore(config.tokenStoreFile, config.tokenEncryptionKey);

function sweep() {
  const now = Date.now();
  for (const [k, v] of pending) if (now - v.createdAt > STATE_TTL_MS) pending.delete(k);
  for (const [k, v] of tickets) if (now - v.createdAt > TICKET_TTL_MS) tickets.delete(k);
}
setInterval(sweep, 60_000).unref();

/** The exact redirect URI. It must equal the value registered in the Spotify dashboard. */
export const redirectUri = () => `${config.publicBaseUrl}/auth/spotify/callback`;

export function isConfigured(): { ok: true } | { ok: false; reason: string } {
  if (!config.spotifyClientId || !config.spotifyClientSecret) return { ok: false, reason: 'Spotify is not configured on the server (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET).' };
  if (!config.publicBaseUrl.startsWith('https://')) return { ok: false, reason: 'PUBLIC_BASE_URL must be the public HTTPS URL of this server (for example https://api.example.com).' };
  return { ok: true };
}

/**
 * Only deep links into this app (or the configured web origins in development) may receive the ticket,
 * so a crafted link cannot send a login ticket to an attacker-controlled site.
 */
export function validateReturnUrl(raw: string): string {
  if (raw.length > 512) throw new AuthError('Invalid return URL.', 400, 'invalid_return_url');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AuthError('Invalid return URL.', 400, 'invalid_return_url');
  }
  if (url.username || url.password || url.hash) throw new AuthError('Invalid return URL.', 400, 'invalid_return_url');
  const scheme = url.protocol.replace(':', '').toLowerCase();
  // Development clients register `exp+<scheme>` alongside `<scheme>`; both belong to this app.
  const isAppLink = config.appSchemes.includes(scheme.replace(/^exp\+/, ''));
  const isWebDev = (scheme === 'http' || scheme === 'https') && config.corsOrigins.includes(url.origin);
  if (!isAppLink && !isWebDev) throw new AuthError('This return URL is not allowed.', 400, 'invalid_return_url');
  return url.toString();
}

export function startAuth(returnUrl: string): string {
  const cfg = isConfigured();
  if (!cfg.ok) throw new AuthError(cfg.reason, 503, 'not_configured');
  const safeReturn = validateReturnUrl(returnUrl);
  sweep();

  const state = random(32);
  const verifier = random(64); // 86 chars, within PKCE's 43-128
  pending.set(state, { verifier, returnUrl: safeReturn, createdAt: Date.now() });

  const url = new URL('/authorize', config.spotifyAccountsUrl);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.spotifyClientId!,
    scope: config.spotifyScopes,
    redirect_uri: redirectUri(),
    state,
    code_challenge_method: 'S256',
    code_challenge: b64url(createHash('sha256').update(verifier).digest()),
  }).toString();
  return url.toString();
}

async function tokenRequest(body: Record<string, string>): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(`${config.spotifyAccountsUrl}/api/token`, {
      method: 'POST',
      signal: AbortSignal.timeout(config.upstreamTimeoutMs),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${config.spotifyClientId}:${config.spotifyClientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams(body),
    });
  } catch {
    throw new AuthError('Spotify is unreachable right now.', 504, 'upstream_unreachable');
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

function toSession(json: Record<string, unknown>, previous?: SpotifySession): SpotifySession {
  return {
    accessToken: String(json.access_token),
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : previous?.refreshToken,
    expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
    scope: typeof json.scope === 'string' ? json.scope : (previous?.scope ?? ''),
    createdAt: previous?.createdAt ?? Date.now(),
  };
}

export interface CallbackOutcome {
  /** Where to send the browser next: the app's return URL (with ticket or error) */
  redirectTo?: string;
  /** Set when there is no valid return URL (unknown / expired state): show an error page instead. */
  failure?: string;
}

export async function handleCallback(query: { code?: unknown; state?: unknown; error?: unknown }): Promise<CallbackOutcome> {
  const state = typeof query.state === 'string' ? query.state : '';
  const entry = pending.get(state);
  if (!entry || Date.now() - entry.createdAt > STATE_TTL_MS) {
    pending.delete(state);
    return { failure: 'This sign-in link is invalid or has expired. Return to the app and try again.' };
  }
  pending.delete(state); // state is single-use

  const back = (params: Record<string, string>) => {
    const url = new URL(entry.returnUrl);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return { redirectTo: url.toString() };
  };

  if (typeof query.error === 'string') return back({ error: query.error === 'access_denied' ? 'access_denied' : 'spotify_error' });
  if (typeof query.code !== 'string' || !query.code) return back({ error: 'missing_code' });

  const res = await tokenRequest({ grant_type: 'authorization_code', code: query.code, redirect_uri: redirectUri(), code_verifier: entry.verifier }).catch(() => null);
  if (!res || !res.ok || typeof res.json.access_token !== 'string') {
    // Typical causes: invalid/expired code, redirect_uri mismatch. Log the Spotify error CODE only.
    console.error('[spotify] code exchange failed:', res?.status, typeof res?.json.error === 'string' ? res.json.error : 'unknown');
    return back({ error: res?.json.error === 'invalid_grant' ? 'invalid_code' : 'exchange_failed' });
  }

  const sessionId = random(32);
  sessions.set(sessionId, toSession(res.json));
  const ticket = random(32);
  tickets.set(ticket, { sessionId, createdAt: Date.now() });
  return back({ ticket });
}

/** Exchanges a ticket for the app session token. Tickets are single-use and expire after 60 seconds. */
export function redeemTicket(ticket: string): string {
  sweep();
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  if (!entry || Date.now() - entry.createdAt > TICKET_TTL_MS || !sessions.get(entry.sessionId)) {
    throw new AuthError('This sign-in ticket is invalid or has expired. Connect again.', 401, 'invalid_ticket');
  }
  return entry.sessionId;
}

export function getSession(sessionId: string): SpotifySession {
  const s = sessions.get(sessionId);
  if (!s) throw new AuthError('Connect your Spotify account first.', 401, 'not_connected');
  return s;
}

export function disconnect(sessionId: string) {
  sessions.delete(sessionId);
}

const refreshing = new Map<string, Promise<SpotifySession>>();

async function refresh(sessionId: string, current: SpotifySession): Promise<SpotifySession> {
  const inflight = refreshing.get(sessionId);
  if (inflight) return inflight;
  const run = (async () => {
    if (!current.refreshToken) {
      sessions.delete(sessionId);
      throw new AuthError('Your Spotify session expired. Connect again.', 401, 'session_expired');
    }
    const res = await tokenRequest({ grant_type: 'refresh_token', refresh_token: current.refreshToken });
    if (!res.ok || typeof res.json.access_token !== 'string') {
      if (res.json.error === 'invalid_grant' || res.status === 400 || res.status === 401) {
        sessions.delete(sessionId); // revoked or expired refresh token: the user must sign in again
        throw new AuthError('Your Spotify session expired. Connect again.', 401, 'session_expired');
      }
      throw new AuthError('Could not refresh the Spotify session.', 502, 'refresh_failed');
    }
    const next = toSession(res.json, current);
    sessions.set(sessionId, next);
    return next;
  })().finally(() => refreshing.delete(sessionId));
  refreshing.set(sessionId, run);
  return run;
}

/** A valid access token for this session, refreshing it first if it expires within a minute. */
export async function validAccessToken(sessionId: string, force = false): Promise<string> {
  let s = getSession(sessionId);
  if (force || s.expiresAt - Date.now() < 60_000) s = await refresh(sessionId, s);
  return s.accessToken;
}
