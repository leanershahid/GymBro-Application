import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import { useClientProfile } from '../api/trainerAppQueries';
import { ClientAssignment } from '../types/trainer-app.types';
import StatusPill from '../../common/components/StatusPill';

const ACCENTS = [T.brand, T.sky, T.violet, T.brandGold, T.rose];

interface Props {
  client: ClientAssignment;
  index: number;
  onPress: () => void;
}

/** Rich client row for the home screen: initials avatar, real name (via the member profile), since-date and status. */
export default function ClientPreviewRow({ client, index, onPress }: Props) {
  const { data: profile, isLoading } = useClientProfile(client.clientId);
  const accent = ACCENTS[index % ACCENTS.length];
  const fullName = profile ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() : '';
  const name = fullName || profile?.email || (isLoading ? 'Loading…' : 'Unknown client');
  const initials = profile
    ? `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase()
    : '';
  const assigned = new Date(client.assignedAt);
  const since = assigned.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
    ...(assigned.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' as const } : {}),
  });
  const active = client.status === 'Active';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${client.status}, client since ${since}`}
      accessibilityHint="Opens client details"
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 14, minHeight: 68, paddingVertical: 12,
        borderRadius: R.lg, borderWidth: 1, borderColor: T.line,
        backgroundColor: pressed ? T.bgInputActive : T.bgInput,
      })}
    >
      <View style={{
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        backgroundColor: withAlpha(accent, 0.12), borderWidth: 1.5, borderColor: withAlpha(accent, 0.35),
      }}>
        <Text numberOfLines={1} style={{ color: accent, fontSize: 15, fontWeight: '800' }}>{initials || '?'}</Text>
        {active && (
          <View style={{
            position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6,
            backgroundColor: T.ok, borderWidth: 2, borderColor: T.bgInput,
          }} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{name}</Text>
        <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>
          {profile?.branchName ? `${profile.branchName} · ` : ''}Since {since}
        </Text>
      </View>
      {/* Active is the norm — only flag the exceptions (Paused, Inactive…). */}
      {!active && <View style={{ justifyContent: 'center' }}><StatusPill label={client.status} /></View>}
      <Feather name="chevron-right" size={18} color={T.textFaint} />
    </Pressable>
  );
}
