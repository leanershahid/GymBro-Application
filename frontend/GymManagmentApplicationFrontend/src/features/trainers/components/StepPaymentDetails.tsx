import React from 'react';
import { ScrollView, Text } from 'react-native';
import { TrainerPayload } from '../types/trainer.types';
import { Field, RowGrid, GridCell } from './FormFields';

interface Props {
  data: Partial<TrainerPayload>;
  onChange: (fields: Partial<TrainerPayload>) => void;
}

function Section({ title }: { title: string }) {
  return <Text className="text-[13px] font-semibold text-sub mb-3 mt-1">{title}</Text>;
}

export default function StepPaymentDetails({ data, onChange }: Props) {
  const pd     = data.paymentDetails ?? {} as any;
  const update = (f: object) => onChange({ paymentDetails: { ...pd, ...f } });

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text className="text-[30px] font-extrabold text-white mb-[6px]" style={{ letterSpacing: -0.5 }}>Payment</Text>
      <Text className="text-[14px] font-normal text-sub mb-7" style={{ lineHeight: 20 }}>Bank details and payment method</Text>

      <Section title="Bank Details" />
      <Field label="Payment Mode"        value={pd.paymentMode ?? ''}       onChangeText={(v) => update({ paymentMode: v })} />
      <Field label="Bank Name"           value={pd.bankName ?? ''}          onChangeText={(v) => update({ bankName: v })} />
      <Field label="Account Holder Name" value={pd.accountHolderName ?? ''} onChangeText={(v) => update({ accountHolderName: v })} />
      <RowGrid>
        <GridCell><Field label="Account Number" value={pd.accountNumber ?? ''} onChangeText={(v) => update({ accountNumber: v })} keyboardType="numeric" /></GridCell>
        <GridCell><Field label="IFSC Code"      value={pd.ifscCode ?? ''}      onChangeText={(v) => update({ ifscCode: v })} /></GridCell>
      </RowGrid>

      <Section title="Digital & Tax" />
      <Field label="UPI ID"     value={pd.upiId ?? ''}     onChangeText={(v) => update({ upiId: v })} autoCapitalize="none" />
      <Field label="Tax Number" value={pd.taxNumber ?? ''} onChangeText={(v) => update({ taxNumber: v })} autoCapitalize="characters" />
    </ScrollView>
  );
}
