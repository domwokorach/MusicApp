import { QueryClient } from '@tanstack/react-query';

import { SpotifyAuthError } from './spotifyAuth';
import { ApiError } from './api/client';

/** Home data is considered fresh for 5 minutes: revisits reuse the cache, older data refreshes on focus. */
export const STALE_MS = 5 * 60_000;

/**
 * Retry only transient failures (network / timeout, max 2 retries with backoff). 401/403 (auth, Development
 * Mode, missing scope) and 429 (rate limit) are never retried automatically: retrying would only make the
 * rate limit worse or repeat a request that cannot succeed.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof SpotifyAuthError) return false;
  return error instanceof ApiError && (error.kind === 'network' || error.kind === 'timeout' || (error.kind === 'http' && (error.status ?? 0) >= 500));
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_MS,
      gcTime: 30 * 60_000,
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      refetchOnWindowFocus: false, // screen focus is handled explicitly via useRefreshOnFocus
      refetchOnReconnect: true,
    },
  },
});
