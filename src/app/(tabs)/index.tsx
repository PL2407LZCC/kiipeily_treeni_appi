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
import { HoldTypePrompt } from '@/components/HoldTypePrompt';
import { NewProjectModal } from '@/components/NewProjectModal';
import { PlanBuilderModal } from '@/components/PlanBuilderModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Stepper } from '@/components/Stepper';
import { SupplementalModal } from '@/components/SupplementalModal';
import { ThemePicker } from '@/components/ThemePicker';
import { Spacing } from '@/constants/theme';
import { AttemptLogs, Attempts, Projects, Sends, Sessions, Themes } from '@/db/repositories';
import { daysAgoIso, formatDateFi, formatTimeFi } from '@/domain/dates';
import { evaluateLog, planProgress, type LogVerdict } from '@/domain/planProgress';
import type { Discipline, HoldType, SessionEnvironment, SessionPlan } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { fi, holdTypeLabel } from '@/i18n/fi';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useActiveSession } from '@/state/activeSession';
import { bumpData } from '@/state/dataVersion';
import { useSettings } from '@/state/settings';

export default function HomeScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const active = useActiveSession();

  const [startLocation, setStartLocation] = useState('');
  const [startTheme, setStartTheme] = useState<string | null>(null);
  const [startEnvironment, setStartEnvironment] = useState<SessionEnvironment | 'none'>('none');
  const [draftPlan, setDraftPlan] = useState<SessionPlan | null>(null);
  const [planModal, setPlanModal] = useState(false);
  const [projectModal, setProjectModal] = useState(false);
  const [supplementalModal, setSupplementalModal] = useState(false);

  const session = useDbQuery(() => Sessions.getActiveSession(), []);
  const sessionId = session?.id ?? null;
  const themes = useDbQuery(() => Themes.listThemes(), []);
  const activePlan = useDbQuery(
    () => (sessionId != null ? Sessions.getSessionPlan(sessionId) : null),
    [sessionId],
  );

  // Alusta boulderoinnin näyttöasteikko asetusten oletuksesta.
  useEffect(() => {
    if (settings.loaded) active.setBoulderDisplaySystem(settings.boulderDefaultSystem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.loaded]);

  // Plan-osio näkyy vasta kun teema + ympäristö on valittu; pohjasessiot viim. 4 vk.
  const planReady = startTheme != null && startEnvironment !== 'none';
  const PLAN_BASELINE_DAYS = 28;

  const startSession = () => {
    const id = Sessions.startSession({
      location: startLocation,
      theme: startTheme,
      environment: startEnvironment === 'none' ? null : startEnvironment,
    });
    if (draftPlan) Sessions.setSessionPlan(id, draftPlan);
    setStartLocation('');
    setStartTheme(null);
    setStartEnvironment('none');
    setDraftPlan(null);
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
        <ScrollView contentContainerStyle={styles.startWrap} keyboardShouldPersistTaps="handled">
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

          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            {fi.home.themeLabel}
          </Text>
          <ThemePicker
            value={startTheme}
            options={themes.map((t) => t.name)}
            placeholder={fi.home.themePlaceholder}
            noneLabel={fi.home.noTheme}
            onChange={(v) => {
              setStartTheme(v);
              setDraftPlan(null); // valinnan muuttuessa pohjasessio ei enää päde
            }}
          />

          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            {fi.home.environmentLabel}
          </Text>
          <SegmentedControl<SessionEnvironment | 'none'>
            segments={[
              { value: 'indoor', label: fi.environment.indoor },
              { value: 'outdoor', label: fi.environment.outdoor },
              { value: 'none', label: fi.common.none },
            ]}
            value={startEnvironment}
            onChange={(v) => {
              setStartEnvironment(v);
              setDraftPlan(null);
            }}
          />

          {planReady ? (
            <>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {fi.plan.sectionLabel}
              </Text>
              {draftPlan ? (
                <View style={[styles.planCard, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={[styles.planCardTitle, { color: theme.text }]}>{draftPlan.label}</Text>
                  <View style={styles.planTargets}>
                    {draftPlan.targets.map((t) => (
                      <View
                        key={`${t.gradeSystem}:${t.gradeValue}`}
                        style={[styles.planChip, { backgroundColor: theme.background }]}>
                        <Text style={[styles.planChipText, { color: theme.text }]}>
                          {t.target}× {t.gradeValue}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.planActions}>
                    <PrimaryButton
                      label={fi.plan.edit}
                      onPress={() => setPlanModal(true)}
                      variant="secondary"
                      flex
                    />
                    <PrimaryButton
                      label={fi.plan.remove}
                      onPress={() => setDraftPlan(null)}
                      variant="secondary"
                      flex
                    />
                  </View>
                </View>
              ) : (
                <PrimaryButton
                  label={fi.plan.build}
                  onPress={() => setPlanModal(true)}
                  variant="secondary"
                />
              )}
            </>
          ) : null}

          <PrimaryButton label={fi.home.startSession} onPress={startSession} />
        </ScrollView>

        <PlanBuilderModal
          visible={planModal}
          theme={startTheme}
          environment={startEnvironment === 'none' ? null : startEnvironment}
          sinceDate={daysAgoIso(PLAN_BASELINE_DAYS)}
          onClose={() => setPlanModal(false)}
          onUse={(plan) => {
            setDraftPlan(plan);
            setPlanModal(false);
          }}
        />
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

        {/* Treenisuunnitelma (read-only) — vain jos sessiolle on tallennettu suunnitelma */}
        {activePlan && activePlan.targets.length > 0 ? (
          <View style={[styles.planCard, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.planCardTitle, { color: theme.text }]}>
              {fi.plan.activeTitle}
            </Text>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>{activePlan.label}</Text>
            <View style={styles.planTargets}>
              {activePlan.targets.map((t) => (
                <View
                  key={`${t.gradeSystem}:${t.gradeValue}`}
                  style={[styles.planChip, { backgroundColor: theme.background }]}>
                  <Text style={[styles.planChipText, { color: theme.text }]}>
                    {t.target}× {t.gradeValue}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

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
        trackHoldType={settings.trackHoldType}
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

/**
 * Pitkän painalluksen viive astenapille (irrallisen yrityksen kirjaus).
 * Tahallisen tuntuinen mutta ei turhan kankea; säädä tästä yhdestä paikasta.
 */
const ATTEMPT_LONG_PRESS_MS = 800;

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
  const attempts = useDbQuery(() => AttemptLogs.listAttemptLogsForSession(sessionId), [sessionId]);

  // Suunnitelma + session efforts (reaktiivinen: päivittyy bumpData()n jälkeen).
  const plan = useDbQuery(() => Sessions.getSessionPlan(sessionId), [sessionId]);
  const efforts = useDbQuery(() => Sessions.sessionEfforts(sessionId), [sessionId]);
  const planActive = plan != null && plan.discipline === active.discipline;
  const progressRows = planActive ? planProgress(plan, efforts, system) : [];

  // Otetyypin valinta kirjauksen jälkeen (vain jos asetus päällä).
  const [pendingHoldType, setPendingHoldType] = useState<{
    kind: 'send' | 'attempt';
    id: number;
  } | null>(null);

  // Varsinaiset insert-rungot (kutsutaan vasta kun enforcement on läpäisty).
  const doLogSend = (grade: string) => {
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
    if (settings.trackHoldType) setPendingHoldType({ kind: 'send', id });
  };

  const doLogAttempt = (grade: string) => {
    const id = AttemptLogs.addAttemptLog({
      sessionId,
      discipline: active.discipline,
      gradeSystem: system,
      gradeValue: grade,
      count: active.quantity,
    });
    active.setLastAttemptId(id);
    active.setQuantity(1);
    successFeedback(); // erottuva palaute: pitkä painallus rekisteröityi yritykseksi
    bumpData();
    if (settings.trackHoldType) setPendingHoldType({ kind: 'attempt', id });
  };

  // Pehmeä enforcement: arvioi ENNEN insertointia; varoita + salli ohitus.
  const confirmThenLog = (verdict: LogVerdict, proceed: () => void) => {
    if (verdict === 'ok') {
      proceed();
      return;
    }
    const title = verdict === 'over' ? fi.plan.overTitle : fi.plan.offPlanTitle;
    const message = verdict === 'over' ? fi.plan.overMsg : fi.plan.offPlanMsg;
    Alert.alert(title, message, [
      { text: fi.common.cancel, style: 'cancel' },
      { text: fi.plan.logAnyway, onPress: proceed },
    ]);
  };

  const logSend = (grade: string) => {
    const verdict = planActive
      ? evaluateLog(plan, efforts, active.discipline, system, system, grade, active.quantity)
      : 'ok';
    confirmThenLog(verdict, () => doLogSend(grade));
  };

  const logAttempt = (grade: string) => {
    const verdict = planActive
      ? evaluateLog(plan, efforts, active.discipline, system, system, grade, active.quantity)
      : 'ok';
    confirmThenLog(verdict, () => doLogAttempt(grade));
  };

  const chooseHoldType = (holdType: HoldType | null) => {
    if (!pendingHoldType) return;
    if (holdType != null) {
      if (pendingHoldType.kind === 'send') {
        Sends.updateSend(pendingHoldType.id, { holdType });
      } else {
        AttemptLogs.updateAttemptLog(pendingHoldType.id, { holdType });
      }
      bumpData();
    }
    setPendingHoldType(null);
  };

  const undo = () => {
    if (active.lastSendId == null) return;
    Sends.deleteSend(active.lastSendId);
    active.setLastSendId(null);
    bumpData();
  };

  const undoAttempt = () => {
    if (active.lastAttemptId == null) return;
    AttemptLogs.deleteAttemptLog(active.lastAttemptId);
    active.setLastAttemptId(null);
    bumpData();
  };

  const remove = (id: number) => {
    Sends.deleteSend(id);
    if (active.lastSendId === id) active.setLastSendId(null);
    bumpData();
  };

  const removeAttempt = (id: number) => {
    AttemptLogs.deleteAttemptLog(id);
    if (active.lastAttemptId === id) active.setLastAttemptId(null);
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

      {planActive && progressRows.length > 0 ? (
        <View style={[styles.progressPanel, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.progressTitle, { color: theme.text }]}>
            {fi.plan.progressTitle}
          </Text>
          <View style={styles.progressRows}>
            {progressRows.map((r) => {
              const met = r.current >= r.target;
              const over = r.current > r.target;
              const tint = over ? '#e67e22' : met ? '#2ecc71' : theme.textSecondary;
              return (
                <View key={r.grade} style={styles.progressRow}>
                  <Ionicons
                    name={
                      over ? 'alert-circle' : met ? 'checkmark-circle' : 'ellipse-outline'
                    }
                    size={16}
                    color={tint}
                  />
                  <Text style={[styles.progressGrade, { color: theme.text }]}>{r.grade}</Text>
                  <Text style={[styles.progressCount, { color: tint }]}>
                    {r.current}/{r.target}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <Text style={[styles.hint, { color: theme.textSecondary }]}>{fi.home.tapToLog}</Text>
      <GradePicker
        system={system}
        secondarySystem={secondarySystem}
        showSecondary={settings.showSecondaryGrade}
        onPick={logSend}
        onLongPress={logAttempt}
        longPressDelayMs={ATTEMPT_LONG_PRESS_MS}
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
              {holdTypeLabel(s.holdType) ? ` · ${holdTypeLabel(s.holdType)}` : ''}
            </Text>
            <Pressable onPress={() => remove(s.id)} hitSlop={8} style={styles.trash}>
              <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        ))
      )}

      {attempts.length > 0 ? (
        <>
          <View style={styles.listHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {fi.home.loggedAttempts}
            </Text>
            {active.lastAttemptId != null ? (
              <Pressable onPress={undoAttempt} style={styles.undoBtn}>
                <Ionicons name="arrow-undo" size={16} color={theme.text} />
                <Text style={[styles.undoText, { color: theme.text }]}>{fi.home.undoLast}</Text>
              </Pressable>
            ) : null}
          </View>
          {attempts.map((a) => (
            <View
              key={a.id}
              style={[styles.entryRow, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="ellipse-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.entryGrade, { color: theme.text }]}>
                {a.count > 1 ? `${a.count}× ` : ''}
                {a.gradeValue}
              </Text>
              <Text style={[styles.entryMeta, { color: theme.textSecondary }]}>
                {fi.discipline[a.discipline as Discipline]}
                {holdTypeLabel(a.holdType) ? ` · ${holdTypeLabel(a.holdType)}` : ''}
              </Text>
              <Pressable onPress={() => removeAttempt(a.id)} hitSlop={8} style={styles.trash}>
                <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
          ))}
        </>
      ) : null}

      <HoldTypePrompt visible={pendingHoldType != null} onChoose={chooseHoldType} />
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

  // Suunnitelma + session efforts pehmeää enforcementtia varten (vain +1).
  const plan = useDbQuery(() => Sessions.getSessionPlan(sessionId), [sessionId]);
  const efforts = useDbQuery(() => Sessions.sessionEfforts(sessionId), [sessionId]);

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

  const doAddAttempt = (by: number) => {
    if (selectedId == null) return;
    Attempts.addAttempts(selectedId, sessionId, by);
    tapFeedback();
    bumpData();
  };

  const addAttempt = (by: number) => {
    if (selectedId == null) return;
    // Enforcement vain lisättäessä (+1) ja vain jos suunnitelma koskee tätä lajia.
    if (by > 0 && selected && plan != null && plan.discipline === selected.discipline) {
      const dispSys = selected.discipline === 'sport' ? 'french' : active.boulderDisplaySystem;
      const verdict = evaluateLog(
        plan,
        efforts,
        selected.discipline,
        dispSys,
        selected.gradeSystem,
        selected.gradeValue,
        by,
      );
      if (verdict !== 'ok') {
        const title = verdict === 'over' ? fi.plan.overTitle : fi.plan.offPlanTitle;
        const message = verdict === 'over' ? fi.plan.overMsg : fi.plan.offPlanMsg;
        Alert.alert(title, message, [
          { text: fi.common.cancel, style: 'cancel' },
          { text: fi.plan.logAnyway, onPress: () => doAddAttempt(by) },
        ]);
        return;
      }
    }
    doAddAttempt(by);
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
  startWrap: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: 24, fontWeight: '800' },
  muted: { fontSize: 14 },
  input: { borderRadius: 10, padding: Spacing.three, fontSize: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: Spacing.two },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  planCard: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  planCardTitle: { fontSize: 15, fontWeight: '700' },
  planTargets: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  planChip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 10 },
  planChipText: { fontSize: 14, fontWeight: '700' },
  planActions: { flexDirection: 'row', gap: Spacing.two },
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
  progressPanel: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  progressTitle: { fontSize: 14, fontWeight: '700' },
  progressRows: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressGrade: { fontSize: 14, fontWeight: '700' },
  progressCount: { fontSize: 14, fontWeight: '700' },
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
