import React from 'react';
import { View, Text, Pressable, Platform, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ChipSelect from '../../exercises/components/ChipSelect';
import { PillTone } from '../../common/components/StatusPill';
import { fetchInvoicePdf } from '../api/billingApi';
import { apiErrorText } from '../../../api/apiError';
import { PayMethod, BillingCycleInput } from '../types/billing.types';
import { T, SP, R, withAlpha } from '../../../theme';

export type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

// ─── Formatting ──────────────────────────────────────────────────

/** Money in the invoice/plan's own currency, in the device locale. */
export const fmtMoney = (amount: number, currency?: string | null) => {
  const n = Number.isFinite(amount) ? amount : 0;
  if (!currency) return n.toFixed(2);
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n); }
  catch { return `${currency} ${n.toFixed(2)}`; }
};

export const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  // Date-only values ("2026-10-29") are parsed as local dates so they don't shift a day.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** "12.5" / "12,5" → 12.5; blank or junk → 0. */
export const toNumber = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Same arithmetic as the server: (subtotal − discount) + tax% on that. */
export function computeTotals(subtotal: number, discount: number, taxPercent: number) {
  const discounted = Math.max(0, subtotal - Math.max(0, discount));
  const tax = round2(discounted * Math.max(0, taxPercent) / 100);
  return { subtotal: round2(subtotal), discount: round2(Math.min(Math.max(0, discount), subtotal)), tax, total: round2(discounted + tax) };
}

// ─── Status → pill ───────────────────────────────────────────────

/** The server keeps open invoices as "Sent"; show what matters at the desk instead. */
export function invoiceLabel(inv: { status: string; balance: number; amountPaid: number }): string {
  const s = inv.status.toLowerCase();
  if ((s === 'sent' || s === 'draft') && inv.balance > 0) return inv.amountPaid > 0 ? 'Part paid' : 'Unpaid';
  return inv.status;
}

export function invoiceTone(label: string): PillTone {
  switch (label.toLowerCase()) {
    case 'paid': return 'ok';
    case 'overdue': return 'err';
    case 'unpaid': return 'warn';
    case 'part paid': case 'sent': return 'info';
    case 'refunded': return 'violet';
    default: return 'neutral';
  }
}

/** Membership label: the server calls a frozen membership "Paused". */
export const membershipLabel = (status: string) => (status.toLowerCase() === 'paused' ? 'Frozen' : status);

export function membershipTone(status: string): PillTone {
  switch (status.toLowerCase()) {
    case 'active': return 'ok';
    case 'paused': case 'pending': case 'trial': return 'warn';
    case 'cancelled': return 'err';
    default: return 'neutral';
  }
}

export function paymentTone(status: string): PillTone {
  switch (status.toLowerCase()) {
    case 'completed': return 'ok';
    case 'failed': return 'err';
    case 'refunded': return 'violet';
    case 'pending': return 'warn';
    default: return 'neutral';
  }
}

// ─── Options ─────────────────────────────────────────────────────

export const PAY_METHODS: { value: PayMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'netbanking', label: 'Net banking' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'wallet', label: 'Wallet' },
];

export const CYCLES: { value: BillingCycleInput; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half-yearly', label: 'Half-yearly' },
  { value: 'annual', label: 'Annual' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
  { value: 'one-time', label: 'One-time' },
];

/** Server enum name ("HalfYearly", "Yearly") → the value the create/update endpoints take. */
export function cycleInputFrom(serverCycle: string): BillingCycleInput {
  switch (serverCycle.toLowerCase()) {
    case 'daily': return 'daily';
    case 'weekly': return 'weekly';
    case 'quarterly': return 'quarterly';
    case 'halfyearly': return 'half-yearly';
    case 'yearly': return 'annual';
    case 'onetime': return 'one-time';
    default: return 'monthly';
  }
}

export const cycleLabel = (serverCycle: string) =>
  CYCLES.find(c => c.value === cycleInputFrom(serverCycle))?.label ?? serverCycle;

export function MethodChips({ value, onChange, label = 'Payment method' }: {
  value: PayMethod | null; onChange: (m: PayMethod) => void; label?: string;
}) {
  return <ChipSelect<PayMethod> label={label} options={PAY_METHODS} value={value} onChange={onChange} />;
}

// ─── Building blocks ─────────────────────────────────────────────

export function Card({ title, right, children }: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line,
      paddingHorizontal: SP.lg, paddingBottom: SP.sm, marginBottom: SP.lg,
    }}>
      {(title || right) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: SP.md, paddingBottom: 4, minHeight: 40 }}>
          <Text style={{ flex: 1, color: T.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {title}
          </Text>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export const Divider = () => <View style={{ height: 1, backgroundColor: T.line }} />;

export function KeyValue({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: strong ? T.text : T.textSub, fontSize: strong ? 15 : 14, fontWeight: strong ? '700' : '400' }}>{label}</Text>
      <Text style={{ color: tone ?? T.text, fontSize: strong ? 16 : 14, fontWeight: strong ? '800' : '600' }}>{value}</Text>
    </View>
  );
}

export function SmallButton({ icon, label, tone = T.brand, onPress, disabled }: {
  icon: FeatherIcon; label: string; tone?: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34,
        paddingHorizontal: 12, borderRadius: R.pill, opacity: disabled ? 0.5 : 1,
        backgroundColor: pressed ? withAlpha(tone, 0.18) : withAlpha(tone, 0.10),
        borderWidth: 1, borderColor: withAlpha(tone, 0.28),
      })}
    >
      <Feather name={icon} size={13} color={tone} />
      <Text style={{ color: tone, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export function FilterChips<K extends string>({ options, value, onChange }: {
  options: { key: K; label: string }[]; value: K; onChange: (k: K) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginBottom: SP.md }}>
      {options.map(o => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={{
              minHeight: 34, justifyContent: 'center', paddingHorizontal: 14, borderRadius: R.pill,
              backgroundColor: active ? T.brand : T.bgInput, borderWidth: 1, borderColor: active ? T.brand : T.line,
            }}
          >
            <Text style={{ color: active ? T.onBrand : T.textSub, fontSize: 12, fontWeight: '700' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Note({ icon = 'info', text, tone = T.sky }: { icon?: FeatherIcon; text: string; tone?: string }) {
  return (
    <View style={{
      flexDirection: 'row', gap: SP.sm, alignItems: 'flex-start', marginBottom: SP.md,
      backgroundColor: withAlpha(tone, 0.07), borderWidth: 1, borderColor: withAlpha(tone, 0.2),
      borderRadius: R.md, padding: SP.md,
    }}>
      <Feather name={icon} size={14} color={tone} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: T.textSub, fontSize: 12, lineHeight: 17 }}>{text}</Text>
    </View>
  );
}

/** Pressable list row: title/subtitle left, amount + pill right. */
export function ListRow({ title, subtitle, amount, pill, onPress, accessibilityLabel }: {
  title: string; subtitle?: string; amount?: string; pill?: React.ReactNode; onPress?: () => void; accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.md, marginBottom: SP.sm,
        borderRadius: R.lg, borderWidth: 1, borderColor: T.line,
        backgroundColor: pressed ? T.bgInputActive : T.bgInput,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 3 }} numberOfLines={2}>{subtitle}</Text>}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {!!amount && <Text style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>{amount}</Text>}
        {pill}
      </View>
    </Pressable>
  );
}

// ─── PDF ─────────────────────────────────────────────────────────

/**
 * Opens the invoice PDF. On web the blob is shown in a new tab (the tab is opened before the
 * request so popup blockers allow it). On native there's no file-sharing module installed yet,
 * so the admin is pointed to the email option instead.
 */
export async function openInvoicePdf(invoiceId: number, invoiceNo?: string) {
  if (Platform.OS !== 'web') {
    Alert.alert(
      'PDF download',
      'Downloading PDFs is available in the web app. On the phone, use "Email invoice" to send the PDF to the member.',
    );
    return;
  }
  const w = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  try {
    const blob = await fetchInvoicePdf(invoiceId);
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    if (w) w.location.href = url;
    else {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNo ?? `invoice-${invoiceId}`}.pdf`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    w?.close();
    Alert.alert('Couldn’t open the PDF', apiErrorText(e));
  }
}
