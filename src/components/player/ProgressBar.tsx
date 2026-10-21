import { useEffect, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

interface SliderProps {
  value: number;
  max: number;
  onSeek: (value: number) => void;
  onDrag?: (value: number | null) => void;
  trackColor?: string;
  fillColor?: string;
  label: string;
  /** Spoken value for screen readers, e.g. "1:23 of 3:45". */
  valueText?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Touch slider with tap-to-seek and drag. Reports the live drag value through `onDrag` and commits on release. */
export function ProgressBar({ value, max, onSeek, onDrag, trackColor = 'rgba(255,255,255,0.28)', fillColor = colors.text, label, valueText }: SliderProps) {
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  // Mutable bag read by the (create-once) PanResponder callbacks; refreshed after every render.
  const [live] = useState(() => ({ width: 0, max, onSeek, onDrag, startRatio: 0 }));

  useEffect(() => {
    Object.assign(live, { width, max, onSeek, onDrag });
  });

  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { width: w, max: m, onDrag: cb } = live;
        live.startRatio = w > 0 ? clamp(e.nativeEvent.locationX / w, 0, 1) : 0;
        const v = live.startRatio * m;
        setDrag(v);
        cb?.(v);
      },
      onPanResponderMove: (_, g) => {
        const { width: w, max: m, onDrag: cb } = live;
        if (w <= 0) return;
        const v = clamp(live.startRatio + g.dx / w, 0, 1) * m;
        setDrag(v);
        cb?.(v);
      },
      onPanResponderRelease: (_, g) => {
        const { width: w, max: m, onSeek: commit, onDrag: cb } = live;
        const v = w > 0 ? clamp(live.startRatio + g.dx / w, 0, 1) * m : 0;
        setDrag(null);
        cb?.(null);
        commit(v);
      },
      onPanResponderTerminate: () => {
        setDrag(null);
        live.onDrag?.(null);
      },
    }),
  );

  const shown = drag ?? value;
  const ratio = max > 0 ? clamp(shown / max, 0, 1) : 0;
  const active = drag !== null;

  return (
    <View
      {...responder.panHandlers}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.hit}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: Math.round(max), now: Math.round(shown), text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const step = Math.max(5, max * 0.05);
        onSeek(clamp(value + (e.nativeEvent.actionName === 'increment' ? step : -step), 0, max));
      }}>
      <View style={[styles.track, { backgroundColor: trackColor }]} pointerEvents="none">
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: active ? colors.green : fillColor }]} />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            left: ratio * width - (active ? 8 : 6),
            top: active ? 8 : 10,
            width: active ? 16 : 12,
            height: active ? 16 : 12,
            borderRadius: 8,
            backgroundColor: fillColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 32, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  thumb: { position: 'absolute' },
});
