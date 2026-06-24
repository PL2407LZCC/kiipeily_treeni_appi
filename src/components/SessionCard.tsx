import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { formatDateFi, formatTimeFi } from '@/domain/dates';
import type { Session, SessionEnvironment } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';

interface SessionCardProps {
  session: Session;
  sendCount: number;
  attemptCount: number;
  supplementalCount: number;
  onPress?: () => void;
}

export function SessionCard({
  session,
  sendCount,
  attemptCount,
  supplementalCount,
  onPress,
}: SessionCardProps) {
  const theme = useTheme();
  const open = session.endedAt == null;

  const meta = [
    session.location,
    session.environment ? fi.environment[session.environment as SessionEnvironment] : null,
    session.theme,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.topRow}>
        <Text style={[styles.date, { color: theme.text }]}>{formatDateFi(session.date)}</Text>
        <Text style={[styles.time, { color: theme.textSecondary }]}>
          {formatTimeFi(session.startedAt)}
          {session.endedAt ? `–${formatTimeFi(session.endedAt)}` : ''}
        </Text>
        {open ? (
          <View style={[styles.liveBadge, { backgroundColor: '#2e9e5b' }]}>
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        ) : null}
      </View>
      {meta ? (
        <Text style={[styles.location, { color: theme.textSecondary }]}>{meta}</Text>
      ) : null}
      <Text style={[styles.stats, { color: theme.textSecondary }]}>
        {sendCount} {fi.timeline.sends} · {attemptCount} {fi.timeline.attempts} · {supplementalCount}{' '}
        {fi.timeline.supplemental}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: Spacing.three, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  date: { fontSize: 17, fontWeight: '700' },
  time: { fontSize: 13, flex: 1 },
  liveBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  location: { fontSize: 14 },
  stats: { fontSize: 13 },
});
