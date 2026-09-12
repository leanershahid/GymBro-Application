// ─── Design Tokens ────────────────────────────────────────────────
// Dark mode. Green → gold gradient accent. Nike × premium gym aesthetic.

export const T = {
  bg:            '#0A0F0A',
  bgPanel:       '#0A0F0A',
  bgInput:       '#151915',
  bgInputActive: '#1C211C',

  line:       '#242B24',
  lineSubtle: '#151915',
  lineBright: '#7ED321',

  text:         '#FFFFFF',
  textSub:      '#AAB2AA',
  textFaint:    '#6B726B',
  textDisabled: '#454B45',

  brand:       '#7ED321',
  brandDark:   '#5FA317',
  brandGold:   '#FFC107',
  brandDim:    'rgba(126,211,33,0.10)',
  brandBorder: 'rgba(126,211,33,0.25)',
  // For LinearGradient's `colors` prop — the signature accent treatment for
  // buttons, progress rings, and the active nav highlight.
  brandGradient: ['#7ED321', '#FFC107'] as const,

  onBrand: '#000000',

  ok:    '#22C55E',
  okDim: 'rgba(34,197,94,0.12)',
  err:   '#EF4444',
  errDim:'rgba(239,68,68,0.10)',

  // Secondary accents for health metrics (heart rate / water & sleep / sleep).
  rose:   '#FF4D6D',
  sky:    '#4DA6FF',
  violet: '#9B7EF0',

  // Alias kept for existing call sites (AddBranchPage/AddTenantPage/dashboard header cards).
  border: '#242B24',
};

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
