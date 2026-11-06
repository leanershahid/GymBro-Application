// Shapes of /api/me/plans, /api/me/memberships/*, /api/me/membership(-requests) and the staff
// /api/membership-requests (Application/SelfService/SelfServiceDtos.cs, camelCased).
import type { MySubscription, MyInvoice, OnlineOrder } from '../../member-billing/types/memberBilling.types';

export interface PublicPlan {
  id: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  /** Daily | Weekly | Monthly | Quarterly | HalfYearly | Yearly | OneTime */
  billingCycle: string;
  durationDays: number;
  joiningFee: number;
  classCredits: number | null;
  ptSessions: number | null;
  accessHours: string | null;
  branchId: number | null;
  branchName: string | null;
  features: string[];
  isPopular: boolean;
  trialDays: number;
  isCurrent: boolean;
}

/** The gym's rules as shown to members (enforced on the server). */
export interface MemberRules {
  minimumTermMonths: number;
  noticeDays: number;
  maxFreezeDaysPerYear: number;
  minFreezeDays: number;
  freezeFee: number;
  cancellationFee: number;
  allowSelfCancel: boolean;
  allowOnlineJoin: boolean;
  taxPercent: number;
  maxStartDaysAhead: number;
  freezeNeedsApproval: boolean;
  cancelNeedsApproval: boolean;
  changeNeedsApproval: boolean;
}

export interface PlanCatalog {
  plans: PublicPlan[];
  rules: MemberRules;
  onlinePayments: boolean;
  currency: string;
}

export interface QuoteLine {
  label: string;
  amount: number;
  /** plan · joining_fee · discount · tax · fee · charge */
  kind: string;
}

export interface JoinQuotePayload {
  planId: number;
  /** "YYYY-MM-DD"; omitted = today. */
  startDate?: string;
  couponCode?: string;
}

export interface JoinQuote {
  planId: number;
  planName: string;
  billingCycle: string;
  durationDays: number;
  startDate: string;
  endDate: string;
  currency: string;
  lines: QuoteLine[];
  planPrice: number;
  joiningFee: number;
  subtotal: number;
  couponCode: string | null;
  couponApplied: boolean;
  couponMessage: string | null;
  discount: number;
  taxPercent: number;
  tax: number;
  total: number;
  renewalPrice: number;
  onlinePayments: boolean;
  /** "waiver" / "health" still open. */
  safetyMissing: string[];
  /** The gym's safety gate is on: checkout is refused until the safety steps are done. */
  safetyRequired: boolean;
  rules: MemberRules;
}

export interface CheckoutPayload extends JoinQuotePayload {
  acceptTerms: boolean;
  termsVersion?: string;
}

export interface CheckoutResult {
  membership: MySubscription;
  invoice: MyInvoice;
  quote: JoinQuote;
  order: OnlineOrder | null;
  payAtDesk: boolean;
  activated: boolean;
  reused: boolean;
}

export interface CancelPreview {
  lastDay: string;
  noticeEnd: string | null;
  minimumTermEnd: string | null;
  paidThrough: string | null;
  uncoveredDays: number;
  uncoveredCharge: number;
  cancellationFee: number;
  finalCharge: number;
  currency: string;
}

export type RequestType = 'freeze' | 'cancel' | 'change';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface MembershipRequest {
  id: number;
  membershipId: number;
  memberId: number;
  memberName: string | null;
  planName: string | null;
  type: RequestType;
  status: RequestStatus;
  reasonCode: string | null;
  reason: string | null;
  requestedAt: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  newPlanId: number | null;
  newPlanName: string | null;
  fee: number;
  currency: string;
  invoiceId: number | null;
  autoApproved: boolean;
  decidedBy: number | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  appliedAt: string | null;
  completedAt: string | null;
  membershipStatus: string | null;
}

export interface MyMembership {
  current: MySubscription | null;
  plan: PublicPlan | null;
  rules: MemberRules;
  freezeDaysUsedThisYear: number;
  freezeDaysLeftThisYear: number;
  cancelPreview: CancelPreview | null;
  openRequests: MembershipRequest[];
  pendingInvoice: MyInvoice | null;
  canFreeze: boolean;
  canCancel: boolean;
  canChangePlan: boolean;
  onlinePayments: boolean;
}

export interface RequestPayload {
  type: RequestType;
  membershipId?: number;
  from?: string;
  to?: string;
  newPlanId?: number;
  reasonCode?: string;
  reason?: string;
}

export interface RequestPreview {
  type: RequestType;
  allowed: boolean;
  problem: string | null;
  needsApproval: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  days: number | null;
  fee: number;
  currency: string;
  lines: QuoteLine[];
  summary: string;
  changeKind: 'upgrade' | 'downgrade' | null;
  newPlanName: string | null;
  canPauseInstead: boolean;
  freezeDaysLeft: number;
  cancel: CancelPreview | null;
}

/** Staff: the gym's membership rules (TenantSettings "membership-rules"). */
export interface MembershipRulesSettings {
  minimumTermMonths: number;
  noticeDays: number;
  maxFreezeDaysPerYear: number;
  minFreezeDays: number;
  freezeFee: number;
  cancellationFee: number;
  allowSelfCancel: boolean;
  allowOnlineJoin: boolean;
  taxPercent: number;
  maxStartDaysAhead: number;
  freezeApproval: 'auto' | 'staff';
  cancelApproval: 'auto' | 'staff';
  changeApproval: 'auto' | 'staff';
}

export interface RequestsPage {
  items: MembershipRequest[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages?: number;
}
