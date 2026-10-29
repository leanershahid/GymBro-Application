import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { apiErrorText } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import StatusPill from '../../common/components/StatusPill';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';
import { useMyMemberships, useMyInvoices, useMyPayments, useOnlinePayments } from '../api/memberBillingQueries';
import { MyInvoice, MyPayment, MySubscription } from '../types/memberBilling.types';
import {
  formatMoney, formatDate, daysUntil, daysLeftLabel, parseDate, splitMemberships, isFrozen, isDue, totalDue,
} from '../utils/billingFormat';
import { invoiceTone, paymentTone, membershipTone } from '../components/billingTones';
import InvoiceDetailSheet from '../components/InvoiceDetailSheet';
import RazorpayNativeModal from '../payments/RazorpayNativeModal';
import { useInvoiceCheckout } from '../hooks/useInvoiceCheckout';

interface Props {
  userId: number;
  onBack?: () => void;
}

// ── Small building blocks ────────────────────────────────────────────────────

function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.md }}>
      <Text accessibilityRole="header" style={{ color: T.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 }}>{title}</Text>
      {right}
    </View>
  );
}

function Card({ children, accent, style }: { children: React.ReactNode; accent?: string; style?: object }) {
  return (
    <View style={[{
      backgroundColor: T.bgInput, borderRadius: R.xl, borderWidth: 1,
      borderColor: accent ? withAlpha(accent, 0.28) : T.line, padding: SP.lg,
    }, style]}>
      {children}
    </View>
  );
}

function InlineError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <EmptyState icon="wifi-off" tone="error" title="Couldn't load this" subtitle={apiErrorText(error)} action={{ label: 'Retry', onPress: onRetry }} />;
}

// ── Membership ───────────────────────────────────────────────────────────────

function CurrentMembershipCard({ sub }: { sub: MySubscription }) {
  const frozen = isFrozen(sub);
  const left = daysLeftLabel(sub);
  const n = daysUntil(sub.endDate);
  const live = ['active', 'trial', 'paused', 'pending'].includes(sub.status.toLowerCase());
  const accent = frozen ? T.brandGold : live ? T.brand : T.textFaint;

  // Elapsed share of the term, for the progress bar.
  const start = parseDate(sub.startDate)?.getTime();
  const end = parseDate(sub.endDate)?.getTime();
  const progress = start && end && end > start ? Math.min(1, Math.max(0, (Date.now() - start) / (end - start))) : null;

  return (
    <Card accent={accent}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SP.md }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>
            {live ? 'Current plan' : 'Latest plan'}
          </Text>
          <Text numberOfLines={2} style={{ color: T.text, fontSize: 20, fontWeight: '800', marginTop: 4, letterSpacing: -0.3 }}>{sub.planName}</Text>
          <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }}>{formatMoney(sub.price, sub.currency)}</Text>
        </View>
        <StatusPill label={frozen ? 'Frozen' : sub.status} tone={membershipTone(frozen ? 'frozen' : sub.status)} dot />
      </View>

      {live && !!left && (
        <View style={{ marginTop: SP.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: n !== null && n <= 7 ? T.brandGold : T.text, fontSize: 14, fontWeight: '700' }}>{left}</Text>
            {!!sub.endDate && <Text style={{ color: T.textSub, fontSize: 12 }}>Ends {formatDate(sub.endDate)}</Text>}
          </View>
          {progress !== null && (
            <View style={{ height: 6, borderRadius: 3, backgroundColor: withAlpha(T.text, 0.08), overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: accent, borderRadius: 3 }} />
            </View>
          )}
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.lg, marginTop: SP.lg }}>
        <View>
          <Text style={{ color: T.textFaint, fontSize: 11 }}>Started</Text>
          <Text style={{ color: T.text, fontSize: 13, fontWeight: '600', marginTop: 2 }}>{formatDate(sub.startDate)}</Text>
        </View>
        <View>
          <Text style={{ color: T.textFaint, fontSize: 11 }}>{live ? 'Ends' : 'Ended'}</Text>
          <Text style={{ color: T.text, fontSize: 13, fontWeight: '600', marginTop: 2 }}>{sub.endDate ? formatDate(sub.endDate) : 'Ongoing'}</Text>
        </View>
        {live && (
          <View>
            <Text style={{ color: T.textFaint, fontSize: 11 }}>Auto-renew</Text>
            <Text style={{ color: sub.autoRenew ? T.ok : T.textSub, fontSize: 13, fontWeight: '600', marginTop: 2 }}>{sub.autoRenew ? 'On' : 'Off'}</Text>
          </View>
        )}
      </View>

      {frozen && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: SP.lg, padding: SP.md, borderRadius: R.md, backgroundColor: withAlpha(T.brandGold, 0.10) }}>
          <Feather name="pause-circle" size={16} color={T.brandGold} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: T.brandGold, fontSize: 13 }}>
            Your membership is frozen
            {sub.frozenFrom ? ` from ${formatDate(sub.frozenFrom)}` : ''}
            {sub.frozenUntil ? ` until ${formatDate(sub.frozenUntil)}` : ''}. Days don't count down while it's frozen.
          </Text>
        </View>
      )}
      {!live && (
        <Text style={{ color: T.textSub, fontSize: 13, marginTop: SP.lg }}>
          You don't have an active membership. Visit the front desk to renew.
        </Text>
      )}
    </Card>
  );
}

function PastMemberships({ list }: { list: MySubscription[] }) {
  const [open, setOpen] = useState(false);
  if (!list.length) return null;
  return (
    <View style={{ marginTop: SP.md }}>
      <Pressable
        onPress={() => setOpen(o => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Past memberships, ${list.length}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}
      >
        <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '700' }}>Past memberships ({list.length})</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={T.textSub} />
      </Pressable>
      {open && (
        <Card style={{ paddingVertical: SP.xs }}>
          {list.map((s, i) => (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: SP.md, borderTopWidth: i ? 1 : 0, borderTopColor: T.line }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{s.planName}</Text>
                <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>
                  {formatDate(s.startDate)} – {s.endDate ? formatDate(s.endDate) : 'Ongoing'} · {formatMoney(s.price, s.currency)}
                </Text>
              </View>
              <StatusPill label={s.status} tone={membershipTone(s.status)} />
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

// ── Invoices & payments ──────────────────────────────────────────────────────

function DueInvoiceRow({ inv, onlineEnabled, paying, busy, onPay, onOpen }: {
  inv: MyInvoice; onlineEnabled: boolean; paying: boolean; busy: boolean;
  onPay: (i: MyInvoice) => void; onOpen: (i: MyInvoice) => void;
}) {
  const overdue = inv.status.toLowerCase() === 'overdue' || ((daysUntil(inv.dueDate) ?? 0) < 0);
  return (
    <Card accent={overdue ? T.err : T.brandGold} style={{ marginBottom: SP.md }}>
      <Pressable onPress={() => onOpen(inv)} accessibilityRole="button" accessibilityLabel={`Invoice ${inv.invoiceNo}, ${formatMoney(inv.balance, inv.currency)} due`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: T.textSub, fontSize: 12 }}>Invoice {inv.invoiceNo}</Text>
            <Text style={{ color: T.text, fontSize: 22, fontWeight: '800', marginTop: 2, letterSpacing: -0.3 }}>{formatMoney(inv.balance, inv.currency)}</Text>
            <Text style={{ color: overdue ? T.err : T.textSub, fontSize: 12, marginTop: 2 }}>
              {inv.dueDate ? `${overdue ? 'Was due' : 'Due'} ${formatDate(inv.dueDate)}` : `Issued ${formatDate(inv.issuedAt)}`}
              {inv.amountPaid > 0 ? ` · ${formatMoney(inv.amountPaid, inv.currency)} paid` : ''}
            </Text>
          </View>
          <StatusPill label={overdue ? 'Overdue' : 'Due'} tone={overdue ? 'err' : 'warn'} />
        </View>
      </Pressable>
      {onlineEnabled ? (
        <Pressable
          onPress={() => onPay(inv)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Pay ${formatMoney(inv.balance, inv.currency)} now`}
          accessibilityState={{ disabled: busy, busy: paying }}
          style={({ pressed }) => ({
            marginTop: SP.md, minHeight: 44, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8, backgroundColor: pressed || paying ? T.brandDark : T.brand, opacity: busy && !paying ? 0.5 : 1,
          })}
        >
          {paying ? <ActivityIndicator color={T.onBrand} /> : (
            <>
              <Feather name="credit-card" size={16} color={T.onBrand} />
              <Text style={{ color: T.onBrand, fontSize: 15, fontWeight: '700' }}>Pay now</Text>
            </>
          )}
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SP.md }}>
          <Feather name="map-pin" size={13} color={T.textSub} />
          <Text style={{ color: T.textSub, fontSize: 13 }}>Pay at the front desk</Text>
        </View>
      )}
    </Card>
  );
}

function InvoiceRow({ inv, first, onOpen }: { inv: MyInvoice; first: boolean; onOpen: (i: MyInvoice) => void }) {
  return (
    <Pressable
      onPress={() => onOpen(inv)}
      accessibilityRole="button"
      accessibilityLabel={`Invoice ${inv.invoiceNo}, ${formatMoney(inv.total, inv.currency)}, ${inv.status}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: SP.md, paddingHorizontal: SP.lg,
        borderTopWidth: first ? 0 : 1, borderTopColor: T.line, backgroundColor: pressed ? T.bgInputActive : 'transparent',
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: withAlpha(T.brand, 0.10), alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="file-text" size={16} color={T.brand} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{inv.invoiceNo}</Text>
        <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>
          {formatDate(inv.issuedAt)}{inv.items[0] ? ` · ${inv.items[0].description}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{formatMoney(inv.total, inv.currency)}</Text>
        <StatusPill label={inv.status} tone={invoiceTone(inv.status)} />
      </View>
    </Pressable>
  );
}

function PaymentRow({ p, first }: { p: MyPayment; first: boolean }) {
  const icon = p.method.toLowerCase() === 'cash' ? 'dollar-sign' : p.method.toLowerCase() === 'upi' ? 'smartphone' : 'credit-card';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: SP.md, paddingHorizontal: SP.lg, borderTopWidth: first ? 0 : 1, borderTopColor: T.line }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: withAlpha(T.sky, 0.10), alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={16} color={T.sky} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>
          {p.method}{p.invoiceNo ? ` · ${p.invoiceNo}` : ''}
        </Text>
        <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>
          {formatDate(p.paidAt)}
          {p.refundedAmount > 0 ? ` · ${formatMoney(p.refundedAmount, p.currency)} refunded` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{formatMoney(p.amount, p.currency)}</Text>
        <StatusPill label={p.status} tone={paymentTone(p.status)} />
      </View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function MyBillingScreen({ userId, onBack }: Props) {
  const { hPad } = useLayout();
  const membershipsQ = useMyMemberships(userId);
  const invoicesQ = useMyInvoices(userId);
  const paymentsQ = useMyPayments(userId);
  const onlineQ = useOnlinePayments(userId);
  const onlineEnabled = onlineQ.data === true;

  const { pay, payingId, verifying, nativeModalProps } = useInvoiceCheckout(userId);

  const [tab, setTab] = useState<'invoices' | 'payments'>('invoices');
  const [openInvoiceId, setOpenInvoiceId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const memberships = membershipsQ.data ?? [];
  const invoices = useMemo(
    () => [...(invoicesQ.data ?? [])].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    [invoicesQ.data],
  );
  const payments = useMemo(
    () => [...(paymentsQ.data ?? [])].sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    [paymentsQ.data],
  );
  const due = useMemo(() => invoices.filter(isDue), [invoices]);
  const dueTotal = totalDue(invoices);
  const { current, past } = splitMemberships(memberships);
  // Keep the sheet in sync with refetched data (e.g. after paying from it).
  const openInvoice = invoices.find(i => i.id === openInvoiceId) ?? null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([membershipsQ.refetch(), invoicesQ.refetch(), paymentsQ.refetch(), onlineQ.refetch()]);
    setRefreshing(false);
  }, [membershipsQ, invoicesQ, paymentsQ, onlineQ]);

  const busy = payingId !== null || verifying;
  const firstLoad = membershipsQ.isLoading && invoicesQ.isLoading;
  const allFailed = membershipsQ.isError && invoicesQ.isError && paymentsQ.isError;

  return (
    <Screen>
      <ScreenHeader title="Billing" eyebrow="My membership" onBack={onBack} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} colors={[T.brand]} />}
      >
        {firstLoad ? (
          <View style={{ gap: SP.lg }}>
            <Skeleton rows={1} height={200} borderRadius={R.xl} gap={0} />
            <Skeleton rows={3} height={64} borderRadius={R.lg} />
          </View>
        ) : allFailed ? (
          <InlineError error={membershipsQ.error} onRetry={onRefresh} />
        ) : (
          <>
            {/* ── Membership ── */}
            <View style={{ marginBottom: SP.xxl }}>
              <SectionTitle title="Membership" />
              {membershipsQ.isError ? (
                <InlineError error={membershipsQ.error} onRetry={() => membershipsQ.refetch()} />
              ) : current ? (
                <>
                  <CurrentMembershipCard sub={current} />
                  <PastMemberships list={past} />
                </>
              ) : (
                <Card>
                  <EmptyState icon="award" title="No membership yet" subtitle="Ask at the front desk to get started with a plan." />
                </Card>
              )}
            </View>

            {/* ── Due ── */}
            {!invoicesQ.isError && due.length > 0 && (
              <View style={{ marginBottom: SP.xxl }}>
                <SectionTitle
                  title="Due"
                  right={dueTotal ? <Text style={{ color: T.brandGold, fontSize: 14, fontWeight: '800' }}>{dueTotal}</Text> : undefined}
                />
                {due.map(inv => (
                  <DueInvoiceRow
                    key={inv.id}
                    inv={inv}
                    onlineEnabled={onlineEnabled}
                    paying={payingId === inv.id}
                    busy={busy}
                    onPay={pay}
                    onOpen={i => setOpenInvoiceId(i.id)}
                  />
                ))}
              </View>
            )}

            {/* ── History ── */}
            <SegmentedTabs
              tabs={[{ key: 'invoices', label: `Invoices${invoices.length ? ` (${invoices.length})` : ''}` }, { key: 'payments', label: 'Payments' }]}
              value={tab}
              onChange={setTab}
              style={{ marginBottom: SP.lg }}
            />

            {tab === 'invoices' && (
              invoicesQ.isLoading ? <Skeleton rows={3} height={64} borderRadius={R.lg} />
              : invoicesQ.isError ? <InlineError error={invoicesQ.error} onRetry={() => invoicesQ.refetch()} />
              : invoices.length === 0 ? <EmptyState icon="file-text" title="No invoices yet" subtitle="Your invoices will appear here." />
              : (
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  {invoices.map((inv, i) => <InvoiceRow key={inv.id} inv={inv} first={i === 0} onOpen={x => setOpenInvoiceId(x.id)} />)}
                </Card>
              )
            )}

            {tab === 'payments' && (
              paymentsQ.isLoading ? <Skeleton rows={3} height={64} borderRadius={R.lg} />
              : paymentsQ.isError ? <InlineError error={paymentsQ.error} onRetry={() => paymentsQ.refetch()} />
              : payments.length === 0 ? <EmptyState icon="credit-card" title="No payments yet" subtitle="Payments you make will show up here." />
              : (
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  {payments.map((p, i) => <PaymentRow key={p.id} p={p} first={i === 0} />)}
                </Card>
              )
            )}
          </>
        )}
      </ScrollView>

      <InvoiceDetailSheet
        invoice={openInvoice}
        onClose={() => setOpenInvoiceId(null)}
        onlineEnabled={onlineEnabled}
        paying={!!openInvoice && payingId === openInvoice.id}
        onPay={inv => { setOpenInvoiceId(null); pay(inv); }}
      />
      <RazorpayNativeModal {...nativeModalProps} />
    </Screen>
  );
}
