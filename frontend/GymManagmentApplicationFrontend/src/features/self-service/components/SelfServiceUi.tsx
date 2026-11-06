import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { formatMoney, formatDate } from '../../common/utils/format';
import { QuoteLine } from '../api/selfService.types';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export const money = (n: number, currency: string) => formatMoney(n, currency, { fractionDigits: Number.isInteger(n) ? 0 : 2 });
export const day = (s: string | null | undefined) => formatDate(s);

/** "per month", "per 3 months"… from the server's BillingCycle enum name. */
export function perCycle(cycle: string): string {
  switch (cycle.toLowerCase()) {
    case 'daily': return 'per day';
    case 'weekly': return 'per week';
    case 'monthly': return 'per month';
    case 'quarterly': return 'per 3 months';
    case 'halfyearly': return 'per 6 months';
    case 'yearly': return 'per year';
    default: return 'one-time';
  }
}

/** "YYYY-MM-DD" in local time. */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + n));
};
export const todayIso = () => isoDay(new Date());

export function Card({ children, accent, style }: { children: React.ReactNode; accent?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{
      backgroundColor: T.bgInput, borderRadius: R.xl, borderWidth: 1,
      borderColor: accent ? withAlpha(accent, 0.3) : T.line, padding: SP.lg,
    }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text accessibilityRole="header" style={{ color: T.text, fontSize: 17, fontWeight: '800', marginBottom: SP.md }}>{children}</Text>;
}

/** Row of label + value (rules, dates). */
export function InfoRow({ icon, label, value, tone }: { icon: FeatherName; label: string; value: string; tone?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: 8 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Feather name={icon} size={16} color={tone ?? T.textSub} />
      <Text style={{ flex: 1, color: T.textSub, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: tone ?? T.text, fontSize: 14, fontWeight: '700', textAlign: 'right', flexShrink: 1 }}>{value}</Text>
    </View>
  );
}

/** Line-by-line price breakdown with a bold total — every fee on screen, nothing hidden. */
export function PriceBreakdown({ lines, total, currency, totalLabel = 'Total today' }: {
  lines: QuoteLine[]; total: number; currency: string; totalLabel?: string;
}) {
  return (
    <View accessibilityLabel={`${totalLabel} ${money(total, currency)}`}>
      {lines.map((l, i) => (
        <View key={`${l.kind}-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md, paddingVertical: 6 }}>
          <Text style={{ flex: 1, color: T.textSub, fontSize: 14 }}>{l.label}</Text>
          <Text style={{ color: l.amount < 0 ? T.ok : T.text, fontSize: 14, fontWeight: '600' }}>
            {l.amount < 0 ? `− ${money(-l.amount, currency)}` : money(l.amount, currency)}
          </Text>
        </View>
      ))}
      <View style={{ height: 1, backgroundColor: T.line, marginVertical: SP.sm }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: T.text, fontSize: 16, fontWeight: '800' }}>{totalLabel}</Text>
        <Text style={{ color: T.brand, fontSize: 22, fontWeight: '800' }}>{money(total, currency)}</Text>
      </View>
    </View>
  );
}

/** Tinted notice box. */
export function Notice({ icon, tone, title, children }: { icon: FeatherName; tone: string; title?: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: SP.sm, padding: SP.md, borderRadius: R.md, backgroundColor: withAlpha(tone, 0.1), borderWidth: 1, borderColor: withAlpha(tone, 0.25) }}>
      <Feather name={icon} size={16} color={tone} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {!!title && <Text style={{ color: tone, fontSize: 14, fontWeight: '700' }}>{title}</Text>}
        <Text style={{ color: T.text, fontSize: 13, lineHeight: 19 }}>{children}</Text>
      </View>
    </View>
  );
}

/** Progress bar for the join flow: "Step 2 of 4". */
export function StepBar({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}: ${labels[step - 1] ?? ''}`}
      accessibilityValue={{ min: 1, max: total, now: step }}
      style={{ gap: 6 }}
    >
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? T.brand : T.line }} />
        ))}
      </View>
      <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '600' }}>Step {step} of {total} · {labels[step - 1]}</Text>
    </View>
  );
}

/** Large tappable choice row (radio style). */
export function ChoiceRow({ selected, title, subtitle, onPress, icon }: {
  selected: boolean; title: string; subtitle?: string; onPress: () => void; icon?: FeatherName;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 56, padding: SP.md,
        borderRadius: R.lg, borderWidth: 1, borderColor: selected ? T.brand : T.line,
        backgroundColor: pressed ? T.bgInputActive : selected ? withAlpha(T.brand, 0.08) : T.bgInput,
      })}
    >
      {icon && <Feather name={icon} size={18} color={selected ? T.brand : T.textSub} />}
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{title}</Text>
        {!!subtitle && <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      <Feather name={selected ? 'check-circle' : 'circle'} size={20} color={selected ? T.brand : T.textFaint} />
    </Pressable>
  );
}

/** Plain-language list of the gym's terms (minimum term, notice, freeze allowance). */
export function rulesSummary(r: { minimumTermMonths: number; noticeDays: number; maxFreezeDaysPerYear: number; freezeFee: number; cancellationFee: number }, currency: string) {
  return [
    { icon: 'calendar' as const, label: 'Minimum term', value: r.minimumTermMonths > 0 ? `${r.minimumTermMonths} month${r.minimumTermMonths === 1 ? '' : 's'}` : 'None' },
    { icon: 'bell' as const, label: 'Notice to cancel', value: r.noticeDays > 0 ? `${r.noticeDays} days` : 'None' },
    { icon: 'pause-circle' as const, label: 'Pause allowance', value: r.maxFreezeDaysPerYear > 0 ? `${r.maxFreezeDaysPerYear} days a year${r.freezeFee > 0 ? ` · ${money(r.freezeFee, currency)} per pause` : ''}` : 'Not available' },
    ...(r.cancellationFee > 0 ? [{ icon: 'x-circle' as const, label: 'Cancellation fee', value: money(r.cancellationFee, currency) }] : []),
  ];
}

export const TYPE_LABEL: Record<string, string> = { freeze: 'Pause', cancel: 'Cancellation', change: 'Plan change' };
export const STATUS_TONE: Record<string, 'warn' | 'ok' | 'err' | 'neutral'> = { pending: 'warn', approved: 'ok', rejected: 'err', withdrawn: 'neutral' };
export const STATUS_LABEL: Record<string, string> = { pending: 'Waiting for the gym', approved: 'Approved', rejected: 'Not approved', withdrawn: 'Withdrawn' };
