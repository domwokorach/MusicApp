import { DarkTheme, Stack, ThemeProvider, usePathname, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';

import { Toast } from '@/components/common/Toast';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { Header } from '@/components/navigation/Header';
import { TrackMenu } from '@/components/music/TrackMenu';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { CHROME_HIDDEN_ROUTES } from '@/constants/routes';
import { colors } from '@/constants/theme';
import { queryClient } from '@/services/queryClient';
import { useStoreHydrated } from '@/services/storageService';
import { useLibraryStore } from '@/store/libraryStore';
import '@/store/playerStore'; // wires the audio service to the player store as soon as the app starts
import { usePlaylistStore } from '@/store/playlistStore';
import { useSpotifyStore } from '@/store/spotifyStore';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.green, text: colors.text, border: colors.border },
};

export default function RootLayout() {
  const libraryReady = useStoreHydrated(useLibraryStore);
  const playlistsReady = useStoreHydrated(usePlaylistStore);
  const ready = libraryReady && playlistsReady;
  const pathname = usePathname();

  useEffect(() => {
    void useSpotifyStore.getState().init();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  // Full-screen modals (player, create, queue) cover the shared chrome.
  const showChrome = !CHROME_HIDDEN_ROUTES.includes(pathname);

  return (
    <QueryClientProvider client={queryClient}>
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {showChrome ? <Header /> : null}
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="player" options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } }} />
            <Stack.Screen name="queue" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="create" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          </Stack>
        </View>
        {showChrome ? <MiniPlayer /> : null}
        {showChrome ? <BottomNavigation /> : null}
      </View>
      <Toast />
      <TrackMenu />
    </ThemeProvider>
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Something went wrong</Text>
      <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{error.message}</Text>
      <Pressable onPress={retry} accessibilityRole="button" style={{ backgroundColor: colors.green, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 }}>
        <Text style={{ fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );
}
