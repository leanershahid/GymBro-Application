import React from 'react';
import { ScrollView, Text } from 'react-native';
import { TenantPayload, TenantPlan } from '../types/tenant.types';
import { Field, RowGrid, GridCell } from '../../trainers/components/FormFields';
import { T } from '../../../theme';
import UploadField from '../../common/components/UploadField';

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
  /** Edit mode: the server does not allow changing a tenant's slug after creation. */
  slugLocked?: boolean;
}

function Section({ title }: { title: string }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: T.textSub, marginBottom: 12, marginTop: 4 }}>
      {title}
    </Text>
  );
}

export default function StepTenantBasicInfo({ data, onChange, errors = {}, slugLocked = false }: Props) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 30, fontWeight: '800', color: T.text, letterSpacing: -0.5, marginBottom: 6 }}>
        Basic Info
      </Text>
      <Text style={{ fontSize: 14, color: T.textSub, lineHeight: 20, marginBottom: 28 }}>
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
        editable={!slugLocked}
      />

      <Section title="Branding" />
      <UploadField
        label="Logo"
        value={data.logoUrl}
        onChange={(url) => onChange({ logoUrl: url })}
        folder="logos"
        hint="Square image, PNG or JPG"
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
