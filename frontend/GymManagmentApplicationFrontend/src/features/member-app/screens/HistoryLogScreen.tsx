import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import { useWorkoutHistoryDetail } from '../../training/api/memberTrainingQueries';
import type { LoggedSet } from '../../training/api/training.types';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import { RECORD_LABEL, fmtMinutes, fmtRecordValue, fmtVolume } from '../utils/planCalendar';
import { fmtLoggedSet } from '../utils/playerModel';

interface Props { logId: number; onBack: () => void }

const TYPE_TAG: Record<string, string> = { warmup: 'W', drop: 'D', failure: 'F' };

/** One logged session: totals, records it set, and the sets per exercise. */
export default function HistoryLogScreen({ logId, onBack }: Props) {
  const q = useWorkoutHistoryDetail(logId);
  const log = q.data;

  // Sets grouped per exercise, in the order they were done.
  const groups: { key: string; name: string; sets: LoggedSet[] }[] = [];
  (log?.setLogs ?? []).forEach(s => {
    const key = s.workoutExerciseId != null ? `w${s.workoutExerciseId}` : `e${s.exerciseId}`;
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, name: s.exerciseName ?? `Exercise #${s.exerciseId}`, sets: [] }; groups.push(g); }
    g.sets.push(s);
  });

  const when = log ? new Date(log.startedAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : '';

  return (
    <Screen>
      <ScreenHeader eyebrow={when || 'Workout'} title={log?.workoutName ?? 'Workout'} onBack={onBack} />
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {q.isLoading && <Skeleton rows={4} height={110} borderRadius={R.xl} gap={12} />}
        {q.isError && <EmptyState icon="wifi-off" tone="error" title="Couldn't load this workout" action={{ label: 'Retry', onPress: () => q.refetch() }} />}

        {log && (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {[
                { l: 'Duration', v: fmtMinutes(log.durationMin) },
                { l: 'Sets', v: String(log.sets) },
                { l: 'Volume', v: fmtVolume(log.volumeKg) },
                { l: 'RPE', v: log.sessionRpe != null ? String(log.sessionRpe) : '—' },
              ].map(x => (
                <View key={x.l} accessible accessibilityLabel={`${x.l}: ${x.v}`}
                  style={{ flex: 1, minWidth: 0, backgroundColor: T.bgInput, borderRadius: R.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: T.line }}>
                  <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>{x.v}</Text>
                  <Text style={{ color: T.textSub, fontSize: 11, marginTop: 2 }}>{x.l}</Text>
                </View>
              ))}
            </View>

            {log.records.length > 0 && (
              <View style={{ backgroundColor: withAlpha(T.brandGold, 0.08), borderRadius: R.xl, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: withAlpha(T.brandGold, 0.25) }}>
                <Text style={{ color: T.brandGold, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Records set</Text>
                {log.records.map((r, i) => (
                  <View key={`${r.exerciseId}-${r.type}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 }}>
                    <Feather name="award" size={14} color={T.brandGold} />
                    <Text numberOfLines={1} style={{ flex: 1, color: T.text, fontSize: 13, fontWeight: '600' }}>{r.exerciseName} · {RECORD_LABEL[r.type]}</Text>
                    <Text style={{ color: T.brandGold, fontSize: 13, fontWeight: '800' }}>{fmtRecordValue(r)}</Text>
                  </View>
                ))}
              </View>
            )}

            {!!log.notes && (
              <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: T.line }}>
                <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }}>Notes</Text>
                <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20 }}>{log.notes}</Text>
              </View>
            )}

            {groups.length === 0 && <EmptyState icon="list" title="No sets recorded" subtitle="This session was logged without set details." />}

            {groups.map(g => (
              <View key={g.key} style={{ backgroundColor: T.bgInput, borderRadius: R.xl, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: T.line }}>
                <Text style={{ color: T.text, fontSize: 15, fontWeight: '700', marginBottom: 8 }}>{g.name}</Text>
                {g.sets.map((s, i) => (
                  <View key={s.id} accessible accessibilityLabel={`Set ${i + 1}${s.setType !== 'normal' ? ` ${s.setType}` : ''}: ${fmtLoggedSet(s)}${s.completed ? '' : ', not completed'}`}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: T.line, opacity: s.completed ? 1 : 0.5 }}>
                    <Text style={{ width: 32, color: TYPE_TAG[s.setType] ? T.brandGold : T.textSub, fontSize: 13, fontWeight: '800' }}>{TYPE_TAG[s.setType] ?? i + 1}</Text>
                    <Text style={{ flex: 1, color: T.text, fontSize: 14, fontWeight: '600' }}>{fmtLoggedSet(s)}</Text>
                    {s.rpe != null && <Text style={{ color: T.textFaint, fontSize: 12 }}>RPE {s.rpe}</Text>}
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
