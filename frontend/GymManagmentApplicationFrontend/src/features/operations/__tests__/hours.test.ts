import { describe, expect, it } from '@jest/globals';
import { cleanWeek, copyMondayToWeekdays, dayError, formatClock, formatInterval, isOvernight, normalizeTime } from '../utils/hours';
import type { WeekdayHours } from '../types/operations.types';

const week = (): WeekdayHours[] => [1, 2, 3, 4, 5, 6, 0].map(day => ({ day, dayName: String(day), intervals: [] }));

describe('normalizeTime', () => {
  it('accepts common shapes', () => {
    expect(normalizeTime('6')).toBe('06:00');
    expect(normalizeTime('0630')).toBe('06:30');
    expect(normalizeTime('6:05')).toBe('06:05');
    expect(normalizeTime('18.30')).toBe('18:30');
    expect(normalizeTime('24:00')).toBe('00:00');
  });
  it('rejects nonsense', () => {
    expect(normalizeTime('25:00')).toBeNull();
    expect(normalizeTime('6am')).toBeNull();
    expect(normalizeTime('12:60')).toBeNull();
  });
});

describe('day validation', () => {
  it('flags overlaps and a non-final overnight interval', () => {
    expect(dayError([{ opens: '06:00', closes: '12:00' }, { opens: '11:00', closes: '14:00' }])).toMatch(/overlap/i);
    expect(dayError([{ opens: '20:00', closes: '02:00' }, { opens: '21:00', closes: '23:00' }])).toMatch(/midnight/i);
    expect(dayError([{ opens: 'x', closes: '12:00' }])).toMatch(/times/i);
    expect(dayError([{ opens: '06:00', closes: '12:00' }, { opens: '16:00', closes: '02:00' }])).toBeNull();
  });
  it('knows overnight intervals', () => {
    expect(isOvernight({ opens: '22:00', closes: '02:00' })).toBe(true);
    expect(isOvernight({ opens: '06:00', closes: '22:00' })).toBe(false);
  });
});

describe('editor helpers', () => {
  it('copies Monday to Tuesday–Friday only', () => {
    const w = week();
    w[0].intervals = [{ opens: '06:00', closes: '22:00' }];
    const copied = copyMondayToWeekdays(w);
    expect(copied.filter(d => d.intervals.length === 1).map(d => d.day)).toEqual([1, 2, 3, 4, 5]);
    copied[1].intervals[0].opens = '07:00';
    expect(copied[0].intervals[0].opens).toBe('06:00'); // deep copy
  });
  it('cleans and sorts intervals for saving', () => {
    const w = week();
    w[0].intervals = [{ opens: '16', closes: '2200' }, { opens: '6', closes: '12' }];
    expect(cleanWeek(w)[0].intervals).toEqual([{ opens: '06:00', closes: '12:00' }, { opens: '16:00', closes: '22:00' }]);
  });
  it('formats clocks', () => {
    expect(formatClock('06:00')).toBe('6am');
    expect(formatClock('22:30')).toBe('10:30pm');
    expect(formatClock('12:00')).toBe('12pm');
    expect(formatInterval({ opens: '00:00', closes: '00:00' })).toBe('Open 24 hours');
    expect(formatInterval({ opens: '22:00', closes: '02:00' })).toBe('10pm – 2am (next day)');
  });
});
