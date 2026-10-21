import { StyleSheet, View } from 'react-native';

import { EmptyState } from './EmptyState';
import { PrimaryButton } from './primitives';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <EmptyState
        icon="cloud-offline-outline"
        title="Something went wrong"
        message={message}
        action={onRetry ? <PrimaryButton label="Try again" icon="refresh" variant="outline" onPress={onRetry} /> : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { width: '100%' } });
