import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { BranchPayload } from '../types/branch.types';
import { Field, RowGrid, GridCell } from '../../trainers/components/FormFields';
import { T } from '../../../theme';
import UploadField from '../../common/components/UploadField';

export type BranchBasicInfoErrors = {
  name?: string;
  code?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
};

interface Props {
  data: Partial<BranchPayload>;
  onChange: (fields: Partial<BranchPayload>) => void;
  errors?: BranchBasicInfoErrors;
  /** Edit mode: the server does not allow changing a branch's code after creation. */
  codeLocked?: boolean;
}

function Section({ title }: { title: string }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: T.textSub, marginBottom: 12, marginTop: 4 }}>
      {title}
    </Text>
  );
}

export default function StepBranchBasicInfo({ data, onChange, errors = {}, codeLocked = false }: Props) {
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
        Branch identity and contact details
      </Text>

      <Section title="Identity" />
      <Field
        label="Branch Name"
        value={data.name ?? ''}
        onChangeText={(v) => onChange({ name: v })}
        placeholder="e.g. Downtown Gym"
        error={errors.name}
      />
      <Field
        label="Branch Code"
        value={data.code ?? ''}
        onChangeText={(v) => onChange({ code: v })}
        placeholder="e.g. DT-001"
        autoCapitalize="characters"
        error={errors.code}
        editable={!codeLocked}
      />

      <Section title="Contact" />
      <Field
        label="Phone"
        value={data.phone ?? ''}
        onChangeText={(v) => onChange({ phone: v })}
        keyboardType="phone-pad"
        error={errors.phone}
      />
      <Field
        label="Email"
        value={data.email ?? ''}
        onChangeText={(v) => onChange({ email: v })}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
      />

      <Section title="Media" />
      <UploadField
        label="Logo"
        value={data.logoUrl}
        onChange={(url) => onChange({ logoUrl: url })}
        folder="logos"
        hint="Square image, PNG or JPG"
        error={errors.logoUrl}
      />
    </ScrollView>
  );
}
