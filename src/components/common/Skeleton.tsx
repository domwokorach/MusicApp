import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

/** Pulsing overlay used while artwork or data is loading. Fills its parent. */
export function Shimmer({ radius }: { radius?: number }) {
  const o = useSharedValue(0.25);
  useEffect(() => {
    o.set(withRepeat(withSequence(withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.quad) }), withTiming(0.25, { duration: 700, easing: Easing.inOut(Easing.quad) })), -1));
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#3a3a3a', borderRadius: radius }, style]} />;
}

export function Skeleton({ width, height, radius = 8, style }: { width: DimensionValue; height: DimensionValue; radius?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width, height, borderRadius: radius, backgroundColor: '#242424', overflow: 'hidden' }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Shimmer radius={radius} />
    </View>
  );
}
