import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { T, withAlpha } from '../../../theme';
import { apiErrorText } from '../../../api/apiError';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../dashboard/components/EmptyState';
import { useModuleTree, useSaveUserOverrides, useUserAccess } from '../../access/api/accessQueries';
import ModuleTreeRowCard, { FlagChip, orderTree } from '../../access/components/ModuleTreeRowCard';
import { UserOverride } from '../../access/types/access.types';

interface Props {
  userId: number;
  /** Text above the module list. Defaults to the standard copy. */
  intro?: string;
}

type Mode = 'role' | 'allow' | 'deny';
type Draft = Record<string, UserOverride>;
type Flag = 'canAdd' | 'canEdit' | 'canDelete';
const FLAGS: { key: Flag; label: string }[] = [
  { key: 'canAdd', label: 'Create' }, { key: 'canEdit', label: 'Edit' }, { key: 'canDelete', label: 'Delete' },
];
const MODES: { key: Mode; label: string }[] = [
  { key: 'role', label: 'Role' }, { key: 'allow', label: 'Allow' }, { key: 'deny', label: 'Deny' },
];

function ModeSwitch({ value, name, onChange }: { value: Mode; name: string; onChange: (m: Mode) => void }) {
  return (
    <View style={{ flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: T.line, overflow: 'hidden' }}>
      {MODES.map(m => {
        const active = m.key === value;
        return (
          <Pressable
            key={m.key}
            onPress={() => onChange(m.key)}
            accessibilityRole="radio"
            accessibilityLabel={`${name}: ${m.label}`}
            accessibilityState={{ checked: active }}
            style={{
              minHeight: 36, minWidth: 48, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center',
              backgroundColor: active ? (m.key === 'deny' ? withAlpha(T.err, 0.2) : withAlpha(T.brand, 0.2)) : 'transparent',
            }}
          >
            <Text style={{ color: active ? (m.key === 'deny' ? T.err : T.brand) : T.textSub, fontSize: 12, fontWeight: '700' }}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * One person's access — the reusable body shared by ManageUserAccessPage and TrainerDetailPage's
 * "Access" tab. Each module follows their roles by default ("Role", showing what the roles give),
 * or is overridden for this person only: Allow (with its own create/edit/delete) or Deny.
 */
export default function AccessPanel({ userId, intro }: Props) {
  const accessQ = useUserAccess(userId);
  const app = accessQ.data?.app;
  const treeQ = useModuleTree(app);
  const save = useSaveUserOverrides(userId);

  const rows = useMemo(() => orderTree((treeQ.data ?? []).filter(r => r.app === app)), [treeQ.data, app]);
  const fromRoles = useMemo(() => new Set((accessQ.data?.fromRoles ?? []).map(g => g.moduleKey)), [accessQ.data]);

  const [draft, setDraft] = useState<Draft>({});
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!accessQ.data) return;
    setDraft(Object.fromEntries(accessQ.data.overrides.map(o => [o.moduleKey, o])));
    setDirty(false);
  }, [accessQ.data]);

  const setMode = (key: string, mode: Mode) => {
    setDraft(prev => {
      const next = { ...prev };
      if (mode === 'role') delete next[key];
      else next[key] = { moduleKey: key, isEnabled: mode === 'allow', canAdd: mode === 'allow', canEdit: mode === 'allow', canDelete: mode === 'allow' };
      return next;
    });
    setDirty(true);
  };
  const setFlag = (key: string, flag: Flag) => {
    setDraft(prev => ({ ...prev, [key]: { ...prev[key], [flag]: !prev[key][flag] } }));
    setDirty(true);
  };

  const onSave = () => save.mutate(Object.values(draft), {
    onSuccess: () => setDirty(false),
    onError: (e) => Alert.alert('Could not save', apiErrorText(e)),
  });

  if (accessQ.isLoading || treeQ.isLoading) return <LoadingState label="Loading access" />;
  if (accessQ.isError || treeQ.isError) {
    return <EmptyState icon="wifi-off" tone="error" title="Couldn't load access" action={{ label: 'Retry', onPress: () => { accessQ.refetch(); treeQ.refetch(); } }} />;
  }

  return (
    <>
      <View className="px-5 pb-4">
        <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>
          {intro ?? 'Each module follows this person\'s roles unless you override it here. "Allow" gives it to them even if their roles don\'t; "Deny" hides it even if their roles give it.'}
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {rows.map(row => {
          const o = draft[row.key];
          const mode: Mode = o ? (o.isEnabled ? 'allow' : 'deny') : 'role';
          const viaRole = fromRoles.has(row.key);
          const note = mode === 'role'
            ? `From role: ${viaRole ? 'on' : 'off'}`
            : mode === 'allow' ? 'Allowed for this person' : 'Denied for this person';
          return (
            <ModuleTreeRowCard
              key={row.key}
              row={row}
              active={mode === 'allow' || (mode === 'role' && viaRole)}
              note={note}
              control={<ModeSwitch value={mode} name={row.name} onChange={m => setMode(row.key, m)} />}
            >
              {mode === 'allow' && FLAGS.map(f => (
                <FlagChip key={f.key} label={f.label} value={!!o?.[f.key]} onPress={() => setFlag(row.key, f.key)} />
              ))}
            </ModuleTreeRowCard>
          );
        })}

        <PrimaryButton
          label={save.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          onPress={onSave}
          loading={save.isPending}
          disabled={!dirty}
          accessibilityHint="Saves the access changes for this account"
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </>
  );
}
