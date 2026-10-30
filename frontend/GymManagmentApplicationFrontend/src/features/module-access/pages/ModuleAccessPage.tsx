import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { T, withAlpha } from '../../../theme';
import { apiErrorText } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../dashboard/components/EmptyState';
import { useRoles } from '../api/moduleAccessQueries';
import { useModuleTree, useRoleGrants, useSaveRoleGrants } from '../../access/api/accessQueries';
import PermissionCard, { BulkButton, SaveBar, descendantsOf, orderTree } from '../../access/components/ModuleTreeRowCard';
import AppPicker from '../../access/components/AppPicker';
import { AccessApp, ModuleGrant } from '../../access/types/access.types';

interface Props {
  onBack?: () => void;
  /** Open with this role selected. */
  initialRoleId?: number;
}

type Draft = Record<string, ModuleGrant>;
type Flag = 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canExport';
const FLAGS: { key: Flag; label: string }[] = [
  { key: 'canView',   label: 'View' },
  { key: 'canCreate', label: 'Create' },
  { key: 'canEdit',   label: 'Edit' },
  { key: 'canDelete', label: 'Delete' },
  { key: 'canExport', label: 'Export' },
];
/** The admin role always keeps these, or nobody in the gym could manage access again (the API enforces it too). */
const ADMIN_LOCKED = new Set(['admin.roles', 'admin.user-access']);

const OFF = (key: string): ModuleGrant => ({ moduleKey: key, canView: false, canCreate: false, canEdit: false, canDelete: false, canExport: false });
const FULL = (key: string): ModuleGrant => ({ moduleKey: key, canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true });
const same = (a?: ModuleGrant, b?: ModuleGrant) => FLAGS.every(f => !!a?.[f.key] === !!b?.[f.key]);
const isFull = (g?: ModuleGrant) => FLAGS.every(f => !!g?.[f.key]);
const appLabel = (app?: string) => app === 'trainer' ? 'Training' : app === 'member' ? 'Member' : 'Management';

/**
 * Role access: which modules every holder of a role gets, and what they may do in each. Shows the
 * module tree of the app the role signs in to — Trainer → trainer app, Client → member app, every
 * other role → admin app. Every action is always visible; switching a module off switches off
 * everything under it.
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
  // Any role can be given modules of any app; the picker starts on the app the role signs in to.
  const homeApp = grantsQ.data?.app;
  const [pickedApp, setPickedApp] = useState<AccessApp | null>(null);
  const app = pickedApp ?? homeApp ?? 'admin';
  const treeQ = useModuleTree();
  const save = useSaveRoleGrants(roleId);
  const isAdminRole = grantsQ.data?.roleSlug === 'admin';
  const locked = (key: string) => isAdminRole && ADMIN_LOCKED.has(key);

  const rows = useMemo(
    () => orderTree((treeQ.data ?? []).filter(r => r.app === app && (isAdminRole || !r.adminOnly))),
    [treeQ.data, app, isAdminRole],
  );
  const allRows = useMemo(() => (treeQ.data ?? []).filter(r => isAdminRole || !r.adminOnly), [treeQ.data, isAdminRole]);

  const saved = useMemo<Draft>(
    () => Object.fromEntries((grantsQ.data?.grants ?? []).map(g => [g.moduleKey, g])),
    [grantsQ.data],
  );
  const [draft, setDraft] = useState<Draft>({});
  useEffect(() => { setDraft(saved); }, [saved]);

  const dirtyCount = allRows.filter(r => !same(draft[r.key], saved[r.key])).length;
  const onCount = rows.filter(r => draft[r.key]?.canView).length;

  const update = (fn: (next: Draft) => void) => setDraft(prev => { const next = { ...prev }; fn(next); return next; });

  /** View off switches the module and everything under it off; any action switches View on. */
  const setFlag = (key: string, flag: Flag, value: boolean) => update(next => {
    if (flag === 'canView' && !value) {
      for (const k of [key, ...descendantsOf(rows, key)]) if (!locked(k)) next[k] = OFF(k);
      return;
    }
    next[key] = { ...(next[key] ?? OFF(key)), [flag]: value, canView: true };
  });
  /** "All" on a module: everything on (for it and what is under it), or everything off when already full. */
  const toggleAll = (key: string) => update(next => {
    const on = !isFull(next[key]);
    for (const k of [key, ...descendantsOf(rows, key)]) if (!locked(k)) next[k] = on ? FULL(k) : OFF(k);
  });
  const setEverything = (make: (k: string) => ModuleGrant) => update(next => {
    for (const r of rows) if (!locked(r.key)) next[r.key] = make(r.key);
  });

  const onSave = () => save.mutate(Object.values(draft).filter(g => g.canView), {
    onError: (e) => Alert.alert('Could not save', apiErrorText(e)),
  });

  const pickRole = (id: number) => {
    if (id === roleId) return;
    const go = () => { setPickedRoleId(id); setPickedApp(null); };
    if (!dirtyCount) { go(); return; }
    Alert.alert('Discard changes?', 'Your unsaved changes to this role will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: go },
    ]);
  };

  const loading = rolesLoading || grantsQ.isLoading || treeQ.isLoading;

  return (
    <Screen>
      <ScreenHeader eyebrow="Role access" title={grantsQ.data?.roleName ?? 'Module access'} onBack={onBack} />

      {/* Role picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12 }}>
        {roles.map(r => {
          const active = r.id === roleId;
          return (
            <Pressable
              key={r.id}
              onPress={() => pickRole(r.id)}
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
        <EmptyState icon="wifi-off" tone="error" title="Couldn't load access"
          action={{ label: 'Retry', onPress: () => { grantsQ.refetch(); treeQ.refetch(); } }} />
      ) : (
        <>
          <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            <AppPicker value={app} home={homeApp} onChange={setPickedApp} />

            {/* Summary */}
            <View style={{
              padding: 14, borderRadius: 16, marginBottom: 12, gap: 6,
              backgroundColor: withAlpha(T.brand, 0.06), borderWidth: 1, borderColor: withAlpha(T.brand, 0.2),
            }}>
              <Text style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>
                {appLabel(app)} · {onCount} of {rows.length} modules on
              </Text>
              <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>
                Everyone with this role gets what is ticked here. A person can still be given more or less from
                their own access screen.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              <BulkButton label="Allow everything" icon="check-square" onPress={() => setEverything(FULL)} />
              <BulkButton label="View only" icon="eye" onPress={() => setEverything(k => ({ ...OFF(k), canView: true }))} />
              <BulkButton label="Clear all" icon="x-square" onPress={() => setEverything(OFF)} />
            </View>

            {rows.map(row => {
              const g = draft[row.key];
              const isLocked = locked(row.key);
              return (
                <PermissionCard
                  key={row.key}
                  row={row}
                  active={!!g?.canView}
                  note={isLocked ? 'Always on for admins' : undefined}
                  control={!isLocked && (
                    <Pressable
                      onPress={() => toggleAll(row.key)}
                      accessibilityRole="button"
                      accessibilityLabel={isFull(g) ? `Turn off ${row.name}` : `Allow everything in ${row.name}`}
                      hitSlop={6}
                      style={{
                        minHeight: 36, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center',
                        borderWidth: 1, borderColor: isFull(g) ? withAlpha(T.brand, 0.45) : T.line,
                        backgroundColor: isFull(g) ? withAlpha(T.brand, 0.14) : 'transparent',
                      }}
                    >
                      <Text style={{ color: isFull(g) ? T.brand : T.textSub, fontSize: 12, fontWeight: '800' }}>
                        {isFull(g) ? 'All ✓' : 'All'}
                      </Text>
                    </Pressable>
                  )}
                  cells={FLAGS.map(f => ({
                    key: f.key,
                    label: f.label,
                    value: !!g?.[f.key],
                    disabled: isLocked,
                    onPress: () => setFlag(row.key, f.key, !g?.[f.key]),
                  }))}
                />
              );
            })}
            <Text style={{ color: T.textFaint, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
              Create, Edit, Delete and Export control the add, edit and delete buttons inside each module, and
              what the server accepts.
            </Text>
          </ScrollView>
          <SaveBar dirtyCount={dirtyCount} saving={save.isPending} onSave={onSave} onDiscard={() => setDraft(saved)} />
        </>
      )}
    </Screen>
  );
}
