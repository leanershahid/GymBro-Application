import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { T, SP, withAlpha } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import StatusPill from '../../common/components/StatusPill';
import PrimaryButton from '../../common/components/PrimaryButton';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { MyInvoice } from '../types/memberBilling.types';
import { formatMoney, formatDate, isDue } from '../utils/billingFormat';
import { canDownloadPdf, downloadInvoicePdf } from '../utils/downloadInvoicePdf';
import { invoiceTone } from './billingTones';

interface Props {
  invoice: MyInvoice | null;
  onClose: () => void;
  onlineEnabled: boolean;
  paying: boolean;
  onPay: (inv: MyInvoice) => void;
}

function TotalRow({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: strong ? T.text : T.textSub, fontSize: strong ? 15 : 13, fontWeight: strong ? '700' : '400' }}>{label}</Text>
      <Text style={{ color: color ?? (strong ? T.text : T.textSub), fontSize: strong ? 15 : 13, fontWeight: strong ? '800' : '600' }}>{value}</Text>
    </View>
  );
}

/** Invoice detail: line items, totals, PDF download and Pay now. */
export default function InvoiceDetailSheet({ invoice, onClose, onlineEnabled, paying, onPay }: Props) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const inv = invoice;
  const m = (v: number) => formatMoney(v, inv?.currency ?? 'INR');

  const download = async () => {
    if (!inv) return;
    setDownloading(true);
    try { await downloadInvoicePdf(inv.id, inv.invoiceNo); }
    catch (e) { toast.show({ type: 'error', message: apiErrorText(e) }); }
    finally { setDownloading(false); }
  };

  return (
    <BottomSheet visible={!!inv} onClose={onClose} title={inv ? `Invoice ${inv.invoiceNo}` : 'Invoice'} style={{ maxHeight: '88%' }}>
      {inv && (
        <ScrollView contentContainerStyle={{ padding: SP.xl, gap: SP.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: T.textSub, fontSize: 12 }}>Issued {formatDate(inv.issuedAt)}</Text>
              {!!inv.dueDate && <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>Due {formatDate(inv.dueDate)}</Text>}
              {!!inv.paidAt && <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>Paid {formatDate(inv.paidAt)}</Text>}
            </View>
            <StatusPill label={inv.status} tone={invoiceTone(inv.status)} />
          </View>

          <View style={{ borderWidth: 1, borderColor: T.line, borderRadius: 14, overflow: 'hidden' }}>
            {inv.items.length === 0 ? (
              <Text style={{ color: T.textFaint, fontSize: 13, padding: SP.md }}>No line items.</Text>
            ) : inv.items.map((it, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: SP.md, padding: SP.md, borderTopWidth: i ? 1 : 0, borderTopColor: T.line }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{it.description}</Text>
                  <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>{it.quantity} × {m(it.unitPrice)}</Text>
                </View>
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{m(it.unitPrice * it.quantity)}</Text>
              </View>
            ))}
          </View>

          <View>
            <TotalRow label="Subtotal" value={m(inv.subtotal)} />
            {inv.discount > 0 && <TotalRow label="Discount" value={`− ${m(inv.discount)}`} />}
            {inv.tax > 0 && <TotalRow label="Tax" value={m(inv.tax)} />}
            <View style={{ height: 1, backgroundColor: T.line, marginVertical: 6 }} />
            <TotalRow label="Total" value={m(inv.total)} strong />
            <TotalRow label="Paid" value={m(inv.amountPaid)} />
            <TotalRow label="Balance" value={m(inv.balance)} strong color={inv.balance > 0 ? T.brandGold : T.ok} />
          </View>

          {!!inv.notes && (
            <View style={{ backgroundColor: withAlpha(T.text, 0.04), borderRadius: 12, padding: SP.md }}>
              <Text style={{ color: T.textSub, fontSize: 13 }}>{inv.notes}</Text>
            </View>
          )}

          {isDue(inv) && (onlineEnabled ? (
            <PrimaryButton label={`Pay ${m(inv.balance)}`} icon="credit-card" loading={paying} onPress={() => onPay(inv)} />
          ) : (
            <Text style={{ color: T.textSub, fontSize: 13, textAlign: 'center' }}>Pay at the front desk.</Text>
          ))}
          {canDownloadPdf && (
            <PrimaryButton label="Download PDF" icon="download" variant="secondary" loading={downloading} onPress={download} />
          )}
        </ScrollView>
      )}
    </BottomSheet>
  );
}
