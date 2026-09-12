import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Switch,
  StatusBar, Platform, ActivityIndicator, Alert,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  useModuleKeys, useModuleAccess, useModuleMatrix,
  useUpsertModuleAccess, useDeleteModuleAccess, useDeleteRoleAccess,
} from '../api/moduleAccessQueries';
import { ModuleAccessEntry, ModuleAccessPayload } from '../types/moduleAccess.types';

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
  canView:   '#22D3EE',
  canCreate: '#7ED321',
  canEdit:   '#FACC15',
  canDelete: '#EF4444',
  canExport: '#A78BFA',
};

// Roles from the known API response
const DEFAULT_ROLES = [
  { id: 1, name: 'admin'   },
  { id: 2, name: 'trainer' },
  { id: 3, name: 'client'  },
];

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
          <Text className="text-white text-[14px] font-bold">{entry.module}</Text>
        </View>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${entry.module} access`}
          className="w-7 h-7 rounded-full items-center justify-center"
          style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}
        >
          <Feather name="trash-2" size={13} color="#EF4444" />
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
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                backgroundColor: on ? col + '18' : '#1C211C',
                borderWidth: 1, borderColor: on ? col + '40' : '#242B24',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Feather name={f.icon} size={11} color={on ? col : '#555555'} />
              <Text style={{ color: on ? col : '#555555', fontSize: 11, fontWeight: '700' }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
        {saving && <ActivityIndicator size="small" color="#7ED321" style={{ marginLeft: 4 }} />}
      </View>
    </View>
  );
}

// ─── Matrix cell ──────────────────────────────────────────────────
function MatrixCell({ has }: { has: boolean }) {
  return (
    <View style={{
      width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
      backgroundColor: has ? 'rgba(126,211,33,0.15)' : '#151915',
      borderWidth: 1, borderColor: has ? 'rgba(126,211,33,0.30)' : '#1C211C',
    }}>
      {has && <Feather name="check" size={11} color="#7ED321" />}
    </View>
  );
}

// ─── Page ─────────────────────────────────────────────────────────
interface Props { onBack?: () => void; }

const TENANT_ID = 1; // hardcoded until tenant context is available

export default function ModuleAccessPage({ onBack }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;

  const [viewTab,        setViewTab]        = useState<ViewTab>('byRole');
  const [selectedRoleId, setSelectedRoleId] = useState(1);
  const [savingModule,   setSavingModule]   = useState<string | null>(null);

  const { data: moduleKeys = [], isLoading: keysLoading } = useModuleKeys();
  const { data: entries = [],    isLoading: entriesLoading, refetch: refetchEntries } =
    useModuleAccess(TENANT_ID, selectedRoleId);
  const { data: matrix,         isLoading: matrixLoading }  = useModuleMatrix(TENANT_ID);

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
      tenantId:  TENANT_ID,
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
      tenantId: TENANT_ID, roleId: selectedRoleId, module,
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
          delEntry({ tenantId: TENANT_ID, roleId: selectedRoleId, module }, {
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
          delRole({ tenantId: TENANT_ID, roleId: selectedRoleId }, {
            onSuccess: () => Alert.alert('Done', 'All access cleared.'),
            onError:   () => Alert.alert('Error', 'Failed to clear access.'),
          })
        },
      ]
    );
  }, [selectedRoleId, delRole]);

  const selectedRole = DEFAULT_ROLES.find(r => r.id === selectedRoleId);

  return (
    <View
      className="flex-1 bg-bg"
      style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0A0F0A" />

      {/* ── Header ── */}
      <View className="px-5 pt-5 pb-4">
        <View className="flex-row items-center mb-5">
          {onBack && (
            <Pressable
              onPress={onBack} hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="w-9 h-9 rounded-full bg-surface border border-line items-center justify-center mr-3"
            >
              <Feather name="arrow-left" size={18} color="#FFFFFF" />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text className="text-sub text-[11px] font-semibold uppercase tracking-widest mb-0.5">Admin</Text>
            <Text className="text-white text-[26px] font-extrabold tracking-tight">Module Access</Text>
          </View>
        </View>

        {/* View tab switcher */}
        <View
          className="flex-row bg-surface border border-lineSubtle rounded-2xl p-1 mb-4"
        >
          {(['byRole', 'matrix'] as ViewTab[]).map(t => (
            <Pressable
              key={t}
              onPress={() => setViewTab(t)}
              className={`flex-1 py-2.5 rounded-xl items-center ${viewTab === t ? 'bg-brand' : ''}`}
            >
              <Text
                className="text-[13px] font-bold"
                style={{ color: viewTab === t ? '#000' : '#AAAAAA' }}
              >
                {t === 'byRole' ? 'By Role' : 'Full Matrix'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Role selector — only for byRole tab */}
        {viewTab === 'byRole' && (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {DEFAULT_ROLES.map(r => {
              const active = r.id === selectedRoleId;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setSelectedRoleId(r.id)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
                    backgroundColor: active ? '#7ED321' : '#151915',
                    borderWidth: 1, borderColor: active ? '#7ED321' : '#242B24',
                  }}
                >
                  <Text style={{ color: active ? '#000' : '#AAAAAA', fontSize: 13, fontWeight: '700', textTransform: 'capitalize' }}>
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
                style={{ backgroundColor: 'rgba(126,211,33,0.10)', borderColor: 'rgba(126,211,33,0.25)' }}
              >
                <Text className="text-brand text-[12px] font-bold">{entries.length} modules</Text>
              </View>
              {/* Clear all */}
              {entries.length > 0 && (
                <Pressable
                  onPress={handleDeleteAll}
                  disabled={deletingAll}
                  className="rounded-xl px-3 py-1.5 border"
                  style={{ backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.25)' }}
                >
                  {deletingAll
                    ? <ActivityIndicator size="small" color="#EF4444" />
                    : <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>Clear all</Text>
                  }
                </Pressable>
              )}
            </View>
          </View>

          {/* Loading state */}
          {(entriesLoading || keysLoading) && (
            <View className="items-center py-12">
              <ActivityIndicator size="large" color="#7ED321" />
            </View>
          )}

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
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 12, paddingVertical: 7,
                      borderRadius: 999, backgroundColor: '#151915',
                      borderWidth: 1, borderColor: '#242B24',
                      opacity: savingModule === key ? 0.5 : 1,
                    }}
                  >
                    {savingModule === key
                      ? <ActivityIndicator size="small" color="#7ED321" />
                      : <Feather name="plus" size={12} color="#7ED321" />
                    }
                    <Text style={{ color: '#AAAAAA', fontSize: 12, fontWeight: '600' }}>{key}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* Empty state */}
          {!entriesLoading && !keysLoading && entries.length === 0 && unconfiguredKeys.length === 0 && (
            <View className="items-center py-16">
              <View className="w-16 h-16 rounded-full bg-surface border border-line items-center justify-center mb-4">
                <Feather name="lock" size={26} color="#AAAAAA" />
              </View>
              <Text className="text-white text-[16px] font-bold mb-2">No access configured</Text>
              <Text className="text-sub text-[13px] text-center">
                Add modules above to grant this role access.
              </Text>
            </View>
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
          {matrixLoading && (
            <View className="items-center py-12">
              <ActivityIndicator size="large" color="#7ED321" />
            </View>
          )}

          {!matrixLoading && !matrix && (
            <View className="items-center py-16 px-5">
              <Feather name="grid" size={28} color="#444" />
              <Text className="text-white text-[16px] font-bold mt-4">No matrix data</Text>
            </View>
          )}

          {!matrixLoading && matrix && (
            <>
              {/* Sticky column headers */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ minWidth: width }}>
                  {/* Header row */}
                  <View
                    className="flex-row items-center px-5 py-3 border-b border-lineSubtle"
                    style={{ backgroundColor: '#0A0F0A' }}
                  >
                    <Text style={{ width: isWide ? 160 : 120, color: '#AAAAAA', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Module
                    </Text>
                    {DEFAULT_ROLES.map(r => (
                      <View key={r.id} style={{ width: isWide ? 90 : 72, alignItems: 'center' }}>
                        <Text style={{ color: '#7ED321', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
                          {r.name}
                        </Text>
                        <Text style={{ color: '#555', fontSize: 11, marginTop: 2 }}>V·C·E·D·X</Text>
                      </View>
                    ))}
                  </View>

                  {/* Module rows */}
                  {Object.entries(matrix.matrix).map(([mod, roleEntries], idx) => (
                    <View
                      key={mod}
                      className="flex-row items-center px-5 py-3 border-b border-lineSubtle"
                      style={{ backgroundColor: idx % 2 === 0 ? '#0A0F0A' : '#111111' }}
                    >
                      {/* Module name */}
                      <View style={{ width: isWide ? 160 : 120, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: '#151915', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1C211C' }}>
                          <Text style={{ color: '#7ED321', fontSize: 11, fontWeight: '800' }}>{mod[0].toUpperCase()}</Text>
                        </View>
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{mod}</Text>
                      </View>

                      {/* Per-role cells */}
                      {DEFAULT_ROLES.map(r => {
                        const re = roleEntries.find(x => x.roleId === r.id);
                        return (
                          <View key={r.id} style={{ width: isWide ? 90 : 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                            {re ? (
                              <>
                                <MatrixCell has={re.canView}   />
                                <MatrixCell has={re.canCreate} />
                                <MatrixCell has={re.canEdit}   />
                                <MatrixCell has={re.canDelete} />
                                <MatrixCell has={re.canExport} />
                              </>
                            ) : (
                              <Text style={{ color: '#242B24', fontSize: 12 }}>—</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}

                  {/* Empty matrix */}
                  {Object.keys(matrix.matrix).length === 0 && (
                    <View className="items-center py-16">
                      <Feather name="grid" size={28} color="#444" />
                      <Text className="text-sub text-[13px] mt-4 text-center px-8">
                        No module access configured for this tenant yet.
                      </Text>
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
    </View>
  );
}
