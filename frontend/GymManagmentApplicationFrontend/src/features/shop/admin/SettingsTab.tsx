import React, { useState } from 'react';
import { Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { T, SP } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import Skeleton from '../../common/components/Skeleton';
import { useToast } from '../../common/components/Toast';
import { Field, RowGrid, GridCell } from '../../common/components/FormFields';
import { useApiAccess } from '../../access/context/AccessContext';
import { apiErrorText } from '../../../api/apiError';
import { useSaveShopSettings, useShopSettings } from '../api/adminQueries';
import { ShopSettings } from '../api/shop.types';
import { Card, ErrorView, decimalOnly } from './components/kit';

export default function SettingsTab() {
  const { data, isPending, isError, error, refetch } = useShopSettings();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 80 }}>
        {isPending ? <Skeleton rows={4} height={160} />
          : isError ? <ErrorView error={error} onRetry={refetch} />
          : <SettingsForm s={data} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type Form = Record<
  'name' | 'tagline' | 'gst' | 'free' | 'standard' | 'express' | 'standardDays' | 'expressDays' | 'returnDays' |
  'orderPrefix' | 'supportEmail' | 'supportPhone' | 'address' | 'businessHours', string>;

const toForm = (s: ShopSettings): Form => ({
  name: s.name, tagline: s.tagline ?? '',
  // Stored as a fraction (0.18); shown as a percent (18).
  gst: String(Math.round(s.taxRate * 10000) / 100),
  free: String(s.freeShippingThreshold), standard: String(s.standardShipping), express: String(s.expressShipping),
  standardDays: String(s.standardDeliveryDays), expressDays: String(s.expressDeliveryDays), returnDays: String(s.returnDays),
  orderPrefix: s.orderPrefix ?? '', supportEmail: s.supportEmail ?? '', supportPhone: s.supportPhone ?? '',
  address: s.address ?? '', businessHours: s.businessHours ?? '',
});

function SettingsForm({ s }: { s: ShopSettings }) {
  const { canEdit } = useApiAccess('shop');
  const save = useSaveShopSettings();
  const toast = useToast();
  const [v, setV] = useState<Form>(() => toForm(s));
  const [errors, setErrors] = useState<Partial<Form>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const set = (k: keyof Form) => (t: string) => { setV(x => ({ ...x, [k]: t })); setErrors(e => ({ ...e, [k]: undefined })); };
  const dec = (k: keyof Form) => (t: string) => set(k)(decimalOnly(t));
  const int = (k: keyof Form) => (t: string) => set(k)(t.replace(/\D/g, ''));

  const submit = () => {
    const gst = Number(v.gst);
    const found: Partial<Form> = {
      name: v.name.trim().length < 2 ? 'Enter the shop name.' : undefined,
      gst: v.gst === '' || !(gst >= 0 && gst <= 100) ? 'Enter a GST rate between 0 and 100.' : undefined,
      orderPrefix: v.orderPrefix && !/^[A-Z0-9-]{1,10}$/i.test(v.orderPrefix) ? 'Up to 10 letters, numbers or dashes.' : undefined,
      supportEmail: v.supportEmail && !/^\S+@\S+\.\S+$/.test(v.supportEmail.trim()) ? 'Enter a valid email.' : undefined,
    };
    (['free', 'standard', 'express', 'standardDays', 'expressDays', 'returnDays'] as const).forEach(k => {
      if (v[k] === '' || Number.isNaN(Number(v[k]))) found[k] = 'Required.';
    });
    setErrors(found);
    setServerError(null);
    if (Object.values(found).some(Boolean)) return;
    save.mutate({
      ...s,
      name: v.name.trim(), tagline: v.tagline.trim() || null, taxRate: Math.round(gst * 100) / 10000,
      freeShippingThreshold: Number(v.free), standardShipping: Number(v.standard), expressShipping: Number(v.express),
      standardDeliveryDays: Number(v.standardDays), expressDeliveryDays: Number(v.expressDays), returnDays: Number(v.returnDays),
      orderPrefix: v.orderPrefix.trim().toUpperCase() || undefined,
      supportEmail: v.supportEmail.trim() || null, supportPhone: v.supportPhone.trim() || null,
      address: v.address.trim() || null, businessHours: v.businessHours.trim() || null,
    }, {
      onSuccess: () => toast.show({ message: 'Shop settings saved' }),
      onError: e => setServerError(apiErrorText(e)),
    });
  };

  const ed = canEdit;
  return (
    <>
      <Card title="Shop">
        <Field label="Shop name" value={v.name} onChangeText={set('name')} error={errors.name} editable={ed} />
        <Field label="Tagline (optional)" value={v.tagline} onChangeText={set('tagline')} editable={ed} />
        <RowGrid>
          <GridCell><Field label="GST (%)" value={v.gst} onChangeText={dec('gst')} keyboardType="decimal-pad" error={errors.gst} editable={ed} /></GridCell>
          <GridCell><Field label="Order prefix" value={v.orderPrefix} onChangeText={t => set('orderPrefix')(t.toUpperCase())} autoCapitalize="characters" error={errors.orderPrefix} editable={ed} /></GridCell>
        </RowGrid>
        <Text style={{ color: T.textFaint, fontSize: 12, marginTop: -8 }}>Prices include GST at this rate. New order numbers start with the prefix.</Text>
      </Card>

      <Card title="Delivery">
        <Field label="Free delivery from (₹)" value={v.free} onChangeText={dec('free')} keyboardType="decimal-pad" error={errors.free} editable={ed} />
        <RowGrid>
          <GridCell><Field label="Standard fee (₹)" value={v.standard} onChangeText={dec('standard')} keyboardType="decimal-pad" error={errors.standard} editable={ed} /></GridCell>
          <GridCell><Field label="Express fee (₹)" value={v.express} onChangeText={dec('express')} keyboardType="decimal-pad" error={errors.express} editable={ed} /></GridCell>
        </RowGrid>
        <RowGrid>
          <GridCell><Field label="Standard (days)" value={v.standardDays} onChangeText={int('standardDays')} keyboardType="number-pad" error={errors.standardDays} editable={ed} /></GridCell>
          <GridCell><Field label="Express (days)" value={v.expressDays} onChangeText={int('expressDays')} keyboardType="number-pad" error={errors.expressDays} editable={ed} /></GridCell>
        </RowGrid>
        <Field label="Returns accepted within (days)" value={v.returnDays} onChangeText={int('returnDays')} keyboardType="number-pad" error={errors.returnDays} editable={ed} />
      </Card>

      <Card title="Support">
        <Field label="Support email" value={v.supportEmail} onChangeText={set('supportEmail')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={errors.supportEmail} editable={ed} />
        <Field label="Support phone" value={v.supportPhone} onChangeText={set('supportPhone')} keyboardType="phone-pad" editable={ed} />
        <Field label="Address" value={v.address} onChangeText={set('address')} multiline editable={ed} />
        <Field label="Business hours" value={v.businessHours} onChangeText={set('businessHours')} placeholder="Mon–Sat, 9am–8pm" editable={ed} />
      </Card>

      {!!serverError && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 13, marginBottom: SP.md }}>{serverError}</Text>}
      {ed && <PrimaryButton label="Save settings" onPress={submit} loading={save.isPending} />}
    </>
  );
}
