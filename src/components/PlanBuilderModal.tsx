import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { Sessions } from '@/db/repositories';
import { formatDateFi } from '@/domain/dates';
import { buildPlanTargets } from '@/domain/plan';
import type { SessionEnvironment, SessionPlan } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { PrimaryButton } from './PrimaryButton';
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

export function PlanBuilderModal({
  visible,
  theme,
  environment,
  sinceDate,
  onClose,
  onUse,
}: PlanBuilderModalProps) {
  const colors = useTheme();
  const [baselineId, setBaselineId] = useState<number | null>(null);
  const [volumePct, setVolumePct] = useState(0);
  const [gradeShift, setGradeShift] = useState(0);

  // Pohjasessiot luetaan kun modaali on auki (kevyt synkroninen kysely).
  const baselines = useMemo(
    () => (visible ? Sessions.listSessionsFor({ theme, environment, sinceDate }) : []),
    [visible, theme, environment, sinceDate],
  );

  const targets = useMemo(() => {
    if (baselineId == null) return [];
    const efforts = Sessions.sessionEfforts(baselineId);
    return buildPlanTargets(efforts, { volumePct, gradeShift });
  }, [baselineId, volumePct, gradeShift]);

  const baseline = baselines.find((b) => b.id === baselineId) ?? null;

  const close = () => {
    setBaselineId(null);
    setVolumePct(0);
    setGradeShift(0);
    onClose();
  };

  const use = () => {
    if (baseline == null || targets.length === 0) return;
    const label = `${baseline.theme ?? fi.home.noTheme} · ${formatDateFi(baseline.date)}`;
    // Sport jos KAIKKI tavoitteet ovat french-asteikolla; muuten boulder (font/v).
    const allFrench = targets.every((t) => t.gradeSystem === 'french');
    const plan: SessionPlan = {
      discipline: allFrench ? 'sport' : 'boulder',
      label,
      sourceSessionId: baseline.id,
      modifier: {
        ...(volumePct !== 0 ? { volumePct } : {}),
        ...(gradeShift !== 0 ? { gradeShift } : {}),
      },
      targets,
    };
    onUse(plan);
    close();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{fi.plan.title}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{fi.plan.pickBaseline}</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>{fi.plan.baselineHint}</Text>

          {baselines.length === 0 ? (
            <Text style={[styles.muted, { color: colors.textSecondary }]}>{fi.plan.noBaselines}</Text>
          ) : (
            baselines.map((s) => {
              const sel = s.id === baselineId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setBaselineId(s.id)}
                  style={[
                    styles.baselineRow,
                    { backgroundColor: sel ? colors.text : colors.backgroundElement },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.baselineDate, { color: sel ? colors.background : colors.text }]}>
                      {formatDateFi(s.date)}
                      {s.location ? ` · ${s.location}` : ''}
                    </Text>
                    <Text
                      style={[
                        styles.baselineMeta,
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
              <Text style={[styles.label, { color: colors.textSecondary }]}>{fi.plan.modifiers}</Text>
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

              <Text style={[styles.label, { color: colors.textSecondary }]}>{fi.plan.preview}</Text>
              {targets.length === 0 ? (
                <Text style={[styles.muted, { color: colors.textSecondary }]}>
                  {fi.plan.previewEmpty}
                </Text>
              ) : (
                targets.map((t) => (
                  <View
                    key={`${t.gradeSystem}:${t.gradeValue}`}
                    style={[styles.targetRow, { backgroundColor: colors.backgroundElement }]}>
                    <Text style={[styles.targetGrade, { color: colors.text }]}>{t.gradeValue}</Text>
                    <Text style={[styles.targetCount, { color: colors.text }]}>{t.target}×</Text>
                  </View>
                ))
              )}
            </>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton label={fi.common.cancel} onPress={close} variant="secondary" flex />
          <PrimaryButton
            label={fi.plan.use}
            onPress={use}
            disabled={baselineId == null || targets.length === 0}
            flex
          />
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
  baselineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 10,
  },
  baselineDate: { fontSize: 15, fontWeight: '700' },
  baselineMeta: { fontSize: 13 },
  modRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: Spacing.two },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: 10,
  },
  targetGrade: { fontSize: 16, fontWeight: '700' },
  targetCount: { fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
});
