import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

// Return URL of the Spotify login (sonara://spotify-connected?ticket=…). The auth session intercepts it on
// iOS/Android and finishes the popup on web; this route only exists so that a stray deep link lands somewhere sensible.
WebBrowser.maybeCompleteAuthSession();

export default function SpotifyConnected() {
  return <Redirect href="/podcasts" />;
}
