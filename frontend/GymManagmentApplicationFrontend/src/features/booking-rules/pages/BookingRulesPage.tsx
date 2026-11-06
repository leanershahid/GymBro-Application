import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import ChipSelect, { ChipOption } from '../../common/components/ChipSelect';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { useBookingRulesSettings, useSaveBookingRules } from '../api/bookingRulesQueries';
import { BookingRulesSettings, LateCancelConsequence, NoShowConsequence } from '../types/bookingRules.types';

interface Props { onBack?: () => void }

type Form = Record<'classCutoff' | 'ptCutoff' | 'lateFee' | 'noShowFee' | 'strikes' | 'window' | 'blockDays' | 'autoMinutes', string>;

const digits = (v: string) => v.replace(/[^\d]/g, '');
const decimal = (v: string) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');

function rangeError(v: string, min: number, max: number): string | undefined {
  const n = Number(v);
  return v === '' || !Number.isInteger(n) || n < min || n > max ? `Between ${min} and ${max}` : undefined;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View>
      <Text accessibilityRole="header" style={{ color: T.text, fontSize: 18, fontWeight: '700', marginBottom: hint ? 6 : 14 }}>{title}</Text>
      {!!hint && <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 14, lineHeight: 18 }}>{hint}</Text>}
      {children}
    </View>
  );
}

/**
 * Admin (Schedule → Booking rules, classes module, edit): cancellation cut-offs, late-cancel and
 * no-show consequences, strikes → booking block, waivers and the automatic no-show.
 */
export default function BookingRulesPage({ onBack }: Props) {
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useBookingRulesSettings();
  const save = useSaveBookingRules();
  const [late, setLate] = useState<LateCancelConsequence>('none');
  const [noShow, setNoShow] = useState<NoShowConsequence>('strike');
  const [staffCanWaive, setStaffCanWaive] = useState(true);
  const [autoNoShow, setAutoNoShow] = useState(false);
  const [f, setF] = useState<Form>({ classCutoff: '2', ptCutoff: '24', lateFee: '', noShowFee: '', strikes: '3', window: '30', blockDays: '7', autoMinutes: '60' });
  const set = (k: keyof Form, v: string) => setF(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!data) return;
    setLate(data.lateCancelConsequence);
    setNoShow(data.noShowConsequence);
    setStaffCanWaive(data.staffCanWaive);
    setAutoNoShow(data.autoNoShowEnabled);
    setF({
      classCutoff: String(data.classCancelCutoffHours), ptCutoff: String(data.ptCancelCutoffHours),
      lateFee: data.lateCancelFee ? String(data.lateCancelFee) : '', noShowFee: data.noShowFee ? String(data.noShowFee) : '',
      strikes: String(data.strikesBeforeBlock), window: String(data.strikeWindowDays), blockDays: String(data.blockDays),
      autoMinutes: String(data.autoNoShowAfterMinutes),
    });
  }, [data]);

  const credits = !!data?.creditsSupported;
  const lateOptions: ChipOption<LateCancelConsequence>[] = [
    { value: 'none', label: 'Nothing' }, { value: 'fee', label: 'Charge a fee' },
    ...(credits ? [{ value: 'lose_credit' as const, label: 'Lose the credit' }] : []),
  ];
  const noShowOptions: ChipOption<NoShowConsequence>[] = [
    { value: 'none', label: 'Nothing' }, { value: 'fee', label: 'Charge a fee' }, { value: 'strike', label: 'Strike' },
    ...(credits ? [{ value: 'lose_credit' as const, label: 'Lose the credit' }] : []),
  ];

  const feeError = (v: string, on: boolean) => (on && !(Number(v) > 0) ? 'Enter the fee' : undefined);
  const errors = {
    classCutoff: rangeError(f.classCutoff, 0, 168),
    ptCutoff: rangeError(f.ptCutoff, 0, 168),
    lateFee: feeError(f.lateFee, late === 'fee'),
    noShowFee: feeError(f.noShowFee, noShow === 'fee'),
    strikes: noShow === 'strike' ? rangeError(f.strikes, 1, 20) : undefined,
    window: noShow === 'strike' ? rangeError(f.window, 1, 365) : undefined,
    blockDays: noShow === 'strike' ? rangeError(f.blockDays, 1, 90) : undefined,
    autoMinutes: autoNoShow ? rangeError(f.autoMinutes, 0, 1440) : undefined,
  };
  const invalid = Object.values(errors).some(Boolean);
  const currency = data?.currency ?? 'INR';

  const submit = () => {
    if (!data || invalid) return;
    const body: BookingRulesSettings = {
      classCancelCutoffHours: Number(f.classCutoff), ptCancelCutoffHours: Number(f.ptCutoff),
      lateCancelConsequence: late, lateCancelFee: Number(f.lateFee) || 0,
      noShowConsequence: noShow, noShowFee: Number(f.noShowFee) || 0,
      strikesBeforeBlock: Number(f.strikes) || data.strikesBeforeBlock, strikeWindowDays: Number(f.window) || data.strikeWindowDays,
      blockDays: Number(f.blockDays) || data.blockDays, staffCanWaive,
      autoNoShowEnabled: autoNoShow, autoNoShowAfterMinutes: f.autoMinutes === '' ? data.autoNoShowAfterMinutes : Number(f.autoMinutes),
    };
    save.mutate(body, {
      onSuccess: () => toast.show({ type: 'success', message: 'Booking rules saved.' }),
      onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
    });
  };

  return (
    <Screen>
      <ScreenHeader eyebrow="Classes" title="Booking rules" onBack={onBack} />
      {isLoading ? (
        <LoadingState label="Loading booking rules" />
      ) : isError || !data ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load booking rules" action={{ label: 'Retry', onPress: () => refetch() }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 40, gap: 28 }}>
            <Section title="Free cancellation" hint="Members see “Free cancellation until …” on every class and session. Cancelling later is a late cancel.">
              <Field label="Classes: hours before the start" value={f.classCutoff} onChangeText={v => set('classCutoff', digits(v))} keyboardType="numeric" error={errors.classCutoff} />
              <Field label="Personal training: hours before the start" value={f.ptCutoff} onChangeText={v => set('ptCutoff', digits(v))} keyboardType="numeric" error={errors.ptCutoff} />
            </Section>

            <Section title="Late cancellation" hint="The member confirms the consequence before cancelling; the spot still goes to the waitlist.">
              <ChipSelect label="What happens" options={lateOptions} value={late} onChange={setLate} />
              {late === 'fee' && (
                <Field label={`Late-cancel fee (${currency})`} value={f.lateFee} onChangeText={v => set('lateFee', decimal(v))} keyboardType="numeric" error={errors.lateFee} />
              )}
            </Section>

            <Section title="No-shows" hint="Recorded when staff mark a no-show on the roster or PT session (once per booking).">
              <ChipSelect label="What happens" options={noShowOptions} value={noShow} onChange={setNoShow} />
              {noShow === 'fee' && (
                <Field label={`No-show fee (${currency})`} value={f.noShowFee} onChangeText={v => set('noShowFee', decimal(v))} keyboardType="numeric" error={errors.noShowFee} />
              )}
              {noShow === 'strike' && (<>
                <Field label="Strikes before booking is paused" value={f.strikes} onChangeText={v => set('strikes', digits(v))} keyboardType="numeric" error={errors.strikes} />
                <Field label="Counted over the last (days)" value={f.window} onChangeText={v => set('window', digits(v))} keyboardType="numeric" error={errors.window} />
                <Field label="Pause self-booking for (days)" value={f.blockDays} onChangeText={v => set('blockDays', digits(v))} keyboardType="numeric" error={errors.blockDays} />
              </>)}
              <SwitchRow
                label="Automatic no-show"
                description="If attendance was never taken, members still booked are marked as no-shows after the class ends."
                value={autoNoShow} onValueChange={setAutoNoShow}
              />
              {autoNoShow && (
                <Field label="Minutes after the class ends" value={f.autoMinutes} onChangeText={v => set('autoMinutes', digits(v))} keyboardType="numeric" error={errors.autoMinutes} />
              )}
            </Section>

            <Section title="Waivers">
              <SwitchRow
                label="Staff can waive penalties"
                description="Off: only gym admins can waive fees and strikes or lift a booking pause."
                value={staffCanWaive} onValueChange={setStaffCanWaive}
              />
              {!credits && (
                <Text style={{ color: T.textFaint, fontSize: 12, lineHeight: 17 }}>
                  “Lose the credit” appears here once class credits are used for bookings.
                </Text>
              )}
            </Section>

            <PrimaryButton label="Save booking rules" onPress={submit} loading={save.isPending} disabled={invalid} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
