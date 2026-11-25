import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, SP, R, withAlpha } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import { describeApiError } from '../../../api/apiError';
import FaceCamera from './FaceCamera';
import { useEnrollMemberFace, useEnrollMyFace, useMyFace } from '../api/faceQueries';
import { CapturedSelfie } from '../types/attendance.types';
import { faceErrorFrom, providerText, retentionText } from '../utils/faceCheck';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Enrolment saved (e.g. continue the check-in). */
  onEnrolled?: () => void;
  /** "self": the member in the app. "desk": staff enrol a member at the front desk. */
  mode?: 'self' | 'desk';
  memberId?: number;
  memberName?: string;
  /** Gym's selfie retention, for the consent text. */
  keepCheckInSelfiesDays?: number;
  /** Shown above the consent (e.g. "Your gym now checks faces at check-in"). */
  reason?: string;
  /** Where faces are compared, for the consent text. */
  faceProvider?: 'local' | 'aws' | 'none';
}

/** The consent text, shared by the app and the desk (DPDP: purpose, storage, retention, withdrawal). */
export function FaceConsentText({ keepDays, desk, provider }: { keepDays: number; desk?: boolean; provider?: 'local' | 'aws' | 'none' }) {
  const you = desk ? 'the member' : 'you';
  const your = desk ? 'their' : 'your';
  const items: { icon: React.ComponentProps<typeof Feather>['name']; text: string }[] = [
    { icon: 'camera', text: `We store one reference photo of ${your} face and compare it with a live selfie each time ${you} check${desk ? 's' : ''} in at the gym by ${desk ? 'themselves' : 'yourself'}.` },
    { icon: 'target', text: 'Purpose: check-in only. The photo is never used for marketing, shown to other members or shared with anyone else.' },
    { icon: 'lock', text: `Stored privately; only gym staff can view it. ${providerText(provider)}` },
    { icon: 'clock', text: retentionText(keepDays) },
    { icon: 'trash-2', text: `${desk ? 'They' : 'You'} can withdraw at any time in Profile → Face check-in. The photo is deleted on withdrawal or when the account is deleted.` },
    { icon: 'users', text: `Prefer not to? ${desk ? 'They' : 'You'} can always check in at the front desk instead.` },
  ];
  return (
    <View style={{ gap: SP.md }}>
      {items.map(i => (
        <View key={i.icon} style={{ flexDirection: 'row', gap: SP.md }}>
          <Feather name={i.icon} size={16} color={T.brand} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, color: T.textSub, fontSize: 14, lineHeight: 20 }}>{i.text}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Face check-in enrolment: an explicit consent step, then a live front-camera selfie. The server
 * checks there's exactly one clear face, stores the photo privately and records the consent
 * ("biometric_face"; at the desk with who recorded it).
 */
export default function FaceEnrollFlow({ visible, onClose, onEnrolled, mode = 'self', memberId, memberName, keepCheckInSelfiesDays, reason, faceProvider }: Props) {
  const insets = useSafeAreaInsets();
  const desk = mode === 'desk';
  const [step, setStep] = useState<'consent' | 'camera' | 'done'>('consent');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const self = useEnrollMyFace();
  const staff = useEnrollMemberFace(memberId ?? 0);
  const busy = self.isPending || staff.isPending;
  // The gym's selfie retention for the consent text (the member's own status carries it).
  const mine = useMyFace(visible && !desk && keepCheckInSelfiesDays == null);
  const keepDays = keepCheckInSelfiesDays ?? mine.data?.keepCheckInSelfiesDays ?? 30;
  const provider = faceProvider ?? mine.data?.faceProvider;

  const close = () => {
    setStep('consent');
    setAgreed(false);
    setError(null);
    onClose();
  };

  const capture = async (selfie: CapturedSelfie) => {
    setError(null);
    try {
      if (desk) await staff.mutateAsync({ selfie, consentConfirmed: agreed });
      else await self.mutateAsync({ selfie, consent: agreed });
      setStep('done');
    } catch (e) {
      const face = faceErrorFrom(e);
      if (face?.next === 'consent') { setStep('consent'); setAgreed(false); }
      setError(face?.message ?? describeApiError(e).message);
    }
  };

  const title = desk ? `Face check-in for ${memberName ?? 'member'}` : 'Set up face check-in';

  return (
    <Modal visible={visible} animationType={Platform.OS === 'web' ? 'fade' : 'slide'} presentationStyle="fullScreen" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.xl, paddingVertical: SP.md, gap: SP.md }}>
          <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, color: T.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bgInput }}>
            <Feather name="x" size={20} color={T.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: insets.bottom + 32, gap: SP.lg }} keyboardShouldPersistTaps="handled">
          {step === 'consent' && (
            <>
              {reason && <Text style={{ color: T.brandGold, fontSize: 13, lineHeight: 18 }}>{reason}</Text>}
              {desk && (
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>Read this to the member and ask whether they agree:</Text>
              )}
              <View style={{ padding: SP.lg, borderRadius: R.lg, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }}>
                <FaceConsentText keepDays={keepDays} desk={desk} provider={provider} />
              </View>
              {error && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 13 }}>{error}</Text>}
              <Pressable
                onPress={() => setAgreed(a => !a)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                accessibilityLabel={desk ? 'The member agreed to face check-in' : 'I agree to the use of my face photo for check-in'}
                style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 48 }}
              >
                <View style={{
                  width: 24, height: 24, borderRadius: R.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
                  borderColor: agreed ? T.brand : T.textFaint, backgroundColor: agreed ? T.brand : 'transparent',
                }}>
                  {agreed && <Feather name="check" size={16} color={T.onBrand} />}
                </View>
                <Text style={{ flex: 1, color: T.text, fontSize: 14, lineHeight: 20 }}>
                  {desk ? 'The member agreed to face check-in.' : 'I agree to the use of my face photo for check-in, as described above.'}
                </Text>
              </Pressable>
              <PrimaryButton label="Continue to camera" icon="camera" disabled={!agreed} onPress={() => { setError(null); setStep('camera'); }} />
              <PrimaryButton label={desk ? 'Cancel' : 'Not now'} variant="secondary" onPress={close} />
            </>
          )}

          {step === 'camera' && (
            <FaceCamera
              onCapture={capture}
              onCancel={close}
              busy={busy}
              busyLabel="Saving your photo…"
              error={error}
              hint={desk
                ? 'Ask the member to look straight at the camera, without sunglasses or a mask, in good light.'
                : 'Look straight at the camera, in good light, without sunglasses or a mask. Only your face should be in the oval.'}
              captureLabel="Take reference photo"
            />
          )}

          {step === 'done' && (
            <View style={{ alignItems: 'center', gap: SP.md, paddingVertical: SP.xl }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(T.brand, 0.15) }}>
                <Feather name="check" size={30} color={T.brand} />
              </View>
              <Text accessibilityRole="header" style={{ color: T.text, fontSize: 18, fontWeight: '800' }}>Face check-in is set up</Text>
              <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
                {desk ? `${memberName ?? 'The member'} can now check in with a selfie.` : 'Next time you check in, take a quick selfie after your location is confirmed.'}
              </Text>
              <PrimaryButton label={onEnrolled && !desk ? 'Continue check-in' : 'Done'} icon="check" style={{ alignSelf: 'stretch' }}
                onPress={() => { const cb = onEnrolled; close(); cb?.(); }} />
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
