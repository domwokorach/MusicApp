export type RepeatMode = 'off' | 'all' | 'one';

export interface EngineStatus {
  playing: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  loaded: boolean;
  error: string | null;
  finished: boolean;
}
