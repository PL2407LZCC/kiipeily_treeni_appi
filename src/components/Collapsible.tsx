import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface CollapsibleProps {
  title: string;
  /** Lyhyt yhteenveto oikealla kun suljettu (esim. nykyinen valinta). */
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Avattava/suljettava osio: otsikkorivi + chevron, sisältö näkyy vain avattuna. */
export function Collapsible({ title, summary, defaultOpen = false, children }: CollapsibleProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={styles.header}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <View style={styles.right}>
          {!open && summary ? (
            <Text style={[styles.summary, { color: theme.textSecondary }]} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.textSecondary}
          />
        </View>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 12, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexShrink: 1 },
  summary: { fontSize: 14, flexShrink: 1 },
  body: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two },
});
