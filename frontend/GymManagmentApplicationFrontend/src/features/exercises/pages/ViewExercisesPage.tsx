import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Platform, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useExercises, useDeleteExercise } from '../api/exerciseQueries';
import { Exercise } from '../types/exercise.types';
import BackButton from '../../common/components/BackButton';
import PaginationFooter from '../../common/components/PaginationFooter';
import Skeleton from '../../common/components/Skeleton';
import { getDifficultyColor } from '../../common/constants/statusColors';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const CAT_ICON: Record<string, FeatherIconName> = {
  strength:    'zap',
  cardio:      'activity',
  flexibility: 'wind',
  balance:     'target',
};

function ExerciseCard({ ex, onDelete }: { ex: Exercise; onDelete: (id: number) => void }) {
  const diff  = ex.difficulty?.toLowerCase() ?? 'beginner';
  const cat   = ex.category?.toLowerCase()   ?? 'strength';
  const color = getDifficultyColor(diff);
  const icon  = CAT_ICON[cat] ?? 'zap';

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: '#151915', borderRadius: 18, padding: 14,
      marginBottom: 10, borderWidth: 1, borderColor: '#1C211C',
    }}>
      {/* Thumbnail */}
      <View style={{
        width: 60, height: 60, borderRadius: 12,
        backgroundColor: '#1C211C', borderWidth: 1, borderColor: '#242B24',
        alignItems: 'center', justifyContent: 'center', marginRight: 14,
      }}>
        <Feather name={icon} size={26} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text className="text-white text-[15px] font-bold" numberOfLines={1}>{ex.name}</Text>
        {!!ex.description && <Text className="text-sub text-[12px] mt-0.5" numberOfLines={2}>{ex.description}</Text>}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          {ex.category && (
            <View style={{ backgroundColor: '#1C211C', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#242B24' }}>
              <Text style={{ color: '#AAAAAA', fontSize: 10, fontWeight: '600' }}>{ex.category}</Text>
            </View>
          )}
          {ex.difficulty && (
            <View style={{ backgroundColor: color + '15', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: color + '35' }}>
              <Text style={{ color, fontSize: 10, fontWeight: '700' }}>{ex.difficulty}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Delete */}
      <Pressable onPress={() => onDelete(ex.id)} hitSlop={8}
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="trash-2" size={15} color="#EF4444" />
      </Pressable>
    </View>
  );
}

const FILTERS = ['All', 'Strength', 'Cardio', 'Flexibility', 'Balance'];

interface Props { onBack?: () => void; onAddExercise?: () => void; }

export default function ViewExercisesPage({ onBack, onAddExercise }: Props) {
  const [page, setPage]       = useState(1);
  const [catFilter, setCat]   = useState('All');
  const [search, setSearch]   = useState('');

  const tagParam = catFilter !== 'All' ? catFilter.toLowerCase() : undefined;
  const { data: paged, isLoading, isError, refetch } = useExercises(page, 20, tagParam);
  const { mutate: del } = useDeleteExercise();

  const items      = paged?.items ?? [];
  const totalPages = paged?.totalPages ?? 1;
  const totalRecs  = paged?.totalRecords ?? 0;

  const filtered = search.trim()
    ? items.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const handleDelete = (id: number) => {
    Alert.alert('Delete Exercise', 'Remove this exercise from the library?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () =>
        del(id, { onSuccess: () => refetch(), onError: () => Alert.alert('Error', 'Delete failed.') })
      },
    ]);
  };

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F0A" />

      <View className="px-5 pt-5 pb-4">
        <View className="flex-row items-center justify-between mb-5">
          {onBack && <BackButton onPress={onBack} />}
          <View style={{ flex: 1 }}>
            <Text className="text-sub text-[11px] font-semibold uppercase tracking-widest mb-0.5">Library</Text>
            <Text className="text-white text-[26px] font-extrabold tracking-tight">Exercises</Text>
          </View>
          {onAddExercise && (
            <Pressable onPress={onAddExercise} className="flex-row items-center gap-2 bg-brand rounded-full px-4 py-2.5">
              <Feather name="plus" size={15} color="#000" />
              <Text className="text-black text-[13px] font-bold">Add</Text>
            </Pressable>
          )}
        </View>

        {!isLoading && !isError && (
          <View className="flex-row gap-3 mb-4">
            {[{ l: 'Total', v: totalRecs }, { l: 'Shown', v: filtered.length }, { l: 'Page', v: `${page}/${totalPages}` }].map(s => (
              <View key={s.l} className="flex-1 bg-surface border border-line rounded-2xl p-3 items-center gap-1">
                <Text className="text-brand text-[18px] font-extrabold">{s.v}</Text>
                <Text className="text-sub text-[10px] font-semibold">{s.l}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
          {FILTERS.map(f => {
            const active = f === catFilter;
            return (
              <Pressable key={f} onPress={() => { setCat(f); setPage(1); }}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? '#7ED321' : '#151915', borderWidth: 1, borderColor: active ? '#7ED321' : '#242B24' }}>
                <Text style={{ color: active ? '#000' : '#AAAAAA', fontSize: 12, fontWeight: '700' }}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Search */}
        <View className="flex-row items-center bg-surface border border-line rounded-2xl px-4 h-[46px]">
          <Feather name="search" size={15} color="#555" style={{ marginRight: 8 }} />
          <TextInput className="flex-1 text-white text-[14px] h-full" placeholder="Search exercises…" placeholderTextColor="#555"
            value={search} onChangeText={setSearch} autoCorrect={false} autoCapitalize="none" />
          {search.length > 0 && <Pressable onPress={() => setSearch('')} hitSlop={8}><Feather name="x" size={14} color="#555" /></Pressable>}
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {isLoading && <Skeleton />}
        {isError && (
          <View className="items-center pt-16">
            <Feather name="wifi-off" size={28} color="#EF4444" />
            <Text className="text-white text-[16px] font-bold mt-4 mb-4">Failed to load</Text>
            <Pressable onPress={() => refetch()} className="bg-brand rounded-full px-7 py-3">
              <Text className="text-black font-bold">Retry</Text>
            </Pressable>
          </View>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <View className="items-center pt-16">
            <View className="w-[68px] h-[68px] rounded-full bg-surface border border-line items-center justify-center mb-4">
              <Feather name="zap" size={28} color="#AAA" />
            </View>
            <Text className="text-white text-[16px] font-bold">{search ? 'No results' : 'No exercises yet'}</Text>
          </View>
        )}
        {!isLoading && !isError && filtered.map(ex => <ExerciseCard key={ex.id} ex={ex} onDelete={handleDelete} />)}
        {!isLoading && !isError && <PaginationFooter page={page} totalPages={totalPages} onChange={setPage} />}
      </ScrollView>
    </View>
  );
}
