import { PillTone, toneForStatus } from '../../common/components/StatusPill';

export function invoiceTone(status: string): PillTone {
  switch (status.toLowerCase()) {
    case 'paid': return 'ok';
    case 'overdue': return 'err';
    case 'sent': return 'warn';
    case 'void': case 'refunded': case 'draft': return 'neutral';
    default: return toneForStatus(status);
  }
}

export function paymentTone(status: string): PillTone {
  switch (status.toLowerCase()) {
    case 'completed': return 'ok';
    case 'failed': return 'err';
    case 'pending': return 'warn';
    case 'refunded': return 'info';
    default: return toneForStatus(status);
  }
}

export function membershipTone(status: string): PillTone {
  switch (status.toLowerCase()) {
    case 'active': return 'ok';
    case 'paused': case 'frozen': case 'pending': return 'warn';
    case 'trial': return 'info';
    case 'expired': return 'neutral';
    case 'cancelled': return 'err';
    default: return toneForStatus(status);
  }
}
