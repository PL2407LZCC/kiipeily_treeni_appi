import { useState } from 'react';
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
  /** Käyttäjän piilottamat asteet (asetus) — poistetaan ruudukosta kokonaan. */
  hiddenGrades?: string[];
  /** Astenappien määrä rivillä; napit skaalautuvat täyttämään leveyden. Oletus 4. */
  columns?: number;
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
  hiddenGrades,
  columns = 4,
}: GradePickerProps) {
  const theme = useTheme();
  const allowed = allowedGrades != null ? new Set(allowedGrades) : null;
  const hidden = hiddenGrades && hiddenGrades.length ? new Set(hiddenGrades) : null;
  const grades = gradesFor(system).filter(
    (g) => (!allowed || allowed.has(g)) && (!hidden || !hidden.has(g)),
  );

  // Mitataan ruudukon leveys, jotta solut skaalautuvat täyttämään sen valitulla sarakemäärällä.
  const [gridW, setGridW] = useState(0);
  // Floor estää alipikselipyöristystä ylittämästä riviä ja rivittämästä viimeistä solua.
  const cellW = gridW > 0 ? Math.floor((gridW - Spacing.two * (columns - 1)) / columns) : 0;
  const cellH = cellW > 0 ? Math.max(64, Math.round(cellW * 0.8)) : 64;
  // Ennen ensimmäistä mittausta: prosenttipohjainen varasijoittelu (ei tyhjää välähdystä).
  const sizeStyle = cellW > 0 ? { width: cellW, height: cellH } : styles.cellFallback;

  return (
    <View style={styles.grid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
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
              sizeStyle,
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Varasijoittelu ennen kuin ruudukon leveys on mitattu (≈4 saraketta).
  cellFallback: {
    minWidth: 66,
    flexGrow: 1,
    flexBasis: '22%',
    height: 64,
  },
  grade: { fontSize: 20, fontWeight: '700' },
  secondary: { fontSize: 12, marginTop: 2 },
});
