import React, { useEffect, useState } from 'react';
import { ScrollView, Text, Alert, View } from 'react-native';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import { useToast } from '../../common/components/Toast';
import ChipSelect from '../../exercises/components/ChipSelect';
import { Field, RowGrid, GridCell } from '../../trainers/components/FormFields';
import { DateField } from '../../trainers/components/DatePicker';
import { TimeField } from '../../trainers/components/TimePicker';
import { apiErrorText, describeApiError, fieldErrorsFrom } from '../../../api/apiError';
import { useClassTypes, useBranchOptions, useTrainerOptions, useCreateClass, useUpdateClass } from '../api/classesQueries';
import { GymClass } from '../types/classes.types';
import { localDateKey, localTimeKey, minutesBetween, toInt, toUtcIso } from './classesUi';
import { T, SP } from '../../../theme';

export interface ClassFormSheetProps {
  visible: boolean;
  onClose: () => void;
  mode: 'admin' | 'trainer';
  /** Edit this class; omit to schedule a new one. */
  existing?: GymClass | null;
  /** Local "YYYY-MM-DD" to start a new class on. */
  defaultDate?: string;
  /** Pre-selected branch (admin filter, or the trainer's own branch). */
  defaultBranchId?: number | null;
}

const NO_TRAINER = 0;

/** New class / edit class form. Trainers always teach what they create (the server enforces it). */
export default function ClassFormSheet({ visible, onClose, mode, existing, defaultDate, defaultBranchId }: ClassFormSheetProps) {
  const toast = useToast();
  const isAdmin = mode === 'admin';
  const types = useClassTypes(false);
  const branches = useBranchOptions(isAdmin && visible);
  const trainers = useTrainerOptions(isAdmin && visible);
  const create = useCreateClass();
  const update = useUpdateClass();

  const [typeId, setTypeId] = useState<number | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [trainerId, setTrainerId] = useState<number>(NO_TRAINER);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [capacity, setCapacity] = useState('');
  const [repeat, setRepeat] = useState('0');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    if (existing) {
      const start = new Date(existing.startsAt);
      setTypeId(existing.classTypeId);
      setBranchId(existing.branchId);
      setTrainerId(existing.trainerId ?? NO_TRAINER);
      setTitle(existing.title ?? '');
      setDate(localDateKey(start));
      setTime(localTimeKey(start));
      setDuration(String(minutesBetween(existing.startsAt, existing.endsAt)));
      setCapacity(existing.capacity != null ? String(existing.capacity) : '');
      setNotes(existing.notes ?? '');
    } else {
      setTypeId(null);
      setBranchId(defaultBranchId ?? null);
      setTrainerId(NO_TRAINER);
      setTitle('');
      setDate(defaultDate ?? localDateKey(new Date()));
      setTime('');
      setDuration('');
      setCapacity('');
      setNotes('');
    }
    setRepeat('0');
    setErrors({});
  }, [visible, existing]);

  // Admin with a single branch: pick it.
  useEffect(() => {
    if (visible && !existing && branchId == null && branches.data?.length === 1) setBranchId(branches.data[0].id);
  }, [visible, branches.data]);

  const pickType = (id: number) => {
    setTypeId(id);
    const t = types.data?.find(x => x.id === id);
    if (t?.durationMin) setDuration(String(t.durationMin));
    if (t?.maxCapacity) setCapacity(String(t.maxCapacity));
  };

  const onError = (title: string) => (e: unknown) => {
    const { errors: list } = describeApiError(e);
    setErrors(fieldErrorsFrom(list, {
      title: 'title', 'starts at': 'time', duration: 'duration', 'duration min': 'duration',
      capacity: 'capacity', 'max capacity': 'capacity', 'repeat weeks': 'repeat',
    }));
    // Clashes and similar business-rule failures come back as a plain message.
    Alert.alert(title, apiErrorText(e));
  };

  const save = () => {
    const errs: Record<string, string> = {};
    if (!existing && !typeId) errs.type = 'Choose a class type.';
    if (!existing && !branchId) errs.branch = isAdmin ? 'Choose a branch.' : 'Your branch is unknown — ask an admin to schedule this class.';
    const startsAt = date && time ? toUtcIso(date, time) : null;
    if (!date) errs.date = 'Pick a date.';
    if (!time) errs.time = 'Pick a start time.';
    else if (!startsAt) errs.time = 'Invalid date or time.';
    const dur = duration.trim() ? toInt(duration) : null;
    if (duration.trim() && (dur == null || dur < 5 || dur > 600)) errs.duration = 'Enter minutes (5–600).';
    const cap = capacity.trim() ? toInt(capacity) : null;
    if (capacity.trim() && (cap == null || cap < 1)) errs.capacity = 'Enter a capacity of at least 1.';
    const rep = toInt(repeat || '0');
    if (!existing && (rep == null || rep < 0 || rep > 26)) errs.repeat = 'Between 0 and 26 weeks.';
    setErrors(errs);
    if (Object.keys(errs).length || !startsAt) return;

    if (existing) {
      update.mutate(
        {
          id: existing.id,
          payload: {
            trainerId: isAdmin ? (trainerId || null) : undefined,
            title: title.trim() || null,
            startsAt,
            durationMin: dur,
            maxCapacity: cap,
            notes: notes.trim() || null,
          },
        },
        { onSuccess: () => { toast.show({ message: 'Class updated.' }); onClose(); }, onError: onError('Class not saved') },
      );
    } else {
      create.mutate(
        {
          classTypeId: typeId!,
          branchId: branchId!,
          trainerId: isAdmin ? (trainerId || null) : null,
          title: title.trim() || null,
          startsAt,
          durationMin: dur,
          maxCapacity: cap,
          notes: notes.trim() || null,
          repeatWeeks: rep ?? 0,
        },
        { onSuccess: msg => { toast.show({ message: msg || 'Class scheduled.' }); onClose(); }, onError: onError('Class not scheduled') },
      );
    }
  };

  const activeTypes = (types.data ?? []).filter(t => t.isActive);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={existing ? 'Edit class' : 'New class'} leftAction={{ label: 'Cancel', onPress: onClose }}>
      <ScrollView style={{ maxHeight: 660 }} contentContainerStyle={{ padding: SP.xl }} keyboardShouldPersistTaps="handled">
        {!existing && (
          types.isLoading ? <LoadingState label="Loading class types…" /> :
          types.error ? <Text style={{ color: T.err, marginBottom: SP.md }}>{describeApiError(types.error).message}</Text> :
          activeTypes.length === 0 ? (
            <Text style={{ color: T.textSub, marginBottom: SP.md }}>
              No class types yet.{isAdmin ? ' Add one in the "Class types" tab first.' : ' Ask an admin to add class types.'}
            </Text>
          ) : (
            <ChipSelect<number> label="Class type" options={activeTypes.map(t => ({ value: t.id, label: t.name }))}
              value={typeId} onChange={pickType} error={errors.type} />
          )
        )}
        {existing && (
          <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>
            {existing.classTypeName}{existing.branchName ? ` · ${existing.branchName}` : ''}
          </Text>
        )}

        {!existing && isAdmin && (
          branches.isLoading ? <LoadingState label="Loading branches…" /> :
          branches.error ? <Text style={{ color: T.err, marginBottom: SP.md }}>{describeApiError(branches.error).message}</Text> : (
            <ChipSelect<number> label="Branch" options={(branches.data ?? []).map(b => ({ value: b.id, label: b.name }))}
              value={branchId} onChange={setBranchId} error={errors.branch} />
          )
        )}
        {!existing && !isAdmin && !!errors.branch && <Text style={{ color: T.err, fontSize: 12, marginBottom: SP.md }}>{errors.branch}</Text>}

        {isAdmin && (
          trainers.isLoading ? <LoadingState label="Loading trainers…" /> :
          trainers.error ? <Text style={{ color: T.err, marginBottom: SP.md }}>{describeApiError(trainers.error).message}</Text> : (
            <ChipSelect<number> label="Trainer"
              options={[{ value: NO_TRAINER, label: 'Unassigned' }, ...(trainers.data ?? []).map(t => ({ value: t.id, label: t.name }))]}
              value={trainerId} onChange={setTrainerId} />
          )
        )}
        {!isAdmin && !existing && (
          <Text style={{ color: T.textFaint, fontSize: 12, marginBottom: SP.md }}>You'll be the trainer for this class.</Text>
        )}

        <Field label="Title (optional)" value={title} onChangeText={setTitle} placeholder="Defaults to the class type name" error={errors.title} />
        <RowGrid>
          <GridCell><DateField label="Date" value={date} onChange={setDate} error={errors.date} /></GridCell>
          <GridCell>
            <TimeField label="Start time" value={time} onChange={setTime} />
            {!!errors.time && <Text style={{ color: T.err, fontSize: 12, marginTop: -8, marginBottom: SP.md }}>{errors.time}</Text>}
          </GridCell>
        </RowGrid>
        <RowGrid>
          <GridCell><Field label="Duration (min)" value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="60" error={errors.duration} /></GridCell>
          <GridCell><Field label="Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholder="Unlimited" error={errors.capacity} /></GridCell>
        </RowGrid>
        {!existing && (
          <View>
            <Field label="Repeat weekly for (extra weeks)" value={repeat} onChangeText={setRepeat} keyboardType="number-pad" placeholder="0" error={errors.repeat} />
            <Text style={{ color: T.textFaint, fontSize: 12, marginTop: -8, marginBottom: SP.md }}>
              0 = just this class; up to 26 more weeks at the same time.
            </Text>
          </View>
        )}
        <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
        <PrimaryButton label={existing ? 'Save changes' : 'Schedule class'} icon="check" onPress={save}
          loading={create.isPending || update.isPending} />
      </ScrollView>
    </BottomSheet>
  );
}
