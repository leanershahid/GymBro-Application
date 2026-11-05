/**
 * Shared money and date formatting (ARCH-139). Feature helpers (billing fmtMoney, classes
 * fmtMoney, member-billing/member-booking formatMoney, shop formatPrice/formatMoney,
 * MemberDetailPage) are thin wrappers over these so every screen formats the same way.
 */

const moneyCache = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string, fractionDigits?: number, locale?: string): Intl.NumberFormat {
  const key = `${locale ?? ''}|${currency}|${fractionDigits ?? ''}`;
  let f = moneyCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...(fractionDigits != null ? { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits } : {}),
    });
    moneyCache.set(key, f);
  }
  return f;
}

export interface MoneyOptions {
  /** Used when the record has no currency. Without it, a currency-less amount prints as "12.50". */
  defaultCurrency?: string;
  /** Return '' for null/undefined instead of formatting 0. */
  emptyForNull?: boolean;
  /** Fixed number of decimals (0 for whole rupees). Default: the currency's own. */
  fractionDigits?: number;
  /** BCP-47 locale; default the device locale. */
  locale?: string;
}

/** Money in the record's own currency, in the device locale: "₹1,500.00". */
export function formatMoney(amount: number | null | undefined, currency?: string | null, opts: MoneyOptions = {}): string {
  if (amount == null && opts.emptyForNull) return '';
  const n = Number.isFinite(amount) ? Number(amount) : 0;
  const cur = (currency || opts.defaultCurrency || '').toUpperCase();
  if (!cur) return n.toFixed(opts.fractionDigits ?? 2);
  try {
    return moneyFormatter(cur, opts.fractionDigits, opts.locale).format(n);
  } catch {
    return `${cur} ${n.toFixed(opts.fractionDigits ?? 2)}`;
  }
}

/** "YYYY-MM-DD" (date-only, read as a local calendar day) or ISO datetime → Date, or null. */
export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "29 Oct 2026"; `fallback` for empty values (default "—"). Unparseable input is returned as-is. */
export function formatDate(s: string | null | undefined, fallback = '—'): string {
  if (!s) return fallback;
  const d = parseDate(s);
  return d ? d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : s;
}

/** "29 Oct, 06:30 PM". */
export function formatDateTime(s: string | null | undefined, fallback = '—'): string {
  const d = parseDate(s);
  return d ? d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : fallback;
}
