import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import StatusPill from '../../common/components/StatusPill';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import { Field, SwitchRow, RowGrid, GridCell } from '../../trainers/components/FormFields';
import { apiErrorText, describeApiError, fieldErrorsFrom } from '../../../api/apiError';
import { useClassTypes, useSaveClassType } from '../api/classesQueries';
import { ClassType, ClassTypePayload } from '../types/classes.types';
import { TYPE_COLORS, toInt } from './classesUi';
import { T, SP, R } from '../../../theme';

/** Admin management of class types (list, create, edit, deactivate). Rendered as a tab of ClassSchedulePage. */
export default function ClassTypesSection() {
  const { data, isLoading, error, refetch, isRefetching } = useClassTypes(true);
  const [editing, setEditing] = useState<ClassType | 'new' | null>(null);

  if (isLoading) return <LoadingState label="Loading class types…" />;
  if (error) {
    return (
      <EmptyState icon="alert-triangle" tone="error" title="Couldn't load class types"
        subtitle={describeApiError(error).message} action={{ label: 'Try again', onPress: () => refetch() }} />
    );
  }

  const sorted = [...(data ?? [])].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={sorted}
        keyExtractor={t => String(t.id)}
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.brand} />}
        ListHeaderComponent={
          <View style={{ marginBottom: SP.md }}>
            <PrimaryButton label="New class type" icon="plus" variant="secondary" onPress={() => setEditing('new')} />
          </View>
        }
        ListEmptyComponent={<EmptyState icon="grid" title="No class types yet" subtitle="Create types like Yoga, HIIT or Spin, then schedule classes." />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setEditing(item)}
            accessibilityRole="button"
            accessibilityLabel={`Edit class type ${item.name}`}
            style={({ pressed }) => ({
              padding: SP.lg, marginBottom: SP.sm, borderRadius: R.lg, borderWidth: 1, borderColor: T.line,
              backgroundColor: pressed ? T.bgInputActive : T.bgInput, opacity: item.isActive ? 1 : 0.6,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.color || T.brand }} />
              <Text style={{ flex: 1, color: T.text, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>{item.name}</Text>
              {!item.isActive && <StatusPill label="Inactive" tone="neutral" />}
            </View>
            <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 6 }}>
              {item.durationMin ? `${item.durationMin} min` : 'Default 60 min'} · {item.maxCapacity ? `${item.maxCapacity} spots` : 'No capacity limit'}
            </Text>
            {!!item.description && <Text style={{ color: T.textSub, fontSize: 13, marginTop: SP.sm }} numberOfLines={2}>{item.description}</Text>}
          </Pressable>
        )}
      />
      <ClassTypeSheet type={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function ClassTypeSheet({ type, onClose }: { type: ClassType | 'new' | null; onClose: () => void }) {
  const toast = useToast();
  const save = useSaveClassType();
  const existing = type && type !== 'new' ? type : null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [capacity, setCapacity] = useState('');
  const [color, setColor] = useState<string>(TYPE_COLORS[0]);
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setName(existing?.name ?? '');
    setDescription(existing?.description ?? '');
    setDuration(existing?.durationMin != null ? String(existing.durationMin) : '60');
    setCapacity(existing?.maxCapacity != null ? String(existing.maxCapacity) : '');
    setColor(existing?.color || TYPE_COLORS[0]);
    setIsActive(existing?.isActive ?? true);
    setErrors({});
  }, [type]);

  const payload = (active: boolean): ClassTypePayload | null => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Give the class type a name.';
    const dur = duration.trim() ? toInt(duration) : null;
    if (duration.trim() && (dur == null || dur < 5 || dur > 600)) errs.duration = 'Enter minutes (5–600).';
    const cap = capacity.trim() ? toInt(capacity) : null;
    if (capacity.trim() && (cap == null || cap < 1)) errs.capacity = 'At least 1, or leave blank.';
    setErrors(errs);
    if (Object.keys(errs).length) return null;
    return { name: name.trim(), description: description.trim() || null, durationMin: dur, maxCapacity: cap, color, isActive: active };
  };

  const submit = (active: boolean, doneMsg: string) => {
    const p = payload(active);
    if (!p) return;
    save.mutate(
      { id: existing?.id, payload: p },
      {
        onSuccess: () => { toast.show({ message: doneMsg }); onClose(); },
        onError: e => {
          setErrors(fieldErrorsFrom(describeApiError(e).errors, { name: 'name', 'duration min': 'duration', duration: 'duration', 'max capacity': 'capacity', capacity: 'capacity' }));
          Alert.alert('Class type not saved', apiErrorText(e));
        },
      },
    );
  };

  const toggleActive = () => {
    if (!existing) return;
    if (!existing.isActive) return submit(true, 'Class type reactivated.');
    Alert.alert('Deactivate class type?', `"${existing.name}" won't be offered for new classes. Scheduled classes stay.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: () => submit(false, 'Class type deactivated.') },
    ]);
  };

  return (
    <BottomSheet visible={!!type} onClose={onClose} title={existing ? 'Edit class type' : 'New class type'} leftAction={{ label: 'Cancel', onPress: onClose }}>
      <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ padding: SP.xl }} keyboardShouldPersistTaps="handled">
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Yoga Flow" error={errors.name} />
        <RowGrid>
          <GridCell><Field label="Duration (min)" value={duration} onChangeText={setDuration} keyboardType="number-pad" error={errors.duration} /></GridCell>
          <GridCell><Field label="Max capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholder="Unlimited" error={errors.capacity} /></GridCell>
        </RowGrid>
        <Field label="Description (optional)" value={description} onChangeText={setDescription} multiline />

        <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>Colour</Text>
        <View style={{ flexDirection: 'row', gap: SP.md, marginBottom: SP.lg, flexWrap: 'wrap' }}>
          {TYPE_COLORS.map(c => {
            const active = c.toLowerCase() === color.toLowerCase();
            return (
              <Pressable key={c} onPress={() => setColor(c)} accessibilityRole="radio" accessibilityState={{ selected: active }}
                accessibilityLabel={`Colour ${TYPE_COLORS.indexOf(c) + 1}`} hitSlop={6}
                style={{
                  width: 34, height: 34, borderRadius: 17, backgroundColor: c, alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: active ? T.text : 'transparent',
                }}>
                {active && <Feather name="check" size={16} color={T.onBrand} />}
              </Pressable>
            );
          })}
        </View>
        {!existing && <SwitchRow label="Active" value={isActive} onValueChange={setIsActive} description="Inactive types can't be scheduled." />}

        <PrimaryButton label={existing ? 'Save changes' : 'Create class type'} icon="check"
          onPress={() => submit(existing ? existing.isActive : isActive, existing ? 'Class type saved.' : 'Class type created.')}
          loading={save.isPending} />
        {existing && (
          <PrimaryButton label={existing.isActive ? 'Deactivate' : 'Reactivate'} icon={existing.isActive ? 'slash' : 'rotate-ccw'}
            variant={existing.isActive ? 'danger' : 'secondary'} onPress={toggleActive} style={{ marginTop: SP.md }} />
        )}
      </ScrollView>
    </BottomSheet>
  );
}
