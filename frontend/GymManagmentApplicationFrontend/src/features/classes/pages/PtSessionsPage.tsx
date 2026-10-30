import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, SectionList, RefreshControl } from 'react-native';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import LoadingState from '../../common/components/LoadingState';
import StatusPill from '../../common/components/StatusPill';
import EmptyState from '../../dashboard/components/EmptyState';
import { describeApiError } from '../../../api/apiError';
import { usePtSessions, useTrainerOptions } from '../api/classesQueries';
import { PtSession } from '../types/classes.types';
import PtTypesSection from '../components/PtTypesSection';
import { PtSessionSheet, PtBookSheet } from '../components/PtSessionSheets';
import { FilterRow, addDays, fmtDay, fmtMoney, fmtTime, localDateKey, statusLabel, statusTone } from '../components/classesUi';
import { T, SP, R } from '../../../theme';

export interface PtSessionsPageProps {
  onBack?: () => void;
  mode: 'admin' | 'trainer';
}

type Tab = 'sessions' | 'types';
type When = 'upcoming' | 'past';

const TABS: { key: Tab; label: string }[] = [
  { key: 'sessions', label: 'Sessions' },
  { key: 'types', label: 'Session types' },
];
const WHEN: { key: When; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

/** Personal training for staff: session list with status actions, booking for members, and session types. */
export default function PtSessionsPage({ onBack, mode }: PtSessionsPageProps) {
  const isAdmin = mode === 'admin';
  const [tab, setTab] = useState<Tab>('sessions');
  const [when, setWhen] = useState<When>('upcoming');
  const [trainerId, setTrainerId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [booking, setBooking] = useState(false);
  const trainers = useTrainerOptions(isAdmin);

  // Fixed per mount (rounded to the hour) so the query key stays stable between renders.
  const [now] = useState(() => { const d = new Date(); d.setMinutes(0, 0, 0); return d; });
  const filter = useMemo(() => when === 'upcoming'
    ? { from: now.toISOString(), to: addDays(now, 90).toISOString(), trainerId: isAdmin ? trainerId : null }
    : { from: addDays(now, -90).toISOString(), to: now.toISOString(), trainerId: isAdmin ? trainerId : null },
  [when, trainerId, now, isAdmin]);
  const { data, isLoading, error, refetch, isRefetching, isPlaceholderData } = usePtSessions(filter);

  const sections = useMemo(() => {
    const rows = [...(data ?? [])];
    if (when === 'past') rows.reverse();
    const groups: { title: string; data: PtSession[] }[] = [];
    for (const s of rows) {
      const key = localDateKey(new Date(s.startsAt));
      const last = groups[groups.length - 1];
      if (last && last.title === key) last.data.push(s);
      else groups.push({ title: key, data: [s] });
    }
    return groups;
  }, [data, when]);
  const selected = selectedId != null ? (data ?? []).find(s => s.id === selectedId) ?? null : null;

  return (
    <Screen>
      <ScreenHeader
        eyebrow={isAdmin ? 'Personal training' : 'My PT'}
        title="PT sessions"
        onBack={onBack}
        action={tab === 'sessions' ? { label: 'Book', icon: 'plus', onPress: () => setBooking(true) } : undefined}
      />
      <View style={{ paddingHorizontal: SP.xl, marginBottom: SP.md }}>
        <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
      </View>

      {tab === 'types' ? <PtTypesSection mode={mode} /> : (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: SP.xl }}>
            <View style={{ flexDirection: 'row', gap: SP.sm, marginBottom: SP.sm }}>
              {WHEN.map(w => {
                const active = w.key === when;
                return (
                  <Pressable key={w.key} onPress={() => setWhen(w.key)} accessibilityRole="radio" accessibilityState={{ selected: active }}
                    style={{
                      minHeight: 34, justifyContent: 'center', paddingHorizontal: 14, borderRadius: R.pill, borderWidth: 1,
                      backgroundColor: active ? T.brand : T.bgInput, borderColor: active ? T.brand : T.line,
                    }}>
                    <Text style={{ color: active ? T.onBrand : T.textSub, fontSize: 12, fontWeight: '700' }}>{w.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {isAdmin && (trainers.data?.length ?? 0) > 0 && (
              <FilterRow<number> label="Trainer" allLabel="All trainers" value={trainerId} onChange={setTrainerId}
                options={(trainers.data ?? []).map(t => ({ value: t.id, label: t.name }))} />
            )}
          </View>

          {isLoading ? <LoadingState label="Loading sessions…" /> : error ? (
            <EmptyState icon="alert-triangle" tone="error" title="Couldn't load sessions"
              subtitle={describeApiError(error).message} action={{ label: 'Try again', onPress: () => refetch() }} />
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={s => String(s.id)}
              style={{ opacity: isPlaceholderData ? 0.5 : 1 }}
              contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }}
              stickySectionHeadersEnabled={false}
              refreshControl={<RefreshControl refreshing={isRefetching && !isPlaceholderData} onRefresh={refetch} tintColor={T.brand} />}
              renderSectionHeader={({ section }) => (
                <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: SP.md, marginBottom: SP.sm }}>
                  {fmtDay(new Date(`${section.title}T00:00:00`))}
                </Text>
              )}
              ListEmptyComponent={
                <EmptyState icon="calendar" title={when === 'upcoming' ? 'No upcoming sessions' : 'No sessions in the last 90 days'}
                  subtitle={when === 'upcoming' ? 'Book a session for a member to get started.' : undefined}
                  action={when === 'upcoming' ? { label: 'Book session', onPress: () => setBooking(true) } : undefined} />
              }
              renderItem={({ item }) => <SessionCard s={item} showTrainer={isAdmin} onPress={() => setSelectedId(item.id)} />}
            />
          )}
        </View>
      )}

      <PtSessionSheet session={selected} onClose={() => setSelectedId(null)} mode={mode} />
      <PtBookSheet visible={booking} onClose={() => setBooking(false)} mode={mode} />
    </Screen>
  );
}

function SessionCard({ s, showTrainer, onPress }: { s: PtSession; showTrainer: boolean; onPress: () => void }) {
  const dim = s.status === 'Cancelled' || s.status === 'NoShow';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${s.sessionTypeName} with ${s.clientName ?? 'member'} at ${fmtTime(s.startsAt)}, ${statusLabel(s.status)}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.md, marginBottom: SP.sm,
        borderRadius: R.lg, borderWidth: 1, borderColor: T.line, opacity: dim ? 0.6 : 1,
        backgroundColor: pressed ? T.bgInputActive : T.bgInput,
      })}
    >
      <View style={{ width: 56, alignItems: 'center' }}>
        <Text style={{ color: T.text, fontSize: 14, fontWeight: '800' }}>{fmtTime(s.startsAt)}</Text>
        <Text style={{ color: T.textFaint, fontSize: 11, marginTop: 2 }}>{fmtTime(s.endsAt)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>{s.clientName ?? `Member #${s.clientId}`}</Text>
        <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
          {s.sessionTypeName}{showTrainer && s.trainerName ? ` · ${s.trainerName}` : ''}{s.price ? ` · ${fmtMoney(s.price, s.currency)}` : ''}
        </Text>
      </View>
      <StatusPill label={statusLabel(s.status)} tone={statusTone(s.status)} />
    </Pressable>
  );
}
