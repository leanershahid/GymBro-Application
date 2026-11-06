import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { T, R, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import SmallButton from '../../common/components/SmallButton';
import ChipSelect from '../../common/components/ChipSelect';
import SearchBar from '../../common/components/SearchBar';
import LoadingState from '../../common/components/LoadingState';
import { DateField } from '../../common/components/DatePicker';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { notify, showAlert } from '../../common/components/dialogs';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import { uploadPicked } from '../api/facilitiesApi';
import { useFacilityBranches, useIncident, usePeopleSearch, useSaveIncident } from '../api/facilitiesQueries';
import type { IncidentDetail, IncidentPayload, IncidentSeverity, IncidentType, PersonKind } from '../types/facilities.types';
import { todayIso } from '../utils/facilitiesFormat';
import { Card, SectionTitle } from '../components/FacilitiesUi';

interface Props {
  /** Edit an open incident; omitted = new. */
  incidentId?: number;
  onBack?: () => void;
  onSaved: (id: number) => void;
}

const TYPES: { value: IncidentType; label: string }[] = [
  { value: 'injury', label: 'Injury' }, { value: 'medical', label: 'Medical' }, { value: 'near_miss', label: 'Near miss' },
  { value: 'property_damage', label: 'Property damage' }, { value: 'security', label: 'Security' }, { value: 'other', label: 'Other' },
];
const SEVERITIES: IncidentSeverity[] = ['Low', 'Medium', 'High', 'Critical'];

type Person = IncidentPayload['people'][number] & { key: string; display: string };

const pad = (n: number) => String(n).padStart(2, '0');
const localParts = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};
const toIso = (date: string, time: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (/^\d{1,2}:\d{2}$/.test(time) ? time : '00:00').split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh, mm).toISOString();
};

/** Staff: log a new incident, or edit an open one. */
export default function IncidentFormPage({ incidentId, onBack, onSaved }: Props) {
  const existing = useIncident(incidentId ?? 0);
  if (incidentId && existing.isLoading) return <LoadingState fullScreen label="Loading incident" />;
  return <Form key={existing.data?.id ?? 0} initial={existing.data} onBack={onBack} onSaved={onSaved} />;
}

function Form({ initial, onBack, onSaved }: { initial?: IncidentDetail; onBack?: () => void; onSaved: (id: number) => void }) {
  const branches = useFacilityBranches();
  const start = localParts(initial?.occurredAt);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [branchId, setBranchId] = useState(initial?.branchId ?? 0);
  const [location, setLocation] = useState(initial?.location ?? '');
  const [type, setType] = useState<IncidentType | null>(initial?.type ?? null);
  const [severity, setSeverity] = useState<IncidentSeverity>(initial?.severity ?? 'Low');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [firstAid, setFirstAid] = useState(initial?.firstAidGiven ?? false);
  const [firstAidBy, setFirstAidBy] = useState(initial?.firstAidBy ?? '');
  const [ambulance, setAmbulance] = useState(initial?.ambulanceCalled ?? false);
  const [witnesses, setWitnesses] = useState(initial?.witnesses ?? '');
  const [followUp, setFollowUp] = useState(initial?.followUpActions ?? '');
  const [attachments, setAttachments] = useState<string[]>(initial?.attachmentUrls ?? []);
  const [people, setPeople] = useState<Person[]>((initial?.people ?? []).map((p, i) => ({
    key: `p${i}`, kind: p.kind, userId: p.userId, name: p.kind === 'visitor' ? p.name : null, contact: p.contact,
    isInjuredParty: p.isInjuredParty, notes: p.notes, display: p.name,
  })));
  const [uploading, setUploading] = useState(false);
  const save = useSaveIncident(initial?.id);
  const branch = branchId || branches.data?.find(b => b.isMine)?.id || branches.data?.[0]?.id || 0;

  const addAttachment = async () => {
    try {
      if (Platform.OS !== 'web' && (await ImagePicker.requestMediaLibraryPermissionsAsync()).status !== 'granted') return;
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      const a = res.canceled ? null : res.assets[0];
      if (!a?.uri) return;
      setUploading(true);
      // Stored as a private document where the gym has private storage on.
      const url = await uploadPicked({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName }, 'document');
      setAttachments(x => [...x, url]);
    } catch (e) { showAlert("Couldn't attach the file", describeApiError(e).message); } finally { setUploading(false); }
  };

  const submit = async () => {
    if (!type) return;
    try {
      const saved = await save.mutateAsync({
        occurredAt: toIso(date, time), branchId: branch, location: location.trim(), type, severity, description: description.trim(),
        firstAidGiven: firstAid, firstAidBy: firstAid ? firstAidBy.trim() || null : null, ambulanceCalled: ambulance,
        witnesses: witnesses.trim() || null, followUpActions: followUp.trim() || null, attachmentUrls: attachments,
        people: people.map(({ key: _k, display: _d, ...p }) => p),
      });
      onSaved(saved.id);
    } catch (e) { notify("Couldn't save the incident", apiErrorText(e)); }
  };

  const ready = !!type && !!location.trim() && !!description.trim() && !!branch && /^\d{1,2}:\d{2}$/.test(time);

  return (
    <Screen>
      <ScreenHeader eyebrow="Incident log" title={initial ? `Edit ${initial.reference}` : 'Log an incident'} onBack={onBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 130 }}>
          <View style={{ flexDirection: 'row', gap: SP.md }}>
            <View style={{ flex: 3 }}><DateField label="Date" value={date} onChange={setDate} maxYear={Number(todayIso().slice(0, 4))} /></View>
            <View style={{ flex: 2 }}><Field label="Time (24h)" value={time} onChangeText={setTime} placeholder="14:30" keyboardType="numbers-and-punctuation" /></View>
          </View>
          {(branches.data ?? []).length > 1 && (
            <ChipSelect label="Branch" value={branch} onChange={setBranchId} options={(branches.data ?? []).map(b => ({ value: b.id, label: b.name }))} />
          )}
          <Field label="Where exactly" value={location} onChangeText={setLocation} placeholder="e.g. Free weights, by rack 2" />
          <ChipSelect label="Type" value={type} onChange={setType} options={TYPES} />
          <ChipSelect label="Severity" value={severity} onChange={setSeverity} options={SEVERITIES.map(s => ({ value: s, label: s }))} />
          <Field label="What happened" value={description} onChangeText={setDescription} multiline placeholder="Facts only: what, who, how" />

          <People people={people} onChange={setPeople} />

          <SwitchRow label="First aid given" value={firstAid} onValueChange={setFirstAid} />
          {firstAid && <Field label="First aid by" value={firstAidBy} onChangeText={setFirstAidBy} placeholder="Name of the first aider" />}
          <SwitchRow label="Ambulance called" value={ambulance} onValueChange={setAmbulance} />
          <Field label="Witnesses (names and contacts)" value={witnesses} onChangeText={setWitnesses} multiline />
          <Field label="Follow-up actions" value={followUp} onChangeText={setFollowUp} multiline placeholder="e.g. Rack inspected, member called next day" />

          <SectionTitle title="Attachments" right={<SmallButton icon="paperclip" label="Attach" size="sm" onPress={addAttachment} busy={uploading} />} />
          {attachments.length === 0 ? <Text style={{ color: T.textFaint, fontSize: 13, marginBottom: SP.lg }}>Photos of the scene, forms…</Text> : (
            <View style={{ gap: SP.sm, marginBottom: SP.lg }}>
              {attachments.map((u, i) => (
                <View key={u} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                  <Feather name="file" size={16} color={T.textSub} />
                  <Text style={{ color: T.textSub, fontSize: 13, flex: 1 }} numberOfLines={1}>Attachment {i + 1}</Text>
                  <SmallButton icon="x" label="Remove" size="sm" tone={T.err} onPress={() => setAttachments(x => x.filter(y => y !== u))} />
                </View>
              ))}
            </View>
          )}

          <PrimaryButton label={initial ? 'Save changes' : 'Log incident'} onPress={submit} loading={save.isPending} disabled={!ready || save.isPending} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function People({ people, onChange }: { people: Person[]; onChange: (p: Person[]) => void }) {
  const [term, setTerm] = useState('');
  const [visitor, setVisitor] = useState('');
  const search = usePeopleSearch(term);
  const add = (p: Omit<Person, 'key'>) => { onChange([...people, { ...p, key: `n${Date.now()}` }]); setTerm(''); setVisitor(''); };
  const patch = (key: string, x: Partial<Person>) => onChange(people.map(p => (p.key === key ? { ...p, ...x } : p)));

  return (
    <View style={{ marginBottom: SP.lg }}>
      <SectionTitle title="People involved" />
      {people.map(p => (
        <Card key={p.key} style={{ marginBottom: SP.sm, padding: SP.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
            <Feather name={p.kind === 'visitor' ? 'user' : p.kind === 'staff' ? 'briefcase' : 'user-check'} size={16} color={T.textSub} />
            <Text style={{ color: T.text, fontSize: 15, fontWeight: '700', flex: 1 }}>{p.display}</Text>
            <Text style={{ color: T.textFaint, fontSize: 12 }}>{p.kind}</Text>
            <SmallButton icon="x" label="Remove" size="sm" tone={T.err} onPress={() => onChange(people.filter(x => x.key !== p.key))} />
          </View>
          <Pressable onPress={() => patch(p.key, { isInjuredParty: !p.isInjuredParty })} accessibilityRole="checkbox"
            accessibilityState={{ checked: p.isInjuredParty }} accessibilityLabel={`${p.display} is the injured or affected person`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, minHeight: 40, marginTop: SP.xs }}>
            <Feather name={p.isInjuredParty ? 'check-square' : 'square'} size={18} color={p.isInjuredParty ? T.brand : T.textSub} />
            <Text style={{ color: T.textSub, fontSize: 13 }}>Injured / affected person</Text>
          </Pressable>
        </Card>
      ))}
      <SearchBar value={term} onChangeText={setTerm} placeholder="Link a member or staff (name, email, phone)" label="Search people" />
      {(search.data ?? []).filter(s => !people.some(p => p.userId === s.id)).slice(0, 6).map(s => (
        <Pressable key={s.id} onPress={() => add({ kind: s.kind as PersonKind, userId: s.id, name: null, contact: null, isInjuredParty: people.length === 0, notes: null, display: s.name })}
          accessibilityRole="button" accessibilityLabel={`Add ${s.name}, ${s.kind}`}
          style={({ pressed }) => ({ padding: SP.md, minHeight: 48, borderRadius: R.md, backgroundColor: pressed ? T.bgInputActive : T.bgInput, marginTop: SP.xs })}>
          <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{s.name} <Text style={{ color: T.textFaint, fontWeight: '400' }}>· {s.kind}{s.email ? ` · ${s.email}` : ''}</Text></Text>
        </Pressable>
      ))}
      <View style={{ flexDirection: 'row', gap: SP.sm, alignItems: 'flex-end', marginTop: SP.md }}>
        <View style={{ flex: 1 }}><Field label="Or a visitor's name" value={visitor} onChangeText={setVisitor} placeholder="Full name" /></View>
        <View style={{ marginBottom: 16 }}>
          <SmallButton icon="plus" label="Add" disabled={!visitor.trim()}
            onPress={() => add({ kind: 'visitor', userId: null, name: visitor.trim(), contact: null, isInjuredParty: people.length === 0, notes: null, display: visitor.trim() })} />
        </View>
      </View>
    </View>
  );
}
