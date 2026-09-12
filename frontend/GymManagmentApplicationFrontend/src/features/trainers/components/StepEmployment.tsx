import React from 'react';
import { ScrollView, Text } from 'react-native';
import { TrainerPayload } from '../types/trainer.types';
import { Field, RowGrid, GridCell } from './FormFields';
import { DateField } from './DatePicker';

interface Props {
  data: Partial<TrainerPayload>;
  onChange: (fields: Partial<TrainerPayload>) => void;
}

function Section({ title }: { title: string }) {
  return <Text className="text-[13px] font-semibold text-sub mb-3 mt-1">{title}</Text>;
}

export default function StepEmployment({ data, onChange }: Props) {
  const emp    = data.employment ?? {} as any;
  const update = (f: object) => onChange({ employment: { ...emp, ...f } });

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text className="text-[30px] font-extrabold text-white mb-[6px]" style={{ letterSpacing: -0.5 }}>Employment</Text>
      <Text className="text-[14px] font-normal text-sub mb-7" style={{ lineHeight: 20 }}>Role, department and contract dates</Text>

      <Section title="Role" />
      <RowGrid>
        <GridCell><Field label="Employment Type" value={emp.employmentType ?? ''} onChangeText={(v) => update({ employmentType: v })} /></GridCell>
        <GridCell><Field label="Status"          value={emp.status ?? ''}         onChangeText={(v) => update({ status: v })} /></GridCell>
      </RowGrid>
      <Field label="Designation" value={emp.designation ?? ''} onChangeText={(v) => update({ designation: v })} />
      <Field label="Department"  value={emp.department ?? ''}  onChangeText={(v) => update({ department: v })} />

      <Section title="Dates" />
      <DateField label="Joining Date" value={emp.joiningDate ?? ''} onChange={(v) => update({ joiningDate: v })} />
      <RowGrid>
        <GridCell><DateField label="Contract Start" value={emp.contractStartDate ?? ''} onChange={(v) => update({ contractStartDate: v })} /></GridCell>
        <GridCell><DateField label="Contract End"   value={emp.contractEndDate ?? ''}   onChange={(v) => update({ contractEndDate: v })} /></GridCell>
      </RowGrid>
    </ScrollView>
  );
}
