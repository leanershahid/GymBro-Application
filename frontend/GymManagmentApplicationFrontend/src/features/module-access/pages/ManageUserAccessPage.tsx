import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';
import { getSession, isSuperAdmin } from '../../../api/session';
import { apiErrorText } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import BottomSheet from '../../common/components/BottomSheet';
import { useToast } from '../../common/components/Toast';
import AccessPanel from '../components/AccessPanel';
import { useRoles, useAssignUserRole, useRevokeUserRole } from '../api/moduleAccessQueries';
import { Role } from '../types/moduleAccess.types';

interface Props {
  userId: number;
  userName: string;
  onBack: () => void;
  /** The user's current role slug, when the caller knows it (e.g. 'trainer', 'client'). */
  currentRoleSlug?: string;
}

/** "Role" row + picker. Hidden for the signed-in user (the API refuses self role changes). */
function RoleRow({ userId, userName, currentRoleSlug }: { userId: number; userName: string; currentRoleSlug?: string }) {
  const toast = useToast();
  const session = getSession();
  const viewerIsSuperAdmin = isSuperAdmin(session?.role);
  const { data: roles = [], isLoading } = useRoles();
  const assign = useAssignUserRole();
  const revoke = useRevokeUserRole();
  const [slug, setSlug] = useState<string | undefined>(currentRoleSlug?.toLowerCase());
  const [open, setOpen] = useState(false);

  const current = roles.find(r => r.slug?.toLowerCase() === slug);
  const busy = assign.isPending || revoke.isPending;

  const choices = useMemo(
    () => roles.filter(r => viewerIsSuperAdmin || r.slug?.toLowerCase() !== 'superadmin'),
    [roles, viewerIsSuperAdmin],
  );

  // Only a super admin may change a super admin's role.
  const locked = slug === 'superadmin' && !viewerIsSuperAdmin;

  if (session?.userId === userId) return null;

  const apply = (role: Role) => {
    const target = role.slug?.toLowerCase();
    const done = {
      onSuccess: () => {
        setSlug(target);
        setOpen(false);
        toast.show({ message: `${userName} is now ${role.name}.` });
      },
      onError: (e: unknown) => Alert.alert('Could not change role', apiErrorText(e)),
    };
    // Back to client: revoke the current role when we know it; otherwise assign client directly.
    if (target === 'client' && current && current.slug?.toLowerCase() !== 'client') {
      revoke.mutate({ userId, roleId: current.id }, done);
    } else {
      assign.mutate({ userId, roleId: role.id }, done);
    }
  };

  const pick = (role: Role) => {
    if (role.slug?.toLowerCase() === slug) { setOpen(false); return; }
    Alert.alert(
      'Change role?',
      `Make ${userName} "${role.name}"? They will be signed out of all devices and must sign in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change role', style: 'destructive', onPress: () => apply(role) },
      ],
    );
  };

  return (
    <View className="px-5 pb-2">
      <Pressable
        onPress={() => setOpen(true)}
        disabled={locked || isLoading || busy}
        accessibilityRole="button"
        accessibilityLabel={`Role: ${current?.name ?? 'unknown'}. Change role`}
        accessibilityState={{ disabled: locked || isLoading || busy, busy }}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 12,
          backgroundColor: pressed ? T.bgInputActive : T.bgInput,
          borderRadius: 16, padding: 14, borderWidth: 1, borderColor: T.line,
          opacity: locked ? 0.6 : 1,
        })}
      >
        <View
          style={{
            width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
            backgroundColor: withAlpha(T.brand, 0.12), borderWidth: 1, borderColor: withAlpha(T.brand, 0.25),
          }}
        >
          <Feather name="shield" size={15} color={T.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.textSub, fontSize: 12 }}>Role</Text>
          <Text style={{ color: T.text, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' }} numberOfLines={1}>
            {current?.name ?? (slug ? slug : 'Not set')}
          </Text>
        </View>
        {busy || isLoading
          ? <ActivityIndicator size="small" color={T.brand} />
          : locked
            ? <Feather name="lock" size={16} color={T.textFaint} />
            : <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>Change</Text>}
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Choose role">
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingVertical: 8 }}>
          <Text style={{ color: T.textSub, fontSize: 12, paddingHorizontal: 20, paddingVertical: 8 }}>
            Changing a role signs the person out everywhere.
          </Text>
          {choices.map(r => {
            const active = r.slug?.toLowerCase() === slug;
            return (
              <Pressable
                key={r.id}
                onPress={() => pick(r)}
                disabled={busy}
                accessibilityRole="radio"
                accessibilityLabel={r.name}
                accessibilityState={{ checked: active, disabled: busy }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  minHeight: 52, paddingHorizontal: 20, paddingVertical: 10,
                  backgroundColor: pressed ? T.bgInputActive : 'transparent',
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: active ? T.brand : T.text, fontSize: 15, fontWeight: '600', textTransform: 'capitalize' }}>
                    {r.name}{r.slug?.toLowerCase() === 'client' && slug && slug !== 'client' ? '  (revoke access)' : ''}
                  </Text>
                  {!!r.description && (
                    <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{r.description}</Text>
                  )}
                </View>
                {active && <Feather name="check" size={18} color={T.brand} />}
              </Pressable>
            );
          })}
          {!isLoading && choices.length === 0 && (
            <Text style={{ color: T.textSub, fontSize: 13, padding: 20 }}>No roles available.</Text>
          )}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

export default function ManageUserAccessPage({ userId, userName, onBack, currentRoleSlug }: Props) {
  return (
    <Screen>
      <ScreenHeader eyebrow="Manage access" title={userName} onBack={onBack} />
      <RoleRow userId={userId} userName={userName} currentRoleSlug={currentRoleSlug} />
      <AccessPanel userId={userId} />
    </Screen>
  );
}
