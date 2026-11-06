import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../common/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import PrimaryButton from '../../common/components/PrimaryButton';
import SmallButton from '../../common/components/SmallButton';
import StatusPill from '../../common/components/StatusPill';
import DetailRow from '../../common/components/DetailRow';
import { confirm, notify, showAlert } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { fetchSignedUrl } from '../api/facilitiesApi';
import { useAddAddendum, useCloseIncident, useIncident, useIncidentAudit } from '../api/facilitiesQueries';
import type { IncidentDetail } from '../types/facilities.types';
import { dateTimeLabel } from '../utils/facilitiesFormat';
import { Card, SectionTitle, SeverityChip } from '../components/FacilitiesUi';

interface Props {
  incidentId: number;
  onBack?: () => void;
  onEdit: (id: number) => void;
}

const inputStyle = { minHeight: 80, borderRadius: R.lg, padding: SP.lg, color: T.text, fontSize: 15, textAlignVertical: 'top' as const, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line };

/** Opens an attachment through a signed link (private documents). */
async function openAttachment(url: string) {
  try {
    await Linking.openURL(await fetchSignedUrl(url));
  } catch { showAlert("Couldn't open the attachment"); }
}

/** One incident: the record, people, addenda (append-only), close, and who viewed / changed it. */
export default function IncidentPage({ incidentId, onBack, onEdit }: Props) {
  const q = useIncident(incidentId);
  const i = q.data;
  return (
    <Screen>
      <ScreenHeader eyebrow={i?.reference ?? 'Incident'} title={i ? `${i.typeLabel} · ${i.location}` : 'Incident'} onBack={onBack}
        action={i?.canEdit ? { label: 'Edit', icon: 'edit-2', onPress: () => onEdit(i.id) } : undefined} />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: SP.xl }} accessibilityLabel="Loading incident"><Skeleton rows={4} height={96} /></View>
      ) : q.isError || !i ? (
        <EmptyState icon="lock" tone="error" title="Couldn't load this incident" subtitle={apiErrorText(q.error)}
          action={{ label: 'Try again', onPress: () => q.refetch() }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 130, gap: SP.xl }}
            refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={T.brand} />}>
            <Record i={i} />
            <Addenda i={i} />
            {i.canEdit && <CloseCard i={i} />}
            <AuditTrail id={i.id} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

function Record({ i }: { i: IncidentDetail }) {
  return (
    <>
      <Card style={{ gap: SP.sm }}>
        <View style={{ flexDirection: 'row', gap: SP.sm, flexWrap: 'wrap' }}>
          <SeverityChip severity={i.severity} />
          <StatusPill label={i.status === 'Open' ? 'Open' : 'Closed · sealed'} tone={i.status === 'Open' ? 'warn' : 'neutral'} />
          {i.ambulanceCalled && <StatusPill label="Ambulance called" tone="err" />}
        </View>
        <DetailRow icon="clock" label="When" value={dateTimeLabel(i.occurredAt)} />
        <DetailRow icon="map-pin" label="Where" value={`${i.branchName ?? ''} · ${i.location}`} />
        {i.assetName && <DetailRow icon="tool" label="Equipment" value={i.assetName} />}
        <DetailRow icon="user" label="Logged by" value={`${i.reportedByName} · ${dateTimeLabel(i.createdAt)}`} />
      </Card>
      <View>
        <SectionTitle title="What happened" />
        <Card><Text style={{ color: T.text, fontSize: 14, lineHeight: 21 }}>{i.description}</Text></Card>
      </View>
      {i.people.length > 0 && (
        <View>
          <SectionTitle title="People involved" />
          <Card style={{ gap: SP.sm }}>
            {i.people.map(p => (
              <View key={p.id ?? p.name} style={{ flexDirection: 'row', gap: SP.sm, alignItems: 'center' }}>
                <Feather name={p.kind === 'visitor' ? 'user' : p.kind === 'staff' ? 'briefcase' : 'user-check'} size={16} color={T.textSub} />
                <Text style={{ color: T.text, fontSize: 14, flex: 1 }}>{p.name}{p.contact ? ` · ${p.contact}` : ''}</Text>
                <Text style={{ color: p.isInjuredParty ? T.err : T.textFaint, fontSize: 12 }}>{p.isInjuredParty ? 'Injured / affected' : p.kind}</Text>
              </View>
            ))}
          </Card>
        </View>
      )}
      <Card style={{ gap: SP.sm }}>
        <DetailRow icon="plus-square" label="First aid" value={i.firstAidGiven ? `Yes${i.firstAidBy ? ` — ${i.firstAidBy}` : ''}` : 'No'} />
        {i.witnesses && <DetailRow icon="eye" label="Witnesses" value={i.witnesses} />}
        {i.followUpActions && <DetailRow icon="check-square" label="Follow-up" value={i.followUpActions} />}
        {i.closedAt && <DetailRow icon="lock" label="Closed" value={`${dateTimeLabel(i.closedAt)} by ${i.closedByName ?? 'staff'}${i.closureNote ? ` — ${i.closureNote}` : ''}`} />}
      </Card>
      {i.attachmentUrls.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
          {i.attachmentUrls.map((u, n) => <SmallButton key={u} icon="paperclip" label={`Attachment ${n + 1}`} tone={T.textSub} onPress={() => openAttachment(u)} />)}
        </View>
      )}
    </>
  );
}

function Addenda({ i }: { i: IncidentDetail }) {
  const [text, setText] = useState('');
  const add = useAddAddendum(i.id);
  const send = async () => {
    if (!(await confirm({ title: 'Add this addendum?', message: "Addenda are permanent — they can't be edited or removed.", confirmLabel: 'Add' }))) return;
    try { await add.mutateAsync(text.trim()); setText(''); } catch (e) { notify("Couldn't add the addendum", apiErrorText(e)); }
  };
  return (
    <View>
      <SectionTitle title="Addenda" />
      {i.addenda.length === 0 && <Text style={{ color: T.textFaint, fontSize: 14, marginBottom: SP.md }}>
        {i.canEdit ? 'Add later information here once the incident is closed, or edit it while open.' : 'Anything learned after closing goes here.'}
      </Text>}
      <View style={{ gap: SP.sm, marginBottom: SP.md }} accessibilityRole="list">
        {i.addenda.map(a => (
          <Card key={a.id} style={{ padding: SP.md }}>
            <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700' }}>{a.authorName} · {dateTimeLabel(a.createdAt)}</Text>
            <Text style={{ color: T.text, fontSize: 14, marginTop: 4 }}>{a.body}</Text>
          </Card>
        ))}
      </View>
      <TextInput value={text} onChangeText={setText} multiline maxLength={5000} placeholder="Add an addendum" placeholderTextColor={T.textFaint}
        accessibilityLabel="Addendum" style={inputStyle} />
      <View style={{ alignSelf: 'flex-end', marginTop: SP.sm }}>
        <SmallButton icon="plus" label="Add addendum" onPress={send} disabled={!text.trim()} busy={add.isPending} />
      </View>
    </View>
  );
}

function CloseCard({ i }: { i: IncidentDetail }) {
  const [note, setNote] = useState('');
  const close = useCloseIncident(i.id);
  const run = async () => {
    if (!(await confirm({ title: `Close ${i.reference}?`, message: 'A closed incident is sealed: it can never be edited again, only added to with addenda.', confirmLabel: 'Close incident', destructive: true }))) return;
    try { await close.mutateAsync(note.trim() || undefined); } catch (e) { notify("Couldn't close it", apiErrorText(e)); }
  };
  return (
    <View>
      <SectionTitle title="Close" />
      <TextInput value={note} onChangeText={setNote} multiline maxLength={2000} placeholder="Closing note (outcome, actions taken)"
        placeholderTextColor={T.textFaint} accessibilityLabel="Closing note" style={inputStyle} />
      <PrimaryButton label="Close and seal" icon="lock" variant="danger" onPress={run} loading={close.isPending} style={{ marginTop: SP.md }} />
    </View>
  );
}

function AuditTrail({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const q = useIncidentAudit(id, open);
  return (
    <View>
      <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, minHeight: 44 }}>
        <Feather name={open ? 'chevron-down' : 'chevron-right'} size={18} color={T.textSub} />
        <Text style={{ color: T.textSub, fontSize: 14, fontWeight: '700' }}>Access history</Text>
      </Pressable>
      {open && (q.isLoading ? <Skeleton rows={2} height={40} /> : (
        <View style={{ gap: 6 }}>
          {(q.data ?? []).map((a, n) => (
            <Text key={n} style={{ color: T.textFaint, fontSize: 12 }}>
              {dateTimeLabel(a.at)} · {a.userName ?? 'Staff'} · {a.action.replace('_', ' ')}{a.fields.length ? ` (${a.fields.join(', ')})` : ''}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
