import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import { MemberRules, PublicPlan } from '../api/selfService.types';
import { money, perCycle } from './SelfServiceUi';

interface Props {
  plan: PublicPlan;
  rules: MemberRules;
  /** Button label + action; omitted = no button (e.g. the current plan). */
  actionLabel?: string;
  onAction?: () => void;
  selected?: boolean;
}

/** One comparison card: price, period, what's included, joining fee and the gym's terms. */
function PlanCard({ plan, rules, actionLabel, onAction, selected }: Props) {
  const accent = plan.isPopular || selected ? T.brand : T.line;
  const included: { icon: React.ComponentProps<typeof Feather>['name']; text: string }[] = [];
  if (plan.classCredits) included.push({ icon: 'calendar', text: `${plan.classCredits} class credits ${perCycle(plan.billingCycle)}` });
  else included.push({ icon: 'calendar', text: 'Unlimited classes' });
  if (plan.ptSessions) included.push({ icon: 'user-check', text: `${plan.ptSessions} PT session${plan.ptSessions === 1 ? '' : 's'} included` });
  if (plan.accessHours) included.push({ icon: 'clock', text: `Access: ${plan.accessHours}` });
  included.push({ icon: 'map-pin', text: plan.branchName ? `${plan.branchName} only` : 'All branches' });
  plan.features.forEach(f => included.push({ icon: 'check', text: f }));

  const terms = [
    plan.joiningFee > 0 ? `Joining fee ${money(plan.joiningFee, plan.currency)} (one-off)` : 'No joining fee',
    rules.minimumTermMonths > 0 ? `${rules.minimumTermMonths}-month minimum` : 'No minimum term',
    rules.noticeDays > 0 ? `${rules.noticeDays} days' notice to cancel` : 'Cancel any time',
    rules.maxFreezeDaysPerYear > 0 ? `Pause up to ${rules.maxFreezeDaysPerYear} days a year` : 'No pausing',
  ];

  return (
    <View
      accessible={false}
      style={{
        backgroundColor: T.bgInput, borderRadius: R.xl, borderWidth: plan.isPopular || selected ? 2 : 1,
        borderColor: accent, padding: SP.lg, gap: SP.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SP.sm }}>
        <View style={{ flex: 1 }}>
          {plan.isPopular && (
            <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: R.pill, backgroundColor: T.brand, marginBottom: 6 }}>
              <Text style={{ color: T.onBrand, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>Most popular</Text>
            </View>
          )}
          <Text accessibilityRole="header" style={{ color: T.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}>{plan.name}</Text>
          {!!plan.description && <Text style={{ color: T.textSub, fontSize: 13, marginTop: 4, lineHeight: 19 }}>{plan.description}</Text>}
        </View>
        {plan.isCurrent && (
          <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: R.pill, backgroundColor: withAlpha(T.sky, 0.15) }}>
            <Text style={{ color: T.sky, fontSize: 11, fontWeight: '700' }}>Your plan</Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }} accessible accessibilityLabel={`${money(plan.price, plan.currency)} ${perCycle(plan.billingCycle)}`}>
        <Text style={{ color: T.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>{money(plan.price, plan.currency)}</Text>
        <Text style={{ color: T.textSub, fontSize: 14 }}>{perCycle(plan.billingCycle)}</Text>
      </View>

      <View style={{ gap: 8 }}>
        {included.map((i, n) => (
          <View key={n} style={{ flexDirection: 'row', gap: SP.sm, alignItems: 'flex-start' }}>
            <Feather name={i.icon} size={15} color={T.brand} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, color: T.text, fontSize: 14 }}>{i.text}</Text>
          </View>
        ))}
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: T.line, paddingTop: SP.md, gap: 4 }}>
        {terms.map(t => <Text key={t} style={{ color: T.textSub, fontSize: 12 }}>· {t}</Text>)}
      </View>

      {actionLabel && onAction && (
        <PrimaryButton label={actionLabel} icon="arrow-right" onPress={onAction} variant={plan.isPopular || selected ? 'primary' : 'secondary'}
          accessibilityHint={`${plan.name}, ${money(plan.price, plan.currency)} ${perCycle(plan.billingCycle)}`} />
      )}
    </View>
  );
}

export default React.memo(PlanCard);
