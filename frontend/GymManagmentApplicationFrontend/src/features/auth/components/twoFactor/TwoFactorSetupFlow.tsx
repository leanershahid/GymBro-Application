import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../../theme';
import PrimaryButton from '../../../common/components/PrimaryButton';
import SmallButton from '../../../common/components/SmallButton';
import { useToast } from '../../../common/components/Toast';
import { useEnableTwoFactor, useStartTwoFactorSetup } from '../../api/twoFactorQueries';
import { TwoFactorSetup } from '../../types/auth.types';
import { copyText } from '../../utils/shareText';
import CodeInput from './CodeInput';
import RecoveryCodesList from './RecoveryCodesList';

/**
 * Authenticator-app enrolment: get a key → add it to the app → confirm with a code → save the
 * recovery codes. Used by the forced setup gate on the login sheet and by Security settings.
 *
 * No QR package is installed (adding one means changing package.json, owned by another workstream),
 * so the key is shown with Copy and, on phones, "Open authenticator app" (the otpauth:// link that
 * Google/Microsoft Authenticator, 1Password, Authy… register for). The server returns the
 * otpauth URI, so a QR can be dropped in later (e.g. react-native-qrcode-svg on react-native-svg).
 */
export default function TwoFactorSetupFlow({ onDone, onCancel, cancelLabel = 'Cancel', compact = false }: {
  onDone: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  /** Tighter text for the login sheet. */
  compact?: boolean;
}) {
  const toast = useToast();
  const start = useStartTwoFactorSetup();
  const enable = useEnableTwoFactor();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);

  const begin = useCallback(() => {
    setError('');
    start.mutate(undefined, {
      onSuccess: (res) => (res.success && res.data ? setSetup(res.data) : setError(res.message || 'Could not start setup.')),
      onError: () => setError('Could not connect to server. Please try again.'),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { begin(); }, [begin]);

  const confirm = useCallback((value: string) => {
    if (value.length !== 6 || enable.isPending) return;
    setError('');
    enable.mutate(value, {
      onSuccess: (res) => {
        if (res.success && res.data) setCodes(res.data.recoveryCodes);
        else { setError(res.message || 'That code does not match.'); setCode(''); }
      },
      onError: () => setError('Could not connect to server. Please try again.'),
    });
  }, [enable]);

  const copyKey = async () => {
    if (!setup) return;
    const r = await copyText(setup.secret);
    if (r === 'copied') toast.show({ message: 'Setup key copied.' });
  };

  const openApp = async () => {
    if (!setup) return;
    try { await Linking.openURL(setup.otpAuthUri); }
    catch { toast.show({ type: 'error', message: 'No authenticator app found. Install one, or type the key in.' }); }
  };

  const body = { color: T.textSub, fontSize: compact ? 13 : 14, lineHeight: compact ? 18 : 20 };
  const title = { color: T.text, fontSize: compact ? 16 : 18, fontWeight: '700' as const };

  if (codes) {
    return (
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="check-circle" size={20} color={T.ok} />
          <Text style={title} accessibilityRole="header">Two-step sign-in is on</Text>
        </View>
        <Text style={body}>Save these recovery codes now.</Text>
        <RecoveryCodesList codes={codes} account={setup?.account ?? ''} />
        <PrimaryButton label="I've saved my codes" onPress={onDone} />
      </View>
    );
  }

  if (!setup) {
    return (
      <View style={{ gap: 14, alignItems: 'stretch' }}>
        {start.isPending || !error ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }} accessibilityLabel="Preparing setup">
            <ActivityIndicator color={T.brand} />
          </View>
        ) : (
          <>
            <Text style={{ color: T.err, fontSize: 13 }} accessibilityRole="alert">{error}</Text>
            <PrimaryButton label="Try again" onPress={begin} />
          </>
        )}
        {onCancel && <LinkButton label={cancelLabel} onPress={onCancel} />}
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <Step n={1} text="Install an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…)." style={body} />
      <Step n={2} text={Platform.OS === 'web' ? 'Add an account in the app and type in this setup key:' : 'Add this key to the app — tap “Open authenticator app”, or type it in:'} style={body} />

      <View style={{ backgroundColor: T.bgInput, borderRadius: 16, borderWidth: 1, borderColor: T.line, padding: 14, gap: 10 }}>
        <Text
          selectable
          style={{ color: T.text, fontSize: 17, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'monospace' }}
          accessibilityLabel={`Setup key ${setup.secret.split('').join(' ')}`}
        >
          {setup.secretGrouped}
        </Text>
        <Text style={{ color: T.textFaint, fontSize: 12 }}>{setup.issuer} · {setup.account} · time-based</Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <SmallButton icon="copy" label={Platform.OS === 'web' ? 'Copy key' : 'Share key'} onPress={copyKey} />
          {Platform.OS !== 'web' && <SmallButton icon="external-link" label="Open authenticator app" onPress={openApp} />}
        </View>
      </View>

      <Step n={3} text="Enter the 6-digit code the app shows:" style={body} />
      <CodeInput value={code} onChange={(v) => { setCode(v); setError(''); }} onComplete={confirm} error={!!error}
        disabled={enable.isPending} autoFocus={false} accessibilityLabel="Code from your authenticator app" />
      {!!error && <Text style={{ color: T.err, fontSize: 13 }} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>}

      <PrimaryButton label="Turn on" onPress={() => confirm(code)} loading={enable.isPending} disabled={code.length !== 6} />
      {onCancel && <LinkButton label={cancelLabel} onPress={onCancel} />}
    </View>
  );
}

function Step({ n, text, style }: { n: number; text: string; style: object }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: withAlpha(T.brand, 0.12), alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: T.brand, fontSize: 12, fontWeight: '700' }}>{n}</Text>
      </View>
      <Text style={[style, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

export function LinkButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
      style={{ alignSelf: 'center', paddingVertical: 6, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: T.brand, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
