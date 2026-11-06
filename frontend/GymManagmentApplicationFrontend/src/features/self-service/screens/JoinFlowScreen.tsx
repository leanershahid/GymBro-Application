import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, SP, R, withAlpha } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import { Field } from '../../common/components/FormFields';
import { DateField } from '../../common/components/DatePicker';
import { useToast } from '../../common/components/Toast';
import { SafetyFlowModal } from '../../safety/routes';
import RazorpayNativeModal from '../../member-billing/payments/RazorpayNativeModal';
import { useInvoiceCheckout } from '../../member-billing/hooks/useInvoiceCheckout';
import { canDownloadPdf, downloadInvoicePdf } from '../../member-billing/utils/downloadInvoicePdf';
import { useCheckout, useJoinQuote, usePlanCatalog } from '../api/selfServiceQueries';
import { CheckoutResult, JoinQuotePayload } from '../api/selfService.types';
import {
  Card, ChoiceRow, InfoRow, Notice, PriceBreakdown, StepBar, addDays, day, money, perCycle, rulesSummary, todayIso,
} from '../components/SelfServiceUi';

const STEPS = ['Choose plan', 'Start date', 'Safety check', 'Review & pay'];

interface Props {
  userId: number;
  planId?: number;
  coupon?: string;
  onBack: () => void;
  /** After success: book a class / open My membership. */
  onBookClass?: () => void;
  onOpenMyMembership?: () => void;
}

type Done = { result: CheckoutResult; paidOnline: boolean };

/**
 * Join & buy: 1 plan → 2 start date + coupon → 3 safety (the existing waiver / health flow,
 * only when something is missing) → 4 review totals from the server quote, accept terms, pay
 * with Razorpay (or "pay at the front desk"). The membership goes live once payment is verified.
 */
export default function JoinFlowScreen({ userId, planId, coupon: initialCoupon, onBack, onBookClass, onOpenMyMembership }: Props) {
  const { hPad } = useLayout();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const catalog = usePlanCatalog();

  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<number | undefined>(planId);
  const [startMode, setStartMode] = useState<'today' | 'pick'>('today');
  const [startDate, setStartDate] = useState(todayIso());
  const [couponDraft, setCouponDraft] = useState(initialCoupon ?? '');
  const [coupon, setCoupon] = useState(initialCoupon ?? '');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<CheckoutResult | null>(null);

  const quoteInput: JoinQuotePayload | null = useMemo(() => (selected ? {
    planId: selected, startDate: startMode === 'today' ? undefined : startDate, couponCode: coupon || undefined,
  } : null), [selected, startMode, startDate, coupon]);
  const quote = useJoinQuote(step >= 2 ? quoteInput : null);
  const checkout = useCheckout(userId);

  // The checkout whose Razorpay window is open (read when the verified payment comes back).
  const pendingRef = useRef<CheckoutResult | null>(null);
  const onPaid = useCallback(() => {
    if (pendingRef.current) setDone({ result: pendingRef.current, paidOnline: true });
  }, []);
  const { payOrder, payingId, verifying, nativeModalProps } = useInvoiceCheckout(userId, { onPaid });
  const busy = checkout.isPending || payingId !== null || verifying;

  const plans = catalog.data?.plans ?? [];
  const plan = plans.find(p => p.id === selected);
  const rules = catalog.data?.rules;
  const maxStart = addDays(todayIso(), rules?.maxStartDaysAhead ?? 60);
  const q = quote.data;
  const safetyBlocked = !!q && q.safetyRequired && q.safetyMissing.length > 0;

  const pay = () => {
    if (!selected || busy) return;
    if (!acceptTerms) { toast.show({ type: 'error', message: 'Please accept the membership terms first.' }); return; }
    checkout.mutate(
      { ...quoteInput!, acceptTerms: true },
      {
        onSuccess: res => {
          pendingRef.current = res;
          setPendingCheckout(res);
          if (res.activated || res.payAtDesk || !res.order) setDone({ result: res, paidOnline: false });
          else payOrder(res.order);
        },
        onError: e => toast.show({ type: 'error', message: apiErrorText(e), durationMs: 6000 }),
      },
    );
  };

  // ── Success ──
  if (done) return <JoinSuccess done={done} onBookClass={onBookClass} onOpenMyMembership={onOpenMyMembership} onClose={onBack} />;

  // ── Loading / errors ──
  if (catalog.isLoading) return <Screen><ScreenHeader title="Join" onBack={onBack} /><LoadingState label="Loading plans" /></Screen>;
  if (catalog.isError || !rules) {
    return (
      <Screen>
        <ScreenHeader title="Join" onBack={onBack} />
        <EmptyState icon="wifi-off" tone="error" title="Couldn't load plans" subtitle={describeApiError(catalog.error).message}
          action={{ label: 'Try again', onPress: () => catalog.refetch() }} />
      </Screen>
    );
  }
  if (!rules.allowOnlineJoin) {
    return (
      <Screen>
        <ScreenHeader title="Join" onBack={onBack} />
        <EmptyState icon="home" title="Join at the front desk" subtitle="This gym signs up new members in person. Visit the front desk and they'll get you started." />
      </Screen>
    );
  }

  const back = () => (step > 1 ? setStep(step - 1) : onBack());
  const footer = (() => {
    switch (step) {
      case 1: return <PrimaryButton label="Continue" icon="arrow-right" onPress={() => setStep(2)} disabled={!plan} />;
      case 2: return <PrimaryButton label="Continue" icon="arrow-right" onPress={() => setStep(3)} disabled={!q || quote.isFetching} loading={quote.isFetching} />;
      case 3: return q && q.safetyMissing.length > 0
        ? <>
            <PrimaryButton label="Start safety check" icon="shield" onPress={() => setSafetyOpen(true)} />
            {!safetyBlocked && <PrimaryButton label="Do it later" variant="secondary" onPress={() => setStep(4)} />}
          </>
        : <PrimaryButton label="Continue" icon="arrow-right" onPress={() => setStep(4)} disabled={!q} />;
      default: return (
        <PrimaryButton
          label={!q ? 'Pay' : q.total <= 0 ? 'Start membership' : q.onlinePayments ? `Pay ${money(q.total, q.currency)}` : 'Confirm — pay at the front desk'}
          icon={q?.onlinePayments ? 'lock' : 'check'}
          onPress={pay}
          loading={busy}
          disabled={!q || !acceptTerms || busy || safetyBlocked}
          accessibilityHint="Creates your membership and opens secure payment"
        />
      );
    }
  })();

  return (
    <Screen>
      <ScreenHeader title="Join" eyebrow={plan?.name} onBack={back} />
      <View style={{ paddingHorizontal: hPad, paddingBottom: SP.sm, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
        <StepBar step={step} total={4} labels={STEPS} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: SP.md, paddingBottom: SP.xxl, width: '100%', maxWidth: 640, alignSelf: 'center', gap: SP.lg }}
        keyboardShouldPersistTaps="handled">

        {step === 1 && (
          <>
            <Text accessibilityRole="header" style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Pick your plan</Text>
            {plans.length === 0 && <EmptyState icon="layers" title="No plans online" subtitle="Ask the front desk about memberships." />}
            {plans.map(p => (
              <ChoiceRow key={p.id} selected={p.id === selected} onPress={() => setSelected(p.id)} icon={p.isPopular ? 'star' : 'credit-card'}
                title={`${p.name} · ${money(p.price, p.currency)} ${perCycle(p.billingCycle)}`}
                subtitle={[p.isPopular ? 'Most popular' : null, p.joiningFee > 0 ? `+ ${money(p.joiningFee, p.currency)} joining fee` : 'No joining fee',
                  p.classCredits ? `${p.classCredits} class credits` : 'Unlimited classes'].filter(Boolean).join(' · ')} />
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <Text accessibilityRole="header" style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>When do you want to start?</Text>
            <View accessibilityRole="radiogroup" style={{ gap: SP.sm }}>
              <ChoiceRow selected={startMode === 'today'} onPress={() => setStartMode('today')} icon="zap" title="Today" subtitle="Start training right after you pay" />
              <ChoiceRow selected={startMode === 'pick'} onPress={() => setStartMode('pick')} icon="calendar" title="Pick a date"
                subtitle={`Any day up to ${day(maxStart)}`} />
            </View>
            {startMode === 'pick' && (
              <DateField label="Start date" value={startDate} onChange={setStartDate}
                minYear={new Date().getFullYear()} maxYear={new Date().getFullYear() + 1}
                error={startDate < todayIso() ? 'Pick today or later.' : startDate > maxStart ? `Pick a date before ${day(maxStart)}.` : undefined} />
            )}
            <View>
              <Field label="Coupon (optional)" value={couponDraft} onChangeText={t => setCouponDraft(t.toUpperCase())} placeholder="Enter code"
                autoCapitalize="characters" autoCorrect={false}
                rightElement={
                  <Pressable onPress={() => setCoupon(couponDraft.trim())} accessibilityRole="button" accessibilityLabel="Apply coupon" hitSlop={8}
                    style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: SP.md }}>
                    <Text style={{ color: T.brand, fontWeight: '700' }}>Apply</Text>
                  </Pressable>
                } />
              {!!q?.couponMessage && (
                <Text accessibilityLiveRegion="polite" style={{ color: q.couponApplied ? T.ok : T.err, fontSize: 13, marginTop: -8 }}>{q.couponMessage}</Text>
              )}
            </View>
            <QuoteCard quoteState={quote} />
          </>
        )}

        {step === 3 && (
          <>
            <Text accessibilityRole="header" style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Safety first</Text>
            {!q ? <LoadingState label="Checking" /> : q.safetyMissing.length === 0 ? (
              <Notice icon="check-circle" tone={T.ok} title="You're all set">Your waiver and health check are up to date.</Notice>
            ) : (
              <>
                <Text style={{ color: T.textSub, fontSize: 15, lineHeight: 22 }}>
                  Before your first session the gym needs {q.safetyMissing.includes('waiver') ? 'your signed waiver' : ''}
                  {q.safetyMissing.length > 1 ? ' and ' : ''}{q.safetyMissing.includes('health') ? 'a short health check' : ''}. It takes about two minutes.
                </Text>
                {safetyBlocked && <Notice icon="lock" tone={T.sky}>This gym needs these done before you can buy a membership.</Notice>}
              </>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <Text accessibilityRole="header" style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Review & pay</Text>
            <QuoteCard quoteState={quote} showDates />
            {q && (
              <Card>
                <Text style={{ color: T.text, fontSize: 15, fontWeight: '800', marginBottom: 4 }}>Membership terms</Text>
                {rulesSummary(q.rules, q.currency).map(r => <InfoRow key={r.label} icon={r.icon} label={r.label} value={r.value} />)}
                <InfoRow icon="refresh-cw" label="Renews at" value={`${money(q.renewalPrice, q.currency)} ${perCycle(q.billingCycle)}`} />
              </Card>
            )}
            <Pressable
              onPress={() => setAcceptTerms(a => !a)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptTerms }}
              accessibilityLabel="I agree to the membership terms, including the renewal, notice and minimum term above"
              style={{ flexDirection: 'row', gap: SP.md, alignItems: 'flex-start', minHeight: 48, paddingVertical: SP.sm }}
            >
              <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: acceptTerms ? T.brand : T.textFaint,
                backgroundColor: acceptTerms ? T.brand : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                {acceptTerms && <Feather name="check" size={16} color={T.onBrand} />}
              </View>
              <Text style={{ flex: 1, color: T.text, fontSize: 14, lineHeight: 20 }}>
                I agree to the membership terms: it renews automatically {q ? perCycle(q.billingCycle) : ''} until I cancel, with the notice and minimum term shown above.
              </Text>
            </Pressable>
            {q && !q.onlinePayments && q.total > 0 && (
              <Notice icon="home" tone={T.brandGold} title="Pay at the front desk">
                This gym doesn't take online payments yet. We'll save your membership and tell the team — it starts as soon as you pay at the desk.
              </Notice>
            )}
            {pendingCheckout && !done && (
              <Text style={{ color: T.textFaint, fontSize: 12, textAlign: 'center' }}>
                Invoice {pendingCheckout.invoice.invoiceNo} is saved. If the payment window closed, tap Pay again — you won't be charged twice.
              </Text>
            )}
          </>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: hPad, paddingTop: SP.md, paddingBottom: Math.max(insets.bottom, SP.lg), borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.bg }}>
        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', gap: SP.sm }}>{footer}</View>
      </View>

      <SafetyFlowModal
        request={safetyOpen ? { reason: 'Sign the waiver and answer a few health questions to finish joining.' } : null}
        onClose={() => { setSafetyOpen(false); quote.refetch().then(r => { if (r.data && (!r.data.safetyRequired || r.data.safetyMissing.length === 0)) setStep(4); }); }}
      />
      {Platform.OS !== 'web' && <RazorpayNativeModal {...nativeModalProps} />}
    </Screen>
  );
}

function QuoteCard({ quoteState, showDates }: { quoteState: ReturnType<typeof useJoinQuote>; showDates?: boolean }) {
  const q = quoteState.data;
  if (quoteState.isError) {
    return <Notice icon="alert-triangle" tone={T.err} title="Couldn't price this">{describeApiError(quoteState.error).message}</Notice>;
  }
  if (!q) return <LoadingState label="Working out your price" />;
  return (
    <Card accent={T.brand}>
      {showDates && (
        <View style={{ marginBottom: SP.md }}>
          <Text style={{ color: T.text, fontSize: 18, fontWeight: '800' }}>{q.planName}</Text>
          <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }}>
            {day(q.startDate)} – {day(addDays(q.endDate, -1))} · renews {day(q.endDate)}
          </Text>
        </View>
      )}
      <PriceBreakdown lines={q.lines} total={q.total} currency={q.currency} />
      {quoteState.isFetching && <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 6 }}>Updating…</Text>}
    </Card>
  );
}

function JoinSuccess({ done, onBookClass, onOpenMyMembership, onClose }: {
  done: Done; onBookClass?: () => void; onOpenMyMembership?: () => void; onClose: () => void;
}) {
  const { hPad } = useLayout();
  const toast = useToast();
  const { result, paidOnline } = done;
  const live = result.activated || paidOnline;
  const inv = result.invoice;
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: SP.xxl, paddingBottom: SP.xxl, gap: SP.lg, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        <View style={{ alignItems: 'center', gap: SP.md }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(live ? T.brand : T.brandGold, 0.12), borderWidth: 1, borderColor: withAlpha(live ? T.brand : T.brandGold, 0.3) }}>
            <Feather name={live ? 'check' : 'home'} size={40} color={live ? T.brand : T.brandGold} />
          </View>
          <Text accessibilityRole="header" style={{ color: T.text, fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 }}>
            {live ? 'Welcome aboard!' : 'Almost there'}
          </Text>
          <Text style={{ color: T.textSub, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
            {live
              ? `Your ${result.membership.planName} membership starts ${day(result.membership.startDate)}.`
              : `We've saved your ${result.membership.planName} membership. Pay ${money(inv.balance, inv.currency)} at the front desk and it starts straight away.`}
          </Text>
        </View>
        <Card>
          <InfoRow icon="calendar" label="Starts" value={day(result.membership.startDate)} />
          <InfoRow icon="refresh-cw" label="Renews" value={day(result.membership.endDate)} />
          <InfoRow icon="file-text" label="Invoice" value={inv.invoiceNo} />
          <InfoRow icon="credit-card" label={live ? 'Paid' : 'To pay at the desk'} value={money(live ? inv.total : inv.balance, inv.currency)} tone={live ? T.ok : T.brandGold} />
          {canDownloadPdf && (
            <View style={{ marginTop: SP.sm }}>
              <PrimaryButton label="Download receipt (PDF)" icon="download" variant="secondary"
                onPress={() => downloadInvoicePdf(inv.id, inv.invoiceNo).catch(e => toast.show({ type: 'error', message: apiErrorText(e) }))} />
            </View>
          )}
          {!canDownloadPdf && <Text style={{ color: T.textFaint, fontSize: 12, marginTop: SP.sm }}>Your receipt is in Membership → Invoices.</Text>}
        </Card>
        <View style={{ gap: SP.sm }}>
          <Text style={{ color: T.text, fontSize: 17, fontWeight: '800' }}>Next steps</Text>
          {onBookClass && <PrimaryButton label="Book your first class" icon="calendar" onPress={onBookClass} />}
          {onOpenMyMembership && <PrimaryButton label="View my membership" icon="credit-card" variant="secondary" onPress={onOpenMyMembership} />}
          {!onBookClass && !onOpenMyMembership && <PrimaryButton label="Done" icon="check" onPress={onClose} />}
        </View>
        <View style={{ padding: SP.md, borderRadius: R.md, backgroundColor: T.bgInput }}>
          <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>
            Tip: bring a water bottle and a towel, and arrive 10 minutes early for your first visit so the team can show you around.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
