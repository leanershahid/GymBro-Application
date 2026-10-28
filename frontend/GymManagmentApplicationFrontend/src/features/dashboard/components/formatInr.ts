/**
 * Compact Indian-rupee formatting for dashboard figures:
 *   950 → ₹950 · 48_500 → ₹48.5K · 12_48_600 → ₹12.5L · 1_20_00_000 → ₹1.2Cr
 * `symbol: false` drops the ₹ (chart axes); `digits` forces the decimal places.
 */
export function formatInrCompact(value: number, opts: { symbol?: boolean; digits?: number } = {}): string {
  const { symbol = true, digits } = opts;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  let n = abs;
  let unit = '';
  if (abs >= 1e7)      { n = abs / 1e7; unit = 'Cr'; }
  else if (abs >= 1e5) { n = abs / 1e5; unit = 'L'; }
  else if (abs >= 1e3) { n = abs / 1e3; unit = 'K'; }

  const d = digits ?? (unit && n < 100 ? 1 : 0);
  let s = n.toFixed(d);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  return `${sign}${symbol ? '₹' : ''}${s}${unit}`;
}

/** "+12.4%" / "-3%" — one decimal at most. */
export function formatPct(pct: number): string {
  const r = Math.round(pct * 10) / 10;
  return `${r >= 0 ? '+' : ''}${r}%`;
}
