import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SessionCard } from '@/components/SessionCard';
import { Spacing } from '@/constants/theme';
import { Attempts, Sends, Sessions, Supplemental } from '@/db/repositories';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';

export default function TimelineScreen() {
  const theme = useTheme();
  const router = useRouter();

  const rows = useDbQuery(() => {
    return Sessions.listSessions().map((session) => {
      const sendCount = Sends.listSendsForSession(session.id).reduce((sum, s) => sum + s.count, 0);
      const attempts = Attempts.attemptsForSession(session.id);
      const attemptCount = attempts.reduce((sum, a) => sum + a.attemptCount, 0);
      const supplementalCount = Supplemental.listSupplementalForSession(session.id).length;
      return { session, sendCount, attemptCount, supplementalCount };
    });
  }, []);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <Text style={[styles.title, { color: theme.text }]}>{fi.timeline.title}</Text>
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>{fi.timeline.empty}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {rows.map(({ session, sendCount, attemptCount, supplementalCount }) => (
            <SessionCard
              key={session.id}
              session={session}
              sendCount={sendCount}
              attemptCount={attemptCount}
              supplementalCount={supplementalCount}
              onPress={() => router.push(`/session/${session.id}`)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', padding: Spacing.three, paddingBottom: 0 },
  body: { padding: Spacing.three, gap: Spacing.two },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 15 },
});
