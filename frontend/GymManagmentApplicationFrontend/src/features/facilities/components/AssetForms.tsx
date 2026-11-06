import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import ChipSelect from '../../common/components/ChipSelect';
import UploadField from '../../common/components/UploadField';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import { DateField } from '../../common/components/DatePicker';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { notify } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useBulkAssets, useFacilityBranches, useSaveAsset, useZones } from '../api/facilitiesQueries';
import type { Asset } from '../types/facilities.types';

const ZONE_IDEAS = ['Cardio', 'Free weights', 'Machines', 'Functional', 'Studio', 'Wellness', 'Changing rooms'];

/** Add / edit one asset, or (new only) add several at once. */
export function AssetFormPage({ asset, defaultBranchId, onDone }: { asset?: Asset; defaultBranchId?: number; onDone: (saved?: Asset) => void }) {
  const [mode, setMode] = useState<'one' | 'bulk'>('one');
  return (
    <Screen>
      <ScreenHeader eyebrow="Equipment" title={asset ? 'Edit asset' : 'Add equipment'} onBack={() => onDone()} />
      {!asset && (
        <SegmentedTabs tabs={[{ key: 'one', label: 'One' }, { key: 'bulk', label: 'Several' }]} value={mode} onChange={setMode}
          style={{ marginHorizontal: SP.xl, marginBottom: SP.lg }} />
      )}
      {mode === 'one' || asset
        ? <OneForm asset={asset} defaultBranchId={defaultBranchId} onDone={onDone} />
        : <BulkForm defaultBranchId={defaultBranchId} onDone={() => onDone()} />}
    </Screen>
  );
}

function useBranchZone(initialBranch?: number, initialZone?: string | null) {
  const branches = useFacilityBranches();
  const [branchId, setBranchId] = useState(initialBranch ?? 0);
  const effectiveBranch = branchId || branches.data?.find(b => b.isMine)?.id || branches.data?.[0]?.id || 0;
  const zones = useZones(effectiveBranch || undefined);
  const [zone, setZone] = useState(initialZone ?? '');
  const zoneOptions = Array.from(new Set([...(zones.data ?? []), ...ZONE_IDEAS])).map(z => ({ value: z, label: z }));
  return { branches: branches.data ?? [], branchId: effectiveBranch, setBranchId, zone, setZone, zoneOptions };
}

function BranchZoneFields(s: ReturnType<typeof useBranchZone>) {
  return (
    <>
      {s.branches.length > 1 && (
        <ChipSelect label="Branch" options={s.branches.map(b => ({ value: b.id, label: b.name }))} value={s.branchId} onChange={s.setBranchId} />
      )}
      <ChipSelect label="Zone" options={s.zoneOptions} value={s.zone || null} onChange={s.setZone} />
      <Field label="Or type a zone" value={s.zone} onChangeText={s.setZone} placeholder="e.g. Cardio" />
    </>
  );
}

function OneForm({ asset, defaultBranchId, onDone }: { asset?: Asset; defaultBranchId?: number; onDone: (saved?: Asset) => void }) {
  const bz = useBranchZone(asset?.branchId ?? defaultBranchId, asset?.zone);
  const [name, setName] = useState(asset?.name ?? '');
  const [type, setType] = useState(asset?.assetType ?? '');
  const [serial, setSerial] = useState(asset?.serialNumber ?? '');
  const [code, setCode] = useState(asset?.assetCode ?? '');
  const [photo, setPhoto] = useState(asset?.photoUrl ?? '');
  const [key, setKey] = useState(asset?.isKeyFacility ?? false);
  const [due, setDue] = useState(asset?.nextServiceDue ?? '');
  const [notes, setNotes] = useState(asset?.notes ?? '');
  const save = useSaveAsset(asset?.id);

  const submit = async () => {
    try {
      const saved = await save.mutateAsync({
        branchId: bz.branchId, name: name.trim(), assetType: type.trim() || null, zone: bz.zone.trim() || null, photoUrl: photo || null,
        serialNumber: serial.trim() || null, assetCode: code.trim() || null, isKeyFacility: key, nextServiceDue: due || null, notes: notes.trim() || null,
      });
      onDone(saved);
    } catch (e) { notify("Couldn't save", apiErrorText(e)); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 130 }}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Treadmill 3" />
        <Field label="Type" value={type} onChangeText={setType} placeholder="e.g. Treadmill, Squat rack, Pool" />
        <BranchZoneFields {...bz} />
        <UploadField label="Photo (optional)" value={photo} onChange={setPhoto} folder="media" />
        <Field label="Serial number (optional)" value={serial} onChangeText={setSerial} autoCapitalize="characters" />
        <Field label="Asset / QR code (blank = generated)" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="GB-XXXXXX" />
        <DateField label="Next service due (optional)" value={due} onChange={setDue} />
        <SwitchRow label="Key facility" value={key} onValueChange={setKey}
          description="Pool, sauna, studio… When it goes out of service we offer to post a service-status notice for members." />
        <Field label="Notes (staff only)" value={notes} onChangeText={setNotes} multiline />
        <PrimaryButton label={asset ? 'Save' : 'Add asset'} onPress={submit} loading={save.isPending} disabled={!name.trim() || !bz.branchId || save.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BulkForm({ defaultBranchId, onDone }: { defaultBranchId?: number; onDone: () => void }) {
  const bz = useBranchZone(defaultBranchId);
  const [base, setBase] = useState('');
  const [count, setCount] = useState('4');
  const [start, setStart] = useState('1');
  const [names, setNames] = useState('');
  const [type, setType] = useState('');
  const bulk = useBulkAssets();
  const list = names.split('\n').map(n => n.trim()).filter(Boolean);
  const n = Math.max(0, Math.min(100, parseInt(count, 10) || 0));
  const preview = list.length > 0 ? list : base.trim() && n > 0 ? [`${base.trim()} ${parseInt(start, 10) || 1}`, '…', `${base.trim()} ${(parseInt(start, 10) || 1) + n - 1}`] : [];

  const submit = async () => {
    try {
      const added = await bulk.mutateAsync({
        branchId: bz.branchId, zone: bz.zone.trim() || null, assetType: type.trim() || base.trim() || null, isKeyFacility: false,
        ...(list.length > 0 ? { names: list } : { baseName: base.trim(), count: n, startAt: parseInt(start, 10) || 1 }),
      });
      await notify(`${added.length} added`, 'Each one has its own QR code in the register.');
      onDone();
    } catch (e) { notify("Couldn't add them", apiErrorText(e)); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 130 }}>
        <BranchZoneFields {...bz} />
        <Field label="Base name" value={base} onChangeText={setBase} placeholder="e.g. Treadmill" />
        <View style={{ flexDirection: 'row', gap: SP.md }}>
          <View style={{ flex: 1 }}><Field label="How many" value={count} onChangeText={setCount} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Start numbering at" value={start} onChangeText={setStart} keyboardType="number-pad" /></View>
        </View>
        <Field label="…or paste names, one per line" value={names} onChangeText={setNames} multiline placeholder={'Bike A\nBike B'} />
        <Field label="Type (optional)" value={type} onChangeText={setType} placeholder="Defaults to the base name" />
        {preview.length > 0 && (
          <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.lg }}>Adds: {preview.join(', ')}</Text>
        )}
        <PrimaryButton label="Add all" onPress={submit} loading={bulk.isPending}
          disabled={!bz.branchId || bulk.isPending || (list.length === 0 && (!base.trim() || n === 0))} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
