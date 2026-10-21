import { router } from 'expo-router';

import { ROUTES } from '@/constants/routes';
import type { CollectionKind } from '@/types/music';

export function openCollection(kind: CollectionKind, id: string) {
  switch (kind) {
    case 'album':
      return router.push({ pathname: '/album/[id]', params: { id } });
    case 'artist':
      return router.push({ pathname: '/artist/[id]', params: { id } });
    case 'podcast':
      return router.push({ pathname: '/podcast/[id]', params: { id } });
    case 'liked':
      return router.push({ pathname: '/playlist/[id]', params: { id: 'liked' } });
    case 'playlist':
      return router.push({ pathname: '/playlist/[id]', params: { id } });
  }
}

export function openPlayer() {
  router.push(ROUTES.player);
}

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace(ROUTES.home);
}
