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
  /** Shows a search button (find a member). */
  onSearch?: () => void;
  /** Shows a "+" button (quick actions). */
  onQuickCreate?: () => void;
}

function IconButton({ icon, label, onPress, filled }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; onPress: () => void; filled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        backgroundColor: filled ? (pressed ? T.brandDark : T.brand) : pressed ? T.bgInputActive : T.bgInput,
        borderWidth: filled ? 0 : 1, borderColor: T.line,
      })}
    >
      <Feather name={icon} size={20} color={filled ? T.onBrand : T.text} />
    </Pressable>
  );
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function DashboardHeader({
  adminName,
  avatarUrl,
  onPressAvatar,
  roleLabel,
  onSearch,
  onQuickCreate,
}: DashboardHeaderProps) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 0,
    }}>

      {/* Left — avatar centered against name + role badge */}
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

        {/* Name + role badge */}
        <View style={{ marginLeft: 14, flexShrink: 1, justifyContent: 'center' }}>
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
              marginTop: 6, backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder,
              borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
            }}>
              <Feather name="shield" size={11} color={T.brand} />
              <Text style={{ color: T.brand, fontSize: 11, fontWeight: '700' }}>{roleLabel}</Text>
            </View>
          )}
        </View>
      </Pressable>

      {/* Right — find a member, quick actions */}
      <View style={{ flexDirection: 'row', gap: 8, marginLeft: 8 }}>
        {onSearch && <IconButton icon="search" label="Find a member" onPress={onSearch} />}
        {onQuickCreate && <IconButton icon="plus" label="Quick actions" onPress={onQuickCreate} filled />}
      </View>
    </View>
  );
}
