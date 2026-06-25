/**
 * Estävä, ele-pohjainen valinta otetyypille + jyrkkyydelle yhdellä kosketuksella.
 * Näytetään kirjauksen jälkeen kun `trackHoldType` ja/tai `trackSteepness` on päällä.
 *
 * Molemmat päällä: pystysuora kortti. Aloita kosketus otetyypin (3 painiketta keskellä)
 * kohdalta → liu'uta ylös = Vertical/Slab, alas = Overhang/Roof, tai vapauta paikallaan =
 * ei jyrkkyyttä. Pelkkä napautus kirjaa otetyypin ja null-jyrkkyyden.
 * Vain toinen päällä: kolme tap-painiketta kyseiselle ulottuvuudelle.
 */

import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Spacing } from '@/constants/theme';
import { holdTypeFromX, steepnessFromDy } from '@/domain/climbTags';
import type { HoldType, Steepness } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { tapFeedback } from '@/lib/haptics';

/** Pystyliu'un kynnys (px), jonka yli jyrkkyys valitaan. */
const STEEPNESS_THRESHOLD = 40;

interface ClimbTagPromptProps {
  visible: boolean;
  trackHoldType: boolean;
  trackSteepness: boolean;
  onCommit: (holdType: HoldType | null, steepness: Steepness | null) => void;
  onCancel: () => void;
}

export function ClimbTagPrompt({
  visible,
  trackHoldType,
  trackSteepness,
  onCommit,
  onCancel,
}: ClimbTagPromptProps) {
  const theme = useTheme();

  // Vain toinen ulottuvuus päällä → yksinkertaiset tap-painikkeet.
  const both = trackHoldType && trackSteepness;

  const commit = (holdType: HoldType | null, steepness: Steepness | null) => {
    tapFeedback();
    onCommit(holdType, steepness);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.background }]}>
          {both ? (
            <CombinedPicker onCommit={commit} />
          ) : trackHoldType ? (
            <HoldTypeButtons onChoose={(h) => commit(h, null)} />
          ) : (
            <SteepnessButtons onChoose={(s) => commit(null, s)} />
          )}
        </View>
      </View>
    </Modal>
  );
}

/* --------------------- Molemmat: yhdistetty ele --------------------- */

function CombinedPicker({
  onCommit,
}: {
  onCommit: (holdType: HoldType | null, steepness: Steepness | null) => void;
}) {
  const theme = useTheme();
  const rowWidth = useRef(0);
  const [hold, setHold] = useState<HoldType | null>(null);
  const [steep, setSteep] = useState<Steepness | null>(null);

  const pan = Gesture.Pan()
    .minDistance(0)
    .runOnJS(true)
    .onBegin((e) => {
      setHold(holdTypeFromX(e.x, rowWidth.current));
      setSteep(null);
    })
    .onUpdate((e) => {
      setSteep(steepnessFromDy(e.translationY, STEEPNESS_THRESHOLD));
    })
    .onEnd((e) => {
      const h = holdTypeFromX(e.x, rowWidth.current);
      const s = steepnessFromDy(e.translationY, STEEPNESS_THRESHOLD);
      onCommit(h, s);
    });

  const zone = (active: boolean) => ({
    backgroundColor: active ? theme.backgroundSelected : theme.backgroundElement,
  });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.combined}>
        <Text style={[styles.title, { color: theme.text }]}>{fi.steepness.prompt}</Text>

        {/* Ylävyöhyke: Vertical/Slab */}
        <View style={[styles.steepZone, zone(steep === 'slab')]}>
          <Text style={[styles.zoneText, { color: theme.text }]}>{fi.steepness.slab}</Text>
        </View>

        {/* Keskirivi: 3 otetyyppipainiketta */}
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{fi.holdType.prompt}</Text>
        <View
          style={styles.row}
          onLayout={(e) => {
            rowWidth.current = e.nativeEvent.layout.width;
          }}>
          <View
            style={[styles.btn, { backgroundColor: hold === 'slopy' ? theme.text : theme.backgroundElement }]}>
            <Text style={[styles.btnText, { color: hold === 'slopy' ? theme.background : theme.text }]}>
              {fi.holdType.slopy}
            </Text>
          </View>
          <View
            style={[
              styles.btn,
              styles.btnNeutral,
              { backgroundColor: hold === null ? theme.backgroundSelected : theme.backgroundElement },
            ]}>
            <Text style={[styles.btnText, { color: theme.textSecondary }]}>{fi.holdType.undefined}</Text>
          </View>
          <View
            style={[styles.btn, { backgroundColor: hold === 'crimpy' ? theme.text : theme.backgroundElement }]}>
            <Text style={[styles.btnText, { color: hold === 'crimpy' ? theme.background : theme.text }]}>
              {fi.holdType.crimpy}
            </Text>
          </View>
        </View>

        {/* Alavyöhyke: Overhang/Roof */}
        <View style={[styles.steepZone, zone(steep === 'overhang')]}>
          <Text style={[styles.zoneText, { color: theme.text }]}>{fi.steepness.overhang}</Text>
        </View>

        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          {fi.settings.trackSteepnessHint}
        </Text>
      </View>
    </GestureDetector>
  );
}

/* --------------------- Vain otetyyppi --------------------- */

function HoldTypeButtons({ onChoose }: { onChoose: (h: HoldType | null) => void }) {
  const theme = useTheme();
  return (
    <>
      <Text style={[styles.title, { color: theme.text }]}>{fi.holdType.prompt}</Text>
      <View style={styles.row}>
        <Pressable onPress={() => onChoose('slopy')} style={[styles.btn, { backgroundColor: theme.text }]}>
          <Text style={[styles.btnText, { color: theme.background }]}>{fi.holdType.slopy}</Text>
        </Pressable>
        <Pressable
          onPress={() => onChoose(null)}
          style={[styles.btn, styles.btnNeutral, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.btnText, { color: theme.textSecondary }]}>{fi.holdType.undefined}</Text>
        </Pressable>
        <Pressable onPress={() => onChoose('crimpy')} style={[styles.btn, { backgroundColor: theme.text }]}>
          <Text style={[styles.btnText, { color: theme.background }]}>{fi.holdType.crimpy}</Text>
        </Pressable>
      </View>
    </>
  );
}

/* --------------------- Vain jyrkkyys --------------------- */

function SteepnessButtons({ onChoose }: { onChoose: (s: Steepness | null) => void }) {
  const theme = useTheme();
  return (
    <>
      <Text style={[styles.title, { color: theme.text }]}>{fi.steepness.prompt}</Text>
      <View style={styles.row}>
        <Pressable onPress={() => onChoose('slab')} style={[styles.btn, { backgroundColor: theme.text }]}>
          <Text style={[styles.btnText, { color: theme.background }]}>{fi.steepness.slab}</Text>
        </Pressable>
        <Pressable
          onPress={() => onChoose(null)}
          style={[styles.btn, styles.btnNeutral, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.btnText, { color: theme.textSecondary }]}>{fi.steepness.undefined}</Text>
        </Pressable>
        <Pressable onPress={() => onChoose('overhang')} style={[styles.btn, { backgroundColor: theme.text }]}>
          <Text style={[styles.btnText, { color: theme.background }]}>{fi.steepness.overhang}</Text>
        </Pressable>
      </View>
    </>
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
  combined: { gap: Spacing.two },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 12, textAlign: 'center', marginTop: Spacing.one },
  steepZone: {
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneText: { fontSize: 16, fontWeight: '800' },
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
  btnText: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
});
