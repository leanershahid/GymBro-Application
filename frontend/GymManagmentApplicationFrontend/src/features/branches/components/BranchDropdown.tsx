import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  FlatList, ActivityIndicator, Platform,
} from 'react-native';
import { useBranches } from '../api/branchQueries';
import { Branch } from '../types/branch.types';
import { T } from '../../trainers/components/theme';

interface Props {
  value: number | null;        // selected branch id (maps to tenantId)
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
        style={hasError ? { borderColor: '#EF4444' } : { borderColor: open ? '#444444' : T.line }}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={T.textFaint} style={{ marginRight: 8 }} />
        ) : null}

        <Text className={`flex-1 text-[15px] ${selected ? 'text-white' : 'text-faint'}`}>
          {isLoading  ? 'Loading branches…'
           : isError  ? 'Failed to load'
           : selected ? selected.name
           : 'Select a branch'}
        </Text>

        {/* chevron */}
        <Text
          className="text-[12px] text-faint ml-2"
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        >
          ▾
        </Text>
      </TouchableOpacity>

      {hasError && (
        <Text className="text-[12px] mt-1" style={{ color: '#EF4444' }}>{error}</Text>
      )}

      {/* Modal sheet ─────────────────────────────────────── */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/60"
          activeOpacity={1}
          onPress={() => setOpen(false)}
        />

        <View
          className="bg-surface rounded-t-[20px]"
          style={{ paddingBottom: Platform.OS === 'ios' ? 36 : 20 }}
        >
          {/* sheet header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-[#2A2A2A]">
            <Text className="text-[15px] font-bold text-white">Select Branch</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text className="text-[15px] text-sub">Close</Text>
            </TouchableOpacity>
          </View>

          {/* list */}
          {isError ? (
            <View className="items-center py-10">
              <Text className="text-[14px] text-faint">Failed to load branches.</Text>
            </View>
          ) : branches.length === 0 && !isLoading ? (
            <View className="items-center py-10">
              <Text className="text-[14px] text-faint">No branches found.</Text>
            </View>
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
                    className={`flex-row items-center px-5 py-4 border-b border-[#151915] ${
                      isSelected ? 'bg-[rgba(126,211,33,0.08)]' : ''
                    }`}
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View className="flex-1">
                      <Text className={`text-[15px] font-medium ${isSelected ? 'text-brand' : 'text-white'}`}>
                        {item.name}
                      </Text>
                      <Text className="text-[12px] text-faint mt-[2px]">
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
        </View>
      </Modal>
    </View>
  );
}
