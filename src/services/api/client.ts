import { Platform } from 'react-native';

import { config } from '@/constants/config';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'timeout' | 'http' | 'api' | 'parse',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Explains *what* couldn't be reached: the Sonara backend (with the likely fix) vs. a generic third party. */
function unreachableMessage(url: string): string {
  if (config.apiUrl && url.startsWith(config.apiUrl)) {
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(config.apiUrl);
    const hint =
      Platform.OS === 'android' && local
        ? ' On the Android emulator use http://10.0.2.2:4000; on a physical phone use your computer’s IP or an HTTPS tunnel.'
        : Platform.OS === 'ios' && local
          ? ' localhost only works in the iOS simulator; on a physical iPhone use your computer’s IP or an HTTPS tunnel.'
          : '';
    return `Can’t reach the Sonara backend at ${config.apiUrl}. Make sure it is running (npm run backend).${hint}`;
  }
  return 'Can’t reach the music service. Check your connection.';
}

export type QueryValue = string | number | boolean | undefined | null;

export function buildUrl(base: string, path: string, query: Record<string, QueryValue> = {}): string {
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${base}${path}${params ? `?${params}` : ''}`;
}

interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** GET JSON with a timeout and normalised errors, so UI code only ever handles `ApiError`. */
export async function getJson<T>(url: string, { headers, signal, timeoutMs = config.requestTimeoutMs }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort());

  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted && !signal?.aborted) throw new ApiError('The request timed out. Check your connection.', 'timeout');
    if (signal?.aborted) throw e;
    throw new ApiError(unreachableMessage(url), 'network');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.json().then((b: { error?: unknown }) => (typeof b?.error === 'string' ? b.error : null)).catch(() => null);
    throw new ApiError(res.status === 429 ? 'Too many requests. Please wait a moment.' : detail ?? `The music service returned an error (${res.status}).`, 'http', res.status);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError('Received an unreadable response from the music service.', 'parse');
  }
}
