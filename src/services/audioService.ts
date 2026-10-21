import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { EngineStatus } from '@/types/player';

type Listener = (status: EngineStatus) => void;

/**
 * Single shared native player. Keeping it at module scope (not in a component) means
 * playback survives screen navigation and the mini-player / full player share one source of truth.
 */
let player: AudioPlayer | null = null;
let listener: Listener | null = null;
let finishHandled = false;
let modeReady: Promise<void> | null = null;

function ensureMode() {
  modeReady ??= setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  }).catch(() => undefined);
  return modeReady;
}

function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 250 });
    player.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish) {
        if (finishHandled) return;
        finishHandled = true;
      }
      listener?.({
        playing: s.playing,
        buffering: s.isBuffering,
        position: s.currentTime,
        duration: Number.isFinite(s.duration) ? s.duration : 0,
        loaded: s.isLoaded,
        error: s.error ?? null,
        finished: s.didJustFinish,
      });
    });
  }
  return player;
}

export function onStatus(cb: Listener) {
  listener = cb;
}

export async function load(url: string, meta: { title: string; artist: string; album?: string; artwork?: string }, autoplay = true) {
  await ensureMode();
  const p = getPlayer();
  finishHandled = false;
  p.replace(url);
  try {
    p.setActiveForLockScreen(true, { title: meta.title, artist: meta.artist, albumTitle: meta.album, artworkUrl: meta.artwork });
  } catch {
    // Lock-screen controls are best-effort (unsupported on some platforms).
  }
  if (autoplay) p.play();
}

export function play() {
  getPlayer().play();
}

export function pause() {
  getPlayer().pause();
}

export async function seek(seconds: number) {
  finishHandled = false;
  await getPlayer().seekTo(Math.max(0, seconds));
}

export function setVolume(v: number) {
  getPlayer().volume = Math.max(0, Math.min(1, v));
}

export function getVolume() {
  return getPlayer().volume;
}
