import React from 'react';
import { View, Text, ScrollView, StatusBar, Platform } from 'react-native';
import { T } from '../../trainers/components/theme';
import { useActiveChallenges } from '../api/memberAppQueries';
import { useTrainers } from '../../trainers/api/trainerQueries';
import { useModuleAccess } from '../../module-access/context/ModuleAccessContext';
import EmptyState from '../../dashboard/components/EmptyState';
import LiveCoachCard from '../components/LiveCoachCard';
import ChallengeCard from '../components/ChallengeCard';

const IMG_WORKOUT = require('../../../assets/dashboard/workout-1.jpg');
const IMG_COACH1  = require('../../../assets/dashboard/coach-1.jpg');
const IMG_COACH2  = require('../../../assets/dashboard/coach-2.jpg');
const COACH_IMAGES = [IMG_COACH1, IMG_COACH2, IMG_WORKOUT];

interface Props { userId: number; onOpenWorkout?: (id: number) => void; }

export default function CommunityScreen({ userId }: Props) {
  const { data: challenges } = useActiveChallenges(userId);
  const { data: trainerPage } = useTrainers(1, 10);
  const trainers = trainerPage?.items ?? [];

  const canLiveCoaching = useModuleAccess('live-coaching');
  const canChallenges   = useModuleAccess('challenges');

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <View className="px-5 pt-5 pb-3">
        <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>Together</Text>
        <Text style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Community</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {canLiveCoaching && (
          <>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 14 }}>Live coaches</Text>
            {trainers.length === 0 ? (
              <EmptyState icon="award" title="No coaches available" />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginBottom: 28 }}>
                {trainers.map((t, i) => (
                  <LiveCoachCard
                    key={t.id}
                    name={t.displayName}
                    specialty={t.specializations?.[0] ?? 'Personal Training'}
                    rating={t.rating ?? 4.5}
                    image={COACH_IMAGES[i % COACH_IMAGES.length]}
                  />
                ))}
              </ScrollView>
            )}
          </>
        )}

        {canChallenges && (
          <>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 14 }}>Active challenges</Text>
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
          </>
        )}

        {!canLiveCoaching && !canChallenges && (
          <EmptyState icon="lock" title="Nothing enabled here yet" subtitle="Ask your gym admin to enable Community features for your account." />
        )}
      </ScrollView>
    </View>
  );
}
