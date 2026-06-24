import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface Segment<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string | number> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Korostettu, isompi tyyli (esim. Send/Projecting -tilan vaihto). */
  large?: boolean;
}

/** Yleinen segmenttivalitsin: käytetään tilan, lajin ja asteikon vaihtoon. */
export function SegmentedControl<T extends string | number>({
  segments,
  value,
  onChange,
  large,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      {segments.map((seg) => {
        const selected = seg.value === value;
        return (
          <Pressable
            key={String(seg.value)}
            onPress={() => onChange(seg.value)}
            style={[
              styles.segment,
              large && styles.segmentLarge,
              selected && { backgroundColor: theme.background },
            ]}>
            <Text
              style={[
                large ? styles.labelLarge : styles.label,
                { color: selected ? theme.text : theme.textSecondary },
              ]}>
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLarge: { paddingVertical: Spacing.three },
  label: { fontSize: 14, fontWeight: '600' },
  labelLarge: { fontSize: 17, fontWeight: '700' },
});
