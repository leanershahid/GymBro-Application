import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { useOutOfService } from '../api/facilitiesQueries';
import { backLabel } from '../utils/facilitiesFormat';

interface Props {
  branchId: number;
  /** Shows a "Report a problem" link under the list. */
  onReportProblem?: () => void;
}

/**
 * Member branch info: "Out of service: Treadmill 3 (back ~Fri)" for machines that are down (key
 * facilities show as service-status notices instead). Renders nothing when everything works and
 * there is no report link.
 */
export default function OutOfServiceList({ branchId, onReportProblem }: Props) {
  const q = useOutOfService(branchId);
  const items = q.data ?? [];
  if (items.length === 0 && !onReportProblem) return null;
  return (
    <View style={{ gap: SP.sm }}>
      {items.length > 0 && (
        <View accessibilityRole="summary" style={{
          padding: SP.lg, borderRadius: R.lg, gap: SP.sm,
          backgroundColor: withAlpha(T.brandGold, 0.08), borderWidth: 1, borderColor: withAlpha(T.brandGold, 0.28),
        }}>
          <Text accessibilityRole="header" style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>Out of service</Text>
          {items.map(i => {
            const text = `${i.name}${i.status === 'Limited' ? ' (limited)' : ''} · ${backLabel(i.expectedBackOn)}`;
            return (
              <View key={i.id} accessibilityLabel={text} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                <Feather name="tool" size={14} color={T.brandGold} />
                <Text style={{ color: T.textSub, fontSize: 14, flex: 1 }}>{text}</Text>
              </View>
            );
          })}
        </View>
      )}
      {onReportProblem && (
        <Pressable onPress={onReportProblem} accessibilityRole="button" accessibilityLabel="Report a problem with equipment or the gym"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SP.sm, minHeight: 44, opacity: pressed ? 0.7 : 1 })}>
          <Feather name="alert-circle" size={16} color={T.brand} />
          <Text style={{ color: T.brand, fontSize: 14, fontWeight: '700' }}>Something broken? Report a problem</Text>
        </Pressable>
      )}
    </View>
  );
}
