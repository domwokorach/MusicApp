import { HomeFeed } from '@/components/music/HomeFeed';
import { PodcastsView } from '@/components/podcasts/PodcastsView';
import { isLiveCatalogue } from '@/services/api/musicApi';

/** Live mode: Spotify podcasts (sign-in, search, discovery). Offline demo mode keeps the labelled demo shows. */
export default function PodcastsScreen() {
  return isLiveCatalogue ? <PodcastsView /> : <HomeFeed mode="podcasts" />;
}
