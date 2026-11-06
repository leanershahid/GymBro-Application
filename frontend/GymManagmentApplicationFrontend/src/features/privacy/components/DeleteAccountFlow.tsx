import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import { Field } from '../../common/components/FormFields';
import { showAlert } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useRequestDeletion, useSendDeletionCode } from '../api/privacyQueries';
import { DeletionIssue, DeletionRequest, PrivacyOverview } from '../api/privacy.types';
import { Bullet, Card, Notice, fmtDate } from './PrivacyUi';

type Step = 'what' | 'confirm' | 'done';

interface Props {
  overview: PrivacyOverview;
  onCancel: () => void;
  /** After the request is saved every session is revoked: this signs the member out. */
  onSignOut: () => void;
  /** Opens the screen that fixes a blocker ("billing", "shop/orders"). */
  onOpenRoute?: (route: string) => void;
}

function StepDots({ step }: { step: Step }) {
  const steps: Step[] = ['what', 'confirm', 'done'];
  const i = steps.indexOf(step);
  return (
    <View accessible accessibilityLabel={`Step ${i + 1} of 3`} style={{ flexDirection: 'row', gap: 6, marginBottom: SP.lg }}>
      {steps.map((s, n) => (
        <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= i ? T.err : T.line }} />
      ))}
    </View>
  );
}

function IssueRow({ issue, onOpenRoute }: { issue: DeletionIssue; onOpenRoute?: (route: string) => void }) {
  return (
    <View style={{ gap: SP.xs }}>
      <Text style={{ color: T.text, fontSize: 14, lineHeight: 20 }}>{issue.message}</Text>
      {!!issue.action && <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>{issue.action}</Text>}
      {!!issue.route && onOpenRoute && (
        <Pressable onPress={() => onOpenRoute(issue.route!)} accessibilityRole="link" hitSlop={8}
          style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <Text style={{ color: T.brand, fontSize: 14, fontWeight: '700' }}>
            {issue.route === 'billing' ? 'Open Membership' : issue.route.startsWith('shop') ? 'Open my orders' : 'Open'} →
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Delete my account in three plain steps: what happens → confirm with password (or emailed code,
 * plus a two-step code when that's on) → done, with the date. Blockers (money owed, an order on
 * its way) are shown up front with what to do; nothing is hidden or pre-ticked.
 */
export default function DeleteAccountFlow({ overview, onCancel, onSignOut, onOpenRoute }: Props) {
  const [step, setStep] = useState<Step>('what');
  const [understood, setUnderstood] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DeletionRequest | null>(null);
  const request = useRequestDeletion();
  const sendCode = useSendDeletionCode();
  const { deletionCheck: check, reauth, links } = overview;

  if (step === 'done' && done) {
    return (
      <Card title="Deletion scheduled">
        <StepDots step="done" />
        <View style={{ alignItems: 'center', paddingVertical: SP.md }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: withAlpha(T.err, 0.12), alignItems: 'center', justifyContent: 'center', marginBottom: SP.md }}>
            <Feather name="calendar" size={24} color={T.err} />
          </View>
          <Text accessibilityRole="header" style={{ color: T.text, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
            Your account will be deleted on {fmtDate(done.scheduledFor)}
          </Text>
          <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: SP.sm }}>
            We've emailed you a confirmation and signed you out on all devices. Changed your mind? Sign in before
            {' '}{fmtDate(done.scheduledFor)} and tap “Keep my account”.
          </Text>
        </View>
        <PrimaryButton label="OK, sign me out" icon="log-out" onPress={onSignOut} style={{ marginTop: SP.md }} />
      </Card>
    );
  }

  if (step === 'what') {
    return (
      <Card title="Delete my account" tone="danger">
        <StepDots step="what" />
        <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SP.sm }}>What happens</Text>
        <Bullet icon="clock">{`You have ${links.graceDays} days to change your mind. Sign in and tap “Keep my account” to stop it.`}</Bullet>
        <Bullet icon="log-out">You'll be signed out on all your devices straight away.</Bullet>
        <Bullet icon="trash-2" tone="danger">After that, your name, contact details, photo, health answers, emergency contact, addresses, cart and saved items are deleted.</Bullet>
        <Bullet icon="file-text">Invoices, payments and shop orders are kept with your name removed, because tax law requires it. Signed waivers are kept as a dated record without your name.</Bullet>
        <Bullet icon="download">Want a copy first? Use “Download my data” above before you delete.</Bullet>

        {check.blockers.length > 0 && (
          <Notice tone="danger" title="You can't delete your account yet">
            <View style={{ gap: SP.md }}>
              {check.blockers.map(b => <IssueRow key={b.code} issue={b} onOpenRoute={onOpenRoute} />)}
            </View>
          </Notice>
        )}
        {check.warnings.map(w => (
          <Notice key={w.code} tone="warn"><IssueRow issue={w} onOpenRoute={onOpenRoute} /></Notice>
        ))}

        <View style={{ flexDirection: 'row', gap: SP.md, marginTop: SP.sm }}>
          <PrimaryButton label="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
          <PrimaryButton label="Continue" variant="danger" disabled={!check.canDelete} onPress={() => setStep('confirm')} style={{ flex: 1 }}
            accessibilityHint={check.canDelete ? 'Go to the confirmation step' : 'Not available until the items above are sorted'} />
        </View>
      </Card>
    );
  }

  const usesPassword = reauth.method === 'password';
  const canSubmit = understood && (usesPassword ? password.length > 0 : code.trim().length >= 6)
    && (!reauth.twoFactor || twoFactorCode.trim().length >= 6);

  const submit = () => {
    setError(null);
    request.mutate(
      { password: usesPassword ? password : undefined, code: usesPassword ? undefined : code.trim(), twoFactorCode: reauth.twoFactor ? twoFactorCode.trim() : undefined, confirm: true },
      {
        onSuccess: r => { setDone(r); setStep('done'); },
        onError: e => setError(apiErrorText(e)),
      },
    );
  };

  const askCode = () => sendCode.mutate(undefined, {
    onSuccess: () => { setCodeSent(true); showAlert('Code sent', 'Check your email for a 6-digit code.'); },
    onError: e => showAlert('Couldn’t send the code', apiErrorText(e)),
  });

  return (
    <Card title="Confirm it's you" tone="danger">
      <StepDots step="confirm" />
      {usesPassword ? (
        <Field label="Your password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} />
      ) : (
        <>
          <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20, marginBottom: SP.md }}>
            Your account has no password, so we'll email you a code to confirm.
          </Text>
          <PrimaryButton label={codeSent ? 'Send a new code' : 'Email me a code'} icon="mail" variant="secondary"
            loading={sendCode.isPending} disabled={!reauth.hasEmail} onPress={askCode} style={{ marginBottom: SP.md }} />
          <Field label="Code from the email" value={code} onChangeText={setCode} keyboardType="number-pad" autoCapitalize="none" autoCorrect={false} />
        </>
      )}
      {reauth.twoFactor && (
        <Field label="Two-step code (authenticator app or a recovery code)" value={twoFactorCode} onChangeText={setTwoFactorCode}
          autoCapitalize="none" autoCorrect={false} />
      )}

      <Pressable
        onPress={() => setUnderstood(v => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: understood }}
        accessibilityLabel={`I understand my account will be deleted after ${links.graceDays} days`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 48, marginBottom: SP.md }}>
        <View style={{ width: 24, height: 24, borderRadius: R.sm, borderWidth: 2, borderColor: understood ? T.err : T.textFaint, backgroundColor: understood ? T.err : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {understood && <Feather name="check" size={16} color={T.text} />}
        </View>
        <Text style={{ flex: 1, color: T.text, fontSize: 14, lineHeight: 20 }}>
          I understand my account will be deleted after {links.graceDays} days unless I keep it.
        </Text>
      </Pressable>

      {!!error && <Notice tone="danger">{error}</Notice>}

      <View style={{ flexDirection: 'row', gap: SP.md }}>
        <PrimaryButton label="Back" variant="secondary" onPress={() => setStep('what')} disabled={request.isPending} style={{ flex: 1 }} />
        <PrimaryButton label="Delete my account" icon="trash-2" variant="danger" onPress={submit}
          loading={request.isPending} disabled={!canSubmit} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}
