import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, useWindowDimensions } from 'react-native';
import { T, SP } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import SearchBar from '../../common/components/SearchBar';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import { useExerciseLibrary } from '../../exercises/api/exerciseQueries';
import type { Exercise } from '../../exercises/types/exercise.types';
import { CheckRow, Chip } from './BuilderUi';

export interface PickedExercise { id: number; name: string; timed: boolean }

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  onAdd: (picked: PickedExercise[]) => void;
}

type FilterKind = 'muscle' | 'equipment' | 'tag';

const uniq = (xs: (string | null | undefined)[]) =>
  Array.from(new Set(xs.filter((x): x is string => !!x && !!x.trim()))).sort((a, b) => a.localeCompare(b));

/** Cardio / flexibility moves default to timed sets. */
const isTimed = (e: Exercise) => ['cardio', 'flexibility'].includes((e.category ?? '').toLowerCase());

/**
 * Multi-select exercise library picker: search plus muscle / equipment / tag filters. The list endpoint
 * only pages, so one page of 100 is loaded and filtered here.
 */
export default function ExercisePicker({ visible, title, onClose, onAdd }: Props) {
  const { height } = useWindowDimensions();
  const { data, isLoading, isError, refetch } = useExerciseLibrary(1, undefined, visible, 100);
  const library = useMemo(() => data?.items ?? [], [data]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [kind, setKind] = useState<FilterKind | null>(null);
  const [filter, setFilter] = useState<{ muscle?: string; equipment?: string; tag?: string }>({});

  useEffect(() => { if (visible) { setSearch(''); setPicked([]); setFilter({}); setKind(null); } }, [visible]);

  const options = useMemo(() => ({
    muscle: uniq(library.flatMap(e => (e.muscles ?? []).map(m => m.name))),
    equipment: uniq(library.flatMap(e => (e.equipment ?? []).map(q => q.name))),
    tag: uniq(library.flatMap(e => [...(e.tags ?? []), e.category])),
  }), [library]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return library.filter(e =>
      (!q || e.name.toLowerCase().includes(q) || (e.category ?? '').toLowerCase().includes(q))
      && (!filter.muscle || (e.muscles ?? []).some(m => m.name === filter.muscle))
      && (!filter.equipment || (e.equipment ?? []).some(m => m.name === filter.equipment))
      && (!filter.tag || e.category === filter.tag || (e.tags ?? []).includes(filter.tag)));
  }, [library, search, filter]);

  const toggle = (id: number) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const add = () => {
    const chosen = picked.map(id => library.find(e => e.id === id)).filter((e): e is Exercise => !!e);
    onAdd(chosen.map(e => ({ id: e.id, name: e.name, timed: isTimed(e) })));
  };

  const KINDS: { k: FilterKind; label: string }[] = [
    { k: 'muscle', label: filter.muscle ?? 'Muscle' },
    { k: 'equipment', label: filter.equipment ?? 'Equipment' },
    { k: 'tag', label: filter.tag ?? 'Tag' },
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      leftAction={{ label: 'Cancel', onPress: onClose }}
      rightAction={{ label: picked.length ? `Add (${picked.length})` : 'Add', onPress: add, primary: picked.length > 0 }}
    >
      <View style={{ height: Math.min(height * 0.78, 680) }}>
        <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.md, gap: SP.sm }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search exercises…" label="Search the exercise library" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm }}>
            {KINDS.map(({ k, label }) => (
              <Chip key={k} label={label} icon="filter" small active={!!filter[k] || kind === k}
                a11y={`Filter by ${k}`} onPress={() => setKind(kind === k ? null : k)} />
            ))}
            {(filter.muscle || filter.equipment || filter.tag) && (
              <Chip label="Clear" icon="x" small onPress={() => { setFilter({}); setKind(null); }} a11y="Clear filters" />
            )}
          </ScrollView>
          {kind && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm, paddingBottom: SP.xs }}>
              {options[kind].length === 0 && <Text style={{ color: T.textFaint, fontSize: 12, paddingVertical: 8 }}>No {kind} data on these exercises.</Text>}
              {options[kind].map(o => (
                <Chip key={o} label={o} small active={filter[kind] === o}
                  onPress={() => setFilter(f => ({ ...f, [kind]: f[kind] === o ? undefined : o }))} />
              ))}
            </ScrollView>
          )}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingTop: SP.md, paddingBottom: SP.xl }}>
          {isLoading && <Skeleton rows={5} height={52} />}
          {isError && <EmptyState icon="wifi-off" tone="error" title="Couldn't load the exercise library" action={{ label: 'Retry', onPress: () => refetch() }} />}
          {!isLoading && !isError && filtered.length === 0 && (
            <EmptyState icon="search" title={library.length ? 'No matching exercises' : 'The exercise library is empty'} />
          )}
          {!isLoading && !isError && filtered.map(e => {
            const order = picked.indexOf(e.id);
            return (
              <CheckRow
                key={e.id}
                label={e.name}
                sub={[e.category, (e.muscles ?? []).slice(0, 2).map(m => m.name).join(', ')].filter(Boolean).join(' · ')}
                checked={order >= 0}
                onPress={() => toggle(e.id)}
                right={order >= 0 ? <Text style={{ color: T.brand, fontSize: 12, fontWeight: '800' }}>{order + 1}</Text> : undefined}
              />
            );
          })}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}
