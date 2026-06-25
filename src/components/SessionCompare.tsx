import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ComparisonBarChart } from '@/components/ComparisonBarChart';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Spacing } from '@/constants/theme';
import { Sessions } from '@/db/repositories';
import {
  compareTallies,
  hardestGrade,
  tallyByGrade,
  totalCount,
  type ClimbEffort,
} from '@/domain/aggregate';
import { formatDateFi } from '@/domain/dates';
import type { Discipline, GradeSystem } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { useSettings } from '@/state/settings';

interface SessionLite {
  id: number;
  date: string;
  theme: string | null;
  location: string | null;
}

interface SessionCompareProps {
  /** Avattu sessio (A). */
  sessionId: number;
  sessionDate: string;
  /** Avattuun sessioon kuuluvat efforts (sendit + irralliset + project-yritykset). */
  effortsA: ClimbEffort[];
}

/** Sessiokohtainen vertailu: avattu sessio (A) vs. valittu toinen sessio (B). */
export function SessionCompare({ sessionId, sessionDate, effortsA }: SessionCompareProps) {
  const theme = useTheme();
  const settings = useSettings();
  const [targetId, setTargetId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Muut sessiot (pois lukien avattu) valitsijaan.
  const others = useDbQuery<SessionLite[]>(
    () =>
      Sessions.listSessions()
        .filter((s) => s.id !== sessionId)
        .map((s) => ({ id: s.id, date: s.date, theme: s.theme, location: s.location })),
    [sessionId],
  );

  // Jos kohde poistuu (esim. poistettu sessio), nollaa valinta.
  const target = others.find((s) => s.id === targetId) ?? null;
  const effortsB = useDbQuery<ClimbEffort[]>(
    () => (target ? Sessions.sessionEfforts(target.id) : []),
    [target?.id ?? -1],
  );

  // Oletuslaji: kumman sessioista (A tai B) datassa on bouldereita; muuten sport.
  const defaultDiscipline: Discipline = useMemo(() => {
    const hasBoulder =
      effortsA.some((e) => e.discipline === 'boulder') ||
      effortsB.some((e) => e.discipline === 'boulder');
    return hasBoulder ? 'boulder' : 'sport';
  }, [effortsA, effortsB]);

  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const activeDiscipline = discipline ?? defaultDiscipline;

  const displaySystem: GradeSystem =
    activeDiscipline === 'sport' ? 'french' : settings.boulderDefaultSystem;

  const totalRows = compareTallies(
    tallyByGrade(effortsA, { metric: 'total', discipline: activeDiscipline, displaySystem }),
    tallyByGrade(effortsB, { metric: 'total', discipline: activeDiscipline, displaySystem }),
    displaySystem,
  );
  const attemptRows = compareTallies(
    tallyByGrade(effortsA, { metric: 'attempts', discipline: activeDiscipline, displaySystem }),
    tallyByGrade(effortsB, { metric: 'attempts', discipline: activeDiscipline, displaySystem }),
    displaySystem,
  );

  // Headline-totaalit lajin mukaan rajattuna.
  const aEfforts = effortsA.filter((e) => e.discipline === activeDiscipline);
  const bEfforts = effortsB.filter((e) => e.discipline === activeDiscipline);
  const headline = {
    aTotal: totalCount(aEfforts, 'total'),
    bTotal: totalCount(bEfforts, 'total'),
    aAttempts: totalCount(aEfforts, 'attempts'),
    bAttempts: totalCount(bEfforts, 'attempts'),
    aHardest: hardestGrade(aEfforts, { discipline: activeDiscipline, displaySystem }),
    bHardest: hardestGrade(bEfforts, { discipline: activeDiscipline, displaySystem }),
  };

  const labelA = `A · ${formatDateFi(sessionDate)}`;
  const labelB = target ? `B · ${formatDateFi(target.date)}` : 'B';

  const pick = (id: number) => {
    setTargetId(id);
    setPickerOpen(false);
  };

  const optionSubtitle = (s: SessionLite) =>
    [s.theme, s.location].filter(Boolean).join(' · ');

  const hasComparisonData = totalRows.length > 0 || attemptRows.length > 0;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{fi.sessionCompare.title}</Text>

      {target == null ? (
        <>
          <Pressable
            onPress={() => setPickerOpen(true)}
            disabled={others.length === 0}
            style={[
              styles.button,
              { backgroundColor: theme.backgroundElement, opacity: others.length === 0 ? 0.5 : 1 },
            ]}>
            <Ionicons name="git-compare-outline" size={18} color={theme.text} />
            <Text style={[styles.buttonText, { color: theme.text }]}>
              {fi.sessionCompare.compareButton}
            </Text>
          </Pressable>
          {others.length === 0 ? (
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              {fi.sessionCompare.noOtherSessions}
            </Text>
          ) : (
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              {fi.sessionCompare.pickHint}
            </Text>
          )}
        </>
      ) : (
        <>
          <View style={styles.targetRow}>
            <Text style={[styles.targetText, { color: theme.textSecondary }]}>
              {labelA} ↔ {labelB}
            </Text>
          </View>
          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={[styles.smallButton, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.smallButtonText, { color: theme.text }]}>
                {fi.sessionCompare.change}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTargetId(null)}
              style={[styles.smallButton, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.smallButtonText, { color: theme.text }]}>
                {fi.sessionCompare.clear}
              </Text>
            </Pressable>
          </View>

          <SegmentedControl<Discipline>
            segments={[
              { value: 'boulder', label: fi.discipline.boulder },
              { value: 'sport', label: fi.discipline.sport },
            ]}
            value={activeDiscipline}
            onChange={setDiscipline}
          />

          {!hasComparisonData ? (
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              {fi.sessionCompare.noData}
            </Text>
          ) : (
            <>
              {/* Headline-totaalit */}
              <Text style={[styles.metricTitle, { color: theme.text }]}>
                {fi.sessionCompare.headline}
              </Text>
              <View style={styles.headlineGrid}>
                <HeadlineRow
                  label={fi.sessionCompare.totalEffortsShort}
                  a={String(headline.aTotal)}
                  b={String(headline.bTotal)}
                />
                <HeadlineRow
                  label={fi.sessionCompare.totalAttemptsShort}
                  a={String(headline.aAttempts)}
                  b={String(headline.bAttempts)}
                />
                <HeadlineRow
                  label={fi.sessionCompare.hardestGrade}
                  a={headline.aHardest ?? '–'}
                  b={headline.bHardest ?? '–'}
                />
              </View>

              <Text style={[styles.metricTitle, { color: theme.text }]}>
                {fi.sessionCompare.totalEfforts}
              </Text>
              {totalRows.length === 0 ? (
                <Text style={[styles.muted, { color: theme.textSecondary }]}>
                  {fi.sessionCompare.noData}
                </Text>
              ) : (
                <ComparisonBarChart rows={totalRows} labelA={labelA} labelB={labelB} />
              )}

              <Text style={[styles.metricTitle, { color: theme.text }]}>
                {fi.sessionCompare.attemptsByGrade}
              </Text>
              {attemptRows.length === 0 ? (
                <Text style={[styles.muted, { color: theme.textSecondary }]}>
                  {fi.sessionCompare.noData}
                </Text>
              ) : (
                <ComparisonBarChart rows={attemptRows} labelA={labelA} labelB={labelB} />
              )}
            </>
          )}
        </>
      )}

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.background }]}
            onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>
              {fi.sessionCompare.pickTitle}
            </Text>
            <ScrollView>
              {others.map((s) => {
                const sub = optionSubtitle(s);
                return (
                  <Pressable key={s.id} onPress={() => pick(s.id)} style={styles.pickRow}>
                    <Text style={[styles.pickDate, { color: theme.text }]}>
                      {formatDateFi(s.date)}
                    </Text>
                    {sub ? (
                      <Text style={[styles.pickSub, { color: theme.textSecondary }]}>{sub}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function HeadlineRow({ label, a, b }: { label: string; a: string; b: string }) {
  const theme = useTheme();
  return (
    <View style={styles.headlineRow}>
      <Text style={[styles.headlineLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.headlineValue, { color: theme.text }]}>{a}</Text>
      <Text style={[styles.headlineValue, { color: theme.text }]}>{b}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, marginTop: Spacing.three },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  muted: { fontSize: 14 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: 10,
    padding: Spacing.three,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  targetRow: { marginTop: Spacing.one },
  targetText: { fontSize: 14, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: Spacing.two },
  smallButton: { borderRadius: 8, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  smallButtonText: { fontSize: 14, fontWeight: '600' },
  metricTitle: { fontSize: 15, fontWeight: '700', marginTop: Spacing.two },
  headlineGrid: { gap: 4 },
  headlineRow: { flexDirection: 'row', alignItems: 'center' },
  headlineLabel: { flex: 1, fontSize: 13 },
  headlineValue: { width: 56, fontSize: 16, fontWeight: '700', textAlign: 'right' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheet: { borderRadius: 14, maxHeight: '70%', paddingVertical: Spacing.three },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  pickRow: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four },
  pickDate: { fontSize: 16, fontWeight: '700' },
  pickSub: { fontSize: 13, marginTop: 2 },
});
