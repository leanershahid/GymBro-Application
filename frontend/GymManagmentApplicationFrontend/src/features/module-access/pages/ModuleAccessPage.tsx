import React, { useState, useCallback, useMemo } from 'react';
import { currentTenantId } from '../../../api/session';
import {
  View, Text, ScrollView, Pressable,
  ActivityIndicator, Alert,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  useModuleKeys, useModuleAccess, useModuleMatrix,
  useUpsertModuleAccess, useDeleteModuleAccess, useDeleteRoleAccess, useRoles,
} from '../api/moduleAccessQueries';
import { ModuleAccessEntry, ModuleAccessPayload } from '../types/moduleAccess.types';
import { T, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../dashboard/components/EmptyState';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];
type ViewTab = 'byRole' | 'matrix';
type Flag = 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canExport';

const FLAGS: { key: Flag; label: string; icon: FeatherIconName }[] = [
  { key: 'canView',   label: 'View',   icon: 'eye'       },
  { key: 'canCreate', label: 'Create', icon: 'plus'      },
  { key: 'canEdit',   label: 'Edit',   icon: 'edit-2'    },
  { key: 'canDelete', label: 'Delete', icon: 'trash-2'   },
  { key: 'canExport', label: 'Export', icon: 'download'  },
];

const FLAG_COLOR: Record<Flag, string> = {
  canView:   T.sky,
  canCreate: T.brand,
  canEdit:   T.brandGold,
  canDelete: T.err,
  canExport: T.violet,
};


// ─── Permission row ───────────────────────────────────────────────
function PermissionRow({
  entry,
  onToggle,
  onDelete,
  saving,
}: {
  entry: ModuleAccessEntry;
  onToggle: (flag: Flag, value: boolean) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  return (
    <View className="bg-surface border border-lineSubtle rounded-2xl mb-3 overflow-hidden">
      {/* Module header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-lineSubtle">
        <View className="flex-row items-center gap-3">
          <View className="w-7 h-7 rounded-lg bg-elevated items-center justify-center">
            <Text className="text-brand text-[11px] font-bold uppercase">{entry.module[0]}</Text>
          </View>
          <Text numberOfLines={1} className="text-white text-[14px] font-bold">{entry.module}</Text>
        </View>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${entry.module} access`}
          className="w-7 h-7 rounded-full items-center justify-center"
          style={{ backgroundColor: withAlpha(T.err, 0.12), borderWidth: 1, borderColor: withAlpha(T.err, 0.25) }}
        >
          <Feather name="trash-2" size={13} color={T.err} />
        </Pressable>
      </View>

      {/* Flag toggles */}
      <View className="flex-row px-4 py-3 gap-2 flex-wrap">
        {FLAGS.map(f => {
          const on = entry[f.key];
          const col = FLAG_COLOR[f.key];
          return (
            <Pressable
              key={f.key}
              onPress={() => !saving && onToggle(f.key, !on)}
              hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
              accessibilityRole="switch"
              accessibilityLabel={`${f.label} permission for ${entry.module}`}
              accessibilityState={{ checked: on, disabled: saving }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                backgroundColor: on ? withAlpha(col, 0.094) : T.bgInputActive,
                borderWidth: 1, borderColor: on ? withAlpha(col, 0.25) : T.line,
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Feather name={f.icon} size={11} color={on ? col : T.textFaint} />
              <Text style={{ color: on ? col : T.textFaint, fontSize: 11, fontWeight: '700' }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
        {saving && <ActivityIndicator size="small" color={T.brand} style={{ marginLeft: 4 }} />}
      </View>
    </View>
  );
}

// ─── Matrix cell ──────────────────────────────────────────────────
function MatrixCell({ has, label }: { has: boolean; label: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${has ? 'yes' : 'no'}`} style={{
      width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
      backgroundColor: has ? withAlpha(T.brand, 0.15) : T.bgInput,
      borderWidth: 1, borderColor: has ? withAlpha(T.brand, 0.30) : T.bgInputActive,
    }}>
      {has && <Feather name="check" size={11} color={T.brand} />}
    </View>
  );
}

// ─── Page ─────────────────────────────────────────────────────────
interface Props { onBack?: () => void; }



export default function ModuleAccessPage({ onBack }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;
  // Each role column holds 5 x 20px cells + 4 x 3px gaps (112px) - leave breathing room.
  const roleColW = isWide ? 140 : 128;

  const [viewTab,        setViewTab]        = useState<ViewTab>('byRole');
  const [pickedRoleId,   setSelectedRoleId] = useState<number | null>(null);
  const [savingModule,   setSavingModule]   = useState<string | null>(null);

  // Roles come from GET /api/roles. Ids are numeric strings; the super-admin role is platform-level, not tenant-configurable.
  const { data: rawRoles = [], isLoading: rolesLoading, isError: rolesError, refetch: refetchRoles } = useRoles();
  const roles = useMemo(
    () => rawRoles
      .filter(r => r.slug?.toLowerCase() !== 'superadmin')
      .map(r => ({ id: Number(r.id), name: r.name }))
      .filter(r => Number.isFinite(r.id) && r.id > 0),
    [rawRoles],
  );
  const selectedRoleId = pickedRoleId ?? roles[0]?.id ?? 0;

  const { data: moduleKeys = [], isLoading: keysLoading } = useModuleKeys();
  const { data: entries = [],    isLoading: entriesLoading, refetch: refetchEntries } =
    useModuleAccess(currentTenantId(), selectedRoleId);
  const { data: matrix,         isLoading: matrixLoading }  = useModuleMatrix(currentTenantId());

  const { mutate: upsert }  = useUpsertModuleAccess();
  const { mutate: delEntry } = useDeleteModuleAccess();
  const { mutate: delRole, isPending: deletingAll } = useDeleteRoleAccess();

  // ── Build a lookup so we can show unconfigured modules ────────
  const configuredModules = new Set(entries.map(e => e.module));
  const unconfiguredKeys  = moduleKeys.filter(k => !configuredModules.has(k));

  // ── Toggle a flag ─────────────────────────────────────────────
  const handleToggle = useCallback((entry: ModuleAccessEntry, flag: Flag, value: boolean) => {
    setSavingModule(entry.module);
    const payload: ModuleAccessPayload = {
      tenantId:  currentTenantId(),
      roleId:    selectedRoleId,
      module:    entry.module,
      canView:   entry.canView,
      canCreate: entry.canCreate,
      canEdit:   entry.canEdit,
      canDelete: entry.canDelete,
      canExport: entry.canExport,
      [flag]:    value,
    };
    upsert(payload, {
      onSuccess: () => setSavingModule(null),
      onError:   () => { setSavingModule(null); Alert.alert('Error', 'Failed to update permission.'); },
    });
  }, [selectedRoleId, upsert]);

  // ── Add a new module for this role ────────────────────────────
  const handleAddModule = useCallback((module: string) => {
    const payload: ModuleAccessPayload = {
      tenantId: currentTenantId(), roleId: selectedRoleId, module,
      canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: false,
    };
    setSavingModule(module);
    upsert(payload, {
      onSuccess: () => setSavingModule(null),
      onError:   () => { setSavingModule(null); Alert.alert('Error', 'Failed to add module.'); },
    });
  }, [selectedRoleId, upsert]);

  // ── Delete single module ──────────────────────────────────────
  const handleDelete = useCallback((module: string) => {
    Alert.alert(
      'Remove access',
      `Remove "${module}" access for this role?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () =>
          delEntry({ tenantId: currentTenantId(), roleId: selectedRoleId, module }, {
            onError: () => Alert.alert('Error', 'Failed to remove access.'),
          })
        },
      ]
    );
  }, [selectedRoleId, delEntry]);

  // ── Delete all for role ───────────────────────────────────────
  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      'Clear all access',
      'Remove ALL module access for this role? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear all', style: 'destructive', onPress: () =>
          delRole({ tenantId: currentTenantId(), roleId: selectedRoleId }, {
            onSuccess: () => Alert.alert('Done', 'All access cleared.'),
            onError:   () => Alert.alert('Error', 'Failed to clear access.'),
          })
        },
      ]
    );
  }, [selectedRoleId, delRole]);

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  if (rolesLoading || rolesError || roles.length === 0) {
    return (
      <Screen>
        <ScreenHeader eyebrow="Admin" title="Module Access" onBack={onBack} />
        {rolesLoading ? (
          <LoadingState label="Loading roles" />
        ) : rolesError ? (
          <EmptyState icon="wifi-off" tone="error" title="Failed to load roles" action={{ label: 'Retry', onPress: () => refetchRoles() }} />
        ) : (
          <EmptyState icon="users" title="No roles found" subtitle="Create roles before configuring module access." />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      {/* ── Header ── */}
      <ScreenHeader eyebrow="Admin" title="Module Access" onBack={onBack} />

      <View className="px-5 pb-4">
        {/* View tab switcher */}
        <SegmentedTabs<ViewTab>
          tabs={[{ key: 'byRole', label: 'By Role' }, { key: 'matrix', label: 'Full Matrix' }]}
          value={viewTab}
          onChange={setViewTab}
          style={{ marginBottom: 16 }}
        />

        {/* Role selector — only for byRole tab */}
        {viewTab === 'byRole' && (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {roles.map(r => {
              const active = r.id === selectedRoleId;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setSelectedRoleId(r.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Role ${r.name}`}
                  accessibilityState={{ selected: active }}
                  style={{
                    minHeight: 44, justifyContent: 'center',
                    paddingHorizontal: 16, borderRadius: 999,
                    backgroundColor: active ? T.brand : T.bgInput,
                    borderWidth: 1, borderColor: active ? T.brand : T.line,
                  }}
                >
                  <Text style={{ color: active ? T.onBrand : T.textSub, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' }}>
                    {r.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ══════════════════════════════════════════════════════════ */}
      {/*  BY-ROLE VIEW                                              */}
      {/* ══════════════════════════════════════════════════════════ */}
      {viewTab === 'byRole' && (
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {/* Role header row */}
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-sub text-[11px] font-semibold uppercase tracking-widest">Role</Text>
              <Text className="text-white text-[20px] font-bold capitalize">{selectedRole?.name}</Text>
            </View>
            <View className="flex-row gap-2">
              {/* Configured count badge */}
              <View
                className="rounded-xl px-3 py-1.5 border"
                style={{ backgroundColor: withAlpha(T.brand, 0.10), borderColor: withAlpha(T.brand, 0.25) }}
              >
                <Text className="text-brand text-[12px] font-bold">{entries.length} modules</Text>
              </View>
              {/* Clear all */}
              {entries.length > 0 && (
                <Pressable
                  onPress={handleDeleteAll}
                  disabled={deletingAll}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Clear all access for ${selectedRole?.name ?? 'role'}`}
                  accessibilityState={{ disabled: deletingAll, busy: deletingAll }}
                  className="rounded-xl px-3 py-1.5 border"
                  style={{ backgroundColor: withAlpha(T.err, 0.10), borderColor: withAlpha(T.err, 0.25) }}
                >
                  {deletingAll
                    ? <ActivityIndicator size="small" color={T.err} />
                    : <Text style={{ color: T.err, fontSize: 12, fontWeight: '700' }}>Clear all</Text>
                  }
                </Pressable>
              )}
            </View>
          </View>

          {/* Loading state */}
          {(entriesLoading || keysLoading) && <LoadingState label="Loading access" />}

          {/* Configured modules */}
          {!entriesLoading && entries.map(entry => (
            <PermissionRow
              key={entry.module}
              entry={entry}
              onToggle={(flag, val) => handleToggle(entry, flag, val)}
              onDelete={() => handleDelete(entry.module)}
              saving={savingModule === entry.module}
            />
          ))}

          {/* Add unconfigured modules section */}
          {!keysLoading && !entriesLoading && unconfiguredKeys.length > 0 && (
            <>
              <View className="flex-row items-center gap-3 my-4">
                <View className="flex-1 h-px bg-lineSubtle" />
                <Text className="text-faint text-[11px] font-semibold uppercase tracking-wider">
                  Add modules
                </Text>
                <View className="flex-1 h-px bg-lineSubtle" />
              </View>

              <View className="flex-row flex-wrap gap-2 mb-6">
                {unconfiguredKeys.map(key => (
                  <Pressable
                    key={key}
                    onPress={() => handleAddModule(key)}
                    disabled={savingModule === key}
                    hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${key} module`}
                    accessibilityState={{ disabled: savingModule === key, busy: savingModule === key }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 12, minHeight: 36,
                      borderRadius: 999, backgroundColor: T.bgInput,
                      borderWidth: 1, borderColor: T.line,
                      opacity: savingModule === key ? 0.5 : 1,
                    }}
                  >
                    {savingModule === key
                      ? <ActivityIndicator size="small" color={T.brand} />
                      : <Feather name="plus" size={12} color={T.brand} />
                    }
                    <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '600' }}>{key}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* Empty state */}
          {!entriesLoading && !keysLoading && entries.length === 0 && unconfiguredKeys.length === 0 && (
            <EmptyState icon="lock" title="No access configured" subtitle="Add modules above to grant this role access." />
          )}
        </ScrollView>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/*  MATRIX VIEW                                               */}
      {/* ══════════════════════════════════════════════════════════ */}
      {viewTab === 'matrix' && (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {matrixLoading && <LoadingState label="Loading matrix" />}

          {!matrixLoading && !matrix && <EmptyState icon="grid" title="No matrix data" />}

          {!matrixLoading && matrix && (
            <>
              {/* Sticky column headers */}
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View style={{ minWidth: width }}>
                  {/* Header row */}
                  <View
                    className="flex-row items-center px-5 py-3 border-b border-lineSubtle"
                    style={{ backgroundColor: T.bg }}
                  >
                    <Text style={{ width: isWide ? 160 : 120, color: T.textSub, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Module
                    </Text>
                    {roles.map(r => (
                      <View key={r.id} style={{ width: roleColW, alignItems: 'center' }}>
                        <Text style={{ color: T.brand, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
                          {r.name}
                        </Text>
                        <Text style={{ color: T.textFaint, fontSize: 11, marginTop: 2 }}>V·C·E·D·X</Text>
                      </View>
                    ))}
                  </View>

                  {/* Module rows */}
                  {Object.entries(matrix.matrix).map(([mod, roleEntries], idx) => (
                    <View
                      key={mod}
                      className="flex-row items-center px-5 py-3 border-b border-lineSubtle"
                      style={{ backgroundColor: idx % 2 === 0 ? T.bg : T.bgNav }}
                    >
                      {/* Module name */}
                      <View style={{ width: isWide ? 160 : 120, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: T.bgInput, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.bgInputActive }}>
                          <Text style={{ color: T.brand, fontSize: 11, fontWeight: '800' }}>{mod[0].toUpperCase()}</Text>
                        </View>
                        <Text style={{ color: T.text, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{mod}</Text>
                      </View>

                      {/* Per-role cells */}
                      {roles.map(r => {
                        const re = roleEntries.find(x => x.roleId === r.id);
                        return (
                          <View key={r.id} accessibilityLabel={re ? undefined : `${r.name}: no access`} style={{ width: roleColW, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                            {re ? (
                              <>
                                <MatrixCell label={`${r.name} view`} has={re.canView}   />
                                <MatrixCell label={`${r.name} create`} has={re.canCreate} />
                                <MatrixCell label={`${r.name} edit`} has={re.canEdit}   />
                                <MatrixCell label={`${r.name} delete`} has={re.canDelete} />
                                <MatrixCell label={`${r.name} export`} has={re.canExport} />
                              </>
                            ) : (
                              <Text style={{ color: T.line, fontSize: 12 }}>—</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}

                  {/* Empty matrix */}
                  {Object.keys(matrix.matrix).length === 0 && (
                    <View style={{ width }}>
                      <EmptyState icon="grid" title="No module access" subtitle="No module access configured for this tenant yet." />
                    </View>
                  )}
                </View>
              </ScrollView>

              {/* Legend */}
              <View className="flex-row flex-wrap gap-3 px-5 pt-4">
                {FLAGS.map(f => (
                  <View key={f.key} className="flex-row items-center gap-2">
                    <Feather name={f.icon} size={12} color={FLAG_COLOR[f.key]} />
                    <Text style={{ color: FLAG_COLOR[f.key], fontSize: 11, fontWeight: '600' }}>{f.label[0]}</Text>
                    <Text className="text-faint text-[11px]">= {f.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
