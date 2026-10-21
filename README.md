# Sonara — Spotify-inspired music app (Expo + React Native + TypeScript)

Expo SDK 58, Expo Router, Zustand, `expo-audio`, Reanimated, AsyncStorage. All branding and placeholder content is original.

## Run

```bash
npm install
cp .env.example .env     # optional, see below
npx expo start           # i = iOS, a = Android
```

Background audio and lock-screen controls need a development build (`npx expo run:ios` / `run:android`); Expo Go plays audio in the foreground.

Checks: `npm run typecheck` and `npx expo lint`.

## Music sources

Search has a **Jamendo / Spotify** switch. The catalogues are kept separate: every result carries its own `source` and prefixed provider id (`jm_…`, `jp_…` playlists, `sp_…`).

| Provider | What you get |
| --- | --- |
| **Jamendo** (via the backend) | Songs, artists, albums, playlists, genres, **full-length Creative Commons streaming**, artwork. Playable. Without `EXPO_PUBLIC_API_URL` the app shows a labelled offline demo catalogue instead. |
| **Spotify** (server-side OAuth, PKCE) | Tracks, artists, albums and playlists as **metadata + artwork only**. Spotify tracks are never played and never replaced by another catalogue. |

### Spotify setup (podcasts, recently played, Spotify search)

Spotify sign-in runs on the **backend**: Authorization Code with PKCE, the client secret and the Spotify tokens never reach the phone.

```
app ──POST /api/spotify/auth/start──▶ backend (creates state + PKCE, returns the Spotify authorize URL)
app ──opens system browser──────────▶ Spotify login
Spotify ──302──▶ https://YOUR_BACKEND/auth/spotify/callback?code&state   ← the ONE registered redirect URI
backend: validates state, exchanges the code (secret + code_verifier), stores tokens server-side
backend ──302──▶ sonara://spotify-connected?ticket=…   (60 s, single-use ticket; no token, no code)
app ──POST /api/spotify/auth/redeem {ticket}──▶ opaque session token (kept in the device keychain)
app ──GET /api/spotify/proxy/…  (Bearer session token)──▶ backend adds/refreshes the Spotify token, forwards read-only calls
```

**Why `redirect_uri: Not matching configuration` happened:** the app used to build its own redirect URI at runtime (`sonara://spotify-auth`, `exp://…` in Expo Go, an http URL on web), which can never equal the single value registered in the Spotify dashboard. Now Spotify only ever sees the backend's fixed HTTPS callback.

1. **Deploy the backend over HTTPS** (a `backend/Dockerfile` and a Render blueprint `render.yaml` are included) or, for local testing, run an HTTPS tunnel: `cloudflared tunnel --url http://localhost:4000` (or `ngrok http 4000`). Quick tunnels get a new URL every run, so use a named tunnel or a deployed domain for anything lasting.
2. In `backend/.env` set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `PUBLIC_BASE_URL=https://YOUR_BACKEND_DOMAIN` (no trailing slash). Restart the backend.
3. In the [Spotify dashboard](https://developer.spotify.com/dashboard) → your app → Settings → **Redirect URIs**, add exactly `https://YOUR_BACKEND_DOMAIN/auth/spotify/callback` (same scheme, host, path, capitalisation, no trailing slash) and save. Nothing else is needed: no `sonara://` or `exp://` URL goes in the dashboard.
4. Point the app at the same backend: `EXPO_PUBLIC_API_URL=https://YOUR_BACKEND_DOMAIN` (a physical phone cannot reach `localhost`), then `npx expo start --clear` with a **development build** (`npx expo run:ios` / `run:android`). Expo Go is not supported for the return link.
5. Podcasts tab → **Connect Spotify**.

The app's return link is `sonara://spotify-connected` (scheme set in `app.json`; Expo registers it for iOS and Android). The backend only returns users to schemes listed in `APP_SCHEMES` (and the web dev origins in `CORS_ORIGINS`), so a crafted link cannot send a ticket elsewhere.

**Development Mode limits (2026):** the app owner needs an active Spotify **Premium** plan (otherwise calls return 403), only 5 allow-listed users can sign in (add them under *User Management*), and search returns at most 10 items per page.

**Podcasts:** Spotify provides show/episode metadata and links only. Episodes open in the Spotify app (`spotify:episode:…`) with an `open.spotify.com` fallback; nothing is streamed in-app. Tokens refresh automatically on the server; *Disconnect* on the Podcasts screen deletes the server-side session and the keychain entry.

**Verify on device:** (iOS) Connect → Spotify login page opens in the in-app browser → approve → app returns to Podcasts showing "Spotify connected" and real covers; kill and reopen the app and you are still connected; tap an episode → Spotify opens. (Android) the same, using a physical device or an emulator with the Play Store build of Spotify. If you see "Sign-in link invalid or expired" start again; if you see `INVALID_CLIENT: Invalid redirect URI`, the dashboard string differs from `PUBLIC_BASE_URL + /auth/spotify/callback`.

### Home data & artwork

- Home sections load independently through **TanStack Query** (5-minute cache, request de-duplication, no automatic retry on 401/403/429). Pull to refresh refetches everything; returning to the screen refetches only sections older than 5 minutes.
- **Music by genre**, **Featured playlists** and the **Rock / Pop / Hip-Hop / Electronic / Jazz Mix** shelves come from one backend call (`/api/mixes`, `tags=<genre>&featured=1`, topped up with the week's popular tracks). Each mix shows real, distinct track covers; genre tiles use a cover from a track of that genre. Jamendo's "featured playlists" are therefore **app-curated mixes** and are labelled as such.
- Jamendo artists without a profile picture use the cover of their own most popular track. If none exists the neutral placeholder is shown.
- **Podcasts** come only from Spotify (your saved shows, or suggested shows) as metadata and links; episodes open in Spotify. The offline demo catalogue's podcasts are shown only when no backend is configured. Jamendo artwork is never used for podcasts.
- **Recently played** is recorded locally (provider, id, title, artist, artwork, timestamp, stream reference) and persisted. If a stored Jamendo stream URL has expired the player fetches a fresh one once. With Spotify connected, "Recently played on Spotify" uses `/me/player/recently-played` (scope `user-read-recently-played`).
- Spotify endpoints are probed lazily: a 403/404 marks that endpoint unavailable for the session instead of being retried. Browse "featured playlists" and category endpoints are not used (deprecated). Reconnect Spotify after upgrading so the new scopes (`user-read-recently-played`, `user-library-read`) are granted.
- All artwork goes through `Artwork`: URLs are validated and forced to https, Jamendo images are requested at the displayed size, `expo-image` caches to memory and disk, a shimmer shows while loading, broken or missing images fall back to a neutral placeholder, and each failing URL is logged once (`[artwork] failed to load …`).

### Jamendo backend (credentials stay on the server)

```bash
cd backend
cp .env.example .env        # set JAMENDO_CLIENT_ID (and JAMENDO_CLIENT_SECRET)
npm install
npm run dev                 # http://localhost:4000   (npm test, npm run build && npm start for production)
curl "http://localhost:4000/api/tracks?q=piano&limit=3"
```

Then in the app root: `cp .env.example .env`, set `EXPO_PUBLIC_API_URL`, and run `npx expo start -c`.

- The mobile app never sees the Jamendo client id or secret; it only knows the backend URL. Catalogue endpoints need just the `client_id`; the secret is loaded for future OAuth-only operations and is never used, returned or logged.
- The backend validates query params (zod), validates/normalises Jamendo responses, caches for 60 s, rate-limits per IP (default 120/min), sets security headers via helmet and restricts CORS. Deploy it behind HTTPS.
- Jamendo's list endpoints intermittently answer with zero results for identical requests; the backend retries empty answers (up to 4×) and never caches them.
- Endpoints: `GET /api/tracks` (`q, tags, order, artistId, albumId, id, limit, offset`), `/api/albums`, `/api/albums/:id`, `/api/artists`, `/api/artists/:id`, `/api/playlists`, `/api/playlists/:id`, `/api/genres`, `/api/health`.
- Android blocks cleartext HTTP to real hosts and iOS enforces ATS, so use an HTTPS URL on physical devices.

### Licensing

Jamendo tracks are Creative Commons: show the artist and a link to the licence. The player's **Credits** card shows "title by artist, via Jamendo" with links to the track and its licence. Commercial use of the music, and downloads, require separate permission from Jamendo/the artists; this app streams only and offers no downloads. Tracks without a stream URL are listed as unavailable and never played.

> Verified: backend unit tests with a mocked Jamendo, and the app client against the running backend with a fake Jamendo. Not yet verified against the live Jamendo service (no credentials were available in development).

## Structure

```
backend/            Express + TypeScript Jamendo proxy (src/server.ts, routes/musicRoutes.ts, services/jamendoService.ts)
src/app/            index (All) · music · podcasts · search · library · premium · create · player · queue
                    playlist/[id] · album/[id] · artist/[id] · podcast/[id]
src/components/     navigation/ music/ player/ search/ common/
src/services/       api/{client,musicApi,jamendoApi,spotifyApi,mockApi}.ts · audioService.ts · storageService.ts
src/store/          playerStore · musicStore · libraryStore · playlistStore · uiStore
src/hooks/          useMusic · usePlayer · useSearch · usePlaylist
src/types/ src/constants/ src/data/ src/utils/
```

Header, mini-player and bottom navigation live in `src/app/_layout.tsx` and are hidden on the full-screen player, queue and create screens. Playback is owned by `audioService.ts` (one native player), so the mini-player and full player always share state.

## Notes

- Premium is UI only; no payments are processed.
- The audio-output sheet sets volume; Bluetooth/AirPlay routing is controlled by the OS.
- Library data (likes, albums, artists, history) and playlists persist in AsyncStorage (`sonara-library-v2`, `sonara-playlists-v2`).
- Player gradient colours are derived from a hash of the track id, not extracted from the artwork.
# MusicApp
