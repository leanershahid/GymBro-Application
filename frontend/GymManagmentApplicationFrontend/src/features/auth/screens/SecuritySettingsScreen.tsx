import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';
import { isAdminRole, useSession } from '../../../api/session';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import SmallButton from '../../common/components/SmallButton';
import LoadingState from '../../common/components/LoadingState';
import StatusPill from '../../common/components/StatusPill';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { confirm } from '../../common/components/dialogs';
import { useToast } from '../../common/components/Toast';
import {
  useDisableTwoFactor, useForgetTrustedDevices, useRegenerateRecoveryCodes, useSaveTwoFactorPolicy,
  useTwoFactorPolicy, useTwoFactorStatus,
} from '../api/twoFactorQueries';
import { TwoFactorPolicy } from '../types/auth.types';
import { graceDaysLeft, sanitizeCode, sanitizeRecoveryCode } from '../utils/twoFactor';
import TwoFactorSetupFlow from '../components/twoFactor/TwoFactorSetupFlow';
import RecoveryCodesList from '../components/twoFactor/RecoveryCodesList';

type Panel = 'none' | 'setup' | 'disable' | 'regenerate';

/**
 * Profile → Security (roadmap feature 10), self-contained: two-step sign-in status, turn on/off,
 * recovery codes (regenerate → shown once, copy/download), forget remembered devices, and for
 * gym admins the gym's 2FA policy. Mount it from any profile/settings screen with an onBack.
 */
export default function SecuritySettingsScreen({ onBack }: { onBack?: () => void }) {
  const session = useSession();
  const status = useTwoFactorStatus();
  const [panel, setPanel] = useState<Panel>('none');
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);

  const s = status.data;
  const days = graceDaysLeft(s?.graceEndsAt);

  return (
    <Screen>
      <ScreenHeader title="Security" eyebrow="Profile" onBack={onBack} />
      {status.isLoading ? <LoadingState label="Loading security settings" /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 20 }} keyboardShouldPersistTaps="handled">
          {status.isError && (
            <Card>
              <Text style={{ color: T.err, fontSize: 14 }} accessibilityRole="alert">Could not load your security settings.</Text>
              <SmallButton icon="refresh-cw" label="Try again" onPress={() => void status.refetch()} />
            </Card>
          )}

          {s && (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: withAlpha(s.enabled ? T.ok : T.brandGold, 0.12) }}>
                  <Feather name={s.enabled ? 'shield' : 'shield-off'} size={20} color={s.enabled ? T.ok : T.brandGold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.text, fontSize: 17, fontWeight: '700' }} accessibilityRole="header">Two-step sign-in</Text>
                  <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }}>
                    {s.enabled ? 'A code from your authenticator app is asked after your password.' : 'Add a code from an authenticator app after your password.'}
                  </Text>
                </View>
                <StatusPill label={s.enabled ? 'On' : 'Off'} tone={s.enabled ? 'ok' : 'neutral'} dot />
              </View>

              {s.required && !s.enabled && (
                <Text style={{ color: T.brandGold, fontSize: 13, lineHeight: 18 }} accessibilityLiveRegion="polite">
                  Your gym requires this for your role
                  {days !== null && days > 0 ? ` — set it up within ${days} ${days === 1 ? 'day' : 'days'}.` : '. Set it up now.'}
                </Text>
              )}

              {s.enabled && (
                <View style={{ gap: 6 }}>
                  <Row label="Recovery codes left" value={`${s.recoveryCodesRemaining} of 10`} warn={s.recoveryCodesRemaining <= 2} />
                  <Row label="Remembered devices" value={String(s.trustedDevices)} />
                  {s.required && <Row label="Required by your gym" value="Yes" />}
                </View>
              )}

              {panel === 'none' && !freshCodes && (
                s.enabled ? (
                  <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <SmallButton icon="key" label="New recovery codes" onPress={() => setPanel('regenerate')} />
                    {s.trustedDevices > 0 && <ForgetDevicesButton />}
                    {!s.required && <SmallButton icon="x-circle" label="Turn off" tone={T.err} onPress={() => setPanel('disable')} />}
                  </View>
                ) : (
                  <PrimaryButton label="Turn on two-step sign-in" icon="shield" onPress={() => setPanel('setup')} />
                )
              )}

              {panel === 'setup' && (
                <TwoFactorSetupFlow onDone={() => setPanel('none')} onCancel={() => setPanel('none')} />
              )}
              {panel === 'disable' && <DisableForm onClose={() => setPanel('none')} />}
              {panel === 'regenerate' && (
                <RegenerateForm onClose={() => setPanel('none')} onCodes={(c) => { setFreshCodes(c); setPanel('none'); }} />
              )}
              {freshCodes && (
                <View style={{ gap: 12 }}>
                  <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>Your new recovery codes</Text>
                  <RecoveryCodesList codes={freshCodes} account={`user ${session?.userId ?? ''}`} />
                  <PrimaryButton label="Done" onPress={() => setFreshCodes(null)} />
                </View>
              )}
            </Card>
          )}

          {isAdminRole(session?.role) && <PolicyCard />}
        </ScrollView>
      )}
    </Screen>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: T.bgInput, borderRadius: 20, borderWidth: 1, borderColor: T.line, padding: 18, gap: 14 }}>
      {children}
    </View>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={{ color: T.textSub, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: warn ? T.brandGold : T.text, fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

function ForgetDevicesButton() {
  const forget = useForgetTrustedDevices();
  const toast = useToast();
  return (
    <SmallButton icon="smartphone" label="Forget devices" busy={forget.isPending} onPress={async () => {
      const ok = await confirm({ title: 'Forget remembered devices?', message: 'Every device will ask for a code at its next sign-in.', confirmLabel: 'Forget' });
      if (ok) forget.mutate(undefined, { onSuccess: () => toast.show({ message: 'Remembered devices forgotten.' }) });
    }} />
  );
}

/** Code field accepting an app code or a recovery code. */
function StepUpCode({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Authenticator code or recovery code" value={value}
      onChangeText={(v) => onChange(/[a-z]/i.test(v) ? sanitizeRecoveryCode(v) : sanitizeCode(v))}
      placeholder="123456" autoCapitalize="none" autoCorrect={false} />
  );
}

function DisableForm({ onClose }: { onClose: () => void }) {
  const disable = useDisableTwoFactor();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (!password || !code) return setError('Enter your password and a code.');
    setError('');
    disable.mutate({ password, code }, {
      onSuccess: (res) => {
        if (res.success) { toast.show({ message: 'Two-step sign-in is off.' }); onClose(); }
        else setError(res.message || 'Could not turn it off.');
      },
      onError: () => setError('Could not connect to server. Please try again.'),
    });
  };
  return (
    <View>
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 12 }}>Confirm it's you to turn off two-step sign-in. Your recovery codes and remembered devices stop working.</Text>
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} />
      <StepUpCode value={code} onChange={setCode} />
      {!!error && <Text style={{ color: T.err, fontSize: 13, marginBottom: 10 }} accessibilityRole="alert">{error}</Text>}
      <View style={{ gap: 10 }}>
        <PrimaryButton label="Turn off" variant="danger" onPress={submit} loading={disable.isPending} />
        <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </View>
  );
}

function RegenerateForm({ onClose, onCodes }: { onClose: () => void; onCodes: (codes: string[]) => void }) {
  const regen = useRegenerateRecoveryCodes();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (!code) return setError('Enter a code.');
    setError('');
    regen.mutate(code, {
      onSuccess: (res) => (res.success && res.data ? onCodes(res.data.recoveryCodes) : setError(res.message || 'That code is incorrect.')),
      onError: () => setError('Could not connect to server. Please try again.'),
    });
  };
  return (
    <View>
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 12 }}>New codes replace the old ones — any you saved before will stop working.</Text>
      <StepUpCode value={code} onChange={setCode} />
      {!!error && <Text style={{ color: T.err, fontSize: 13, marginBottom: 10 }} accessibilityRole="alert">{error}</Text>}
      <View style={{ gap: 10 }}>
        <PrimaryButton label="Create new codes" onPress={submit} loading={regen.isPending} />
        <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </View>
  );
}

/** Gym admins: who must use two-step sign-in, and the grace period. */
export function PolicyCard() {
  const policy = useTwoFactorPolicy();
  const save = useSaveTwoFactorPolicy();
  const toast = useToast();
  const [draft, setDraft] = useState<TwoFactorPolicy | null>(null);
  const [graceText, setGraceText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (policy.data) { setDraft(policy.data); setGraceText(String(policy.data.gracePeriodDays)); }
  }, [policy.data]);

  if (!draft) return policy.isError
    ? <Card><Text style={{ color: T.err, fontSize: 14 }}>Could not load the gym's sign-in policy.</Text></Card>
    : null;

  const submit = () => {
    const days = Number(graceText);
    if (!Number.isInteger(days) || days < 0 || days > 30) return setError('Grace period: a whole number of days from 0 to 30.');
    setError('');
    save.mutate({ ...draft, gracePeriodDays: days }, {
      onSuccess: (res) => (res.success ? toast.show({ message: 'Sign-in policy saved.' }) : setError(res.message)),
      onError: () => setError('Could not connect to server. Please try again.'),
    });
  };

  return (
    <Card>
      <Text style={{ color: T.text, fontSize: 17, fontWeight: '700' }} accessibilityRole="header">Gym sign-in policy</Text>
      <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 18 }}>
        People who must use two-step sign-in are asked to set it up at their next sign-in. Members can always turn it on themselves. Super admins always need it.
      </Text>
      <View>
        <SwitchRow label="Require for admins" value={draft.requireForAdmins}
          onValueChange={(v) => setDraft({ ...draft, requireForAdmins: v })} description="Recommended — admins can see and change everything." />
        <SwitchRow label="Require for all staff roles" value={draft.requireForStaff}
          onValueChange={(v) => setDraft({ ...draft, requireForStaff: v })} description="Trainers, front desk and custom roles." />
        <Field label="Grace period (days)" value={graceText} onChangeText={(v) => setGraceText(v.replace(/\D/g, '').slice(0, 2))}
          keyboardType="number-pad" placeholder="7" />
      </View>
      {!!error && <Text style={{ color: T.err, fontSize: 13 }} accessibilityRole="alert">{error}</Text>}
      <PrimaryButton label="Save policy" onPress={submit} loading={save.isPending} />
    </Card>
  );
}
