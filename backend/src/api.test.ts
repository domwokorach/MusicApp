import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

process.env.JAMENDO_CLIENT_ID = 'test-client-id';
process.env.JAMENDO_CLIENT_SECRET = 'test-secret';
process.env.RATE_LIMIT_PER_MINUTE = '1000';

const realFetch = globalThis.fetch;
const upstreamCalls: string[] = [];
let upstream: (url: string) => unknown = () => ({});

// Only intercept calls to Jamendo; let requests to the local test server through.
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(input);
  if (!url.startsWith('https://api.jamendo.com')) return realFetch(input, init);
  upstreamCalls.push(url);
  return new Response(JSON.stringify(upstream(url)), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const ok = (results: unknown[]) => ({ headers: { status: 'success', code: 0, results_count: results.length }, results });

describe('backend', () => {
  let base = '';
  let close: () => void;

  before(async () => {
    const { createApp } = await import('./server');
    const server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    close = () => server.close();
  });
  after(() => close());

  it('maps Jamendo tracks, drops malformed ones, and never leaks credentials', async () => {
    upstream = () =>
      ok([
        { id: '1', name: 'Song', duration: 200, artist_id: '9', artist_name: 'Band', album_id: '5', album_name: 'LP', image: 'http://img', audio: 'http://a.mp3', license_ccurl: 'http://cc', musicinfo: { tags: { genres: ['rock'] } } },
        { nope: true },
      ]);
    const res = await fetch(`${base}/tracks?q=song&tags=rock&limit=2`);
    const body = (await res.json()) as { items: Record<string, unknown>[]; hasMore: boolean };
    assert.equal(res.status, 200);
    assert.equal(body.items.length, 1);
    assert.deepEqual(
      { id: body.items[0].id, title: body.items[0].title, audioUrl: body.items[0].audioUrl, genre: body.items[0].genre, artistName: body.items[0].artistName },
      { id: '1', title: 'Song', audioUrl: 'http://a.mp3', genre: 'rock', artistName: 'Band' },
    );
    const sent = upstreamCalls.at(-1)!;
    assert.match(sent, /client_id=test-client-id/);
    assert.match(sent, /search=song/);
    assert.match(sent, /tags=rock/);
    assert.ok(!sent.includes('test-secret'));
    assert.ok(!JSON.stringify(body).includes('test-secret'));
  });

  it('rejects invalid input with 400', async () => {
    assert.equal((await fetch(`${base}/tracks?limit=500`)).status, 400);
    assert.equal((await fetch(`${base}/tracks?tags=bad%20tag!`)).status, 400);
    assert.equal((await fetch(`${base}/albums/abc`)).status, 400);
  });

  it('maps upstream failures to a safe 502 without upstream text', async () => {
    upstream = () => ({ headers: { status: 'failed', code: 5, error_message: 'bad client_id test-client-id', results_count: 0 }, results: [] });
    const res = await fetch(`${base}/tracks?q=unique-failure`);
    const text = await res.text();
    assert.equal(res.status, 502);
    assert.ok(!text.includes('test-client-id'));
  });

  it('returns album with tracks', async () => {
    upstream = () => ok([{ id: '5', name: 'LP', releasedate: '2023-04-01', artist_id: '9', artist_name: 'Band', image: 'http://cover', tracks: [{ id: '1', name: 'Song', duration: '120', audio: 'http://a.mp3' }] }]);
    const res = await fetch(`${base}/albums/5`);
    const body = (await res.json()) as { album: { year: number }; tracks: { audioUrl: string; albumName: string }[] };
    assert.equal(res.status, 200);
    assert.equal(body.album.year, 2023);
    assert.equal(body.tracks[0].audioUrl, 'http://a.mp3');
    assert.equal(body.tracks[0].albumName, 'LP');
  });

  it('decodes HTML entities in titles', async () => {
    upstream = () => ok([{ id: '7', name: 'Etude &quot;Passion&quot; &amp; more', audio: 'http://a.mp3' }]);
    const body = (await (await fetch(`${base}/tracks?q=entity-test`)).json()) as { items: { title: string }[] };
    assert.equal(body.items[0].title, 'Etude "Passion" & more');
  });

  it('omits order for text queries (order=relevance returns zero hits on Jamendo)', async () => {
    upstream = () => ok([]);
    await fetch(`${base}/tracks?q=order-test&order=relevance`);
    assert.ok(!upstreamCalls.at(-1)!.includes('order='), upstreamCalls.at(-1));
  });

  it('serves playlists and playlist tracks', async () => {
    upstream = () => ok([{ id: '12', name: 'Rock', user_name: 'someone', shareurl: 'http://j/12', tracks: [{ id: '1', name: 'Song', audio: 'http://a.mp3' }] }]);
    const list = (await (await fetch(`${base}/playlists?q=rock-test`)).json()) as { items: { id: string; title: string }[] };
    assert.deepEqual(list.items[0].title, 'Rock');
    const one = (await (await fetch(`${base}/playlists/12`)).json()) as { playlist: { id: string }; tracks: { audioUrl: string }[] };
    assert.equal(one.playlist.id, '12');
    assert.equal(one.tracks[0].audioUrl, 'http://a.mp3');
  });

  it('retries empty results (Jamendo list endpoints are flaky)', async () => {
    let calls = 0;
    upstream = () => (++calls < 3 ? ok([]) : ok([{ id: '1', name: 'Found', audio: 'http://a.mp3' }]));
    const body = (await (await fetch(`${base}/tracks?q=flaky-test`)).json()) as { items: { title: string }[] };
    assert.equal(calls, 3);
    assert.equal(body.items[0].title, 'Found');
  });

  it('builds mixes with distinct, real artwork and sends featured=1', async () => {
    upstream = () =>
      ok([
        { id: '1', name: 'A', image: 'https://img/1', audio: 'http://a1' },
        { id: '2', name: 'B', image: 'https://img/1', audio: 'http://a2' }, // same cover: skipped
        { id: '3', name: 'C', image: 'https://img/3', audio: 'http://a3' },
        { id: '4', name: 'D', image: 'https://img/4' }, // no audio: skipped
      ]);
    const res = await fetch(`${base}/mixes?tags=rock,pop&perTag=2`);
    const body = (await res.json()) as { items: { id: string; coverUrl?: string; tracks: { artworkUrl: string }[] }[] };
    assert.equal(res.status, 200);
    assert.deepEqual(body.items.map((m) => m.id), ['rock', 'pop']);
    assert.deepEqual(body.items[0].tracks.map((t) => t.artworkUrl), ['https://img/1', 'https://img/3']);
    assert.notEqual(body.items[0].coverUrl, body.items[1].coverUrl, 'each genre gets a different cover when possible');
    assert.ok(upstreamCalls.some((u) => u.includes('featured=1') && u.includes('tags=rock')));
  });

  it('rejects bad mix tags', async () => {
    assert.equal((await fetch(`${base}/mixes?tags=ro%20ck`)).status, 400);
    assert.equal((await fetch(`${base}/mixes`)).status, 400);
  });

  it('fills a missing artist picture from that artist\'s own top track', async () => {
    upstream = (url) =>
      url.includes('/artists/')
        ? ok([{ id: '9', name: 'Solo', image: '' }])
        : ok([{ id: '55', name: 'Hit', artist_id: '9', image: 'https://img/hit', audio: 'http://a' }]);
    const body = (await (await fetch(`${base}/artists?q=fallback-test`)).json()) as { items: { imageUrl?: string }[] };
    assert.equal(body.items[0].imageUrl, 'https://img/hit');
    assert.ok(upstreamCalls.some((u) => u.includes('/tracks/') && u.includes('artist_id=9')));
  });
});
