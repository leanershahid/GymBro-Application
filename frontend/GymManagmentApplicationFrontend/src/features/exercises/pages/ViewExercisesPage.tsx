import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useExercises, useExercise, useDeleteExercise } from '../api/exerciseQueries';
import { Exercise } from '../types/exercise.types';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SearchBar from '../../common/components/SearchBar';
import StatusPill from '../../common/components/StatusPill';
import { difficultyTone, getDifficultyColor } from '../../common/constants/statusColors';
import PaginationFooter from '../../common/components/PaginationFooter';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';
import StatsStrip from '../../common/StatsStrip';
import DetailSheet, { fmtDate } from '../components/DetailSheet';
import { apiErrorText } from '../../../api/apiError';
import { useToast } from '../../common/components/Toast';
import { T, withAlpha, SP } from '../../../theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const CAT_ICON: Record<string, FeatherIconName> = {
  strength:    'zap',
  cardio:      'activity',
  flexibility: 'wind',
  balance:     'target',
  sport:       'award',
  rehab:       'heart',
  other:       'grid',
};

function ExerciseCard({ ex, onDelete, onOpen }: { ex: Exercise; onDelete: (id: number) => void; onOpen: (id: number) => void }) {
  const diff  = ex.difficulty?.toLowerCase() ?? 'beginner';
  const cat   = ex.category?.toLowerCase()   ?? 'strength';
  const color = getDifficultyColor(diff);
  const icon  = CAT_ICON[cat] ?? 'zap';

  return (
    <Pressable
      onPress={() => onOpen(ex.id)}
      accessibilityRole="button"
      accessibilityLabel={`${ex.name}, view details`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderRadius: 18, padding: 14,
        marginBottom: 10, borderWidth: 1, borderColor: T.bgInputActive,
      })}>
      {/* Thumbnail */}
      <View style={{
        width: 60, height: 60, borderRadius: 12,
        backgroundColor: T.bgInputActive, borderWidth: 1, borderColor: T.line,
        alignItems: 'center', justifyContent: 'center', marginRight: 14,
      }}>
        <Feather name={icon} size={26} color={color} />
      </View>

      <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
        <Text className="text-white text-[15px] font-bold" numberOfLines={1}>{ex.name}</Text>
        {!!ex.description && <Text className="text-sub text-[12px] mt-0.5" numberOfLines={2}>{ex.description}</Text>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {!!ex.category && <StatusPill label={ex.category} tone="neutral" />}
          {!!ex.difficulty && <StatusPill label={ex.difficulty} tone={difficultyTone(ex.difficulty)} />}
        </View>
      </View>

      {/* Delete */}
      <Pressable
        onPress={() => onDelete(ex.id)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${ex.name}`}
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha(T.err, 0.10), borderWidth: 1, borderColor: withAlpha(T.err, 0.25), alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="trash-2" size={15} color={T.err} />
      </Pressable>
    </Pressable>
  );
}

const FILTERS = ['All', 'Strength', 'Cardio', 'Flexibility', 'Balance', 'Sport', 'Rehab', 'Other'];

interface Props {
  onBack?: () => void;
  onAddExercise?: () => void;
  /** Override the built-in read-only detail sheet. */
  onOpenExercise?: (id: number) => void;
}

// The API has no name search or category filter (its `tag` param is ignored), so both
// filter the loaded page client-side; the search input is debounced.
export default function ViewExercisesPage({ onBack, onAddExercise, onOpenExercise }: Props) {
  const toast = useToast();
  const [page, setPage]       = useState(1);
  const [catFilter, setCat]   = useState('All');
  const [search, setSearch]   = useState('');
  const [query, setQuery]     = useState('');
  const [openId, setOpenId]   = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim().toLowerCase()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: paged, isLoading, isError, refetch } = useExercises(page, 20);
  const { mutate: del } = useDeleteExercise();
  const detail = useExercise(openId);

  const items      = paged?.items ?? [];
  const totalPages = paged?.totalPages ?? 1;
  const totalRecs  = paged?.totalRecords;

  const filtered = items.filter(e =>
    (catFilter === 'All' || (e.category ?? '').toLowerCase() === catFilter.toLowerCase()) &&
    (!query || e.name.toLowerCase().includes(query)));

  const handleOpen = (id: number) => (onOpenExercise ? onOpenExercise(id) : setOpenId(id));

  const handleDelete = (id: number) => {
    Alert.alert('Delete Exercise', 'Remove this exercise from the library?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () =>
        del(id, {
          onSuccess: () => { setOpenId(null); toast.show({ type: 'success', message: 'Exercise deleted.' }); },
          onError: (e) => Alert.alert('Delete failed', apiErrorText(e)),
        })
      },
    ]);
  };

  const ex = detail.data;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Library"
        title="Exercises"
        onBack={onBack}
        action={onAddExercise ? { label: 'Add', icon: 'plus', onPress: onAddExercise } : undefined}
      />

      <View style={{ paddingHorizontal: SP.xl, paddingBottom: SP.lg }}>
        {!isLoading && !isError && (
          <View style={{ marginBottom: SP.lg }}>
            <StatsStrip items={[
              { icon: 'database', label: 'Total', value: totalRecs == null ? '—' : totalRecs.toLocaleString('en-IN'),           accent: T.brand },
              { icon: 'eye',      label: 'Shown', value: String(filtered.length),     accent: T.sky },
              { icon: 'layers',   label: 'Page',  value: `${page}/${totalPages}`,     accent: T.violet },
            ]} />
          </View>
        )}

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
          {FILTERS.map(f => {
            const active = f === catFilter;
            return (
              <Pressable key={f} onPress={() => { setCat(f); setPage(1); }}
                hitSlop={{ top: 6, bottom: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Category: ${f}`}
                accessibilityState={{ selected: active }}
                style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? T.brand : T.bgInput, borderWidth: 1, borderColor: active ? T.brand : T.line }}>
                <Text style={{ color: active ? T.onBrand : T.textSub, fontSize: 12, fontWeight: '700' }}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Search */}
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search exercises…" label="Search exercises" />
      </View>

      <FlatList
        data={isLoading || isError ? [] : filtered}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item }) => <ExerciseCard ex={item} onDelete={handleDelete} onOpen={handleOpen} />}
        ListHeaderComponent={
          isLoading ? <Skeleton /> :
          isError ? (
            <EmptyState
              icon="wifi-off"
              tone="error"
              title="Failed to load"
              subtitle="Check your connection and try again."
              action={{ label: 'Retry', onPress: () => refetch() }}
            />
          ) : null
        }
        ListEmptyComponent={
          !isLoading && !isError
            ? <EmptyState icon="zap" title={query || catFilter !== 'All' ? 'No matches on this page' : 'No exercises yet'} />
            : null
        }
        ListFooterComponent={
          !isLoading && !isError
            ? <PaginationFooter page={page} totalPages={totalPages} onChange={setPage} />
            : null
        }
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      <DetailSheet
        visible={openId !== null}
        onClose={() => setOpenId(null)}
        title={ex?.name ?? 'Exercise'}
        loading={detail.isLoading}
        error={detail.isError ? apiErrorText(detail.error) : null}
        rows={ex ? [
          { label: 'Category',     value: ex.category },
          { label: 'Difficulty',   value: ex.difficulty },
          { label: 'Description',  value: ex.description },
          { label: 'Instructions', value: ex.instructions },
          { label: 'Muscles',      value: ex.muscles?.map(m => m.role ? `${m.name} (${m.role})` : m.name).join(', ') },
          { label: 'Equipment',    value: ex.equipment?.map(q => q.name).join(', ') },
          { label: 'Tags',         value: ex.tags?.join(', ') },
          { label: 'Video',        value: ex.videoUrl },
          { label: 'Created',      value: fmtDate(ex.createdAt) },
        ] : []}
      />
    </Screen>
  );
}
