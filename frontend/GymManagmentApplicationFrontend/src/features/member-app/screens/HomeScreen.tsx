import React from 'react';
import { View, Text, ScrollView, Pressable, StatusBar, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';
import {
  useMyProfile, useMyWorkouts, useMyPlans,
  useHealthToday, useActiveChallenges,
} from '../api/memberAppQueries';
import { useTrainers } from '../../trainers/api/trainerQueries';
import { useModuleAccess } from '../../module-access/context/ModuleAccessContext';
import EmptyState from '../../dashboard/components/EmptyState';
import SummaryRing from '../components/SummaryRing';
import MetricBar from '../components/MetricBar';
import StreakCard from '../components/StreakCard';
import StatChip from '../components/StatChip';
import FeaturedWorkoutCard from '../components/FeaturedWorkoutCard';
import AICoachCard from '../components/AICoachCard';
import LiveCoachCard from '../components/LiveCoachCard';
import ChallengeCard from '../components/ChallengeCard';

const IMG_WORKOUT = require('../../../assets/dashboard/workout-1.jpg');
const IMG_COACH1  = require('../../../assets/dashboard/coach-1.jpg');
const IMG_COACH2  = require('../../../assets/dashboard/coach-2.jpg');
const COACH_IMAGES = [IMG_COACH1, IMG_COACH2, IMG_WORKOUT];

interface Props {
  userId: number;
  onNavigate: (screen: string) => void;
}

export default function HomeScreen({ userId, onNavigate }: Props) {
  const { data: profile } = useMyProfile(userId);
  const { data: workoutPage, isLoading: wLoading } = useMyWorkouts(userId, 1);
  const { data: planPage } = useMyPlans(1);
  const { data: health } = useHealthToday(userId);
  const { data: challenges } = useActiveChallenges(userId);
  const { data: trainerPage } = useTrainers(1, 3);

  const canWorkouts     = useModuleAccess('workouts');
  const canStats        = useModuleAccess('stats');
  const canAiCoach      = useModuleAccess('ai-coach');
  const canChallenges   = useModuleAccess('challenges');
  const canLiveCoaching = useModuleAccess('live-coaching');
  const canPlans        = useModuleAccess('plans');

  const workouts  = workoutPage?.items  ?? [];
  const plans     = planPage?.items     ?? [];
  const trainers  = trainerPage?.items  ?? [];
  const firstName = profile?.firstName  ?? 'Athlete';
  const featured  = workouts[0];

  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const rings = health?.rings;
  const overallPct = rings
    ? Math.round(
        (Math.min(100, (rings.move.current / Math.max(1, rings.move.goal)) * 100)
          + Math.min(100, (rings.train.current / Math.max(1, rings.train.goal)) * 100)
          + Math.min(100, (rings.stand.current / Math.max(1, rings.stand.goal)) * 100)) / 3,
      )
    : 0;

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 110 }}>

        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Pressable onPress={() => onNavigate('profile')} style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityRole="button" accessibilityLabel="Open profile">
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.brandDim, borderWidth: 1.5, borderColor: T.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: T.brand, fontSize: 15, fontWeight: '800' }}>{firstName[0]?.toUpperCase() ?? 'M'}</Text>
              <View style={{ position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: T.brand, borderWidth: 2, borderColor: T.bg }} />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '500' }}>{greet}</Text>
              <Text style={{ color: T.text, fontSize: 16, fontWeight: '800', marginTop: 1 }}>{firstName}</Text>
            </View>
          </Pressable>

          <Pressable onPress={() => onNavigate('notifications')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Notifications"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="bell" size={18} color={T.text} />
            <View style={{ position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: T.brandGold, borderWidth: 1.5, borderColor: T.bg }} />
          </Pressable>
        </View>

        {/* ── Daily summary card + streak (stats module) ── */}
        {canStats && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: T.line, marginBottom: 16 }}>
              <SummaryRing pct={overallPct} sublabel="Daily" />
              <View style={{ flex: 1, marginLeft: 18 }}>
                <MetricBar label="Move" current={rings?.move.current ?? 0} goal={rings?.move.goal ?? 8000} unit="steps" color={T.brand} />
                <MetricBar label="Train" current={rings?.train.current ?? 0} goal={rings?.train.goal ?? 60} unit="min" color={T.brandGold} />
                <MetricBar label="Stand" current={rings?.stand.current ?? 0} goal={rings?.stand.goal ?? 12} unit="hr" color={T.sky} />
              </View>
            </View>

            <View style={{ marginBottom: 24 }}>
              <StreakCard days={health?.streakDays ?? 0} />
            </View>
          </>
        )}

        {/* ── Today's session (workouts module) ── */}
        {canWorkouts && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ color: T.text, fontSize: 18, fontWeight: '700' }}>Today's session</Text>
              {canPlans && (
                <Pressable onPress={() => onNavigate('plans')} accessibilityRole="button" accessibilityLabel="View plan">
                  <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>View plan ›</Text>
                </Pressable>
              )}
            </View>

            <View style={{ marginBottom: 24 }}>
              {wLoading ? (
                <View style={{ height: 260, borderRadius: 24, backgroundColor: T.bgInput }} />
              ) : featured ? (
                <FeaturedWorkoutCard
                  category={featured.goal ?? 'Training'}
                  title={featured.name}
                  exercisesCount={featured.exercises?.length ?? 0}
                  durationMin={featured.durationMin ?? 45}
                  image={IMG_WORKOUT}
                  onPress={() => onNavigate(`workout-${featured.id}`)}
                  onExpand={() => onNavigate(`workout-${featured.id}`)}
                />
              ) : (
                <EmptyState icon="activity" title="No session scheduled" subtitle="Ask your trainer to assign a workout to get started." />
              )}
            </View>
          </>
        )}

        {/* ── Quick stats (stats module) ── */}
        {canStats && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
            <StatChip icon="heart" value={health?.stats.bpm != null ? `${health.stats.bpm}` : '--'} label="BPM" color={T.rose} />
            <StatChip icon="droplet" value={health?.stats.waterLiters != null ? `${health.stats.waterLiters}L` : '--'} label="Water" color={T.sky} />
            <StatChip icon="moon" value={health?.stats.sleepHours != null ? `${health.stats.sleepHours}h` : '--'} label="Sleep" color={T.violet} />
            <StatChip icon="zap" value={health?.stats.energyPct != null ? `${health.stats.energyPct}%` : '--'} label="Energy" color={T.brandGold} />
          </View>
        )}

        {/* ── AI Coach (ai-coach module) ── */}
        {canAiCoach && (
          <View style={{ marginBottom: 28 }}>
            <AICoachCard recoveryScore={health?.stats.energyPct ?? null} tip={health?.coachTip} onPress={() => canWorkouts && onNavigate('train')} />
          </View>
        )}

        {/* ── Live coaches (live-coaching module) ── */}
        {canLiveCoaching && (
          <View style={{ marginBottom: 28 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ color: T.text, fontSize: 18, fontWeight: '700' }}>Live coaches</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.brand }} />
                <Text style={{ color: T.textSub, fontSize: 12 }}>{trainers.length} online</Text>
              </View>
            </View>
            {trainers.length === 0 ? (
              <EmptyState icon="award" title="No coaches available" />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {trainers.map((t, i) => (
                  <LiveCoachCard
                    key={t.id}
                    name={t.displayName}
                    specialty={t.specializations?.[0] ?? 'Personal Training'}
                    rating={t.rating ?? 4.5}
                    image={COACH_IMAGES[i % COACH_IMAGES.length]}
                    onPress={() => canWorkouts && onNavigate('train')}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* ── Active challenges (challenges module) ── */}
        {canChallenges && (
          <View>
            <Text style={{ color: T.text, fontSize: 18, fontWeight: '700', marginBottom: 14 }}>Active challenges</Text>
            {!challenges || challenges.length === 0 ? (
              <EmptyState icon="award" title="No active challenges" subtitle="Check back soon for new community challenges." />
            ) : (
              <View style={{ gap: 12 }}>
                {challenges.map(c => (
                  <ChallengeCard
                    key={c.id}
                    title={c.title}
                    participantCount={c.participantCount}
                    prizeLabel={c.prizeLabel}
                    progressPct={c.progressPct}
                  />
                ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}
