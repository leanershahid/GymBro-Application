import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { T, SP } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { describeApiError } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import { Field } from '../../common/components/FormFields';
import { usePlanCatalog } from '../api/selfServiceQueries';
import PlanCard from '../components/PlanCard';
import { Notice } from '../components/SelfServiceUi';

interface Props {
  onBack?: () => void;
  /** Start the join flow for a plan (the coupon typed here is carried over). */
  onJoin: (planId: number, coupon?: string) => void;
  /** Already a member: open My membership (change plan lives there). */
  onOpenMyMembership?: () => void;
}

/** "Choose your membership": the gym's public plans as comparison cards. */
export default function PlansBrowseScreen({ onBack, onJoin, onOpenMyMembership }: Props) {
  const { hPad, isDesktop: isWide } = useLayout();
  const q = usePlanCatalog();
  const [coupon, setCoupon] = useState('');

  const body = () => {
    if (q.isLoading) return <LoadingState label="Loading plans" />;
    if (q.isError) {
      return <EmptyState icon="wifi-off" tone="error" title="Couldn't load plans" subtitle={describeApiError(q.error).message}
        action={{ label: 'Try again', onPress: () => q.refetch() }} />;
    }
    const c = q.data!;
    if (c.plans.length === 0) {
      return <EmptyState icon="layers" title="No plans online yet" subtitle="Ask the front desk about memberships — they can sign you up in a minute." />;
    }
    const hasCurrent = c.plans.some(p => p.isCurrent);
    return (
      <View style={{ gap: SP.lg }}>
        {!c.rules.allowOnlineJoin && (
          <Notice icon="info" tone={T.sky} title="Join at the front desk">
            You can compare plans here; the team at the front desk will sign you up.
          </Notice>
        )}
        {hasCurrent && onOpenMyMembership && (
          <Notice icon="repeat" tone={T.sky} title="Already a member">
            To switch plans, use Change plan in My membership — we'll show you exactly what changes and when.
          </Notice>
        )}
        {c.rules.allowOnlineJoin && !hasCurrent && (
          <Field label="Have a coupon? (optional)" value={coupon} onChangeText={t => setCoupon(t.toUpperCase())}
            placeholder="e.g. NEWYEAR10" autoCapitalize="characters" autoCorrect={false} />
        )}
        <View style={{ flexDirection: isWide ? 'row' : 'column', flexWrap: 'wrap', gap: SP.lg }}>
          {c.plans.map(p => (
            <View key={p.id} style={isWide ? { flexBasis: 320, flexGrow: 1 } : undefined}>
              <PlanCard
                plan={p}
                rules={c.rules}
                actionLabel={!c.rules.allowOnlineJoin ? undefined : p.isCurrent ? undefined : hasCurrent ? 'Switch to this plan' : 'Choose this plan'}
                onAction={hasCurrent ? onOpenMyMembership : () => onJoin(p.id, coupon.trim() || undefined)}
              />
            </View>
          ))}
        </View>
        <Text style={{ color: T.textFaint, fontSize: 12, textAlign: 'center' }}>
          Prices are {c.rules.taxPercent > 0 ? `before ${c.rules.taxPercent}% tax` : 'final'}. You'll see the full total before you pay.
        </Text>
      </View>
    );
  };

  return (
    <Screen>
      <ScreenHeader title="Memberships" eyebrow="Choose your plan" onBack={onBack} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 120, paddingTop: SP.sm, width: '100%', maxWidth: 1100, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={T.brand} />}
        keyboardShouldPersistTaps="handled"
      >
        {body()}
      </ScrollView>
    </Screen>
  );
}
