import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

// A tiny in-process stand-in for Upstash's REST API: POST / with a Redis command as a JSON array.
const store = new Map<string, string>();
const commands: string[] = [];
const fake = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const [cmd, key, value] = JSON.parse(body) as [string, string, string?];
    commands.push(cmd);
    let result: unknown = 'OK';
    if (cmd === 'SET') store.set(key, String(value));
    else if (cmd === 'GET') result = store.get(key) ?? null;
    else if (cmd === 'GETDEL') {
      result = store.get(key) ?? null;
      store.delete(key);
    } else if (cmd === 'DEL') result = store.delete(key) ? 1 : 0;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ result }));
  });
});
process.env.JAMENDO_CLIENT_ID = 'test';
process.env.SPOTIFY_CLIENT_ID = 'spotify-client';
process.env.SPOTIFY_CLIENT_SECRET = 'spotify-secret';
process.env.PUBLIC_BASE_URL = 'https://api.example.test';
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '1000';
process.env.KV_REST_API_TOKEN = 'fake-token';
process.env.TOKEN_ENCRYPTION_KEY = 'a-long-random-encryption-key-for-tests';

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(input);
  if (url === 'https://accounts.spotify.com/api/token') {
    return new Response(JSON.stringify({ access_token: 'PLAINTEXT-ACCESS-TOKEN', refresh_token: 'PLAINTEXT-REFRESH-TOKEN', expires_in: 3600, scope: 's' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.startsWith('https://api.spotify.com/v1')) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  return realFetch(input, init);
}) as typeof fetch;

describe('serverless session store (Redis)', () => {
  let base = '';
  let close: () => void;
  before(async () => {
    await new Promise<void>((r) => fake.listen(0, r));
    process.env.KV_REST_API_URL = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`; // read when ./server (and its config) is first imported
    const { default: app } = await import('./server'); // the default export is what Vercel runs
    const server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/spotify`;
    close = () => server.close();
  });
  after(() => {
    close();
    fake.close();
  });

  it('exports an Express app as the default export', async () => {
    const { default: app } = await import('./server');
    assert.equal(typeof app, 'function');
    assert.equal(typeof (app as unknown as { handle: unknown }).handle, 'function');
  });

  it('runs the whole login with state, ticket and session held only in Redis, with tokens encrypted at rest', async () => {
    const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const { authorizeUrl } = (await (await post('/auth/start', { returnUrl: 'sonara://spotify-connected' })).json()) as { authorizeUrl: string };
    const state = new URL(authorizeUrl).searchParams.get('state')!;
    assert.ok(store.has(`sp:state:${state}`), 'state was written to the shared store');

    const cb = await fetch(`${base.replace('/api/spotify', '')}/auth/spotify/callback?code=c&state=${state}`, { redirect: 'manual' });
    assert.equal(cb.status, 302);
    assert.ok(!store.has(`sp:state:${state}`), 'state consumed (single-use)');
    const ticket = new URL(cb.headers.get('location')!).searchParams.get('ticket')!;

    const { sessionToken } = (await (await post('/auth/redeem', { ticket })).json()) as { sessionToken: string };
    assert.equal((await post('/auth/redeem', { ticket })).status, 401, 'ticket is single-use');

    const stored = [...store.entries()].filter(([k]) => k.startsWith('sp:session:'));
    assert.equal(stored.length, 1);
    assert.ok(!stored[0][1].includes('PLAINTEXT'), 'tokens are encrypted before reaching Redis');
    assert.ok(commands.includes('GETDEL'), 'single-use values are read atomically');

    const status = await fetch(`${base}/auth/status`, { headers: { authorization: `Bearer ${sessionToken}` } });
    assert.equal(status.status, 200);
    const proxied = await fetch(`${base}/proxy/shows/AbCdEfGhIjKlMnOp`, { headers: { authorization: `Bearer ${sessionToken}` } });
    assert.equal(proxied.status, 200);

    await fetch(`${base}/auth/disconnect`, { method: 'POST', headers: { authorization: `Bearer ${sessionToken}` } });
    assert.equal([...store.keys()].some((k) => k.startsWith('sp:session:')), false, 'disconnect deletes the stored session');
  });
});
