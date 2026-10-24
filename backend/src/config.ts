import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('YOUR_')) {
    throw new Error(`Missing ${name}. Copy backend/.env.example to backend/.env and fill it in.`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jamendoClientId: required('JAMENDO_CLIENT_ID'),
  /** Optional: no read-only catalogue endpoint needs it. Never returned to clients or logged. */
  jamendoClientSecret: process.env.JAMENDO_CLIENT_SECRET?.trim() || undefined,
  /**
   * Public HTTPS origin of THIS server, e.g. https://api.example.com. The Spotify redirect URI is
   * `${publicBaseUrl}/auth/spotify/callback` and must be registered, character for character, in the Spotify dashboard.
   */
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, ''),
  spotifyClientId: (process.env.SPOTIFY_CLIENT_ID ?? process.env.SPOTIFY_CLIENTID)?.trim() || undefined,
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET?.trim() || undefined,
  spotifyScopes: 'user-read-recently-played user-library-read',
  /** URL schemes the app may be returned to after login (comma separated). */
  appSchemes: (process.env.APP_SCHEMES ?? 'sonara').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  /**
   * Shared Redis (Upstash REST) for OAuth state, login tickets and Spotify sessions. REQUIRED on serverless hosts
   * such as Vercel, where consecutive requests can run on different instances. Without it an in-memory store is used
   * (fine for a single long-running server and for local development).
   */
  kvRestUrl: (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)?.trim() || undefined,
  kvRestToken: (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)?.trim() || undefined,
  /** Secret used to encrypt Spotify tokens (AES-256-GCM) before they are written to the shared store. */
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY?.trim() || undefined,
  spotifyAccountsUrl: process.env.SPOTIFY_ACCOUNTS_URL ?? 'https://accounts.spotify.com',
  spotifyApiUrl: process.env.SPOTIFY_API_URL ?? 'https://api.spotify.com/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  authRateLimitPerMinute: Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE ?? 30),
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120),
  // Overridable only so tests can point at a local fake; defaults to the real API.
  jamendoBaseUrl: process.env.JAMENDO_BASE_URL ?? 'https://api.jamendo.com/v3.0',
  upstreamTimeoutMs: 10_000,
  cacheTtlMs: 60_000,
} as const;
