import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../../theme';
import { RestState, restProgress } from '../../utils/restTimer';
import { fmtClock } from '../../utils/playerModel';

interface Props {
  rest: RestState;
  onAdd: () => void;
  onSkip: () => void;
}

/** Rest countdown above the Finish bar: time left, progress, +15 s and Skip. */
export default function RestTimerBar({ rest, onAdd, onSkip }: Props) {
  if (rest.status === 'idle') return null;
  const finished = rest.status === 'finished';
  const pct = `${Math.round(restProgress(rest) * 100)}%` as `${number}%`;
  return (
    <View accessibilityLiveRegion="polite" style={{
      marginHorizontal: 16, marginBottom: 8, borderRadius: R.lg, overflow: 'hidden',
      backgroundColor: finished ? T.brand : T.bgInputActive, borderWidth: 1, borderColor: finished ? T.brand : T.brandBorder,
    }}>
      {!finished && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct, backgroundColor: withAlpha(T.brand, 0.14) }} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 6, minHeight: 56 }}>
        <Feather name={finished ? 'bell' : 'clock'} size={18} color={finished ? T.onBrand : T.brand} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text accessibilityLabel={finished ? 'Rest over' : `Rest, ${rest.remaining} seconds left`}
            style={{ color: finished ? T.onBrand : T.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
            {finished ? 'Rest over — go!' : fmtClock(rest.remaining)}
          </Text>
          {!!rest.label && <Text numberOfLines={1} style={{ color: finished ? T.onBrand : T.textSub, fontSize: 11 }}>{finished ? `Next: ${rest.label}` : `Rest · next ${rest.label}`}</Text>}
        </View>
        {!finished && (
          <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add 15 seconds of rest"
            style={({ pressed }) => ({ minWidth: 56, minHeight: 44, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', marginRight: 6, backgroundColor: pressed ? T.line : T.bgInput })}>
            <Text style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>+15s</Text>
          </Pressable>
        )}
        <Pressable onPress={onSkip} accessibilityRole="button" accessibilityLabel={finished ? 'Dismiss' : 'Skip rest'}
          style={({ pressed }) => ({ minWidth: 56, minHeight: 44, paddingHorizontal: 12, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: finished ? withAlpha(T.black, pressed ? 0.25 : 0.15) : pressed ? T.brandDark : T.brand })}>
          <Text style={{ color: T.onBrand, fontSize: 13, fontWeight: '800' }}>{finished ? 'OK' : 'Skip'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
