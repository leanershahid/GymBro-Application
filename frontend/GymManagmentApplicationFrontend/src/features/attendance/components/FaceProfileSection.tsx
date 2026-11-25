import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { T, SP, R } from '../../../theme';
import StatusPill from '../../common/components/StatusPill';
import PrimaryButton from '../../common/components/PrimaryButton';
import { confirm, showAlert } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useMyFace, useRemoveMyFace } from '../api/faceQueries';
import { retentionText } from '../utils/faceCheck';
import FaceEnrollFlow from './FaceEnrollFlow';

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Profile → "Face check-in": status, (re-)enrol and "Remove my face data". Hidden while the gym
 * doesn't use face check-in and the member has no photo on file.
 */
export default function FaceProfileSection() {
  const q = useMyFace();
  const remove = useRemoveMyFace();
  const [enrolling, setEnrolling] = useState(false);

  const d = q.data;
  if (!d || (!d.required && !d.status && !d.consentGranted)) return null;

  const onRemove = async () => {
    const ok = await confirm({
      title: 'Remove your face data?',
      message: d.required
        ? 'Your reference photo and any kept check-in selfies are deleted and your consent is withdrawn. You’ll need to check in at the front desk, or set up face check-in again.'
        : 'Your reference photo and any kept check-in selfies are deleted and your consent is withdrawn.',
      confirmLabel: 'Remove', destructive: true,
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => showAlert('Face data removed', 'Your face photos were deleted.'),
      onError: e => showAlert('Could not remove', apiErrorText(e)),
    });
  };

  const status = d.enrolled
    ? { label: 'Set up', tone: 'ok' as const }
    : d.status === 'reset_required' ? { label: 'New photo needed', tone: 'warn' as const } : { label: 'Not set up', tone: 'warn' as const };

  return (
    <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, padding: SP.lg, marginBottom: SP.lg, gap: SP.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
        <Feather name="smile" size={18} color={T.textSub} />
        <Text accessibilityRole="header" style={{ flex: 1, color: T.text, fontSize: 16, fontWeight: '700' }}>Face check-in</Text>
        <StatusPill label={status.label} tone={status.tone} />
      </View>

      <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'center' }}>
        {d.photoUrl ? (
          <Image source={{ uri: d.photoUrl }} accessibilityLabel="Your face check-in photo" contentFit="cover"
            style={{ width: 56, height: 72, borderRadius: R.md, backgroundColor: T.bg }} />
        ) : null}
        <Text style={{ flex: 1, color: T.textSub, fontSize: 13, lineHeight: 19 }}>
          {d.enrolled
            ? `Photo taken ${d.enrolledAt ? fmtDay(d.enrolledAt) : ''}${d.source === 'desk' ? ' at the front desk' : ''}. ${d.required ? 'Self check-in asks for a quick selfie after your location.' : ''}`
            : d.status === 'reset_required'
              ? 'The gym asked for a new photo. Take one now or at your next check-in.'
              : 'Your gym checks a selfie when you check yourself in. Set it up once with a reference photo.'}
        </Text>
      </View>
      <Text style={{ color: T.textFaint, fontSize: 12, lineHeight: 17 }}>{retentionText(d.keepCheckInSelfiesDays)}</Text>

      {d.required && (
        <PrimaryButton label={d.enrolled ? 'Take a new photo' : 'Set up face check-in'} icon="camera"
          variant={d.enrolled ? 'secondary' : 'primary'} onPress={() => setEnrolling(true)} />
      )}
      {(d.status || d.consentGranted) && (
        <PrimaryButton label="Remove my face data" icon="trash-2" variant="danger" onPress={onRemove} loading={remove.isPending}
          accessibilityHint="Deletes your face photos and withdraws your consent" />
      )}

      <FaceEnrollFlow visible={enrolling} onClose={() => setEnrolling(false)} keepCheckInSelfiesDays={d.keepCheckInSelfiesDays} faceProvider={d.faceProvider} />
    </View>
  );
}
