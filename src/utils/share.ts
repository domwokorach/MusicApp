import { Share } from 'react-native';

import { useUIStore } from '@/store/uiStore';
import type { Track } from '@/types/music';

export async function shareTrack(track: Track) {
  try {
    await Share.share({ message: `Listening to “${track.title}” by ${track.artistName} on Sonara` });
  } catch {
    useUIStore.getState().showToast('Sharing isn’t available right now.');
  }
}
