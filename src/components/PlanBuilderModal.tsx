import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { Plans, Sessions } from '@/db/repositories';
import { formatDateFi } from '@/domain/dates';
import { gradeIndex } from '@/domain/grades';
import { buildPlanTargets } from '@/domain/plan';
import type {
  Discipline,
  GradeSystem,
  PlanTarget,
  SessionEnvironment,
  SessionPlan,
  TrainingPlanTemplate,
} from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { bumpData } from '@/state/dataVersion';
import { GradePicker } from './GradePicker';
import { PrimaryButton } from './PrimaryButton';
import { SegmentedControl } from './SegmentedControl';
import { Stepper } from './Stepper';

interface PlanBuilderModalProps {
  visible: boolean;
  theme: string | null;
  environment: SessionEnvironment | null;
  /** Pohjasessioiden alaraja (ISO-päivä) — esim. 4 viikkoa taaksepäin. */
  sinceDate: string;
  onClose: () => void;
  onUse: (plan: SessionPlan) => void;
}

/** Volyymi-% säädetään 2 %:n askelin; grade shift yhden asteen askelin. */
const VOLUME_STEP = 2;
const VOLUME_MIN = -50;
const VOLUME_MAX = 100;
const GRADE_SHIFT_MIN = -3;
const GRADE_SHIFT_MAX = 3;

type Source = 'session' | 'template';

/** Sport jos KAIKKI tavoitteet ovat french-asteikolla; muuten boulder (font/v). */
function disciplineForTargets(targets: PlanTarget[]): Discipline {
  return targets.length > 0 && targets.every((t) => t.gradeSystem === 'french')
    ? 'sport'
    : 'boulder';
}

export function PlanBuilderModal({
  visible,
  theme,
  environment,
  sinceDate,
  onClose,
  onUse,
}: PlanBuilderModalProps) {
  const colors = useTheme();
  const [source, setSource] = useState<Source>('session');
  const [baselineId, setBaselineId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [volumePct, setVolumePct] = useState(0);
  const [gradeShift, setGradeShift] = useState(0);
  const [templateName, setTemplateName] = useState('');

  // Pohjasessiot luetaan kun modaali on auki (kevyt synkroninen kysely).
  const baselines = useMemo(
    () => (visible ? Sessions.listSessionsFor({ theme, environment, sinceDate }) : []),
    [visible, theme, environment, sinceDate],
  );

  // Tallennetut mallit (template) reagoivat lisäykseen/poistoon bumpDatan kautta.
  const templates = useDbQuery<TrainingPlanTemplate[]>(
    () => (visible ? Plans.listTemplates() : []),
    [visible],
  );

  const baseline = baselines.find((b) => b.id === baselineId) ?? null;
  const template = templates.find((t) => t.id === templateId) ?? null;

  // Lähteen + muokkaimien tuottamat lähtötavoitteet: session → buildPlanTargets,
  // template → mallin tallennetut tavoitteet sellaisenaan.
  const derivedTargets = useMemo<PlanTarget[]>(() => {
    if (source === 'template') return template?.targets ?? [];
    if (baselineId == null) return [];
    const efforts = Sessions.sessionEfforts(baselineId);
    return buildPlanTargets(efforts, { volumePct, gradeShift });
  }, [source, template, baselineId, volumePct, gradeShift]);

  // Käsin hienosäädettävä työkopio. Lähde/muokkaimet asettavat lähtöarvot;
  // sen jälkeen jokaista astetta voi säätää +/- erikseen. Muokkaimen muutos
  // palauttaa lähtöarvot (derivedTargets vaihtuu → effect nollaa).
  const [editedTargets, setEditedTargets] = useState<PlanTarget[]>([]);
  useEffect(() => {
    setEditedTargets(derivedTargets);
  }, [derivedTargets]);

  const finalTargets = editedTargets.filter((t) => t.target > 0);

  const [showGradePicker, setShowGradePicker] = useState(false);

  // Asteikko uuden asteen lisäykselle: yleisin nykyisten tavoitteiden järjestelmä.
  const primarySystem = useMemo<GradeSystem>(() => {
    const counts = new Map<GradeSystem, number>();
    for (const t of editedTargets) counts.set(t.gradeSystem, (counts.get(t.gradeSystem) ?? 0) + 1);
    let best: GradeSystem = 'font';
    let bestN = -1;
    for (const [s, n] of counts) {
      if (n > bestN) {
        best = s;
        bestN = n;
      }
    }
    return best;
  }, [editedTargets]);

  const adjustTarget = (t: PlanTarget, delta: number) => {
    setEditedTargets((prev) =>
      prev.map((x) =>
        x.gradeSystem === t.gradeSystem && x.gradeValue === t.gradeValue
          ? { ...x, target: Math.max(0, x.target + delta) }
          : x,
      ),
    );
  };

  /** Lisää (tai kasvata) aste, jota pohjasessiossa ei ollut. Lajitellaan vaikeuden mukaan. */
  const addGrade = (gradeValue: string) => {
    setEditedTargets((prev) => {
      const exists = prev.some(
        (t) => t.gradeSystem === primarySystem && t.gradeValue === gradeValue,
      );
      const next = exists
        ? prev.map((t) =>
            t.gradeSystem === primarySystem && t.gradeValue === gradeValue
              ? { ...t, target: t.target + 1 }
              : t,
          )
        : [...prev, { gradeSystem: primarySystem, gradeValue, target: 1 }];
      return [...next].sort((a, b) =>
        a.gradeSystem === b.gradeSystem
          ? gradeIndex(a.gradeValue, a.gradeSystem) - gradeIndex(b.gradeValue, b.gradeSystem)
          : a.gradeSystem.localeCompare(b.gradeSystem),
      );
    });
  };

  const reset = () => {
    setSource('session');
    setBaselineId(null);
    setTemplateId(null);
    setVolumePct(0);
    setGradeShift(0);
    setTemplateName('');
    setEditedTargets([]);
    setShowGradePicker(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const use = () => {
    if (finalTargets.length === 0) return;
    if (source === 'template' && template != null) {
      onUse({
        discipline: template.discipline,
        label: template.name,
        sourceSessionId: null,
        modifier: {},
        targets: finalTargets,
      });
      close();
      return;
    }
    if (baseline != null) {
      const label = `${baseline.theme ?? fi.home.noTheme} · ${formatDateFi(baseline.date)}`;
      onUse({
        discipline: disciplineForTargets(finalTargets),
        label,
        sourceSessionId: baseline.id,
        modifier: {
          ...(volumePct !== 0 ? { volumePct } : {}),
          ...(gradeShift !== 0 ? { gradeShift } : {}),
        },
        targets: finalTargets,
      });
      close();
    }
  };

  const saveTemplate = () => {
    if (finalTargets.length === 0) return;
    const id = Plans.addTemplate({
      name: templateName,
      discipline: disciplineForTargets(finalTargets),
      theme,
      environment,
      targets: finalTargets,
    });
    if (id != null) {
      setTemplateName('');
      bumpData();
      Alert.alert(fi.plan.templateSaved);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{fi.plan.title}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{fi.plan.sourceLabel}</Text>
          <SegmentedControl<Source>
            segments={[
              { value: 'session', label: fi.plan.sourceFromSession },
              { value: 'template', label: fi.plan.sourceFromTemplate },
            ]}
            value={source}
            onChange={setSource}
          />

          {source === 'session' ? (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {fi.plan.pickBaseline}
              </Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {fi.plan.baselineHint}
              </Text>

              {baselines.length === 0 ? (
                <Text style={[styles.muted, { color: colors.textSecondary }]}>
                  {fi.plan.noBaselines}
                </Text>
              ) : (
                baselines.map((s) => {
                  const sel = s.id === baselineId;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setBaselineId(s.id)}
                      style={[
                        styles.row,
                        { backgroundColor: sel ? colors.text : colors.backgroundElement },
                      ]}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.rowTitle, { color: sel ? colors.background : colors.text }]}>
                          {formatDateFi(s.date)}
                          {s.location ? ` · ${s.location}` : ''}
                        </Text>
                        <Text
                          style={[
                            styles.rowMeta,
                            { color: sel ? colors.background : colors.textSecondary },
                          ]}>
                          {s.theme ?? fi.home.noTheme}
                        </Text>
                      </View>
                      {sel ? <Ionicons name="checkmark" size={20} color={colors.background} /> : null}
                    </Pressable>
                  );
                })
              )}

              {baselineId != null ? (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {fi.plan.modifiers}
                  </Text>
                  <View style={styles.modRow}>
                    <Stepper
                      value={volumePct}
                      onChange={setVolumePct}
                      min={VOLUME_MIN}
                      max={VOLUME_MAX}
                      step={VOLUME_STEP}
                      label={fi.plan.volumeLabel}
                    />
                    <Stepper
                      value={gradeShift}
                      onChange={setGradeShift}
                      min={GRADE_SHIFT_MIN}
                      max={GRADE_SHIFT_MAX}
                      label={fi.plan.gradeShiftLabel}
                    />
                  </View>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {fi.plan.pickTemplate}
              </Text>
              {templates.length === 0 ? (
                <Text style={[styles.muted, { color: colors.textSecondary }]}>
                  {fi.plan.noTemplates}
                </Text>
              ) : (
                templates.map((t) => {
                  const sel = t.id === templateId;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setTemplateId(t.id)}
                      style={[
                        styles.row,
                        { backgroundColor: sel ? colors.text : colors.backgroundElement },
                      ]}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.rowTitle, { color: sel ? colors.background : colors.text }]}>
                          {t.name}
                        </Text>
                        <Text
                          style={[
                            styles.rowMeta,
                            { color: sel ? colors.background : colors.textSecondary },
                          ]}>
                          {t.targets.length} {fi.plan.preview.toLowerCase()}
                        </Text>
                      </View>
                      {sel ? <Ionicons name="checkmark" size={20} color={colors.background} /> : null}
                    </Pressable>
                  );
                })
              )}
            </>
          )}

          {editedTargets.length > 0 ? (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{fi.plan.preview}</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {fi.plan.targetsEditHint}
              </Text>
              {editedTargets.map((t) => (
                <View
                  key={`${t.gradeSystem}:${t.gradeValue}`}
                  style={[styles.targetRow, { backgroundColor: colors.backgroundElement }]}>
                  <Text style={[styles.targetGrade, { color: colors.text }]}>{t.gradeValue}</Text>
                  <View style={styles.targetEdit}>
                    <Pressable
                      onPress={() => adjustTarget(t, -1)}
                      disabled={t.target <= 0}
                      style={[
                        styles.stepBtn,
                        { backgroundColor: colors.background, opacity: t.target <= 0 ? 0.4 : 1 },
                      ]}>
                      <Text style={[styles.stepText, { color: colors.text }]}>−</Text>
                    </Pressable>
                    <Text style={[styles.targetCount, { color: colors.text }]}>{t.target}×</Text>
                    <Pressable
                      onPress={() => adjustTarget(t, 1)}
                      style={[styles.stepBtn, { backgroundColor: colors.background }]}>
                      <Text style={[styles.stepText, { color: colors.text }]}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ))}

              <Pressable
                onPress={() => setShowGradePicker((s) => !s)}
                style={styles.addGradeBtn}>
                <Ionicons name={showGradePicker ? 'remove' : 'add'} size={18} color={colors.text} />
                <Text style={[styles.addGradeText, { color: colors.text }]}>{fi.plan.addGrade}</Text>
              </Pressable>
              {showGradePicker ? (
                <GradePicker system={primarySystem} onPick={addGrade} />
              ) : null}

              {/* Tallenna nykyinen suunnitelma uudelleenkäytettävänä mallina. */}
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {fi.plan.saveAsTemplate}
              </Text>
              <View style={styles.addRow}>
                <TextInput
                  value={templateName}
                  onChangeText={setTemplateName}
                  placeholder={fi.plan.saveTemplatePlaceholder}
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    styles.input,
                    { color: colors.text, backgroundColor: colors.backgroundElement },
                  ]}
                  onSubmitEditing={saveTemplate}
                  returnKeyType="done"
                />
                <PrimaryButton
                  label={fi.plan.saveTemplate}
                  onPress={saveTemplate}
                  variant="secondary"
                  disabled={templateName.trim().length === 0 || finalTargets.length === 0}
                />
              </View>
            </>
          ) : source === 'session' && baselineId != null ? (
            <Text style={[styles.muted, { color: colors.textSecondary }]}>
              {fi.plan.previewEmpty}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton label={fi.common.cancel} onPress={close} variant="secondary" flex />
          <PrimaryButton label={fi.plan.use} onPress={use} disabled={finalTargets.length === 0} flex />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: Spacing.three, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  body: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  label: { fontSize: 13, fontWeight: '600', marginTop: Spacing.two },
  hint: { fontSize: 12 },
  muted: { fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 10,
  },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowMeta: { fontSize: 13 },
  modRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: Spacing.two },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: 10,
  },
  targetGrade: { fontSize: 16, fontWeight: '700' },
  targetEdit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, fontWeight: '700', lineHeight: 24 },
  targetCount: { fontSize: 16, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  addGradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    marginTop: Spacing.one,
  },
  addGradeText: { fontSize: 14, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', marginTop: Spacing.two },
  input: { flex: 1, borderRadius: 10, padding: Spacing.three, fontSize: 16 },
  footer: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
});
