import { Ionicons } from '@expo/vector-icons';
import { router, usePathname, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { ROUTES } from '@/constants/routes';

import { NavigationItem } from './NavigationItem';

type IconName = keyof typeof Ionicons.glyphMap;

const ITEMS: { key: string; label: string; path: Href & string; icon: IconName; iconActive: IconName; hint: string }[] = [
  { key: 'all', label: 'All', path: ROUTES.home, icon: 'grid-outline', iconActive: 'grid', hint: 'Show the full home feed' },
  { key: 'music', label: 'Music', path: ROUTES.music, icon: 'musical-notes-outline', iconActive: 'musical-notes', hint: 'Show music only' },
  { key: 'podcasts', label: 'Podcasts', path: ROUTES.podcasts, icon: 'mic-outline', iconActive: 'mic', hint: 'Show podcasts only' },
  { key: 'search', label: 'Search', path: ROUTES.search, icon: 'search-outline', iconActive: 'search', hint: 'Search the catalogue' },
];

export function BottomNavigation() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {ITEMS.map((item) => (
        <NavigationItem
          key={item.key}
          variant="tab"
          label={item.label}
          icon={item.icon}
          iconActive={item.iconActive}
          accessibilityLabel={`${item.label}. ${item.hint}`}
          active={pathname === item.path}
          onPress={() => pathname !== item.path && router.navigate(item.path)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: '#0B0B0B', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 8 },
});
