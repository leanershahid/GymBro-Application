import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import FormPage from '../../exercises/components/FormPage';
import SearchBar from '../../common/components/SearchBar';
import LoadingState from '../../common/components/LoadingState';
import { useToast } from '../../common/components/Toast';
import { Field, RowGrid, GridCell } from '../../trainers/components/FormFields';
import { DateField } from '../../trainers/components/DatePicker';
import { useMembers } from '../../members/api/memberQueries';
import { describeApiError, apiErrorText } from '../../../api/apiError';
import { useCreateInvoice, usePlans } from '../api/billingQueries';
import InvoiceSheet from '../components/InvoiceSheet';
import { Invoice } from '../types/billing.types';
import { Card, KeyValue, Divider, SmallButton, fmtMoney, computeTotals, toNumber } from '../components/billingUi';
import { T, SP, R } from '../../../theme';

export interface NewInvoicePageProps {
  /** Pre-selected member; when omitted a member picker is shown. */
  memberId?: number;
  onBack: () => void;
}

interface LineDraft { key: number; description: string; unitPrice: string; quantity: string }

let lineKey = 0;
const newLine = (): LineDraft => ({ key: ++lineKey, description: '', unitPrice: '', quantity: '1' });

/** Ad-hoc invoice (personal training, merchandise, fees…) with line items. */
export default function NewInvoicePage({ memberId, onBack }: NewInvoicePageProps) {
  const toast = useToast();
  const create = useCreateInvoice();
  // The API sets the invoice currency from the gym; plans carry the same currency, so use it for previews.
  const { data: plans } = usePlans();
  const currency = plans?.[0]?.currency;

  const [member, setMember] = useState<{ id: number; name: string } | null>(memberId ? { id: memberId, name: '' } : null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [taxPercent, setTaxPercent] = useState('');
  const [discount, setDiscount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<Invoice | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const members = useMembers(debounced, 1, 10);

  const updateLine = (key: number, patch: Partial<LineDraft>) =>
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const subtotal = lines.reduce((s, l) => s + toNumber(l.unitPrice) * Math.max(0, Math.floor(toNumber(l.quantity))), 0);
  const totals = computeTotals(subtotal, toNumber(discount), toNumber(taxPercent));

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!member) errs.member = 'Pick a member.';
    const filled = lines.filter(l => l.description.trim() || l.unitPrice.trim());
    if (!filled.length) errs.lines = 'Add at least one item.';
    filled.forEach(l => {
      if (!l.description.trim()) errs[`d${l.key}`] = 'Describe the item.';
      if (!(toNumber(l.unitPrice) > 0)) errs[`p${l.key}`] = 'Enter a price.';
      if (!(Math.floor(toNumber(l.quantity)) >= 1)) errs[`q${l.key}`] = 'At least 1.';
    });
    const tax = toNumber(taxPercent);
    if (tax < 0 || tax > 100) errs.taxPercent = 'Between 0 and 100.';
    if (toNumber(discount) < 0) errs.discount = 'Can’t be negative.';
    else if (toNumber(discount) > subtotal) errs.discount = 'More than the subtotal.';
    setErrors(errs);
    if (Object.keys(errs).length || !member) return;

    create.mutate(
      {
        memberId: member.id,
        items: filled.map(l => ({
          description: l.description.trim(), unitPrice: toNumber(l.unitPrice), quantity: Math.floor(toNumber(l.quantity)),
        })),
        taxPercent: tax,
        discount: toNumber(discount),
        dueDate: dueDate || null,
        notes,
      },
      {
        onSuccess: inv => { toast.show({ message: `Invoice ${inv?.invoiceNo ?? ''} created.` }); setCreated(inv); },
        onError: e => Alert.alert('Invoice not created', apiErrorText(e)),
      },
    );
  };

  return (
    <FormPage eyebrow="Billing" title="New invoice" onBack={onBack}
      submitLabel={`Create invoice · ${fmtMoney(totals.total, currency)}`} onSubmit={submit} submitting={create.isPending}>

      {/* ── Member ── */}
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>Member</Text>
      {member ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.md, marginBottom: SP.lg,
          borderRadius: R.lg, borderWidth: 1, borderColor: T.brandBorder, backgroundColor: T.brandDim,
        }}>
          <Feather name="user" size={16} color={T.brand} />
          <Text style={{ flex: 1, color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
            {member.name || `Member #${member.id}`}
          </Text>
          {!memberId && <SmallButton icon="repeat" label="Change" tone={T.textSub} onPress={() => setMember(null)} />}
        </View>
      ) : (
        <View style={{ marginBottom: SP.lg }}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search members by name, email or phone" />
          <View style={{ marginTop: SP.sm }}>
            {members.isLoading ? <LoadingState label="Searching…" /> : members.error ? (
              <Text style={{ color: T.err, fontSize: 13 }}>{describeApiError(members.error).message}</Text>
            ) : (members.data?.items ?? []).length === 0 ? (
              <Text style={{ color: T.textFaint, fontSize: 13, paddingVertical: SP.sm }}>No members found.</Text>
            ) : (members.data?.items ?? []).map(m => {
              const name = `${m.firstName} ${m.lastName}`.trim();
              return (
                <Pressable
                  key={m.id}
                  onPress={() => { setMember({ id: m.id, name }); setErrors(e => ({ ...e, member: '' })); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Bill ${name}`}
                  style={({ pressed }) => ({
                    paddingVertical: SP.md, paddingHorizontal: SP.md, borderRadius: R.md,
                    backgroundColor: pressed ? T.bgInputActive : 'transparent',
                  })}
                >
                  <Text style={{ color: T.text, fontSize: 15, fontWeight: '600' }}>{name || m.email}</Text>
                  <Text style={{ color: T.textFaint, fontSize: 12 }}>{[m.email, m.phone].filter(Boolean).join(' · ')}</Text>
                </Pressable>
              );
            })}
          </View>
          {!!errors.member && <Text style={{ color: T.err, fontSize: 12, marginTop: 4 }}>{errors.member}</Text>}
        </View>
      )}

      {/* ── Items ── */}
      <Card title="Items" right={<SmallButton icon="plus" label="Add item" onPress={() => setLines(ls => [...ls, newLine()])} />}>
        {lines.map((l, idx) => (
          <View key={l.key} style={{ paddingTop: SP.md }}>
            {idx > 0 && <View style={{ marginBottom: SP.md }}><Divider /></View>}
            <Field label={`Item ${idx + 1}`} value={l.description} onChangeText={v => updateLine(l.key, { description: v })}
              placeholder="e.g. Personal training — 4 sessions" error={errors[`d${l.key}`]} />
            <RowGrid>
              <GridCell>
                <Field label={`Unit price${currency ? ` (${currency})` : ''}`} value={l.unitPrice}
                  onChangeText={v => updateLine(l.key, { unitPrice: v })} keyboardType="decimal-pad" error={errors[`p${l.key}`]} />
              </GridCell>
              <GridCell>
                <Field label="Qty" value={l.quantity} onChangeText={v => updateLine(l.key, { quantity: v })}
                  keyboardType="number-pad" error={errors[`q${l.key}`]} />
              </GridCell>
            </RowGrid>
            {lines.length > 1 && (
              <View style={{ flexDirection: 'row', marginTop: -8, marginBottom: SP.sm }}>
                <SmallButton icon="trash-2" label="Remove" tone={T.err} onPress={() => setLines(ls => ls.filter(x => x.key !== l.key))} />
              </View>
            )}
          </View>
        ))}
        {!!errors.lines && <Text style={{ color: T.err, fontSize: 12, marginBottom: SP.sm }}>{errors.lines}</Text>}
      </Card>

      <RowGrid>
        <GridCell>
          <Field label="Tax %" value={taxPercent} onChangeText={setTaxPercent} keyboardType="decimal-pad" placeholder="0" error={errors.taxPercent} />
        </GridCell>
        <GridCell>
          <Field label="Discount" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" placeholder="0" error={errors.discount} />
        </GridCell>
      </RowGrid>
      <DateField label="Due date (optional)" value={dueDate} onChange={setDueDate} placeholder="Due on receipt"
        minYear={new Date().getFullYear()} maxYear={new Date().getFullYear() + 2} />
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

      <View style={{ marginBottom: SP.md }}>
        <KeyValue label="Subtotal" value={fmtMoney(totals.subtotal, currency)} />
        {totals.discount > 0 && <KeyValue label="Discount" value={`− ${fmtMoney(totals.discount, currency)}`} />}
        {totals.tax > 0 && <KeyValue label="Tax" value={fmtMoney(totals.tax, currency)} />}
        <Divider />
        <KeyValue label="Total" value={fmtMoney(totals.total, currency)} strong />
      </View>

      {/* After creating, show the invoice so the admin can take payment / email it right away. */}
      <InvoiceSheet invoice={created} onClose={() => { setCreated(null); onBack(); }} />
    </FormPage>
  );
}
