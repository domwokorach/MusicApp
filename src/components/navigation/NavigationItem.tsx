import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, type } from '@/constants/theme';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  /** 'pill' = header chip, 'tab' = footer icon + label. */
  variant: 'pill' | 'tab';
  icon?: keyof typeof Ionicons.glyphMap;
  iconActive?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
}

export function NavigationItem({ label, active, onPress, variant, icon, iconActive, accessibilityLabel }: Props) {
  if (variant === 'pill') {
    return (
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={accessibilityLabel ?? label}
        onPress={onPress}
        style={({ pressed }) => [styles.pill, active && styles.pillActive, pressed && { opacity: 0.7 }]}>
        <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.6 }]}>
      {icon ? <Ionicons name={active ? (iconActive ?? icon) : icon} size={24} color={active ? colors.green : colors.textSecondary} /> : null}
      <Text style={[styles.tabText, active && { color: colors.green }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 16, height: 36, justifyContent: 'center', borderRadius: radii.pill, backgroundColor: colors.surface },
  pillActive: { backgroundColor: colors.green },
  pillText: { ...type.body, color: colors.text, fontWeight: '600' },
  pillTextActive: { color: '#000', fontWeight: '700' },
  tab: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48, justifyContent: 'center' },
  tabText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
});
