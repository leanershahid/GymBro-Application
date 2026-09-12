import React from 'react';
import { ScrollView, Text } from 'react-native';
import { BranchPayload } from '../types/branch.types';
import { Field, RowGrid, GridCell } from '../../trainers/components/FormFields';

export type BranchLocationErrors = {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
};

interface Props {
  data: Partial<BranchPayload>;
  onChange: (fields: Partial<BranchPayload>) => void;
  errors?: BranchLocationErrors;
}

function Section({ title }: { title: string }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: '#AAAAAA', marginBottom: 12, marginTop: 4 }}>
      {title}
    </Text>
  );
}

export default function StepBranchLocation({ data, onChange, errors = {} }: Props) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 6 }}>
        Location
      </Text>
      <Text style={{ fontSize: 14, color: '#AAAAAA', lineHeight: 20, marginBottom: 28 }}>
        Physical address and region details
      </Text>

      <Section title="Address" />
      <Field
        label="Street Address"
        value={data.address ?? ''}
        onChangeText={(v) => onChange({ address: v })}
        placeholder="e.g. 12 Main Street"
        error={errors.address}
      />
      <RowGrid>
        <GridCell>
          <Field
            label="City"
            value={data.city ?? ''}
            onChangeText={(v) => onChange({ city: v })}
            placeholder="e.g. Mumbai"
            error={errors.city}
          />
        </GridCell>
        <GridCell>
          <Field
            label="ZIP / Pin"
            value={data.zip ?? ''}
            onChangeText={(v) => onChange({ zip: v })}
            keyboardType="numeric"
            placeholder="400001"
            error={errors.zip}
          />
        </GridCell>
      </RowGrid>

      <Section title="Region" />
      <RowGrid>
        <GridCell>
          <Field
            label="State"
            value={data.state ?? ''}
            onChangeText={(v) => onChange({ state: v })}
            placeholder="Maharashtra"
            error={errors.state}
          />
        </GridCell>
        <GridCell>
          <Field
            label="Country"
            value={data.country ?? ''}
            onChangeText={(v) => onChange({ country: v })}
            placeholder="India"
            error={errors.country}
          />
        </GridCell>
      </RowGrid>
    </ScrollView>
  );
}
