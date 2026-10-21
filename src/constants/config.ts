/**
 * Runtime configuration, read from Expo public env vars (see .env.example).
 * Everything with the EXPO_PUBLIC_ prefix is bundled into the app, so only ever put
 * values here that are safe to be public. Never add API secrets.
 */
const env = process.env;

export const config = {
  appName: 'Sonara',
  /**
   * Base URL of the Sonara backend (see /backend), which proxies Jamendo and holds the credentials.
   * Must be HTTPS in production. Without it the app falls back to the bundled demo catalogue.
   */
  apiUrl: (env.EXPO_PUBLIC_API_URL?.trim() || '').replace(/\/+$/, ''),
  /** Spotify is reached only through the Sonara backend (OAuth with the client secret lives there). */
  /** Spotify caps search `limit` at 10 for apps in Development Mode. */
  spotifyPageSize: 10,
  pageSize: 20,
  requestTimeoutMs: 12000,
} as const;

export const isJamendoEnabled = config.apiUrl.length > 0;

if (isJamendoEnabled && typeof __DEV__ !== 'undefined' && !__DEV__ && !config.apiUrl.startsWith('https://')) {
  console.warn('EXPO_PUBLIC_API_URL should use HTTPS in production builds.');
}
/** Spotify needs the backend (OAuth callback + token storage). */
export const isSpotifyEnabled = isJamendoEnabled;
