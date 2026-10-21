import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { ROUTES } from '@/constants/routes';

import { NavigationItem } from './NavigationItem';

const ITEMS = [
  { key: 'home', label: 'Home', path: ROUTES.home },
  { key: 'search', label: 'Search', path: ROUTES.search },
  { key: 'library', label: 'Your Library', path: ROUTES.library },
  { key: 'premium', label: 'Premium', path: ROUTES.premium },
  { key: 'create', label: 'Create +', path: ROUTES.create },
] as const;

/** Horizontally scrollable top navigation. The active item follows the current route. */
export function Header() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
        <View style={styles.brand} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="musical-notes" size={18} color="#000" />
        </View>
        {ITEMS.map((item) => (
          <NavigationItem
            key={item.key}
            variant="pill"
            label={item.label}
            active={item.key !== 'create' && pathname === item.path}
            onPress={() => {
              if (item.key === 'create') router.push(ROUTES.create);
              else if (pathname !== item.path) router.navigate(item.path);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bg, paddingBottom: 8 },
  row: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  brand: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
});
