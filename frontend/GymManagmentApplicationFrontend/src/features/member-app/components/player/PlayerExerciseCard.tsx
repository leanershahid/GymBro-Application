import React from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../../theme';
import type { SetType } from '../../../training/api/training.types';
import {
  PlayerExercise, PlayerSet, cleanNumber, fmtLoggedSet, lastHint, stepValue,
} from '../../utils/playerModel';

export interface ExerciseCardHandlers {
  onChange: (setIdx: number, patch: Partial<Pick<PlayerSet, 'reps' | 'weight' | 'setType'>>) => void;
  onToggle: (setIdx: number) => void;
  onFocusSet: (setIdx: number) => void;
  onCopyPrev: (setIdx: number | 'all') => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
}

interface Props extends ExerciseCardHandlers {
  ex: PlayerExercise;
  /** Index shown when the exercise isn't in a superset */
  index: number;
  /** Set row showing the steppers */
  activeSet: number | null;
  locked: boolean;
}

const TYPE_BADGE: Record<SetType, { text: string; color: string; word: string }> = {
  normal: { text: '', color: T.text, word: 'Working set' },
  warmup: { text: 'W', color: T.brandGold, word: 'Warm-up' },
  drop: { text: 'D', color: T.violet, word: 'Drop set' },
  failure: { text: 'F', color: T.err, word: 'To failure' },
};
const NEXT_TYPE: Record<SetType, SetType> = { normal: 'warmup', warmup: 'drop', drop: 'failure', failure: 'normal' };

const COL = { set: 36, prev: 62, check: 44 } as const;

/** One exercise in the player: plan line, "Last" hint, set rows (prev · kg · reps · ✓), steppers, add/remove. */
export default function PlayerExerciseCard({ ex, index, activeSet, locked, onChange, onToggle, onFocusSet, onCopyPrev, onAddSet, onRemoveSet }: Props) {
  const hint = lastHint(ex.last);
  const repsWord = ex.timed ? 'SEC' : 'REPS';
  let working = 0;
  const removable = [...ex.sets].reverse().find(s => !s.done);
  const doneCount = ex.sets.filter(s => s.done).length;

  return (
    <View style={{ backgroundColor: T.bgInput, borderRadius: R.xl, padding: 12, borderWidth: 1, borderColor: doneCount === ex.sets.length ? T.brandBorder : T.bgInputActive }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, paddingHorizontal: 2 }}>
        <View style={{ minWidth: 34, height: 34, paddingHorizontal: 6, borderRadius: 10, backgroundColor: ex.label ? withAlpha(T.violet, 0.15) : T.bgInputActive, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <Text style={{ color: ex.label ? T.violet : T.brand, fontSize: 13, fontWeight: '900' }}>{ex.label ?? index + 1}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }} numberOfLines={2}>{ex.name}</Text>
          {!!ex.prescription && <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>{ex.prescription}</Text>}
          {!!ex.weightSuggestion && (
            <Text style={{ color: T.brandGold, fontSize: 12, fontWeight: '600', marginTop: 2 }}>{ex.weightSuggestion}</Text>
          )}
          {!!ex.notes && <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 3, fontStyle: 'italic' }}>{ex.notes}</Text>}
        </View>
        <Text style={{ color: T.textFaint, fontSize: 12, fontWeight: '700', marginLeft: 8 }}>{doneCount}/{ex.sets.length}</Text>
      </View>

      {!!hint && (
        <Pressable onPress={() => onCopyPrev('all')} disabled={locked} hitSlop={6}
          accessibilityRole="button" accessibilityLabel={`${hint}. Copy last values into open sets`}
          style={({ pressed }) => ({
            alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 10,
            borderRadius: R.pill, marginBottom: 10, backgroundColor: pressed ? withAlpha(T.sky, 0.18) : withAlpha(T.sky, 0.10),
            borderWidth: 1, borderColor: withAlpha(T.sky, 0.28),
          })}>
          <Feather name="rotate-ccw" size={12} color={T.sky} />
          <Text style={{ color: T.sky, fontSize: 12, fontWeight: '700' }}>{hint}</Text>
          <Text style={{ color: withAlpha(T.sky, 0.7), fontSize: 11 }}>· tap to copy</Text>
        </Pressable>
      )}

      {/* Column headers */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }} importantForAccessibility="no-hide-descendants">
        <Text style={[HEAD, { width: COL.set }]}>SET</Text>
        <Text style={[HEAD, { width: COL.prev }]}>PREVIOUS</Text>
        {!ex.timed && <Text style={[HEAD, { flex: 1 }]}>KG</Text>}
        <Text style={[HEAD, { flex: 1 }]}>{repsWord}</Text>
        <View style={{ width: COL.check }} />
      </View>

      {ex.sets.map((set, i) => {
        if (set.setType !== 'warmup') working++;
        const badge = TYPE_BADGE[set.setType];
        const prev = set.prev ? fmtLoggedSet(set.prev).replace(' kg × ', '×') : '—';
        const active = activeSet === i && !set.done && !locked;
        const rowLabel = `${ex.name} set ${i + 1}${set.setType !== 'normal' ? `, ${badge.word}` : ''}`;
        return (
          <View key={set.id}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, borderRadius: R.md,
              backgroundColor: set.done ? withAlpha(T.brand, 0.08) : active ? T.bgInputActive : 'transparent',
            }}>
              <Pressable onPress={() => onChange(i, { setType: NEXT_TYPE[set.setType] })} disabled={set.done || locked}
                accessibilityRole="button" accessibilityLabel={`${rowLabel}. Set type ${badge.word}`} accessibilityHint="Changes the set type (warm-up, drop, failure)"
                style={{ width: COL.set, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: set.setType === 'normal' ? 'transparent' : withAlpha(badge.color, 0.14) }}>
                <Text style={{ color: badge.color, fontSize: 14, fontWeight: '800' }}>{badge.text || working}</Text>
              </Pressable>
              <Pressable onPress={() => onCopyPrev(i)} disabled={!set.prev || set.done || locked}
                accessibilityRole="button" accessibilityLabel={set.prev ? `Previous ${fmtLoggedSet(set.prev)}. Copy into ${rowLabel}` : 'No previous set'}
                style={{ width: COL.prev, height: 40, justifyContent: 'center' }}>
                <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{prev}</Text>
              </Pressable>
              {!ex.timed && (
                <NumInput value={set.weight} placeholder={set.prev?.weightKg != null ? String(set.prev.weightKg) : '0'}
                  decimals done={set.done} editable={!set.done && !locked} label={`${rowLabel} kilograms`}
                  onFocus={() => onFocusSet(i)} onChange={v => onChange(i, { weight: v })} />
              )}
              <NumInput value={set.reps}
                placeholder={(ex.timed ? set.prev?.durationSec : set.prev?.reps)?.toString() ?? '0'}
                done={set.done} editable={!set.done && !locked} label={`${rowLabel} ${ex.timed ? 'seconds' : 'reps'}`}
                onFocus={() => onFocusSet(i)} onChange={v => onChange(i, { reps: v })} />
              <Pressable onPress={() => onToggle(i)} disabled={locked} hitSlop={4}
                accessibilityRole="checkbox" accessibilityLabel={`${rowLabel} done`} accessibilityState={{ checked: set.done, disabled: locked }}
                style={({ pressed }) => ({
                  width: COL.check, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: set.done ? T.brand : pressed ? T.line : T.bgInputActive, borderWidth: 1, borderColor: set.done ? T.brand : T.line,
                })}>
                <Feather name="check" size={18} color={set.done ? T.onBrand : T.textFaint} />
              </Pressable>
            </View>

            {active && (
              <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
                {!ex.timed && (
                  <Stepper unit="kg" step={2.5} value={set.weight || String(set.prev?.weightKg ?? '')} label={`${rowLabel} kilograms`}
                    onChange={v => onChange(i, { weight: v })} />
                )}
                <Stepper unit={ex.timed ? 's' : 'reps'} step={ex.timed ? 5 : 1} value={set.reps || String((ex.timed ? set.prev?.durationSec : set.prev?.reps) ?? '')} label={`${rowLabel} ${ex.timed ? 'seconds' : 'reps'}`}
                  onChange={v => onChange(i, { reps: v })} />
              </View>
            )}
          </View>
        );
      })}

      {!locked && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Pressable onPress={onAddSet} accessibilityRole="button" accessibilityLabel={`Add a set to ${ex.name}`}
            style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: R.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: pressed ? T.line : T.bgInputActive })}>
            <Feather name="plus" size={15} color={T.text} />
            <Text style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>Add set</Text>
          </Pressable>
          {ex.sets.length > 1 && removable && (
            <Pressable onPress={() => onRemoveSet(removable.id)} accessibilityRole="button" accessibilityLabel={`Remove the last open set of ${ex.name}`}
              style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: R.md, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: pressed ? T.line : T.bgInputActive })}>
              <Feather name="minus" size={15} color={T.textSub} />
              <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '700' }}>Remove</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const HEAD = { color: T.textFaint, fontSize: 10, fontWeight: '700' as const, textAlign: 'center' as const, letterSpacing: 0.4 };

function NumInput({ value, placeholder, decimals = false, done, editable, label, onChange, onFocus }: {
  value: string; placeholder: string; decimals?: boolean; done: boolean; editable: boolean; label: string;
  onChange: (v: string) => void; onFocus: () => void;
}) {
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={v => onChange(cleanNumber(v, decimals))}
      onFocus={onFocus}
      editable={editable}
      selectTextOnFocus
      keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
      returnKeyType="done"
      placeholder={placeholder}
      placeholderTextColor={T.textDisabled}
      style={{
        flex: 1, minWidth: 0, height: 40, borderRadius: 10, textAlign: 'center', fontSize: 15, fontWeight: '700',
        color: done ? T.brand : T.text, backgroundColor: done ? 'transparent' : T.bgInputActive,
        borderWidth: 1, borderColor: done ? 'transparent' : T.line,
      }}
    />
  );
}

/** − value + for one field of the active set (kg by 2.5, reps by 1). */
function Stepper({ unit, step, value, label, onChange }: { unit: string; step: number; value: string; label: string; onChange: (v: string) => void }) {
  const btn = (delta: number, icon: 'minus' | 'plus') => (
    <Pressable onPress={() => onChange(stepValue(value, delta))} hitSlop={4}
      accessibilityRole="button" accessibilityLabel={`${icon === 'plus' ? 'Increase' : 'Decrease'} ${label} by ${step}`}
      style={({ pressed }) => ({ width: 44, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? T.brandDim : T.bg, borderWidth: 1, borderColor: T.line })}>
      <Feather name={icon} size={16} color={T.text} />
    </Pressable>
  );
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {btn(-step, 'minus')}
      <Text style={{ flex: 1, textAlign: 'center', color: T.textSub, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>±{step} {unit}</Text>
      {btn(step, 'plus')}
    </View>
  );
}
