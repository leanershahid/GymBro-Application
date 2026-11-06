import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../../theme';
import { useTwoFactorStatus } from '../../api/twoFactorQueries';
import { graceDaysLeft } from '../../utils/twoFactor';

/**
 * In-app reminder during the 2FA grace period (feature 10): "Your gym requires two-step sign-in —
 * N days left". Self-contained (reads /auth/2fa/status); renders nothing when not applicable.
 * Mount near the top of the signed-in shell; `onPress` should open SecuritySettingsScreen.
 */
export default function TwoFactorGraceBanner({ onPress }: { onPress: () => void }) {
  const { data } = useTwoFactorStatus();
  if (!data || data.enabled || !data.required) return null;
  const days = graceDaysLeft(data.graceEndsAt);
  const text = days && days > 0
    ? `Your gym requires two-step sign-in. Set it up within ${days} ${days === 1 ? 'day' : 'days'}.`
    : 'Your gym requires two-step sign-in. Set it up now.';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${text} Open security settings.`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginVertical: 8,
        paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16,
        backgroundColor: withAlpha(T.brandGold, pressed ? 0.16 : 0.10), borderWidth: 1, borderColor: withAlpha(T.brandGold, 0.28),
      })}
    >
      <Feather name="shield" size={18} color={T.brandGold} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 13, lineHeight: 18 }}>{text}</Text>
      </View>
      <Text style={{ color: T.brandGold, fontSize: 13, fontWeight: '700' }}>Set up</Text>
    </Pressable>
  );
}
