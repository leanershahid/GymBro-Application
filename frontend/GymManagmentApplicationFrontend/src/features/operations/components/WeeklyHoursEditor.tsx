import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import type { Interval, WeekdayHours } from '../types/operations.types';
import { copyMondayToWeekdays, dayError, isOvernight, normalizeTime } from '../utils/hours';
import { IconButton, TimeField } from './OperationsUi';

interface Props {
  value: WeekdayHours[];
  onChange: (week: WeekdayHours[]) => void;
}

const DEFAULT_INTERVAL: Interval = { opens: '06:00', closes: '22:00' };

/**
 * Weekly opening hours, one row per day (mobile friendly: no grid to pinch). Each day can be
 * closed or have several intervals; "Copy Monday to weekdays" fills Tue–Fri.
 */
export default function WeeklyHoursEditor({ value, onChange }: Props) {
  const setDay = (day: number, intervals: Interval[]) =>
    onChange(value.map(d => (d.day === day ? { ...d, intervals } : d)));

  return (
    <View style={{ gap: SP.md }}>
      <Pressable
        onPress={() => onChange(copyMondayToWeekdays(value))}
        accessibilityRole="button"
        accessibilityLabel="Copy Monday's hours to Tuesday through Friday"
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, minHeight: 44, paddingHorizontal: SP.lg,
          borderRadius: R.pill, borderWidth: 1, borderColor: T.line, backgroundColor: pressed ? T.bgInputActive : T.bgInput,
        })}
      >
        <Feather name="copy" size={15} color={T.text} />
        <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>Copy Monday to weekdays</Text>
      </Pressable>

      {value.map(d => <DayRow key={d.day} day={d} onChange={iv => setDay(d.day, iv)} />)}
    </View>
  );
}

function DayRow({ day, onChange }: { day: WeekdayHours; onChange: (intervals: Interval[]) => void }) {
  const closed = day.intervals.length === 0;
  const error = dayError(day.intervals);
  const update = (i: number, patch: Partial<Interval>) => onChange(day.intervals.map((iv, k) => (k === i ? { ...iv, ...patch } : iv)));
  const addInterval = () => {
    const last = day.intervals[day.intervals.length - 1];
    const lastClose = last ? normalizeTime(last.closes) : null;
    // A sensible next slot: an hour after the last one closes, else the default day.
    const next = lastClose && !isOvernight({ opens: normalizeTime(last.opens) ?? '00:00', closes: lastClose })
      ? { opens: lastClose, closes: '22:00' } : DEFAULT_INTERVAL;
    onChange([...day.intervals, next]);
  };

  return (
    <View
      style={{
        backgroundColor: T.bgInput, borderRadius: R.lg, padding: SP.md, borderWidth: 1,
        borderColor: error ? withAlpha(T.err, 0.5) : T.line,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
        <Text accessibilityRole="header" style={{ color: T.text, fontSize: 15, fontWeight: '700', flex: 1 }}>{day.dayName}</Text>
        <Pressable
          onPress={() => onChange(closed ? [DEFAULT_INTERVAL] : [])}
          accessibilityRole="switch"
          accessibilityState={{ checked: !closed }}
          accessibilityLabel={`${day.dayName} open`}
          style={{
            minHeight: 36, paddingHorizontal: 14, borderRadius: R.pill, justifyContent: 'center',
            backgroundColor: closed ? withAlpha(T.err, 0.12) : withAlpha(T.ok, 0.12),
            borderWidth: 1, borderColor: closed ? withAlpha(T.err, 0.3) : withAlpha(T.ok, 0.3),
          }}
        >
          <Text style={{ color: closed ? T.err : T.ok, fontSize: 13, fontWeight: '700' }}>{closed ? 'Closed' : 'Open'}</Text>
        </Pressable>
      </View>

      {day.intervals.map((iv, i) => {
        const overnight = normalizeTime(iv.opens) && normalizeTime(iv.closes)
          && isOvernight({ opens: normalizeTime(iv.opens)!, closes: normalizeTime(iv.closes)! });
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginTop: SP.sm, flexWrap: 'wrap' }}>
            <TimeField label={`${day.dayName} interval ${i + 1} opens`} value={iv.opens} onChange={v => update(i, { opens: v })} invalid={!normalizeTime(iv.opens)} />
            <Text style={{ color: T.textFaint, fontSize: 14 }}>to</Text>
            <TimeField label={`${day.dayName} interval ${i + 1} closes`} value={iv.closes} onChange={v => update(i, { closes: v })} invalid={!normalizeTime(iv.closes)} />
            <View style={{ flex: 1, minWidth: 8 }}>
              {overnight && (
                <Text style={{ color: T.brandGold, fontSize: 12 }}>
                  {iv.opens === iv.closes ? '24 hours' : 'next day'}
                </Text>
              )}
            </View>
            <IconButton icon="trash-2" label={`Remove ${day.dayName} interval ${i + 1}`} tone={T.textSub} onPress={() => onChange(day.intervals.filter((_, k) => k !== i))} />
          </View>
        );
      })}

      {!closed && (
        <Pressable
          onPress={addInterval}
          disabled={day.intervals.length >= 6}
          accessibilityRole="button"
          accessibilityLabel={`Add an interval on ${day.dayName}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, marginTop: SP.xs, alignSelf: 'flex-start', opacity: day.intervals.length >= 6 ? 0.4 : 1 }}
        >
          <Feather name="plus" size={16} color={T.brand} />
          <Text style={{ color: T.brand, fontSize: 14, fontWeight: '600' }}>Add interval</Text>
        </Pressable>
      )}
      {error && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 12, marginTop: SP.xs }}>{error}</Text>}
    </View>
  );
}
