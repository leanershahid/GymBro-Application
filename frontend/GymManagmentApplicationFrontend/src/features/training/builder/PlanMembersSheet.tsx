import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import { confirm, showAlert } from '../../common/components/dialogs';
import { formatDate } from '../../common/utils/format';
import { apiErrorText } from '../../../api/apiError';
import { usePlanMembers, useClientCalendar, useClientDayOverrides } from '../api/trainingQueries';
import type { AssignmentStatus, CalendarEntry, PlanMember } from '../api/training.types';
import { Chip } from './BuilderUi';
import { isoDate } from './AssignSheet';

const STATUS_TONE: Record<AssignmentStatus, PillTone> = { Assigned: 'info', InProgress: 'ok', Completed: 'brand', Skipped: 'warn', Expired: 'neutral' };

/** Members on a plan (their copies), with adherence; tap one to open their copy. */
export function PlanMembersSheet({ visible, planId, planName, onClose, onOpen }: {
  visible: boolean; planId: number; planName: string; onClose: () => void; onOpen: (m: PlanMember) => void;
}) {
  const { height } = useWindowDimensions();
  const { data = [], isLoading, isError, error, refetch } = usePlanMembers(planId, visible);
  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Members · ${planName}`}>
      <ScrollView style={{ maxHeight: Math.min(height * 0.75, 640) }} contentContainerStyle={{ padding: SP.xl }}>
        {isLoading && <Skeleton rows={3} height={64} />}
        {isError && <EmptyState icon="wifi-off" tone="error" title="Couldn't load members" subtitle={apiErrorText(error)} action={{ label: 'Retry', onPress: () => refetch() }} />}
        {!isLoading && !isError && data.length === 0 && <EmptyState icon="users" title="Nobody is on this plan yet" subtitle="Assign it to give members their own copy." />}
        {!isLoading && !isError && data.map(m => {
          const pct = m.adherence?.percent;
          return (
            <Pressable
              key={m.assignmentId}
              onPress={() => onOpen(m)}
              accessibilityRole="button"
              accessibilityLabel={`${m.clientName ?? 'Member'}, ${m.status}${pct != null ? `, ${pct}% adherence` : ''}`}
              accessibilityHint="Opens their copy of the plan"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.md, marginBottom: SP.sm, borderRadius: R.md, backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderWidth: 1, borderColor: T.line })}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(T.brand, 0.1), borderWidth: 1, borderColor: withAlpha(T.brand, 0.3) }}>
                <Text style={{ color: T.brand, fontSize: 12, fontWeight: '800' }}>{pct != null ? `${Math.round(pct)}%` : '—'}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{m.clientName ?? `Member #${m.clientId}`}</Text>
                <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>
                  {formatDate(m.startDate)} → {formatDate(m.endDate)}{m.currentWeek ? ` · W${m.currentWeek} D${m.currentDay}` : ''}
                </Text>
              </View>
              <StatusPill label={m.status === 'InProgress' ? 'In progress' : m.status} tone={STATUS_TONE[m.status]} />
              <Feather name="chevron-right" size={16} color={T.textFaint} />
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
};

/** A client's next two weeks, with staff skip / move / undo per day. */
export function ClientScheduleSheet({ visible, assignmentId, onClose }: { visible: boolean; assignmentId: number; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const today = isoDate(new Date());
  const { data, isLoading, isError, error, refetch } = useClientCalendar(assignmentId, today, addDays(today, 13), visible);
  const { skip, move, undo } = useClientDayOverrides(assignmentId);
  const [moving, setMoving] = useState<CalendarEntry | null>(null);
  const busy = skip.isPending || move.isPending || undo.isPending;

  const run = (p: Promise<unknown>) => p.catch(e => showAlert('Could not change the day', apiErrorText(e)));
  const doSkip = async (e: CalendarEntry) => {
    if (await confirm({ title: 'Skip this day?', message: `${e.title ?? 'Workout'} on ${formatDate(e.date)} is marked skipped.`, confirmLabel: 'Skip' })) run(skip.mutateAsync({ date: e.date }));
  };
  const moveTo = (to: string) => { if (moving) run(move.mutateAsync({ date: moving.date, toDate: to })); setMoving(null); };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Next two weeks">
      <ScrollView style={{ maxHeight: Math.min(height * 0.75, 640) }} contentContainerStyle={{ padding: SP.xl }}>
        {isLoading && <Skeleton rows={4} height={48} />}
        {isError && <EmptyState icon="wifi-off" tone="error" title="Couldn't load the calendar" subtitle={apiErrorText(error)} action={{ label: 'Retry', onPress: () => refetch() }} />}
        {data && data.entries.length === 0 && <EmptyState icon="calendar" title="Nothing scheduled in the next two weeks" />}
        {data?.entries.map((e, i) => {
          const canSkip = e.status === 'scheduled' && !e.isRestDay && !e.movedFromDate;
          const canUndo = e.status === 'skipped' || (e.status === 'moved' && !!e.movedToDate);
          return (
            <View key={`${e.date}-${i}`} style={{ paddingVertical: SP.sm, borderBottomWidth: 1, borderBottomColor: T.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                <Text style={{ width: 84, color: e.isToday ? T.brand : T.textSub, fontSize: 12, fontWeight: '700' }}>{formatDate(e.date)}</Text>
                <Text numberOfLines={1} style={{ flex: 1, color: e.isRestDay ? T.textFaint : T.text, fontSize: 13, fontWeight: '600' }}>
                  {e.isRestDay ? 'Rest' : e.title ?? `W${e.weekNumber} D${e.dayNumber}`}{e.movedFromDate ? ` (from ${formatDate(e.movedFromDate)})` : ''}
                </Text>
                <Text style={{ color: T.textFaint, fontSize: 11 }}>{e.status}</Text>
              </View>
              {(canSkip || canUndo) && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, marginLeft: 84 }}>
                  {canSkip && <Chip small icon="slash" label="Skip" onPress={() => !busy && doSkip(e)} />}
                  {canSkip && <Chip small icon="move" label="Move" active={moving?.date === e.date} onPress={() => setMoving(moving?.date === e.date ? null : e)} />}
                  {canUndo && <Chip small icon="rotate-ccw" label="Undo" onPress={() => !busy && run(undo.mutateAsync(e.date))} />}
                </View>
              )}
              {moving?.date === e.date && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6, marginLeft: 84 }}>
                  {Array.from({ length: 7 }, (_, k) => addDays(e.date, k + 1)).map(d => (
                    <Chip key={d} small label={formatDate(d)} onPress={() => moveTo(d)} a11y={`Move to ${formatDate(d)}`} />
                  ))}
                </ScrollView>
              )}
            </View>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}
