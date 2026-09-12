import React from 'react';
import { ScrollView, Text } from 'react-native';
import { BranchPayload } from '../types/branch.types';
import { Field, RowGrid, GridCell } from '../../trainers/components/FormFields';

export type BranchSettingsErrors = {
  timezone?: string;
  capacity?: string;
  tenantId?: string;
};

interface Props {
  data: Partial<BranchPayload>;
  onChange: (fields: Partial<BranchPayload>) => void;
  errors?: BranchSettingsErrors;
}

function Section({ title }: { title: string }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: '#AAAAAA', marginBottom: 12, marginTop: 4 }}>
      {title}
    </Text>
  );
}

export default function StepBranchSettings({ data, onChange, errors = {} }: Props) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 6 }}>
        Settings
      </Text>
      <Text style={{ fontSize: 14, color: '#AAAAAA', lineHeight: 20, marginBottom: 28 }}>
        Capacity, timezone and tenant assignment
      </Text>

      <Section title="Operations" />
      <Field
        label="Capacity (members)"
        value={data.capacity ? String(data.capacity) : ''}
        onChangeText={(v) => onChange({ capacity: Number(v) || 0 })}
        keyboardType="numeric"
        placeholder="e.g. 200"
        error={errors.capacity}
      />
      <Field
        label="Timezone"
        value={data.timezone ?? ''}
        onChangeText={(v) => onChange({ timezone: v })}
        placeholder="e.g. Asia/Kolkata"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.timezone}
      />

      <Section title="Tenant" />
      <Field
        label="Tenant ID"
        value={data.tenantId ? String(data.tenantId) : ''}
        onChangeText={(v) => onChange({ tenantId: Number(v) || 0 })}
        keyboardType="numeric"
        placeholder="e.g. 1"
        error={errors.tenantId}
      />
    </ScrollView>
  );
}
