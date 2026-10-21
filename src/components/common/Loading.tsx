import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, type } from '@/constants/theme';

export function Loading({ label = 'Loading…', inline }: { label?: string; inline?: boolean }) {
  return (
    <View style={[styles.wrap, inline && { paddingVertical: 16 }]} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.green} />
      {inline ? null : <Text style={styles.text}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  text: { ...type.small, color: colors.textSecondary },
});
