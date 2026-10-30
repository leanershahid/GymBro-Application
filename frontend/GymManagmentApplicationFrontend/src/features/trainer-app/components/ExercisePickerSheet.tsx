import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import SearchBar from '../../common/components/SearchBar';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import EmptyState from '../../dashboard/components/EmptyState';
import { useExerciseLibrary } from '../api/programQueries';
import { LibraryExercise } from '../types/program.types';

interface Props {
  visible: boolean;
  /** Section the exercises will be added to (shown in the title). */
  sectionName: string;
  onClose: () => void;
  onAdd: (exercises: LibraryExercise[]) => void;
}

/** Searchable, multi-select exercise library picker. */
export default function ExercisePickerSheet({ visible, sectionName, onClose, onAdd }: Props) {
  const { height } = useWindowDimensions();
  const { data: library = [], isLoading, isError, refetch } = useExerciseLibrary(visible);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => { if (visible) { setSearch(''); setPicked([]); } }, [visible]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return library;
    return library.filter(e =>
      e.name.toLowerCase().includes(q)
      || (e.category ?? '').toLowerCase().includes(q)
      || (e.tags ?? []).some(t => t.toLowerCase().includes(q)));
  }, [library, search]);

  const toggle = (id: number) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const confirm = () => {
    // Keep the order in which they were tapped.
    const chosen = picked.map(id => library.find(e => e.id === id)).filter((e): e is LibraryExercise => !!e);
    onAdd(chosen);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Add to ${sectionName}`}
      leftAction={{ label: 'Cancel', onPress: onClose }}
      rightAction={{ label: picked.length ? `Add (${picked.length})` : 'Add', onPress: confirm, primary: picked.length > 0 }}
    >
      <View style={{ height: Math.min(height * 0.7, 620) }}>
        <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.md, paddingBottom: SP.sm }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search exercises…" label="Search the exercise library" />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xl }}>
          {isLoading && <Skeleton rows={5} height={60} />}
          {isError && (
            <EmptyState icon="wifi-off" tone="error" title="Couldn't load the exercise library" action={{ label: 'Retry', onPress: () => refetch() }} />
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <EmptyState icon="search" title={search ? 'No matching exercises' : 'The exercise library is empty'} subtitle={search ? 'Try another name, category or tag.' : undefined} />
          )}
          {!isLoading && !isError && filtered.map(ex => {
            const on = picked.includes(ex.id);
            return (
              <Pressable
                key={ex.id}
                onPress={() => toggle(ex.id)}
                accessibilityRole="checkbox"
                accessibilityLabel={ex.name}
                accessibilityState={{ checked: on }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 56,
                  paddingVertical: SP.sm, paddingHorizontal: SP.md, marginBottom: SP.sm, borderRadius: R.md,
                  backgroundColor: on ? withAlpha(T.brand, 0.10) : T.bgInputActive,
                  borderWidth: 1, borderColor: on ? withAlpha(T.brand, 0.4) : T.line,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{ex.name}</Text>
                  {(ex.category || ex.difficulty) && (
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      {ex.category && <StatusPill label={ex.category} tone="neutral" />}
                      {ex.difficulty && <StatusPill label={ex.difficulty} tone="neutral" />}
                    </View>
                  )}
                </View>
                <View style={{
                  width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? T.brand : 'transparent', borderWidth: 1.5, borderColor: on ? T.brand : T.textFaint,
                }}>
                  {on && <Feather name="check" size={15} color={T.onBrand} />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}
