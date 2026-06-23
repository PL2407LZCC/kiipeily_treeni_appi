import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradePicker } from '@/components/GradePicker';
import { NewProjectModal } from '@/components/NewProjectModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Stepper } from '@/components/Stepper';
import { SupplementalModal } from '@/components/SupplementalModal';
import { Spacing } from '@/constants/theme';
import { Attempts, Projects, Sends, Sessions } from '@/db/repositories';
import { formatDateFi, formatTimeFi } from '@/domain/dates';
import type { Discipline } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useActiveSession } from '@/state/activeSession';
import { bumpData } from '@/state/dataVersion';
import { useSettings } from '@/state/settings';

export default function HomeScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const active = useActiveSession();

  const [startLocation, setStartLocation] = useState('');
  const [projectModal, setProjectModal] = useState(false);
  const [supplementalModal, setSupplementalModal] = useState(false);

  const session = useDbQuery(() => Sessions.getActiveSession(), []);
  const sessionId = session?.id ?? null;

  // Alusta boulderoinnin näyttöasteikko asetusten oletuksesta.
  useEffect(() => {
    if (settings.loaded) active.setBoulderDisplaySystem(settings.boulderDefaultSystem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.loaded]);

  const startSession = () => {
    Sessions.startSession(startLocation);
    setStartLocation('');
    bumpData();
  };

  const endSession = () => {
    if (!sessionId) return;
    Alert.alert(fi.home.endSession, undefined, [
      { text: fi.common.cancel, style: 'cancel' },
      {
        text: fi.home.endSession,
        style: 'destructive',
        onPress: () => {
          Sessions.endSession(sessionId);
          active.resetLogging();
          bumpData();
        },
      },
    ]);
  };

  if (!session || sessionId == null) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.startWrap}>
          <Text style={[styles.title, { color: theme.text }]}>{fi.home.title}</Text>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>
            {fi.home.noActiveSession}
          </Text>
          <TextInput
            value={startLocation}
            onChangeText={setStartLocation}
            placeholder={fi.home.locationPlaceholder}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <PrimaryButton label={fi.home.startSession} onPress={startSession} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        {/* Session-otsikko */}
        <View style={styles.sessionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>{fi.home.sessionStarted}</Text>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              {formatDateFi(session.date)} · {formatTimeFi(session.startedAt)}
              {session.location ? ` · ${session.location}` : ''}
            </Text>
          </View>
          <Pressable onPress={endSession} style={[styles.endBtn, { borderColor: theme.textSecondary }]}>
            <Text style={[styles.endBtnText, { color: theme.text }]}>{fi.home.endSession}</Text>
          </Pressable>
        </View>

        {/* Laji + tila */}
        <SegmentedControl<Discipline>
          segments={[
            { value: 'boulder', label: fi.discipline.boulder },
            { value: 'sport', label: fi.discipline.sport },
          ]}
          value={active.discipline}
          onChange={active.setDiscipline}
        />
        <SegmentedControl
          large
          segments={[
            { value: 'send', label: fi.home.modeSend },
            { value: 'project', label: fi.home.modeProject },
          ]}
          value={active.mode}
          onChange={(m) => active.setMode(m)}
        />

        {active.mode === 'send' ? (
          <SendMode sessionId={sessionId} />
        ) : (
          <ProjectMode sessionId={sessionId} onNewProject={() => setProjectModal(true)} />
        )}

        <PrimaryButton
          label={fi.home.addSupplemental}
          onPress={() => setSupplementalModal(true)}
          variant="secondary"
        />
      </ScrollView>

      <NewProjectModal
        visible={projectModal}
        onClose={() => setProjectModal(false)}
        onCreated={(id) => {
          setProjectModal(false);
          active.setSelectedProject(id);
          active.setMode('project');
        }}
        boulderSystem={active.boulderDisplaySystem}
        showSecondary={settings.showSecondaryGrade}
      />
      <SupplementalModal
        visible={supplementalModal}
        sessionId={sessionId}
        onClose={() => setSupplementalModal(false)}
      />
    </SafeAreaView>
  );
}

/* ----------------------------- Send-tila ----------------------------- */

function SendMode({ sessionId }: { sessionId: number }) {
  const theme = useTheme();
  const active = useActiveSession();
  const settings = useSettings();

  const system = active.discipline === 'sport' ? 'french' : active.boulderDisplaySystem;
  const secondarySystem =
    active.discipline === 'boulder'
      ? active.boulderDisplaySystem === 'font'
        ? ('v' as const)
        : ('font' as const)
      : undefined;

  const sends = useDbQuery(() => Sends.listSendsForSession(sessionId), [sessionId]);

  const logSend = (grade: string) => {
    const id = Sends.addSend({
      sessionId,
      discipline: active.discipline,
      gradeSystem: system,
      gradeValue: grade,
      count: active.quantity,
      flash: active.flash,
    });
    active.setLastSendId(id);
    active.setQuantity(1);
    if (active.flash) active.toggleFlash();
    tapFeedback();
    bumpData();
  };

  const undo = () => {
    if (active.lastSendId == null) return;
    Sends.deleteSend(active.lastSendId);
    active.setLastSendId(null);
    bumpData();
  };

  const remove = (id: number) => {
    Sends.deleteSend(id);
    if (active.lastSendId === id) active.setLastSendId(null);
    bumpData();
  };

  return (
    <View style={styles.section}>
      {active.discipline === 'boulder' ? (
        <SegmentedControl
          segments={[
            { value: 'font', label: 'Font' },
            { value: 'v', label: 'V' },
          ]}
          value={active.boulderDisplaySystem}
          onChange={active.setBoulderDisplaySystem}
        />
      ) : null}

      <View style={styles.controlsRow}>
        <Stepper value={active.quantity} onChange={active.setQuantity} label={fi.home.quantity} />
        <Pressable
          onPress={active.toggleFlash}
          style={[
            styles.flashBtn,
            { backgroundColor: active.flash ? '#f1c40f' : theme.backgroundElement },
          ]}>
          <Ionicons
            name="flash"
            size={20}
            color={active.flash ? '#000' : theme.textSecondary}
          />
          <Text style={[styles.flashText, { color: active.flash ? '#000' : theme.textSecondary }]}>
            {fi.home.flash}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.hint, { color: theme.textSecondary }]}>{fi.home.tapToLog}</Text>
      <GradePicker
        system={system}
        secondarySystem={secondarySystem}
        showSecondary={settings.showSecondaryGrade}
        onPick={logSend}
      />

      <View style={styles.listHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{fi.home.loggedSends}</Text>
        {active.lastSendId != null ? (
          <Pressable onPress={undo} style={styles.undoBtn}>
            <Ionicons name="arrow-undo" size={16} color={theme.text} />
            <Text style={[styles.undoText, { color: theme.text }]}>{fi.home.undoLast}</Text>
          </Pressable>
        ) : null}
      </View>

      {sends.length === 0 ? (
        <Text style={[styles.muted, { color: theme.textSecondary }]}>{fi.home.noSends}</Text>
      ) : (
        sends.map((s) => (
          <View key={s.id} style={[styles.entryRow, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.entryGrade, { color: theme.text }]}>
              {s.count > 1 ? `${s.count}× ` : ''}
              {s.gradeValue}
            </Text>
            {s.flash ? <Ionicons name="flash" size={16} color="#f1c40f" /> : null}
            <Text style={[styles.entryMeta, { color: theme.textSecondary }]}>
              {fi.discipline[s.discipline as Discipline]}
            </Text>
            <Pressable onPress={() => remove(s.id)} hitSlop={8} style={styles.trash}>
              <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

/* --------------------------- Projecting-tila --------------------------- */

function ProjectMode({
  sessionId,
  onNewProject,
}: {
  sessionId: number;
  onNewProject: () => void;
}) {
  const theme = useTheme();
  const active = useActiveSession();

  const projects = useDbQuery(() => Projects.listActiveProjects(), []);
  const selectedId = active.selectedProjectId;

  // Tyhjennä valinta jos projekti ei enää aktiivisten joukossa.
  useEffect(() => {
    if (selectedId != null && !projects.some((p) => p.id === selectedId)) {
      active.setSelectedProject(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, selectedId]);

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  const sessionAttempt = useDbQuery(
    () => (selectedId != null ? Attempts.getSessionAttempt(selectedId, sessionId) : undefined),
    [selectedId, sessionId],
  );
  const lifetime = useDbQuery(
    () => (selectedId != null ? Attempts.lifetimeAttempts(selectedId) : 0),
    [selectedId],
  );

  const thisSession = sessionAttempt?.attemptCount ?? 0;

  const addAttempt = (by: number) => {
    if (selectedId == null) return;
    Attempts.addAttempts(selectedId, sessionId, by);
    tapFeedback();
    bumpData();
  };

  const markSent = () => {
    if (selectedId == null) return;
    Attempts.markSentInSession(selectedId, sessionId);
    successFeedback();
    active.setSelectedProject(null);
    bumpData();
    Alert.alert(fi.home.projectSent);
  };

  return (
    <View style={styles.section}>
      <View style={styles.listHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{fi.home.selectProject}</Text>
        <Pressable onPress={onNewProject} style={styles.undoBtn}>
          <Ionicons name="add" size={18} color={theme.text} />
          <Text style={[styles.undoText, { color: theme.text }]}>{fi.home.newProject}</Text>
        </Pressable>
      </View>

      {projects.length === 0 ? (
        <Text style={[styles.muted, { color: theme.textSecondary }]}>
          {fi.home.noActiveProjects}
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {projects.map((p) => {
            const sel = p.id === selectedId;
            return (
              <Pressable
                key={p.id}
                onPress={() => active.setSelectedProject(p.id)}
                style={[
                  styles.chip,
                  { backgroundColor: sel ? theme.text : theme.backgroundElement },
                ]}>
                <Text style={[styles.chipGrade, { color: sel ? theme.background : theme.text }]}>
                  {p.gradeValue}
                </Text>
                {p.name ? (
                  <Text
                    style={[styles.chipName, { color: sel ? theme.background : theme.textSecondary }]}
                    numberOfLines={1}>
                    {p.name}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {selected ? (
        <View style={[styles.projectPanel, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.panelGrade, { color: theme.text }]}>
            {selected.gradeValue}
            {selected.name ? ` · ${selected.name}` : ''}
          </Text>
          <View style={styles.counters}>
            <View style={styles.counter}>
              <Text style={[styles.counterNum, { color: theme.text }]}>{thisSession}</Text>
              <Text style={[styles.counterLabel, { color: theme.textSecondary }]}>
                {fi.home.attemptsThisSession}
              </Text>
            </View>
            <View style={styles.counter}>
              <Text style={[styles.counterNum, { color: theme.text }]}>{lifetime}</Text>
              <Text style={[styles.counterLabel, { color: theme.textSecondary }]}>
                {fi.home.attemptsLifetime}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => addAttempt(1)}
            style={[styles.bigAttempt, { backgroundColor: theme.text }]}>
            <Text style={[styles.bigAttemptText, { color: theme.background }]}>
              {fi.home.plusAttempt}
            </Text>
          </Pressable>
          <View style={styles.projectActions}>
            <PrimaryButton
              label={fi.home.minusAttempt}
              onPress={() => addAttempt(-1)}
              variant="secondary"
              flex
            />
            <PrimaryButton label={fi.home.markSent} onPress={markSent} flex />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  startWrap: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: 24, fontWeight: '800' },
  muted: { fontSize: 14 },
  input: { borderRadius: 10, padding: Spacing.three, fontSize: 16 },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  endBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  endBtnText: { fontSize: 14, fontWeight: '700' },
  section: { gap: Spacing.three },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    height: 52,
  },
  flashText: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 13, textAlign: 'center' },
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  undoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  undoText: { fontSize: 14, fontWeight: '600' },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 10,
  },
  entryGrade: { fontSize: 16, fontWeight: '700' },
  entryMeta: { fontSize: 13, flex: 1 },
  trash: { padding: 4 },
  chips: { gap: Spacing.two, paddingVertical: 4 },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 12, minWidth: 64 },
  chipGrade: { fontSize: 18, fontWeight: '800' },
  chipName: { fontSize: 12, maxWidth: 100 },
  projectPanel: { borderRadius: 14, padding: Spacing.three, gap: Spacing.three },
  panelGrade: { fontSize: 18, fontWeight: '700' },
  counters: { flexDirection: 'row', justifyContent: 'space-around' },
  counter: { alignItems: 'center' },
  counterNum: { fontSize: 32, fontWeight: '800' },
  counterLabel: { fontSize: 12 },
  bigAttempt: { borderRadius: 14, paddingVertical: Spacing.four, alignItems: 'center' },
  bigAttemptText: { fontSize: 22, fontWeight: '800' },
  projectActions: { flexDirection: 'row', gap: Spacing.two },
});
