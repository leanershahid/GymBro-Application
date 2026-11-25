import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import type { BuilderDay } from '../api/training.types';
import { dayTitle, weekdayOf } from './builderUtils';
import { IconBtn } from './BuilderUi';

interface Props {
  day: BuilderDay;
  /** Grid cell (wide screens) vs a full-width row (phones). */
  compact?: boolean;
  busy?: boolean;
  canEdit: boolean;
  onOpen: (d: BuilderDay) => void;
  onMenu: (d: BuilderDay) => void;
}

/** One day of the week grid: title, Rest chip or the first exercises + minutes, and a ⋯ menu. */
function DayCard({ day, compact, busy, canEdit, onOpen, onMenu }: Props) {
  const rest = day.isRestDay;
  const empty = !rest && day.exerciseCount === 0;
  const title = dayTitle(day);
  const names = day.exerciseNames.slice(0, 3);
  const more = day.exerciseCount - names.length;
  const summary = rest ? 'Rest day' : empty ? 'Empty' : `${day.exerciseCount} exercises`;

  return (
    <View style={{
      flex: compact ? 1 : undefined, minWidth: 0, backgroundColor: rest ? T.bg : T.bgInput, borderRadius: R.lg,
      borderWidth: 1, borderColor: empty ? T.line : rest ? T.line : T.bgInputActive, borderStyle: empty ? 'dashed' : 'solid',
      opacity: busy ? 0.6 : 1, minHeight: compact ? 168 : undefined,
    }}>
      <Pressable
        onPress={() => onOpen(day)}
        accessibilityRole="button"
        accessibilityLabel={`${weekdayOf(day.dayNumber)}, ${title}, ${summary}`}
        accessibilityHint={rest ? 'Opens the day menu' : canEdit ? 'Opens the day editor' : 'Shows the day'}
        style={({ pressed }) => ({ flex: 1, padding: compact ? SP.sm + 2 : SP.md, borderRadius: R.lg, backgroundColor: pressed ? T.bgInputActive : 'transparent' })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingRight: canEdit ? 30 : 0 }}>
          <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 }}>{weekdayOf(day.dayNumber)}</Text>
          {day.hasSuperset && !rest && <Feather name="link" size={11} color={T.violet} />}
        </View>
        <Text numberOfLines={compact ? 2 : 1} style={{ color: rest ? T.textSub : T.text, fontSize: compact ? 14 : 15, fontWeight: '800', marginBottom: 6 }}>{title}</Text>

        {rest && (
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: withAlpha(T.sky, 0.12), borderWidth: 1, borderColor: withAlpha(T.sky, 0.3) }}>
            <Feather name="moon" size={11} color={T.sky} />
            <Text style={{ color: T.sky, fontSize: 11, fontWeight: '700' }}>Rest</Text>
          </View>
        )}
        {empty && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="plus" size={13} color={T.textFaint} />
            <Text style={{ color: T.textFaint, fontSize: 12 }}>{canEdit ? 'Add exercises' : 'Nothing planned'}</Text>
          </View>
        )}
        {!rest && !empty && (
          <>
            {names.map((n, i) => (
              <Text key={`${n}-${i}`} numberOfLines={1} style={{ color: T.textSub, fontSize: 12, lineHeight: 17 }}>• {n}</Text>
            ))}
            {more > 0 && <Text style={{ color: T.textFaint, fontSize: 12 }}>+{more} more</Text>}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <Text style={{ color: T.brand, fontSize: 11, fontWeight: '700' }}>{day.exerciseCount} ex</Text>
              {!!day.estimatedMinutes && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Feather name="clock" size={11} color={T.textFaint} />
                  <Text style={{ color: T.textFaint, fontSize: 11 }}>~{day.estimatedMinutes} min</Text>
                </View>
              )}
            </View>
          </>
        )}
      </Pressable>
      {canEdit && (
        <View style={{ position: 'absolute', top: 6, right: 6 }}>
          <IconBtn icon="more-horizontal" label={`Actions for ${weekdayOf(day.dayNumber)} ${title}`} onPress={() => onMenu(day)} size={28} />
        </View>
      )}
    </View>
  );
}

export default React.memo(DayCard);
