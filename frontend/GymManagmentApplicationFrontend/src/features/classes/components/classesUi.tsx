import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import SearchBar from '../../common/components/SearchBar';
import { PillTone } from '../../common/components/StatusPill';
import { useMemberSearch } from '../api/classesQueries';
import { describeApiError } from '../../../api/apiError';
import { MemberOption } from '../types/classes.types';
import { T, SP, R, withAlpha } from '../../../theme';

// ─── Dates (API = UTC ISO; UI = device local) ────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local "YYYY-MM-DD". */
export const localDateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
/** Local "HH:MM". */
export const localTimeKey = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Local date ("YYYY-MM-DD") + time ("HH:MM") → UTC ISO for the API. */
export function toUtcIso(date: string, time: string): string | null {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  if (!y || !m || !d || !Number.isFinite(h) || !Number.isFinite(min)) return null;
  const dt = new Date(y, m - 1, d, h, min, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

/** Monday 00:00 local of the week containing d. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  return x;
}

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const fmtDay = (iso: string | Date) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtDateTime = (iso: string) => `${fmtDay(iso)} · ${fmtTime(iso)}`;

export const minutesBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

/** "45" → 45; blank/junk → null. */
export const toInt = (s: string): number | null => {
  const n = parseInt(s.trim(), 10);
  return Number.isFinite(n) ? n : null;
};

/** "12.5" / "12,5" → 12.5; blank/junk → null. */
export const toDecimal = (s: string): number | null => {
  const n = parseFloat(s.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export const fmtMoney = (amount: number | null | undefined, currency?: string | null) => {
  const n = Number.isFinite(amount) ? Number(amount) : 0;
  if (!currency) return n.toFixed(2);
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n); }
  catch { return `${currency} ${n.toFixed(2)}`; }
};

// ─── Status → pill ───────────────────────────────────────────────

export const statusLabel = (s: string) => (s === 'NoShow' ? 'No-show' : s === 'InProgress' ? 'In progress' : s);

export function statusTone(s: string): PillTone {
  switch (s.toLowerCase()) {
    case 'scheduled': case 'booked': return 'info';
    case 'confirmed': case 'inprogress': return 'brand';
    case 'completed': case 'attended': return 'ok';
    case 'cancelled': case 'noshow': return 'err';
    case 'waitlisted': return 'warn';
    default: return 'neutral';
  }
}

/** Colours offered for class types — theme tokens only. */
export const TYPE_COLORS: string[] = [T.brand, T.brandGold, T.sky, T.violet, T.rose, T.ok];

// ─── Building blocks ─────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: SP.sm }}>
      {children}
    </Text>
  );
}

/** Horizontally scrolling single-select chips (filters). `null` = "All". */
export function FilterRow<V extends number | string>({ label, options, value, onChange, allLabel }: {
  label?: string;
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V | null) => void;
  /** Adds an "All" chip that clears the filter. */
  allLabel?: string;
}) {
  const chips: { value: V | null; label: string }[] = allLabel ? [{ value: null, label: allLabel }, ...options] : options;
  return (
    <View style={{ marginBottom: SP.sm }}>
      {!!label && <Text style={{ color: T.textFaint, fontSize: 12, marginBottom: 6 }}>{label}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm }}>
        {chips.map(o => {
          const active = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label ?? 'Filter'}: ${o.label}`}
              style={{
                minHeight: 34, justifyContent: 'center', paddingHorizontal: 14, borderRadius: R.pill, borderWidth: 1,
                backgroundColor: active ? T.brand : T.bgInput, borderColor: active ? T.brand : T.line,
              }}
            >
              <Text style={{ color: active ? T.onBrand : T.textSub, fontSize: 12, fontWeight: '700' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function SmallButton({ icon, label, tone = T.brand, onPress, disabled, busy }: {
  icon: React.ComponentProps<typeof Feather>['name']; label: string; tone?: string;
  onPress: () => void; disabled?: boolean; busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34,
        paddingHorizontal: 12, borderRadius: R.pill, opacity: disabled ? 0.45 : 1,
        backgroundColor: pressed ? withAlpha(tone, 0.18) : withAlpha(tone, 0.10),
        borderWidth: 1, borderColor: withAlpha(tone, 0.28),
      })}
    >
      {busy ? <ActivityIndicator size="small" color={tone} /> : <Feather name={icon} size={13} color={tone} />}
      <Text style={{ color: tone, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

/** Debounced member search with a tappable result list. */
export function MemberPicker({ selected, onSelect, label = 'Member' }: {
  selected: MemberOption | null;
  onSelect: (m: MemberOption | null) => void;
  label?: string;
}) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const { data, isFetching, error } = useMemberSearch(query, !selected && query.length >= 2);

  if (selected) {
    return (
      <View style={{ marginBottom: SP.lg }}>
        <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>{label}</Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.md, borderRadius: R.md,
          borderWidth: 1, borderColor: T.brandBorder, backgroundColor: T.brandDim,
        }}>
          <Feather name="user-check" size={16} color={T.brand} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{selected.name}</Text>
            {!!(selected.email || selected.phone) && (
              <Text style={{ color: T.textFaint, fontSize: 12 }} numberOfLines={1}>{selected.email || selected.phone}</Text>
            )}
          </View>
          <SmallButton icon="x" label="Change" tone={T.textSub} onPress={() => onSelect(null)} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: SP.lg }}>
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>{label}</Text>
      <SearchBar value={text} onChangeText={setText} placeholder="Search by name, email or phone…" label={`Search ${label.toLowerCase()}`} />
      <View style={{ marginTop: SP.sm }}>
        {query.length < 2 ? (
          <Text style={{ color: T.textFaint, fontSize: 12 }}>Type at least 2 characters.</Text>
        ) : error ? (
          <Text style={{ color: T.err, fontSize: 12 }}>{describeApiError(error).message}</Text>
        ) : isFetching && !data ? (
          <ActivityIndicator color={T.brand} style={{ marginVertical: SP.md }} />
        ) : (data ?? []).length === 0 ? (
          <Text style={{ color: T.textFaint, fontSize: 12 }}>No members match "{query}".</Text>
        ) : (
          (data ?? []).slice(0, 8).map(m => (
            <Pressable
              key={m.id}
              onPress={() => { onSelect(m); setText(''); setQuery(''); }}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${m.name}`}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: SP.md, paddingHorizontal: SP.sm,
                borderBottomWidth: 1, borderBottomColor: T.line, backgroundColor: pressed ? T.bgInputActive : 'transparent',
              })}
            >
              <Feather name="user" size={15} color={T.textSub} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{m.name}</Text>
                {!!(m.email || m.phone) && <Text style={{ color: T.textFaint, fontSize: 12 }} numberOfLines={1}>{m.email || m.phone}</Text>}
              </View>
              <Feather name="plus-circle" size={16} color={T.brand} />
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}
