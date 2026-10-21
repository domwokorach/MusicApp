import { usePlaylistStore } from '@/store/playlistStore';
import { useUIStore } from '@/store/uiStore';
import type { Track } from '@/types/music';
import type { PlaylistInput } from '@/types/playlist';
import { confirmDestructive } from '@/utils/confirm';

/** Playlist operations with user feedback (toasts / confirmation) kept out of the components. */
export function usePlaylistActions() {
  const toast = useUIStore.getState().showToast;
  const store = usePlaylistStore.getState();

  return {
    create(input: PlaylistInput) {
      const id = store.createPlaylist(input);
      toast('Playlist created');
      return id;
    },
    update(id: string, patch: Partial<PlaylistInput>) {
      store.updatePlaylist(id, patch);
      toast('Playlist updated');
    },
    remove(id: string, name: string, onDeleted?: () => void) {
      confirmDestructive(`Delete “${name}”?`, 'This playlist will be removed from your library.', 'Delete', () => {
        store.deletePlaylist(id);
        toast('Playlist deleted');
        onDeleted?.();
      });
    },
    addTrack(id: string, name: string, track: Track) {
      const result = store.addTrack(id, track);
      toast(result === 'added' ? `Added to ${name}` : result === 'duplicate' ? `Already in ${name}` : 'Playlist not found');
    },
    removeTrack(id: string, trackId: string) {
      store.removeTrack(id, trackId);
      toast('Removed from playlist');
    },
  };
}

export function usePlaylists() {
  return usePlaylistStore((s) => s.playlists);
}

export function useUserPlaylist(id: string | undefined) {
  return usePlaylistStore((s) => (id ? s.playlists.find((p) => p.id === id) : undefined));
}
