import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';
import { apiErrorText, describeApiError, fieldErrorsFrom } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import { Field } from '../../trainers/components/FormFields';
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from '../api/moduleAccessQueries';
import { Role } from '../types/moduleAccess.types';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

/** Roles the backend refuses to create, rename or delete. */
const BUILT_IN = ['superadmin', 'admin', 'trainer', 'client'];
export const isBuiltInRole = (r: Pick<Role, 'slug' | 'isSystem'>) =>
  r.isSystem || BUILT_IN.includes((r.slug ?? '').toLowerCase());

interface Props {
  onBack: () => void;
  /** Opens the role×module access matrix pre-selected on this role. */
  onOpenRoleAccess?: (roleId: number) => void;
}

interface FormState { name: string; description: string }
type SheetMode = { kind: 'create' } | { kind: 'edit'; role: Role };

function IconAction({ icon, label, color, onPress, busy }: {
  icon: FeatherIconName; label: string; color: string; onPress: () => void; busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!busy, busy: !!busy }}
      style={({ pressed }) => ({
        width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? withAlpha(color, 0.2) : withAlpha(color, 0.1),
        borderWidth: 1, borderColor: withAlpha(color, 0.25),
      })}
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : <Feather name={icon} size={15} color={color} />}
    </Pressable>
  );
}

export default function RolesPage({ onBack, onOpenRoleAccess }: Props) {
  const toast = useToast();
  const { data: roles = [], isLoading, isError, refetch } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [sheet, setSheet] = useState<SheetMode | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', description: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const builtIn = roles.filter(isBuiltInRole);
    const custom = roles.filter(r => !isBuiltInRole(r)).sort((a, b) => a.name.localeCompare(b.name));
    return { builtIn, custom };
  }, [roles]);

  const openCreate = () => {
    setForm({ name: '', description: '' });
    setErrors({});
    setSheet({ kind: 'create' });
  };

  const openEdit = (role: Role) => {
    setForm({ name: role.name, description: role.description ?? '' });
    setErrors({});
    setSheet({ kind: 'edit', role });
  };

  const closeSheet = () => setSheet(null);

  const editing = sheet?.kind === 'edit' ? sheet.role : null;
  const renamed = !!editing && form.name.trim() !== editing.name.trim();
  const saving = createRole.isPending || updateRole.isPending;

  const onSaveError = (e: unknown) => {
    const { message, errors: list } = describeApiError(e);
    const fieldErrs = fieldErrorsFrom(list, { name: 'name', description: 'description' });
    // Reserved / duplicate name errors come back as a bare message about the name.
    if (!fieldErrs.name && /role name|named/i.test(message)) fieldErrs.name = message;
    setErrors(fieldErrs);
    if (!Object.keys(fieldErrs).length) Alert.alert('Could not save role', apiErrorText(e));
  };

  const submit = () => {
    const name = form.name.trim();
    const description = form.description.trim();
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!name) next.name = 'Name is required.';
    else if (name.length > 50) next.name = 'Keep the name to 50 characters or fewer.';
    else if (BUILT_IN.includes(name.toLowerCase().replace(/\s+/g, '')) || name.toLowerCase() === 'staff')
      next.name = `'${name}' is a reserved role name.`;
    if (description.length > 500) next.description = 'Keep the description to 500 characters or fewer.';
    setErrors(next);
    if (Object.keys(next).length) return;

    if (!editing) {
      createRole.mutate({ name, description: description || null }, {
        onSuccess: () => { closeSheet(); toast.show({ message: `Role "${name}" created.` }); },
        onError: onSaveError,
      });
      return;
    }

    const doUpdate = () =>
      updateRole.mutate(
        { id: editing.id, name: renamed ? name : undefined, description },
        {
          onSuccess: () => { closeSheet(); toast.show({ message: 'Role updated.' }); },
          onError: onSaveError,
        },
      );

    if (renamed) {
      Alert.alert(
        'Rename role?',
        `Renaming "${editing.name}" to "${name}" changes its identifier. Everyone with this role will be signed out and must sign in again.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Rename', style: 'destructive', onPress: doUpdate },
        ],
      );
    } else {
      doUpdate();
    }
  };

  const confirmDelete = (role: Role) => {
    Alert.alert(
      'Delete role?',
      `Delete "${role.name}" and its module access settings? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: () => {
            setDeletingId(role.id);
            deleteRole.mutate(role.id, {
              onSuccess: () => toast.show({ message: `Role "${role.name}" deleted.` }),
              // e.g. "Role is still assigned to users. Reassign them first."
              onError: e => Alert.alert('Could not delete role', apiErrorText(e)),
              onSettled: () => setDeletingId(null),
            });
          },
        },
      ],
    );
  };

  const renderRole = (role: Role) => {
    const builtIn = isBuiltInRole(role);
    const roleId = Number(role.id);
    // Every role but super admin (which always has everything) gets its module access from grants.
    const canOpenAccess = !!onOpenRoleAccess && role.slug?.toLowerCase() !== 'superadmin' && Number.isFinite(roleId) && roleId > 0;
    return (
      <View
        key={role.id}
        style={{
          backgroundColor: T.bgInput, borderRadius: 16, padding: 14, marginBottom: 10,
          borderWidth: 1, borderColor: T.line,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: T.text, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' }} numberOfLines={1}>
                {role.name}
              </Text>
              {builtIn && (
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
                    backgroundColor: T.bgInputActive, borderWidth: 1, borderColor: T.line,
                  }}
                >
                  <Feather name="lock" size={10} color={T.textFaint} />
                  <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '700' }}>Built-in</Text>
                </View>
              )}
            </View>
            {!!role.description && (
              <Text style={{ color: T.textSub, fontSize: 12, marginTop: 3 }} numberOfLines={2}>{role.description}</Text>
            )}
          </View>
          {!builtIn && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconAction icon="edit-2" label={`Edit ${role.name}`} color={T.brandGold} onPress={() => openEdit(role)} />
              <IconAction
                icon="trash-2" label={`Delete ${role.name}`} color={T.err}
                onPress={() => confirmDelete(role)} busy={deletingId === role.id}
              />
            </View>
          )}
        </View>
        {canOpenAccess && (
          <Pressable
            onPress={() => onOpenRoleAccess!(roleId)}
            accessibilityRole="button"
            accessibilityLabel={`Module access for ${role.name}`}
            style={({ pressed }) => ({
              marginTop: 12, minHeight: 40, borderRadius: 12, paddingHorizontal: 12,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: pressed ? withAlpha(T.brand, 0.16) : withAlpha(T.brand, 0.08),
              borderWidth: 1, borderColor: withAlpha(T.brand, 0.25),
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="grid" size={14} color={T.brand} />
              <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>Module access</Text>
            </View>
            <Feather name="chevron-right" size={16} color={T.brand} />
          </Pressable>
        )}
      </View>
    );
  };

  const sectionLabel = (label: string) => (
    <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 6 }}>
      {label}
    </Text>
  );

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Access control"
        title="Roles"
        onBack={onBack}
        action={!isLoading && !isError ? { label: 'New role', icon: 'plus', onPress: openCreate } : undefined}
      />

      {isLoading ? (
        <LoadingState label="Loading roles" />
      ) : isError ? (
        <EmptyState icon="wifi-off" tone="error" title="Failed to load roles" action={{ label: 'Retry', onPress: () => refetch() }} />
      ) : (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
          {sectionLabel('Custom roles')}
          {sorted.custom.length === 0 ? (
            <View style={{ marginBottom: 10 }}>
              <EmptyState
                icon="shield"
                title="No custom roles yet"
                subtitle="Create a role, then choose which modules it can use."
                action={{ label: 'New role', onPress: openCreate }}
              />
            </View>
          ) : (
            sorted.custom.map(renderRole)
          )}

          {sorted.builtIn.length > 0 && (
            <>
              {sectionLabel('Built-in roles')}
              <Text style={{ color: T.textSub, fontSize: 12, marginBottom: 10 }}>
                Built-in roles are managed by the system and can’t be renamed or deleted.
              </Text>
              {sorted.builtIn.map(renderRole)}
            </>
          )}
        </ScrollView>
      )}

      <BottomSheet
        visible={!!sheet}
        onClose={closeSheet}
        title={editing ? 'Edit role' : 'New role'}
        leftAction={{ label: 'Cancel', onPress: closeSheet }}
        rightAction={{ label: saving ? 'Saving…' : 'Save', onPress: () => { if (!saving) submit(); }, primary: true }}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
          <Field
            label="Name"
            value={form.name}
            onChangeText={v => { setForm(f => ({ ...f, name: v })); if (errors.name) setErrors(e => ({ ...e, name: undefined })); }}
            placeholder="e.g. Front desk"
            autoCapitalize="words"
            error={errors.name}
          />
          <Field
            label="Description (optional)"
            value={form.description}
            onChangeText={v => { setForm(f => ({ ...f, description: v })); if (errors.description) setErrors(e => ({ ...e, description: undefined })); }}
            placeholder="What this role is for"
            multiline
            error={errors.description}
          />
          {editing && (
            <View
              style={{
                flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, marginBottom: 16,
                backgroundColor: withAlpha(T.brandGold, renamed ? 0.12 : 0.06),
                borderWidth: 1, borderColor: withAlpha(T.brandGold, renamed ? 0.35 : 0.2),
              }}
            >
              <Feather name="alert-triangle" size={14} color={T.brandGold} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, color: T.textSub, fontSize: 12, lineHeight: 17 }}>
                Renaming a role changes its identifier, which signs out everyone who has it. Editing only the description doesn’t.
              </Text>
            </View>
          )}
          <PrimaryButton
            label={editing ? 'Save changes' : 'Create role'}
            onPress={submit}
            loading={saving}
            disabled={saving}
          />
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}
