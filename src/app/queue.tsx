import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/common/primitives';
import { QueueList } from '@/components/player/QueueList';
import { colors, type } from '@/constants/theme';
import { goBack } from '@/utils/nav';

export default function QueueScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 4 }]}>
      <View style={styles.header}>
        <IconButton name="chevron-down" size={28} label="Close queue" onPress={goBack} />
        <Text style={styles.title} accessibilityRole="header">
          Queue
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <QueueList bottomInset={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 48 },
  title: { ...type.heading, color: colors.text },
});
