import React from 'react';
import { View } from 'react-native';
import { Field, SwitchRow, RowGrid, GridCell } from '../../trainers/components/FormFields';
import { PayMethod, ChargeOptions } from '../types/billing.types';
import { MethodChips, KeyValue, Divider, fmtMoney, computeTotals, toNumber } from './billingUi';

/** Raw text state for the tax / discount / pay-now block (create and renew). */
export interface ChargeDraft {
  taxPercent: string;
  discount: string;
  paidNow: boolean;
  method: PayMethod;
  reference: string;
}

export const emptyChargeDraft = (): ChargeDraft => ({ taxPercent: '', discount: '', paidNow: true, method: 'cash', reference: '' });

export const chargeOptionsFrom = (d: ChargeDraft): ChargeOptions => ({
  taxPercent: toNumber(d.taxPercent),
  discount: toNumber(d.discount),
  payNowMethod: d.paidNow ? d.method : '',
  paymentReference: d.paidNow ? d.reference : '',
});

/** Returns an error map for the draft (empty when valid). */
export function validateChargeDraft(d: ChargeDraft, price: number): Record<string, string> {
  const errs: Record<string, string> = {};
  const tax = toNumber(d.taxPercent);
  const disc = toNumber(d.discount);
  if (tax < 0 || tax > 100) errs.taxPercent = 'Tax must be between 0 and 100%.';
  if (disc < 0) errs.discount = 'Discount can’t be negative.';
  else if (disc > price) errs.discount = 'Discount can’t exceed the price.';
  return errs;
}

export default function ChargeOptionsFields({ draft, onChange, price, currency, errors = {} }: {
  draft: ChargeDraft;
  onChange: (d: ChargeDraft) => void;
  price: number;
  currency?: string;
  errors?: Record<string, string>;
}) {
  const set = <K extends keyof ChargeDraft>(k: K, v: ChargeDraft[K]) => onChange({ ...draft, [k]: v });
  const t = computeTotals(price, toNumber(draft.discount), toNumber(draft.taxPercent));

  return (
    <View>
      <RowGrid>
        <GridCell>
          <Field label="Tax %" value={draft.taxPercent} onChangeText={v => set('taxPercent', v)}
            keyboardType="decimal-pad" placeholder="0" error={errors.taxPercent} />
        </GridCell>
        <GridCell>
          <Field label={`Discount${currency ? ` (${currency})` : ''}`} value={draft.discount} onChangeText={v => set('discount', v)}
            keyboardType="decimal-pad" placeholder="0" error={errors.discount} />
        </GridCell>
      </RowGrid>

      <View style={{ marginBottom: 16 }}>
        <KeyValue label="Plan price" value={fmtMoney(t.subtotal, currency)} />
        {t.discount > 0 && <KeyValue label="Discount" value={`− ${fmtMoney(t.discount, currency)}`} />}
        {t.tax > 0 && <KeyValue label={`Tax (${toNumber(draft.taxPercent)}%)`} value={fmtMoney(t.tax, currency)} />}
        <Divider />
        <KeyValue label="Total" value={fmtMoney(t.total, currency)} strong />
      </View>

      <SwitchRow label="Paid now?" value={draft.paidNow} onValueChange={v => set('paidNow', v)}
        description={draft.paidNow ? 'The invoice is recorded as paid at the desk.' : 'The invoice is left due for the member to pay.'} />
      {draft.paidNow && (
        <>
          <MethodChips value={draft.method} onChange={m => set('method', m)} />
          <Field label="Reference (optional)" value={draft.reference} onChangeText={v => set('reference', v)}
            placeholder="Receipt no. / UPI txn id / cheque no." autoCapitalize="none" />
        </>
      )}
    </View>
  );
}
