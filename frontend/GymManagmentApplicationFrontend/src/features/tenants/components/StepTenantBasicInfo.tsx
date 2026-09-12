import React from 'react';
import { ScrollView, Text } from 'react-native';
import { TenantPayload, TenantPlan } from '../types/tenant.types';
import { Field, RowGrid, GridCell } from '../../trainers/components/FormFields';

export type TenantBasicInfoErrors = {
  name?: string;
  slug?: string;
  logoUrl?: string;
  primaryColor?: string;
};

interface Props {
  data: Partial<TenantPayload>;
  onChange: (fields: Partial<TenantPayload>) => void;
  errors?: TenantBasicInfoErrors;
}

function Section({ title }: { title: string }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: '#AAAAAA', marginBottom: 12, marginTop: 4 }}>
      {title}
    </Text>
  );
}

export default function StepTenantBasicInfo({ data, onChange, errors = {} }: Props) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 6 }}>
        Basic Info
      </Text>
      <Text style={{ fontSize: 14, color: '#AAAAAA', lineHeight: 20, marginBottom: 28 }}>
        Organisation name and identity
      </Text>

      <Section title="Identity" />
      <Field
        label="Tenant Name"
        value={data.name ?? ''}
        onChangeText={(v) => onChange({ name: v })}
        placeholder="e.g. FitLife Corp"
        error={errors.name}
      />
      <Field
        label="Slug"
        value={data.slug ?? ''}
        onChangeText={(v) => onChange({ slug: v.toLowerCase().replace(/\s+/g, '-') })}
        placeholder="e.g. fitlife-corp"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.slug}
      />

      <Section title="Branding" />
      <Field
        label="Logo URL"
        value={data.logoUrl ?? ''}
        onChangeText={(v) => onChange({ logoUrl: v })}
        placeholder="https://…"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.logoUrl}
      />
      <Field
        label="Primary Colour (hex)"
        value={data.primaryColor ?? ''}
        onChangeText={(v) => onChange({ primaryColor: v })}
        placeholder="e.g. #7ED321"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.primaryColor}
      />
    </ScrollView>
  );
}
