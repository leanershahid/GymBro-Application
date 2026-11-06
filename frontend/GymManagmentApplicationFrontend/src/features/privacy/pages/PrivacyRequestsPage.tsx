import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import PrimaryButton from '../../common/components/PrimaryButton';
import SmallButton from '../../common/components/SmallButton';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import ChipSelect from '../../common/components/ChipSelect';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { confirm, showAlert } from '../../common/components/dialogs';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import {
  useCancelDeletion, usePrivacyRequests, usePrivacySettings, useProcessDeletionNow, useSavePrivacySettings,
} from '../api/privacyQueries';
import { AdminDeletionRow, AdminExportRow, DeletionStatus, PrivacySettings } from '../api/privacy.types';
import { Card, Notice, fmtDate, fmtDateTime } from '../components/PrivacyUi';

type Tab = 'deletions' | 'exports' | 'settings';
const STATUS_TONE: Record<string, PillTone> = {
  pending: 'warn', blocked: 'err', completed: 'neutral', cancelled: 'info',
  preparing: 'info', queued: 'info', ready: 'ok', expired: 'neutral', failed: 'err',
};
const FILTERS: { value: DeletionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' },
];
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Admin → More → "Privacy requests": account deletions, data exports and the gym's privacy settings. */
export default function PrivacyRequestsPage({ onBack, onOpenMember }: { onBack?: () => void; onOpenMember?: (id: number) => void }) {
  const [tab, setTab] = useState<Tab>('deletions');
  const [filter, setFilter] = useState<DeletionStatus | 'all'>('all');
  const q = usePrivacyRequests(filter === 'all' ? undefined : filter);

  return (
    <Screen>
      <ScreenHeader eyebrow="Compliance" title="Privacy requests" onBack={onBack} />
      <SegmentedTabs
        tabs={[{ key: 'deletions', label: 'Deletions' }, { key: 'exports', label: 'Data exports' }, { key: 'settings', label: 'Settings' }]}
        value={tab} onChange={setTab} style={{ marginHorizontal: SP.xl, marginBottom: SP.lg }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl, maxWidth: 860, width: '100%', alignSelf: 'center' }}
          refreshControl={tab === 'settings' ? undefined : <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={T.brand} />}
        >
          {tab === 'settings' ? <SettingsForm /> : q.isLoading ? <LoadingState label="Loading requests" /> : q.isError || !q.data ? (
            <EmptyState icon="alert-triangle" tone="error" title="Couldn't load privacy requests"
              subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />
          ) : tab === 'deletions' ? (
            <>
              <ChipSelect label="Show" options={FILTERS} value={filter} onChange={setFilter} />
              {q.data.deletions.length === 0
                ? <EmptyState icon="shield" title="No deletion requests" subtitle="When a member asks to delete their account, it shows here." />
                : q.data.deletions.map(d => <DeletionCard key={d.id} row={d} onOpenMember={onOpenMember} />)}
            </>
          ) : (
            q.data.exports.length === 0
              ? <EmptyState icon="download" title="No data exports yet" subtitle="Members request these from Privacy & data in their app." />
              : q.data.exports.map(e => <ExportCard key={e.id} row={e} />)
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function DeletionCard({ row, onOpenMember }: { row: AdminDeletionRow; onOpenMember?: (id: number) => void }) {
  const processNow = useProcessDeletionNow();
  const cancel = useCancelDeletion();
  const open = row.status === 'pending' || row.status === 'blocked';
  const anonymised = row.status === 'completed';

  const doProcess = async () => {
    const ok = await confirm({
      title: 'Delete this account now?',
      message: `${row.memberName}'s personal data will be removed straight away instead of on ${fmtDate(row.scheduledFor)}. Invoices, payments and orders are kept without the name. This can't be undone.`,
      confirmLabel: 'Delete now', destructive: true,
    });
    if (ok) processNow.mutate(row.id, { onError: e => showAlert('Couldn’t delete', apiErrorText(e)) });
  };
  const doCancel = async () => {
    const ok = await confirm({ title: 'Cancel this deletion?', message: 'The account stays as it is. The member can ask again later.', confirmLabel: 'Cancel deletion' });
    if (ok) cancel.mutate(row.id, { onError: e => showAlert('Couldn’t cancel', apiErrorText(e)) });
  };

  return (
    <Card title={row.memberName} right={<StatusPill label={label(row.status)} tone={STATUS_TONE[row.status]} />}>
      <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>
        {row.source === 'staff' ? 'Requested by staff' : 'Requested by the member'} on {fmtDateTime(row.requestedAt)}
        {row.status === 'pending' ? ` · deletes on ${fmtDate(row.scheduledFor)}` : ''}
        {row.completedAt ? ` · deleted ${fmtDate(row.completedAt)}` : ''}
        {row.cancelledAt ? ` · cancelled ${fmtDate(row.cancelledAt)}` : ''}
      </Text>
      {!!row.reason && <Text style={{ color: T.textFaint, fontSize: 12, marginTop: SP.xs }}>Reason: {row.reason}</Text>}
      {!!row.blockedReason && <View style={{ marginTop: SP.sm }}><Notice tone="warn" title="Blocked">{row.blockedReason}</Notice></View>}
      {anonymised && row.tables && (
        <Text style={{ color: T.textFaint, fontSize: 12, marginTop: SP.xs }}>
          Cleared: {Object.keys(row.tables).join(', ')}
        </Text>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {open && <SmallButton icon="trash-2" label="Process now" tone={T.err} busy={processNow.isPending} onPress={doProcess} />}
        {open && <SmallButton icon="x" label="Cancel" tone={T.textSub} busy={cancel.isPending} onPress={doCancel} />}
        {!anonymised && onOpenMember && <SmallButton icon="user" label="Open member" tone={T.textSub} onPress={() => onOpenMember(row.userId)} />}
      </View>
    </Card>
  );
}

function ExportCard({ row }: { row: AdminExportRow }) {
  return (
    <Card title={row.memberName} right={<StatusPill label={label(row.status === 'queued' ? 'preparing' : row.status)} tone={STATUS_TONE[row.status]} />}>
      <Text style={{ color: T.textSub, fontSize: 13 }}>
        Requested {fmtDateTime(row.requestedAt)}{row.readyAt ? ` · ready ${fmtDateTime(row.readyAt)}` : ''}
        {row.expiresAt && row.status === 'ready' ? ` · link works until ${fmtDate(row.expiresAt)}` : ''}
      </Text>
      {!!row.error && <Text style={{ color: T.err, fontSize: 12, marginTop: SP.xs }}>{row.error}</Text>}
    </Card>
  );
}

const GRACE = [7, 14, 21, 30].map(v => ({ value: v, label: `${v} days` }));

function SettingsForm() {
  const q = usePrivacySettings();
  const save = useSavePrivacySettings();
  const [form, setForm] = useState<PrivacySettings | null>(null);
  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  if (q.isLoading || !form) {
    return q.isError
      ? <EmptyState icon="alert-triangle" tone="error" title="Couldn't load settings" subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />
      : <LoadingState label="Loading settings" />;
  }
  const set = (patch: Partial<PrivacySettings>) => setForm(f => (f ? { ...f, ...patch } : f));

  return (
    <View>
      <Card title="Account deletion">
        <ChipSelect label="Grace period (members can keep their account until then)" options={GRACE}
          value={form.graceDays} onChange={v => set({ graceDays: v })} />
        <ChipSelect label="Members' social posts and comments" value={form.socialContentOnDeletion}
          options={[{ value: 'anonymise', label: 'Keep, shown as “Deleted member”' }, { value: 'delete', label: 'Delete them' }]}
          onChange={v => set({ socialContentOnDeletion: v })} />
        <SwitchRow label="Cancel memberships when an account is deleted"
          description="Off: the contract carries on and staff handle it. On: active memberships are cancelled. Refunds are never automatic."
          value={form.cancelMembershipOnDeletion} onValueChange={v => set({ cancelMembershipOnDeletion: v })} />
      </Card>
      <Card title="Policy links" subtitle="Members see these in Privacy & data. Write and host the texts yourself (ideally reviewed by a lawyer).">
        <Field label="Privacy policy (https://…)" value={form.privacyPolicyUrl ?? ''} onChangeText={v => set({ privacyPolicyUrl: v })}
          keyboardType="url" autoCapitalize="none" autoCorrect={false} />
        <Field label="Terms & conditions (https://…)" value={form.termsUrl ?? ''} onChangeText={v => set({ termsUrl: v })}
          keyboardType="url" autoCapitalize="none" autoCorrect={false} />
      </Card>
      <PrimaryButton label="Save settings" icon="check" loading={save.isPending}
        onPress={() => save.mutate(form, {
          onSuccess: () => showAlert('Saved', 'Privacy settings updated.'),
          onError: e => showAlert('Couldn’t save', apiErrorText(e)),
        })} />
    </View>
  );
}

