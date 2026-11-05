import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

export interface SmallButtonProps {
  icon: FeatherIcon;
  label: string;
  /** Tint for text, icon, border and background. Default brand green. */
  tone?: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** 'md' (default, 34pt min height) or 'sm' (compact pill used on list cards). */
  size?: 'sm' | 'md';
}

/**
 * Tinted pill button with an icon (ARCH-062). Replaces the per-feature SmallButton /
 * ActionButton copies in billing, classes, members, trainers and branches.
 */
export default function SmallButton({ icon, label, tone = T.brand, onPress, disabled, busy, size = 'md' }: SmallButtonProps) {
  const sm = size === 'sm';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 5,
        ...(sm ? { paddingHorizontal: 10, paddingVertical: 6 } : { minHeight: 34, paddingHorizontal: 12 }),
        borderRadius: R.pill, opacity: disabled ? 0.5 : 1,
        backgroundColor: pressed ? withAlpha(tone, 0.18) : withAlpha(tone, 0.10),
        borderWidth: 1, borderColor: withAlpha(tone, 0.28),
      })}
    >
      {busy ? <ActivityIndicator size="small" color={tone} /> : <Feather name={icon} size={sm ? 12 : 13} color={tone} />}
      <Text style={{ color: tone, fontSize: sm ? 11 : 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export { SmallButton };
