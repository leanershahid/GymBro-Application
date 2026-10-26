import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native';
import { useBranches } from '../api/branchQueries';
import { Branch } from '../types/branch.types';
import { T, withAlpha } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import EmptyState from '../../dashboard/components/EmptyState';

interface Props {
  value: number | null;        // selected branch id
  onChange: (branch: Branch) => void;
  error?: string;
  label?: string;
}

export default function BranchDropdown({
  value,
  onChange,
  error,
  label = 'Branch',
}: Props) {
  const [open, setOpen]  = useState(false);
  const { data: branches = [], isLoading, isError } = useBranches();

  const selected = branches.find((b) => b.id === value) ?? null;
  const hasError = !!error;

  return (
    <View className="mb-4">
      <Text className="text-[13px] font-normal text-sub mb-[7px]">{label}</Text>

      {/* Trigger ───────────────────────────────────────────── */}
      <TouchableOpacity
        className="flex-row items-center bg-input border rounded-xl px-4 py-[14px]"
        style={hasError ? { borderColor: T.err } : { borderColor: open ? T.textDisabled : T.line }}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${isLoading ? 'Loading branches' : isError ? 'Failed to load' : selected ? selected.name : 'Select a branch'}`}
        accessibilityHint="Opens the branch list"
        accessibilityState={{ disabled: isLoading, expanded: open }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={T.textFaint} style={{ marginRight: 8 }} />
        ) : null}

        <Text numberOfLines={1} className={`flex-1 text-[15px] ${selected ? 'text-white' : 'text-faint'}`}>
          {isLoading  ? 'Loading branches…'
           : isError  ? 'Failed to load'
           : selected ? selected.name
           : 'Select a branch'}
        </Text>

        {/* chevron */}
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

      {/* Modal sheet ─────────────────────────────────────── */}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Select Branch">
          {/* list */}
          {isError ? (
            <EmptyState icon="wifi-off" tone="error" title="Failed to load branches." />
          ) : branches.length === 0 && !isLoading ? (
            <EmptyState icon="map-pin" title="No branches found." />
          ) : (
            <FlatList
              data={branches}
              keyExtractor={(item) => String(item.id)}
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ paddingVertical: 8 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = item.id === value;
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
                    accessibilityLabel={`${item.name}${item.city ? `, ${item.city}` : ''}, ${item.status}`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View className="flex-1">
                      <Text numberOfLines={1} className={`text-[15px] font-medium ${isSelected ? 'text-brand' : 'text-white'}`}>
                        {item.name}
                      </Text>
                      <Text numberOfLines={1} className="text-[12px] text-faint mt-[2px]">
                        {item.city ? `${item.city}  ·  ` : ''}{item.status}
                      </Text>
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
