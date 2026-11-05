import React, { useRef, useState } from 'react';
import { Animated, View, Text, Pressable, TextInput, Platform, StyleProp, ViewStyle, TextInputProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import ConfirmSheet from '../../common/components/ConfirmSheet';

// Small building blocks shared by the store screens.

export type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

export const card: ViewStyle = { backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line };

/** Round 44px icon button with a required screen-reader label. */
export function IconButton({ icon, label, onPress, color = T.text, size = 44, filled = true, disabled, style }: {
  icon: FeatherIcon; label: string; onPress: () => void; color?: string; size?: number; filled?: boolean; disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={Math.max(0, (44 - size) / 2)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [{
        width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: filled ? (pressed ? T.bgInputActive : T.bgInput) : 'transparent',
        borderWidth: filled ? 1 : 0, borderColor: T.line, opacity: disabled ? 0.4 : 1,
      }, style]}
    >
      <Feather name={icon} size={Math.round(size * 0.42)} color={color} />
    </Pressable>
  );
}

/** Toggle pill used for filters, sub-categories and variants. */
export function Chip({ label, selected, onPress, struck, icon, disabled, accessibilityLabel }: {
  label: string; selected?: boolean; onPress: () => void; struck?: boolean; icon?: FeatherIcon; disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={({ pressed }) => ({
        minHeight: 40, paddingHorizontal: 14, borderRadius: R.pill, flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1,
        borderColor: selected ? T.brand : T.line,
        backgroundColor: selected ? withAlpha(T.brand, 0.14) : pressed ? T.bgInputActive : T.bgInput,
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Text
        numberOfLines={1}
        style={{
          color: selected ? T.brand : struck ? T.textFaint : T.text, fontSize: 13, fontWeight: '600',
          textDecorationLine: struck ? 'line-through' : 'none',
        }}
      >
        {label}
      </Text>
      {icon && <Feather name={icon} size={14} color={selected ? T.brand : T.textSub} />}
    </Pressable>
  );
}

/** Five stars, with half stars rounded to the nearest half. */
export function Stars({ rating, size = 12, count }: { rating: number; size?: number; count?: number }) {
  const r = Math.round(rating * 2) / 2;
  return (
    <View
      accessibilityLabel={`Rated ${rating.toFixed(1)} out of 5${count !== undefined ? `, ${count} reviews` : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}
    >
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} style={{ fontSize: size, lineHeight: size + 3, color: i <= r ? T.brandGold : i - 0.5 === r ? withAlpha(T.brandGold, 0.6) : T.textDisabled }}>★</Text>
      ))}
      {count !== undefined && <Text style={{ color: T.textFaint, fontSize: 11, marginLeft: 4 }}>({count})</Text>}
    </View>
  );
}

/** Product photo with a placeholder for missing or broken images. */
export function ProductImage({ uri, style, iconSize = 28 }: { uri: string | null | undefined; style?: StyleProp<ViewStyle>; iconSize?: number }) {
  const [failed, setFailed] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  return (
    <View style={[{ backgroundColor: T.bgInputActive, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      {uri && !failed ? (
        <Animated.Image
          source={{ uri }}
          onError={() => setFailed(true)}
          onLoad={() => Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start()}
          accessibilityIgnoresInvertColors
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: fade }}
          resizeMode="cover"
        />
      ) : (
        <Feather name="package" size={iconSize} color={T.textFaint} />
      )}
    </View>
  );
}

/** Labelled text input with an error line. */
export function Field({ label, error, optional, style, ...input }: TextInputProps & { label: string; error?: string; optional?: boolean; style?: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: SP.md }, style]}>
      <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
        {label}{optional ? <Text style={{ color: T.textFaint, fontWeight: '400' }}>  (optional)</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={T.textFaint}
        accessibilityLabel={label}
        {...input}
        onFocus={e => { setFocused(true); input.onFocus?.(e); }}
        onBlur={e => { setFocused(false); input.onBlur?.(e); }}
        style={{
          minHeight: input.multiline ? 88 : 48, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: input.multiline ? 12 : 0,
          backgroundColor: focused ? T.bgInputActive : T.bg, color: T.text, fontSize: 15,
          borderWidth: 1, borderColor: error ? T.err : focused ? T.brand : T.line,
          textAlignVertical: input.multiline ? 'top' : 'center',
        }}
      />
      {error ? <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

/** − n + stepper. */
export function QtyStepper({ value, onChange, max, min = 1, compact }: { value: number; onChange: (n: number) => void; max: number; min?: number; compact?: boolean }) {
  const h = compact ? 36 : 44;
  const btn = (icon: FeatherIcon, label: string, next: number, disabled: boolean) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={disabled}
      hitSlop={compact ? 4 : 0}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{ width: h, height: h, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
    >
      <Feather name={icon} size={16} color={T.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: R.pill, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg, alignSelf: 'flex-start' }}>
      {btn('minus', 'Decrease quantity', value - 1, value <= min)}
      <Text accessibilityLabel={`Quantity ${value}`} style={{ minWidth: 28, textAlign: 'center', color: T.text, fontSize: 15, fontWeight: '700' }}>{value}</Text>
      {btn('plus', 'Increase quantity', value + 1, value >= max)}
    </View>
  );
}

/** Section title with an optional "See all" link. */
export function SectionTitle({ title, action, style }: { title: string; action?: { label: string; onPress: () => void }; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.sm }, style]}>
      <Text accessibilityRole="header" style={{ color: T.text, fontSize: 17, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>{title}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={action.label} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export { ConfirmSheet };

/** Label · amount row for totals. */
export function MoneyRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 4, gap: SP.md }}>
      <Text style={{ color: strong ? T.text : T.textSub, fontSize: strong ? 16 : 14, fontWeight: strong ? '800' : '400' }}>{label}</Text>
      <Text style={{ color: tone ?? T.text, fontSize: strong ? 20 : 14, fontWeight: strong ? '800' : '600' }}>{value}</Text>
    </View>
  );
}

/** Copy is available on web (navigator.clipboard); on phones the text is selectable instead. */
export const canCopy = () =>
  Platform.OS === 'web' && typeof navigator !== 'undefined' && !!(navigator as Navigator).clipboard?.writeText;

export async function copyText(text: string): Promise<boolean> {
  try {
    if (!canCopy()) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Date `days` from now, as "Tue, 12 Nov". */
export const dateIn = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export const shortDay = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '';

export const PAYMENT_LABEL: Record<string, string> = { CashOnDelivery: 'Cash on delivery', Upi: 'UPI', Card: 'Card' };
