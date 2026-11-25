import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import { useMyRecords } from '../../training/api/memberTrainingQueries';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import SearchBar from '../../common/components/SearchBar';
import { RECORD_LABEL, fmtRecordValue, groupRecords } from '../utils/planCalendar';

interface Props {
  onBack: () => void;
  /** Opens the session a record was set in. */
  onOpenLog?: (logId: number) => void;
}

const fmtWhen = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Personal records per exercise: type, value, date (tap a record for its session). */
export default function RecordsScreen({ onBack, onOpenLog }: Props) {
  const q = useMyRecords();
  const [search, setSearch] = useState('');
  const groups = groupRecords(q.data ?? []).filter(g => !search.trim() || g.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Screen>
      <ScreenHeader eyebrow="Progress" title="Personal records" onBack={onBack} />
      {(q.data?.length ?? 0) > 6 && (
        <View className="px-5 pb-3"><SearchBar value={search} onChangeText={setSearch} placeholder="Search exercises…" label="Search records" /></View>
      )}
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {q.isLoading && <Skeleton rows={4} height={120} borderRadius={R.xl} gap={12} />}
        {q.isError && <EmptyState icon="wifi-off" tone="error" title="Couldn't load your records" action={{ label: 'Retry', onPress: () => q.refetch() }} />}
        {q.isSuccess && q.data.length === 0 && (
          <EmptyState icon="award" title="No records yet" subtitle="Log working sets and your best lifts are tracked here automatically." />
        )}
        {q.isSuccess && q.data.length > 0 && groups.length === 0 && <EmptyState icon="search" title="No matches" />}

        {groups.map(g => (
          <View key={g.exerciseId} style={{ backgroundColor: T.bgInput, borderRadius: R.xl, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: T.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(T.brandGold, 0.14), marginRight: 10 }}>
                <Feather name="award" size={15} color={T.brandGold} />
              </View>
              <Text numberOfLines={1} style={{ flex: 1, color: T.text, fontSize: 16, fontWeight: '700' }}>{g.name}</Text>
            </View>
            {g.records.map(r => {
              const canOpen = !!onOpenLog && r.workoutLogId != null;
              return (
                <Pressable key={r.type} disabled={!canOpen} onPress={() => canOpen && onOpenLog!(r.workoutLogId!)}
                  accessibilityRole={canOpen ? 'button' : undefined}
                  accessibilityLabel={`${RECORD_LABEL[r.type]}: ${fmtRecordValue(r)}, ${fmtWhen(r.achievedAt)}`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 4, borderRadius: R.sm, backgroundColor: pressed ? T.bgInputActive : 'transparent' })}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.textSub, fontSize: 12 }}>{RECORD_LABEL[r.type]}</Text>
                    <Text style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>{fmtRecordValue(r)}</Text>
                  </View>
                  <Text style={{ color: T.textFaint, fontSize: 12 }}>{fmtWhen(r.achievedAt)}</Text>
                  {canOpen && <Feather name="chevron-right" size={14} color={T.textFaint} style={{ marginLeft: 4 }} />}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
