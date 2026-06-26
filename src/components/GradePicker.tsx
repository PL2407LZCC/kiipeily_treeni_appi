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
  /** Pitkä painallus astenapilla (esim. irrallisen yrityksen kirjaus). */
  onLongPress?: (value: string) => void;
  /** Pitkän painalluksen viive millisekunteina. */
  longPressDelayMs?: number;
  /** Korostettu valittu arvo (esim. projektin luonnissa). */
  selected?: string | null;
  /**
   * Jos annettu, näytä VAIN nämä asteet (exact-tilan suunnitelma). Järjestys säilyy
   * asteikon mukaisena. Tyhjä lista → ei yhtään astetta.
   */
  allowedGrades?: string[];
}

/** Isojen astenappien ruudukko sendien nopeaan kirjaamiseen. */
export function GradePicker({
  system,
  secondarySystem,
  showSecondary,
  onPick,
  onLongPress,
  longPressDelayMs,
  selected,
  allowedGrades,
}: GradePickerProps) {
  const theme = useTheme();
  const allowed = allowedGrades != null ? new Set(allowedGrades) : null;
  const grades = allowed ? gradesFor(system).filter((g) => allowed.has(g)) : gradesFor(system);

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
            onLongPress={onLongPress ? () => onLongPress(g) : undefined}
            delayLongPress={longPressDelayMs}
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
