import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, Shadow } from '../../trainers/components/theme';
import { RecentMember } from '../types/dashboard';

const STATUS: Record<RecentMember['status'], { label: string; bg: string; border: string; color: string }> = {
  active:  { label: 'Active',  bg: 'rgba(126,211,33,0.10)',  border: 'rgba(126,211,33,0.25)',  color: T.brand    },
  pending: { label: 'Pending', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', color: T.textSub },
  overdue: { label: 'Overdue', bg: T.errDim,   border: 'rgba(239,68,68,0.25)',   color: T.err  },
};

interface RecentMemberRowProps {
  member: RecentMember;
  onPress?: () => void;
}

const glass = {
  backgroundColor: T.bgInput,
  borderWidth: 1,
  borderColor: T.line,
  ...Shadow.sm,
};

export default function RecentMemberRow({ member, onPress }: RecentMemberRowProps) {
  const s = STATUS[member.status];

  return (
    <Pressable
      onPress={onPress}
      style={[glass, {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 18,
        padding: 12,
        marginBottom: 10,
      }]}
    >
      {/* Avatar */}
      {member.avatarUrl ? (
        <Image source={{ uri: member.avatarUrl }} style={{ width: 52, height: 52, borderRadius: 14 }} />
      ) : (
        <View style={{
          width: 52, height: 52, borderRadius: 14,
          backgroundColor: T.brandDim,
          borderWidth: 1, borderColor: T.brandBorder,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: T.brand, fontSize: 18, fontWeight: '700' }}>{member.name.charAt(0)}</Text>
        </View>
      )}

      {/* Info */}
      <View style={{ flex: 1, marginLeft: 12, paddingRight: 8 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {member.branchName} · {member.joinedAgo}
        </Text>
        <View style={{
          alignSelf: 'flex-start', marginTop: 6,
          borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
          backgroundColor: s.bg, borderWidth: 1, borderColor: s.border,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: s.color }}>{s.label}</Text>
        </View>
      </View>

      {/* Chevron */}
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: T.bgInputActive,
        borderWidth: 1, borderColor: T.line,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Feather name="chevron-right" size={16} color={T.textSub} />
      </View>
    </Pressable>
  );
}
