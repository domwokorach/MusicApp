import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radii, type } from '@/constants/theme';
import type { SearchProvider } from '@/hooks/useSearch';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}

/** Search field with icon, clear button and an explicit Search button. */
export function SearchBar({ value, onChangeText, onSubmit, onClear }: Props) {
  const empty = value.trim().length === 0;
  return (
    <View style={styles.row}>
      <View style={styles.box}>
        <Ionicons name="search" size={20} color="#000" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder="What do you want to listen to?"
          placeholderTextColor="#535353"
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search songs, artists, albums and playlists"
        />
        {value.length > 0 ? (
          <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={20} color="#535353" />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={onSubmit}
        disabled={empty}
        accessibilityRole="button"
        accessibilityLabel="Search"
        accessibilityState={{ disabled: empty }}
        style={({ pressed }) => [styles.button, empty && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}>
        <Text style={styles.buttonText}>Search</Text>
      </Pressable>
    </View>
  );
}

const PROVIDERS: { id: SearchProvider; label: string }[] = [
  { id: 'jamendo', label: 'Jamendo' },
  { id: 'spotify', label: 'Spotify' },
];

/** Segmented control choosing which catalogue is searched. */
export function ProviderToggle({ value, onChange }: { value: SearchProvider; onChange: (p: SearchProvider) => void }) {
  return (
    <View style={styles.toggle} accessibilityRole="radiogroup" accessibilityLabel="Search provider">
      {PROVIDERS.map((p) => {
        const active = p.id === value;
        return (
          <Pressable
            key={p.id}
            onPress={() => onChange(p.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`${p.label}${p.id === 'jamendo' ? ', playable music' : ', metadata only'}`}
            style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{p.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4 },
  box: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.text, paddingHorizontal: 14, height: 48, borderRadius: radii.md },
  input: { flex: 1, fontSize: 16, fontWeight: '600', color: '#000', height: 48 },
  button: { height: 48, paddingHorizontal: 16, borderRadius: radii.md, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontWeight: '800', color: '#000', fontSize: 15 },
  toggle: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface, borderRadius: radii.pill, padding: 3 },
  segment: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
  segmentActive: { backgroundColor: colors.surfaceHigh },
  segmentText: { ...type.body, color: colors.textSecondary, fontWeight: '700' },
  segmentTextActive: { color: colors.text },
});
