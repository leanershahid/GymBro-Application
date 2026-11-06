import React, { useState } from 'react';
import { ScrollView, View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { T, SP, R, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import ChipSelect from '../../common/components/ChipSelect';
import SmallButton from '../../common/components/SmallButton';
import { DateField } from '../../common/components/DatePicker';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { confirm, notify } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import {
  useBranchDirectory, useCreateStatus, useDeleteStatus, useEndStatus, useStatusesAdmin, useUpdateStatus,
} from '../api/operationsQueries';
import type { ServiceStatus, ServiceStatusPayload, StatusLevel, StatusSeverity } from '../types/operations.types';
import { isoToLocalParts, localDateTimeToIso, statusColor, untilLabel } from '../utils/hours';
import { SectionTitle, TimeField } from '../components/OperationsUi';

interface Props { onBack?: () => void }

const LEVELS: { value: StatusLevel; label: string }[] = [{ value: 'Limited', label: 'Limited' }, { value: 'Closed', label: 'Closed' }, { value: 'Normal', label: 'Back to normal' }];
const SEVERITIES: { value: StatusSeverity; label: string }[] = [{ value: 'Info', label: 'Info' }, { value: 'Warning', label: 'Warning' }, { value: 'Critical', label: 'Critical' }];
const AREAS = ['Pool', 'Sauna', 'Cardio floor', 'Weights', 'Studio', 'Showers', 'Parking'];

/** Admin: post "Pool closed until Friday"-style notices; they show on member Home and branch info until they end. */
export default function ServiceStatusAdminPage({ onBack }: Props) {
  const [showEnded, setShowEnded] = useState(false);
  const [editing, setEditing] = useState<ServiceStatus | 'new' | null>(null);
  const list = useStatusesAdmin(showEnded);

  if (editing) return <StatusForm status={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;

  return (
    <Screen>
      <ScreenHeader eyebrow="Operations" title="Service status" onBack={onBack} action={{ label: 'Post', icon: 'plus', onPress: () => setEditing('new') }} />
      {list.isLoading ? <LoadingState label="Loading notices" /> : list.isError ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load notices" subtitle={apiErrorText(list.error)} action={{ label: 'Try again', onPress: () => list.refetch() }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 110, gap: SP.md }}>
          <SwitchRow label="Show ended (last 30 days)" value={showEnded} onValueChange={setShowEnded} />
          {(list.data ?? []).length === 0 ? (
            <EmptyState icon="check-circle" title="Everything's running normally" subtitle="Post a notice when an area is closed or limited." action={{ label: 'Post a notice', onPress: () => setEditing('new') }} />
          ) : (list.data ?? []).map(s => <StatusRow key={s.id} s={s} onEdit={() => setEditing(s)} />)}
        </ScrollView>
      )}
    </Screen>
  );
}

function StatusRow({ s, onEdit }: { s: ServiceStatus; onEdit: () => void }) {
  const end = useEndStatus();
  const c = statusColor(s);
  const now = Date.now();
  const upcoming = new Date(s.startsAt).getTime() > now;
  const ended = !!s.endsAt && new Date(s.endsAt).getTime() <= now;
  return (
    <View style={{ padding: SP.lg, borderRadius: R.lg, backgroundColor: T.bgInput, borderWidth: 1, borderColor: s.isActive ? withAlpha(c, 0.35) : T.line, gap: SP.sm, opacity: ended ? 0.6 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
        <Text style={{ color: c, fontSize: 13, fontWeight: '800', flex: 1 }} numberOfLines={1}>
          {s.headline}{s.branchName && s.area ? ` · ${s.branchName}` : ''}{!s.branchId ? ' · all branches' : ''}
        </Text>
        <Text style={{ color: T.textFaint, fontSize: 12 }}>{ended ? 'Ended' : upcoming ? 'Upcoming' : 'Live'}</Text>
      </View>
      <Text style={{ color: T.text, fontSize: 14, lineHeight: 19 }}>{s.message}</Text>
      <Text style={{ color: T.textSub, fontSize: 12 }}>
        {upcoming ? `Starts ${new Date(s.startsAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}. ` : ''}
        {untilLabel(s.endsAt) ?? 'Until you end it'}
      </Text>
      {!ended && (
        <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.xs }}>
          <SmallButton icon="edit-2" label="Edit" tone={T.text} onPress={onEdit} />
          <SmallButton icon="check" label="End now" tone={T.ok} busy={end.isPending}
            onPress={async () => { if (await confirm({ title: 'End this notice?', message: 'Members stop seeing it right away.', confirmLabel: 'End' })) end.mutate(s.id); }} />
        </View>
      )}
    </View>
  );
}

function StatusForm({ status, onDone }: { status: ServiceStatus | null; onDone: () => void }) {
  const branches = useBranchDirectory(); // open to any signed-in user, unlike the branches module
  const create = useCreateStatus();
  const update = useUpdateStatus();
  const del = useDeleteStatus();
  const [branchId, setBranchId] = useState<number | 0>(status?.branchId ?? 0);
  const [area, setArea] = useState(status?.area ?? '');
  const [level, setLevel] = useState<StatusLevel>(status?.status ?? 'Limited');
  const [severity, setSeverity] = useState<StatusSeverity>(status?.severity ?? 'Warning');
  const [message, setMessage] = useState(status?.message ?? '');
  const [later, setLater] = useState(!!status && new Date(status.startsAt).getTime() > Date.now());
  const [startD, startT] = isoToLocalParts(status?.startsAt);
  const [startDate, setStartDate] = useState(startD);
  const [startTime, setStartTime] = useState(startT || '06:00');
  const [hasEnd, setHasEnd] = useState(!!status?.endsAt);
  const [endD, endT] = isoToLocalParts(status?.endsAt);
  const [endDate, setEndDate] = useState(endD);
  const [endTime, setEndTime] = useState(endT || '18:00');
  const [error, setError] = useState<string | null>(null);

  const branchOptions = [{ value: 0, label: 'All branches' }, ...(branches.data ?? []).map(b => ({ value: b.id, label: b.name }))];

  const submit = () => {
    setError(null);
    if (!message.trim()) { setError('Write a short message for members.'); return; }
    const startsAt = later ? localDateTimeToIso(startDate, startTime) : (status ? status.startsAt : null);
    if (later && !startsAt) { setError('Pick when it starts.'); return; }
    const endsAt = hasEnd ? localDateTimeToIso(endDate, endTime) : null;
    if (hasEnd && !endsAt) { setError('Pick when it ends.'); return; }
    const payload: ServiceStatusPayload = { branchId: branchId || null, area: area.trim() || null, status: level, severity, message: message.trim(), startsAt, endsAt };
    const opts = { onSuccess: () => { notify(status ? 'Notice updated' : 'Notice posted'); onDone(); }, onError: (e: unknown) => setError(apiErrorText(e)) };
    if (status) update.mutate({ id: status.id, payload }, opts); else create.mutate(payload, opts);
  };

  return (
    <Screen>
      <ScreenHeader eyebrow="Service status" title={status ? 'Edit notice' : 'New notice'} onBack={onDone} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 60, gap: SP.xl }}>
          <View>
            <SectionTitle title="Where" />
            <ChipSelect label="Branch" options={branchOptions} value={branchId} onChange={setBranchId} />
            <ChipSelect label="Area (optional)" options={AREAS.map(a => ({ value: a, label: a }))} value={AREAS.includes(area) ? area : null} onChange={setArea} />
            <Field label="Or type an area" value={area} onChangeText={setArea} placeholder="Whole branch" />
          </View>
          <View>
            <SectionTitle title="What" />
            <ChipSelect label="Status" options={LEVELS} value={level} onChange={setLevel} />
            <ChipSelect label="Severity" options={SEVERITIES} value={severity} onChange={setSeverity} />
            <Field label="Message" value={message} onChangeText={setMessage} multiline placeholder="Closed for maintenance. Showers on level 1 are open." />
          </View>
          <View>
            <SectionTitle title="When" />
            <SwitchRow label="Starts later" description="Otherwise it shows right away." value={later} onValueChange={setLater} />
            {later && (
              <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}><DateField label="Starts on" value={startDate} onChange={setStartDate} minYear={new Date().getFullYear()} /></View>
                <View style={{ marginBottom: 16 }}><TimeField label="Starts at" value={startTime} onChange={setStartTime} /></View>
              </View>
            )}
            <SwitchRow label="Ends automatically" description="It disappears by itself at this time." value={hasEnd} onValueChange={setHasEnd} />
            {hasEnd && (
              <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}><DateField label="Ends on" value={endDate} onChange={setEndDate} minYear={new Date().getFullYear()} /></View>
                <View style={{ marginBottom: 16 }}><TimeField label="Ends at" value={endTime} onChange={setEndTime} /></View>
              </View>
            )}
          </View>
          {error && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 14 }}>{error}</Text>}
          <PrimaryButton label={status ? 'Save' : 'Post notice'} icon="check" loading={create.isPending || update.isPending} onPress={submit} />
          {status && (
            <PrimaryButton label="Delete" variant="danger" icon="trash-2" loading={del.isPending}
              onPress={async () => { if (await confirm({ title: 'Delete this notice?', confirmLabel: 'Delete', destructive: true })) del.mutate(status.id, { onSuccess: onDone }); }} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
