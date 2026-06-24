import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { Projects } from '@/db/repositories';
import { defaultSystemForDiscipline } from '@/domain/grades';
import type { Discipline, GradeSystem, HoldType } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { bumpData } from '@/state/dataVersion';
import { GradePicker } from './GradePicker';
import { PrimaryButton } from './PrimaryButton';
import { SegmentedControl } from './SegmentedControl';

interface NewProjectModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
  boulderSystem: GradeSystem; // font | v
  showSecondary: boolean;
  trackHoldType: boolean;
}

export function NewProjectModal({
  visible,
  onClose,
  onCreated,
  boulderSystem,
  showSecondary,
  trackHoldType,
}: NewProjectModalProps) {
  const theme = useTheme();
  const [discipline, setDiscipline] = useState<Discipline>('boulder');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [grade, setGrade] = useState<string | null>(null);
  const [holdType, setHoldType] = useState<HoldType | null>(null);

  const system = defaultSystemForDiscipline(discipline, boulderSystem);
  const secondarySystem: GradeSystem | undefined =
    discipline === 'boulder' ? (boulderSystem === 'font' ? 'v' : 'font') : undefined;

  const reset = () => {
    setDiscipline('boulder');
    setName('');
    setLocation('');
    setGrade(null);
    setHoldType(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const create = () => {
    if (!grade) return;
    const id = Projects.createProject({
      name,
      discipline,
      gradeSystem: system,
      gradeValue: grade,
      location,
      holdType: trackHoldType ? holdType : null,
    });
    bumpData();
    reset();
    onCreated(id);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>{fi.home.newProject}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <SegmentedControl<Discipline>
            segments={[
              { value: 'boulder', label: fi.discipline.boulder },
              { value: 'sport', label: fi.discipline.sport },
            ]}
            value={discipline}
            onChange={(d) => {
              setDiscipline(d);
              setGrade(null);
            }}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>{fi.project.name}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={fi.project.namePlaceholder}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>{fi.common.location}</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder={fi.common.optional}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>{fi.project.grade}</Text>
          <GradePicker
            system={system}
            secondarySystem={secondarySystem}
            showSecondary={showSecondary}
            onPick={setGrade}
            selected={grade}
          />

          {trackHoldType ? (
            <>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {fi.holdType.prompt}
              </Text>
              <SegmentedControl<HoldType | 'none'>
                segments={[
                  { value: 'slopy', label: fi.holdType.slopy },
                  { value: 'none', label: fi.holdType.undefined },
                  { value: 'crimpy', label: fi.holdType.crimpy },
                ]}
                value={holdType ?? 'none'}
                onChange={(v) => setHoldType(v === 'none' ? null : v)}
              />
            </>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label={fi.common.cancel} onPress={close} variant="secondary" flex />
          <PrimaryButton label={fi.common.create} onPress={create} disabled={!grade} flex />
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
  input: { borderRadius: 10, padding: Spacing.three, fontSize: 16 },
  footer: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
});
