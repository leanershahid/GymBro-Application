import React from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleProp, ViewStyle } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { apiErrorText } from '../../../api/apiError';
import EmptyState from '../../dashboard/components/EmptyState';
import { addDays, startOfLocalDay, sameLocalDay } from '../utils/bookingFormat';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

export function Card({ children, accent, style }: { children: React.ReactNode; accent?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{
      backgroundColor: T.bgInput, borderRadius: R.xl, borderWidth: 1,
      borderColor: accent ? withAlpha(accent, 0.28) : T.line, padding: SP.lg,
    }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.md }}>
      <Text accessibilityRole="header" style={{ color: T.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 }}>{title}</Text>
      {right}
    </View>
  );
}

export function InlineError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <EmptyState icon="wifi-off" tone="error" title="Couldn't load this" subtitle={apiErrorText(error)} action={{ label: 'Retry', onPress: onRetry }} />;
}

type Variant = 'primary' | 'gold' | 'danger' | 'ghost';

/** Compact pill button for card actions. */
export function ActionButton({ label, icon, variant = 'primary', onPress, busy, disabled, accessibilityLabel, style }: {
  label: string; icon?: FeatherIconName; variant?: Variant; onPress: () => void;
  busy?: boolean; disabled?: boolean; accessibilityLabel?: string; style?: StyleProp<ViewStyle>;
}) {
  const solid = variant === 'primary' || variant === 'gold';
  const c = variant === 'gold' ? T.brandGold : variant === 'danger' ? T.err : variant === 'ghost' ? T.textSub : T.brand;
  const fg = solid ? T.onBrand : c;
  const off = !!disabled || !!busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy: !!busy }}
      style={({ pressed }) => [{
        minHeight: 40, paddingHorizontal: 16, borderRadius: R.pill, flexDirection: 'row', gap: 6,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: solid ? (pressed ? withAlpha(c, 0.8) : c) : pressed ? withAlpha(c, 0.15) : withAlpha(c, 0.08),
        borderWidth: solid ? 0 : 1, borderColor: withAlpha(c, 0.35),
        opacity: disabled && !busy ? 0.5 : 1,
      }, style]}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : (
        <>
          {icon && <Feather name={icon} size={15} color={fg} />}
          <Text style={{ color: fg, fontSize: 14, fontWeight: '700' }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Horizontal strip of the next `days` days starting today (local). */
export function DayStrip({ value, onChange, days = 14, marks }: {
  value: Date; onChange: (d: Date) => void; days?: number;
  /** Optional per-day dot (e.g. "has classes"), keyed by day index from today. */
  marks?: Set<number>;
}) {
  const today = startOfLocalDay(new Date());
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm, paddingVertical: 2 }}>
      {Array.from({ length: days }, (_, i) => {
        const d = addDays(today, i);
        const selected = sameLocalDay(d, value);
        const wd = i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' });
        return (
          <Pressable
            key={i}
            onPress={() => onChange(d)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            style={{
              width: 56, paddingVertical: 10, borderRadius: R.lg, alignItems: 'center', borderWidth: 1,
              backgroundColor: selected ? T.brand : T.bgInput, borderColor: selected ? T.brand : T.line,
            }}
          >
            <Text numberOfLines={1} style={{ color: selected ? T.onBrand : T.textSub, fontSize: 11, fontWeight: '700' }}>{wd}</Text>
            <Text style={{ color: selected ? T.onBrand : T.text, fontSize: 18, fontWeight: '800', marginTop: 2 }}>{d.getDate()}</Text>
            <View style={{
              width: 5, height: 5, borderRadius: 3, marginTop: 4,
              backgroundColor: marks?.has(i) ? (selected ? T.onBrand : T.brand) : 'transparent',
            }} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** 1–5 stars; interactive when `onRate` is given. */
export function StarRating({ value, onRate, disabled, size = 22 }: {
  value: number; onRate?: (n: number) => void; disabled?: boolean; size?: number;
}) {
  return (
    <View accessibilityRole={onRate ? 'adjustable' : undefined} accessibilityLabel={`Rating ${value} of 5`} style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => {
        const on = n <= value;
        const star = <Ionicons name={on ? 'star' : 'star-outline'} size={size} color={on ? T.brandGold : T.textFaint} />;
        return onRate ? (
          <Pressable
            key={n}
            onPress={() => onRate(n)}
            disabled={disabled}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${n} star${n > 1 ? 's' : ''}`}
            style={{ opacity: disabled ? 0.5 : 1 }}
          >
            {star}
          </Pressable>
        ) : <View key={n}>{star}</View>;
      })}
    </View>
  );
}
