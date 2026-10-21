/** Central list of app routes so navigation targets are never typed as loose strings. */
export const ROUTES = {
  home: '/',
  music: '/music',
  podcasts: '/podcasts',
  search: '/search',
  library: '/library',
  premium: '/premium',
  create: '/create',
  player: '/player',
  queue: '/queue',
} as const;

/** Routes where the shared header / mini-player / bottom navigation are hidden (full-screen modals). */
export const CHROME_HIDDEN_ROUTES: readonly string[] = [ROUTES.player, ROUTES.create, ROUTES.queue];
