import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  /** 'horizontal' sopii grade pyramidiin, 'vertical' volyymiin. */
  orientation?: 'horizontal' | 'vertical';
}

/** Kevyt palkkikaavio (View-pohjainen) — ei ulkoisia riippuvuuksia. */
export function BarChart({ data, orientation = 'horizontal' }: BarChartProps) {
  const theme = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));

  if (orientation === 'vertical') {
    return (
      <View style={styles.vWrap}>
        {data.map((d, i) => (
          <View key={`${d.label}-${i}`} style={styles.vCol}>
            <Text style={[styles.vValue, { color: theme.textSecondary }]} numberOfLines={1}>
              {d.value}
            </Text>
            <View style={styles.vBarArea}>
              <View
                style={[
                  styles.vBar,
                  {
                    height: `${(d.value / max) * 100}%`,
                    backgroundColor: theme.text,
                  },
                ]}
              />
            </View>
            <Text style={[styles.vLabel, { color: theme.textSecondary }]} numberOfLines={1}>
              {d.label}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.hWrap}>
      {data.map((d, i) => (
        <View key={`${d.label}-${i}`} style={styles.hRow}>
          <Text style={[styles.hLabel, { color: theme.text }]}>{d.label}</Text>
          <View style={styles.hTrack}>
            <View
              style={[
                styles.hBar,
                { width: `${(d.value / max) * 100}%`, backgroundColor: theme.text },
              ]}
            />
          </View>
          <Text style={[styles.hValue, { color: theme.textSecondary }]}>{d.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hWrap: { gap: Spacing.two },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hLabel: { width: 48, fontSize: 14, fontWeight: '700' },
  hTrack: { flex: 1, height: 22, borderRadius: 6, overflow: 'hidden' },
  hBar: { height: '100%', borderRadius: 6, minWidth: 3 },
  hValue: { width: 28, fontSize: 13, textAlign: 'right' },

  vWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    height: 180,
  },
  vCol: { flex: 1, alignItems: 'center', height: '100%', gap: 2 },
  vValue: { fontSize: 11, height: 14, textAlign: 'center' },
  vBarArea: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  vBar: { width: '70%', borderRadius: 6, minHeight: 3 },
  vLabel: { fontSize: 10, height: 14, textAlign: 'center' },
});
