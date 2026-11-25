import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import type { WeekStripDay } from '../../training/api/training.types';
import { StripChip, stripChips } from '../utils/planCalendar';

interface Props {
  days: WeekStripDay[];
  /** Tap on a day (any day in the plan); rest days and moved days open the week view instead. */
  onPressDay?: (chip: StripChip) => void;
}

type FeatherName = React.ComponentProps<typeof Feather>['name'];
const ICON: Partial<Record<StripChip['state'], { name: FeatherName; color: string }>> = {
  done: { name: 'check', color: T.onBrand },
  skipped: { name: 'x', color: T.textSub },
  moved: { name: 'corner-up-right', color: T.sky },
  missed: { name: 'alert-circle', color: T.err },
  rest: { name: 'moon', color: T.sky },
};

/** "This week" — Mon–Sun chips: title or Rest, ✓ done, ⨯ skipped, today highlighted. */
export default function WeekStrip({ days, onPressDay }: Props) {
  const chips = stripChips(days);
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="list" accessibilityLabel="This week">
      {chips.map(c => {
        const icon = ICON[c.state];
        const tappable = !!onPressDay && c.state !== 'off';
        const done = c.state === 'done';
        return (
          <Pressable
            key={c.date}
            disabled={!tappable}
            onPress={() => onPressDay?.(c)}
            accessibilityRole="button"
            accessibilityLabel={c.a11y}
            accessibilityState={{ selected: c.isToday, disabled: !tappable }}
            style={({ pressed }) => ({
              flex: 1, minWidth: 0, minHeight: 84, borderRadius: R.md, paddingVertical: 8, paddingHorizontal: 2,
              alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: c.isToday ? T.brandDim : pressed ? T.bgInputActive : T.bgInput,
              borderWidth: 1, borderColor: c.isToday ? T.brand : T.line,
              opacity: c.state === 'off' ? 0.45 : 1,
            })}>
            <Text style={{ color: c.isToday ? T.brand : T.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
              {c.isToday ? 'Today' : c.weekday}
            </Text>
            <View style={{
              width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginVertical: 3,
              backgroundColor: done ? T.brand : c.state === 'missed' ? withAlpha(T.err, 0.12) : c.state === 'rest' ? withAlpha(T.sky, 0.10) : T.bgInputActive,
              borderWidth: c.state === 'planned' ? 1 : 0, borderColor: c.isToday ? T.brand : T.line,
            }}>
              {icon ? <Feather name={icon.name} size={13} color={icon.color} />
                : <Text style={{ color: T.text, fontSize: 12, fontWeight: '700' }}>{c.dayOfMonth}</Text>}
            </View>
            <Text numberOfLines={1} style={{
              color: c.state === 'planned' || done ? T.text : T.textSub, fontSize: 10, fontWeight: '600', maxWidth: '100%',
              textDecorationLine: c.state === 'skipped' ? 'line-through' : 'none',
            }}>
              {c.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
