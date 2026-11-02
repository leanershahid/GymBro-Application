// Money and status wording, as in the Unique Lights store (utils/format.ts).

const whole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Whole rupees for cards and lists: ₹12,499. */
export const formatPrice = (n: number | null | undefined) => whole.format(n ?? 0);

/** With paise for carts and totals: ₹12,499.00. */
export const formatMoney = (n: number | null | undefined) => exact.format(n ?? 0);

/** Short form for chart axes: ₹1.2L, ₹15k. */
export function formatCompact(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (n >= 1e3) return `₹${Math.round(n / 1e3)}k`;
  return `₹${Math.round(n)}`;
}

/** Order status as members read it: Pending is "Placed", Processing is "Packing". */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  Pending: 'Placed', Confirmed: 'Confirmed', Processing: 'Packing', Shipped: 'Shipped',
  OutForDelivery: 'Out for delivery', Delivered: 'Delivered', Cancelled: 'Cancelled',
};

export const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
