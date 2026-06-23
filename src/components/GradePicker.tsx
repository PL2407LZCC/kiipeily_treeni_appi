import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { gradesFor, secondaryLabel } from '@/domain/grades';
import type { GradeSystem } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

interface GradePickerProps {
  system: GradeSystem;
  /** Toissijaisen asteen näyttöjärjestelmä (esim. V Font-napin alla). */
  secondarySystem?: GradeSystem;
  showSecondary?: boolean;
  onPick: (value: string) => void;
  /** Korostettu valittu arvo (esim. projektin luonnissa). */
  selected?: string | null;
}

/** Isojen astenappien ruudukko sendien nopeaan kirjaamiseen. */
export function GradePicker({
  system,
  secondarySystem,
  showSecondary,
  onPick,
  selected,
}: GradePickerProps) {
  const theme = useTheme();
  const grades = gradesFor(system);

  return (
    <View style={styles.grid}>
      {grades.map((g) => {
        const secondary =
          showSecondary && secondarySystem ? secondaryLabel(g, system, secondarySystem) : null;
        const isSel = selected === g;
        return (
          <Pressable
            key={g}
            onPress={() => onPick(g)}
            style={[
              styles.cell,
              { backgroundColor: isSel ? theme.text : theme.backgroundElement },
            ]}>
            <Text style={[styles.grade, { color: isSel ? theme.background : theme.text }]}>{g}</Text>
            {secondary ? (
              <Text
                style={[
                  styles.secondary,
                  { color: isSel ? theme.background : theme.textSecondary },
                ]}>
                {secondary}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cell: {
    minWidth: 66,
    flexGrow: 1,
    flexBasis: '22%',
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grade: { fontSize: 20, fontWeight: '700' },
  secondary: { fontSize: 12, marginTop: 2 },
});
