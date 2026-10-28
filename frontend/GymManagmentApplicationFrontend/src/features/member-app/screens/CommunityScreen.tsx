import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { T } from '../../../theme';
import { useActiveChallenges } from '../api/memberAppQueries';
import { useTrainers } from '../../trainers/api/trainerQueries';
import { useModuleAccess } from '../../module-access/context/ModuleAccessContext';
import EmptyState from '../../dashboard/components/EmptyState';
import CoachCard from '../components/CoachCard';
import ChallengeCard from '../components/ChallengeCard';
import Screen from '../../common/components/Screen';
import Skeleton from '../../common/components/Skeleton';

interface Props { userId: number; onOpenWorkout?: (id: number) => void; }

export default function CommunityScreen({ userId }: Props) {
  const challengesQ = useActiveChallenges(userId);
  const trainersQ   = useTrainers(1, 10);
  const challenges  = challengesQ.data;
  const trainerPage = trainersQ.data;
  const trainers = trainerPage?.items ?? [];

  const canLiveCoaching = useModuleAccess('live-coaching');
  const canChallenges   = useModuleAccess('challenges');

  return (
    <Screen>

      <View className="px-5 pt-5 pb-3">
        <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>Together</Text>
        <Text style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Community</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {canLiveCoaching && (
          <>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 14 }}>Coaches</Text>
            {trainersQ.isLoading ? (
              <View style={{ marginBottom: 28 }}><Skeleton rows={1} height={170} borderRadius={16} gap={0} /></View>
            ) : trainersQ.isError ? (
              <EmptyState icon="wifi-off" tone="error" title="Couldn't load coaches" action={{ label: 'Retry', onPress: () => trainersQ.refetch() }} />
            ) : trainers.length === 0 ? (
              <EmptyState icon="award" title="No coaches available" />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginBottom: 28 }}>
                {trainers.map(t => (
                  <CoachCard
                    key={t.id}
                    name={t.displayName}
                    specialty={t.specializations?.find(sp => !!sp?.trim()) ?? null}
                    rating={t.rating}
                    imageUrl={t.profileImage}
                  />
                ))}
              </ScrollView>
            )}
          </>
        )}

        {canChallenges && (
          <>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 14 }}>Active challenges</Text>
            {challengesQ.isLoading ? (
              <Skeleton rows={2} height={84} borderRadius={18} gap={12} />
            ) : challengesQ.isError ? (
              <EmptyState icon="wifi-off" tone="error" title="Couldn't load challenges" action={{ label: 'Retry', onPress: () => challengesQ.refetch() }} />
            ) : !challenges || challenges.length === 0 ? (
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
    </Screen>
  );
}
