import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { R, T, withAlpha } from '../../../theme';
import { moduleIcon } from '../context/AccessContext';
import { ModuleTreeRow } from '../types/access.types';

/** Module tree rows in display order — each parent followed by its children, depth-first. */
export function orderTree(rows: ModuleTreeRow[]): ModuleTreeRow[] {
  const byParent = new Map<string | null, ModuleTreeRow[]>();
  for (const r of rows) byParent.set(r.parentKey, [...(byParent.get(r.parentKey) ?? []), r]);
  const out: ModuleTreeRow[] = [];
  const walk = (parent: string | null) => {
    for (const r of (byParent.get(parent) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)) {
      out.push(r);
      walk(r.key);
    }
  };
  walk(null);
  return out;
}

/** Every module below `key` in the tree. */
export function descendantsOf(rows: ModuleTreeRow[], key: string): string[] {
  const kids = rows.filter(r => r.parentKey === key).map(r => r.key);
  return kids.flatMap(k => [k, ...descendantsOf(rows, k)]);
}

export function FlagChip({ label, value, disabled, onPress }: { label: string; value: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={6}
      style={{
        minHeight: 32, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center',
        borderWidth: 1, borderColor: value ? withAlpha(T.brand, 0.4) : T.line,
        backgroundColor: value ? withAlpha(T.brand, 0.14) : 'transparent',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ color: value ? T.brand : T.textSub, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

interface Props {
  row: ModuleTreeRow;
  /** Highlights the card (the module is granted). */
  active: boolean;
  /** Shown under the name — e.g. "From role: on". */
  note?: string;
  /** The on/off switch; omit to render `control` instead. */
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  control?: React.ReactNode;
  /** Action-flag chips, shown while active. */
  children?: React.ReactNode;
}

/** One module in an access tree, indented by level, with its tab/page/hidden kind spelled out. */
export default function ModuleTreeRowCard({ row, active, note, toggle, control, children }: Props) {
  const kind = row.isTab ? 'Tab' : row.hideFromMenu ? 'Page (opened from inside the app)' : row.level === 1 ? 'Main menu' : 'Submenu';
  return (
    <View
      style={{
        marginLeft: (row.level - 1) * 16, marginBottom: 10, padding: 14, borderRadius: R.lg,
        backgroundColor: T.bgInput, borderWidth: 1, borderColor: active ? withAlpha(T.brand, 0.3) : T.line,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={moduleIcon(row.icon)} size={16} color={T.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{row.name}</Text>
          <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>{note ?? kind}</Text>
        </View>
        {toggle ? (
          <Switch
            value={toggle.value}
            onValueChange={toggle.onChange}
            accessibilityLabel={row.name}
            trackColor={{ false: T.line, true: T.brandDim }}
            thumbColor={toggle.value ? T.brand : T.textFaint}
          />
        ) : control}
      </View>
      {active && children && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.lineSubtle }}>
          {children}
        </View>
      )}
    </View>
  );
}
