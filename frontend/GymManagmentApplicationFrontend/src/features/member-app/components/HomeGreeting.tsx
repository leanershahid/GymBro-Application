import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import Avatar from '../../common/components/Avatar';

interface Props {
  /** Hidden from the greeting when null (profile not loaded / missing). */
  firstName: string | null;
  avatarUrl?: string | null;
  /** Shown as a pill under the name; hidden when null (e.g. stats module disabled). */
  streakDays: number | null;
  onOpenProfile: () => void;
}

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Member home header: avatar, time-of-day greeting and streak pill. */
export default function HomeGreeting({ firstName, avatarUrl, streakDays, onOpenProfile }: Props) {
  const streakLabel = streakDays == null ? null
    : streakDays > 0 ? `${streakDays}-day streak` : 'Start a streak today';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        onPress={onOpenProfile}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        hitSlop={6}
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
      >
        <Avatar uri={avatarUrl} size={48} borderColor={T.brand} borderWidth={1.5} />
      </Pressable>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={{ color: T.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}
        >
          {firstName ? `${greeting()}, ${firstName}` : greeting()}
        </Text>
        {streakLabel && (
          <View
            accessible
            accessibilityLabel={streakDays ? `${streakDays} day workout streak` : 'No active streak'}
            style={{
              alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill,
              backgroundColor: withAlpha(T.brandGold, 0.12), borderWidth: 1, borderColor: withAlpha(T.brandGold, 0.3),
            }}
          >
            <Feather name="zap" size={12} color={T.brandGold} />
            <Text style={{ color: T.brandGold, fontSize: 12, fontWeight: '700' }}>{streakLabel}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
