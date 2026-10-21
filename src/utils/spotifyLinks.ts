import { Linking, Platform } from 'react-native';

import { useUIStore } from '@/store/uiStore';

const SPOTIFY_URL = /open\.spotify\.com\/(?:intl-[a-z]+\/)?(episode|show|track|album|artist|playlist)\/([A-Za-z0-9]+)/;

/**
 * Opens a Spotify item in the Spotify app when installed (spotify:episode:ID), otherwise on open.spotify.com.
 * Always tells the user if there is nothing to open or nothing could be opened.
 */
export async function openInSpotify(url?: string): Promise<boolean> {
  const toast = useUIStore.getState().showToast;
  if (!url || !/^https:\/\//.test(url)) {
    toast('No Spotify link is available for this item.');
    return false;
  }
  const match = SPOTIFY_URL.exec(url);
  // The app URI is tried first on devices; the https link then works as app link or web fallback.
  const targets = match && Platform.OS !== 'web' ? [`spotify:${match[1]}:${match[2]}`, url] : [url];
  for (const target of targets) {
    try {
      await Linking.openURL(target);
      return true;
    } catch {
      // try the next target
    }
  }
  toast('Couldn’t open Spotify.');
  return false;
}
