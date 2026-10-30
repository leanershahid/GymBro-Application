import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { T, withAlpha } from '../../../theme';
import { apiErrorText } from '../../../api/apiError';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../dashboard/components/EmptyState';
import { useModuleTree, useSaveUserOverrides, useUserAccess } from '../../access/api/accessQueries';
import PermissionCard, { BulkButton, SaveBar, orderTree } from '../../access/components/ModuleTreeRowCard';
import { ModuleGrant, UserOverride } from '../../access/types/access.types';

interface Props {
  userId: number;
  /** Text above the module list. Defaults to the standard copy. */
  intro?: string;
}

type Mode = 'role' | 'allow' | 'deny';
type Draft = Record<string, UserOverride>;
type Flag = 'view' | 'canAdd' | 'canEdit' | 'canDelete';
const CELLS: { key: Flag; label: string }[] = [
  { key: 'view', label: 'View' }, { key: 'canAdd', label: 'Create' }, { key: 'canEdit', label: 'Edit' }, { key: 'canDelete', label: 'Delete' },
];
const MODES: { key: Mode; label: string }[] = [
  { key: 'role', label: 'Role' }, { key: 'allow', label: 'Allow' }, { key: 'deny', label: 'Deny' },
];

/** What the person's roles give for a module, as per-person override flags. */
const fromRole = (key: string, g?: ModuleGrant): UserOverride =>
  ({ moduleKey: key, isEnabled: true, canAdd: !!g?.canCreate, canEdit: !!g?.canEdit, canDelete: !!g?.canDelete });
const sameOverride = (a?: UserOverride, b?: UserOverride) =>
  (!a && !b) || (!!a && !!b && a.isEnabled === b.isEnabled && a.canAdd === b.canAdd && a.canEdit === b.canEdit && a.canDelete === b.canDelete);

function ModeSwitch({ value, name, onChange }: { value: Mode; name: string; onChange: (m: Mode) => void }) {
  return (
    <View style={{ flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: T.line, overflow: 'hidden' }}>
      {MODES.map(m => {
        const active = m.key === value;
        const tone = m.key === 'deny' ? T.err : T.brand;
        return (
          <Pressable
            key={m.key}
            onPress={() => onChange(m.key)}
            accessibilityRole="radio"
            accessibilityLabel={`${name}: ${m.label}`}
            accessibilityState={{ checked: active }}
            style={{
              minHeight: 36, minWidth: 46, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center',
              backgroundColor: active ? withAlpha(tone, 0.2) : 'transparent',
            }}
          >
            <Text style={{ color: active ? tone : T.textSub, fontSize: 12, fontWeight: '700' }}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * One person's access — shared by ManageUserAccessPage and TrainerDetailPage's "Access" tab.
 * Every module shows its View / Create / Edit / Delete. By default they follow the person's roles
 * ("Role", shown greyed); tapping a box, or picking Allow or Deny, overrides that module for this
 * person only.
 */
export default function AccessPanel({ userId, intro }: Props) {
  const accessQ = useUserAccess(userId);
  const app = accessQ.data?.app;
  const treeQ = useModuleTree(app);
  const save = useSaveUserOverrides(userId);

  const rows = useMemo(() => orderTree((treeQ.data ?? []).filter(r => r.app === app)), [treeQ.data, app]);
  const roleGrants = useMemo(
    () => Object.fromEntries((accessQ.data?.fromRoles ?? []).map(g => [g.moduleKey, g])) as Record<string, ModuleGrant>,
    [accessQ.data],
  );
  const saved = useMemo<Draft>(
    () => Object.fromEntries((accessQ.data?.overrides ?? []).map(o => [o.moduleKey, o])),
    [accessQ.data],
  );
  const [draft, setDraft] = useState<Draft>({});
  useEffect(() => { setDraft(saved); }, [saved]);

  const dirtyCount = rows.filter(r => !sameOverride(draft[r.key], saved[r.key])).length;
  const overridden = rows.filter(r => draft[r.key]).length;

  const update = (fn: (next: Draft) => void) => setDraft(prev => { const next = { ...prev }; fn(next); return next; });

  const setMode = (key: string, mode: Mode) => update(next => {
    if (mode === 'role') delete next[key];
    else if (mode === 'deny') next[key] = { moduleKey: key, isEnabled: false, canAdd: false, canEdit: false, canDelete: false };
    // Allow starts from what the role gives (or everything, when the role gives nothing).
    else next[key] = roleGrants[key] ? fromRole(key, roleGrants[key])
      : { moduleKey: key, isEnabled: true, canAdd: true, canEdit: true, canDelete: true };
  });

  /** Tapping a box overrides the module for this person, starting from what they have now. */
  const toggleCell = (key: string, flag: Flag, current: UserOverride) => update(next => {
    if (flag === 'view') {
      next[key] = current.isEnabled
        ? { moduleKey: key, isEnabled: false, canAdd: false, canEdit: false, canDelete: false }
        : { ...current, isEnabled: true };
      return;
    }
    next[key] = { ...current, isEnabled: true, [flag]: !current[flag] };
  });

  const onSave = () => save.mutate(Object.values(draft), {
    onError: (e) => Alert.alert('Could not save', apiErrorText(e)),
  });

  if (accessQ.isLoading || treeQ.isLoading) return <LoadingState label="Loading access" />;
  if (accessQ.isError || treeQ.isError) {
    return <EmptyState icon="wifi-off" tone="error" title="Couldn't load access"
      action={{ label: 'Retry', onPress: () => { accessQ.refetch(); treeQ.refetch(); } }} />;
  }

  return (
    <>
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{
          padding: 14, borderRadius: 16, marginBottom: 12, gap: 6,
          backgroundColor: withAlpha(T.brand, 0.06), borderWidth: 1, borderColor: withAlpha(T.brand, 0.2),
        }}>
          <Text style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>
            {overridden === 0 ? 'Follows their role for everything' : `${overridden} module${overridden === 1 ? '' : 's'} set for this person`}
          </Text>
          <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>
            {intro ?? 'Greyed ticks come from their role. Tap any box, or pick Allow or Deny, to change a module for this person only.'}
          </Text>
        </View>

        {overridden > 0 && (
          <View style={{ flexDirection: 'row', marginBottom: 14 }}>
            <BulkButton label="Reset all to role" icon="rotate-ccw" onPress={() => setDraft({})} />
          </View>
        )}

        {rows.map(row => {
          const o = draft[row.key];
          const mode: Mode = o ? (o.isEnabled ? 'allow' : 'deny') : 'role';
          const viaRole = roleGrants[row.key];
          // What the person has for this module right now (override, else role).
          const current: UserOverride = o ?? (viaRole ? fromRole(row.key, viaRole)
            : { moduleKey: row.key, isEnabled: false, canAdd: false, canEdit: false, canDelete: false });
          const note = mode === 'role'
            ? (viaRole ? 'Inherited from role' : 'Not in their role')
            : mode === 'allow' ? 'Allowed for this person' : 'Denied for this person';
          return (
            <PermissionCard
              key={row.key}
              row={row}
              active={current.isEnabled}
              note={note}
              control={<ModeSwitch value={mode} name={row.name} onChange={m => setMode(row.key, m)} />}
              cells={CELLS.map(c => ({
                key: c.key,
                label: c.label,
                value: c.key === 'view' ? current.isEnabled : current.isEnabled && current[c.key],
                // Role values are shown greyed but stay tappable — a tap turns them into an override.
                muted: mode === 'role',
                onPress: () => toggleCell(row.key, c.key, current),
              }))}
            />
          );
        })}
      </ScrollView>
      <SaveBar dirtyCount={dirtyCount} saving={save.isPending} onSave={onSave} onDiscard={() => setDraft(saved)} />
    </>
  );
}
