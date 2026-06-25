import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { GradeComparisonRow } from '@/domain/aggregate';
import { useTheme } from '@/hooks/use-theme';

interface ComparisonBarChartProps {
  rows: GradeComparisonRow[];
  /** Vertailtavien jaksojen otsikot (A = vasen/vanha, B = oikea/uusi). */
  labelA: string;
  labelB: string;
}

/**
 * Kevyt vertailupalkkikaavio (View-pohjainen): kullekin asteelle kaksi palkkia
 * (A vs B) ja erotus (delta). Teemaa kunnioittava, ei ulkoisia riippuvuuksia.
 */
export function ComparisonBarChart({ rows, labelA, labelB }: ComparisonBarChartProps) {
  const theme = useTheme();
  const max = Math.max(1, ...rows.map((r) => Math.max(r.a, r.b)));

  return (
    <View style={styles.wrap}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: theme.textSecondary }]} />
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>{labelA}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: theme.text }]} />
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>{labelB}</Text>
        </View>
      </View>

      {rows.map((r) => (
        <View key={r.grade} style={styles.row}>
          <Text style={[styles.gradeLabel, { color: theme.text }]}>{r.grade}</Text>
          <View style={styles.bars}>
            <View style={styles.barLine}>
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    { width: `${(r.a / max) * 100}%`, backgroundColor: theme.textSecondary },
                  ]}
                />
              </View>
              <Text style={[styles.value, { color: theme.textSecondary }]}>{r.a}</Text>
            </View>
            <View style={styles.barLine}>
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    { width: `${(r.b / max) * 100}%`, backgroundColor: theme.text },
                  ]}
                />
              </View>
              <Text style={[styles.value, { color: theme.textSecondary }]}>{r.b}</Text>
            </View>
          </View>
          <Text
            style={[
              styles.delta,
              { color: r.delta > 0 ? '#2e9e5b' : r.delta < 0 ? '#d1495b' : theme.textSecondary },
            ]}>
            {r.delta > 0 ? `+${r.delta}` : r.delta}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  legend: { flexDirection: 'row', gap: Spacing.three, marginBottom: Spacing.one },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 12 },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  gradeLabel: { width: 48, fontSize: 14, fontWeight: '700' },
  bars: { flex: 1, gap: 3 },
  barLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  track: { flex: 1, height: 14, borderRadius: 5, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 5, minWidth: 3 },
  value: { width: 26, fontSize: 12, textAlign: 'right' },
  delta: { width: 36, fontSize: 13, fontWeight: '700', textAlign: 'right' },
});
