import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native';
import { useTrainers } from '../api/trainerQueries';
import { TrainerSummary } from '../types/trainer.types';
import { useBranches } from '../../branches/api/branchQueries';
import { T, withAlpha } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import EmptyState from '../../dashboard/components/EmptyState';

interface Props {
  value: number | null;                              // selected trainer id
  onChange: (trainer: TrainerSummary | null) => void; // null = no trainer
  error?: string;
  label?: string;
}

/** Optional trainer picker (bottom sheet) built on the trainers list API — mirrors BranchDropdown. */
export default function TrainerDropdown({
  value,
  onChange,
  error,
  label = 'Trainer',
}: Props) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useTrainers(1, 100);
  const trainers = data?.items ?? [];
  const { data: branches = [] } = useBranches();
  const branchName = useMemo(() => {
    const m = new Map(branches.map(b => [b.id, b.name]));
    return (id: number) => m.get(id);
  }, [branches]);

  const selected = trainers.find(t => t.id === value) ?? null;
  const hasError = !!error;
  const triggerText = isLoading ? 'Loading trainers…'
    : isError  ? 'Failed to load'
    : selected ? selected.displayName
    : 'No trainer';

  const subtitle = (t: TrainerSummary) =>
    [branchName(t.branchId), t.isAvailable ? 'Available' : 'Unavailable'].filter(Boolean).join('  ·  ');

  return (
    <View className="mb-4">
      <Text className="text-[13px] font-normal text-sub mb-[7px]">{label}</Text>

      <TouchableOpacity
        className="flex-row items-center bg-input border rounded-xl px-4 py-[14px]"
        style={hasError ? { borderColor: T.err } : { borderColor: open ? T.textDisabled : T.line }}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${triggerText}`}
        accessibilityHint="Opens the trainer list"
        accessibilityState={{ disabled: isLoading, expanded: open }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={T.textFaint} style={{ marginRight: 8 }} />
        ) : null}

        <Text numberOfLines={1} className={`flex-1 text-[15px] ${selected ? 'text-white' : 'text-faint'}`}>
          {triggerText}
        </Text>

        <Text
          importantForAccessibility="no"
          className="text-[12px] text-faint ml-2"
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        >
          ▾
        </Text>
      </TouchableOpacity>

      {hasError && (
        <Text className="text-[12px] mt-1" style={{ color: T.err }}>{error}</Text>
      )}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Select Trainer">
        {isError ? (
          <EmptyState icon="wifi-off" tone="error" title="Failed to load trainers." />
        ) : trainers.length === 0 && !isLoading ? (
          <EmptyState icon="users" title="No trainers found." />
        ) : (
          <FlatList
            data={[null, ...trainers] as (TrainerSummary | null)[]}
            keyExtractor={(item) => (item ? String(item.id) : 'none')}
            style={{ maxHeight: 360 }}
            contentContainerStyle={{ paddingVertical: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = item ? item.id === value : value == null;
              const name = item ? item.displayName : 'No trainer';
              const sub = item ? subtitle(item) : 'Assign later';
              return (
                <TouchableOpacity
                  className="flex-row items-center px-5 py-4 border-b border-input"
                  style={isSelected ? { backgroundColor: withAlpha(T.brand, 0.08) } : undefined}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={sub ? `${name}, ${sub}` : name}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View className="flex-1">
                    <Text numberOfLines={1} className={`text-[15px] font-medium ${isSelected ? 'text-brand' : 'text-white'}`}>
                      {name}
                    </Text>
                    {!!sub && (
                      <Text numberOfLines={1} className="text-[12px] text-faint mt-[2px]">{sub}</Text>
                    )}
                  </View>
                  {isSelected && (
                    <Text className="text-[16px] text-brand ml-3">✓</Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </BottomSheet>
    </View>
  );
}
