import React from 'react';
import { View, Text, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { TrainerPayload, Availability } from '../types/trainer.types';
import { TimeField } from './TimePicker';
import { T } from './theme';

interface Props {
  data: Partial<TrainerPayload>;
  onChange: (fields: Partial<TrainerPayload>) => void;
}

const DAY_ABBR: Record<string, string> = {
  Monday: 'M', Tuesday: 'T', Wednesday: 'W',
  Thursday: 'T', Friday: 'F', Saturday: 'S', Sunday: 'S',
};

export default function StepAvailability({ data, onChange }: Props) {
  const availability: Availability[] = data.availability ?? [];
  const activeDays = availability.filter((a) => a.isAvailable).length;

  const updateDay = (index: number, fields: Partial<Availability>) =>
    onChange({ availability: availability.map((a, i) => (i === index ? { ...a, ...fields } : a)) });

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Page header ─────────────────────────────────────── */}
      <Text className="text-[30px] font-extrabold text-white mb-[6px]" style={{ letterSpacing: -0.5 }}>
        Availability
      </Text>
      <Text className="text-[14px] font-normal text-sub mb-6" style={{ lineHeight: 20 }}>
        Set the trainer's weekly working schedule
      </Text>

      {/* ── Quick day-dot row ────────────────────────────────── */}
      <View className="flex-row gap-2 mb-[10px]">
        {availability.map((item, index) => (
          <TouchableOpacity
            key={item.day}
            className={`flex-1 h-9 rounded-xl border items-center justify-center ${
              item.isAvailable ? 'bg-brand border-brand' : 'bg-input border-line'
            }`}
            onPress={() => updateDay(index, { isAvailable: !item.isAvailable })}
            activeOpacity={0.75}
          >
            <Text className={`text-[12px] font-bold ${item.isAvailable ? 'text-black' : 'text-faint'}`}>
              {DAY_ABBR[item.day]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Active count ─────────────────────────────────────── */}
      <Text className="text-[13px] mb-5 mt-1">
        <Text className="font-bold text-brand">{activeDays}</Text>
        <Text className="text-sub"> / 7 days active</Text>
      </Text>

      {/* ── Day cards ─────────────────────────────────────────── */}
      {availability.map((item, index) => (
        <View
          key={item.day}
          className={`rounded-xl border p-[14px] mb-[10px] ${
            item.isAvailable
              ? 'border-[rgba(126,211,33,0.25)] bg-[rgba(126,211,33,0.10)]'
              : 'border-line bg-input'
          }`}
        >
          <View className="flex-row items-center gap-3">
            {/* Day abbreviation badge */}
            <View
              className={`w-[42px] h-[42px] rounded-[10px] border items-center justify-center ${
                item.isAvailable
                  ? 'bg-[rgba(126,211,33,0.10)] border-[rgba(126,211,33,0.25)]'
                  : 'bg-elevated border-line'
              }`}
            >
              <Text
                className={`text-[11px] font-extrabold ${item.isAvailable ? 'text-brand' : 'text-faint'}`}
                style={{ letterSpacing: 0.5 }}
              >
                {item.day.slice(0, 3).toUpperCase()}
              </Text>
            </View>

            <View className="flex-1">
              <Text className={`text-[14px] ${item.isAvailable ? 'font-semibold text-white' : 'font-medium text-sub'}`}>
                {item.day}
              </Text>
              <Text
                className="text-[12px] mt-[2px]"
                style={{
                  color: item.isAvailable && item.startTime && item.endTime
                    ? T.brand
                    : T.textFaint,
                }}
              >
                {item.isAvailable
                  ? item.startTime && item.endTime
                    ? `${item.startTime} – ${item.endTime}`
                    : 'Set hours below'
                  : 'Day off'}
              </Text>
            </View>

            <Switch
              value={item.isAvailable}
              onValueChange={(v) => updateDay(index, { isAvailable: v })}
              trackColor={{ false: '#2A2A2A', true: T.brand }}
              thumbColor={item.isAvailable ? T.onBrand : '#FFFFFF'}
            />
          </View>

          {item.isAvailable && (
            <View className="flex-row items-start gap-[10px] mt-[14px]">
              <View className="flex-1">
                <TimeField
                  label="Start time"
                  value={item.startTime}
                  onChange={(v) => updateDay(index, { startTime: v })}
                  placeholder="09:00"
                />
              </View>
              <View className="mt-7">
                <Text className="text-[14px] text-faint">→</Text>
              </View>
              <View className="flex-1">
                <TimeField
                  label="End time"
                  value={item.endTime}
                  onChange={(v) => updateDay(index, { endTime: v })}
                  placeholder="17:00"
                />
              </View>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
