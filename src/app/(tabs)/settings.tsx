import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Collapsible } from '@/components/Collapsible';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Stepper } from '@/components/Stepper';
import { Spacing } from '@/constants/theme';
import { exportBackup, pickAndParseBackup, restoreBackup } from '@/backup/exportImport';
import { Plans, Themes } from '@/db/repositories';
import { nowIso } from '@/domain/dates';
import { gradesFor } from '@/domain/grades';
import type { GradeSystem } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { bumpData } from '@/state/dataVersion';
import { useSettings } from '@/state/settings';

const GRADE_SYSTEM_LABELS: Record<GradeSystem, string> = {
  font: 'Font',
  v: 'V',
  french: 'French',
};

export default function SettingsScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const themes = useDbQuery(() => Themes.listThemes(), []);
  const plans = useDbQuery(() => Plans.listTemplates(), []);
  const [newTheme, setNewTheme] = useState('');

  const removePlan = (id: number) => {
    Plans.deleteTemplate(id);
    bumpData();
  };

  const addTheme = () => {
    const added = Themes.addTheme(newTheme);
    setNewTheme('');
    if (added != null) bumpData();
  };
  const removeTheme = (id: number) => {
    Themes.deleteTheme(id);
    bumpData();
  };

  const doExport = async () => {
    try {
      await exportBackup(nowIso());
    } catch (e) {
      Alert.alert(fi.settings.export, String(e));
    }
  };

  const doImport = () => {
    Alert.alert(fi.settings.import, fi.settings.importConfirm, [
      { text: fi.common.cancel, style: 'cancel' },
      {
        text: fi.settings.import,
        style: 'destructive',
        onPress: async () => {
          try {
            const backup = await pickAndParseBackup();
            if (!backup) return; // peruttu
            restoreBackup(backup);
            settings.load();
            bumpData();
            Alert.alert(fi.settings.importDone);
          } catch {
            Alert.alert(fi.settings.importFailed);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: theme.text }]}>{fi.settings.title}</Text>

        {/* Asteikot */}
        <Text style={[styles.section, { color: theme.textSecondary }]}>{fi.settings.grades}</Text>
        <Text style={[styles.label, { color: theme.text }]}>{fi.settings.boulderDefault}</Text>
        <SegmentedControl<GradeSystem>
          segments={[
            { value: 'font', label: 'Font' },
            { value: 'v', label: 'V' },
          ]}
          value={settings.boulderDefaultSystem}
          onChange={(s) => settings.setBoulderDefaultSystem(s)}
        />
        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: theme.text, flex: 1 }]}>
            {fi.settings.showSecondary}
          </Text>
          <Switch
            value={settings.showSecondaryGrade}
            onValueChange={(v) => settings.setShowSecondaryGrade(v)}
          />
        </View>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: theme.text }]}>{fi.settings.trackHoldType}</Text>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              {fi.settings.trackHoldTypeHint}
            </Text>
          </View>
          <Switch
            value={settings.trackHoldType}
            onValueChange={(v) => settings.setTrackHoldType(v)}
          />
        </View>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: theme.text }]}>{fi.settings.trackSteepness}</Text>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              {fi.settings.trackSteepnessHint}
            </Text>
          </View>
          <Switch
            value={settings.trackSteepness}
            onValueChange={(v) => settings.setTrackSteepness(v)}
          />
        </View>
        <Text style={[styles.label, { color: theme.text, marginTop: Spacing.two }]}>
          {fi.settings.gradeColumns}
        </Text>
        <SegmentedControl<number>
          segments={[
            { value: 3, label: '3' },
            { value: 4, label: '4' },
          ]}
          value={settings.gradeColumns}
          onChange={(n) => settings.setGradeColumns(n)}
        />

        {/* Ajastin */}
        <Text style={[styles.section, { color: theme.textSecondary, marginTop: Spacing.four }]}>
          {fi.settings.timerSection}
        </Text>
        <Stepper
          value={settings.climbTimeSubtractSec}
          onChange={(n) => settings.setClimbTimeSubtractSec(n)}
          min={0}
          max={30}
          step={5}
          label={fi.settings.climbTimeSubtract}
        />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          {fi.settings.climbTimeSubtractHint}
        </Text>

        {/* Näytettävät asteet */}
        <Collapsible title={fi.settings.visibleGrades}>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            {fi.settings.visibleGradesHint}
          </Text>
          {(['font', 'v', 'french'] as GradeSystem[]).map((sys) => {
            const hidden = settings.hiddenGrades[sys] ?? [];
            return (
              <View key={sys} style={styles.gradeScaleBlock}>
                <Text style={[styles.gradeScaleLabel, { color: theme.textSecondary }]}>
                  {GRADE_SYSTEM_LABELS[sys]}
                </Text>
                <View style={styles.gradeChips}>
                  {gradesFor(sys).map((g) => {
                    const isHidden = hidden.includes(g);
                    return (
                      <Pressable
                        key={g}
                        onPress={() => settings.toggleHiddenGrade(sys, g)}
                        style={[
                          styles.gradeChip,
                          {
                            backgroundColor: theme.backgroundElement,
                            opacity: isHidden ? 0.4 : 1,
                          },
                        ]}>
                        <Text
                          style={[
                            styles.gradeChipText,
                            {
                              color: isHidden ? theme.textSecondary : theme.text,
                              textDecorationLine: isHidden ? 'line-through' : 'none',
                            },
                          ]}>
                          {g}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </Collapsible>

        {/* Session teemat */}
        <Collapsible title={fi.settings.themes} summary={String(themes.length)}>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{fi.settings.themesHint}</Text>
          {themes.length === 0 ? (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>{fi.settings.noThemes}</Text>
          ) : (
            themes.map((t) => (
              <View key={t.id} style={[styles.themeRow, { backgroundColor: theme.background }]}>
                <Text style={[styles.label, { color: theme.text, flex: 1 }]}>{t.name}</Text>
                <Pressable onPress={() => removeTheme(t.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
            ))
          )}
          <View style={styles.addRow}>
            <TextInput
              value={newTheme}
              onChangeText={setNewTheme}
              placeholder={fi.settings.addThemePlaceholder}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              onSubmitEditing={addTheme}
              returnKeyType="done"
            />
            <PrimaryButton label={fi.settings.addTheme} onPress={addTheme} />
          </View>
        </Collapsible>

        {/* Treenisuunnitelmat (mallit) */}
        <Text style={[styles.section, { color: theme.textSecondary, marginTop: Spacing.four }]}>
          {fi.settings.plans}
        </Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>{fi.settings.plansHint}</Text>
        {plans.length === 0 ? (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{fi.settings.noPlans}</Text>
        ) : (
          plans.map((p) => (
            <View key={p.id} style={[styles.themeRow, { backgroundColor: theme.backgroundElement }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.text }]}>{p.name}</Text>
                <Text style={[styles.hint, { color: theme.textSecondary }]}>
                  {p.targets.length} {fi.plan.preview.toLowerCase()}
                </Text>
              </View>
              <Pressable onPress={() => removePlan(p.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          ))
        )}

        {/* Varmuuskopiointi */}
        <Text style={[styles.section, { color: theme.textSecondary, marginTop: Spacing.four }]}>
          {fi.settings.backup}
        </Text>
        <PrimaryButton label={fi.settings.export} onPress={doExport} />
        <PrimaryButton label={fi.settings.import} onPress={doImport} variant="secondary" />

        {/* Tietoja */}
        <Text style={[styles.section, { color: theme.textSecondary, marginTop: Spacing.four }]}>
          {fi.settings.about}
        </Text>
        <Text style={[styles.about, { color: theme.textSecondary }]}>{fi.settings.aboutText}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  title: { fontSize: 24, fontWeight: '800' },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginTop: Spacing.two },
  label: { fontSize: 16, fontWeight: '500' },
  hint: { fontSize: 13, marginTop: 2, paddingRight: Spacing.two },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.two },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  input: { flex: 1, borderRadius: 10, padding: Spacing.three, fontSize: 16 },
  addRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', marginTop: Spacing.two },
  about: { fontSize: 14, lineHeight: 20 },
  gradeScaleBlock: { marginTop: Spacing.two },
  gradeScaleLabel: { fontSize: 13, fontWeight: '700', marginBottom: Spacing.one },
  gradeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  gradeChip: {
    borderRadius: 10,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minWidth: 48,
    alignItems: 'center',
  },
  gradeChipText: { fontSize: 15, fontWeight: '700' },
});
