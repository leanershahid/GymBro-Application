import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text } from 'react-native';
import { T } from '../../../theme';
import { apiErrorText } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import PrimaryButton from '../../common/components/PrimaryButton';
import EmptyState from '../../dashboard/components/EmptyState';
import { useRoles } from '../api/moduleAccessQueries';
import { useModuleTree, useRoleGrants, useSaveRoleGrants } from '../../access/api/accessQueries';
import ModuleTreeRowCard, { FlagChip, descendantsOf, orderTree } from '../../access/components/ModuleTreeRowCard';
import { ModuleGrant } from '../../access/types/access.types';

interface Props {
  onBack?: () => void;
  /** Open with this role selected. */
  initialRoleId?: number;
}

type Draft = Record<string, ModuleGrant>;
type Flag = 'canCreate' | 'canEdit' | 'canDelete' | 'canExport';
const FLAGS: { key: Flag; label: string }[] = [
  { key: 'canCreate', label: 'Create' },
  { key: 'canEdit',   label: 'Edit' },
  { key: 'canDelete', label: 'Delete' },
  { key: 'canExport', label: 'Export' },
];
/** The admin role always keeps these, or nobody in the gym could manage access again (the API enforces it too). */
const ADMIN_LOCKED = new Set(['admin.roles', 'admin.user-access']);

const grantFor = (key: string, on: boolean): ModuleGrant =>
  ({ moduleKey: key, canView: on, canCreate: on, canEdit: on, canDelete: on, canExport: on });

/**
 * Role access: which modules every holder of a role gets. Shows the module tree of the app the
 * role signs in to — Trainer → trainer app, Client → member app, every other role → admin app.
 * Turning a module on or off turns its submenus and tabs with it; each can then be set on its own.
 */
export default function ModuleAccessPage({ onBack, initialRoleId }: Props) {
  const { data: rawRoles = [], isLoading: rolesLoading, isError: rolesError, refetch: refetchRoles } = useRoles();
  const roles = useMemo(
    () => rawRoles
      .filter(r => r.slug?.toLowerCase() !== 'superadmin')
      .map(r => ({ id: Number(r.id), name: r.name }))
      .filter(r => Number.isFinite(r.id) && r.id > 0),
    [rawRoles],
  );
  const [pickedRoleId, setPickedRoleId] = useState<number | null>(initialRoleId ?? null);
  const roleId = (pickedRoleId != null && roles.some(r => r.id === pickedRoleId) ? pickedRoleId : null) ?? roles[0]?.id ?? 0;

  const grantsQ = useRoleGrants(roleId);
  const app = grantsQ.data?.app;
  const treeQ = useModuleTree(app);
  const save = useSaveRoleGrants(roleId);
  const isAdminRole = grantsQ.data?.roleSlug === 'admin';

  const rows = useMemo(
    () => orderTree((treeQ.data ?? []).filter(r => r.app === app && (isAdminRole || !r.adminOnly))),
    [treeQ.data, app, isAdminRole],
  );

  const [draft, setDraft] = useState<Draft>({});
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!grantsQ.data) return;
    setDraft(Object.fromEntries(grantsQ.data.grants.map(g => [g.moduleKey, g])));
    setDirty(false);
  }, [grantsQ.data]);

  const toggle = (key: string, on: boolean) => {
    setDraft(prev => {
      const next = { ...prev };
      for (const k of [key, ...descendantsOf(rows, key)])
        if (!(isAdminRole && ADMIN_LOCKED.has(k))) next[k] = grantFor(k, on);
      return next;
    });
    setDirty(true);
  };
  const setFlag = (key: string, flag: Flag) => {
    setDraft(prev => ({ ...prev, [key]: { ...prev[key], [flag]: !prev[key]?.[flag] } }));
    setDirty(true);
  };

  const onSave = () => save.mutate(Object.values(draft).filter(g => g.canView), {
    onSuccess: () => setDirty(false),
    onError: (e) => Alert.alert('Could not save', apiErrorText(e)),
  });

  const loading = rolesLoading || grantsQ.isLoading || treeQ.isLoading;
  const appLabel = app === 'trainer' ? 'trainer app' : app === 'member' ? 'member app' : 'admin app';

  return (
    <Screen>
      <ScreenHeader eyebrow="Role access" title={grantsQ.data?.roleName ?? 'Module access'} onBack={onBack} />

      {/* Role picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12 }}>
        {roles.map(r => {
          const active = r.id === roleId;
          return (
            <Pressable
              key={r.id}
              onPress={() => {
                if (r.id === roleId) return;
                if (!dirty) { setPickedRoleId(r.id); return; }
                Alert.alert('Discard changes?', 'Your unsaved changes to this role will be lost.', [
                  { text: 'Keep editing', style: 'cancel' },
                  { text: 'Discard', style: 'destructive', onPress: () => setPickedRoleId(r.id) },
                ]);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={r.name}
              style={{
                minHeight: 40, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center',
                backgroundColor: active ? T.brand : T.bgInput, borderWidth: 1, borderColor: active ? T.brand : T.line,
              }}
            >
              <Text style={{ color: active ? T.onBrand : T.textSub, fontSize: 13, fontWeight: '700' }}>{r.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {rolesError ? (
        <EmptyState icon="wifi-off" tone="error" title="Couldn't load roles" action={{ label: 'Retry', onPress: () => refetchRoles() }} />
      ) : loading ? (
        <LoadingState label="Loading access" />
      ) : grantsQ.isError || treeQ.isError ? (
        <EmptyState icon="wifi-off" tone="error" title="Couldn't load access" action={{ label: 'Retry', onPress: () => { grantsQ.refetch(); treeQ.refetch(); } }} />
      ) : (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
          <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
            Everyone with this role sees what is switched on here in the {appLabel}. A person can still be
            given more or less from their own access screen.
          </Text>

          {rows.map(row => {
            const g = draft[row.key];
            const on = !!g?.canView;
            const locked = isAdminRole && ADMIN_LOCKED.has(row.key);
            return (
              <ModuleTreeRowCard
                key={row.key}
                row={row}
                active={on}
                note={locked ? 'Always on for admins' : undefined}
                toggle={locked ? undefined : { value: on, onChange: v => toggle(row.key, v) }}
                control={locked ? <Text style={{ color: T.brand, fontSize: 12, fontWeight: '700' }}>On</Text> : undefined}
              >
                {!locked && FLAGS.map(f => (
                  <FlagChip key={f.key} label={f.label} value={!!g?.[f.key]} onPress={() => setFlag(row.key, f.key)} />
                ))}
              </ModuleTreeRowCard>
            );
          })}

          <PrimaryButton
            label={save.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            onPress={onSave}
            loading={save.isPending}
            disabled={!dirty}
            accessibilityHint="Saves the module access for this role"
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      )}
    </Screen>
  );
}
