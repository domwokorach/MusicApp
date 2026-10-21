import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, type } from '@/constants/theme';
import { useUIStore } from '@/store/uiStore';

export function Toast() {
  const toast = useUIStore((s) => s.toast);
  const hide = useUIStore((s) => s.hideToast);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hide, 2600);
    return () => clearTimeout(t);
  }, [toast, hide]);

  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 140 }]}>
      <Animated.View key={toast.id} entering={FadeInDown.duration(180)} exiting={FadeOut.duration(150)} style={styles.toast} accessibilityLiveRegion="polite">
        <Text style={styles.text}>{toast.message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { backgroundColor: colors.text, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radii.pill, maxWidth: 420 },
  text: { ...type.body, color: '#000', fontWeight: '600', textAlign: 'center' },
});
