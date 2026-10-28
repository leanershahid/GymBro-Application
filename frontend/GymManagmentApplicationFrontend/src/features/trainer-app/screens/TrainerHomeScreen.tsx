import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import {
  useTrainerProfile, useTrainerPerformance, useTrainerEarnings, useMyClients, useTrainerSchedule,
} from '../api/trainerAppQueries';
import { useModuleAccess } from '../../module-access/context/ModuleAccessContext';
import { T, R, SP, withAlpha } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import Screen from '../../common/components/Screen';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../dashboard/components/EmptyState';
import SectionHeader from '../../dashboard/components/Sectionheader';
import PhotoHero from '../../common/components/dashboard/PhotoHero';
import CheckInCard from '../../attendance/components/CheckInCard';
import KpiTile from '../../common/components/dashboard/KpiTile';
import ActionList, { ActionItem } from '../../common/components/dashboard/ActionList';
import TrainerHomeHeader from '../components/TrainerHomeHeader';
import RatingTile from '../components/RatingTile';
import ClientPreviewRow from '../components/ClientPreviewRow';

const IMG_COACH = require('../../../assets/dashboard/coach-2.jpg');

const SECTION_GAP = 28;
const KPI_GAP = 12;
const CLIENT_PREVIEW = 5;

interface Props {
  trainerId: number;
  onNavigate: (screen: string) => void;
}

/** ₹84.5K · ₹1.2L · ₹3.4Cr — Indian compact currency. */
function inrCompact(n: number): string {
  const fmt = (v: number) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, ''));
  if (n >= 1e7) return `₹${fmt(n / 1e7)}Cr`;
  if (n >= 1e5) return `₹${fmt(n / 1e5)}L`;
  if (n >= 1e3) return `₹${fmt(n / 1e3)}K`;
  return `₹${Math.round(n)}`;
}

/** "06:00:00" → "06:00" */
const hhmm = (t: string) => t.slice(0, 5);

function greetingFor(hour: number) {
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export default function TrainerHomeScreen({ trainerId, onNavigate }: Props) {
  const profileQ  = useTrainerProfile(trainerId);
  const perfQ     = useTrainerPerformance(trainerId);
  const earningsQ = useTrainerEarnings(trainerId);
  const clientsQ  = useMyClients(trainerId);
  const scheduleQ = useTrainerSchedule(trainerId);
  const canWorkouts = useModuleAccess('workouts');
  const { hPad, tileW } = useLayout();
  const kpiW = tileW(2, KPI_GAP);

  const profile  = profileQ.data;
  const perf     = perfQ.data;
  const earnings = earningsQ.data;
  const clients  = clientsQ.data ?? [];
  const schedule = scheduleQ.data ?? [];

  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      profileQ.refetch(), perfQ.refetch(), earningsQ.refetch(), clientsQ.refetch(), scheduleQ.refetch(),
    ]);
    setRefreshing(false);
  }, [profileQ, perfQ, earningsQ, clientsQ, scheduleQ]);

  const now = new Date();
  const firstName = (profile?.displayName ?? 'Coach').split(' ')[0] || 'Coach';
  const activeClients = clients.filter(c => c.status === 'Active').length;
  const totalSessions = perf?.totalSessions ?? 0;

  // ── Today's shift (dayOfWeek 1=Mon … 7=Sun; JS getDay() 0=Sun) ──
  const todayDow = now.getDay() === 0 ? 7 : now.getDay();
  const shift = schedule.find(s => s.dayOfWeek === todayDow && s.isActive);

  const actions = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];
    if (profile && !profile.isAvailable) {
      items.push({
        key: 'availability', icon: 'alert-circle', tone: 'warn',
        title: 'Update availability', subtitle: "You're marked unavailable to new clients",
        onPress: () => onNavigate('profile'),
      });
    }
    items.push(shift
      ? {
          key: 'shift', icon: 'clock', tone: 'info',
          title: `${hhmm(shift.startTime)} – ${hhmm(shift.endTime)}`,
          subtitle: `Your shift · ${now.toLocaleDateString('en-IN', { weekday: 'long' })}`,
        }
      : scheduleQ.isLoading
        ? { key: 'shift', icon: 'clock', tone: 'info', title: "Today's shift", subtitle: 'Loading schedule…' }
        : scheduleQ.isError
          ? { key: 'shift', icon: 'clock', tone: 'info', title: "Today's shift", subtitle: 'Schedule unavailable' }
          : { key: 'shift', icon: 'moon', tone: 'info', title: 'Day off', subtitle: 'No shift scheduled today' });
    items.push({
      key: 'clients', icon: 'users', tone: 'brand',
      title: 'Check in on clients',
      subtitle: activeClients > 0 ? `${activeClients} active client${activeClients === 1 ? '' : 's'}` : 'No active clients yet',
      badge: activeClients > 0 ? String(activeClients) : undefined,
      onPress: () => onNavigate('clients'),
    });
    if (canWorkouts) {
      items.push({
        key: 'builder', icon: 'activity', tone: 'brand',
        title: 'Build a program', subtitle: 'Create a workout plan for a client',
        onPress: () => onNavigate('builder'),
      });
    }
    return items;
  }, [profile, shift, scheduleQ.isLoading, scheduleQ.isError, activeClients, canWorkouts, onNavigate]);

  if (profileQ.isLoading) return <LoadingState fullScreen label="Loading your day" />;

  if (profileQ.isError && !profile) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <EmptyState
          icon="wifi-off"
          tone="error"
          title="Couldn't load your dashboard"
          subtitle="Check your connection and try again."
          action={{ label: 'Retry', onPress: refresh }}
        />
      </Screen>
    );
  }

  const specializations = profile?.specializations?.filter(Boolean) ?? [];
  const commission = earnings?.commissionEarned ?? 0;
  const commissionShare = earnings && earnings.totalEarnings > 0
    ? Math.round((commission / earnings.totalEarnings) * 100)
    : null;
  const monthLabel = earnings
    ? new Date(earnings.year, earnings.month - 1).toLocaleString('en-IN', { month: 'long' })
    : 'This month';

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: SP.md, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={T.brand} colors={[T.brand]} />}
      >
        {/* 1 ── Header */}
        <TrainerHomeHeader
          greeting={greetingFor(now.getHours())}
          firstName={firstName}
          branchName={profile?.branchName}
        />

        {/* Location check-in (only when the gym has it switched on at a branch) */}
        <View style={{ marginTop: SP.xl }}><CheckInCard /></View>

        {/* 2 ── Photo hero: the month's number */}
        <View style={{ marginTop: SP.xl }}>
          <PhotoHero
            image={IMG_COACH}
            eyebrow={earnings ? `Earnings · ${monthLabel}` : 'Earnings this month'}
            title={perf
              ? `${totalSessions.toLocaleString('en-IN')} session${totalSessions === 1 ? '' : 's'} coached so far`
              : 'Your coaching this month'}
            value={earnings ? inrCompact(earnings.totalEarnings) : '—'}
            valueCaption={earnings ? `incl. ${inrCompact(commission)} commission` : 'Earnings not available yet'}
            cta={{ label: 'Clients', icon: 'users', onPress: () => onNavigate('clients') }}
          />
        </View>

        {/* 3 ── Today: action-first */}
        <View style={{ marginTop: SECTION_GAP }}>
          <SectionHeader title="Today" />
          <ActionList items={actions} />
        </View>

        {/* 4 ── KPIs */}
        <View style={{ marginTop: SECTION_GAP }}>
          <SectionHeader title="At a glance" onPressAction={() => onNavigate('performance')} actionLabel="View performance" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: KPI_GAP }}>
            <KpiTile
              width={kpiW} icon="users" accent={T.brand}
              label="Active clients" value={String(activeClients)}
              hint={`of ${perf?.totalClients ?? clients.length} total`}
              onPress={() => onNavigate('clients')}
            />
            <KpiTile
              width={kpiW} icon="activity" accent={T.sky}
              label="Total sessions" value={perf ? totalSessions.toLocaleString('en-IN') : '—'}
              hint="All time"
            />
            <RatingTile width={kpiW} rating={perf?.rating ?? profile?.rating ?? null} />
            <KpiTile
              width={kpiW} icon="trending-up" accent={T.brandGold}
              label="Commission" value={earnings ? inrCompact(commission) : '—'}
              hint={commissionShare != null ? `${commissionShare}% of earnings` : monthLabel}
            />
          </View>
        </View>

        {/* 5 ── My clients */}
        <View style={{ marginTop: SECTION_GAP }}>
          <SectionHeader
            title="My clients"
            onPressAction={clients.length > 0 ? () => onNavigate('clients') : undefined}
            actionLabel="View all"
          />
          {clientsQ.isLoading ? (
            <LoadingState label="Loading clients" />
          ) : clientsQ.isError ? (
            <View style={{ borderRadius: R.lg, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }}>
              <EmptyState
                icon="alert-triangle" tone="error"
                title="Couldn't load clients"
                action={{ label: 'Retry', onPress: () => { clientsQ.refetch(); } }}
              />
            </View>
          ) : clients.length === 0 ? (
            <View style={{ borderRadius: R.lg, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }}>
              <EmptyState
                icon="user-plus"
                title="No clients yet"
                subtitle="Clients assigned to you by your gym will show up here."
              />
            </View>
          ) : (
            <View style={{ gap: SP.md }}>
              {clients.slice(0, CLIENT_PREVIEW).map((c, i) => (
                <ClientPreviewRow key={c.assignmentId} client={c} index={i} onPress={() => onNavigate(`client-${c.clientId}`)} />
              ))}
              {clients.length > CLIENT_PREVIEW && (
                <Text
                  onPress={() => onNavigate('clients')}
                  accessibilityRole="link"
                  style={{ color: T.brand, fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: SP.sm }}
                >
                  View all {clients.length} clients
                </Text>
              )}
            </View>
          )}
        </View>

        {/* 6 ── Specializations */}
        {specializations.length > 0 && (
          <View style={{ marginTop: SECTION_GAP }}>
            <SectionHeader title="Your focus" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
              {specializations.map(s => (
                <View
                  key={s}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill,
                    backgroundColor: withAlpha(T.brand, 0.10), borderWidth: 1, borderColor: withAlpha(T.brand, 0.25),
                  }}
                >
                  <Text style={{ color: T.brand, fontSize: 12, fontWeight: '700' }}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
