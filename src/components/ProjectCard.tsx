import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { secondaryLabel } from '@/domain/grades';
import type { GradeSystem, Project, ProjectStatus } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';

const STATUS_COLOR: Record<ProjectStatus, string> = {
  active: '#2e9e5b',
  sent: '#3c87f7',
  abandoned: '#b0641e',
  archived: '#8a8f98',
};

interface ProjectCardProps {
  project: Project;
  lifetimeAttempts: number;
  sessionsWorked: number;
  secondarySystem?: GradeSystem;
  showSecondary?: boolean;
  onPress?: () => void;
  actions?: ReactNode;
}

export function ProjectCard({
  project,
  lifetimeAttempts,
  sessionsWorked,
  secondarySystem,
  showSecondary,
  onPress,
  actions,
}: ProjectCardProps) {
  const theme = useTheme();
  const secondary =
    showSecondary && secondarySystem
      ? secondaryLabel(project.gradeValue, project.gradeSystem, secondarySystem)
      : null;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.headerRow}>
        <View style={styles.gradeBox}>
          <Text style={[styles.grade, { color: theme.text }]}>{project.gradeValue}</Text>
          {secondary ? (
            <Text style={[styles.secondary, { color: theme.textSecondary }]}>{secondary}</Text>
          ) : null}
        </View>
        <View style={styles.info}>
          {project.name ? (
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {project.name}
            </Text>
          ) : null}
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            {fi.discipline[project.discipline]}
            {project.location ? ` · ${project.location}` : ''}
          </Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            {lifetimeAttempts} {fi.project.lifetimeAttempts} · {sessionsWorked}{' '}
            {fi.project.sessionsWorked}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: STATUS_COLOR[project.status] }]}>
          <Text style={styles.badgeText}>{fi.project.status[project.status]}</Text>
        </View>
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  gradeBox: { minWidth: 54, alignItems: 'center' },
  grade: { fontSize: 24, fontWeight: '800' },
  secondary: { fontSize: 12 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
