import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import LoadingState from '../../common/components/LoadingState';
import PrimaryButton from '../../common/components/PrimaryButton';
import StatusPill from '../../common/components/StatusPill';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import { Field, SwitchRow } from '../../trainers/components/FormFields';
import { describeApiError, apiErrorText } from '../../../api/apiError';
import { useGateway, useSaveGateway, useRemoveGateway } from '../api/billingQueries';
import { Card, KeyValue, Note } from './billingUi';
import { T, SP } from '../../../theme';

/** Razorpay connect form. The server checks the keys with Razorpay before saving. */
export default function GatewaySettings() {
  const toast = useToast();
  const { data, isLoading, error, refetch } = useGateway();
  const save = useSaveGateway();
  const remove = useRemoveGateway();

  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setKeyId(data.keyId ?? '');
    setIsActive(data.configured ? data.isActive : true);
    setKeySecret('');
  }, [data]);

  if (isLoading) return <LoadingState label="Loading payment settings…" />;
  if (error) {
    return (
      <EmptyState icon="alert-triangle" tone="error" title="Couldn't load settings"
        subtitle={describeApiError(error).message} action={{ label: 'Try again', onPress: () => refetch() }} />
    );
  }
  const configured = !!data?.configured;

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!/^rzp_(live|test)_/.test(keyId.trim())) errs.keyId = 'The Key Id starts with rzp_live_ or rzp_test_.';
    if (!configured && !keySecret.trim()) errs.keySecret = 'Enter the Key Secret.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    save.mutate(
      { keyId, keySecret, isActive },
      {
        onSuccess: () => { setKeySecret(''); toast.show({ message: 'Razorpay connected — keys verified.' }); },
        onError: e => Alert.alert('Keys not saved', apiErrorText(e)),
      },
    );
  };

  const disconnect = () =>
    Alert.alert('Disconnect Razorpay?', 'Members won’t be able to pay online until you connect again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: () => remove.mutate(undefined, {
          onSuccess: () => { setKeyId(''); setKeySecret(''); toast.show({ message: 'Razorpay disconnected.' }); },
          onError: e => Alert.alert('Couldn’t disconnect', apiErrorText(e)),
        }),
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }} keyboardShouldPersistTaps="handled">
      <Card
        title="Online payments"
        right={
          <StatusPill
            label={!configured ? 'Not connected' : data?.isActive ? 'Connected' : 'Paused'}
            tone={!configured ? 'neutral' : data?.isActive ? 'ok' : 'warn'}
            dot
          />
        }
      >
        <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19, marginBottom: SP.sm }}>
          Connect your Razorpay account so members can pay their invoices from the app. Money goes straight to your account.
        </Text>
        {configured && <KeyValue label="Key Id" value={data?.keyId ?? '—'} />}
      </Card>

      <Note text="Find the keys in Razorpay Dashboard → Account & Settings → API Keys. Use rzp_test_ keys to try it out first." />

      <Field label="Key Id" value={keyId} onChangeText={v => { setKeyId(v); setErrors({}); }}
        placeholder="rzp_live_…" autoCapitalize="none" autoCorrect={false} error={errors.keyId} />
      <Field label="Key Secret" value={keySecret} onChangeText={v => { setKeySecret(v); setErrors({}); }}
        placeholder={configured ? 'Leave blank to keep the saved secret' : ''} autoCapitalize="none" autoCorrect={false}
        secureTextEntry error={errors.keySecret} />
      <SwitchRow label="Accept online payments" value={isActive} onValueChange={setIsActive}
        description="Turn off to pause online payments without removing the keys." />

      <PrimaryButton label={configured ? 'Save changes' : 'Connect Razorpay'} icon="link" onPress={submit} loading={save.isPending} />
      {configured && (
        <View style={{ marginTop: SP.md }}>
          <PrimaryButton label="Disconnect" icon="x-circle" variant="danger" onPress={disconnect} loading={remove.isPending} />
        </View>
      )}
    </ScrollView>
  );
}
