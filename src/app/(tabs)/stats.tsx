import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarChart, type BarDatum } from '@/components/BarChart';
import { ComparisonBarChart } from '@/components/ComparisonBarChart';
import {
  PeriodPicker,
  resolvePeriod,
  type PeriodSelection,
} from '@/components/PeriodPicker';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Spacing } from '@/constants/theme';
import { Attempts, AttemptLogs, Projects, Sends, Sessions } from '@/db/repositories';
import {
  buildEfforts,
  compareTallies,
  countWorkouts,
  filterByPeriod,
  tallyByGrade,
  type ClimbEffort,
} from '@/domain/aggregate';
import { gradePyramid, volumeOverTime, type DatedCount, type VolumePeriod } from '@/domain/stats';
import type { Climb, Discipline, GradeSystem } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { useSettings } from '@/state/settings';

export default function StatsScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const [discipline, setDiscipline] = useState<Discipline>('boulder');
  const [period, setPeriod] = useState<VolumePeriod>('week');
  // Oletus: tämä viikko (B) vs viime viikko (A).
  const [periodA, setPeriodA] = useState<PeriodSelection>({ preset: 'lastWeek' });
  const [periodB, setPeriodB] = useState<PeriodSelection>({ preset: 'thisWeek' });

  const data = useDbQuery(() => {
    const sends = Sends.allSends();
    const sentProjects = Projects.allSentProjects();
    const sessions = Sessions.listSessions();
    const sessionDate = new Map(sessions.map((s) => [s.id, s.date]));

    // Pyramidin nousut: sendit + lähetetyt projektit.
    const climbs: Climb[] = [
      ...sends.map((s) => ({
        discipline: s.discipline as Discipline,
        gradeSystem: s.gradeSystem as Climb['gradeSystem'],
        gradeValue: s.gradeValue,
        count: s.count,
      })),
      ...sentProjects.map((p) => ({
        discipline: p.discipline as Discipline,
        gradeSystem: p.gradeSystem as Climb['gradeSystem'],
        gradeValue: p.gradeValue,
        count: 1,
      })),
    ];

    // Volyymi: sendit session päivämäärällä + lähetetyt projektit sentAt-päivällä.
    const dated: DatedCount[] = [];
    for (const s of sends) {
      const date = sessionDate.get(s.sessionId);
      if (date) dated.push({ date, count: s.count });
    }
    for (const p of sentProjects) {
      if (p.sentAt) dated.push({ date: p.sentAt.slice(0, 10), count: 1 });
    }

    // Vertailun efforts: sendit + irralliset yritykset + project-yritykset.
    const efforts: ClimbEffort[] = buildEfforts(
      {
        sends: Sends.allSends(),
        attemptLogs: AttemptLogs.allAttemptLogs(),
        projectAttempts: Attempts.allProjectAttemptsWithGrade(),
      },
      sessionDate,
    );
    const sessionDates = sessions.map((s) => ({ date: s.date }));

    return { climbs, dated, efforts, sessionDates };
  }, []);

  const pyramid = gradePyramid(data.climbs, discipline, settings.boulderDefaultSystem);
  const volume = volumeOverTime(data.dated, period);

  const pyramidBars: BarDatum[] = pyramid.map((r) => ({ label: r.grade, value: r.count }));
  const volumeBars: BarDatum[] = volume.map((b) => ({ label: b.label, value: b.count }));

  const hasData = data.climbs.length > 0 || data.efforts.length > 0;

  // --- Jaksovertailu ---
  const displaySystem: GradeSystem =
    discipline === 'sport' ? 'french' : settings.boulderDefaultSystem;
  const rangeA = resolvePeriod(periodA);
  const rangeB = resolvePeriod(periodB);

  const effortsA = filterByPeriod(data.efforts, rangeA);
  const effortsB = filterByPeriod(data.efforts, rangeB);

  const workoutsA = countWorkouts(data.sessionDates, rangeA);
  const workoutsB = countWorkouts(data.sessionDates, rangeB);

  const totalRows = compareTallies(
    tallyByGrade(effortsA, { metric: 'total', discipline, displaySystem }),
    tallyByGrade(effortsB, { metric: 'total', discipline, displaySystem }),
    displaySystem,
  );
  const attemptRows = compareTallies(
    tallyByGrade(effortsA, { metric: 'attempts', discipline, displaySystem }),
    tallyByGrade(effortsB, { metric: 'attempts', discipline, displaySystem }),
    displaySystem,
  );

  const hasComparisonData = totalRows.length > 0 || workoutsA > 0 || workoutsB > 0;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <Text style={[styles.title, { color: theme.text }]}>{fi.stats.title}</Text>
      {!hasData ? (
        <View style={styles.empty}>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>{fi.stats.empty}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <SegmentedControl<Discipline>
            segments={[
              { value: 'boulder', label: fi.discipline.boulder },
              { value: 'sport', label: fi.discipline.sport },
            ]}
            value={discipline}
            onChange={setDiscipline}
          />

          <Text style={[styles.sectionTitle, { color: theme.text }]}>{fi.stats.gradePyramid}</Text>
          <Text style={[styles.note, { color: theme.textSecondary }]}>{fi.stats.note}</Text>
          {pyramidBars.length === 0 ? (
            <Text style={[styles.muted, { color: theme.textSecondary }]}>{fi.stats.empty}</Text>
          ) : (
            <BarChart data={pyramidBars} orientation="horizontal" />
          )}

          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.three }]}>
            {fi.stats.volume}
          </Text>
          <SegmentedControl<VolumePeriod>
            segments={[
              { value: 'day', label: fi.stats.perDay },
              { value: 'week', label: fi.stats.perWeek },
            ]}
            value={period}
            onChange={setPeriod}
          />
          {volumeBars.length === 0 ? (
            <Text style={[styles.muted, { color: theme.textSecondary }]}>{fi.stats.empty}</Text>
          ) : (
            <BarChart data={volumeBars.slice(-8)} orientation="vertical" />
          )}

          {/* --- Jaksovertailu --- */}
          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.three }]}>
            {fi.stats.comparison}
          </Text>
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            {fi.stats.comparisonNote}
          </Text>

          <Text style={[styles.subLabel, { color: theme.textSecondary }]}>{fi.stats.periodA}</Text>
          <PeriodPicker value={periodA} onChange={setPeriodA} />
          <Text style={[styles.subLabel, { color: theme.textSecondary }]}>{fi.stats.periodB}</Text>
          <PeriodPicker value={periodB} onChange={setPeriodB} />

          {!hasComparisonData ? (
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              {fi.stats.noComparisonData}
            </Text>
          ) : (
            <>
              <Text style={[styles.metricTitle, { color: theme.text }]}>{fi.stats.workouts}</Text>
              <View style={styles.workoutRow}>
                <View style={styles.workoutCell}>
                  <Text style={[styles.workoutLabel, { color: theme.textSecondary }]}>
                    {fi.stats.periodA}
                  </Text>
                  <Text style={[styles.workoutValue, { color: theme.text }]}>{workoutsA}</Text>
                </View>
                <View style={styles.workoutCell}>
                  <Text style={[styles.workoutLabel, { color: theme.textSecondary }]}>
                    {fi.stats.periodB}
                  </Text>
                  <Text style={[styles.workoutValue, { color: theme.text }]}>{workoutsB}</Text>
                </View>
                <View style={styles.workoutCell}>
                  <Text style={[styles.workoutLabel, { color: theme.textSecondary }]}>Δ</Text>
                  <Text
                    style={[
                      styles.workoutValue,
                      {
                        color:
                          workoutsB - workoutsA > 0
                            ? '#2e9e5b'
                            : workoutsB - workoutsA < 0
                              ? '#d1495b'
                              : theme.text,
                      },
                    ]}>
                    {workoutsB - workoutsA > 0
                      ? `+${workoutsB - workoutsA}`
                      : workoutsB - workoutsA}
                  </Text>
                </View>
              </View>

              <Text style={[styles.metricTitle, { color: theme.text }]}>
                {fi.stats.totalEfforts}
              </Text>
              {totalRows.length === 0 ? (
                <Text style={[styles.muted, { color: theme.textSecondary }]}>
                  {fi.stats.noComparisonData}
                </Text>
              ) : (
                <ComparisonBarChart
                  rows={totalRows}
                  labelA={fi.stats.periodA}
                  labelB={fi.stats.periodB}
                />
              )}

              <Text style={[styles.metricTitle, { color: theme.text }]}>
                {fi.stats.attemptsByGrade}
              </Text>
              {attemptRows.length === 0 ? (
                <Text style={[styles.muted, { color: theme.textSecondary }]}>
                  {fi.stats.noComparisonData}
                </Text>
              ) : (
                <ComparisonBarChart
                  rows={attemptRows}
                  labelA={fi.stats.periodA}
                  labelB={fi.stats.periodB}
                />
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', padding: Spacing.three, paddingBottom: Spacing.two },
  body: { padding: Spacing.three, paddingTop: 0, gap: Spacing.two },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  subLabel: { fontSize: 13, fontWeight: '600', marginTop: Spacing.two },
  metricTitle: { fontSize: 15, fontWeight: '700', marginTop: Spacing.two },
  note: { fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 15 },
  workoutRow: { flexDirection: 'row', gap: Spacing.two },
  workoutCell: { flex: 1, alignItems: 'center', gap: 2 },
  workoutLabel: { fontSize: 12 },
  workoutValue: { fontSize: 22, fontWeight: '800' },
});
