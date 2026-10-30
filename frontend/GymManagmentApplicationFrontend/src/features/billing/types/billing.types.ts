// Shapes mirror Application/Billing/{Requests,Responses} on the backend.

/** Values the server accepts when creating/updating a plan. */
export type BillingCycleInput =
  | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'annual' | 'one-time';

/** Desk payment methods (PaymentService.ParseMethod). */
export type PayMethod = 'cash' | 'upi' | 'card' | 'netbanking' | 'cheque' | 'wallet';

/** List filters the invoice endpoint understands. */
export type InvoiceFilter = 'all' | 'unpaid' | 'paid' | 'refunded';

export interface MembershipPlan {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  /** Enum name from the server: Daily | Weekly | Monthly | Quarterly | HalfYearly | Yearly | OneTime */
  billingCycle: string;
  durationDays: number;
  features: string[];
  isPublic: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CreatePlanPayload {
  tenantId: number;
  name: string;
  description?: string | null;
  price: number;
  billingCycle: BillingCycleInput;
  features: string[];
  isPublic?: boolean;
}

export interface UpdatePlanPayload {
  name?: string;
  description?: string | null;
  price?: number;
  billingCycle?: BillingCycleInput;
  isPublic?: boolean;
  isActive?: boolean;
}

/** Status: Active | Paused (frozen) | Cancelled | Expired | Trial | Pending */
export interface Subscription {
  id: number;
  tenantId: number;
  memberId: number;
  planId: number;
  planName: string;
  status: string;
  startDate: string;
  endDate: string | null;
  frozenFrom: string | null;
  frozenUntil: string | null;
  nextRenewalDate: string | null;
  price: number;
  currency: string;
  createdAt: string;
  memberName: string | null;
  autoRenew: boolean;
  invoiceId: number | null;
}

export interface SubscriptionUsage {
  subscriptionId: number;
  classBookingsUsed: number;
  ptSessionsUsed: number;
  visits: number;
  daysActive: number;
  daysRemaining: number;
}

/** Tax/discount/pay-now block shared by create and renew. */
export interface ChargeOptions {
  taxPercent: number;
  discount: number;
  /** Empty = leave the invoice due. */
  payNowMethod?: PayMethod | '';
  paymentReference?: string;
}

export interface CreateSubscriptionPayload extends ChargeOptions {
  tenantId: number;
  memberId: number;
  planId: number;
  /** YYYY-MM-DD */
  startDate: string;
}

export interface InvoiceItem {
  description: string;
  unitPrice: number;
  quantity: number;
}

/** Status: Draft | Sent | Paid | Overdue | Void | Refunded */
export interface Invoice {
  id: number;
  tenantId: number;
  memberId: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  status: string;
  dueDate: string | null;
  issuedAt: string;
  notes: string | null;
  invoiceNo: string;
  amountPaid: number;
  balance: number;
  paidAt: string | null;
  membershipId: number | null;
  memberName: string | null;
  items: InvoiceItem[];
}

export interface CreateInvoicePayload {
  tenantId: number;
  memberId: number;
  items: InvoiceItem[];
  taxPercent: number;
  discount: number;
  /** YYYY-MM-DD */
  dueDate?: string | null;
  notes?: string | null;
}

/** Status: Pending | Completed | Failed | Refunded */
export interface Payment {
  id: number;
  tenantId: number;
  memberId: number;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  gatewayRef: string | null;
  paidAt: string;
  invoiceId: number;
  invoiceNo: string | null;
  method: string;
  reference: string | null;
  refundedAmount: number;
  memberName: string | null;
}

export interface ChargePayload {
  tenantId: number;
  memberId: number;
  invoiceId?: number;
  amount: number;
  description?: string;
  method: PayMethod;
  reference?: string;
  notes?: string;
}

export interface RefundPayload {
  paymentId: number;
  /** Omit for a full refund. */
  amount?: number;
  reason?: string;
}

export interface GatewayStatus {
  provider: string;
  configured: boolean;
  isActive: boolean;
  keyId: string | null;
}

export interface SaveGatewayPayload {
  keyId: string;
  /** Blank = keep the stored secret. */
  keySecret?: string;
  isActive: boolean;
}
