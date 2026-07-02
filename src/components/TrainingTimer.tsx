/**
 * Treeniajastin Treeni-näkymään (astevalikon alle). Kaksi tilaa:
 *  - simple: yksi "Lepo"-kello joka nollautuu jokaisella kirjauksella.
 *  - complex: painettava nousuajastin + palautumisajastin.
 *
 * Ajastin ei ole näkyvissä ellei sitä ole otettu käyttöön sessiota aloitettaessa
 * (`useTimer().enabled`). Kulunut aika lasketaan aina aikaleimasta (`now - anchorAt`),
 * joten näyttö pysyy oikeana taustalta palattaessa. Send/Project ovat toisensa
 * poissulkevia, joten kerrallaan on korkeintaan yksi tikittävä instanssi.
 */

import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { formatDurationMmSs } from '@/domain/dates';
import { useTheme } from '@/hooks/use-theme';
import { fi } from '@/i18n/fi';
import { tapFeedback } from '@/lib/haptics';
import { useTimer } from '@/state/timer';

export function TrainingTimer() {
  const theme = useTheme();
  const { enabled, mode, phase, anchorAt, lastClimbSec, startClimb } = useTimer();

  const [now, setNow] = useState(() => Date.now());

  // Tikitä sekunnin osissa vain kun jotain on käynnissä; korjaa heti taustalta palattaessa.
  const ticking = enabled && (mode === 'simple' || phase !== 'idle');
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [ticking]);

  if (!enabled) return null;

  const elapsedSec = anchorAt != null ? Math.floor((now - anchorAt) / 1000) : 0;

  if (mode === 'simple') {
    return (
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>{fi.timer.rest}</Text>
        <Text style={[styles.time, { color: theme.text }]}>{formatDurationMmSs(elapsedSec)}</Text>
      </View>
    );
  }

  // complex
  const climbing = phase === 'climbing';
  const resting = phase === 'resting';
  const onPressClimb = () => {
    tapFeedback();
    startClimb();
  };

  const climbValue = climbing
    ? formatDurationMmSs(elapsedSec)
    : lastClimbSec != null
      ? formatDurationMmSs(lastClimbSec)
      : fi.common.none;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPressClimb}
        style={[
          styles.half,
          { backgroundColor: climbing ? theme.text : theme.backgroundElement },
        ]}>
        <Text
          style={[styles.label, { color: climbing ? theme.background : theme.textSecondary }]}>
          {climbing ? fi.timer.climb : fi.timer.lastClimb}
        </Text>
        <Text style={[styles.time, { color: climbing ? theme.background : theme.text }]}>
          {climbValue}
        </Text>
        <Text
          style={[
            styles.hint,
            { color: climbing ? theme.background : theme.textSecondary },
          ]}>
          {climbing ? fi.timer.climbing : fi.timer.tapToStartClimb}
        </Text>
      </Pressable>
      <View
        style={[
          styles.half,
          { backgroundColor: resting ? theme.backgroundSelected : theme.backgroundElement },
        ]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>{fi.timer.recovery}</Text>
        <Text style={[styles.time, { color: theme.text }]}>
          {resting ? formatDurationMmSs(elapsedSec) : fi.common.none}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  half: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 104,
  },
  label: { fontSize: 13, fontWeight: '700' },
  time: { fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hint: { fontSize: 11, textAlign: 'center' },
});
