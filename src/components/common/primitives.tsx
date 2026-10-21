import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, type } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function IconButton({
  name,
  onPress,
  label,
  size = 24,
  color = colors.text,
  style,
  disabled,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.iconButton, style, pressed && { opacity: 0.6 }, disabled && { opacity: 0.35 }]}>
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {children}
      </Text>
      {action}
    </View>
  );
}

export function PrimaryButton({ label, onPress, icon, variant = 'green', disabled }: { label: string; onPress: () => void; icon?: IconName; variant?: 'green' | 'outline' | 'white'; disabled?: boolean }) {
  const bg = variant === 'green' ? colors.green : variant === 'white' ? colors.text : 'transparent';
  const fg = variant === 'outline' ? colors.text : '#000';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: bg },
        variant === 'outline' && { borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        disabled && { opacity: 0.4 },
      ]}>
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.primaryText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: { alignItems: 'center', justifyContent: 'center', minWidth: 40, minHeight: 40 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.green },
  chipText: { ...type.body, color: colors.text },
  chipTextActive: { color: '#000', fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { ...type.title, color: colors.text },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: radii.pill },
  primaryText: { fontSize: 15, fontWeight: '700' },
});
