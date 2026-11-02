import React from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import BottomSheet from '../../common/components/BottomSheet';
import Avatar from '../../common/components/Avatar';
import { T, SP, R, withAlpha, Shadow } from '../../../theme';
import { UserProfile } from '../../auth/types/auth.types';

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SP.md }}>
      <View style={{
        width: 36, height: 36, borderRadius: R.md,
        backgroundColor: T.bgInputActive, alignItems: 'center', justifyContent: 'center',
        marginRight: SP.md,
      }}>
        <Feather name={icon} size={16} color={T.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2 }}>
          {label.toUpperCase()}
        </Text>
        <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

interface ProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  profile?: UserProfile;
  isLoading: boolean;
  isError: boolean;
  roleLabel: string;
  onLogout?: () => void;
  onViewMore?: () => void;
  onChangePassword?: () => void;
}

/** Admin's own profile, opened from the dashboard header avatar. */
export default function ProfileSheet({
  visible,
  onClose,
  profile,
  isLoading,
  isError,
  roleLabel,
  onLogout,
  onViewMore,
  onChangePassword,
}: ProfileSheetProps) {
  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';

  return (
    <BottomSheet visible={visible} onClose={onClose} title="My Profile">
      <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.lg, paddingBottom: SP.sm }}>
        {isLoading && (
          <View style={{ paddingVertical: SP.xxl * 2, alignItems: 'center' }}>
            <ActivityIndicator color={T.brand} />
          </View>
        )}

        {!isLoading && isError && (
          <View style={{ paddingVertical: SP.xxl, alignItems: 'center' }}>
            <Feather name="alert-triangle" size={22} color={T.err} />
            <Text style={{ color: T.err, fontSize: 13, marginTop: SP.sm, fontWeight: '600' }}>
              Couldn't load your profile.
            </Text>
          </View>
        )}

        {!isLoading && !isError && profile && (
          <>
            {/* Header: avatar + name + role badge */}
            <View style={{ alignItems: 'center', marginBottom: SP.lg }}>
              <Avatar uri={profile.avatarUrl} size={84} borderWidth={3} borderColor={T.brand} style={Shadow.neon} />

              <Text style={{ color: T.text, fontSize: 19, fontWeight: '800', marginTop: SP.md, letterSpacing: -0.3 }}>
                {fullName || 'Unnamed user'}
              </Text>

              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
                backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder,
                borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4,
              }}>
                <Feather name="shield" size={11} color={T.brand} />
                <Text style={{ color: T.brand, fontSize: 11, fontWeight: '700' }}>{roleLabel}</Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: T.line, marginBottom: SP.xs }} />

            {/* Details */}
            <DetailRow icon="mail" label="Email" value={profile.email} />
            <View style={{ height: 1, backgroundColor: T.lineSubtle }} />
            <DetailRow icon="phone" label="Phone" value={profile.phone || 'Not set'} />
            <View style={{ height: 1, backgroundColor: T.lineSubtle }} />
            <DetailRow
              icon={profile.isEmailVerified ? 'check-circle' : 'alert-circle'}
              label="Email status"
              value={profile.isEmailVerified ? 'Verified' : 'Not verified'}
            />

            {onViewMore && (
              <Pressable
                onPress={onViewMore}
                accessibilityRole="button"
                accessibilityLabel="View more details"
                style={({ pressed }) => ({
                  marginTop: SP.lg,
                  height: 48,
                  borderRadius: R.pill,
                  borderWidth: 1,
                  borderColor: T.brandBorder,
                  backgroundColor: pressed ? withAlpha(T.brand, 0.16) : T.brandDim,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                })}
              >
                <Text style={{ color: T.brand, fontSize: 14, fontWeight: '700' }}>View more details</Text>
                <Feather name="arrow-right" size={16} color={T.brand} />
              </Pressable>
            )}

            {onChangePassword && (
              <Pressable
                onPress={onChangePassword}
                accessibilityRole="button"
                accessibilityLabel="Change password"
                style={({ pressed }) => ({
                  marginTop: SP.md,
                  height: 48,
                  borderRadius: R.pill,
                  borderWidth: 1,
                  borderColor: T.line,
                  backgroundColor: pressed ? T.bgInputActive : T.bgInput,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                })}
              >
                <Feather name="lock" size={16} color={T.text} />
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>Change password</Text>
              </Pressable>
            )}

            {onLogout && (
              <Pressable
                onPress={onLogout}
                accessibilityRole="button"
                accessibilityLabel="Log out"
                style={{
                  marginTop: SP.lg,
                  height: 48,
                  borderRadius: R.pill,
                  borderWidth: 1,
                  borderColor: withAlpha(T.err, 0.4),
                  backgroundColor: withAlpha(T.err, 0.08),
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Feather name="log-out" size={16} color={T.err} />
                <Text style={{ color: T.err, fontSize: 14, fontWeight: '700' }}>Log out</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </BottomSheet>
  );
}
