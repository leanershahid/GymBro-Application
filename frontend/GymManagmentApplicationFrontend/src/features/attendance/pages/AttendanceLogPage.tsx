import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import StatusPill from '../../common/components/StatusPill';
import EmptyState from '../../dashboard/components/EmptyState';
import { useAttendanceLog } from '../api/attendanceQueries';
import { AttendanceRecord } from '../types/attendance.types';
import { formatDistance } from '../utils/location';

const METHOD_LABEL: Record<string, string> = {
  Location: 'Location', Face: 'Face', Biometric: 'Fingerprint', Qr: 'QR', Pin: 'PIN', Card: 'Card', Manual: 'Manual',
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Admin/trainer: who checked in on a given day, how, and where. */
interface Props {
  onBack?: () => void;
  /** Front desk: check someone in (shows a "Check in" button). */
  onCheckIn?: () => void;
  /** Opens attendance settings (check-in methods, branch geofences). */
  onOpenSettings?: () => void;
  /** Tapping a row opens that member. */
  onOpenMember?: (userId: number) => void;
}

/** Today's check-ins — the attendance module's first screen; settings sit behind the gear. */
export default function AttendanceLogPage({ onBack, onCheckIn, onOpenSettings, onOpenMember }: Props) {
  const [day, setDay] = useState(() => new Date());
  const date = isoDate(day);
  const { data, isLoading, isError, refetch, isRefetching } = useAttendanceLog(date);
  const isToday = date === isoDate(new Date());

  const shift = (days: number) => setDay(d => new Date(d.getTime() + days * 86_400_000));
  const label = useMemo(
    () => isToday ? 'Today' : day.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }),
    [day, isToday],
  );

  const renderItem = ({ item }: { item: AttendanceRecord }) => (
    <Pressable
      disabled={!onOpenMember}
      onPress={() => onOpenMember?.(item.userId)}
      accessibilityRole={onOpenMember ? 'button' : undefined}
      accessibilityLabel={`${item.userName ?? 'Member'}, ${item.branchName ?? ''}, checked in ${time(item.checkInAt)}${item.checkOutAt ? `, out ${time(item.checkOutAt)}` : ', still in'}, ${METHOD_LABEL[item.method] ?? item.method}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: R.lg, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{item.userName || '—'}</Text>
        <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>
          {[item.branchName, `${time(item.checkInAt)} – ${item.checkOutAt ? time(item.checkOutAt) : 'still in'}`,
            item.distanceM != null ? formatDistance(item.distanceM) + ' from branch' : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <StatusPill label={METHOD_LABEL[item.method] ?? item.method} tone={item.method === 'Location' ? 'info' : 'brand'} />
    </Pressable>
  );

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Attendance"
        title="Check-ins"
        onBack={onBack}
        right={(onCheckIn || onOpenSettings) && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {onOpenSettings && (
              <Pressable onPress={onOpenSettings} hitSlop={6} accessibilityRole="button" accessibilityLabel="Attendance settings"
                style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }}>
                <Feather name="settings" size={18} color={T.text} />
              </Pressable>
            )}
            {onCheckIn && (
              <Pressable onPress={onCheckIn} accessibilityRole="button" accessibilityLabel="Check in a member"
                style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.brand }}>
                <Feather name="log-in" size={16} color={T.onBrand} />
                <Text style={{ color: T.onBrand, fontSize: 14, fontWeight: '800' }}>Check in</Text>
              </Pressable>
            )}
          </View>
        )}
      />

      {/* Day switcher */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.xl, marginBottom: 12 }}>
        <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous day" style={{ padding: 10 }}>
          <Feather name="chevron-left" size={20} color={T.text} />
        </Pressable>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>
          {label}{data ? ` · ${data.totalRecords} visit${data.totalRecords === 1 ? '' : 's'}` : ''}
        </Text>
        <Pressable
          onPress={() => shift(1)} disabled={isToday} hitSlop={10}
          accessibilityRole="button" accessibilityLabel="Next day" accessibilityState={{ disabled: isToday }}
          style={{ padding: 10, opacity: isToday ? 0.3 : 1 }}
        >
          <Feather name="chevron-right" size={20} color={T.text} />
        </Pressable>
      </View>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load attendance" action={{ label: 'Retry', onPress: () => refetch() }} />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 32, gap: 10, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState icon="calendar" title="No check-ins" subtitle="Nobody checked in on this day." />}
        />
      )}
    </Screen>
  );
}
