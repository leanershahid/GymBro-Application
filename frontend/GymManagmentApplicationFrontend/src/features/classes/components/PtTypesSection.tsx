import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, ScrollView, Alert } from 'react-native';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import StatusPill from '../../common/components/StatusPill';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import ChipSelect from '../../exercises/components/ChipSelect';
import { Field, SwitchRow, RowGrid, GridCell } from '../../trainers/components/FormFields';
import { apiErrorText, describeApiError, fieldErrorsFrom } from '../../../api/apiError';
import { usePtTypes, useSavePtType, useTrainerOptions, useMyTrainerProfile } from '../api/classesQueries';
import { PtType, TrainerOption } from '../types/classes.types';
import { FilterRow, fmtMoney, toDecimal, toInt } from './classesUi';
import { T, SP, R } from '../../../theme';

export interface PtTypesSectionProps {
  mode: 'admin' | 'trainer';
}

/** PT session types: trainers manage their own; admins pick a trainer. */
export default function PtTypesSection({ mode }: PtTypesSectionProps) {
  const isAdmin = mode === 'admin';
  const trainers = useTrainerOptions(isAdmin);
  const mine = useMyTrainerProfile(!isAdmin);
  const [trainerId, setTrainerId] = useState<number | null>(null);
  const listTrainer = isAdmin ? trainerId : mine.me?.id ?? null;
  const { data, isLoading, error, refetch, isRefetching } = usePtTypes(listTrainer, isAdmin || !mine.isLoading);
  const [editing, setEditing] = useState<PtType | 'new' | null>(null);

  if (isLoading || (!isAdmin && mine.isLoading)) return <LoadingState label="Loading session types…" />;
  if (error) {
    return (
      <EmptyState icon="alert-triangle" tone="error" title="Couldn't load session types"
        subtitle={describeApiError(error).message} action={{ label: 'Try again', onPress: () => refetch() }} />
    );
  }

  const rows = [...(data ?? [])].sort((a, b) => Number(b.isActive) - Number(a.isActive));

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={t => String(t.id)}
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.brand} />}
        ListHeaderComponent={
          <View style={{ marginBottom: SP.md }}>
            {isAdmin && (trainers.data?.length ?? 0) > 0 && (
              <FilterRow<number> label="Trainer" allLabel="All trainers" value={trainerId} onChange={setTrainerId}
                options={(trainers.data ?? []).map(t => ({ value: t.id, label: t.name }))} />
            )}
            {isAdmin && trainers.error && (
              <Text style={{ color: T.err, fontSize: 12, marginBottom: SP.sm }}>{describeApiError(trainers.error).message}</Text>
            )}
            <PrimaryButton label="New session type" icon="plus" variant="secondary" onPress={() => setEditing('new')} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="tag" title="No session types yet"
            subtitle="Create PT offerings like “1:1 Strength — 60 min” with a price, then book sessions." />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setEditing(item)}
            accessibilityRole="button"
            accessibilityLabel={`Edit session type ${item.name}`}
            style={({ pressed }) => ({
              padding: SP.lg, marginBottom: SP.sm, borderRadius: R.lg, borderWidth: 1, borderColor: T.line,
              backgroundColor: pressed ? T.bgInputActive : T.bgInput, opacity: item.isActive ? 1 : 0.6,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
              <Text style={{ flex: 1, color: T.text, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>{item.name}</Text>
              <Text style={{ color: T.brand, fontSize: 15, fontWeight: '800' }}>{fmtMoney(item.price, item.currency)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginTop: 6 }}>
              <Text style={{ color: T.textFaint, fontSize: 12 }}>{item.durationMin} min{isAdmin && item.trainerName ? ` · ${item.trainerName}` : ''}</Text>
              {!item.isActive && <StatusPill label="Inactive" tone="neutral" />}
            </View>
            {!!item.description && <Text style={{ color: T.textSub, fontSize: 13, marginTop: SP.sm }} numberOfLines={2}>{item.description}</Text>}
          </Pressable>
        )}
      />
      <PtTypeSheet type={editing} onClose={() => setEditing(null)} isAdmin={isAdmin}
        trainers={trainers.data ?? []} defaultTrainerId={trainerId} />
    </View>
  );
}

function PtTypeSheet({ type, onClose, isAdmin, trainers, defaultTrainerId }: {
  type: PtType | 'new' | null; onClose: () => void; isAdmin: boolean; trainers: TrainerOption[]; defaultTrainerId: number | null;
}) {
  const toast = useToast();
  const save = useSavePtType();
  const existing = type && type !== 'new' ? type : null;

  const [trainerId, setTrainerId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('60');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setTrainerId(existing?.trainerId ?? defaultTrainerId);
    setName(existing?.name ?? '');
    setDuration(existing ? String(existing.durationMin) : '60');
    setPrice(existing ? String(existing.price) : '');
    setDescription(existing?.description ?? '');
    setIsActive(existing?.isActive ?? true);
    setErrors({});
  }, [type]);

  const submit = (active: boolean, doneMsg: string) => {
    const errs: Record<string, string> = {};
    if (isAdmin && !existing && !trainerId) errs.trainer = 'Choose the trainer who offers this session.';
    if (!name.trim()) errs.name = 'Give the session type a name.';
    const dur = toInt(duration);
    if (dur == null || dur < 15 || dur > 300) errs.duration = 'Between 15 and 300 minutes.';
    const p = price.trim() ? toDecimal(price) : 0;
    if (p == null || p < 0) errs.price = 'Enter a price (0 for free).';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    save.mutate(
      {
        id: existing?.id,
        payload: {
          trainerId: isAdmin ? (existing?.trainerId ?? trainerId) : undefined,
          name: name.trim(), durationMin: dur!, price: p!, description: description.trim() || null, isActive: active,
        },
      },
      {
        onSuccess: () => { toast.show({ message: doneMsg }); onClose(); },
        onError: e => {
          setErrors(fieldErrorsFrom(describeApiError(e).errors, { name: 'name', duration: 'duration', 'duration min': 'duration', price: 'price' }));
          Alert.alert('Session type not saved', apiErrorText(e));
        },
      },
    );
  };

  const toggleActive = () => {
    if (!existing) return;
    if (!existing.isActive) return submit(true, 'Session type reactivated.');
    Alert.alert('Deactivate session type?', `"${existing.name}" can't be booked any more. Booked sessions stay.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: () => submit(false, 'Session type deactivated.') },
    ]);
  };

  return (
    <BottomSheet visible={!!type} onClose={onClose} title={existing ? 'Edit session type' : 'New session type'} leftAction={{ label: 'Cancel', onPress: onClose }}>
      <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ padding: SP.xl }} keyboardShouldPersistTaps="handled">
        {isAdmin && !existing && (
          trainers.length ? (
            <ChipSelect<number> label="Trainer" options={trainers.map(t => ({ value: t.id, label: t.name }))}
              value={trainerId} onChange={setTrainerId} error={errors.trainer} />
          ) : <Text style={{ color: T.textSub, marginBottom: SP.md }}>Add a trainer first.</Text>
        )}
        {isAdmin && existing && (
          <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>Trainer: {existing.trainerName ?? '—'}</Text>
        )}
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. 1:1 Strength" error={errors.name} />
        <RowGrid>
          <GridCell><Field label="Duration (min)" value={duration} onChangeText={setDuration} keyboardType="number-pad" error={errors.duration} /></GridCell>
          <GridCell><Field label={`Price${existing ? ` (${existing.currency})` : ''}`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0" error={errors.price} /></GridCell>
        </RowGrid>
        <Field label="Description (optional)" value={description} onChangeText={setDescription} multiline />
        {!existing && <SwitchRow label="Active" value={isActive} onValueChange={setIsActive} description="Only active types can be booked." />}
        <PrimaryButton label={existing ? 'Save changes' : 'Create session type'} icon="check"
          onPress={() => submit(existing ? existing.isActive : isActive, existing ? 'Session type saved.' : 'Session type created.')}
          loading={save.isPending} />
        {existing && (
          <PrimaryButton label={existing.isActive ? 'Deactivate' : 'Reactivate'} icon={existing.isActive ? 'slash' : 'rotate-ccw'}
            variant={existing.isActive ? 'danger' : 'secondary'} onPress={toggleActive} style={{ marginTop: SP.md }} />
        )}
      </ScrollView>
    </BottomSheet>
  );
}
