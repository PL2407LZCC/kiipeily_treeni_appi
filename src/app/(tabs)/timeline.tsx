import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Collapsible } from '@/components/Collapsible';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SessionCard } from '@/components/SessionCard';
import { Spacing } from '@/constants/theme';
import { AttemptLogs, Attempts, Sends, Sessions, Supplemental } from '@/db/repositories';
import type { SessionEnvironment } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';

type EnvFilter = SessionEnvironment | 'all';

export default function TimelineScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [envFilter, setEnvFilter] = useState<EnvFilter>('all');
  const [themeFilter, setThemeFilter] = useState<string | 'all'>('all');

  const rows = useDbQuery(() => {
    return Sessions.listSessions().map((session) => {
      const sendCount = Sends.listSendsForSession(session.id).reduce((sum, s) => sum + s.count, 0);
      const attempts = Attempts.attemptsForSession(session.id);
      const looseAttempts = AttemptLogs.listAttemptLogsForSession(session.id);
      const attemptCount =
        attempts.reduce((sum, a) => sum + a.attemptCount, 0) +
        looseAttempts.reduce((sum, a) => sum + a.count, 0);
      const supplementalCount = Supplemental.listSupplementalForSession(session.id).length;
      return { session, sendCount, attemptCount, supplementalCount };
    });
  }, []);

  // Teemavaihtoehdot = historiassa esiintyvät teemat (uniikit, aakkosjärjestyksessä).
  const themeOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.session.theme).filter((t): t is string => !!t))].sort((a, b) =>
        a.localeCompare(b, 'fi'),
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(({ session }) => {
      if (envFilter !== 'all' && session.environment !== envFilter) return false;
      if (themeFilter !== 'all' && session.theme !== themeFilter) return false;
      if (q) {
        const hay = [session.location, session.theme, session.notes, session.date]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, envFilter, themeFilter]);

  const filtersActive = envFilter !== 'all' || themeFilter !== 'all';
  const filterSummary =
    [envFilter !== 'all' ? fi.environment[envFilter] : null, themeFilter !== 'all' ? themeFilter : null]
      .filter(Boolean)
      .join(' · ') || fi.timeline.filterAll;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <Text style={[styles.title, { color: theme.text }]}>{fi.timeline.title}</Text>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>{fi.timeline.empty}</Text>
        </View>
      ) : (
        <>
          <View style={styles.controls}>
            <View style={[styles.searchRow, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="search" size={18} color={theme.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={fi.timeline.searchPlaceholder}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.searchInput, { color: theme.text }]}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            <Collapsible title={fi.timeline.filters} summary={filterSummary}>
              <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
                {fi.timeline.environmentLabel}
              </Text>
              <SegmentedControl<EnvFilter>
                segments={[
                  { value: 'all', label: fi.timeline.filterAll },
                  { value: 'indoor', label: fi.environment.indoor },
                  { value: 'outdoor', label: fi.environment.outdoor },
                ]}
                value={envFilter}
                onChange={setEnvFilter}
              />

              {themeOptions.length > 0 ? (
                <>
                  <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
                    {fi.timeline.themeLabel}
                  </Text>
                  <View style={styles.chips}>
                    <ThemeChip
                      label={fi.timeline.filterAll}
                      selected={themeFilter === 'all'}
                      onPress={() => setThemeFilter('all')}
                    />
                    {themeOptions.map((t) => (
                      <ThemeChip
                        key={t}
                        label={t}
                        selected={themeFilter === t}
                        onPress={() => setThemeFilter(t)}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </Collapsible>
          </View>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.muted, { color: theme.textSecondary }]}>
                {fi.timeline.noResults}
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body}>
              {query.trim() !== '' || filtersActive ? (
                <Text style={[styles.count, { color: theme.textSecondary }]}>
                  {filtered.length} {fi.timeline.resultCount}
                </Text>
              ) : null}
              {filtered.map(({ session, sendCount, attemptCount, supplementalCount }) => (
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
        </>
      )}
    </SafeAreaView>
  );
}

function ThemeChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.text : theme.background }]}>
      <Text style={[styles.chipText, { color: selected ? theme.background : theme.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', padding: Spacing.three, paddingBottom: Spacing.two },
  controls: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.two + 2, fontSize: 16 },
  subLabel: { fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: { paddingVertical: Spacing.one + 2, paddingHorizontal: Spacing.two, borderRadius: 9 },
  chipText: { fontSize: 13, fontWeight: '600' },
  body: { padding: Spacing.three, gap: Spacing.two },
  count: { fontSize: 13, marginBottom: Spacing.one },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 15 },
});
