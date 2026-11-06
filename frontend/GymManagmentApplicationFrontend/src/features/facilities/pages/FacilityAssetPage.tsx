import React, { useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { T, R, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../common/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import SmallButton from '../../common/components/SmallButton';
import PrimaryButton from '../../common/components/PrimaryButton';
import DetailRow from '../../common/components/DetailRow';
import { DateField } from '../../common/components/DatePicker';
import { Field } from '../../common/components/FormFields';
import { confirm, notify } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useAddMaintenance, useArchiveAsset, useAsset, useDeleteMaintenance } from '../api/facilitiesQueries';
import type { AssetDetail } from '../types/facilities.types';
import { ASSET_STATUS_LABEL, ago, backLabel, dayLabel, todayIso } from '../utils/facilitiesFormat';
import { AssetStatusChip, Card, ListRow, ReportStatusChip, SectionTitle, UrgentChip } from '../components/FacilitiesUi';
import AssetStatusPanel from '../components/AssetStatusPanel';
import { AssetFormPage } from '../components/AssetForms';

interface Props {
  assetId: number;
  onBack?: () => void;
  onOpenReport?: (id: number) => void;
}

/** Admin: one asset — status (with key-facility notice), details, service history, reports. */
export default function FacilityAssetPage({ assetId, onBack, onOpenReport }: Props) {
  const q = useAsset(assetId);
  const [editing, setEditing] = useState(false);
  const archive = useArchiveAsset();
  const a = q.data;

  if (editing && a) return <AssetFormPage asset={a} onDone={() => setEditing(false)} />;

  const doArchive = async () => {
    if (!a || !(await confirm({ title: `Archive ${a.name}?`, message: 'It leaves the register and the report picker. Its history is kept.', confirmLabel: 'Archive', destructive: true }))) return;
    try { await archive.mutateAsync(a.id); onBack?.(); } catch (e) { notify("Couldn't archive", apiErrorText(e)); }
  };

  return (
    <Screen>
      <ScreenHeader eyebrow={a?.zone ?? 'Equipment'} title={a?.name ?? 'Asset'} onBack={onBack}
        action={a && !a.isArchived ? { label: 'Edit', icon: 'edit-2', onPress: () => setEditing(true) } : undefined} />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: SP.xl }} accessibilityLabel="Loading"><Skeleton rows={4} height={96} /></View>
      ) : q.isError || !a ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load this asset" subtitle={apiErrorText(q.error)}
          action={{ label: 'Try again', onPress: () => q.refetch() }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 110, gap: SP.xl }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={T.brand} />}>
          <Card>
            <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'center' }}>
              {a.photoUrl && <Image source={{ uri: a.photoUrl }} accessibilityLabel={`Photo of ${a.name}`} style={{ width: 64, height: 64, borderRadius: R.md }} />}
              <View style={{ flex: 1, gap: 6 }}>
                <AssetStatusChip status={a.status} />
                <Text style={{ color: T.textSub, fontSize: 13 }}>
                  {ASSET_STATUS_LABEL[a.status]} since {dayLabel(a.statusSince)}
                  {a.status !== 'InService' ? ` · ${backLabel(a.expectedBackOn)}` : ''}
                </Text>
                {a.statusReason && <Text style={{ color: T.text, fontSize: 14 }}>{a.statusReason}</Text>}
                {a.serviceStatusId && <Text style={{ color: T.sky, fontSize: 12 }}>Members see a service-status notice.</Text>}
              </View>
            </View>
          </Card>

          {!a.isArchived && (
            <View>
              <SectionTitle title="Status" />
              <AssetStatusPanel key={`${a.status}-${a.statusSince}`} asset={a} />
            </View>
          )}

          <View>
            <SectionTitle title="Details" />
            <Card style={{ gap: SP.sm }}>
              <DetailRow icon="map-pin" label="Branch · zone" value={`${a.branchName ?? '—'} · ${a.zone ?? 'No zone'}`} />
              {a.assetType && <DetailRow icon="tag" label="Type" value={a.assetType + (a.equipmentName ? ` (${a.equipmentName})` : '')} />}
              <DetailRow icon="maximize" label="Asset / QR code" value={a.assetCode} />
              {a.serialNumber && <DetailRow icon="hash" label="Serial" value={a.serialNumber} />}
              <DetailRow icon="star" label="Key facility" value={a.isKeyFacility ? 'Yes — outages can post a notice' : 'No'} />
              {a.notes && <DetailRow icon="file-text" label="Notes" value={a.notes} />}
            </Card>
          </View>

          <Reports a={a} onOpenReport={onOpenReport} />
          <Maintenance a={a} />

          {!a.isArchived && <PrimaryButton label="Archive asset" variant="secondary" icon="archive" onPress={doArchive} loading={archive.isPending} />}
        </ScrollView>
      )}
    </Screen>
  );
}

function Reports({ a, onOpenReport }: { a: AssetDetail; onOpenReport?: (id: number) => void }) {
  if (a.reports.length === 0) return null;
  return (
    <View>
      <SectionTitle title="Problem reports" />
      <View style={{ gap: SP.sm }}>
        {a.reports.map(r => (
          <ListRow key={r.id} title={r.problemLabel} subtitle={`${r.reporterName} · ${ago(r.createdAt)}${r.plusOneCount ? ` · +${r.plusOneCount}` : ''}`}
            onPress={onOpenReport ? () => onOpenReport(r.id) : undefined}
            right={<View style={{ gap: 4, alignItems: 'flex-end' }}>{r.isUrgent && <UrgentChip />}<ReportStatusChip status={r.status} /></View>} />
        ))}
      </View>
    </View>
  );
}

function Maintenance({ a }: { a: AssetDetail }) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [work, setWork] = useState('');
  const [by, setBy] = useState('');
  const [cost, setCost] = useState('');
  const [next, setNext] = useState('');
  const add = useAddMaintenance(a.id);
  const del = useDeleteMaintenance(a.id);

  const submit = async () => {
    try {
      await add.mutateAsync({ performedOn: date, work: work.trim(), performedBy: by.trim() || null, cost: cost ? Number(cost) : null, nextServiceDue: next || null });
      setAdding(false); setWork(''); setBy(''); setCost(''); setNext('');
    } catch (e) { notify("Couldn't save the entry", apiErrorText(e)); }
  };
  const remove = async (id: number) => {
    if (await confirm({ title: 'Remove this entry?', confirmLabel: 'Remove', destructive: true })) del.mutate(id);
  };

  return (
    <View>
      <SectionTitle title="Service history"
        right={!adding ? <SmallButton icon="plus" label="Add" onPress={() => setAdding(true)} size="sm" /> : undefined} />
      <Text style={{ color: a.serviceOverdue ? T.err : T.textSub, fontSize: 13, marginBottom: SP.md }}>
        Last serviced {dayLabel(a.lastServicedOn)} · next due {dayLabel(a.nextServiceDue)}{a.serviceOverdue ? ' (overdue)' : ''}
      </Text>
      {adding && (
        <Card style={{ marginBottom: SP.md }}>
          <DateField label="Date" value={date} onChange={setDate} />
          <Field label="What was done" value={work} onChangeText={setWork} multiline placeholder="e.g. Belt replaced, motor checked" />
          <Field label="By whom" value={by} onChangeText={setBy} placeholder="Technician or company" />
          <Field label="Cost (optional)" value={cost} onChangeText={t => setCost(t.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
          <DateField label="Next service due (optional)" value={next} onChange={setNext} />
          <View style={{ flexDirection: 'row', gap: SP.sm }}>
            <View style={{ flex: 1 }}><PrimaryButton label="Cancel" variant="secondary" onPress={() => setAdding(false)} /></View>
            <View style={{ flex: 1 }}><PrimaryButton label="Save" onPress={submit} loading={add.isPending} disabled={!work.trim() || add.isPending} /></View>
          </View>
        </Card>
      )}
      {a.maintenance.length === 0 && !adding ? (
        <Text style={{ color: T.textFaint, fontSize: 14 }}>No service visits logged yet.</Text>
      ) : (
        <View style={{ gap: SP.sm }}>
          {a.maintenance.map(m => (
            <Card key={m.id} style={{ padding: SP.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.sm }}>
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{dayLabel(m.performedOn)}</Text>
                <SmallButton icon="trash-2" label="Remove" tone={T.err} size="sm" onPress={() => remove(m.id)} />
              </View>
              <Text style={{ color: T.textSub, fontSize: 14, marginTop: 4 }}>{m.work}</Text>
              <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 4 }}>
                {[m.performedBy, m.cost != null ? `Cost ${m.cost}` : null, m.nextServiceDue ? `Next due ${dayLabel(m.nextServiceDue)}` : null].filter(Boolean).join(' · ') || '—'}
              </Text>
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}
