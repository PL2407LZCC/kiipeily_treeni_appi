import { Pressable, StyleSheet, Text } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  flex?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  flex,
}: PrimaryButtonProps) {
  const theme = useTheme();
  const bg =
    variant === 'primary'
      ? theme.text
      : variant === 'danger'
        ? '#c0392b'
        : theme.backgroundElement;
  const fg = variant === 'secondary' ? theme.text : variant === 'danger' ? '#fff' : theme.background;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.4 : 1 }, flex && { flex: 1 }]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  label: { fontSize: 16, fontWeight: '700' },
});
