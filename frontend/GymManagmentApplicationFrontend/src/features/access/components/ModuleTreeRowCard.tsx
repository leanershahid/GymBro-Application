import React from 'react';
import { Pressable, Text, View } from 'react-native';
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

const kindOf = (row: ModuleTreeRow) =>
  row.isTab ? 'Tab' : row.hideFromMenu ? 'Inner page' : row.level === 1 ? 'Main menu' : 'Submenu';

export interface PermissionCell {
  key: string;
  label: string;
  value: boolean;
  /** Shown but not changeable. */
  disabled?: boolean;
  /** Drawn greyed (e.g. inherited from the role) but still tappable. */
  muted?: boolean;
  onPress?: () => void;
}

/** One permission as a labelled check box; every action always shows, so nothing is hidden. */
function Cell({ cell, moduleName }: { cell: PermissionCell; moduleName: string }) {
  const { value, disabled } = cell;
  const dim = disabled || cell.muted;
  return (
    <Pressable
      onPress={cell.onPress}
      disabled={disabled || !cell.onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={`${moduleName}: ${cell.label}`}
      accessibilityState={{ checked: value, disabled: disabled || !cell.onPress }}
      hitSlop={4}
      style={({ pressed }) => ({
        flex: 1, minWidth: 0, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 4,
        borderRadius: 12, borderWidth: 1,
        borderColor: value ? withAlpha(T.brand, dim ? 0.2 : 0.45) : T.line,
        backgroundColor: pressed ? withAlpha(T.brand, 0.16) : value ? withAlpha(T.brand, dim ? 0.06 : 0.12) : 'transparent',
        opacity: dim && !value ? 0.45 : 1,
      })}
    >
      <View style={{
        width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
        borderWidth: value ? 0 : 1.5, borderColor: T.textFaint,
        backgroundColor: value ? (dim ? withAlpha(T.brand, 0.5) : T.brand) : 'transparent',
      }}>
        {value && <Feather name="check" size={13} color={T.onBrand} />}
      </View>
      <Text numberOfLines={1} style={{ color: value ? T.text : T.textSub, fontSize: 11, fontWeight: '700' }}>{cell.label}</Text>
    </Pressable>
  );
}

interface Props {
  row: ModuleTreeRow;
  /** Highlights the card (the module is on for this role/person). */
  active: boolean;
  /** Small text under the name — e.g. "Inherited from role". Defaults to the module's kind. */
  note?: string;
  /** Right of the name: a switch, a Role/Allow/Deny picker, … */
  control?: React.ReactNode;
  /** The action row — View, Create, Edit, Delete (, Export). Always shown. */
  cells: PermissionCell[];
}

/** One module in an access tree, nested under its parent, with every permission visible. */
export default function PermissionCard({ row, active, note, control, cells }: Props) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 10 }}>
      {/* Tree guide for nested modules */}
      {Array.from({ length: row.level - 1 }, (_, i) => (
        <View key={i} style={{ width: 14, alignItems: 'center' }}>
          <View style={{ width: 2, flex: 1, borderRadius: 1, backgroundColor: T.lineSubtle }} />
        </View>
      ))}
      <View style={{
        flex: 1, padding: 14, borderRadius: R.lg, gap: 12,
        backgroundColor: T.bgInput, borderWidth: 1, borderColor: active ? withAlpha(T.brand, 0.35) : T.line,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
            backgroundColor: active ? T.brandDim : withAlpha(T.textFaint, 0.12),
            borderWidth: 1, borderColor: active ? T.brandBorder : T.line,
          }}>
            <Feather name={moduleIcon(row.icon)} size={16} color={active ? T.brand : T.textFaint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{row.name}</Text>
            <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>{note ?? kindOf(row)}</Text>
          </View>
          {control}
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {cells.map(c => <Cell key={c.key} cell={c} moduleName={row.name} />)}
        </View>
      </View>
    </View>
  );
}

/** A bar pinned under a scrolling list: what is unsaved, and the Save button. */
export function SaveBar({ dirtyCount, saving, onSave, onDiscard }: {
  dirtyCount: number; saving: boolean; onSave: () => void; onDiscard: () => void;
}) {
  const dirty = dirtyCount > 0;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12,
      borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.bgNav,
    }}>
      <Text style={{ flex: 1, color: dirty ? T.text : T.textSub, fontSize: 13, fontWeight: '600' }}>
        {saving ? 'Saving…' : dirty ? `${dirtyCount} unsaved change${dirtyCount === 1 ? '' : 's'}` : 'All changes saved'}
      </Text>
      {dirty && !saving && (
        <Pressable onPress={onDiscard} hitSlop={8} accessibilityRole="button" accessibilityLabel="Discard changes"
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={{ color: T.textSub, fontSize: 14, fontWeight: '700' }}>Discard</Text>
        </Pressable>
      )}
      <Pressable
        onPress={onSave}
        disabled={!dirty || saving}
        accessibilityRole="button"
        accessibilityLabel="Save changes"
        accessibilityState={{ disabled: !dirty || saving, busy: saving }}
        style={({ pressed }) => ({
          minHeight: 44, paddingHorizontal: 22, borderRadius: 999, justifyContent: 'center',
          backgroundColor: !dirty ? withAlpha(T.brand, 0.25) : pressed ? T.brandDark : T.brand,
        })}
      >
        <Text style={{ color: T.onBrand, fontSize: 14, fontWeight: '800' }}>Save</Text>
      </Pressable>
    </View>
  );
}

/** Small pill button for bulk actions above the list ("Allow everything", "Clear all", …). */
export function BulkButton({ label, icon, onPress }: { label: string; icon: React.ComponentProps<typeof Feather>['name']; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 999,
        borderWidth: 1, borderColor: T.line, backgroundColor: pressed ? T.bgInputActive : T.bgInput,
      })}
    >
      <Feather name={icon} size={14} color={T.textSub} />
      <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
