import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { TrainerPayload } from '../types/trainer.types';
import { Field, SwitchRow, RowGrid, GridCell } from './FormFields';
import { T } from './theme';

interface Props {
  data: Partial<TrainerPayload>;
  onChange: (fields: Partial<TrainerPayload>) => void;
}

function Block({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <View className="px-5 pt-[22px] pb-[10px]">
      <View className="flex-row items-center gap-[10px] mb-4">
        <View className="w-7 h-7 rounded-lg bg-[rgba(126,211,33,0.10)] border border-[rgba(126,211,33,0.25)] items-center justify-center">
          <Text className="text-[11px] font-extrabold text-brand" style={{ letterSpacing: 0.5 }}>{num}</Text>
        </View>
        <Text className="text-[16px] font-bold text-white">{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function StepMiscellaneous({ data, onChange }: Props) {
  const ec  = data.emergencyContact   ?? {} as any;
  const sl  = data.socialLinks        ?? {} as any;
  const att = data.attendanceSettings ?? {} as any;
  const updateEc  = (f: object) => onChange({ emergencyContact:   { ...ec,  ...f } });
  const updateSl  = (f: object) => onChange({ socialLinks:        { ...sl,  ...f } });
  const updateAtt = (f: object) => onChange({ attendanceSettings: { ...att, ...f } });

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

      <Block num="01" title="Emergency Contact">
        <RowGrid>
          <GridCell><Field label="Name"     value={ec.name ?? ''}     onChangeText={(v) => updateEc({ name: v })} /></GridCell>
          <GridCell><Field label="Relation" value={ec.relation ?? ''} onChangeText={(v) => updateEc({ relation: v })} /></GridCell>
        </RowGrid>
        <Field label="Phone"   value={ec.phone ?? ''}   onChangeText={(v) => updateEc({ phone: v })}   keyboardType="phone-pad" />
        <Field label="Address" value={ec.address ?? ''} onChangeText={(v) => updateEc({ address: v })} />
      </Block>

      <View className="h-px bg-[#151915] mx-5" />

      <Block num="02" title="Social Links">
        <RowGrid>
          <GridCell><Field label="Instagram" value={sl.instagram ?? ''} onChangeText={(v) => updateSl({ instagram: v })} /></GridCell>
          <GridCell><Field label="Facebook"  value={sl.facebook ?? ''}  onChangeText={(v) => updateSl({ facebook: v })} /></GridCell>
        </RowGrid>
        <RowGrid>
          <GridCell><Field label="YouTube" value={sl.youtube ?? ''} onChangeText={(v) => updateSl({ youtube: v })} /></GridCell>
          <GridCell><Field label="Website" value={sl.website ?? ''} onChangeText={(v) => updateSl({ website: v })} keyboardType="url" /></GridCell>
        </RowGrid>
      </Block>

      <View className="h-px bg-[#151915] mx-5" />

      <Block num="03" title="Attendance">
        <SwitchRow label="Attendance Required" value={att.attendanceRequired ?? false} onValueChange={(v) => updateAtt({ attendanceRequired: v })} />
        <RowGrid>
          <GridCell><Field label="Late Mark (mins)" value={String(att.lateMarkAfterMinutes ?? '')} onChangeText={(v) => updateAtt({ lateMarkAfterMinutes: Number(v) })} keyboardType="numeric" /></GridCell>
          <GridCell><Field label="Half Day (mins)"  value={String(att.halfDayAfterMinutes ?? '')}  onChangeText={(v) => updateAtt({ halfDayAfterMinutes: Number(v) })}  keyboardType="numeric" /></GridCell>
        </RowGrid>
        <Field label="Min Working Hours" value={String(att.minimumWorkingHours ?? '')} onChangeText={(v) => updateAtt({ minimumWorkingHours: Number(v) })} keyboardType="numeric" />
        <Field label="Weekly Off Days"   value={(att.weeklyOffDays ?? []).join(', ')}  onChangeText={(v) => updateAtt({ weeklyOffDays: v.split(',').map((x: string) => x.trim()).filter(Boolean) })} placeholder="e.g. Saturday, Sunday" />
      </Block>

      <View className="h-px bg-[#151915] mx-5" />

      <Block num="04" title="Notes">
        <Field
          label="Notes"
          value={data.notes ?? ''}
          onChangeText={(v) => onChange({ notes: v })}
          placeholder="Additional notes about the trainer..."
          multiline
        />
      </Block>

    </ScrollView>
  );
}
