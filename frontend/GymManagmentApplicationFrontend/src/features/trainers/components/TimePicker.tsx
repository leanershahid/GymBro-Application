/**
 * TimePicker — custom modal drum-picker (no external deps)
 * value / onChange use "HH:MM" 24-hour strings.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  Platform, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { T } from './theme';

const ITEM_H  = 44;
const VISIBLE = 5;
const PAD     = Math.floor(VISIBLE / 2);

function pad2(n: number) { return String(n).padStart(2, '0'); }

const HOURS   = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

function parseHHMM(s: string): { h: number; min: number } {
  const parts = s.split(':').map(Number);
  return {
    h:   Number.isFinite(parts[0]) ? Math.max(0, Math.min(23, parts[0])) : 9,
    min: Number.isFinite(parts[1]) ? Math.max(0, Math.min(59, parts[1])) : 0,
  };
}

/* ── Drum column ───────────────────────────────────────────────── */
interface DrumProps {
  items: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  width?: number;
}

function Drum({ items, selectedIndex, onSelect, width = 72 }: DrumProps) {
  const ref    = useRef<ScrollView>(null);
  const listH  = VISIBLE * ITEM_H;
  const padded = [...Array(PAD).fill(''), ...items, ...Array(PAD).fill('')];

  const snap = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw     = e.nativeEvent.contentOffset.y;
    const index   = Math.round(raw / ITEM_H);
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    onSelect(clamped);
    ref.current?.scrollTo({ y: clamped * ITEM_H, animated: true });
  }, [items.length, onSelect]);

  return (
    <View style={{ width, overflow: 'hidden', position: 'relative' }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={snap}
        onScrollEndDrag={snap}
        scrollEventThrottle={16}
        contentOffset={{ x: 0, y: selectedIndex * ITEM_H }}
        style={{ height: listH }}
      >
        {padded.map((label, i) => {
          const dataIdx    = i - PAD;
          const isSelected = dataIdx === selectedIndex;
          return (
            <TouchableOpacity
              key={i}
              style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => {
                if (dataIdx >= 0 && dataIdx < items.length) {
                  onSelect(dataIdx);
                  ref.current?.scrollTo({ y: dataIdx * ITEM_H, animated: true });
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={{
                fontSize:   isSelected ? 20 : 18,
                fontWeight: isSelected ? '700' : '500',
                color:      isSelected ? T.text : T.textFaint,
              }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {/* highlight — kept as style: dynamic PAD * ITEM_H */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: PAD * ITEM_H,
          left: 0, right: 0,
          height: ITEM_H,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: T.brand,
          borderRadius: 8,
          backgroundColor: T.brandDim,
        }}
      />
    </View>
  );
}

/* ── Modal ─────────────────────────────────────────────────────── */
interface ModalProps {
  visible: boolean;
  value: string;
  onConfirm: (hhmm: string) => void;
  onClose: () => void;
}

function TimePickerModal({ visible, value, onConfirm, onClose }: ModalProps) {
  const init = parseHHMM(value);
  const [hIdx,   setHIdx]   = useState(init.h);
  const [minIdx, setMinIdx] = useState(init.min);

  const handleConfirm = () => {
    onConfirm(`${HOURS[hIdx]}:${MINUTES[minIdx]}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-black/60" activeOpacity={1} onPress={onClose} />
      <View
        className="bg-surface rounded-t-[20px]"
        style={{ paddingBottom: Platform.OS === 'ios' ? 36 : 24 }}
      >
        {/* header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-[#2A2A2A]">
          <TouchableOpacity onPress={onClose}>
            <Text className="text-[15px] text-sub">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-[15px] font-bold text-white">Select Time</Text>
          <TouchableOpacity onPress={handleConfirm}>
            <Text className="text-[15px] font-bold text-brand">Done</Text>
          </TouchableOpacity>
        </View>

        {/* drums */}
        <View className="flex-row justify-center items-center px-5 pt-3 pb-1">
          <Drum items={HOURS}   selectedIndex={hIdx}   onSelect={setHIdx}   width={88} />
          <Text className="text-[28px] font-extrabold text-white px-2 mb-[2px]">:</Text>
          <Drum items={MINUTES} selectedIndex={minIdx} onSelect={setMinIdx} width={88} />
        </View>

        {/* live preview */}
        <Text className="text-center text-[13px] text-sub pb-2" style={{ letterSpacing: 0.5 }}>
          {HOURS[hIdx]}:{MINUTES[minIdx]}
        </Text>
      </View>
    </Modal>
  );
}

/* ── Public field ───────────────────────────────────────────────── */
interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (hhmm: string) => void;
  placeholder?: string;
}

export function TimeField({ label, value, onChange, placeholder = 'Select time' }: TimeFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <View className="mb-4">
      <Text className="text-[13px] font-normal text-sub mb-[7px]">{label}</Text>
      <TouchableOpacity
        className={`flex-row items-center bg-input border rounded-xl px-4 py-[14px] ${
          open ? 'border-[#444444] bg-elevated' : 'border-line'
        }`}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
      >
        <Text className={`flex-1 text-[15px] ${value ? 'text-white' : 'text-faint'}`}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>

      <TimePickerModal
        visible={open}
        value={value || '09:00'}
        onConfirm={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
