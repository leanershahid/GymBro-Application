import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { T, SP } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import { memberBookingKeys } from '../api/bookingQueries';
import ClassesTab from '../components/ClassesTab';
import MyBookingsTab from '../components/MyBookingsTab';
import PtTab from '../components/PtTab';
import { usePageTabs } from '../../access/context/AccessContext';

interface Props {
  userId: number;
  onBack?: () => void;
  onOpenBilling?: () => void;
  /** Tab to open on (e.g. "mine"); falls back to the first granted tab. */
  initialTab?: string;
}

// One-shot tab request for callers that can only navigate by route name (e.g. the Home
// "Next booking" card → "My bookings"). Consumed by the next BookScreen mount.
let requestedTab: string | null = null;
export const openBookOn = (tab: string) => { requestedTab = tab; };

export default function BookScreen({ userId, onBack, onOpenBilling, initialTab }: Props) {
  const { hPad } = useLayout();
  const qc = useQueryClient();
  // Tabs come from the access list (member.book.*).
  const { items: tabs, tab, setTab, has } = usePageTabs('member.book');
  useEffect(() => {
    const wanted = initialTab ?? requestedTab;
    requestedTab = null;
    if (wanted && has(wanted)) setTab(wanted);
  }, []);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await qc.refetchQueries({ queryKey: memberBookingKeys.all(userId), type: 'active' });
    } finally {
      setRefreshing(false);
    }
  }, [qc, userId]);

  return (
    <Screen>
      <ScreenHeader title="Book" eyebrow="Classes & training" onBack={onBack} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} colors={[T.brand]} />}
      >
        {tabs.length > 1 && <SegmentedTabs tabs={tabs} value={tab ?? ''} onChange={setTab} style={{ marginBottom: SP.lg }} />}
        {tab === 'classes' && <ClassesTab userId={userId} />}
        {tab === 'mine' && <MyBookingsTab userId={userId} />}
        {tab === 'pt' && <PtTab userId={userId} onOpenBilling={onOpenBilling} />}
      </ScrollView>
    </Screen>
  );
}
