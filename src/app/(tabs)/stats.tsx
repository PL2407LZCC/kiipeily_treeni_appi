import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarChart, type BarDatum } from '@/components/BarChart';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Spacing } from '@/constants/theme';
import { Projects, Sends, Sessions } from '@/db/repositories';
import { gradePyramid, volumeOverTime, type DatedCount, type VolumePeriod } from '@/domain/stats';
import type { Climb, Discipline } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { useSettings } from '@/state/settings';

export default function StatsScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const [discipline, setDiscipline] = useState<Discipline>('boulder');
  const [period, setPeriod] = useState<VolumePeriod>('week');

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

    return { climbs, dated };
  }, []);

  const pyramid = gradePyramid(data.climbs, discipline, settings.boulderDefaultSystem);
  const volume = volumeOverTime(data.dated, period);

  const pyramidBars: BarDatum[] = pyramid.map((r) => ({ label: r.grade, value: r.count }));
  const volumeBars: BarDatum[] = volume.map((b) => ({ label: b.label, value: b.count }));

  const hasData = data.climbs.length > 0;

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
  note: { fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 15 },
});
