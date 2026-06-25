import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import {
  lastWeekRange,
  monthRange,
  weekRange,
  type Period,
} from '@/domain/aggregate';
import { formatDateFi, todayIso } from '@/domain/dates';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { PrimaryButton } from './PrimaryButton';

export type PeriodPreset = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom';

/** Valittu jakso: joko valmis preset tai mukautettu päiväväli. */
export interface PeriodSelection {
  preset: PeriodPreset;
  /** Vain kun preset = 'custom'. */
  custom?: Period;
}

/** Edellisen kuukauden inklusiivinen väli (aggregate.ts ei vie tätä). */
function lastMonthRange(date: string): Period {
  const [y, m] = date.split('-').map(Number);
  const prev = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
  return monthRange(prev);
}

/** Ratkaise valinta konkreettiseksi jaksoksi. `now` on viite (oletus tänään). */
export function resolvePeriod(sel: PeriodSelection, now: string = todayIso()): Period {
  switch (sel.preset) {
    case 'thisWeek':
      return weekRange(now);
    case 'lastWeek':
      return lastWeekRange(now);
    case 'thisMonth':
      return monthRange(now);
    case 'lastMonth':
      return lastMonthRange(now);
    case 'custom':
      return sel.custom ?? weekRange(now);
  }
}

interface PeriodPickerProps {
  value: PeriodSelection;
  onChange: (sel: PeriodSelection) => void;
}

const PRESETS: PeriodPreset[] = ['thisWeek', 'lastWeek', 'thisMonth', 'lastMonth'];

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const theme = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [start, setStart] = useState(value.custom?.start ?? todayIso());
  const [end, setEnd] = useState(value.custom?.end ?? todayIso());

  const labelFor = (p: PeriodPreset): string => fi.stats.periods[p];

  const openCustom = () => {
    setStart(value.custom?.start ?? todayIso());
    setEnd(value.custom?.end ?? todayIso());
    setModalOpen(true);
  };

  const valid = isValidIsoDate(start) && isValidIsoDate(end) && start <= end;

  const applyCustom = () => {
    if (!valid) return;
    onChange({ preset: 'custom', custom: { start, end } });
    setModalOpen(false);
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.presetRow}>
        {PRESETS.map((preset) => {
          const selected = value.preset === preset;
          return (
            <Pressable
              key={preset}
              onPress={() => onChange({ preset })}
              style={[
                styles.chip,
                { backgroundColor: selected ? theme.text : theme.backgroundElement },
              ]}>
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? theme.background : theme.textSecondary },
                ]}>
                {labelFor(preset)}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={openCustom}
          style={[
            styles.chip,
            {
              backgroundColor: value.preset === 'custom' ? theme.text : theme.backgroundElement,
            },
          ]}>
          <Text
            style={[
              styles.chipText,
              {
                color: value.preset === 'custom' ? theme.background : theme.textSecondary,
              },
            ]}>
            {value.preset === 'custom' && value.custom
              ? `${formatDateFi(value.custom.start)}–${formatDateFi(value.custom.end)}`
              : labelFor('custom')}
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={modalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setModalOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: theme.background }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {fi.stats.customRange}
            </Text>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              {fi.stats.dateFormatHint}
            </Text>

            <Text style={[styles.label, { color: theme.textSecondary }]}>
              {fi.stats.rangeStart}
            </Text>
            <TextInput
              value={start}
              onChangeText={setStart}
              placeholder="2026-06-01"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              style={inputStyle}
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>
              {fi.stats.rangeEnd}
            </Text>
            <TextInput
              value={end}
              onChangeText={setEnd}
              placeholder="2026-06-30"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              style={inputStyle}
            />

            {!valid ? (
              <Text style={[styles.error, { color: '#d1495b' }]}>{fi.stats.rangeInvalid}</Text>
            ) : null}

            <View style={styles.cardFooter}>
              <PrimaryButton
                label={fi.common.cancel}
                onPress={() => setModalOpen(false)}
                variant="secondary"
                flex
              />
              <PrimaryButton
                label={fi.common.ok}
                onPress={applyCustom}
                disabled={!valid}
                flex
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.two,
    borderRadius: 9,
  },
  chipText: { fontSize: 13, fontWeight: '600' },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.one },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 12, marginBottom: Spacing.one },
  label: { fontSize: 13, fontWeight: '600', marginTop: Spacing.two },
  input: { borderRadius: 10, padding: Spacing.three, fontSize: 16 },
  error: { fontSize: 13, marginTop: Spacing.two },
  cardFooter: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
});
