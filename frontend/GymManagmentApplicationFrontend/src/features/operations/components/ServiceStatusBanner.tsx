import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { useActiveStatuses } from '../api/operationsQueries';
import type { ServiceStatus } from '../types/operations.types';
import { statusColor, statusIcon, untilLabel } from '../utils/hours';

interface Props {
  /** Defaults to the member's own branch (+ gym-wide notices). */
  branchId?: number;
  /** Already-loaded notices (branch info screen); skips the fetch. */
  statuses?: ServiceStatus[];
  /** Opens the branch info screen. */
  onPress?: () => void;
  /** Show every notice instead of the worst one + "N more". */
  expanded?: boolean;
}

/**
 * "Pool · Closed — closed for maintenance, until Fri 6pm". Renders nothing when everything runs
 * normally (or on load errors: it is a non-essential Home card). Notices expire on the server.
 */
export default function ServiceStatusBanner({ branchId, statuses, onPress, expanded }: Props) {
  const q = useActiveStatuses(branchId);
  const list = (statuses ?? q.data ?? []).filter(s => s.isActive);
  if (list.length === 0) return null;
  const shown = expanded ? list : list.slice(0, 1);
  const more = list.length - shown.length;

  return (
    <View style={{ gap: SP.sm }}>
      {shown.map(s => <StatusRow key={s.id} s={s} onPress={onPress} />)}
      {more > 0 && (
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          accessibilityRole="button"
          accessibilityLabel={`${more} more service ${more === 1 ? 'update' : 'updates'}`}
          style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: SP.xs }}
        >
          <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '600' }}>+ {more} more {more === 1 ? 'update' : 'updates'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function StatusRow({ s, onPress }: { s: ServiceStatus; onPress?: () => void }) {
  const c = statusColor(s);
  const until = untilLabel(s.endsAt);
  const where = s.branchName && s.area ? ` · ${s.branchName}` : '';
  const body = (
    <>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha(c, 0.16), alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={statusIcon(s)} size={18} color={c} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: c, fontSize: 13, fontWeight: '800', letterSpacing: 0.2 }} numberOfLines={1}>{s.headline}{where}</Text>
        <Text style={{ color: T.text, fontSize: 14, lineHeight: 19, marginTop: 2 }}>{s.message}</Text>
        {until && <Text style={{ color: T.textSub, fontSize: 12, marginTop: 4 }}>{until}</Text>}
      </View>
      {onPress && <Feather name="chevron-right" size={18} color={T.textFaint} />}
    </>
  );
  const style = {
    flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: SP.md, padding: SP.md + 2, borderRadius: R.lg,
    backgroundColor: withAlpha(c, 0.08), borderWidth: 1, borderColor: withAlpha(c, 0.3),
  };
  const label = `${s.headline}. ${s.message}${until ? `. ${until}` : ''}`;
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Opens gym info"
      style={({ pressed }) => [style, { opacity: pressed ? 0.8 : 1 }]}>
      {body}
    </Pressable>
  ) : (
    <View accessibilityRole="alert" accessibilityLabel={label} style={style}>{body}</View>
  );
}
