import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native';
import { useTenants } from '../api/tenantQueries';
import { Tenant } from '../types/tenant.types';
import { T, withAlpha } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import EmptyState from '../../dashboard/components/EmptyState';

interface Props {
  value: number | null;          // selected tenant (gym) id
  onChange: (tenant: Tenant) => void;
  error?: string;
  label?: string;
}

/** Gym (tenant) picker in a bottom sheet, built on the tenants list API — mirrors BranchDropdown. */
export default function TenantDropdown({
  value,
  onChange,
  error,
  label = 'Gym',
}: Props) {
  const [open, setOpen] = useState(false);
  const { data: tenants = [], isLoading, isError } = useTenants();

  const selected = tenants.find(t => t.id === value) ?? null;
  const hasError = !!error;
  const triggerText = isLoading ? 'Loading gyms…'
    : isError  ? 'Failed to load'
    : selected ? selected.name
    : 'Select a gym';

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
        accessibilityHint="Opens the gym list"
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

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Select Gym">
        {isError ? (
          <EmptyState icon="wifi-off" tone="error" title="Failed to load gyms." />
        ) : tenants.length === 0 && !isLoading ? (
          <EmptyState icon="briefcase" title="No gyms found." />
        ) : (
          <FlatList
            data={tenants}
            keyExtractor={(item) => String(item.id)}
            style={{ maxHeight: 360 }}
            contentContainerStyle={{ paddingVertical: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = item.id === value;
              const sub = [item.plan, item.status].filter(Boolean).join('  ·  ');
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
                  accessibilityLabel={sub ? `${item.name}, ${sub}` : item.name}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View className="flex-1">
                    <Text numberOfLines={1} className={`text-[15px] font-medium ${isSelected ? 'text-brand' : 'text-white'}`}>
                      {item.name}
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
