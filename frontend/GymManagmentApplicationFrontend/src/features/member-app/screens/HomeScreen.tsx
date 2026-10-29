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
import PhotoHero from '../../common/components/dashboard/PhotoHero';
import CheckInCard from '../../attendance/components/CheckInCard';
import MembershipStatusCard from '../../member-billing/components/MembershipStatusCard';
import NextBookingCard from '../../member-booking/components/NextBookingCard';
import ActionList, { ActionItem } from '../../common/components/dashboard/ActionList';
import HomeGreeting from '../components/HomeGreeting';
import ActivityRingsCard from '../components/ActivityRingsCard';
import WorkoutPhotoCard from '../components/WorkoutPhotoCard';
import HomeSectionHeader from '../components/HomeSectionHeader';
import ChallengeCard from '../components/ChallengeCard';
import CoachCard from '../components/CoachCard';

const IMG_HERO = require('../../../assets/dashboard/hero-athlete.jpg');
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
  const canStats        = useModuleAccess('stats');
  const canAiCoach      = useModuleAccess('ai-coach');
  const canChallenges   = useModuleAccess('challenges');
  const canLiveCoaching = useModuleAccess('live-coaching');
  const canPlans        = useModuleAccess('plans');

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
  const today      = workouts[0];
  const openWorkout = (id: number) => onNavigate(`workout-${id}`);

  // ── Hero: today's workout, or a motivational card ─────────────
  const heroH = Math.max(220, Math.min(280, Math.round(contentW * 0.72)));
  let hero: React.ReactNode;
  if (canWorkouts && workoutsQ.isLoading) {
    hero = <Skeleton rows={1} height={heroH} borderRadius={20} gap={0} />;
  } else if (canWorkouts && workoutsQ.isError) {
    hero = (
      <EmptyState
        icon="wifi-off" tone="error" title="Couldn't load today's workout"
        action={{ label: 'Retry', onPress: () => workoutsQ.refetch() }}
      />
    );
  } else if (canWorkouts && today) {
    hero = (
      <PhotoHero
        image={IMG_HERO}
        height={heroH}
        eyebrow="Today's workout"
        title={today.name}
        value={today.durationMin != null ? `${today.durationMin} min` : undefined}
        valueCaption={[today.difficulty, `${today.exercises?.length ?? 0} exercises`].filter(Boolean).join(' · ')}
        cta={{ label: 'Start', icon: 'play', onPress: () => openWorkout(today.id) }}
      />
    );
  } else {
    const streak = canStats ? health?.streakDays ?? 0 : 0;
    hero = (
      <PhotoHero
        image={IMG_HERO}
        height={heroH}
        eyebrow={canWorkouts ? 'No session scheduled' : 'Today'}
        title={canWorkouts ? 'Ask your coach for today’s plan — or pick your own.' : 'Every rep counts. Show up today.'}
        value={streak > 0 ? `${streak} days` : undefined}
        valueCaption={streak > 0 ? 'Current streak — keep it alive' : undefined}
        cta={canWorkouts ? { label: 'Browse', icon: 'search', onPress: () => onNavigate('train') } : undefined}
      />
    );
  }

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

        {/* Location check-in (only when the gym has it switched on at a branch) */}
        <View style={{ marginTop: SP.xl }}><MembershipStatusCard userId={userId} onPress={() => onNavigate('billing')} /></View>
        <View style={{ marginTop: SP.xl }}><NextBookingCard userId={userId} onPress={() => onNavigate('book')} /></View>
        <View style={{ marginTop: SP.xl }}><CheckInCard /></View>

        {/* 2 · Today's workout hero */}
        <View style={{ marginTop: SP.xl }}>{hero}</View>

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
