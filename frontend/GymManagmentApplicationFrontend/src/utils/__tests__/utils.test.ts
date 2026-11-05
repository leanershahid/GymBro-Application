import { describe, expect, it } from '@jest/globals';
import { withAlpha } from '../../theme';
import { makeScale } from '../useLayout';
import { isValidEmail } from '../validation';
import { guessMimeType } from '../../api/upload';
import { formatCompact } from '../../features/shop/common/format';

describe('withAlpha', () => {
  it('turns a hex token into rgba', () => {
    expect(withAlpha('#7ED321', 0.12)).toBe('rgba(126,211,33,0.12)');
    expect(withAlpha('#fff', 1)).toBe('rgba(255,255,255,1)');
  });
});

describe('makeScale', () => {
  it('is 1:1 on the 390×844 base design', () => {
    const s = makeScale(390, 844);
    expect(s.scaleW(10)).toBe(10);
    expect(s.scaleH(10)).toBe(10);
    expect(s.rs(13)).toBe(13);
  });
  it('clamps between 85% and 125%', () => {
    expect(makeScale(100, 100).scaleW(100)).toBeCloseTo(85);
    expect(makeScale(4000, 4000).scaleH(100)).toBeCloseTo(125);
  });
});

describe('isValidEmail', () => {
  it.each([
    ['a@b.co', true],
    ['first.last@gym.example.com', true],
    ['no-at.example.com', false],
    ['spaces in@x.com', false],
    ['a@b', false],
  ])('%s → %s', (email, expected) => {
    expect(isValidEmail(email)).toBe(expected);
  });
});

describe('guessMimeType', () => {
  it.each([
    ['file:///x/photo.PNG', 'image/png'],
    ['blob:abc.webp?x=1', 'image/webp'],
    ['/doc.pdf', 'application/pdf'],
    ['/clip.mov', 'video/quicktime'],
    ['/unknown', 'image/jpeg'],
  ])('%s → %s', (uri, type) => {
    expect(guessMimeType(uri)).toBe(type);
  });
});

describe('shop formatCompact', () => {
  it('uses Indian units for chart axes', () => {
    expect(formatCompact(25_000_000)).toBe('₹2.5Cr');
    expect(formatCompact(120_000)).toBe('₹1.2L');
    expect(formatCompact(100_000)).toBe('₹1L');
    expect(formatCompact(15_400)).toBe('₹15k');
    expect(formatCompact(999)).toBe('₹999');
  });
});
