import React, { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import FormPage from '../../exercises/components/FormPage';
import LoadingState from '../../common/components/LoadingState';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import { DateField } from '../../trainers/components/DatePicker';
import { describeApiError, apiErrorText, fieldErrorsFrom } from '../../../api/apiError';
import { usePlans, useCreateSubscription } from '../api/billingQueries';
import ChargeOptionsFields, {
  ChargeDraft, emptyChargeDraft, chargeOptionsFrom, validateChargeDraft,
} from '../components/ChargeOptionsFields';
import { fmtMoney, cycleLabel, todayIso, Note, computeTotals, toNumber } from '../components/billingUi';
import { T, SP, R } from '../../../theme';

export interface NewMembershipPageProps {
  memberId: number;
  memberName?: string;
  onBack: () => void;
  /** Called after the membership is created (defaults to onBack). */
  onDone?: () => void;
}

/** Sell a membership: plan, start date, tax/discount, and whether it was paid at the desk. */
export default function NewMembershipPage({ memberId, memberName, onBack, onDone }: NewMembershipPageProps) {
  const toast = useToast();
  const { data: plans, isLoading, error, refetch } = usePlans();
  const create = useCreateSubscription();

  const [planId, setPlanId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(todayIso());
  const [draft, setDraft] = useState<ChargeDraft>(emptyChargeDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const plan = plans?.find(p => p.id === planId) ?? null;

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!plan) errs.plan = 'Pick a plan.';
    if (!startDate) errs.startDate = 'Pick a start date.';
    Object.assign(errs, validateChargeDraft(draft, plan?.price ?? 0));
    setErrors(errs);
    if (Object.keys(errs).length || !plan) return;

    const total = computeTotals(plan.price, toNumber(draft.discount), toNumber(draft.taxPercent)).total;
    create.mutate(
      { memberId, planId: plan.id, startDate, ...chargeOptionsFrom(draft) },
      {
        onSuccess: () => {
          toast.show({
            message: draft.paidNow
              ? `${plan.name} started — ${fmtMoney(total, plan.currency)} received.`
              : `${plan.name} started — invoice of ${fmtMoney(total, plan.currency)} is due.`,
          });
          (onDone ?? onBack)();
        },
        onError: e => {
          setErrors(fieldErrorsFrom(describeApiError(e).errors, {
            'start date': 'startDate', plan: 'plan', 'tax percent': 'taxPercent', discount: 'discount',
          }));
          Alert.alert('Membership not created', apiErrorText(e));
        },
      },
    );
  };

  return (
    <FormPage
      eyebrow={memberName ?? 'Membership'}
      title="New membership"
      onBack={onBack}
      submitLabel={plan ? `Create · ${fmtMoney(computeTotals(plan.price, toNumber(draft.discount), toNumber(draft.taxPercent)).total, plan.currency)}` : 'Create membership'}
      onSubmit={submit}
      submitting={create.isPending}
    >
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>Plan</Text>
      {isLoading ? <LoadingState label="Loading plans…" /> : error ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load plans"
          subtitle={describeApiError(error).message} action={{ label: 'Try again', onPress: () => refetch() }} />
      ) : !plans?.length ? (
        <Note icon="alert-circle" tone={T.brandGold} text="No plans yet. Create one in Billing → Plans first." />
      ) : (
        <View style={{ gap: SP.sm, marginBottom: errors.plan ? 4 : SP.lg }}>
          {plans.map(p => {
            const active = p.id === planId;
            return (
              <Pressable
                key={p.id}
                onPress={() => { setPlanId(p.id); setErrors(e => ({ ...e, plan: '' })); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${p.name}, ${fmtMoney(p.price, p.currency)}`}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.md, borderRadius: R.lg, borderWidth: 1,
                  borderColor: active ? T.brand : T.line, backgroundColor: active ? T.brandDim : T.bgInput,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>
                    {cycleLabel(p.billingCycle)}{p.durationDays ? ` · ${p.durationDays} days` : ''}
                  </Text>
                </View>
                <Text style={{ color: active ? T.brand : T.text, fontSize: 15, fontWeight: '800' }}>{fmtMoney(p.price, p.currency)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {!!errors.plan && <Text style={{ color: T.err, fontSize: 12, marginBottom: SP.lg }}>{errors.plan}</Text>}

      <DateField label="Start date" value={startDate} onChange={setStartDate} minYear={new Date().getFullYear() - 1}
        maxYear={new Date().getFullYear() + 2} error={errors.startDate} />

      <ChargeOptionsFields draft={draft} onChange={setDraft} price={plan?.price ?? 0} currency={plan?.currency} errors={errors} />
    </FormPage>
  );
}
