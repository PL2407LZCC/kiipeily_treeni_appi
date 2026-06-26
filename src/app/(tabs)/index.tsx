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

import { ClimbTagPrompt } from '@/components/ClimbTagPrompt';
import { Collapsible } from '@/components/Collapsible';
import { GradePicker } from '@/components/GradePicker';
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
import type {
  Discipline,
  HoldType,
  PlanDims,
  PlanTarget,
  SessionEnvironment,
  SessionPlan,
  Steepness,
} from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { fi, holdTypeLabel, steepnessLabel } from '@/i18n/fi';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useActiveSession } from '@/state/activeSession';
import { bumpData } from '@/state/dataVersion';
import { useSettings } from '@/state/settings';

/** Ulottuvuus-suffiksi suunnitelman tavoitteelle/edistymisriville, esim. " · crimpy". */
function planDimSuffix(
  dims: PlanDims | undefined,
  holdType: HoldType | null | undefined,
  steepness: Steepness | null | undefined,
): string {
  const parts: string[] = [];
  if (dims?.holdType) {
    const l = holdTypeLabel(holdType);
    if (l) parts.push(l);
  }
  if (dims?.steepness) {
    const l = steepnessLabel(steepness);
    if (l) parts.push(l);
  }
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

/** Yksilöivä avain suunnitelman tavoitteelle (aste + ulottuvuusarvot). */
function targetChipKey(t: PlanTarget): string {
  return `${t.gradeSystem}:${t.gradeValue}:${t.holdType ?? '∅'}:${t.steepness ?? '∅'}`;
}

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
                  <View style={styles.planTitleRow}>
                    <Text style={[styles.planCardTitle, { color: theme.text }]}>
                      {draftPlan.label}
                    </Text>
                    {draftPlan.mode === 'exact' ? (
                      <View style={[styles.modeBadge, { backgroundColor: theme.text }]}>
                        <Text style={[styles.modeBadgeText, { color: theme.background }]}>
                          {fi.plan.exactBadge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.planTargets}>
                    {draftPlan.targets.map((t) => (
                      <View
                        key={targetChipKey(t)}
                        style={[styles.planChip, { backgroundColor: theme.background }]}>
                        <Text style={[styles.planChipText, { color: theme.text }]}>
                          {t.target}× {t.gradeValue}
                          {planDimSuffix(draftPlan.dims, t.holdType, t.steepness)}
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

        {/* Laji + tila — piilotettu avattavan osion taakse (suunnitelma näkyy
            "Suunnitelman edistyminen" -paneelissa, joten erillistä korttia ei tarvita). */}
        <Collapsible
          title={fi.home.disciplineAndMode}
          summary={`${fi.discipline[active.discipline]} · ${
            active.mode === 'send' ? fi.home.modeSend : fi.home.modeProject
          }`}>
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
        </Collapsible>

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
        trackSteepness={settings.trackSteepness}
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

  // Aktiivisen suunnitelman ulottuvuus-kytkimet (vain jos suunnitelma koskee tätä lajia).
  const planDims = planActive ? plan.dims : undefined;
  const planHasDims = !!(planDims?.holdType || planDims?.steepness);

  // Exact-tila: kova katto. Vain asteet joilla on vielä tilaa näkyvät astevalikossa;
  // täyttyneet poistuvat. Ylitystä/suunnitelman ulkopuolista ei voi ohittaa.
  const planExact = planActive && plan.mode === 'exact';
  const allowedGrades = planExact
    ? [...new Set(progressRows.filter((r) => r.current < r.target).map((r) => r.grade))]
    : undefined;
  const exactComplete = planExact && allowedGrades != null && allowedGrades.length === 0;

  // Efektiiviset seuranta-asetukset: globaali asetus TAI suunnitelman ulottuvuus pakottaa
  // ulottuvuuden kaappauksen tälle sessiolle, vaikka globaali asetus olisi pois.
  const effTrackHoldType = settings.trackHoldType || !!planDims?.holdType;
  const effTrackSteepness = settings.trackSteepness || !!planDims?.steepness;

  // Kirjataanko tageja (otetyyppi ja/tai jyrkkyys)? Jos kyllä, insert lykätään
  // ClimbTagPromptin ratkaisuun asti — tämä korjaa tuplanapautusbugin.
  const tagsTracked = effTrackHoldType || effTrackSteepness;

  // Lykätty kirjaus: odottaa tagien valintaa. Estää myös toisen kirjauksen (early return).
  const [pending, setPending] = useState<{
    kind: 'send' | 'attempt';
    grade: string;
    quantity: number;
  } | null>(null);

  // Varsinaiset insert-rungot: kirjaavat tagit suoraan yhdellä insertillä (ei jälkipäivitystä).
  const doLogSend = (grade: string, quantity: number, holdType: HoldType | null, steepness: Steepness | null) => {
    const id = Sends.addSend({
      sessionId,
      discipline: active.discipline,
      gradeSystem: system,
      gradeValue: grade,
      count: quantity,
      flash: active.flash,
      holdType,
      steepness,
    });
    active.setLastSendId(id);
    if (active.flash) active.toggleFlash();
    tapFeedback();
    bumpData();
  };

  const doLogAttempt = (grade: string, quantity: number, holdType: HoldType | null, steepness: Steepness | null) => {
    const id = AttemptLogs.addAttemptLog({
      sessionId,
      discipline: active.discipline,
      gradeSystem: system,
      gradeValue: grade,
      count: quantity,
      holdType,
      steepness,
    });
    active.setLastAttemptId(id);
    successFeedback(); // erottuva palaute: pitkä painallus rekisteröityi yritykseksi
    bumpData();
  };

  // Enforcement: arvioi ENNEN insertointia. Loose → varoita + salli ohitus;
  // exact → kova katto (estä kokonaan, ei "kirjaa silti"). Palauttaa true jos
  // kirjaus etenee (tai eteni), false jos exact-tila esti sen.
  const confirmThenLog = (verdict: LogVerdict, proceed: () => void): boolean => {
    if (verdict === 'ok') {
      proceed();
      return true;
    }
    const title = verdict === 'over' ? fi.plan.overTitle : fi.plan.offPlanTitle;
    if (planExact) {
      const message = verdict === 'over' ? fi.plan.overMsgExact : fi.plan.offPlanMsgExact;
      tapFeedback();
      Alert.alert(title, message, [{ text: fi.common.ok }]);
      return false;
    }
    const message = verdict === 'over' ? fi.plan.overMsg : fi.plan.offPlanMsg;
    Alert.alert(title, message, [
      { text: fi.common.cancel, style: 'cancel' },
      { text: fi.plan.logAnyway, onPress: proceed },
    ]);
    return true;
  };

  // Exact-tilassa: onko (aste, otetyyppi, jyrkkyys) -variantti vielä auki (evaluateLog 'ok')?
  // Käytetään promptin painikkeiden estoon yhden ulottuvuuden tap-tiloissa.
  const variantOpen = (grade: string, holdType: HoldType | null, steepness: Steepness | null): boolean => {
    if (!planActive) return true;
    return (
      evaluateLog(plan, efforts, active.discipline, system, system, grade, 1, holdType, steepness) ===
      'ok'
    );
  };

  // Aloita kirjaus: grade-only-suunnitelmassa enforcement arvioidaan jo tässä (aste tiedossa);
  // ulottuvuus-suunnitelmassa enforcement siirtyy committiin, koska otetyyppi/jyrkkyys
  // selviävät vasta ClimbTagPromptista.
  const beginLog = (kind: 'send' | 'attempt', grade: string) => {
    if (pending != null) return; // prompti auki → estä toinen kirjaus
    const start = () => {
      if (tagsTracked) {
        // Lykkää insert; nollaa määrä heti, jotta stepper tyhjenee.
        setPending({ kind, grade, quantity: active.quantity });
        active.setQuantity(1);
      } else {
        if (kind === 'send') doLogSend(grade, active.quantity, null, null);
        else doLogAttempt(grade, active.quantity, null, null);
        active.setQuantity(1);
      }
    };

    if (planActive && !planHasDims) {
      // Grade-only: arvioi heti astenapautuksessa (kuten ennen).
      const verdict = evaluateLog(
        plan,
        efforts,
        active.discipline,
        system,
        system,
        grade,
        active.quantity,
      );
      confirmThenLog(verdict, start);
    } else {
      // Ei suunnitelmaa, tai ulottuvuus-suunnitelma (arvio committiin).
      start();
    }
  };

  const logSend = (grade: string) => beginLog('send', grade);
  const logAttempt = (grade: string) => beginLog('attempt', grade);

  // ClimbTagPrompt ratkesi: kirjaa lykätty rivi valituilla tageilla. Ulottuvuus-suunnitelmassa
  // enforcement arvioidaan vasta nyt (otetyyppi/jyrkkyys tiedossa) ennen DB-insertiä.
  const commitTags = (holdType: HoldType | null, steepness: Steepness | null) => {
    if (!pending) return;
    const p = pending;
    const proceed = () => {
      if (p.kind === 'send') {
        doLogSend(p.grade, p.quantity, holdType, steepness);
      } else {
        doLogAttempt(p.grade, p.quantity, holdType, steepness);
      }
    };
    setPending(null);

    if (planActive && planHasDims) {
      const verdict = evaluateLog(
        plan,
        efforts,
        active.discipline,
        system,
        system,
        p.grade,
        p.quantity,
        holdType,
        steepness,
      );
      confirmThenLog(verdict, proceed);
    } else {
      proceed();
    }
  };

  const cancelTags = () => setPending(null); // ei kirjata mitään

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
              const dimSuffix = planDimSuffix(planDims, r.holdType, r.steepness);
              return (
                <View
                  key={`${r.grade}:${r.holdType ?? '∅'}:${r.steepness ?? '∅'}`}
                  style={styles.progressRow}>
                  <Ionicons
                    name={
                      over ? 'alert-circle' : met ? 'checkmark-circle' : 'ellipse-outline'
                    }
                    size={16}
                    color={tint}
                  />
                  <Text style={[styles.progressGrade, { color: theme.text }]}>
                    {r.grade}
                    {dimSuffix}
                  </Text>
                  <Text style={[styles.progressCount, { color: tint }]}>
                    {r.current}/{r.target}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {exactComplete ? (
        <Text style={[styles.hint, { color: '#2ecc71', fontWeight: '700' }]}>
          {fi.plan.exactComplete}
        </Text>
      ) : (
        <>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{fi.home.tapToLog}</Text>
          <GradePicker
            system={system}
            secondarySystem={secondarySystem}
            showSecondary={settings.showSecondaryGrade}
            onPick={logSend}
            onLongPress={logAttempt}
            longPressDelayMs={ATTEMPT_LONG_PRESS_MS}
            allowedGrades={allowedGrades}
          />
        </>
      )}

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
              {steepnessLabel(s.steepness) ? ` · ${steepnessLabel(s.steepness)}` : ''}
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
                {steepnessLabel(a.steepness) ? ` · ${steepnessLabel(a.steepness)}` : ''}
              </Text>
              <Pressable onPress={() => removeAttempt(a.id)} hitSlop={8} style={styles.trash}>
                <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
          ))}
        </>
      ) : null}

      <ClimbTagPrompt
        visible={pending != null}
        trackHoldType={effTrackHoldType}
        trackSteepness={effTrackSteepness}
        onCommit={commitTags}
        onCancel={cancelTags}
        isHoldTypeOpen={
          planExact && pending != null && effTrackHoldType && !effTrackSteepness
            ? (h) => variantOpen(pending.grade, h, null)
            : undefined
        }
        isSteepnessOpen={
          planExact && pending != null && effTrackSteepness && !effTrackHoldType
            ? (s) => variantOpen(pending.grade, null, s)
            : undefined
        }
      />
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
      // Projektin yritykset perivät ulottuvuudet projektilta; ne huomioidaan vain jos
      // suunnitelma seuraa kyseistä ulottuvuutta (evaluateLog ohittaa ne muuten).
      const verdict = evaluateLog(
        plan,
        efforts,
        selected.discipline,
        dispSys,
        selected.gradeSystem,
        selected.gradeValue,
        by,
        selected.holdType,
        selected.steepness,
      );
      if (verdict !== 'ok') {
        const title = verdict === 'over' ? fi.plan.overTitle : fi.plan.offPlanTitle;
        if (plan.mode === 'exact') {
          // Kova katto: ei "kirjaa silti".
          const message = verdict === 'over' ? fi.plan.overMsgExact : fi.plan.offPlanMsgExact;
          tapFeedback();
          Alert.alert(title, message, [{ text: fi.common.ok }]);
          return;
        }
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
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  planCardTitle: { fontSize: 15, fontWeight: '700' },
  modeBadge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 8 },
  modeBadgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
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
