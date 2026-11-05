import { useWindowDimensions } from 'react-native';
import { SP } from '../theme';

// Breakpoints — phone: w < 480 · tablet: 480 ≤ w < 768 · desktop: w ≥ 768
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet  = width >= 480;
  const isDesktop = width >= 768;

  // Screen horizontal padding: 20 (spec) → 24 → 40
  const hPad = isDesktop ? 40 : isTablet ? 24 : SP.xl;

  // Card grid: 1 → 2 → 3 columns
  const cols = isDesktop ? 3 : isTablet ? 2 : 1;
  const cardGap = SP.md;
  const contentW = width - hPad * 2;
  const cardW = cols > 1 ? (contentW - cardGap * (cols - 1)) / cols : contentW;

  /** Width of one tile when `n` tiles share a row with `gap` between them. */
  const tileW = (n: number, gap: number = cardGap) => Math.floor((contentW - gap * (n - 1)) / n);

  /** Columns for a grid of small tiles (icons/stats): 3 on phones, more as space allows. */
  const tileCols = width >= 768 ? 6 : width >= 480 ? 4 : 3;

  const scale = isDesktop ? 1.1 : isTablet ? 1.05 : 1;

  return { width, height, isTablet, isDesktop, hPad, cols, cardW, cardGap, contentW, tileW, tileCols, scale };
}

// ── Design-size scaling (390×844 base) ───────────────────────────────────────
// Replaces the module-level helpers in utils/scale.ts, which read the window size once at
// start-up and so never adapt to rotation / browser resizing (ARCH-129).

const BASE_W = 390;
const BASE_H = 844;
// Never below 85% (usable touch targets, legible text) or above 125% (no giant tablet UI).
const clampFactor = (f: number) => Math.min(1.25, Math.max(0.85, f));

export interface Scale {
  /** Horizontal size from the 390-wide design. */
  scaleW: (px: number) => number;
  /** Vertical size from the 844-high design. */
  scaleH: (px: number) => number;
  /** Rounded horizontal scale, for fonts and radii. */
  rs: (px: number) => number;
}

/** Scale helpers for a given window size (pure; see useScale for the reactive version). */
export function makeScale(width: number, height: number): Scale {
  const fw = clampFactor(width / BASE_W);
  const fh = clampFactor(height / BASE_H);
  return { scaleW: px => fw * px, scaleH: px => fh * px, rs: px => Math.round(fw * px) };
}

/** scaleW / scaleH / rs that follow the current window size. */
export function useScale(): Scale {
  const { width, height } = useWindowDimensions();
  return makeScale(width, height);
}
