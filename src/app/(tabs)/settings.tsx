import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Spacing } from '@/constants/theme';
import { exportBackup, pickAndParseBackup, restoreBackup } from '@/backup/exportImport';
import { Themes } from '@/db/repositories';
import { nowIso } from '@/domain/dates';
import type { GradeSystem } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { bumpData } from '@/state/dataVersion';
import { useSettings } from '@/state/settings';

export default function SettingsScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const themes = useDbQuery(() => Themes.listThemes(), []);
  const [newTheme, setNewTheme] = useState('');

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

        {/* Session teemat */}
        <Text style={[styles.section, { color: theme.textSecondary, marginTop: Spacing.four }]}>
          {fi.settings.themes}
        </Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>{fi.settings.themesHint}</Text>
        {themes.length === 0 ? (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{fi.settings.noThemes}</Text>
        ) : (
          themes.map((t) => (
            <View key={t.id} style={[styles.themeRow, { backgroundColor: theme.backgroundElement }]}>
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
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            onSubmitEditing={addTheme}
            returnKeyType="done"
          />
          <PrimaryButton label={fi.settings.addTheme} onPress={addTheme} />
        </View>

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
});
