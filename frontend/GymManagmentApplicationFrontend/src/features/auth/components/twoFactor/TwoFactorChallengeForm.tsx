import React, { useCallback, useState } from 'react';
import { Switch, Text, TouchableOpacity, View } from 'react-native';
import { T } from '../../../../theme';
import { useSendTwoFactorEmailCode, useVerifyTwoFactor } from '../../api/authQueries';
import { attemptsRemaining, challengeEnded } from '../../api/twoFactorApi';
import { AuthData, TwoFactorMethod } from '../../types/auth.types';
import { isRecoveryCode, sanitizeRecoveryCode } from '../../utils/twoFactor';
import { styles } from '../login/loginStyles';
import { CTAButton, InputField } from '../login/LoginControls';
import CodeInput from './CodeInput';

const PROMPT: Record<TwoFactorMethod, string> = {
  totp: 'Enter the 6-digit code from your authenticator app.',
  email: 'Enter the 6-digit code we emailed you.',
  recovery: 'Enter one of your recovery codes (like abcde-fghij). Each works once.',
};

/** Second step of sign-in on the login sheet: app code, emailed code or a recovery code. */
export default function TwoFactorChallengeForm({ email, challengeToken, methods, onSuccess, onRestart, onError }: {
  email: string;
  challengeToken: string;
  methods: TwoFactorMethod[];
  onSuccess: (data: AuthData) => void;
  /** The challenge is over (used, expired, too many tries): back to the password step with this message. */
  onRestart: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [method, setMethod] = useState<TwoFactorMethod>('totp');
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(false);
  const [notice, setNotice] = useState('');
  const verify = useVerifyTwoFactor(email);
  const sendEmail = useSendTwoFactorEmailCode();

  const submit = useCallback((value: string) => {
    if (verify.isPending) return;
    if (method === 'recovery' ? !isRecoveryCode(value) : value.length !== 6) {
      onError(method === 'recovery' ? 'Enter a full recovery code.' : 'Enter all 6 digits.');
      return;
    }
    onError('');
    verify.mutate({ challengeToken, code: value, method, rememberDevice: remember }, {
      onSuccess: (res) => {
        if (res.success && res.data?.accessToken) return onSuccess(res.data);
        if (challengeEnded(res)) return onRestart(res.message || 'Please sign in again.');
        const left = attemptsRemaining(res);
        setCode('');
        onError([res.message || 'That code is incorrect.', left !== null ? `${left} ${left === 1 ? 'try' : 'tries'} left.` : '']
          .filter(Boolean).join(' '));
      },
      onError: () => onError('Could not connect to server. Please try again.'),
    });
  }, [verify, method, challengeToken, remember, onSuccess, onRestart, onError]);

  const switchTo = (m: TwoFactorMethod) => { setMethod(m); setCode(''); onError(''); setNotice(''); };

  const emailMe = () => {
    sendEmail.mutate(challengeToken, {
      onSuccess: (res) => {
        if (res.success) { switchTo('email'); setNotice(`We've emailed a code to ${email}. It expires in 15 minutes.`); }
        else if (challengeEnded(res)) onRestart(res.message || 'Please sign in again.');
        else onError(res.message || 'Could not send the email.');
      },
      onError: () => onError('Could not connect to server. Please try again.'),
    });
  };

  return (
    <>
      {!!notice && <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text>}
      <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20, marginBottom: 14 }} accessibilityLiveRegion="polite">
        {PROMPT[method]}
      </Text>

      {method === 'recovery' ? (
        <View style={styles.inputsStack}>
          <InputField value={code} onChangeText={(v) => setCode(sanitizeRecoveryCode(v))} placeholder="Recovery code..."
            accessibilityLabel="Recovery code" returnKeyType="go" onSubmitEditing={() => submit(code)} />
        </View>
      ) : (
        <CodeInput value={code} onChange={(v) => { setCode(v); onError(''); }} onComplete={submit} disabled={verify.isPending}
          accessibilityLabel={method === 'email' ? 'Code from email' : 'Code from authenticator app'} />
      )}

      <TouchableOpacity
        onPress={() => setRemember(r => !r)}
        activeOpacity={0.7}
        accessibilityRole="switch"
        accessibilityState={{ checked: remember }}
        accessibilityLabel="Remember this device for 30 days"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 4 }}
      >
        <Text style={{ color: T.textSub, fontSize: 13, flex: 1 }}>Remember this device for 30 days</Text>
        <Switch
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          value={remember}
          onValueChange={setRemember}
          trackColor={{ false: T.line, true: T.brand }}
          thumbColor={remember ? T.onBrand : T.text}
          ios_backgroundColor={T.line}
        />
      </TouchableOpacity>

      <View style={styles.ctaWrapper}>
        <CTAButton label="Verify" onPress={() => submit(code)} loading={verify.isPending} />
      </View>

      <View style={[styles.linkRow, { flexWrap: 'wrap', rowGap: 10 }]}>
        {method !== 'totp' && (
          <TouchableOpacity onPress={() => switchTo('totp')} hitSlop={8} accessibilityRole="button">
            <Text style={styles.linkText}>Use authenticator app</Text>
          </TouchableOpacity>
        )}
        {methods.includes('email') && (
          <TouchableOpacity onPress={emailMe} hitSlop={8} accessibilityRole="button" disabled={sendEmail.isPending}
            accessibilityState={{ disabled: sendEmail.isPending, busy: sendEmail.isPending }}>
            <Text style={styles.linkText}>{method === 'email' ? 'Resend email' : 'Email me a code'}</Text>
          </TouchableOpacity>
        )}
        {method !== 'recovery' && methods.includes('recovery') && (
          <TouchableOpacity onPress={() => switchTo('recovery')} hitSlop={8} accessibilityRole="button">
            <Text style={styles.linkText}>Use a recovery code</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={[styles.linkRow, { justifyContent: 'center' }]}>
        <TouchableOpacity onPress={() => onRestart('')} hitSlop={8} accessibilityRole="button">
          <Text style={styles.linkText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
