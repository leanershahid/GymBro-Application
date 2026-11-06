import React, { useState } from 'react';
import { Text, View, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import { Field } from '../../common/components/FormFields';
import { describeApiError } from '../../../api/apiError';
import { useSignWaiver } from '../api/safetyQueries';
import { WaiverToSign } from '../api/safety.types';
import StepLayout from './StepLayout';
import WaiverText from './WaiverText';
import { CheckRow, Notice, StepTitle } from './SafetyUi';
import { fmtDay } from '../utils/safetyGate';

/**
 * Read-then-sign: the signature fields unlock once the member has scrolled to the end of the
 * text (or it all fits on screen). Signing = typed full name + "I agree" checkbox.
 */
export default function WaiverStep({ waiver, index, count, onSigned, onSkip }: {
  waiver: WaiverToSign; index: number; count: number; onSigned: () => void; onSkip?: () => void;
}) {
  const [read, setRead] = useState(false);
  const [viewH, setViewH] = useState(0);
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sign = useSignWaiver();

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (!read && layoutMeasurement.height + contentOffset.y >= contentSize.height - 160) setRead(true);
  };
  const onContentSize = (_w: number, h: number) => { if (viewH > 0 && h <= viewH + 40) setRead(true); };

  const canSign = read && agreed && name.trim().length >= 2;
  const submit = () => {
    setError(null);
    sign.mutate({ versionId: waiver.versionId, signedName: name.trim() }, {
      onSuccess: () => { setName(''); setAgreed(false); setRead(false); onSigned(); },
      onError: e => setError(describeApiError(e).message),
    });
  };

  return (
    <StepLayout
      onScroll={onScroll}
      onLayout={setViewH}
      onContentSizeChange={onContentSize}
      footer={
        <>
          <PrimaryButton
            label={read ? 'Sign waiver' : 'Scroll to the end to sign'}
            icon={read ? 'edit-3' : 'chevrons-down'}
            onPress={submit}
            loading={sign.isPending}
            disabled={!canSign}
            accessibilityHint={read ? 'Signs the waiver with the name you typed' : 'Read the whole waiver first'}
          />
          {onSkip && <PrimaryButton label="Not now" variant="secondary" onPress={onSkip} disabled={sign.isPending} />}
        </>
      }
    >
      <StepTitle
        eyebrow={count > 1 ? `Waiver ${index + 1} of ${count}` : 'Waiver'}
        title={waiver.title}
        sub={`Please read it all the way through. Version ${waiver.version} · published ${fmtDay(waiver.publishedAt)}.`}
      />

      {waiver.previouslySignedVersion != null && (
        <View style={{ marginBottom: SP.lg }}>
          <Notice icon="refresh-cw" tone={T.brandGold} title="This waiver was updated">
            {`You signed version ${waiver.previouslySignedVersion}. The gym has changed it, so please read and sign the new version.`}
          </Notice>
        </View>
      )}

      <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, padding: SP.lg }}>
        <WaiverText body={waiver.body} />
      </View>

      <View style={{ marginTop: SP.xl, gap: SP.md, opacity: read ? 1 : 0.45 }} pointerEvents={read ? 'auto' : 'none'}>
        {!read && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="chevrons-down" size={14} color={T.textFaint} />
            <Text style={{ color: T.textFaint, fontSize: 13 }}>Keep scrolling to unlock signing</Text>
          </View>
        )}
        <Text accessibilityRole="header" style={{ color: T.text, fontSize: 17, fontWeight: '700' }}>Your signature</Text>
        <Field
          label="Type your full name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Aarav Mehta"
          autoCapitalize="words"
          autoCorrect={false}
          editable={read}
          error={error ?? undefined}
        />
        <CheckRow
          checked={agreed}
          onToggle={() => setAgreed(a => !a)}
          disabled={!read}
          label="I have read this waiver, I understand it, and I agree to it."
        />
        <Text style={{ color: T.textFaint, fontSize: 12, lineHeight: 17 }}>
          Typing your name counts as your signature. We save the date, time and device you signed from. A signed waiver can't be changed.
        </Text>
      </View>
    </StepLayout>
  );
}
