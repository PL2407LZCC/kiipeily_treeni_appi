import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { HoldType } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { tapFeedback } from '@/lib/haptics';

interface HoldTypePromptProps {
  visible: boolean;
  /** Valinta: 'slopy' | 'crimpy' tai null (= ei määritelty). */
  onChoose: (holdType: HoldType | null) => void;
}

/**
 * Estävä 3-painikkeen valinta otetyypille kirjauksen jälkeen (ei ajastinta).
 * Vasen = Slopy, keski = Ei määritelty (null), oikea = Crimpy. Näytetään vain kun
 * asetus `trackHoldType` on päällä.
 */
export function HoldTypePrompt({ visible, onChoose }: HoldTypePromptProps) {
  const theme = useTheme();

  const choose = (holdType: HoldType | null) => {
    tapFeedback();
    onChoose(holdType);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => onChoose(null)}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.background }]}>
          <Text style={[styles.title, { color: theme.text }]}>{fi.holdType.prompt}</Text>
          <View style={styles.row}>
            <Pressable
              onPress={() => choose('slopy')}
              style={[styles.btn, { backgroundColor: theme.text }]}>
              <Text style={[styles.btnText, { color: theme.background }]}>{fi.holdType.slopy}</Text>
            </Pressable>
            <Pressable
              onPress={() => choose(null)}
              style={[styles.btn, styles.btnNeutral, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.btnText, { color: theme.textSecondary }]}>
                {fi.holdType.undefined}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => choose('crimpy')}
              style={[styles.btn, { backgroundColor: theme.text }]}>
              <Text style={[styles.btnText, { color: theme.background }]}>{fi.holdType.crimpy}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    borderRadius: 18,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  row: { flexDirection: 'row', gap: Spacing.two },
  btn: {
    flex: 1,
    height: 104,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  btnNeutral: { flexBasis: '28%', flexGrow: 0 },
  btnText: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
});
