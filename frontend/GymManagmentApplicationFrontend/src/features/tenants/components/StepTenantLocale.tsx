import React from 'react';
import { ScrollView, Text } from 'react-native';
import { TenantPayload } from '../types/tenant.types';
import { Field, RowGrid, GridCell } from '../../trainers/components/FormFields';

export type TenantLocaleErrors = {
  timezone?: string;
  locale?: string;
  currency?: string;
  customDomain?: string;
};

interface Props {
  data: Partial<TenantPayload>;
  onChange: (fields: Partial<TenantPayload>) => void;
  errors?: TenantLocaleErrors;
}

function Section({ title }: { title: string }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: '#AAAAAA', marginBottom: 12, marginTop: 4 }}>
      {title}
    </Text>
  );
}

export default function StepTenantLocale({ data, onChange, errors = {} }: Props) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 6 }}>
        Locale
      </Text>
      <Text style={{ fontSize: 14, color: '#AAAAAA', lineHeight: 20, marginBottom: 28 }}>
        Regional settings and custom domain
      </Text>

      <Section title="Regional" />
      <Field
        label="Timezone"
        value={data.timezone ?? ''}
        onChangeText={(v) => onChange({ timezone: v })}
        placeholder="e.g. Asia/Kolkata"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.timezone}
      />
      <RowGrid>
        <GridCell>
          <Field
            label="Locale"
            value={data.locale ?? ''}
            onChangeText={(v) => onChange({ locale: v })}
            placeholder="e.g. en-IN"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.locale}
          />
        </GridCell>
        <GridCell>
          <Field
            label="Currency"
            value={data.currency ?? ''}
            onChangeText={(v) => onChange({ currency: v.toUpperCase() })}
            placeholder="e.g. INR"
            autoCapitalize="characters"
            autoCorrect={false}
            error={errors.currency}
          />
        </GridCell>
      </RowGrid>

      <Section title="Domain" />
      <Field
        label="Custom Domain"
        value={data.customDomain ?? ''}
        onChangeText={(v) => onChange({ customDomain: v })}
        placeholder="e.g. gym.fitlife.com"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.customDomain}
      />
    </ScrollView>
  );
}
