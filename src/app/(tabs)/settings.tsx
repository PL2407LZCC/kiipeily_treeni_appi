import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Spacing } from '@/constants/theme';
import { exportBackup, pickAndParseBackup, restoreBackup } from '@/backup/exportImport';
import { nowIso } from '@/domain/dates';
import type { GradeSystem } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { bumpData } from '@/state/dataVersion';
import { useSettings } from '@/state/settings';

export default function SettingsScreen() {
  const theme = useTheme();
  const settings = useSettings();

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
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.two },
  about: { fontSize: 14, lineHeight: 20 },
});
