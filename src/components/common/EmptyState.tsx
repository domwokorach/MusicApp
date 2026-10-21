import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, type } from '@/constants/theme';

export function EmptyState({ icon, title, message, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; message: string; action?: ReactNode }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={44} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 8 },
  title: { ...type.heading, color: colors.text, textAlign: 'center', marginTop: 8 },
  message: { ...type.body, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
});
