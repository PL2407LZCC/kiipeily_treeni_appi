import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Spacing } from '@/constants/theme';
import { AttemptLogs, Attempts, Projects, Sends, Sessions, Supplemental } from '@/db/repositories';
import { formatDateFi, formatTimeFi } from '@/domain/dates';
import type { Discipline, HoldType, SessionEnvironment, SupplementalKind } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { fi, holdTypeLabel } from '@/i18n/fi';
import { bumpData } from '@/state/dataVersion';
import { useSettings } from '@/state/settings';

export default function SessionDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const validId = Number.isFinite(id) ? id : null;

  const session = useDbQuery(
    () => (validId != null ? Sessions.getSession(validId) : undefined),
    [validId],
  );
  const sends = useDbQuery(() => (validId != null ? Sends.listSendsForSession(validId) : []), [validId]);
  const looseAttempts = useDbQuery(
    () => (validId != null ? AttemptLogs.listAttemptLogsForSession(validId) : []),
    [validId],
  );
  const attempts = useDbQuery(() => (validId != null ? Attempts.attemptsForSession(validId) : []), [validId]);
  const supplemental = useDbQuery(
    () => (validId != null ? Supplemental.listSupplementalForSession(validId) : []),
    [validId],
  );

  const deleteSend = (sendId: number) => {
    Sends.deleteSend(sendId);
    bumpData();
  };
  const deleteLooseAttempt = (attemptId: number) => {
    AttemptLogs.deleteAttemptLog(attemptId);
    bumpData();
  };
  const deleteAttempt = (attemptId: number) => {
    Attempts.deleteAttempt(attemptId);
    bumpData();
  };
  const deleteSupplemental = (sid: number) => {
    Supplemental.deleteSupplemental(sid);
    bumpData();
  };

  const trackHoldType = useSettings((s) => s.trackHoldType);

  /** Avaa otetyypin valinta-alert ja tallenna valittu arvo. */
  const editHoldType = (apply: (holdType: HoldType | null) => void) => {
    Alert.alert(fi.holdType.prompt, undefined, [
      { text: fi.holdType.slopy, onPress: () => { apply('slopy'); bumpData(); } },
      { text: fi.holdType.crimpy, onPress: () => { apply('crimpy'); bumpData(); } },
      { text: fi.holdType.undefined, onPress: () => { apply(null); bumpData(); } },
      { text: fi.common.cancel, style: 'cancel' },
    ]);
  };

  const deleteSession = () => {
    Alert.alert(fi.sessionDetail.deleteSession, fi.sessionDetail.deleteSessionConfirm, [
      { text: fi.common.cancel, style: 'cancel' },
      {
        text: fi.common.delete,
        style: 'destructive',
        onPress: () => {
          Sessions.deleteSession(id);
          bumpData();
          router.back();
        },
      },
    ]);
  };

  if (!session) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: fi.sessionDetail.title }} />
        <Text style={{ color: theme.textSecondary }}>{fi.common.none}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: formatDateFi(session.date) }} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.header, { color: theme.text }]}>{formatDateFi(session.date)}</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          {formatTimeFi(session.startedAt)}
          {session.endedAt ? `–${formatTimeFi(session.endedAt)}` : ''}
          {session.location ? ` · ${session.location}` : ''}
          {session.environment ? ` · ${fi.environment[session.environment as SessionEnvironment]}` : ''}
          {session.theme ? ` · ${session.theme}` : ''}
        </Text>

        {/* Sendit */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{fi.sessionDetail.sends}</Text>
        {sends.length === 0 ? (
          <Text style={[styles.muted, { color: theme.textSecondary }]}>
            {fi.sessionDetail.noSends}
          </Text>
        ) : (
          sends.map((s) => (
            <Row
              key={`send-${s.id}`}
              title={`${s.count > 1 ? `${s.count}× ` : ''}${s.gradeValue}${s.flash ? ' ⚡' : ''}`}
              subtitle={`${fi.discipline[s.discipline as Discipline]}${holdTypeLabel(s.holdType) ? ` · ${holdTypeLabel(s.holdType)}` : ''}`}
              onDelete={() => deleteSend(s.id)}
              onEdit={
                trackHoldType
                  ? () => editHoldType((h) => Sends.updateSend(s.id, { holdType: h }))
                  : undefined
              }
            />
          ))
        )}

        {/* Irralliset yritykset */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {fi.sessionDetail.attempts}
        </Text>
        {looseAttempts.length === 0 ? (
          <Text style={[styles.muted, { color: theme.textSecondary }]}>
            {fi.sessionDetail.noAttempts}
          </Text>
        ) : (
          looseAttempts.map((a) => (
            <Row
              key={`loose-${a.id}`}
              title={`${a.count > 1 ? `${a.count}× ` : ''}${a.gradeValue}`}
              subtitle={`${fi.discipline[a.discipline as Discipline]}${holdTypeLabel(a.holdType) ? ` · ${holdTypeLabel(a.holdType)}` : ''}`}
              onDelete={() => deleteLooseAttempt(a.id)}
              onEdit={
                trackHoldType
                  ? () => editHoldType((h) => AttemptLogs.updateAttemptLog(a.id, { holdType: h }))
                  : undefined
              }
            />
          ))
        )}

        {/* Projektit */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {fi.sessionDetail.projects}
        </Text>
        {attempts.length === 0 ? (
          <Text style={[styles.muted, { color: theme.textSecondary }]}>
            {fi.sessionDetail.noProjects}
          </Text>
        ) : (
          attempts.map((a) => (
            <Row
              key={`att-${a.id}`}
              title={`${a.gradeValue}${a.projectName ? ` · ${a.projectName}` : ''}`}
              subtitle={`${a.attemptCount} ${fi.timeline.attempts}${a.sent ? ' · Sent ✅' : ''}${holdTypeLabel(a.holdType) ? ` · ${holdTypeLabel(a.holdType)}` : ''}`}
              onDelete={() => deleteAttempt(a.id)}
              onEdit={
                trackHoldType
                  ? () => editHoldType((h) => Projects.updateProject(a.projectId, { holdType: h }))
                  : undefined
              }
            />
          ))
        )}

        {/* Oheisharjoittelu */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {fi.sessionDetail.supplemental}
        </Text>
        {supplemental.length === 0 ? (
          <Text style={[styles.muted, { color: theme.textSecondary }]}>
            {fi.sessionDetail.noSupplemental}
          </Text>
        ) : (
          supplemental.map((e) => (
            <Row
              key={`sup-${e.id}`}
              title={e.name}
              subtitle={[
                fi.supplemental.kinds[e.kind as SupplementalKind],
                e.sets && e.reps ? `${e.sets}×${e.reps}` : null,
                e.weight ? `${e.weight} kg` : null,
                e.durationSec ? `${Math.round(e.durationSec / 60)} min` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onDelete={() => deleteSupplemental(e.id)}
            />
          ))
        )}

        <View style={{ marginTop: Spacing.four }}>
          <PrimaryButton
            label={fi.sessionDetail.deleteSession}
            onPress={deleteSession}
            variant="danger"
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Row({
  title,
  subtitle,
  onDelete,
  onEdit,
}: {
  title: string;
  subtitle: string;
  onDelete: () => void;
  /** Jos annettu, tekstialueen napautus muokkaa (esim. otetyyppi). */
  onEdit?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <Pressable style={{ flex: 1 }} onPress={onEdit} disabled={!onEdit}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: theme.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8} style={styles.trash}>
        <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  header: { fontSize: 24, fontWeight: '800' },
  sub: { fontSize: 14, marginBottom: Spacing.two },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: Spacing.three },
  muted: { fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 10,
    gap: Spacing.two,
  },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSub: { fontSize: 13, marginTop: 2 },
  trash: { padding: 4 },
});
