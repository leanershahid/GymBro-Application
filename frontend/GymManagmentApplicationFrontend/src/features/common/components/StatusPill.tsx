import React from 'react';
import { View, Text } from 'react-native';
import { T, withAlpha } from '../../../theme';

export type PillTone = 'brand' | 'ok' | 'err' | 'warn' | 'info' | 'violet' | 'neutral';

const TONE: Record<PillTone, string> = {
  brand: T.brand, ok: T.ok, err: T.err, warn: T.brandGold, info: T.sky, violet: T.violet, neutral: T.textSub,
};

/** Common status words → tone, so every list colours "Active", "Inactive"… the same way. */
export function toneForStatus(status?: string | null): PillTone {
  switch ((status ?? '').toLowerCase()) {
    case 'active': case 'available': case 'completed': case 'paid': case 'converted': case 'open': return 'ok';
    case 'inactive': case 'cancelled': case 'suspended': case 'lost': case 'unavailable': case 'closed': return 'err';
    case 'trial': case 'pending': case 'new': case 'comingsoon': case 'frozen': return 'warn';
    case 'contacted': case 'qualified': case 'sent': return 'info';
    default: return 'neutral';
  }
}

interface Props {
  label: string;
  tone?: PillTone;
  /** Show a leading dot (status indicators). */
  dot?: boolean;
}

/** Small rounded badge for statuses, goals, difficulty etc. Text never drops below 11px. */
export default function StatusPill({ label, tone = toneForStatus(label), dot = false }: Props) {
  const c = TONE[tone];
  return (
    <View
      accessibilityLabel={label}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
        backgroundColor: withAlpha(c, 0.12), borderWidth: 1, borderColor: withAlpha(c, 0.28),
      }}
    >
      {dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />}
      <Text numberOfLines={1} style={{ color: c, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}
