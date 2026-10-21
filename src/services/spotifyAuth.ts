import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { config } from '@/constants/config';

// Lets the web popup flow hand its result back to the opener (no-op on native).
WebBrowser.maybeCompleteAuthSession();

export type SpotifyAuthErrorCode = 'not_configured' | 'not_connected' | 'cancelled' | 'denied' | 'expired' | 'network';

export class SpotifyAuthError extends Error {
  constructor(message: string, readonly code: SpotifyAuthErrorCode) {
    super(message);
    this.name = 'SpotifyAuthError';
  }
}

/**
 * Spotify sign-in is performed by the Sonara backend (Authorization Code + PKCE, client secret and Spotify
 * tokens stay on the server). The app only:
 *   1. asks the backend for an authorize URL and opens it in the system browser,
 *   2. is returned to `SPOTIFY_RETURN_URL` with a short-lived single-use TICKET (never a token or code),
 *   3. redeems the ticket for an opaque session token, kept in the OS keychain.
 * The only redirect URI Spotify knows is the backend's HTTPS callback, so it cannot mismatch per device/platform.
 */
export const SPOTIFY_RETURN_URL = Linking.createURL('spotify-connected');

const KEY = 'sonara.spotify.session.v2';
const useSecure = Platform.OS !== 'web';

export async function getSessionToken(): Promise<string | null> {
  try {
    return (useSecure ? await SecureStore.getItemAsync(KEY) : await AsyncStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

async function saveSessionToken(token: string | null) {
  try {
    if (token === null) {
      if (useSecure) await SecureStore.deleteItemAsync(KEY);
      else await AsyncStorage.removeItem(KEY);
    } else if (useSecure) await SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    else await AsyncStorage.setItem(KEY, token);
  } catch {
    // best effort
  }
}

export async function hasSpotifySession(): Promise<boolean> {
  return (await getSessionToken()) !== null;
}

/** Forget the local session (used when the backend says it expired). */
export async function clearSpotifySession() {
  await saveSessionToken(null);
}

async function backend<T>(path: string, body: unknown, token?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SpotifyAuthError(`Can’t reach the Sonara backend at ${config.apiUrl}. Make sure it is running.`, 'network');
  } finally {
    clearTimeout(timer);
  }
  const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string } & Record<string, unknown>;
  if (!res.ok) {
    const code: SpotifyAuthErrorCode = json.code === 'not_configured' ? 'not_configured' : res.status === 401 ? 'expired' : 'denied';
    throw new SpotifyAuthError(json.error ?? `Spotify sign-in failed (${res.status}).`, code);
  }
  return json as T;
}

const RETURN_ERRORS: Record<string, string> = {
  access_denied: 'Spotify sign-in was cancelled.',
  invalid_code: 'Spotify rejected the sign-in code. Please try again.',
  exchange_failed: 'Spotify sign-in could not be completed. Please try again.',
  missing_code: 'Spotify did not return a sign-in code. Please try again.',
  spotify_error: 'Spotify reported a problem during sign-in. Please try again.',
};

export async function connectSpotify(): Promise<void> {
  if (!config.apiUrl) throw new SpotifyAuthError('Spotify needs the Sonara backend. Set EXPO_PUBLIC_API_URL.', 'not_configured');

  // 1. Backend creates state + PKCE and returns the Spotify authorize URL.
  const { authorizeUrl } = await backend<{ authorizeUrl: string }>('/api/spotify/auth/start', { returnUrl: SPOTIFY_RETURN_URL });

  // 2. System browser (ASWebAuthenticationSession / Custom Tabs). Resolves when it is sent to SPOTIFY_RETURN_URL.
  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(authorizeUrl, SPOTIFY_RETURN_URL);
  } catch {
    throw new SpotifyAuthError('Couldn’t open the Spotify login page.', 'network');
  }
  if (result.type !== 'success') throw new SpotifyAuthError('Spotify sign-in was cancelled.', 'cancelled');

  // 3. Only a ticket (or an error name) comes back through the deep link.
  const params = Linking.parse(result.url).queryParams ?? {};
  const error = typeof params.error === 'string' ? params.error : null;
  if (error) throw new SpotifyAuthError(RETURN_ERRORS[error] ?? 'Spotify sign-in failed.', error === 'access_denied' ? 'cancelled' : 'denied');
  const ticket = typeof params.ticket === 'string' ? params.ticket : null;
  if (!ticket) throw new SpotifyAuthError('Spotify did not return to the app correctly. Please try again.', 'denied');

  // 4. Redeem the single-use ticket for the opaque session token.
  const { sessionToken } = await backend<{ sessionToken: string }>('/api/spotify/auth/redeem', { ticket });
  await saveSessionToken(sessionToken);
}

export async function disconnectSpotify(): Promise<void> {
  const token = await getSessionToken();
  await saveSessionToken(null);
  if (token) await backend('/api/spotify/auth/disconnect', {}, token).catch(() => undefined); // server copy is dropped best-effort
}
