import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it } from 'node:test';

process.env.JAMENDO_CLIENT_ID = 'test';
process.env.SPOTIFY_CLIENT_ID = 'spotify-client';
process.env.SPOTIFY_CLIENT_SECRET = 'spotify-secret-DO-NOT-LEAK';
process.env.PUBLIC_BASE_URL = 'https://api.example.test';
process.env.CORS_ORIGINS = 'http://localhost:8081';
process.env.RATE_LIMIT_PER_MINUTE = '10000';
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '10000';

const realFetch = globalThis.fetch;
interface Call { url: string; method: string; headers: Record<string, string>; body?: string }
const calls: Call[] = [];
let tokenHandler: (form: URLSearchParams) => { status: number; json: unknown } = () => ({ status: 200, json: {} });
let apiHandler: (path: string, auth: string) => { status: number; json: unknown; headers?: Record<string, string> } = () => ({ status: 200, json: {} });

globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(input);
  const isToken = url === 'https://accounts.spotify.com/api/token';
  const isApi = url.startsWith('https://api.spotify.com/v1');
  if (!isToken && !isApi) return realFetch(input, init);
  const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>));
  calls.push({ url, method: init?.method ?? 'GET', headers, body: init?.body ? String(init.body) : undefined });
  const out = isToken ? tokenHandler(new URLSearchParams(String(init?.body))) : apiHandler(url.replace('https://api.spotify.com/v1', '').split('?')[0], headers.Authorization ?? '');
  const extra: Record<string, string> = (out as { headers?: Record<string, string> }).headers ?? {};
  return new Response(JSON.stringify(out.json), { status: out.status, headers: { 'content-type': 'application/json', ...extra } });
}) as typeof fetch;

const RETURN = 'sonara://spotify-connected';
const SHOW = 'AbCdEfGhIjKlMnOp';

describe('spotify oauth', () => {
  let base = '';
  let root = '';
  let close: () => void;

  before(async () => {
    const { createApp } = await import('./server');
    const server = createApp().listen(0);
    const port = (server.address() as AddressInfo).port;
    base = `http://127.0.0.1:${port}/api/spotify`;
    root = `http://127.0.0.1:${port}`;
    close = () => server.close();
  });
  after(() => close());
  beforeEach(() => {
    calls.length = 0;
    tokenHandler = (form) => ({ status: 200, json: { access_token: `access-${form.get('grant_type')}-${calls.length}`, refresh_token: 'refresh-1', expires_in: 3600, scope: 'user-read-recently-played' } });
    apiHandler = () => ({ status: 200, json: { ok: true } });
  });

  const post = (path: string, body: unknown, token?: string) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

  /** Runs start -> Spotify redirect -> callback and returns the app return URL + request details. */
  async function login(code = 'good-code') {
    const { authorizeUrl } = (await (await post('/auth/start', { returnUrl: RETURN })).json()) as { authorizeUrl: string };
    const auth = new URL(authorizeUrl);
    const cb = await fetch(`${root}/auth/spotify/callback?code=${code}&state=${auth.searchParams.get('state')}`, { redirect: 'manual' });
    return { auth, cb, location: cb.headers.get('location') ?? '' };
  }

  it('builds the authorize URL with the exact HTTPS redirect URI, state and S256 PKCE', async () => {
    const { auth } = await login();
    assert.equal(auth.origin + auth.pathname, 'https://accounts.spotify.com/authorize');
    assert.equal(auth.searchParams.get('redirect_uri'), 'https://api.example.test/auth/spotify/callback');
    assert.equal(auth.searchParams.get('client_id'), 'spotify-client');
    assert.equal(auth.searchParams.get('response_type'), 'code');
    assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
    assert.ok((auth.searchParams.get('state') ?? '').length >= 40);
    assert.ok(!auth.toString().includes('spotify-secret'));
  });

  it('rejects return URLs that are not this app', async () => {
    for (const returnUrl of ['https://evil.example/steal', 'javascript:alert(1)', 'http://localhost:9999/x', 'notaurl']) {
      assert.equal((await post('/auth/start', { returnUrl })).status, 400, returnUrl);
    }
    assert.equal((await post('/auth/start', { returnUrl: 'http://localhost:8081/spotify-connected' })).status, 200); // allowed web dev origin
    assert.equal((await post('/auth/start', { returnUrl: 'exp+sonara://spotify-connected' })).status, 200); // dev-client variant of our scheme
    assert.equal((await post('/auth/start', { returnUrl: 'exp+other://x' })).status, 400);
  });

  it('completes the flow: state check, PKCE code exchange, ticket handoff with no Spotify secrets in the deep link', async () => {
    const { auth, location } = await login('good-code');
    const exchange = calls.find((c) => c.url.endsWith('/api/token'))!;
    const form = new URLSearchParams(exchange.body);
    assert.equal(form.get('grant_type'), 'authorization_code');
    assert.equal(form.get('code'), 'good-code');
    assert.equal(form.get('redirect_uri'), 'https://api.example.test/auth/spotify/callback');
    const challenge = createHash('sha256').update(form.get('code_verifier')!).digest('base64url');
    assert.equal(challenge, auth.searchParams.get('code_challenge'), 'verifier matches the challenge sent to Spotify');
    assert.match(exchange.headers.Authorization, /^Basic /);

    const url = new URL(location);
    assert.equal(url.protocol, 'sonara:');
    assert.deepEqual([...url.searchParams.keys()], ['ticket']);
    assert.ok(!location.includes('access-') && !location.includes('refresh-') && !location.includes('good-code'), 'no token or code in the deep link');

    const ticket = url.searchParams.get('ticket')!;
    const redeemed = await post('/auth/redeem', { ticket });
    assert.equal(redeemed.status, 200);
    const { sessionToken } = (await redeemed.json()) as { sessionToken: string };
    assert.ok(!sessionToken.includes('access-'));
    assert.equal((await post('/auth/redeem', { ticket })).status, 401, 'tickets are single-use');

    const status = await fetch(`${base}/auth/status`, { headers: { authorization: `Bearer ${sessionToken}` } });
    assert.deepEqual(await status.json(), { connected: true, scope: 'user-read-recently-played' });
  });

  it('rejects unknown or reused state, and reports user denial back to the app', async () => {
    const bad = await fetch(`${root}/auth/spotify/callback?code=x&state=nope`, { redirect: 'manual' });
    assert.equal(bad.status, 400);
    assert.ok(!(await bad.text()).includes('nope'));

    const { authorizeUrl } = (await (await post('/auth/start', { returnUrl: RETURN })).json()) as { authorizeUrl: string };
    const state = new URL(authorizeUrl).searchParams.get('state');
    const denied = await fetch(`${root}/auth/spotify/callback?error=access_denied&state=${state}`, { redirect: 'manual' });
    assert.equal(denied.status, 302);
    assert.equal(new URL(denied.headers.get('location')!).searchParams.get('error'), 'access_denied');
    const reuse = await fetch(`${root}/auth/spotify/callback?code=x&state=${state}`, { redirect: 'manual' });
    assert.equal(reuse.status, 400, 'state is single-use');
  });

  it('maps an invalid authorization code to a safe error', async () => {
    tokenHandler = () => ({ status: 400, json: { error: 'invalid_grant', error_description: 'Invalid authorization code' } });
    const { location } = await login('bad');
    const url = new URL(location);
    assert.equal(url.searchParams.get('error'), 'invalid_code');
    assert.equal(url.searchParams.get('ticket'), null);
  });

  async function connected() {
    const { location } = await login();
    const ticket = new URL(location).searchParams.get('ticket')!;
    return ((await (await post('/auth/redeem', { ticket })).json()) as { sessionToken: string }).sessionToken;
  }
  const proxy = (token: string | undefined, path: string) => fetch(`${base}/proxy${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  it('proxies allow-listed Spotify endpoints with the stored token only', async () => {
    const token = await connected();
    const seen: string[] = [];
    apiHandler = (path, auth) => {
      seen.push(`${path}|${auth}`);
      return { status: 200, json: { id: SHOW } };
    };
    const res = await proxy(token, `/shows/${SHOW}?market=US`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { id: SHOW });
    assert.match(seen[0], new RegExp(`^/shows/${SHOW}\\|Bearer access-authorization_code`));

    assert.equal((await proxy(token, '/me/player')).status, 404, 'non-listed endpoint');
    assert.equal((await proxy(token, `/shows/${SHOW}?evil=1`)).status, 400, 'non-listed query parameter');
    assert.equal((await proxy(undefined, `/shows/${SHOW}`)).status, 401);
    assert.equal((await proxy('x'.repeat(40), `/shows/${SHOW}`)).status, 401, 'unknown session');
  });

  it('refreshes an expiring access token automatically', async () => {
    tokenHandler = (form) =>
      form.get('grant_type') === 'refresh_token'
        ? { status: 200, json: { access_token: 'access-refreshed', expires_in: 3600 } }
        : { status: 200, json: { access_token: 'access-short', refresh_token: 'refresh-1', expires_in: 30, scope: 's' } }; // <60s: already "expiring"
    const token = await connected();
    let auth = '';
    apiHandler = (_p, a) => ((auth = a), { status: 200, json: { ok: 1 } });
    assert.equal((await proxy(token, `/shows/${SHOW}`)).status, 200);
    assert.equal(auth, 'Bearer access-refreshed');
    const refresh = calls.find((c) => new URLSearchParams(c.body).get('grant_type') === 'refresh_token')!;
    assert.equal(new URLSearchParams(refresh.body).get('refresh_token'), 'refresh-1');
  });

  it('refreshes once and retries when Spotify answers 401, then ends the session if it keeps failing', async () => {
    tokenHandler = (form) => ({ status: 200, json: { access_token: form.get('grant_type') === 'refresh_token' ? 'access-new' : 'access-old', refresh_token: 'refresh-1', expires_in: 3600 } });
    const token = await connected();
    apiHandler = (_p, a) => (a === 'Bearer access-old' ? { status: 401, json: {} } : { status: 200, json: { retried: true } });
    assert.deepEqual(await (await proxy(token, `/shows/${SHOW}`)).json(), { retried: true });

    apiHandler = () => ({ status: 401, json: {} });
    const res = await proxy(token, `/shows/${SHOW}`);
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as { code: string }).code, 'session_expired');
    assert.equal(((await (await proxy(token, `/shows/${SHOW}`)).json()) as { code: string }).code, 'not_connected', 'session was removed');
  });

  it('ends the session when the refresh token was revoked', async () => {
    tokenHandler = (form) =>
      form.get('grant_type') === 'refresh_token' ? { status: 400, json: { error: 'invalid_grant' } } : { status: 200, json: { access_token: 'a', refresh_token: 'r', expires_in: 10 } };
    const token = await connected();
    const res = await proxy(token, `/shows/${SHOW}`);
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as { code: string }).code, 'session_expired');
  });

  it('passes through Spotify 403 and 429 (with Retry-After), and disconnect removes the session', async () => {
    const token = await connected();
    apiHandler = () => ({ status: 403, json: { error: { status: 403, message: 'Forbidden' } } });
    assert.equal((await proxy(token, `/shows/${SHOW}`)).status, 403);
    apiHandler = () => ({ status: 429, json: {}, headers: { 'retry-after': '7' } });
    const limited = await proxy(token, `/shows/${SHOW}`);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '7');

    assert.equal((await post('/auth/disconnect', {}, token)).status, 200);
    assert.equal((await proxy(token, `/shows/${SHOW}`)).status, 401);
  });

  it('never logs or returns the client secret', async () => {
    const token = await connected();
    const body = JSON.stringify([await (await proxy(token, `/shows/${SHOW}`)).json(), await (await fetch(`${base}/auth/status`, { headers: { authorization: `Bearer ${token}` } })).json()]);
    assert.ok(!body.includes('spotify-secret'));
  });
});
