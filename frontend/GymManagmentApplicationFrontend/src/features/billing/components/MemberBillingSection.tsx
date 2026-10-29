import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import StatusPill from '../../common/components/StatusPill';
import LoadingState from '../../common/components/LoadingState';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import { useToast } from '../../common/components/Toast';
import { Field } from '../../trainers/components/FormFields';
import { describeApiError, apiErrorText } from '../../../api/apiError';
import {
  useSubscriptions, useInvoices, useRenewSubscription, useFreezeSubscription,
  useUnfreezeSubscription, useCancelSubscription,
} from '../api/billingQueries';
import { Invoice, Subscription } from '../types/billing.types';
import InvoiceSheet from './InvoiceSheet';
import ChargeOptionsFields, {
  ChargeDraft, emptyChargeDraft, chargeOptionsFrom, validateChargeDraft,
} from './ChargeOptionsFields';
import {
  Card, Divider, SmallButton, fmtMoney, fmtDate, membershipLabel, membershipTone, invoiceTone, invoiceLabel,
} from './billingUi';
import { T, SP } from '../../../theme';

export interface MemberBillingSectionProps {
  memberId: number;
  memberName?: string;
  /** Shows a "New" button in the memberships card when provided. */
  onNewMembership?: () => void;
}

/** Compact billing block for the member detail page: memberships + unpaid invoices. */
export default function MemberBillingSection({ memberId, memberName, onNewMembership }: MemberBillingSectionProps) {
  const toast = useToast();
  const subs = useSubscriptions(memberId, 1, 20);
  const unpaid = useInvoices('unpaid', 1, 20, memberId);
  const freeze = useFreezeSubscription();
  const unfreeze = useUnfreezeSubscription();
  const cancel = useCancelSubscription();

  const [renewing, setRenewing] = useState<Subscription | null>(null);
  const [freezing, setFreezing] = useState<Subscription | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const doUnfreeze = (s: Subscription) =>
    unfreeze.mutate(s.id, {
      onSuccess: () => toast.show({ message: `${s.planName} reactivated — frozen days added back.` }),
      onError: e => Alert.alert('Couldn’t unfreeze', apiErrorText(e)),
    });

  const confirmCancel = (s: Subscription) =>
    Alert.alert('Cancel membership?', `${s.planName} for ${memberName ?? 'this member'} ends now. This can't be undone.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel membership', style: 'destructive',
        onPress: () => cancel.mutate(s.id, {
          onSuccess: () => toast.show({ message: 'Membership cancelled.' }),
          onError: e => Alert.alert('Couldn’t cancel', apiErrorText(e)),
        }),
      },
    ]);

  const subItems = subs.data?.items ?? [];
  const invItems = unpaid.data?.items ?? [];
  const owed = invItems.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.currency]: (acc[i.currency] ?? 0) + i.balance }), {});

  return (
    <View>
      <Card
        title="Memberships"
        right={onNewMembership ? <SmallButton icon="plus" label="New" onPress={onNewMembership} /> : undefined}
      >
        {subs.isLoading ? <LoadingState label="Loading memberships…" /> : subs.error ? (
          <ErrorLine error={subs.error} onRetry={() => subs.refetch()} />
        ) : subItems.length === 0 ? (
          <Text style={{ color: T.textFaint, fontSize: 13, paddingVertical: SP.md }}>No memberships yet.</Text>
        ) : subItems.map((s, idx) => {
          const st = s.status.toLowerCase();
          return (
            <View key={s.id}>
              {idx > 0 && <Divider />}
              <View style={{ paddingVertical: SP.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                  <Text style={{ flex: 1, color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{s.planName}</Text>
                  <StatusPill label={membershipLabel(s.status)} tone={membershipTone(s.status)} dot />
                </View>
                <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 3 }}>
                  {fmtDate(s.startDate)} → {fmtDate(s.endDate)} · {fmtMoney(s.price, s.currency)}
                </Text>
                {st !== 'cancelled' && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.sm }}>
                    {st !== 'paused' && <SmallButton icon="refresh-cw" label="Renew" onPress={() => setRenewing(s)} />}
                    {st === 'active' && <SmallButton icon="pause-circle" label="Freeze" tone={T.sky} onPress={() => setFreezing(s)} />}
                    {st === 'paused' && (
                      <SmallButton icon="play-circle" label="Unfreeze" tone={T.sky} onPress={() => doUnfreeze(s)}
                        disabled={unfreeze.isPending} />
                    )}
                    <SmallButton icon="x-circle" label="Cancel" tone={T.err} onPress={() => confirmCancel(s)} disabled={cancel.isPending} />
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </Card>

      <Card
        title="Unpaid invoices"
        right={invItems.length ? (
          <Text style={{ color: T.brandGold, fontSize: 13, fontWeight: '800' }}>
            {Object.entries(owed).map(([c, v]) => fmtMoney(v, c)).join(' + ')}
          </Text>
        ) : undefined}
      >
        {unpaid.isLoading ? <LoadingState label="Loading invoices…" /> : unpaid.error ? (
          <ErrorLine error={unpaid.error} onRetry={() => unpaid.refetch()} />
        ) : invItems.length === 0 ? (
          <Text style={{ color: T.textFaint, fontSize: 13, paddingVertical: SP.md }}>Nothing due.</Text>
        ) : invItems.map((inv, idx) => (
          <View key={inv.id}>
            {idx > 0 && <Divider />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: SP.md }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                  <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{inv.invoiceNo}</Text>
                  <StatusPill label={invoiceLabel(inv)} tone={invoiceTone(invoiceLabel(inv))} />
                </View>
                <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                  {inv.items[0]?.description ?? 'Invoice'}{inv.dueDate ? ` · Due ${fmtDate(inv.dueDate)}` : ''}
                </Text>
                <Text style={{ color: T.brandGold, fontSize: 13, fontWeight: '700', marginTop: 3 }}>
                  {fmtMoney(inv.balance, inv.currency)} due of {fmtMoney(inv.total, inv.currency)}
                </Text>
              </View>
              <SmallButton icon="plus-circle" label="Pay" onPress={() => setInvoice(inv)} />
            </View>
          </View>
        ))}
      </Card>

      <RenewSheet sub={renewing} onClose={() => setRenewing(null)} />
      <FreezeSheet
        sub={freezing}
        onClose={() => setFreezing(null)}
        onSubmit={(s, reason) => freeze.mutate({ id: s.id, reason }, {
          onSuccess: () => { toast.show({ message: `${s.planName} frozen.` }); setFreezing(null); },
          onError: e => Alert.alert('Couldn’t freeze', apiErrorText(e)),
        })}
        loading={freeze.isPending}
      />
      <InvoiceSheet invoice={invoice} onClose={() => setInvoice(null)} />
    </View>
  );
}

function ErrorLine({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <View style={{ paddingVertical: SP.md, gap: SP.sm, alignItems: 'flex-start' }}>
      <Text style={{ color: T.err, fontSize: 13 }}>{describeApiError(error).message}</Text>
      <SmallButton icon="rotate-cw" label="Try again" tone={T.textSub} onPress={onRetry} />
    </View>
  );
}

function RenewSheet({ sub, onClose }: { sub: Subscription | null; onClose: () => void }) {
  const toast = useToast();
  const renew = useRenewSubscription();
  const [draft, setDraft] = useState<ChargeDraft>(emptyChargeDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => { setDraft(emptyChargeDraft()); setErrors({}); }, [sub?.id]);

  const submit = () => {
    if (!sub) return;
    const errs = validateChargeDraft(draft, sub.price);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    renew.mutate(
      { id: sub.id, options: chargeOptionsFrom(draft) },
      {
        onSuccess: r => {
          toast.show({ message: `${sub.planName} renewed${r?.endDate ? ` until ${fmtDate(r.endDate)}` : ''}.` });
          onClose();
        },
        onError: e => Alert.alert('Not renewed', apiErrorText(e)),
      },
    );
  };

  return (
    <BottomSheet visible={!!sub} onClose={onClose} title="Renew membership" leftAction={{ label: 'Cancel', onPress: onClose }}>
      {sub && (
        <ScrollView style={{ maxHeight: 620 }} contentContainerStyle={{ padding: SP.xl }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>
            Extends {sub.planName} by one more cycle{sub.endDate ? ` from ${fmtDate(sub.endDate)}` : ''} and raises an invoice.
          </Text>
          <ChargeOptionsFields draft={draft} onChange={setDraft} price={sub.price} currency={sub.currency} errors={errors} />
          <PrimaryButton label="Renew" icon="refresh-cw" onPress={submit} loading={renew.isPending} />
        </ScrollView>
      )}
    </BottomSheet>
  );
}

function FreezeSheet({ sub, onClose, onSubmit, loading }: {
  sub: Subscription | null; onClose: () => void; onSubmit: (s: Subscription, reason: string) => void; loading: boolean;
}) {
  const [reason, setReason] = useState('');
  React.useEffect(() => setReason(''), [sub?.id]);
  return (
    <BottomSheet visible={!!sub} onClose={onClose} title="Freeze membership" leftAction={{ label: 'Cancel', onPress: onClose }}>
      {sub && (
        <View style={{ padding: SP.xl }}>
          <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>
            {sub.planName} pauses until you unfreeze it; the paused days are added back to the end date.
          </Text>
          <Field label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="e.g. Travelling, injury" />
          <PrimaryButton label="Freeze" icon="pause-circle" onPress={() => onSubmit(sub, reason)} loading={loading} />
        </View>
      )}
    </BottomSheet>
  );
}
