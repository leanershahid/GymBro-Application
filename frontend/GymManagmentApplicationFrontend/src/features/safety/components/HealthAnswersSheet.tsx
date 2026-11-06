import React, { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { T, SP, R } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import StatusPill from '../../common/components/StatusPill';
import PrimaryButton from '../../common/components/PrimaryButton';
import { Field } from '../../common/components/FormFields';
import { showAlert } from '../../common/components/dialogs';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import { useClearMemberHealth, useMemberHealth } from '../api/safetyQueries';
import { fmtDay } from '../utils/safetyGate';

/**
 * Health answers (latest first). Only reachable when the API says the caller may see them
 * (admin with health access or the member's own trainer); a 403 still renders a clear message.
 */
export default function HealthAnswersSheet({ memberId, memberName, visible, canClear, onClose }: {
  memberId: number; memberName: string; visible: boolean; canClear: boolean; onClose: () => void;
}) {
  const q = useMemberHealth(memberId, visible);
  const clear = useClearMemberHealth(memberId);
  const [note, setNote] = useState('');
  const latest = q.data?.[0];

  const recordClearance = () => {
    if (!latest) return;
    clear.mutate({ screeningId: latest.id, note: note.trim() || undefined }, {
      onSuccess: () => { setNote(''); showAlert('Clearance recorded', `${memberName}'s health check is marked as cleared.`); },
      onError: e => showAlert('Could not save', apiErrorText(e)),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <Screen>
        <ScreenHeader eyebrow="Health check · confidential" title={memberName} onBack={onClose} />
        {q.isLoading ? <LoadingState label="Loading health answers" /> : q.isError ? (
          <EmptyState icon="lock" tone="error" title="Can't show health answers" subtitle={describeApiError(q.error).message} />
        ) : !latest ? (
          <EmptyState icon="heart" title="No health check yet" subtitle="The member hasn't filled in the health questionnaire." />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl, maxWidth: 720, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginBottom: SP.lg }}>
              <StatusPill label={`Submitted ${fmtDay(latest.submittedAt)}`} tone="neutral" />
              <StatusPill label={latest.expired ? `Expired ${fmtDay(latest.expiresAt)}` : `Expires ${fmtDay(latest.expiresAt)}`} tone={latest.expired ? 'err' : 'info'} />
              {latest.needsClearance && <StatusPill label={latest.clearedAt ? `Cleared ${fmtDay(latest.clearedAt)}` : 'Needs clearance'} tone={latest.clearedAt ? 'ok' : 'warn'} dot />}
            </View>

            {latest.answers.map((a, i) => (
              <View key={a.key} style={{ flexDirection: 'row', gap: SP.md, paddingVertical: SP.md, borderTopWidth: i ? 1 : 0, borderTopColor: T.line }}>
                <Text style={{ flex: 1, color: T.text, fontSize: 14, lineHeight: 20 }}>{a.question}</Text>
                <StatusPill label={a.answer ? 'Yes' : 'No'} tone={a.answer ? 'warn' : 'ok'} />
              </View>
            ))}

            {[['Medical conditions', latest.conditions], ['Medications', latest.medications], ['Injuries', latest.injuries], ['Pregnancy', latest.pregnancy]]
              .filter(([, v]) => !!v).map(([k, v]) => (
                <View key={k} style={{ marginTop: SP.md, backgroundColor: T.bgInput, borderRadius: R.md, padding: SP.md }}>
                  <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{k}</Text>
                  <Text selectable style={{ color: T.text, fontSize: 14, marginTop: 4 }}>{v}</Text>
                </View>
              ))}

            {latest.clearedAt && !!latest.clearanceNote && (
              <Text style={{ color: T.textSub, fontSize: 13, marginTop: SP.lg }}>Clearance note: {latest.clearanceNote}</Text>
            )}

            {canClear && latest.needsClearance && !latest.clearedAt && (
              <View style={{ marginTop: SP.xl }}>
                <Field label="Clearance note (optional)" value={note} onChangeText={setNote} placeholder="e.g. GP letter received 12 Mar" />
                <PrimaryButton label="Record medical clearance" icon="check-circle" onPress={recordClearance} loading={clear.isPending} />
              </View>
            )}

            {(q.data?.length ?? 0) > 1 && (
              <Text style={{ color: T.textFaint, fontSize: 12, marginTop: SP.xl }}>
                Earlier checks: {q.data!.slice(1).map(h => fmtDay(h.submittedAt)).join(' · ')}
              </Text>
            )}
          </ScrollView>
        )}
      </Screen>
    </Modal>
  );
}
