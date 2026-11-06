import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../../theme';
import PrimaryButton from '../../../common/components/PrimaryButton';
import { applyAuth, clearAuth, currentRefreshToken } from '../../../../api/authStore';
import { logoutSession, refreshSession } from '../../api/authApi';
import { graceDaysLeft } from '../../utils/twoFactor';
import TwoFactorSetupFlow, { LinkButton } from './TwoFactorSetupFlow';

/**
 * The forced 2FA setup step on the login sheet (feature 10), shown after a successful sign-in
 * when the gym's policy requires two-step sign-in and the user hasn't set it up:
 *  - in the grace period: "Set up now" or "Remind me later" (continues into the app);
 *  - grace over (`blocking`): setup or sign out — the server only accepts /auth/* calls until done.
 * After setup the session is refreshed so the new access token no longer carries the setup claim.
 */
export default function TwoFactorSetupGate({ blocking, graceEndsAt, onContinue, onSignedOut }: {
  blocking: boolean;
  graceEndsAt: string | null;
  onContinue: () => void;
  onSignedOut: () => void;
}) {
  const [settingUp, setSettingUp] = useState(blocking);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');
  const days = graceDaysLeft(graceEndsAt);

  const finish = async () => {
    setFinishing(true);
    setError('');
    try {
      const token = currentRefreshToken();
      const res = token ? await refreshSession(token) : null;
      if (res?.success && res.data?.accessToken) await applyAuth(res.data);
      onContinue();
    } catch {
      setError('Could not connect to server. Please try again.');
    } finally {
      setFinishing(false);
    }
  };

  const signOut = async () => {
    await Promise.race([logoutSession(currentRefreshToken()).catch(() => {}), new Promise(r => setTimeout(r, 2000))]);
    await clearAuth();
    onSignedOut();
  };

  if (finishing || error) {
    return (
      <View style={{ gap: 14, paddingVertical: 8 }}>
        {!!error && <Text style={{ color: T.err, fontSize: 13 }} accessibilityRole="alert">{error}</Text>}
        <PrimaryButton label="Continue" onPress={finish} loading={finishing} />
      </View>
    );
  }

  if (settingUp) {
    return (
      <TwoFactorSetupFlow
        compact
        onDone={finish}
        onCancel={blocking ? signOut : () => setSettingUp(false)}
        cancelLabel={blocking ? 'Sign out' : 'Back'}
      />
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{
        flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 16,
        backgroundColor: withAlpha(T.brandGold, 0.10), borderWidth: 1, borderColor: withAlpha(T.brandGold, 0.28),
      }}>
        <Feather name="shield" size={20} color={T.brandGold} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} accessibilityRole="header">
            Your gym requires two-step sign-in
          </Text>
          <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 18 }}>
            {days !== null && days > 0
              ? `Set it up within ${days} ${days === 1 ? 'day' : 'days'} to keep access. It takes about a minute with an authenticator app.`
              : 'Set it up now with an authenticator app. It takes about a minute.'}
          </Text>
        </View>
      </View>
      <PrimaryButton label="Set up now" icon="shield" onPress={() => setSettingUp(true)} />
      {!blocking && <LinkButton label="Remind me later" onPress={onContinue} />}
      {blocking && <LinkButton label="Sign out" onPress={signOut} />}
    </View>
  );
}
