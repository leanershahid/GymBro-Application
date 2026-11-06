import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

/** Large-target checkbox row (48pt+), announced as a checkbox. */
export function CheckRow({ checked, onToggle, label, disabled, hint }: {
  checked: boolean; onToggle: () => void; label: string; disabled?: boolean; hint?: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 56, padding: SP.md,
        borderRadius: R.md, borderWidth: 1,
        borderColor: checked ? withAlpha(T.brand, 0.4) : T.line,
        backgroundColor: checked ? withAlpha(T.brand, 0.08) : T.bgInput,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{
        width: 26, height: 26, borderRadius: 7, borderWidth: 2,
        borderColor: checked ? T.brand : T.textFaint, backgroundColor: checked ? T.brand : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <Feather name="check" size={16} color={T.onBrand} />}
      </View>
      <Text style={{ flex: 1, color: T.text, fontSize: 15, lineHeight: 21 }}>{label}</Text>
    </Pressable>
  );
}

/** Yes / No pair for one question; both are 48pt targets. */
export function YesNo({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean) => void; label: string }) {
  const opt = (v: boolean) => {
    const on = value === v;
    const c = v ? T.brandGold : T.brand;
    return (
      <Pressable
        key={String(v)}
        onPress={() => onChange(v)}
        accessibilityRole="radio"
        accessibilityState={{ selected: on, checked: on }}
        accessibilityLabel={`${v ? 'Yes' : 'No'}: ${label}`}
        style={{
          flex: 1, minHeight: 48, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: on ? c : T.line, backgroundColor: on ? withAlpha(c, 0.14) : T.bgInput,
        }}
      >
        <Text style={{ color: on ? c : T.textSub, fontSize: 15, fontWeight: '700' }}>{v ? 'Yes' : 'No'}</Text>
      </Pressable>
    );
  };
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', gap: SP.sm }}>
      {opt(false)}{opt(true)}
    </View>
  );
}

/** Tinted notice box (info / warning / success). */
export function Notice({ icon, tone = T.sky, title, children }: { icon: FeatherIcon; tone?: string; title?: string; children?: React.ReactNode }) {
  return (
    <View
      accessible
      accessibilityRole="text"
      style={{
        flexDirection: 'row', gap: SP.md, padding: SP.md, borderRadius: R.md,
        backgroundColor: withAlpha(tone, 0.08), borderWidth: 1, borderColor: withAlpha(tone, 0.25),
      }}
    >
      <Feather name={icon} size={18} color={tone} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {!!title && <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{title}</Text>}
        {typeof children === 'string'
          ? <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>{children}</Text>
          : children}
      </View>
    </View>
  );
}

/** Thin segmented progress bar. */
export function StepProgress({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: step }}
      style={{ flexDirection: 'row', gap: 4 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? T.brand : T.line }} />
      ))}
    </View>
  );
}

export function StepTitle({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <View style={{ gap: 6, marginBottom: SP.lg }}>
      {!!eyebrow && (
        <Text style={{ color: T.brand, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>{eyebrow}</Text>
      )}
      <Text accessibilityRole="header" style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>{title}</Text>
      {!!sub && <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 21 }}>{sub}</Text>}
    </View>
  );
}
