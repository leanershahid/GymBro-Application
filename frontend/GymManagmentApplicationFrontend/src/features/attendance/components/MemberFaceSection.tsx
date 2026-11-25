import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { T, SP, R } from '../../../theme';
import LoadingState from '../../common/components/LoadingState';
import StatusPill from '../../common/components/StatusPill';
import { SmallButton } from '../../common/components/SmallButton';
import { confirm, showAlert } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useDeleteMemberFace, useMemberFace, useResetMemberFace } from '../api/faceQueries';
import { attemptBadge } from '../utils/faceCheck';
import FaceEnrollFlow from './FaceEnrollFlow';
import FacePhotosSheet from './FacePhotosSheet';

const fmt = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Member detail → "Face check-in": enrolment status and reference photo, Enroll (desk camera +
 * spoken consent) / Reset / Delete (audit-logged), and the member's recent face checks. Hidden
 * when the gym doesn't use face check-in and the member has nothing on file.
 */
export default function MemberFaceSection({ memberId, memberName }: { memberId: number; memberName: string }) {
  const q = useMemberFace(memberId);
  const reset = useResetMemberFace(memberId);
  const remove = useDeleteMemberFace(memberId);
  const [enrolling, setEnrolling] = useState(false);
  const [photosOf, setPhotosOf] = useState<number | null>(null);

  if (q.isLoading) return <LoadingState label="Loading face check-in" />;
  const d = q.data;
  if (!d || (!d.faceCheckEnabled && !d.status)) return null;

  const onReset = async () => {
    const ok = await confirm({
      title: 'Reset face check-in?',
      message: `${memberName}'s reference photo is deleted. They'll be asked for a new one at their next self check-in.`,
      confirmLabel: 'Reset', destructive: true,
    });
    if (ok) reset.mutate(undefined, { onError: e => showAlert('Could not reset', apiErrorText(e)) });
  };
  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete face enrolment?',
      message: `${memberName}'s reference photo and enrolment are deleted. This can't be undone.`,
      confirmLabel: 'Delete', destructive: true,
    });
    if (ok) remove.mutate(undefined, { onError: e => showAlert('Could not delete', apiErrorText(e)) });
  };

  const pill = d.enrolled ? { label: 'Enrolled', tone: 'ok' as const }
    : d.status === 'reset_required' ? { label: 'New photo needed', tone: 'warn' as const } : { label: 'Not enrolled', tone: 'neutral' as const };

  return (
    <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, paddingHorizontal: SP.lg, paddingBottom: SP.md, marginBottom: SP.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: SP.md, paddingBottom: SP.sm }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: T.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Face check-in
        </Text>
        <StatusPill label={pill.label} tone={pill.tone} dot />
      </View>

      <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'center', paddingVertical: SP.sm }}>
        {d.photoUrl ? (
          <Image source={{ uri: d.photoUrl }} contentFit="cover" accessibilityLabel={`${memberName}'s reference photo`}
            style={{ width: 56, height: 72, borderRadius: R.md, backgroundColor: T.bg }} />
        ) : (
          <View style={{ width: 56, height: 72, borderRadius: R.md, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="user" size={22} color={T.textFaint} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: T.text, fontSize: 14 }}>
            {d.enrolledAt && d.status ? `Enrolled ${fmt(d.enrolledAt)}` : 'No reference photo'}
          </Text>
          {d.status && (
            <Text style={{ color: T.textSub, fontSize: 12 }}>
              {d.source === 'desk' ? `At the desk${d.enrolledByName ? ` by ${d.enrolledByName}` : ''}` : 'By the member in the app'}
            </Text>
          )}
          <Text style={{ color: d.consentGranted ? T.textSub : T.brandGold, fontSize: 12 }}>
            {d.consentGranted ? 'Consent given' : 'No consent on file'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, paddingVertical: SP.sm }}>
        {d.faceCheckEnabled && (
          <SmallButton icon="camera" label={d.enrolled ? 'Re-enrol' : 'Enroll'} onPress={() => setEnrolling(true)} />
        )}
        {d.enrolled && <SmallButton icon="rotate-ccw" label="Reset" tone={T.brandGold} onPress={onReset} busy={reset.isPending} />}
        {d.status && <SmallButton icon="trash-2" label="Delete" tone={T.err} onPress={onDelete} busy={remove.isPending} />}
      </View>

      {d.recentAttempts.length > 0 && (
        <View style={{ borderTopWidth: 1, borderTopColor: T.line, paddingTop: SP.sm }}>
          <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }}>Recent face checks</Text>
          {d.recentAttempts.slice(0, 5).map(a => {
            const b = attemptBadge(a);
            return (
              <Pressable key={a.id} disabled={!a.hasSelfie} onPress={() => setPhotosOf(a.id)}
                accessibilityRole={a.hasSelfie ? 'button' : undefined}
                accessibilityLabel={`${b.label}, ${fmt(a.at)}${a.hasSelfie ? '. Show selfie and reference photo' : ''}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, minHeight: 40 }}>
                <Text style={{ flex: 1, color: T.textSub, fontSize: 13 }}>{fmt(a.at)}{a.branchName ? ` · ${a.branchName}` : ''}</Text>
                <StatusPill label={b.label} tone={b.tone} />
                {a.hasSelfie && <Feather name="image" size={16} color={T.textFaint} />}
              </Pressable>
            );
          })}
        </View>
      )}

      <FaceEnrollFlow visible={enrolling} onClose={() => setEnrolling(false)} mode="desk" memberId={memberId} memberName={memberName}
        keepCheckInSelfiesDays={d.keepCheckInSelfiesDays} faceProvider={d.faceProvider} />
      <FacePhotosSheet attemptId={photosOf} memberName={memberName} onClose={() => setPhotosOf(null)} />
    </View>
  );
}
