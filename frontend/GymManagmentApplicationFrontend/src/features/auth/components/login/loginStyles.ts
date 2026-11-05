import { StyleSheet } from 'react-native';
import { scaleW, scaleH, rs } from '../../../../utils/scale';
import { T, withAlpha } from '../../../../theme';

/** Scaled font size that never drops below the 11px legibility floor. */
export const fs = (px: number) => Math.max(11, rs(px));

// ─── Styles ───────────────────────────────────────────────────────────────────
export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },

  heroOverlay: {
    backgroundColor: withAlpha(T.black, 0.48),
  },

  // GymManager label — always sits just above the sheet's top edge
  heroLabel: {
    position: 'absolute',
    left: scaleW(16),
    alignItems: 'flex-start',
  },

  // Fills the screen; the sheet is pushed to the bottom and shrinks when the keyboard opens.
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    flexShrink: 1,
    backgroundColor: withAlpha(T.bgInput, 0.72),
    borderTopLeftRadius: rs(28),
    borderTopRightRadius: rs(28),
    overflow: 'hidden',
  },
  sheetContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: scaleW(20),
    paddingTop: scaleH(24),
  },

  headline: {
    fontSize: fs(22),
    fontWeight: '800',
    color: T.text,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: scaleH(12),
  },

  tabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: scaleH(14),
  },
  tabActive: {
    alignItems: 'center',
    paddingBottom: scaleH(4),
  },
  tabTextActive: {
    fontSize: fs(15),
    fontWeight: '700',
    color: T.text,
  },
  tabUnderline: {
    marginTop: scaleH(4),
    width: '100%',
    height: 2,
    borderRadius: 1,
    backgroundColor: T.brand,
  },

  hairline: {
    height: 1,
    backgroundColor: T.line,
    marginBottom: scaleH(14),
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: withAlpha(T.err, 0.12),
    borderRadius: rs(12),
    paddingHorizontal: scaleW(12),
    paddingVertical: scaleH(10),
    marginBottom: scaleH(10),
    gap: scaleW(8),
    overflow: 'hidden',
  },
  errorAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: rs(4),
    backgroundColor: T.err,
  },
  errorIconWrap: {
    marginLeft: scaleW(4),
  },
  errorText: {
    flex: 1,
    fontSize: fs(13),
    fontWeight: '600',
    color: T.text,
    lineHeight: rs(18),
  },

  inputsStack: {
    gap: scaleH(10),
  },  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Math.max(48, scaleH(50)),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.bgInputActive,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: scaleW(20),
    fontSize: fs(14),
    color: T.text,
    height: '100%',
  },
  showHideBtn: {
    paddingHorizontal: scaleW(16),
    minHeight: 44,
    justifyContent: 'center',
  },
  showHideText: {
    fontSize: fs(12),
    fontWeight: '600',
    color: T.brand,
  },

  ctaWrapper: {
    marginTop: scaleH(18),
  },
  ctaButton: {
    height: Math.max(48, scaleH(52)),
    borderRadius: 999,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: fs(16),
    fontWeight: '700',
    color: T.onBrand,
    letterSpacing: 0.3,
  },

  linkBtn: {
    alignSelf: 'flex-end',
    marginTop: scaleH(10),
    marginRight: scaleW(8),
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scaleH(14),
    paddingHorizontal: scaleW(8),
  },
  linkText: {
    fontSize: fs(13),
    fontWeight: '600',
    color: T.brand,
  },
  notice: {
    fontSize: fs(13),
    color: T.text,
    backgroundColor: withAlpha(T.brand, 0.12),
    borderRadius: 12,
    padding: scaleH(10),
    marginBottom: scaleH(10),
  },
  fieldError: {
    fontSize: fs(12),
    color: T.err,
    marginTop: scaleH(4),
    marginLeft: scaleW(16),
  },
});
