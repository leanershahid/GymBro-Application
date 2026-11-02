import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import { describeApiError, fieldErrorsFrom } from '../../../api/apiError';
import { ShopAddress, ShopAddressInput } from '../api/shop.types';
import { useSaveAddress } from '../api/storeQueries';
import { Field } from './ui';

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

export const isIndianPhone = (v: string) => /^(\+91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, ''));
export const isPin = (v: string) => /^[1-9]\d{5}$/.test(v.trim());

type Values = { fullName: string; phone: string; line1: string; line2: string; city: string; state: string; postalCode: string; label: string; isDefault: boolean };
type Errors = Partial<Record<keyof Values, string>> & { form?: string };

function validate(v: Values): Errors {
  const e: Errors = {};
  if (v.fullName.trim().length < 2) e.fullName = 'Enter the recipient’s full name.';
  if (!isIndianPhone(v.phone)) e.phone = 'Enter a 10-digit mobile number.';
  if (v.line1.trim().length < 3) e.line1 = 'Enter the house number and street.';
  if (!v.city.trim()) e.city = 'Enter the city.';
  if (!v.state) e.state = 'Choose a state.';
  if (!isPin(v.postalCode)) e.postalCode = 'Enter a 6-digit PIN code.';
  return e;
}

const SERVER_LABELS: Record<string, keyof Values> = {
  'full name': 'fullName', fullname: 'fullName', phone: 'phone', 'line 1': 'line1', line1: 'line1', city: 'city',
  state: 'state', 'postal code': 'postalCode', postalcode: 'postalCode', pin: 'postalCode',
};

/** Add / edit address sheet. `onSaved` gets the saved address. */
export default function AddressSheet({ visible, address, onClose, onSaved, defaultChecked }: {
  visible: boolean; address?: ShopAddress | null; onClose: () => void; onSaved?: (a: ShopAddress) => void; defaultChecked?: boolean;
}) {
  const { height } = useWindowDimensions();
  const save = useSaveAddress();
  const [v, setV] = useState<Values>(blank());
  const [errors, setErrors] = useState<Errors>({});
  const [statesOpen, setStatesOpen] = useState(false);

  function blank(): Values {
    return address
      ? { fullName: address.fullName, phone: address.phone, line1: address.line1, line2: address.line2 ?? '', city: address.city, state: address.state, postalCode: address.postalCode, label: address.label ?? '', isDefault: address.isDefault }
      : { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '', label: '', isDefault: !!defaultChecked };
  }

  // Reset the form every time the sheet opens.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) { setV(blank()); setErrors({}); setStatesOpen(false); }
  }

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV(x => ({ ...x, [k]: val }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  };

  const submit = () => {
    const found = validate(v);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    const body: ShopAddressInput = {
      fullName: v.fullName.trim(), phone: v.phone.replace(/[\s-]/g, '').replace(/^\+91/, ''), line1: v.line1.trim(),
      line2: v.line2.trim() || null, city: v.city.trim(), state: v.state, postalCode: v.postalCode.trim(), country: 'India',
      label: v.label.trim() || null, isDefault: v.isDefault,
    };
    save.mutate({ id: address?.id, body }, {
      onSuccess: a => { onSaved?.(a); onClose(); },
      onError: err => {
        const { message, errors: list } = describeApiError(err);
        const fields = fieldErrorsFrom(list, SERVER_LABELS as Record<string, string>);
        setErrors({ ...fields, form: Object.keys(fields).length ? undefined : message });
      },
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={address ? 'Edit address' : 'New delivery address'}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ maxHeight: height * 0.72 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: SP.xl, paddingBottom: SP.md }}>
          <Field label="Full name" autoComplete="name" value={v.fullName} onChangeText={t => set('fullName', t)} error={errors.fullName} />
          <Field label="Mobile number" keyboardType="phone-pad" autoComplete="tel" placeholder="98765 43210" maxLength={16} value={v.phone} onChangeText={t => set('phone', t)} error={errors.phone} />
          <Field label="House / flat, street" value={v.line1} onChangeText={t => set('line1', t)} error={errors.line1} />
          <Field label="Area, landmark" optional value={v.line2} onChangeText={t => set('line2', t)} />
          <View style={{ flexDirection: 'row', gap: SP.md }}>
            <Field style={{ flex: 1 }} label="City" value={v.city} onChangeText={t => set('city', t)} error={errors.city} />
            <Field style={{ flex: 1 }} label="PIN code" keyboardType="number-pad" maxLength={6} value={v.postalCode} onChangeText={t => set('postalCode', t.replace(/\D/g, ''))} error={errors.postalCode} />
          </View>

          <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>State</Text>
          <Pressable
            onPress={() => setStatesOpen(o => !o)}
            accessibilityRole="button"
            accessibilityLabel={`State: ${v.state || 'not chosen'}. ${statesOpen ? 'Close' : 'Open'} list`}
            accessibilityState={{ expanded: statesOpen }}
            style={{ minHeight: 48, borderRadius: R.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg, borderWidth: 1, borderColor: errors.state ? T.err : statesOpen ? T.brand : T.line }}
          >
            <Text style={{ flex: 1, color: v.state ? T.text : T.textFaint, fontSize: 15 }}>{v.state || 'Choose state'}</Text>
            <Feather name={statesOpen ? 'chevron-up' : 'chevron-down'} size={18} color={T.textSub} />
          </Pressable>
          {statesOpen && (
            <ScrollView nestedScrollEnabled style={{ maxHeight: 220, marginTop: 4, borderRadius: R.md, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg }}>
              {INDIAN_STATES.map(s => (
                <Pressable
                  key={s}
                  onPress={() => { set('state', s); setStatesOpen(false); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: v.state === s }}
                  accessibilityLabel={s}
                  style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: v.state === s ? withAlpha(T.brand, 0.12) : pressed ? T.bgInputActive : 'transparent' })}
                >
                  <Text style={{ color: v.state === s ? T.brand : T.text, fontSize: 14 }}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {errors.state && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 12, marginTop: 4 }}>{errors.state}</Text>}

          <Field style={{ marginTop: SP.md }} label="Label" optional placeholder="Home, Office, Gym…" maxLength={30} value={v.label} onChangeText={t => set('label', t)} />

          <Pressable
            onPress={() => set('isDefault', !v.isDefault)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: v.isDefault }}
            accessibilityLabel="Use as my default delivery address"
            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SP.md }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: v.isDefault ? T.brand : T.textFaint, backgroundColor: v.isDefault ? T.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {v.isDefault && <Feather name="check" size={14} color={T.onBrand} />}
            </View>
            <Text style={{ color: T.text, fontSize: 14 }}>Use as my default delivery address</Text>
          </Pressable>
          {errors.form && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 13, marginTop: SP.sm }}>{errors.form}</Text>}
        </ScrollView>
        <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.sm }}>
          <PrimaryButton label={address ? 'Save changes' : 'Save address'} onPress={submit} loading={save.isPending} />
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}
