import React, { useState } from 'react';
import { View } from 'react-native';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import InvoicesTab from '../components/InvoicesTab';
import PaymentsTab from '../components/PaymentsTab';
import PlansTab from '../components/PlansTab';
import GatewaySettings from '../components/GatewaySettings';
import { SP } from '../../../theme';

type Tab = 'invoices' | 'payments' | 'plans' | 'settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
  { key: 'plans', label: 'Plans' },
  { key: 'settings', label: 'Settings' },
];

export interface BillingHomePageProps {
  onBack: () => void;
  onOpenMember?: (memberId: number) => void;
  /** Shows a "New invoice" header action when provided. */
  onNewInvoice?: () => void;
}

/** Admin billing hub: invoices, payment history, membership plans and online-payment settings. */
export default function BillingHomePage({ onBack, onOpenMember, onNewInvoice }: BillingHomePageProps) {
  const [tab, setTab] = useState<Tab>('invoices');

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Billing"
        title="Payments & plans"
        onBack={onBack}
        action={onNewInvoice ? { label: 'Invoice', icon: 'plus', onPress: onNewInvoice } : undefined}
      />
      <View style={{ paddingHorizontal: SP.xl, marginBottom: SP.md }}>
        <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'invoices' && <InvoicesTab onOpenMember={onOpenMember} />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'plans' && <PlansTab />}
        {tab === 'settings' && <GatewaySettings />}
      </View>
    </Screen>
  );
}
