import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../../theme';

interface DashboardHeaderProps {
  adminName: string;
  avatarUrl?: string;
  onPressAvatar?: () => void;
  /** Optional role badge shown under the name (e.g. "Administrator"). */
  roleLabel?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function DashboardHeader({
  adminName,
  avatarUrl,
  onPressAvatar,
  roleLabel,
}: DashboardHeaderProps) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 0,
    }}>

      {/* Left — avatar + greeting */}
      <Pressable
        onPress={onPressAvatar}
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
        accessibilityRole="button"
        accessibilityLabel={`${adminName}${roleLabel ? `, ${roleLabel}` : ''}, profile`}
      >
        {/* Avatar */}
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
          />
        ) : (
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: T.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ color: T.onBrand, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>
              {getInitials(adminName)}
            </Text>
          </View>
        )}

        {/* Text stack */}
        <View style={{ marginLeft: 14, flexShrink: 1 }}>
          <Text style={{
            color: T.textSub,
            fontSize: 12,
            fontWeight: '500',
            letterSpacing: 0.2,
            marginBottom: 2,
          }}>
            {getGreeting()} 👋
          </Text>
          <Text style={{
            color: T.text,
            fontSize: 18,
            fontWeight: '800',
            letterSpacing: -0.3,
          }} numberOfLines={1}>
            {adminName}
          </Text>
          {!!roleLabel && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
              marginTop: 5, backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder,
              borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
            }}>
              <Feather name="shield" size={11} color={T.brand} />
              <Text style={{ color: T.brand, fontSize: 11, fontWeight: '700' }}>{roleLabel}</Text>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}
