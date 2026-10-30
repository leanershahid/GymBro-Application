import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, FlatList, RefreshControl, Alert, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import LoadingState from '../../common/components/LoadingState';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import StatusPill from '../../common/components/StatusPill';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import ChipSelect from '../../exercises/components/ChipSelect';
import { Field, SwitchRow } from '../../trainers/components/FormFields';
import { describeApiError, apiErrorText, fieldErrorsFrom } from '../../../api/apiError';
import { usePlans, useCreatePlan, useUpdatePlan, useArchivePlan } from '../api/billingQueries';
import { MembershipPlan, BillingCycleInput } from '../types/billing.types';
import { CYCLES, cycleInputFrom, cycleLabel, fmtMoney, SmallButton, toNumber } from './billingUi';
import { T, SP, R } from '../../../theme';

export default function PlansTab() {
  const { data, isLoading, error, refetch, isRefetching } = usePlans();
  const [editing, setEditing] = useState<MembershipPlan | 'new' | null>(null);

  if (isLoading) return <LoadingState label="Loading plans…" />;
  if (error) {
    return (
      <EmptyState icon="alert-triangle" tone="error" title="Couldn't load plans"
        subtitle={describeApiError(error).message} action={{ label: 'Try again', onPress: () => refetch() }} />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={data ?? []}
        keyExtractor={p => String(p.id)}
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.brand} />}
        ListHeaderComponent={
          <View style={{ marginBottom: SP.md }}>
            <PrimaryButton label="New plan" icon="plus" variant="secondary" onPress={() => setEditing('new')} />
          </View>
        }
        ListEmptyComponent={<EmptyState icon="layers" title="No plans yet" subtitle="Create the memberships you sell — monthly, quarterly, annual…" />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setEditing(item)}
            accessibilityRole="button"
            accessibilityLabel={`Edit plan ${item.name}`}
            style={({ pressed }) => ({
              padding: SP.lg, marginBottom: SP.sm, borderRadius: R.lg, borderWidth: 1, borderColor: T.line,
              backgroundColor: pressed ? T.bgInputActive : T.bgInput,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
              <Text style={{ flex: 1, color: T.text, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>{item.name}</Text>
              <Text style={{ color: T.brand, fontSize: 16, fontWeight: '800' }}>{fmtMoney(item.price, item.currency)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: 6, alignItems: 'center' }}>
              <StatusPill label={cycleLabel(item.billingCycle)} tone="info" />
              {!item.isPublic && <StatusPill label="Hidden" tone="neutral" />}
            </View>
            {!!item.description && <Text style={{ color: T.textSub, fontSize: 13, marginTop: SP.sm }} numberOfLines={2}>{item.description}</Text>}
            {item.features.length > 0 && (
              <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 6 }} numberOfLines={2}>
                {item.features.join(' · ')}
              </Text>
            )}
          </Pressable>
        )}
      />
      <PlanSheet plan={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function PlanSheet({ plan, onClose }: { plan: MembershipPlan | 'new' | null; onClose: () => void }) {
  const toast = useToast();
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const archive = useArchivePlan();
  const existing = plan && plan !== 'new' ? plan : null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [cycle, setCycle] = useState<BillingCycleInput>('monthly');
  const [features, setFeatures] = useState<string[]>([]);
  const [featureDraft, setFeatureDraft] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setName(existing?.name ?? '');
    setDescription(existing?.description ?? '');
    setPrice(existing ? String(existing.price) : '');
    setCycle(existing ? cycleInputFrom(existing.billingCycle) : 'monthly');
    setFeatures(existing?.features ?? []);
    setFeatureDraft('');
    setIsPublic(existing?.isPublic ?? true);
    setErrors({});
  }, [plan]);

  const addFeature = () => {
    const f = featureDraft.trim();
    if (f && !features.includes(f)) setFeatures([...features, f]);
    setFeatureDraft('');
  };

  const onError = (title: string) => (e: unknown) => {
    const { errors: list } = describeApiError(e);
    setErrors(fieldErrorsFrom(list, { name: 'name', price: 'price', 'billing cycle': 'cycle', description: 'description' }));
    Alert.alert(title, apiErrorText(e));
  };

  const save = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Give the plan a name.';
    const p = toNumber(price);
    if (!(p > 0)) errs.price = 'Enter a price above zero.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    // A feature typed but not yet added still counts.
    const allFeatures = featureDraft.trim() && !features.includes(featureDraft.trim()) ? [...features, featureDraft.trim()] : features;

    if (existing) {
      update.mutate(
        { id: existing.id, patch: { name: name.trim(), description: description.trim() || null, price: p, billingCycle: cycle, isPublic }, features: allFeatures },
        { onSuccess: () => { toast.show({ message: 'Plan updated.' }); onClose(); }, onError: onError('Plan not saved') },
      );
    } else {
      create.mutate(
        { name: name.trim(), description: description.trim() || null, price: p, billingCycle: cycle, features: allFeatures, isPublic },
        { onSuccess: () => { toast.show({ message: 'Plan created.' }); onClose(); }, onError: onError('Plan not created') },
      );
    }
  };

  const confirmArchive = () => {
    if (!existing) return;
    Alert.alert('Archive plan?', `"${existing.name}" won't be offered for new memberships. Existing members keep it.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', style: 'destructive',
        onPress: () => archive.mutate(existing.id, {
          onSuccess: () => { toast.show({ message: 'Plan archived.' }); onClose(); },
          onError: e => Alert.alert('Couldn’t archive', apiErrorText(e)),
        }),
      },
    ]);
  };

  return (
    <BottomSheet visible={!!plan} onClose={onClose} title={existing ? 'Edit plan' : 'New plan'} leftAction={{ label: 'Cancel', onPress: onClose }}>
      <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ padding: SP.xl }} keyboardShouldPersistTaps="handled">
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Gold — 3 months" error={errors.name} />
        <Field label={`Price${existing ? ` (${existing.currency})` : ''}`} value={price} onChangeText={setPrice}
          keyboardType="decimal-pad" error={errors.price} />
        {!existing && <Text style={{ color: T.textFaint, fontSize: 12, marginTop: -8, marginBottom: SP.md }}>Uses your gym's currency.</Text>}
        <ChipSelect<BillingCycleInput> label="Billing cycle" options={CYCLES} value={cycle} onChange={setCycle} error={errors.cycle} />
        <Field label="Description (optional)" value={description} onChangeText={setDescription} multiline error={errors.description} />

        <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>Features</Text>
        {features.map(f => (
          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingVertical: 6 }}>
            <Feather name="check" size={14} color={T.brand} />
            <Text style={{ flex: 1, color: T.text, fontSize: 14 }}>{f}</Text>
            <Pressable onPress={() => setFeatures(features.filter(x => x !== f))} hitSlop={10}
              accessibilityRole="button" accessibilityLabel={`Remove ${f}`}>
              <Feather name="x" size={16} color={T.textFaint} />
            </Pressable>
          </View>
        ))}
        <Field label="Add a feature" value={featureDraft} onChangeText={setFeatureDraft} placeholder="e.g. Locker, 4 PT sessions"
          rightElement={<View style={{ paddingRight: SP.sm }}><SmallButton icon="plus" label="Add" onPress={addFeature} /></View>} />
        <SwitchRow label="Show to members" value={isPublic} onValueChange={setIsPublic}
          description="Hidden plans can still be sold at the desk." />

        <PrimaryButton label={existing ? 'Save changes' : 'Create plan'} icon="check" onPress={save}
          loading={create.isPending || update.isPending} />
        {existing && (
          <PrimaryButton label="Archive plan" icon="archive" variant="danger" onPress={confirmArchive}
            loading={archive.isPending} style={{ marginTop: SP.md }} />
        )}
      </ScrollView>
    </BottomSheet>
  );
}
