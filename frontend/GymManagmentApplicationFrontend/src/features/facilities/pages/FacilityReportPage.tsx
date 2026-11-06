import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { T, R, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../common/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import PrimaryButton from '../../common/components/PrimaryButton';
import SmallButton from '../../common/components/SmallButton';
import ChipSelect from '../../common/components/ChipSelect';
import { SwitchRow } from '../../common/components/FormFields';
import { notify } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useApiAccess } from '../../access/context/AccessContext';
import { useAssets, useAssignees, useReportOutOfService, useStaffComment, useStaffReport, useUpdateReport } from '../api/facilitiesQueries';
import type { ReportStatus, StaffReportDetail } from '../types/facilities.types';
import { ASSET_STATUS_LABEL, REPORT_STATUS_LABEL, dateTimeLabel, isOpenReport } from '../utils/facilitiesFormat';
import { Card, PhotoStrip, ReportStatusChip, SectionTitle, UrgentChip } from '../components/FacilitiesUi';
import { askServiceNotice } from '../components/AssetStatusPanel';

interface Props {
  reportId: number;
  onBack?: () => void;
  onOpenAsset?: (id: number) => void;
}

const inputStyle = { minHeight: 72, borderRadius: R.lg, padding: SP.lg, color: T.text, fontSize: 15, textAlignVertical: 'top' as const, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line };

/** Admin triage: assign, set status, link an asset, mark it out of service in one tap, reply, close with a note. */
export default function FacilityReportPage({ reportId, onBack, onOpenAsset: openAsset }: Props) {
  const onOpenAsset = useApiAccess('facilities').canView ? openAsset : undefined;
  const q = useStaffReport(reportId);
  const r = q.data;
  return (
    <Screen>
      <ScreenHeader eyebrow="Problem report" title={r?.subject ?? 'Report'} onBack={onBack} />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: SP.xl }} accessibilityLabel="Loading"><Skeleton rows={4} height={96} /></View>
      ) : q.isError || !r ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load this report" subtitle={apiErrorText(q.error)}
          action={{ label: 'Try again', onPress: () => q.refetch() }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 130, gap: SP.xl }}
            refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={T.brand} />}>
            <Summary r={r} onOpenAsset={onOpenAsset} />
            <Triage r={r} />
            <Comments r={r} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

function Summary({ r, onOpenAsset }: { r: StaffReportDetail; onOpenAsset?: (id: number) => void }) {
  const oos = useReportOutOfService(r.id);
  const markOos = async () => {
    const postServiceNotice = r.assetIsKeyFacility ? await askServiceNotice(r.subject) : false;
    try {
      const res = await oos.mutateAsync({ status: 'OutOfService', postServiceNotice });
      notify(`${r.subject} is out of service`, res.asset.serviceStatusPostedId ? 'Members can see the service notice.' : undefined);
    } catch (e) { notify("Couldn't update the asset", apiErrorText(e)); }
  };
  return (
    <Card tint={r.isUrgent && isOpenReport(r.status) ? T.err : undefined} style={{ gap: SP.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, alignItems: 'center' }}>
        {r.isUrgent && <UrgentChip />}
        <ReportStatusChip status={r.status} />
        <Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }}>{r.problemLabel}</Text>
      </View>
      <Text style={{ color: T.textSub, fontSize: 13 }}>
        {r.reporterName}{r.reporterRole ? ` (${r.reporterRole})` : ''} · {dateTimeLabel(r.createdAt)} · {r.branchName ?? ''}{r.zone ? ` · ${r.zone}` : ''}
        {r.plusOneCount ? ` · ${r.plusOneCount} others noticed` : ''}
      </Text>
      {r.description && <Text style={{ color: T.text, fontSize: 14 }}>{r.description}</Text>}
      <PhotoStrip urls={r.photoUrls} />
      {r.assetId && (
        <Text style={{ color: T.textSub, fontSize: 13 }}>Asset: {r.subject} · {r.assetStatus ? ASSET_STATUS_LABEL[r.assetStatus] : '—'}</Text>
      )}
      {r.suggestOutOfService && (
        <Text style={{ color: T.err, fontSize: 13, fontWeight: '600' }}>Reported unsafe and still in service — consider marking it out of service.</Text>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.xs }}>
        {r.assetId && r.assetStatus === 'InService' && isOpenReport(r.status) && (
          <SmallButton icon="slash" label="Mark out of service" tone={T.err} onPress={markOos} busy={oos.isPending} />
        )}
        {r.assetId && onOpenAsset && <SmallButton icon="tool" label="Open asset" tone={T.textSub} onPress={() => onOpenAsset(r.assetId!)} />}
      </View>
    </Card>
  );
}

function Triage({ r }: { r: StaffReportDetail }) {
  const update = useUpdateReport(r.id);
  const assignees = useAssignees();
  const assets = useAssets({ branchId: r.branchId });
  const canLink = useApiAccess('facilities').canView;
  const [note, setNote] = useState(r.resolutionNote ?? '');

  const run = async (p: Parameters<typeof update.mutateAsync>[0], done?: string) => {
    try { await update.mutateAsync(p); if (done) notify(done); } catch (e) { notify("Couldn't update the report", apiErrorText(e)); }
  };
  const close = (status: ReportStatus) => {
    if (status === 'CantReproduce' && !note.trim()) { notify('Add a note', "Tell the reporter what you checked."); return; }
    run({ status, resolutionNote: note.trim() || null }, status === 'Fixed' ? 'Closed as fixed. The reporter and +1s were told.' : 'Closed. The reporter was told.');
  };

  return (
    <View>
      <SectionTitle title="Triage" />
      <ChipSelect label="Status" value={r.status} onChange={s => run({ status: s, resolutionNote: note.trim() || null })}
        options={(['Received', 'InProgress', 'Fixed', 'CantReproduce'] as ReportStatus[]).map(s => ({ value: s, label: REPORT_STATUS_LABEL[s] }))} />
      <ChipSelect label="Assigned to" value={r.assignedToUserId ?? 0} onChange={id => run({ assignedToUserId: id })}
        options={[{ value: 0, label: 'Nobody' }, ...(assignees.data ?? []).map(s => ({ value: s.id, label: s.name }))]} />
      {canLink && (
        <ChipSelect label="Linked asset" value={r.assetId ?? 0} onChange={id => run({ assetId: id })}
          options={[{ value: 0, label: 'None' }, ...(assets.data ?? []).map(a => ({ value: a.id, label: a.name }))]} />
      )}
      <SwitchRow label="Urgent" value={r.isUrgent} onValueChange={v => run({ isUrgent: v })} description="Top of the queue." />
      {isOpenReport(r.status) && (
        <>
          <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.sm }}>Resolution note (sent to the reporter)</Text>
          <TextInput value={note} onChangeText={setNote} multiline maxLength={1000} placeholder="e.g. New belt fitted, back in use"
            placeholderTextColor={T.textFaint} accessibilityLabel="Resolution note" style={inputStyle} />
          <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.md }}>
            <View style={{ flex: 1 }}><PrimaryButton label="Fixed" icon="check" onPress={() => close('Fixed')} disabled={update.isPending} /></View>
            <View style={{ flex: 1 }}><PrimaryButton label="Can't reproduce" variant="secondary" onPress={() => close('CantReproduce')} disabled={update.isPending} /></View>
          </View>
        </>
      )}
      {!isOpenReport(r.status) && r.resolutionNote && <Text style={{ color: T.textSub, fontSize: 14 }}>Note: {r.resolutionNote}</Text>}
    </View>
  );
}

function Comments({ r }: { r: StaffReportDetail }) {
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const comment = useStaffComment(r.id);
  const send = async () => {
    try { await comment.mutateAsync({ body: text.trim(), internal }); setText(''); } catch (e) { notify("Couldn't add the comment", apiErrorText(e)); }
  };
  return (
    <View>
      <SectionTitle title="Comments" />
      <View style={{ gap: SP.sm, marginBottom: SP.md }} accessibilityRole="list">
        {r.comments.length === 0 && <Text style={{ color: T.textFaint, fontSize: 14 }}>No comments yet.</Text>}
        {r.comments.map(c => (
          <View key={c.id} accessibilityLabel={`${c.isInternal ? 'Internal note. ' : ''}${c.authorName}: ${c.body}`}
            style={{ padding: SP.md, borderRadius: R.lg, backgroundColor: c.isInternal ? T.bgInputActive : c.isStaff ? T.brandDim : T.bgInput, borderWidth: 1, borderColor: c.isStaff ? T.brandBorder : T.line }}>
            <Text style={{ color: c.isStaff ? T.brand : T.textSub, fontSize: 12, fontWeight: '700' }}>
              {c.authorName}{c.isInternal ? ' · internal' : ''} · {dateTimeLabel(c.createdAt)}
            </Text>
            <Text style={{ color: T.text, fontSize: 14, marginTop: 4 }}>{c.body}</Text>
          </View>
        ))}
      </View>
      <TextInput value={text} onChangeText={setText} multiline maxLength={1000} placeholder={internal ? 'Note for staff only' : 'Reply to the reporter'}
        placeholderTextColor={T.textFaint} accessibilityLabel="Comment" style={inputStyle} />
      <View style={{ marginTop: SP.md }}>
        <SwitchRow label="Internal note (members never see it)" value={internal} onValueChange={setInternal} />
      </View>
      <View style={{ alignSelf: 'flex-end' }}>
        <SmallButton icon="send" label={internal ? 'Add note' : 'Send reply'} onPress={send} disabled={!text.trim()} busy={comment.isPending} />
      </View>
    </View>
  );
}
