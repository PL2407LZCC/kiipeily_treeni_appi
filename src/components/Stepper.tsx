import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface StepperProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  /** Askelkoko napeille (oletus 1). Esim. volyymi-% käyttää 10. */
  step?: number;
  label?: string;
}

/** Iso määrävalitsin (askelnapit) — kosketusystävällinen, ei näppäimistöä. */
export function Stepper({ value, onChange, min = 1, max = 99, step = 1, label }: StepperProps) {
  const theme = useTheme();
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text> : null}
      <View style={styles.row}>
        <Pressable
          onPress={dec}
          disabled={value <= min}
          style={[
            styles.btn,
            { backgroundColor: theme.backgroundElement, opacity: value <= min ? 0.4 : 1 },
          ]}>
          <Text style={[styles.btnText, { color: theme.text }]}>−</Text>
        </Pressable>
        <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
        <Pressable
          onPress={inc}
          disabled={value >= max}
          style={[
            styles.btn,
            { backgroundColor: theme.backgroundElement, opacity: value >= max ? 0.4 : 1 },
          ]}>
          <Text style={[styles.btnText, { color: theme.text }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.two },
  label: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  btn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 28, fontWeight: '700', lineHeight: 30 },
  value: { fontSize: 28, fontWeight: '700', minWidth: 44, textAlign: 'center' },
});
