import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { createJSONStorage, type PersistOptions } from 'zustand/middleware';

/** Thin AsyncStorage wrapper. Storage can fail (quota, private mode) so every call is guarded. */
export const storageService = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Persistence is best-effort; in-memory state remains correct.
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async setJson(key: string, value: unknown): Promise<void> {
    await this.setItem(key, JSON.stringify(value));
  },
};

/** zustand `persist` storage backed by `storageService`. */
export const zustandStorage = createJSONStorage<unknown>(() => storageService) as PersistOptions<unknown>['storage'];

interface Hydratable {
  persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };
}

/** True once a persisted zustand store has finished reading from AsyncStorage. */
export function useStoreHydrated(store: Hydratable): boolean {
  return useSyncExternalStore(
    (onChange) => store.persist.onFinishHydration(onChange),
    () => store.persist.hasHydrated(),
    () => false,
  );
}
