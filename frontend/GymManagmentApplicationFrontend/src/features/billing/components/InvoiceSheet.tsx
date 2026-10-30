import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import BottomSheet from '../../common/components/BottomSheet';
import StatusPill from '../../common/components/StatusPill';
import PrimaryButton from '../../common/components/PrimaryButton';
import { useToast } from '../../common/components/Toast';
import { Field } from '../../trainers/components/FormFields';
import { apiErrorText } from '../../../api/apiError';
import {
  useInvoice, useChargePayment, useMarkInvoicePaid, useSendInvoice, useSendPaymentReminder,
} from '../api/billingQueries';
import { Invoice, PayMethod } from '../types/billing.types';
import {
  fmtMoney, fmtDate, invoiceTone, invoiceLabel, KeyValue, Divider, SmallButton, MethodChips, openInvoicePdf, toNumber, round2,
} from './billingUi';
import { T, SP } from '../../../theme';

export interface InvoiceSheetProps {
  /** The invoice to show; null hides the sheet. Fresh data is fetched by id while open. */
  invoice: Invoice | null;
  onClose: () => void;
  /** Shows a "View member" link when provided. */
  onOpenMember?: (memberId: number) => void;
}

type Mode = 'detail' | 'pay' | 'markPaid' | 'email' | 'remind';

/** Invoice detail with desk actions: record payment, mark paid, email, PDF, reminder. */
export default function InvoiceSheet({ invoice, onClose, onOpenMember }: InvoiceSheetProps) {
  const toast = useToast();
  const { data: fresh } = useInvoice(invoice?.id ?? null);
  const inv = fresh ?? invoice;

  const [mode, setMode] = useState<Mode>('detail');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayMethod>('cash');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | undefined>();

  const charge = useChargePayment();
  const markPaid = useMarkInvoicePaid();
  const send = useSendInvoice();
  const remind = useSendPaymentReminder();

  // Reset the form whenever another invoice is opened.
  useEffect(() => {
    setMode('detail'); setMethod('cash'); setReference(''); setMessage(''); setError(undefined);
    setAmount(invoice ? String(round2(invoice.balance)) : '');
  }, [invoice?.id]);

  if (!inv) return <BottomSheet visible={false} onClose={onClose} title="Invoice"><View /></BottomSheet>;

  const cur = inv.currency;
  const status = inv.status.toLowerCase();
  const hasBalance = inv.balance > 0 && status !== 'refunded' && status !== 'void';
  const back = () => { setMode('detail'); setError(undefined); };

  const startPay = () => { setAmount(String(round2(inv.balance))); setReference(''); setError(undefined); setMode('pay'); };

  const submitPay = () => {
    const amt = toNumber(amount);
    if (amt <= 0) return setError('Enter an amount above zero.');
    if (amt > inv.balance + 0.001) return setError(`That's more than the balance (${fmtMoney(inv.balance, cur)}).`);
    charge.mutate(
      { invoiceId: inv.id, memberId: inv.memberId, amount: amt, method, reference },
      {
        onSuccess: () => { toast.show({ message: `Payment of ${fmtMoney(amt, cur)} recorded.` }); back(); },
        onError: e => Alert.alert('Payment not recorded', apiErrorText(e)),
      },
    );
  };

  const submitMarkPaid = () =>
    markPaid.mutate(
      { id: inv.id, method, reference },
      {
        onSuccess: () => { toast.show({ message: `${inv.invoiceNo} marked as paid.` }); back(); },
        onError: e => Alert.alert('Couldn’t mark as paid', apiErrorText(e)),
      },
    );

  const submitEmail = () =>
    send.mutate(
      { id: inv.id, message },
      {
        onSuccess: m => { toast.show({ message: m || 'Invoice emailed.' }); back(); },
        onError: e => Alert.alert('Email not sent', apiErrorText(e)),
      },
    );

  const submitRemind = () =>
    remind.mutate(
      { memberId: inv.memberId, message },
      {
        onSuccess: m => { toast.show({ message: m || 'Reminder sent.' }); back(); },
        onError: e => Alert.alert('Reminder not sent', apiErrorText(e)),
      },
    );

  const title =
    mode === 'pay' ? 'Record payment' :
    mode === 'markPaid' ? 'Mark as paid' :
    mode === 'email' ? 'Email invoice' :
    mode === 'remind' ? 'Payment reminder' : inv.invoiceNo;

  return (
    <BottomSheet
      visible={!!invoice}
      onClose={onClose}
      title={title}
      leftAction={mode !== 'detail' ? { label: 'Back', onPress: back } : undefined}
    >
      <ScrollView
        style={{ maxHeight: 620 }}
        contentContainerStyle={{ padding: SP.xl, paddingBottom: SP.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {mode === 'detail' && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: SP.md }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: T.text, fontSize: 17, fontWeight: '800' }} numberOfLines={1}>
                  {inv.memberName ?? `Member #${inv.memberId}`}
                </Text>
                <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 3 }}>
                  Issued {fmtDate(inv.issuedAt)}{inv.dueDate ? ` · Due ${fmtDate(inv.dueDate)}` : ''}
                </Text>
              </View>
              <StatusPill label={invoiceLabel(inv)} tone={invoiceTone(invoiceLabel(inv))} dot />
            </View>
            {onOpenMember && (
              <View style={{ flexDirection: 'row', marginBottom: SP.md }}>
                <SmallButton icon="user" label="View member" tone={T.sky} onPress={() => { onClose(); onOpenMember(inv.memberId); }} />
              </View>
            )}

            {inv.items.map((it, i) => (
              <View key={i} style={{ flexDirection: 'row', paddingVertical: 6, gap: SP.md }}>
                <Text style={{ flex: 1, color: T.text, fontSize: 14 }}>
                  {it.description}
                  {it.quantity !== 1 && <Text style={{ color: T.textFaint }}>{`  × ${it.quantity}`}</Text>}
                </Text>
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{fmtMoney(it.unitPrice * it.quantity, cur)}</Text>
              </View>
            ))}
            <Divider />
            <KeyValue label="Subtotal" value={fmtMoney(inv.subtotal, cur)} />
            {inv.discount > 0 && <KeyValue label="Discount" value={`− ${fmtMoney(inv.discount, cur)}`} />}
            {inv.tax > 0 && <KeyValue label="Tax" value={fmtMoney(inv.tax, cur)} />}
            <KeyValue label="Total" value={fmtMoney(inv.total, cur)} strong />
            <Divider />
            <KeyValue label="Paid" value={fmtMoney(inv.amountPaid, cur)} tone={T.ok} />
            <KeyValue label="Balance" value={fmtMoney(inv.balance, cur)} strong tone={inv.balance > 0 ? T.brandGold : T.ok} />
            {!!inv.notes && <Text style={{ color: T.textSub, fontSize: 13, marginTop: SP.sm }}>{inv.notes}</Text>}

            <View style={{ marginTop: SP.lg, gap: SP.md }}>
              {hasBalance && <PrimaryButton label="Record payment" icon="plus-circle" onPress={startPay} />}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
                {hasBalance && (
                  <SmallButton icon="check-circle" label="Mark paid" tone={T.ok}
                    onPress={() => { setReference(''); setMode('markPaid'); }} />
                )}
                <SmallButton icon="mail" label="Email invoice" tone={T.sky} onPress={() => { setMessage(''); setMode('email'); }} />
                <SmallButton icon="download" label="Download PDF" tone={T.textSub} onPress={() => openInvoicePdf(inv.id, inv.invoiceNo)} />
                {hasBalance && (
                  <SmallButton icon="bell" label="Send reminder" tone={T.brandGold} onPress={() => { setMessage(''); setMode('remind'); }} />
                )}
              </View>
            </View>
          </>
        )}

        {mode === 'pay' && (
          <>
            <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>
              {inv.invoiceNo} · balance {fmtMoney(inv.balance, cur)}. Partial payments are fine.
            </Text>
            <Field label={`Amount (${cur})`} value={amount} onChangeText={v => { setAmount(v); setError(undefined); }}
              keyboardType="decimal-pad" error={error} />
            <MethodChips value={method} onChange={setMethod} />
            <Field label="Reference (optional)" value={reference} onChangeText={setReference}
              placeholder="Receipt no. / UPI txn id / cheque no." autoCapitalize="none" />
            <PrimaryButton label={`Record ${fmtMoney(toNumber(amount), cur)}`} icon="check" onPress={submitPay} loading={charge.isPending} />
          </>
        )}

        {mode === 'markPaid' && (
          <>
            <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>
              Records the full balance of {fmtMoney(inv.balance, cur)} as received.
            </Text>
            <MethodChips value={method} onChange={setMethod} />
            <Field label="Reference (optional)" value={reference} onChangeText={setReference} autoCapitalize="none" />
            <PrimaryButton label="Mark as paid" icon="check" onPress={submitMarkPaid} loading={markPaid.isPending} />
          </>
        )}

        {(mode === 'email' || mode === 'remind') && (
          <>
            <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>
              {mode === 'email'
                ? `Emails ${inv.invoiceNo} as a PDF to ${inv.memberName ?? 'the member'}.`
                : `Emails ${inv.memberName ?? 'the member'} a reminder listing everything they owe.`}
            </Text>
            <Field label="Message (optional)" value={message} onChangeText={setMessage} multiline />
            <PrimaryButton
              label={mode === 'email' ? 'Send invoice' : 'Send reminder'}
              icon="send"
              onPress={mode === 'email' ? submitEmail : submitRemind}
              loading={mode === 'email' ? send.isPending : remind.isPending}
            />
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
