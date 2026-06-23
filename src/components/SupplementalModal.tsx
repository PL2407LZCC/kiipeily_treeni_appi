import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { Supplemental } from '@/db/repositories';
import type { SupplementalKind } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { bumpData } from '@/state/dataVersion';
import { PrimaryButton } from './PrimaryButton';
import { SegmentedControl } from './SegmentedControl';

interface SupplementalModalProps {
  visible: boolean;
  sessionId: number;
  onClose: () => void;
}

function toIntOrNull(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
function toFloatOrNull(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function SupplementalModal({ visible, sessionId, onClose }: SupplementalModalProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SupplementalKind>('strength');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [duration, setDuration] = useState('');

  const reset = () => {
    setName('');
    setKind('strength');
    setSets('');
    setReps('');
    setWeight('');
    setDuration('');
  };
  const close = () => {
    reset();
    onClose();
  };
  const save = () => {
    if (!name.trim()) return;
    const durMin = toIntOrNull(duration);
    Supplemental.addSupplemental({
      sessionId,
      name,
      kind,
      sets: toIntOrNull(sets),
      reps: toIntOrNull(reps),
      weight: toFloatOrNull(weight),
      durationSec: durMin != null ? durMin * 60 : null,
    });
    bumpData();
    close();
  };

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>{fi.supplemental.title}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>{fi.supplemental.name}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={fi.supplemental.namePlaceholder}
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>{fi.supplemental.kind}</Text>
          <SegmentedControl<SupplementalKind>
            segments={[
              { value: 'strength', label: fi.supplemental.kinds.strength },
              { value: 'endurance', label: fi.supplemental.kinds.endurance },
              { value: 'other', label: fi.supplemental.kinds.other },
            ]}
            value={kind}
            onChange={setKind}
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {fi.supplemental.sets}
              </Text>
              <TextInput
                value={sets}
                onChangeText={setSets}
                keyboardType="number-pad"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
              />
            </View>
            <View style={styles.col}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {fi.supplemental.reps}
              </Text>
              <TextInput
                value={reps}
                onChangeText={setReps}
                keyboardType="number-pad"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {fi.supplemental.weight}
              </Text>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
              />
            </View>
            <View style={styles.col}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {fi.supplemental.duration}
              </Text>
              <TextInput
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
              />
            </View>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label={fi.common.cancel} onPress={close} variant="secondary" flex />
          <PrimaryButton label={fi.common.save} onPress={save} disabled={!name.trim()} flex />
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
  row: { flexDirection: 'row', gap: Spacing.three },
  col: { flex: 1 },
  footer: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
});
