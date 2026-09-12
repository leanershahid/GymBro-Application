/**
 * DatePicker — custom modal drum-picker (no external deps)
 * value / onChange use ISO "YYYY-MM-DD" strings.
 */
import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  Platform, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { T } from './theme';

const ITEM_H  = 44;
const VISIBLE = 5;
const PAD     = Math.floor(VISIBLE / 2);

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}
function pad2(n: number) { return String(n).padStart(2, '0'); }

function parseISO(iso: string): { y: number; m: number; d: number } {
  const parts = iso.split('-').map(Number);
  const now   = new Date();
  return {
    y: parts[0] || now.getFullYear(),
    m: parts[1] || now.getMonth() + 1,
    d: parts[2] || now.getDate(),
  };
}

/* ── Drum column ───────────────────────────────────────────────── */
interface DrumProps {
  items: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  width?: number;
}

function Drum({ items, selectedIndex, onSelect, width = 80 }: DrumProps) {
  const ref    = useRef<ScrollView>(null);
  const listH  = VISIBLE * ITEM_H;
  const padded = [...Array(PAD).fill(''), ...items, ...Array(PAD).fill('')];

  const snap = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw     = e.nativeEvent.contentOffset.y;
    const index   = Math.round(raw / ITEM_H);
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    onSelect(clamped);
    ref.current?.scrollTo({ y: clamped * ITEM_H, animated: true });
  };

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
                fontSize:   isSelected ? 17 : 16,
                fontWeight: isSelected ? '700' : '500',
                color:      isSelected ? T.text : T.textFaint,
              }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {/* selection highlight — kept as style because of dynamic PAD * ITEM_H */}
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
interface PickerModalProps {
  visible: boolean;
  value: string;
  onConfirm: (iso: string) => void;
  onClose: () => void;
  minYear?: number;
  maxYear?: number;
}

function DatePickerModal({ visible, value, onConfirm, onClose, minYear = 1950, maxYear }: PickerModalProps) {
  const max   = maxYear ?? new Date().getFullYear() + 10;
  const YEARS = Array.from({ length: max - minYear + 1 }, (_, i) => String(minYear + i));
  const DAYS_0 = (y: number, m: number) =>
    Array.from({ length: daysInMonth(y, m) }, (_, i) => pad2(i + 1));

  const init = parseISO(value);
  const [yIdx, setYIdx] = useState(() => YEARS.indexOf(String(init.y)));
  const [mIdx, setMIdx] = useState(init.m - 1);
  const [dIdx, setDIdx] = useState(init.d - 1);

  const days     = DAYS_0(Number(YEARS[Math.max(0, yIdx)]), mIdx + 1);
  const safeDIdx = Math.min(dIdx, days.length - 1);

  const handleConfirm = () => {
    const y  = YEARS[Math.max(0, yIdx)];
    const m  = pad2(mIdx + 1);
    const dd = days[safeDIdx] ?? '01';
    onConfirm(`${y}-${m}-${dd}`);
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
          <Text className="text-[15px] font-bold text-white">Select Date</Text>
          <TouchableOpacity onPress={handleConfirm}>
            <Text className="text-[15px] font-bold text-brand">Done</Text>
          </TouchableOpacity>
        </View>

        {/* drums */}
        <View className="flex-row justify-center items-center gap-1 px-5 py-2">
          <Drum items={MONTHS} selectedIndex={mIdx}                onSelect={setMIdx} width={130} />
          <Drum items={days}   selectedIndex={safeDIdx}            onSelect={setDIdx} width={64} />
          <Drum items={YEARS}  selectedIndex={Math.max(0, yIdx)}  onSelect={setYIdx} width={82} />
        </View>
      </View>
    </Modal>
  );
}

/* ── Public field ───────────────────────────────────────────────── */
interface DateFieldProps {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  error?: string;
}

export function DateField({ label, value, onChange, placeholder = 'Select date', minYear, maxYear, error }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const hasError = !!error;

  const display = value
    ? (() => { const { y, m, d } = parseISO(value); return `${MONTHS[m - 1]} ${d}, ${y}`; })()
    : '';

  return (
    <View className="mb-4">
      <Text className="text-[13px] font-normal text-sub mb-[7px]">{label}</Text>
      <TouchableOpacity
        className="flex-row items-center bg-input border rounded-xl px-4 py-[14px]"
        style={
          hasError ? { borderColor: '#EF4444' } :
          open     ? { borderColor: '#444444', backgroundColor: '#1C211C' } :
          { borderColor: T.line }
        }
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
      >
        <Text className={`flex-1 text-[15px] ${value ? 'text-white' : 'text-faint'}`}>
          {display || placeholder}
        </Text>
      </TouchableOpacity>
      {hasError && (
        <Text className="text-[12px] mt-1" style={{ color: '#EF4444' }}>{error}</Text>
      )}

      <DatePickerModal
        visible={open}
        value={value || `${new Date().getFullYear()}-01-01`}
        onConfirm={onChange}
        onClose={() => setOpen(false)}
        minYear={minYear}
        maxYear={maxYear}
      />
    </View>
  );
}
