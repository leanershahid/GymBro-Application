import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, R, withAlpha } from '../../../../theme';
import type { CompleteWorkoutResponse, NewRecord } from '../../../training/api/training.types';
import PrimaryButton from '../../../common/components/PrimaryButton';
import { LocalSummary, fmtNum } from '../../utils/playerModel';
import { RECORD_LABEL, fmtMinutes, fmtVolume } from '../../utils/planCalendar';

interface Props {
  visible: boolean;
  workoutName: string;
  /** Before saving: what will be logged */
  local: LocalSummary;
  elapsedMin: number;
  /** After saving: the server's summary and records */
  result: CompleteWorkoutResponse | null;
  saving: boolean;
  rpe: number | null;
  onRpe: (v: number | null) => void;
  notes: string;
  onNotes: (v: string) => void;
  onSave: () => void;
  /** Back to the workout (review only) */
  onClose: () => void;
  /** After saving */
  onDone: () => void;
}

const RPE_WORD = (v: number) => (v <= 3 ? 'Easy' : v <= 6 ? 'Moderate' : v <= 8 ? 'Hard' : 'Max effort');

/** Finish summary: duration, sets, volume, session RPE 1–10 and notes → save → new PR badges. */
export default function FinishSheet(p: Props) {
  const insets = useSafeAreaInsets();
  const r = p.result;
  const stats = [
    { l: 'Duration', v: fmtMinutes(r?.summary.durationMin ?? r?.durationMin ?? p.elapsedMin), icon: 'clock' as const },
    { l: 'Sets', v: String(r?.summary.sets ?? p.local.sets), icon: 'check-square' as const },
    { l: 'Volume', v: fmtVolume(r?.summary.volumeKg ?? p.local.volumeKg), icon: 'bar-chart-2' as const },
  ];

  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={r ? p.onDone : p.onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: withAlpha(T.black, 0.6) }} onPress={r ? undefined : p.onClose}
          accessibilityRole="button" accessibilityLabel={r ? 'Summary' : 'Back to workout'} />
        <View style={{ backgroundColor: T.bgInput, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, maxHeight: '88%', paddingBottom: Math.max(insets.bottom, 16) }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: r ? T.brand : T.brandDim, marginBottom: 10 }}>
                <Feather name={r ? 'check' : 'flag'} size={26} color={r ? T.onBrand : T.brand} />
              </View>
              <Text accessibilityRole="header" style={{ color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>
                {r ? 'Workout logged' : 'Finish workout?'}
              </Text>
              <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{p.workoutName}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
              {stats.map(s => (
                <View key={s.l} accessible accessibilityLabel={`${s.l}: ${s.v}`}
                  style={{ flex: 1, minWidth: 0, backgroundColor: T.bgInputActive, borderRadius: R.md, paddingVertical: 12, alignItems: 'center' }}>
                  <Feather name={s.icon} size={14} color={T.textFaint} />
                  <Text numberOfLines={1} style={{ color: T.text, fontSize: 16, fontWeight: '800', marginTop: 4 }}>{s.v}</Text>
                  <Text style={{ color: T.textSub, fontSize: 11, marginTop: 1 }}>{s.l}</Text>
                </View>
              ))}
            </View>

            {r ? (
              <>
                {r.newRecords.length > 0 ? (
                  <View style={{ marginBottom: 18 }}>
                    <Text style={{ color: T.brandGold, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                      {r.newRecords.length} new personal record{r.newRecords.length === 1 ? '' : 's'}
                    </Text>
                    {r.newRecords.map((nr, i) => <PrBadge key={`${nr.exerciseId}-${nr.type}-${i}`} record={nr} />)}
                  </View>
                ) : (
                  <Text style={{ color: T.textSub, fontSize: 13, textAlign: 'center', marginBottom: 18 }}>Solid session — consistency is what counts.</Text>
                )}
                <PrimaryButton label="Done" icon="check" onPress={p.onDone} />
              </>
            ) : (
              <>
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '700', marginBottom: 8 }}>
                  How hard was it? {p.rpe != null && <Text style={{ color: T.textSub, fontWeight: '400' }}>RPE {p.rpe} · {RPE_WORD(p.rpe)}</Text>}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }} accessibilityRole="radiogroup" accessibilityLabel="Session RPE, 1 to 10">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(v => {
                    const sel = p.rpe === v;
                    return (
                      <Pressable key={v} onPress={() => p.onRpe(sel ? null : v)}
                        accessibilityRole="radio" accessibilityLabel={`RPE ${v}, ${RPE_WORD(v)}`} accessibilityState={{ checked: sel }}
                        style={{ width: '18%', minHeight: 44, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? T.brand : T.bgInputActive, borderWidth: 1, borderColor: sel ? T.brand : T.line }}>
                        <Text style={{ color: sel ? T.onBrand : T.text, fontSize: 15, fontWeight: '800' }}>{v}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '700', marginBottom: 8 }}>Notes</Text>
                <TextInput value={p.notes} onChangeText={p.onNotes} multiline maxLength={1000}
                  accessibilityLabel="Session notes" placeholder="How did it feel? Anything to remember next time…" placeholderTextColor={T.textFaint}
                  style={{ minHeight: 80, maxHeight: 140, backgroundColor: T.bgInputActive, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, color: T.text, padding: 12, fontSize: 14, textAlignVertical: 'top', marginBottom: 18 }} />
                <PrimaryButton label="Save workout" icon="check" onPress={p.onSave} loading={p.saving} disabled={p.saving} />
                <Pressable onPress={p.onClose} disabled={p.saving} accessibilityRole="button" accessibilityLabel="Keep training"
                  style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                  <Text style={{ color: T.textSub, fontSize: 14, fontWeight: '600' }}>Keep training</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PrBadge({ record }: { record: NewRecord }) {
  const unit = record.type === 'mostReps' ? ' reps' : ' kg';
  const prev = record.previousValue != null ? `was ${fmtNum(record.previousValue)}${unit}` : null;
  return (
    <View accessible accessibilityLabel={`New record: ${record.exerciseName ?? 'Exercise'}, ${RECORD_LABEL[record.type]} ${fmtNum(record.value)}${unit}${prev ? `, ${prev}` : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: withAlpha(T.brandGold, 0.10), borderRadius: R.lg, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: withAlpha(T.brandGold, 0.30) }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(T.brandGold, 0.18), marginRight: 12 }}>
        <Feather name="award" size={18} color={T.brandGold} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{record.exerciseName ?? 'Exercise'}</Text>
        <Text style={{ color: T.textSub, fontSize: 12, marginTop: 1 }}>{RECORD_LABEL[record.type]}{prev ? ` · ${prev}` : ''}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: T.brandGold, fontSize: 16, fontWeight: '800' }}>{fmtNum(record.value)}{unit}</Text>
        <Text style={{ color: T.brandGold, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>PR</Text>
      </View>
    </View>
  );
}
