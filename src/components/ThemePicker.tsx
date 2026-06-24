import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ThemePickerProps {
  value: string | null;
  options: string[];
  placeholder: string;
  /** Teksti "ei teemaa" -valinnalle. */
  noneLabel: string;
  onChange: (value: string | null) => void;
}

/**
 * Yksinkertainen pudotusvalikko teemalle: napautus avaa modaalin listan, josta
 * valitaan (tai tyhjennetään). Estää kirjoitusvirheet — vapaata tekstiä ei syötetä.
 */
export function ThemePicker({ value, options, placeholder, noneLabel, onChange }: ThemePickerProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: theme.backgroundElement }]}>
        <Text style={[styles.fieldText, { color: value ? theme.text : theme.textSecondary }]}>
          {value ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.background }]}
            onPress={(e) => e.stopPropagation()}>
            <ScrollView>
              <Row label={noneLabel} muted selected={value == null} onPress={() => pick(null)} />
              {options.map((opt) => (
                <Row
                  key={opt}
                  label={opt}
                  selected={value === opt}
                  onPress={() => pick(opt)}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Row({
  label,
  selected,
  muted,
  onPress,
}: {
  label: string;
  selected: boolean;
  muted?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={[styles.rowText, { color: muted ? theme.textSecondary : theme.text }]}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={20} color={theme.text} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    padding: Spacing.three,
  },
  fieldText: { fontSize: 16 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheet: { borderRadius: 14, maxHeight: '60%', paddingVertical: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  rowText: { fontSize: 17 },
});
