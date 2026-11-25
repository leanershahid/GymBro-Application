import React from 'react';
import { View, Text, Pressable, TextInput, KeyboardTypeOptions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';

// Small building blocks shared by the plan builder screens (feature-only UI).

export type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

/** Square icon button (move, remove, more…) with a 44pt hit area. */
export function IconBtn({ icon, label, onPress, disabled, tone = 'default', size = 32 }: {
  icon: FeatherIconName; label: string; onPress: () => void; disabled?: boolean; tone?: 'default' | 'danger' | 'brand'; size?: number;
}) {
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
      <Feather name={icon} size={Math.round(size * 0.5)} color={c} />
    </Pressable>
  );
}

/** Pill chip (filters, week tabs, options). */
export function Chip({ label, active, onPress, icon, a11y, small }: {
  label: string; active?: boolean; onPress: () => void; icon?: FeatherIconName; a11y?: string; small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected: !!active }}
      style={{
        minHeight: small ? 32 : 36, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12,
        borderRadius: R.pill, backgroundColor: active ? T.brand : T.bgInputActive,
        borderWidth: 1, borderColor: active ? T.brand : T.line,
      }}
    >
      {icon && <Feather name={icon} size={13} color={active ? T.onBrand : T.textSub} />}
      <Text numberOfLines={1} style={{ color: active ? T.onBrand : T.textSub, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

/** Checkbox row used by the multi-select pickers. */
export function CheckRow({ label, sub, checked, onPress, disabled, right }: {
  label: string; sub?: string | null; checked: boolean; onPress: () => void; disabled?: boolean; right?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 52, paddingHorizontal: SP.md, paddingVertical: SP.sm,
        marginBottom: SP.sm, borderRadius: R.md, opacity: disabled ? 0.4 : 1,
        backgroundColor: checked ? withAlpha(T.brand, 0.10) : T.bgInputActive,
        borderWidth: 1, borderColor: checked ? withAlpha(T.brand, 0.4) : T.line,
      }}
    >
      <View style={{
        width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
        backgroundColor: checked ? T.brand : 'transparent', borderWidth: 1.5, borderColor: checked ? T.brand : T.textFaint,
      }}>
        {checked && <Feather name="check" size={14} color={T.onBrand} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
        {!!sub && <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>{sub}</Text>}
      </View>
      {right}
    </Pressable>
  );
}

export interface MenuAction { icon: FeatherIconName; label: string; onPress: () => void; danger?: boolean; disabled?: boolean }

/** A list of actions in a bottom sheet (the ⋯ menus). Runs the action after the sheet has closed. */
export function ActionSheet({ visible, title, actions, onClose }: { visible: boolean; title: string; actions: MenuAction[]; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.md }}>
        {actions.map(a => (
          <Pressable
            key={a.label}
            disabled={a.disabled}
            onPress={() => { onClose(); setTimeout(a.onPress, 250); }}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            accessibilityState={{ disabled: !!a.disabled }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 50, paddingHorizontal: SP.md,
              borderRadius: R.md, backgroundColor: pressed ? T.bgInputActive : 'transparent', opacity: a.disabled ? 0.4 : 1,
            })}
          >
            <Feather name={a.icon} size={18} color={a.danger ? T.err : T.textSub} />
            <Text style={{ color: a.danger ? T.err : T.text, fontSize: 15, fontWeight: '600' }}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

/** Tiny numeric cell of the set table. */
export function CellInput({ value, onChangeText, placeholder, width, label, keyboardType = 'decimal-pad', editable = true }: {
  value: string; onChangeText: (v: string) => void; placeholder?: string; width: number; label: string;
  keyboardType?: KeyboardTypeOptions; editable?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={T.textDisabled}
      keyboardType={keyboardType}
      editable={editable}
      accessibilityLabel={label}
      selectTextOnFocus
      style={{
        width, height: 34, borderRadius: R.sm, textAlign: 'center', color: T.text, fontSize: 13, fontWeight: '600',
        backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line, paddingHorizontal: 2,
      }}
    />
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: SP.sm }}>{children}</Text>;
}

/** Small grey pill with an icon (weeks, days, minutes…). */
export function MetaPill({ icon, label }: { icon: FeatherIconName; label: string }) {
  return (
    <View style={{ backgroundColor: T.bgInputActive, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: T.line, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Feather name={icon} size={11} color={T.textFaint} />
      <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
