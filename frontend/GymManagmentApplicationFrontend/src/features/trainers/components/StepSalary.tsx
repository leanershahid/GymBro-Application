import React from 'react';
import { ScrollView, Text } from 'react-native';
import { TrainerPayload } from '../types/trainer.types';
import { Field, SwitchRow, RowGrid, GridCell } from './FormFields';

interface Props {
  data: Partial<TrainerPayload>;
  onChange: (fields: Partial<TrainerPayload>) => void;
}

function Section({ title }: { title: string }) {
  return <Text className="text-[13px] font-semibold text-sub mb-3 mt-1">{title}</Text>;
}

export default function StepSalary({ data, onChange }: Props) {
  const sal    = data.salary ?? {} as any;
  const update = (f: object) => onChange({ salary: { ...sal, ...f } });

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text className="text-[30px] font-extrabold text-white mb-[6px]" style={{ letterSpacing: -0.5 }}>Salary</Text>
      <Text className="text-[14px] font-normal text-sub mb-7" style={{ lineHeight: 20 }}>Pay structure, rates and commission</Text>

      <Section title="Base Pay" />
      <RowGrid>
        <GridCell><Field label="Salary Type"   value={sal.salaryType ?? ''}   onChangeText={(v) => update({ salaryType: v })} /></GridCell>
        <GridCell><Field label="Payment Cycle" value={sal.paymentCycle ?? ''} onChangeText={(v) => update({ paymentCycle: v })} /></GridCell>
      </RowGrid>
      <RowGrid>
        <GridCell><Field label="Currency"     value={sal.currency ?? ''}            onChangeText={(v) => update({ currency: v })} /></GridCell>
        <GridCell><Field label="Basic Salary" value={String(sal.basicSalary ?? '')} onChangeText={(v) => update({ basicSalary: Number(v) })} keyboardType="numeric" /></GridCell>
      </RowGrid>

      <Section title="Rates" />
      <RowGrid>
        <GridCell><Field label="Hourly Rate" value={String(sal.hourlyRate ?? '')}     onChangeText={(v) => update({ hourlyRate: Number(v) })}     keyboardType="numeric" /></GridCell>
        <GridCell><Field label="Per Session" value={String(sal.perSessionRate ?? '')} onChangeText={(v) => update({ perSessionRate: Number(v) })} keyboardType="numeric" /></GridCell>
      </RowGrid>
      <RowGrid>
        <GridCell><Field label="Per Client" value={String(sal.perClientRate ?? '')} onChangeText={(v) => update({ perClientRate: Number(v) })} keyboardType="numeric" /></GridCell>
        <GridCell><Field label="Per Class"  value={String(sal.perClassRate ?? '')}  onChangeText={(v) => update({ perClassRate: Number(v) })}  keyboardType="numeric" /></GridCell>
      </RowGrid>

      <Section title="Commission" />
      <RowGrid>
        <GridCell><Field label="Commission Type"  value={sal.commissionType ?? ''}          onChangeText={(v) => update({ commissionType: v })} /></GridCell>
        <GridCell><Field label="Value"            value={String(sal.commissionValue ?? '')} onChangeText={(v) => update({ commissionValue: Number(v) })} keyboardType="numeric" /></GridCell>
      </RowGrid>
      <Field label="Based On"              value={sal.commissionBasedOn ?? ''}               onChangeText={(v) => update({ commissionBasedOn: v })} />
      <Field label="Min Guaranteed Amount" value={String(sal.minimumGuaranteedAmount ?? '')} onChangeText={(v) => update({ minimumGuaranteedAmount: Number(v) })} keyboardType="numeric" />

      <Section title="Overtime" />
      <SwitchRow label="Overtime Applicable" description="Enable overtime pay calculation" value={sal.overtimeApplicable ?? false} onValueChange={(v) => update({ overtimeApplicable: v })} />
      <Field label="Overtime Hourly Rate" value={String(sal.overtimeHourlyRate ?? '')} onChangeText={(v) => update({ overtimeHourlyRate: Number(v) })} keyboardType="numeric" />
    </ScrollView>
  );
}
