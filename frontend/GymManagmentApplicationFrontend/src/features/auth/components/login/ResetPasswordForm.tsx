import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useForgotPassword, useResetPassword } from '../../api/authQueries';
import { styles } from './loginStyles';
import { CTAButton, InputField } from './LoginControls';

// ─── Forgot / reset password ──────────────────────────────────────────────────
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** Forgot-password (send code) and reset-password (code + new password) steps of the login sheet. */
export default function ResetPasswordForm({ mode, initialEmail, onCodeSent, onDone, onCancel, onError }: {
  mode: 'forgot' | 'reset';
  initialEmail: string;
  onCodeSent: (email: string) => void;
  onDone: () => void;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const forgot = useForgotPassword();
  const reset = useResetPassword();

  const sendCode = () => {
    if (!isEmail(email)) return onError('Enter the email address you sign in with.');
    forgot.mutate(email.trim(), {
      onSuccess: (res) => (res.success ? onCodeSent(email.trim()) : onError(res.message)),
      onError: () => onError('Could not connect to server. Please try again.'),
    });
  };

  const submit = () => {
    if (!/^\d{6}$/.test(code.trim())) return onError('Enter the 6-digit code from the email.');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      return onError('New password: at least 8 characters, with a letter and a number.');
    if (password !== confirm) return onError('The two passwords do not match.');
    reset.mutate({ email: email.trim(), code: code.trim(), newPassword: password }, {
      onSuccess: (res) => (res.success ? onDone() : onError([res.message, ...(res.errors ?? [])].filter(Boolean).join('\n'))),
      onError: () => onError('Could not connect to server. Please try again.'),
    });
  };

  const toggle = (
    <TouchableOpacity style={styles.showHideBtn} onPress={() => setShow(p => !p)} hitSlop={8}
      accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'}>
      <Text style={styles.showHideText}>{show ? 'Hide' : 'Show'}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <View style={styles.inputsStack}>
        {mode === 'forgot' ? (
          <InputField value={email} onChangeText={setEmail} placeholder="Your email..." keyboardType="email-address"
            accessibilityLabel="Email" textContentType="username" autoComplete="email" returnKeyType="go" onSubmitEditing={sendCode} />
        ) : (
          <>
            <InputField value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code..."
              keyboardType="number-pad" accessibilityLabel="Code from email" textContentType="oneTimeCode" autoComplete="one-time-code" returnKeyType="next" />
            <InputField value={password} onChangeText={setPassword} placeholder="New password..." secureTextEntry={!show}
              accessibilityLabel="New password" textContentType="newPassword" autoComplete="new-password" returnKeyType="next" rightElement={toggle} />
            <InputField value={confirm} onChangeText={setConfirm} placeholder="Confirm new password..." secureTextEntry={!show}
              accessibilityLabel="Confirm new password" textContentType="newPassword" autoComplete="new-password" returnKeyType="go" onSubmitEditing={submit} />
          </>
        )}
      </View>

      <View style={styles.ctaWrapper}>
        {mode === 'forgot'
          ? <CTAButton label="Send code" onPress={sendCode} loading={forgot.isPending} />
          : <CTAButton label="Set new password" onPress={submit} loading={reset.isPending} />}
      </View>

      <View style={styles.linkRow}>
        {mode === 'reset' && (
          <TouchableOpacity onPress={sendCode} hitSlop={8} accessibilityRole="button" disabled={forgot.isPending}>
            <Text style={styles.linkText}>Resend code</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onCancel} hitSlop={8} accessibilityRole="button">
          <Text style={styles.linkText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
