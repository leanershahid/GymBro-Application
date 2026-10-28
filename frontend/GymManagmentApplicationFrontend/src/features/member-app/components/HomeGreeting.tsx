import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';

interface Props {
  /** Hidden from the greeting when null (profile not loaded / missing). */
  firstName: string | null;
  lastName?: string | null;
  /** Shown as a pill under the name; hidden when null (e.g. stats module disabled). */
  streakDays: number | null;
  onOpenProfile: () => void;
}

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Member home header: avatar initials, time-of-day greeting and streak pill. */
export default function HomeGreeting({ firstName, lastName, streakDays, onOpenProfile }: Props) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  const streakLabel = streakDays == null ? null
    : streakDays > 0 ? `${streakDays}-day streak` : 'Start a streak today';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        onPress={onOpenProfile}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        hitSlop={6}
        style={({ pressed }) => ({
          width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
          backgroundColor: pressed ? withAlpha(T.brand, 0.2) : T.brandDim, borderWidth: 1.5, borderColor: T.brand,
        })}
      >
        {initials
          ? <Text style={{ color: T.brand, fontSize: 16, fontWeight: '800' }}>{initials}</Text>
          : <Feather name="user" size={20} color={T.brand} />}
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
