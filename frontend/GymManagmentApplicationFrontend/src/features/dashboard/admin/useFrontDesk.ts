import { useState } from 'react';
import { useCheckInMember } from '../../attendance/api/attendanceQueries';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { QuickAction } from '../components/QuickCreateSheet';
import { AdminScreen } from './adminRoutes';
import { AdminAccess } from './useAdminAccess';

export type PickFor = 'search' | 'check-in' | 'sell' | 'invoice';

/**
 * Front-desk tools for the admin area: member search/picker, the "+" quick actions, check-in,
 * and the member a new invoice or membership is for.
 */
export function useFrontDesk(access: AdminAccess, go: (s: AdminScreen) => void, open: (s: AdminScreen, id: number) => void) {
  const [pickFor, setPickFor] = useState<PickFor | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [invoiceFor, setInvoiceFor] = useState<number | null>(null);
  const [sellName, setSellName] = useState<string | undefined>(undefined);
  const checkIn = useCheckInMember();
  const { show: showToast } = useToast();

  const checkInMember = (userId: number) => checkIn.mutate(userId, {
    onSuccess: (r) => showToast({ type: r.success ? 'success' : 'error', message: r.message }),
    onError: (e) => showToast({ type: 'error', message: apiErrorText(e) }),
  });

  const onPicked = (m: { id: number; firstName: string; lastName: string }) => {
    const name = `${m.firstName} ${m.lastName}`.trim();
    const purpose = pickFor;
    if (purpose === 'check-in') { checkInMember(m.id); setPickFor(null); return; }
    setPickFor(null);
    if (purpose === 'search') open('member-detail', m.id);
    if (purpose === 'sell') { setSellName(name); open('new-membership', m.id); }
    if (purpose === 'invoice') { setInvoiceFor(m.id); go('new-invoice'); }
  };

  // Everyday actions for the "+" button — each only with the matching create permission.
  const quickActions: QuickAction[] = [
    access.attendance.canCreate && { key: 'check-in', label: 'Check in a member', hint: 'Record a visit at the front desk', icon: 'log-in', onPress: () => setPickFor('check-in') },
    access.members.canCreate && { key: 'add-member', label: 'Add member', hint: 'Create a new member profile', icon: 'user-plus', onPress: () => go('add-member') },
    access.billing.canCreate && { key: 'sell', label: 'Sell membership', hint: 'Pick a member, then a plan', icon: 'award', onPress: () => setPickFor('sell') },
    access.billing.canCreate && { key: 'invoice', label: 'New invoice', hint: 'Bill a member for anything', icon: 'file-plus', onPress: () => setPickFor('invoice') },
    access.pt.canCreate && { key: 'pt', label: 'Book PT session', hint: 'Schedule personal training', icon: 'clock', onPress: () => go('pt-sessions') },
    access.leads.canCreate && { key: 'lead', label: 'Add lead', hint: 'Log a walk-in or enquiry', icon: 'target', onPress: () => go('add-lead') },
  ].filter(Boolean) as QuickAction[];

  const pickerTitle = pickFor === 'check-in' ? 'Check in a member'
    : pickFor === 'sell' ? 'Sell membership to…'
    : pickFor === 'invoice' ? 'Invoice for…'
    : 'Find a member';

  return {
    pickFor, setPickFor, pickerTitle, onPicked,
    quickOpen, setQuickOpen, quickActions,
    invoiceFor, setInvoiceFor, sellName, setSellName,
    checkIn, checkInMember,
  };
}

export type FrontDesk = ReturnType<typeof useFrontDesk>;
