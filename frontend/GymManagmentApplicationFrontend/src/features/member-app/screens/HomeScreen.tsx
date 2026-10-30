import React from 'react';
import { View, ScrollView } from 'react-native';
import { SP } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import {
  useMyProfile, useMyWorkouts, useMyPlans,
  useHealthToday, useActiveChallenges,
} from '../api/memberAppQueries';
import { useTrainers } from '../../trainers/api/trainerQueries';
import { useModuleAccess } from '../../module-access/context/ModuleAccessContext';
import EmptyState from '../../dashboard/components/EmptyState';
import Screen from '../../common/components/Screen';
import Skeleton from '../../common/components/Skeleton';
import CheckInCard from '../../attendance/components/CheckInCard';
import MembershipStatusCard from '../../member-billing/components/MembershipStatusCard';
import NextBookingCard from '../../member-booking/components/NextBookingCard';
import TodayWorkoutCard from '../components/TodayWorkoutCard';
import ActionList, { ActionItem } from '../../common/components/dashboard/ActionList';
import HomeGreeting from '../components/HomeGreeting';
import ActivityRingsCard from '../components/ActivityRingsCard';
import WorkoutPhotoCard from '../components/WorkoutPhotoCard';
import HomeSectionHeader from '../components/HomeSectionHeader';
import ChallengeCard from '../components/ChallengeCard';
import CoachCard from '../components/CoachCard';
import { useHasModule, useMenu } from '../../access/context/AccessContext';
import { openBookOn } from '../../member-booking/screens/BookScreen';

const WORKOUT_IMAGES = [
  require('../../../assets/dashboard/workout-1.jpg'),
  require('../../../assets/dashboard/workout-2.jpg'),
  require('../../../assets/dashboard/workout-3.jpg'),
  require('../../../assets/dashboard/workout-4.jpg'),
  require('../../../assets/dashboard/workout-5.jpg'),
  require('../../../assets/dashboard/workout-6.jpg'),
];

const SECTION_GAP = SP.xxl; // 28

interface Props {
  userId: number;
  onNavigate: (screen: string) => void;
}

export default function HomeScreen({ userId, onNavigate }: Props) {
  const { hPad, contentW } = useLayout();

  const canWorkouts     = useModuleAccess('workouts');
  const canBilling      = useModuleAccess('billing');
  const canBook         = useHasModule('member.book');
  const canStats        = useModuleAccess('stats');
  const canAiCoach      = useModuleAccess('ai-coach');
  const canChallenges   = useModuleAccess('challenges');
  const canLiveCoaching = useModuleAccess('live-coaching');
  const canPlans        = useModuleAccess('plans');
  // A card is only shown when the screen it opens is granted (no dead ends).
  const { routes } = useMenu();
  const canOpenBook     = canBook && routes.has('book');
  const canOpenBilling  = canBilling && routes.has('billing');
  const canOpenWorkout  = routes.has('train') || routes.has('plans');

  const { data: profile } = useMyProfile(userId);
  const workoutsQ   = useMyWorkouts(userId, 1);
  const { data: planPage } = useMyPlans(1);
  const healthQ     = useHealthToday(userId);
  const challengesQ = useActiveChallenges(userId);
  const trainersQ   = useTrainers(1, 3);

  const health     = healthQ.data;
  const workouts   = workoutsQ.data?.items ?? [];
  const plans      = planPage?.items ?? [];
  const challenges = challengesQ.data ?? [];
  const trainers   = trainersQ.data?.items ?? [];
  const firstName  = profile?.firstName?.trim() || null;
  const openWorkout = (id: number) => onNavigate(`workout-${id}`);
  const openBookings = () => { openBookOn('mine'); onNavigate('book'); };

  // ── Up next (action-first) ────────────────────────────────────
  const joined    = challenges.filter(c => c.isJoined).sort((a, b) => b.progressPct - a.progressPct);
  const activeCh  = joined[0];
  const newCh     = challenges.find(c => !c.isJoined);
  const plan      = plans.find(p => p.isActive) ?? plans[0];

  const actions: ActionItem[] = [];
  if (canChallenges && activeCh) {
    const pct = Math.round(Math.max(0, Math.min(100, activeCh.progressPct)));
    actions.push({
      key: `ch-${activeCh.id}`, icon: 'award', tone: 'brand',
      title: activeCh.title,
      subtitle: `Keep going · ${pct}% complete`,
      badge: `${pct}%`,
      onPress: () => onNavigate('community'),
    });
  }
  if (canChallenges && newCh) {
    actions.push({
      key: `join-${newCh.id}`, icon: 'plus-circle', tone: 'warn',
      title: newCh.title,
      subtitle: [`Join ${newCh.participantCount.toLocaleString()} members`, newCh.prizeLabel && `Win ${newCh.prizeLabel.toLowerCase()}`].filter(Boolean).join(' · '),
      badge: 'Join',
      onPress: () => onNavigate('community'),
    });
  }
  if (canAiCoach && health?.coachTip) {
    actions.push({
      key: 'coach', icon: 'cpu', tone: 'info',
      title: 'AI coach tip',
      subtitle: health.coachTip,
      badge: health.stats.energyPct != null ? `${health.stats.energyPct}% ready` : undefined,
      onPress: canWorkouts ? () => onNavigate('train') : undefined,
    });
  }
  if (canPlans && plan) {
    actions.push({
      key: `plan-${plan.id}`, icon: 'calendar', tone: 'brand',
      title: plan.name,
      subtitle: [`${plan.durationWeeks}-week plan`, plan.difficulty].filter(Boolean).join(' · '),
      badge: plan.isActive ? 'Active' : undefined,
      onPress: () => onNavigate('plans'),
    });
  }
  const actionsLoading = actions.length === 0
    && ((canChallenges && challengesQ.isLoading) || ((canAiCoach || canStats) && healthQ.isLoading));

  // Joined challenges not already surfaced in "Up next".
  const moreChallenges = joined.slice(1);
  const moreWorkouts   = workouts.slice(1, 7);
  const railCardW      = Math.round(Math.min(220, Math.max(150, contentW * 0.56)));

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: SP.md, paddingBottom: 110 }}
      >
        {/* 1 · Greeting + streak */}
        <HomeGreeting
          firstName={firstName}
          lastName={profile?.lastName}
          streakDays={canStats && health ? health.streakDays : null}
          onOpenProfile={() => onNavigate('profile')}
        />

        {/* 2 · Today: next booking · today's workout · check-in · membership.
            Cards render directly in the gap column so one that returns null leaves no hole. */}
        <View style={{ marginTop: SP.xl, gap: SP.xl }}>
          {canOpenBook && <NextBookingCard userId={userId} onPress={openBookings} />}
          {canOpenWorkout && <TodayWorkoutCard userId={userId} onOpenWorkout={openWorkout} />}
          {/* Renders nothing unless the gym has location check-in switched on */}
          <CheckInCard />
          {canOpenBilling && <MembershipStatusCard userId={userId} onPress={() => onNavigate('billing')} />}
        </View>

        {/* 3 · Activity rings + vitals (stats module) */}
        {canStats && (
          <View style={{ marginTop: SECTION_GAP }}>
            <ActivityRingsCard
              health={health}
              width={contentW}
              loading={healthQ.isLoading}
              error={healthQ.isError}
              onRetry={() => healthQ.refetch()}
              onPress={() => onNavigate('stats')}
            />
          </View>
        )}

        {/* 4 · Up next */}
        {(actions.length > 0 || actionsLoading) && (
          <View style={{ marginTop: SECTION_GAP }}>
            <HomeSectionHeader title="Up next" />
            {actionsLoading
              ? <Skeleton rows={3} height={60} borderRadius={16} gap={8} />
              : <ActionList items={actions} />}
          </View>
        )}

        {/* 5 · More workouts rail */}
        {canWorkouts && moreWorkouts.length > 0 && (
          <View style={{ marginTop: SECTION_GAP }}>
            <HomeSectionHeader
              title="More workouts"
              action={{ label: 'See all', accessibilityLabel: 'See all workouts', onPress: () => onNavigate('train') }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -hPad }}
              contentContainerStyle={{ paddingHorizontal: hPad, gap: SP.md }}
            >
              {moreWorkouts.map((w, i) => (
                <WorkoutPhotoCard
                  key={w.id}
                  title={w.name}
                  durationMin={w.durationMin}
                  difficulty={w.difficulty}
                  exercisesCount={w.exercises?.length ?? 0}
                  image={WORKOUT_IMAGES[i % WORKOUT_IMAGES.length]}
                  width={railCardW}
                  onPress={() => openWorkout(w.id)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* 6a · Other joined challenges (the top one is already in Up next) */}
        {canChallenges && moreChallenges.length > 0 && (
          <View style={{ marginTop: SECTION_GAP }}>
            <HomeSectionHeader
              title="Your challenges"
              action={{ label: 'All', accessibilityLabel: 'See all challenges', onPress: () => onNavigate('community') }}
            />
            <View style={{ gap: SP.md }}>
              {moreChallenges.map(c => (
                <ChallengeCard
                  key={c.id}
                  title={c.title}
                  participantCount={c.participantCount}
                  prizeLabel={c.prizeLabel}
                  progressPct={c.progressPct}
                />
              ))}
            </View>
          </View>
        )}
        {canChallenges && challengesQ.isError && (
          <View style={{ marginTop: SECTION_GAP }}>
            <EmptyState
              icon="award" tone="error" title="Couldn't load challenges"
              action={{ label: 'Retry', onPress: () => challengesQ.refetch() }}
            />
          </View>
        )}

        {/* 6b · Coaches (live-coaching module; shown only when the gym has trainers).
            There is no presence API, so nothing here claims a coach is online/live. */}
        {canLiveCoaching && (trainersQ.isLoading || trainers.length > 0) && (
          <View style={{ marginTop: SECTION_GAP }}>
            <HomeSectionHeader title="Your gym's coaches" />
            {trainersQ.isLoading ? (
              <Skeleton rows={1} height={170} borderRadius={16} gap={0} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -hPad }}
                contentContainerStyle={{ paddingHorizontal: hPad, gap: SP.md }}
              >
                {trainers.map(t => (
                  <CoachCard
                    key={t.id}
                    name={t.displayName}
                    specialty={t.specializations?.find(sp => !!sp?.trim()) ?? null}
                    rating={t.rating}
                    imageUrl={t.profileImage}
                    onPress={canWorkouts ? () => onNavigate('train') : undefined}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
