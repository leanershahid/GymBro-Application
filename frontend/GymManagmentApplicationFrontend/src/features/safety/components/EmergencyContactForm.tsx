import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { T, SP } from '../../../theme';
import { Field } from '../../common/components/FormFields';
import ChipSelect from '../../common/components/ChipSelect';
import PrimaryButton from '../../common/components/PrimaryButton';
import { describeApiError, fieldErrorsFrom } from '../../../api/apiError';
import { useSaveEmergencyContact } from '../api/safetyQueries';
import { EmergencyContact } from '../api/safety.types';

export const RELATIONSHIPS = ['Partner', 'Parent', 'Sibling', 'Child', 'Friend', 'Other'] as const;

/** Structured emergency contact (name · relationship · phone). Used in the flow and in Profile. */
export function useEmergencyForm(initial: EmergencyContact | null | undefined) {
  const [name, setName] = useState(initial?.name ?? '');
  const [relationship, setRelationship] = useState<string>(initial?.relationship ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const save = useSaveEmergencyContact();

  const submit = (onSaved: (c: EmergencyContact) => void) => {
    setErrors({}); setFormError(null);
    const local: Record<string, string> = {};
    if (name.trim().length < 2) local.name = "Enter your contact's name.";
    if (phone.replace(/\D/g, '').length < 6) local.phone = 'Enter a phone number we can call.';
    if (Object.keys(local).length) { setErrors(local); return; }
    save.mutate({ name: name.trim(), relationship: relationship.trim() || null, phone: phone.trim() }, {
      onSuccess: onSaved,
      onError: e => {
        const d = describeApiError(e);
        const f = fieldErrorsFrom(d.errors.length ? d.errors : [d.message], { name: 'name', phone: 'phone', relationship: 'relationship' });
        if (Object.keys(f).length) setErrors(f); else setFormError(d.message);
      },
    });
  };

  return { name, setName, relationship, setRelationship, phone, setPhone, errors, formError, submit, saving: save.isPending };
}

export function EmergencyFields({ form }: { form: ReturnType<typeof useEmergencyForm> }) {
  const chips = RELATIONSHIPS.map(r => ({ value: r as string, label: r }));
  return (
    <View>
      <Field label="Full name" value={form.name} onChangeText={form.setName} placeholder="e.g. Priya Shah" autoCapitalize="words" autoCorrect={false} error={form.errors.name} />
      <View style={{ marginBottom: SP.sm }}>
        <ChipSelect<string> label="Relationship" options={chips} value={form.relationship || null} onChange={form.setRelationship} />
      </View>
      <Field label="Phone number" value={form.phone} onChangeText={form.setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" autoCapitalize="none" autoCorrect={false} error={form.errors.phone} />
      {!!form.formError && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 13 }}>{form.formError}</Text>}
    </View>
  );
}

export function EmergencySaveButton({ form, onSaved, label = 'Save emergency contact' }: {
  form: ReturnType<typeof useEmergencyForm>; onSaved: (c: EmergencyContact) => void; label?: string;
}) {
  return <PrimaryButton label={label} icon="check" onPress={() => form.submit(onSaved)} loading={form.saving} />;
}
