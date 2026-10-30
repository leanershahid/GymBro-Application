import React from 'react';
import { Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface Props {
  icon: FeatherIconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger' | 'brand';
  size?: number;
}

/** Small square icon button (move up/down, remove, more…) with a 44pt hit area. */
export default function IconButton({ icon, label, onPress, disabled, tone = 'default', size = 32 }: Props) {
  const c = tone === 'danger' ? T.err : tone === 'brand' ? T.brand : T.textSub;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        width: size, height: size, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? withAlpha(c, 0.18) : T.bgInputActive,
        borderWidth: 1, borderColor: T.line, opacity: disabled ? 0.35 : 1,
      })}
    >
      <Feather name={icon} size={Math.round(size * 0.48)} color={c} />
    </Pressable>
  );
}
