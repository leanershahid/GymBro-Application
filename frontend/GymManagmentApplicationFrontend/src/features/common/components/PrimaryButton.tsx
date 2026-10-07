import React from 'react';
import { Pressable, Text, ActivityIndicator, View, StyleProp, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../../theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: FeatherIconName;
  /** 'primary' = green pill CTA; 'secondary' = outlined pill (e.g. "Previous"). */
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

/** The app's pill CTA (spec: full width, 56px, radius 999, black text on green). */
export default function PrimaryButton({
  label, onPress, loading = false, disabled = false, icon, variant = 'primary', style, accessibilityHint,
}: Props) {
  const inactive = disabled || loading;
  const fg = variant === 'primary' ? T.onBrand : variant === 'danger' ? T.err : T.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        {
          height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: 8, paddingHorizontal: 24,
          opacity: disabled && !loading ? 0.5 : 1,
        },
        variant === 'primary'
          ? { backgroundColor: pressed || loading ? T.brandDark : T.brand }
          : { backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderWidth: 1, borderColor: variant === 'danger' ? T.err : T.line },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon && <Feather name={icon} size={18} color={fg} />}
          <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
