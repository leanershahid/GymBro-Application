// Small building blocks shared by the shop admin screens.
import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Image, TextInput, Platform, Share, StyleProp, ViewStyle, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../../theme';
import BottomSheet from '../../../common/components/BottomSheet';
import PrimaryButton from '../../../common/components/PrimaryButton';
import EmptyState from '../../../common/components/EmptyState';
import { PillTone } from '../../../common/components/StatusPill';
import { apiErrorText } from '../../../../api/apiError';
import { ShopCategory, ShopOrderStatus } from '../../api/shop.types';
import SharedConfirmSheet, { ConfirmSheetProps } from '../../../common/components/ConfirmSheet';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

// ── Order status colours ────────────────────────────────────────────────

export const ORDER_STATUSES: ShopOrderStatus[] = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'OutForDelivery', 'Delivered', 'Cancelled'];

export const STATUS_TONE: Record<ShopOrderStatus, PillTone> = {
  Pending: 'warn', Confirmed: 'info', Processing: 'violet', Shipped: 'info', OutForDelivery: 'brand', Delivered: 'ok', Cancelled: 'err',
};

export const STATUS_COLOR: Record<ShopOrderStatus, string> = {
  Pending: T.brandGold, Confirmed: T.sky, Processing: T.violet, Shipped: withAlpha(T.sky, 0.6),
  OutForDelivery: T.brand, Delivered: T.ok, Cancelled: T.err,
};

// ── Layout ──────────────────────────────────────────────────────────────

export function Card({ title, subtitle, right, children, style }: {
  title?: string; subtitle?: string; right?: React.ReactNode; children?: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, padding: SP.lg, marginBottom: SP.lg }, style]}>
      {(title || right) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.md }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {title && <Text accessibilityRole="header" style={{ color: T.text, fontSize: 16, fontWeight: '800' }}>{title}</Text>}
            {subtitle && <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function Eyebrow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: SP.sm }}>
        {children}
      </Text>
    </View>
  );
}

/** Label / value line for detail cards. */
export function InfoRow({ label, value, strong, tone }: { label: string; value: React.ReactNode; strong?: boolean; tone?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md, paddingVertical: 4 }}>
      <Text style={{ color: strong ? T.text : T.textSub, fontSize: 14, fontWeight: strong ? '800' : '400', flexShrink: 1 }}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number'
        ? <Text style={{ color: tone ?? T.text, fontSize: 14, fontWeight: strong ? '800' : '600', textAlign: 'right', flexShrink: 1 }}>{value}</Text>
        : value}
    </View>
  );
}

// ── Controls ────────────────────────────────────────────────────────────

export interface ChipItem<K extends string> { key: K; label: string; icon?: FeatherIconName }

/** Horizontally scrolling filter / tab chips (44px tall). */
export function ChipRow<K extends string>({ items, value, onChange, style, label }: {
  items: ChipItem<K>[]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle>; label?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={{ gap: SP.sm, paddingRight: SP.sm }}
    >
      {items.map(it => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            accessibilityRole="tab"
            accessibilityLabel={it.label}
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              minHeight: 44, paddingHorizontal: 16, borderRadius: R.pill, flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: on ? T.brand : pressed ? T.bgInputActive : T.bgInput,
              borderWidth: 1, borderColor: on ? T.brand : T.line,
            })}
          >
            {it.icon && <Feather name={it.icon} size={15} color={on ? T.onBrand : T.textSub} />}
            <Text style={{ color: on ? T.onBrand : T.textSub, fontSize: 13, fontWeight: '700' }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** 44×44 icon button; the label is read by screen readers. */
export function IconButton({ icon, label, onPress, tone = T.textSub, disabled, busy, filled }: {
  icon: FeatherIconName; label: string; onPress: () => void; tone?: string; disabled?: boolean; busy?: boolean; filled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? T.bgInputActive : filled ? withAlpha(tone, 0.12) : 'transparent',
        opacity: disabled ? 0.3 : 1,
      })}
    >
      {busy ? <ActivityIndicator size="small" color={tone} /> : <Feather name={icon} size={18} color={tone} />}
    </Pressable>
  );
}

/** Compact pill button for in-card actions. */
export function SmallButton({ label, icon, onPress, variant = 'outline', disabled, loading, style }: {
  label: string; icon?: FeatherIconName; onPress: () => void; variant?: 'brand' | 'outline' | 'danger';
  disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const fg = variant === 'brand' ? T.onBrand : variant === 'danger' ? T.err : T.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [{
        minHeight: 44, paddingHorizontal: 16, borderRadius: R.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: variant === 'brand' ? (pressed ? T.brandDark : T.brand) : pressed ? T.bgInputActive : 'transparent',
        borderWidth: variant === 'brand' ? 0 : 1, borderColor: variant === 'danger' ? withAlpha(T.err, 0.5) : T.line,
        opacity: disabled ? 0.4 : 1,
      }, style]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon && <Feather name={icon} size={15} color={fg} />}
      <Text numberOfLines={1} style={{ color: fg, fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

/** Product / category picture or a neutral placeholder tile. */
export function Thumb({ uri, size = 48, icon = 'image' }: { uri?: string | null; size?: number; icon?: FeatherIconName }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', backgroundColor: withAlpha(T.textFaint, 0.15), alignItems: 'center', justifyContent: 'center' }}>
      {uri && !failed
        ? <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
        : <Feather name={icon} size={Math.round(size * 0.4)} color={T.textFaint} />}
    </View>
  );
}

/** Pressable list row card. */
export function RowCard({ onPress, children, label, style }: { onPress?: () => void; children: React.ReactNode; label?: string; style?: StyleProp<ViewStyle> }) {
  const base: ViewStyle = { backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, padding: SP.md, marginBottom: SP.sm };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [base, pressed && { backgroundColor: T.bgInputActive }, style]}>
      {children}
    </Pressable>
  );
}

// ── Pickers & sheets ────────────────────────────────────────────────────

export interface PickOption<V> { value: V; label: string; indent?: boolean; hint?: string }

/** A form field that opens a bottom sheet of options. */
export function PickerField<V extends string | number | null>({ label, value, options, onChange, placeholder = 'Choose…', error }: {
  label: string; value: V; options: PickOption<V>[]; onChange: (v: V) => void; placeholder?: string; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        accessibilityHint={error}
        style={{
          minHeight: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderRadius: 12,
          backgroundColor: T.bgInput, borderWidth: 1, borderColor: error ? T.err : T.line,
        }}
      >
        <Text numberOfLines={1} style={{ flex: 1, color: current ? T.text : T.textFaint, fontSize: 15 }}>{current?.label ?? placeholder}</Text>
        <Feather name="chevron-down" size={18} color={T.textSub} />
      </Pressable>
      {!!error && <Text style={{ color: T.err, fontSize: 12, marginTop: 4 }}>{error}</Text>}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingVertical: SP.sm }}>
          {options.map(o => {
            const on = o.value === value;
            return (
              <Pressable
                key={String(o.value)}
                onPress={() => { onChange(o.value); setOpen(false); }}
                accessibilityRole="button"
                accessibilityLabel={o.label}
                accessibilityState={{ selected: on }}
                style={({ pressed }) => ({
                  minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: SP.sm,
                  paddingLeft: o.indent ? 44 : 20, paddingRight: 20, backgroundColor: pressed ? T.bgInputActive : 'transparent',
                })}
              >
                {o.indent && <Feather name="corner-down-right" size={14} color={T.textFaint} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: on ? T.brand : T.text, fontSize: 15, fontWeight: on ? '700' : '400' }}>{o.label}</Text>
                  {o.hint && <Text style={{ color: T.textFaint, fontSize: 12 }}>{o.hint}</Text>}
                </View>
                {on && <Feather name="check" size={18} color={T.brand} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

/** Shop-admin confirmation: shared ConfirmSheet with "Keep it" as the cancel label. */
export function ConfirmSheet(props: ConfirmSheetProps) {
  return <SharedConfirmSheet cancelLabel="Keep it" {...props} />;
}

/** Form sheet: scrollable body with a sticky save button. */
export function FormSheet({ visible, title, onClose, onSave, saveLabel, saving, error, children }: {
  visible: boolean; title: string; onClose: () => void; onSave: () => void; saveLabel: string; saving?: boolean;
  error?: string | null; children: React.ReactNode;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} style={{ maxHeight: '92%' }}
      rightAction={{ label: 'Cancel', onPress: onClose }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: SP.xl, paddingBottom: SP.md }}>
        {children}
      </ScrollView>
      <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.sm, gap: SP.sm }}>
        {!!error && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 13 }}>{error}</Text>}
        <PrimaryButton label={saveLabel} onPress={onSave} loading={saving} />
      </View>
    </BottomSheet>
  );
}

// ── States ──────────────────────────────────────────────────────────────

export function ErrorView({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <EmptyState icon="alert-triangle" tone="error" title="Couldn't load this" subtitle={apiErrorText(error)} action={{ label: 'Try again', onPress: onRetry }} />;
}

/** Small numeric input used in stock rows. */
export function NumberBox({ value, onChangeText, label, width = 64, invalid }: {
  value: string; onChangeText: (v: string) => void; label: string; width?: number; invalid?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={t => onChangeText(t.replace(/[^0-9]/g, ''))}
      keyboardType="number-pad"
      accessibilityLabel={label}
      selectTextOnFocus
      style={{
        width, height: 44, borderRadius: 10, borderWidth: 1, borderColor: invalid ? T.err : T.line,
        backgroundColor: T.bg, color: T.text, textAlign: 'center', fontSize: 15, fontWeight: '700',
      }}
    />
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Copy on web; share sheet on native (no clipboard module in this app). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    await Share.share({ message: text });
    return false;
  } catch {
    return false;
  }
}

/** '' → null, otherwise a number (NaN when not numeric). */
export const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

/** Keeps digits and one decimal point. */
export const decimalOnly = (s: string) => s.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

/** The value, settled for `ms` (search boxes). */
export function useDebounced<V>(value: V, ms = 350): V {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Flat admin category list → parents (by sort order) each followed by their children. */
export function orderCategories(list: ShopCategory[]): ShopCategory[] {
  const bySort = (a: ShopCategory, b: ShopCategory) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  const ids = new Set(list.map(c => c.id));
  const roots = list.filter(c => !c.parentId || !ids.has(c.parentId)).sort(bySort);
  return roots.flatMap(p => [p, ...list.filter(c => c.parentId === p.id).sort(bySort)]);
}
