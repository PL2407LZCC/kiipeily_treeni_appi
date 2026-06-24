import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProjectCard } from '@/components/ProjectCard';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Spacing } from '@/constants/theme';
import { Attempts, Projects } from '@/db/repositories';
import type { ProjectStatus } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { bumpData } from '@/state/dataVersion';
import { useSettings } from '@/state/settings';

type Filter = 'active' | 'sent' | 'archive';

const FILTER_STATUSES: Record<Filter, ProjectStatus[]> = {
  active: ['active'],
  sent: ['sent'],
  archive: ['archived', 'abandoned'],
};

export default function ProjectsScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const [filter, setFilter] = useState<Filter>('active');

  const projects = useDbQuery(
    () => Projects.listProjects(FILTER_STATUSES[filter]),
    [filter],
  );
  // Yritys-/sessiosummat kaikille näkyville projekteille.
  const totals = useDbQuery(() => {
    const map = new Map<number, { lifetime: number; sessions: number }>();
    for (const p of Projects.listProjects(FILTER_STATUSES[filter])) {
      map.set(p.id, {
        lifetime: Attempts.lifetimeAttempts(p.id),
        sessions: Attempts.sessionsWorked(p.id),
      });
    }
    return map;
  }, [filter]);

  const setStatus = (id: number, status: ProjectStatus) => {
    Projects.setProjectStatus(id, status);
    bumpData();
  };

  const confirmDelete = (id: number) => {
    Alert.alert(fi.project.actions.delete, undefined, [
      { text: fi.common.cancel, style: 'cancel' },
      {
        text: fi.common.delete,
        style: 'destructive',
        onPress: () => {
          Projects.deleteProject(id);
          bumpData();
        },
      },
    ]);
  };

  const boulderSecondary = settings.boulderDefaultSystem === 'font' ? 'v' : 'font';

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <Text style={[styles.title, { color: theme.text }]}>{fi.tabs.projects}</Text>
      <View style={styles.filterWrap}>
        <SegmentedControl<Filter>
          segments={[
            { value: 'active', label: fi.project.filterActive },
            { value: 'sent', label: fi.project.filterSent },
            { value: 'archive', label: fi.project.filterArchived },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </View>

      {projects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>{fi.project.empty}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {projects.map((p) => {
            const t = totals.get(p.id) ?? { lifetime: 0, sessions: 0 };
            return (
              <ProjectCard
                key={p.id}
                project={p}
                lifetimeAttempts={t.lifetime}
                sessionsWorked={t.sessions}
                secondarySystem={p.discipline === 'boulder' ? boulderSecondary : undefined}
                showSecondary={settings.showSecondaryGrade}
                actions={
                  <>
                    {p.status === 'active' ? (
                      <>
                        <ActionBtn label={fi.project.actions.archive} onPress={() => setStatus(p.id, 'archived')} />
                        <ActionBtn label={fi.project.actions.abandon} onPress={() => setStatus(p.id, 'abandoned')} />
                      </>
                    ) : (
                      <ActionBtn
                        label={fi.project.actions.reactivate}
                        onPress={() => setStatus(p.id, 'active')}
                      />
                    )}
                    <ActionBtn label={fi.common.delete} danger onPress={() => confirmDelete(p.id)} />
                  </>
                }
              />
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ActionBtn({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionBtn, { borderColor: danger ? '#c0392b' : theme.textSecondary }]}>
      <Text style={[styles.actionText, { color: danger ? '#c0392b' : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', padding: Spacing.three, paddingBottom: Spacing.two },
  filterWrap: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  body: { padding: Spacing.three, paddingTop: 0, gap: Spacing.two },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 15 },
  actionBtn: { borderWidth: 1, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 12 },
  actionText: { fontSize: 13, fontWeight: '600' },
});
