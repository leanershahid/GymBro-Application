// ─── Design Tokens ────────────────────────────────────────────────
// Dark mode. Green → gold gradient accent. Nike × premium gym aesthetic.
// The single source of truth for colours (solid values in theme.colors.json, shared with
// tailwind.config.js for NativeWind classes). Never hardcode a hex/rgba value in a screen; use a token or withAlpha(token, a).

import C from './theme.colors.json';

export const T = {
  // Solid colours live in theme.colors.json, which tailwind.config.js also reads, so NativeWind
  // classes and T can't drift apart (ARCH-127). Add new solid colours there.
  ...C,

  brandDim:    'rgba(126,211,33,0.10)',
  brandBorder: 'rgba(126,211,33,0.25)',
  // For LinearGradient's `colors` prop — the signature accent treatment for
  // buttons, progress rings, and the active nav highlight.
  brandGradient: [C.brand, C.brandGold] as const,

  // Scrims over imagery.
  overlay: 'rgba(0,0,0,0.55)',

  okDim: 'rgba(34,197,94,0.12)',
  errDim:'rgba(239,68,68,0.10)',

  // Alias kept for existing call sites (AddBranchPage/AddTenantPage/dashboard header cards).
  border: C.line,
};

/** Token colour with opacity, e.g. withAlpha(T.brand, 0.12) for a tinted badge background. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export const Shadow = {
  card:  { shadowColor: '#000',    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.40, shadowRadius: 14, elevation: 7 },
  neon:  { shadowColor: '#7ED321', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 9 },
  sm:    { shadowColor: '#000',    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 5,  elevation: 3 },
};

export const TY = {
  xs:    { fontSize: 11, lineHeight: 15 },
  sm:    { fontSize: 13, lineHeight: 18 },
  base:  { fontSize: 15, lineHeight: 22 },
  lg:    { fontSize: 17, lineHeight: 24 },
  xl:    { fontSize: 20, lineHeight: 28 },
  xxl:   { fontSize: 28, lineHeight: 36 },
  label: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4, textTransform: 'uppercase' as const },
};

export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const R  = { sm: 6, md: 12, lg: 16, xl: 20, pill: 999, full: 999 };
