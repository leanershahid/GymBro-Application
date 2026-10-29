// Shapes of /me/billing/* (Application/Billing/Responses/BillingResponses.cs, camelCased).

/** Active | Paused | Expired | Cancelled | Trial | Pending */
export type MembershipStatus = string;

export interface MySubscription {
  id: number;
  planId: number;
  planName: string;
  status: MembershipStatus;
  /** DateOnly — "YYYY-MM-DD". */
  startDate: string;
  endDate: string | null;
  frozenFrom: string | null;
  frozenUntil: string | null;
  nextRenewalDate: string | null;
  price: number;
  currency: string;
  autoRenew: boolean;
  createdAt: string;
  invoiceId: number | null;
}

export interface MyInvoiceItem {
  description: string;
  unitPrice: number;
  quantity: number;
}

/** Draft | Sent | Paid | Overdue | Void | Refunded */
export interface MyInvoice {
  id: number;
  invoiceNo: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  currency: string;
  status: string;
  dueDate: string | null;
  issuedAt: string;
  paidAt: string | null;
  notes: string | null;
  membershipId: number | null;
  items: MyInvoiceItem[];
}

/** Status: Pending | Completed | Failed | Refunded */
export interface MyPayment {
  id: number;
  amount: number;
  currency: string;
  method: string;
  status: string;
  description: string | null;
  reference: string | null;
  invoiceId: number;
  invoiceNo: string | null;
  paidAt: string;
  refundedAmount: number;
}

export interface OnlinePaymentsStatus {
  enabled: boolean;
}

export interface OnlineOrder {
  provider: string;
  keyId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  invoiceId: number;
  invoiceNo: string;
  gymName: string | null;
  memberName: string | null;
  memberEmail: string | null;
  memberPhone: string | null;
}

export interface VerifyPaymentPayload {
  invoiceId: number;
  orderId: string;
  paymentId: string;
  signature: string;
}

/** What Razorpay Checkout hands back to `handler`. */
export interface CheckoutSuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
