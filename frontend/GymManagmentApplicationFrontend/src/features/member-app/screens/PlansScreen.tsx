import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StatusBar, Platform, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMyPlans } from '../api/memberAppQueries';

const GOAL_COLOR: Record<string, string> = {
  general: '#AAAAAA', weightloss: '#22D3EE', musclegain: '#7ED321', endurance: '#FACC15',
};

function Skeleton() {
  const op = useRef(new Animated.Value(0.25)).current;
  React.useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.65, duration: 700, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.25, duration: 700, useNativeDriver: true }),
    ]));
    l.start(); return () => l.stop();
  }, []);
  return <>{[0,1,2].map(k => <Animated.View key={k} style={{ height: 110, borderRadius: 20, backgroundColor: '#151915', marginBottom: 12, opacity: op }} />)}</>;
}

interface Props { onBack?: () => void; }

export default function PlansScreen({ onBack }: Props) {
  const [page, setPage] = useState(1);
  const { data: paged, isLoading, isError, refetch } = useMyPlans(page);
  const items      = paged?.items ?? [];
  const totalPages = paged?.totalPages ?? 1;

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F0A" />

      <View className="px-5 pt-5 pb-4">
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          {onBack && (
            <Pressable onPress={onBack} hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#151915', borderWidth: 1, borderColor: '#242B24', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Feather name="arrow-left" size={18} color="#FFFFFF" />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#AAAAAA', fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>My Programs</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Training Plans</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {isLoading && <Skeleton />}

        {isError && (
          <View className="items-center pt-16">
            <Feather name="wifi-off" size={28} color="#EF4444" />
            <Pressable onPress={() => refetch()} className="bg-brand rounded-full px-7 py-3 mt-4">
              <Text className="text-black font-bold">Retry</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <View className="items-center pt-16">
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#151915', borderWidth: 1, borderColor: '#1C211C', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Feather name="book-open" size={28} color="#AAAAAA" />
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>No plans assigned yet</Text>
            <Text style={{ color: '#AAAAAA', fontSize: 13, marginTop: 6, textAlign: 'center' }}>Your trainer will assign a plan to help you reach your goals.</Text>
          </View>
        )}

        {!isLoading && !isError && items.map(plan => {
          const goal = plan.goal?.toLowerCase() ?? 'general';
          const diff = plan.difficulty?.toLowerCase() ?? 'beginner';
          const gc   = GOAL_COLOR[goal] ?? '#AAAAAA';
          const dc   = diff === 'advanced' ? '#EF4444' : diff === 'intermediate' ? '#FACC15' : '#22C55E';

          return (
            <Pressable key={plan.id}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1C211C' : '#151915',
                borderRadius: 20, padding: 16, marginBottom: 12,
                borderWidth: 1, borderColor: pressed ? 'rgba(126,211,33,0.20)' : '#1C211C',
              })}>
              {/* Accent bar */}
              <View style={{ height: 3, backgroundColor: gc, borderRadius: 2, marginBottom: 14, width: 40 }} />

              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{plan.name}</Text>
                </View>
                {/* Week badge */}
                <View style={{ backgroundColor: 'rgba(126,211,33,0.10)', borderWidth: 1, borderColor: 'rgba(126,211,33,0.25)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' }}>
                  <Text style={{ color: '#7ED321', fontSize: 18, fontWeight: '800' }}>{plan.durationWeeks}</Text>
                  <Text style={{ color: '#AAAAAA', fontSize: 11, fontWeight: '600' }}>WKS</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 6 }}>
                {plan.goal && <View style={{ backgroundColor: gc + '15', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: gc + '35' }}><Text style={{ color: gc, fontSize: 11, fontWeight: '700' }}>{plan.goal}</Text></View>}
                {plan.difficulty && <View style={{ backgroundColor: dc + '15', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: dc + '35' }}><Text style={{ color: dc, fontSize: 11, fontWeight: '700' }}>{plan.difficulty}</Text></View>}
                <View style={{ backgroundColor: plan.isActive ? 'rgba(126,211,33,0.10)' : '#1C211C', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: plan.isActive ? 'rgba(126,211,33,0.25)' : '#242B24' }}>
                  <Text style={{ color: plan.isActive ? '#7ED321' : '#555', fontSize: 11, fontWeight: '600' }}>{plan.isActive ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}

        {!isLoading && !isError && totalPages > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 16 }}>
            <Pressable onPress={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: '#151915', borderWidth: 1, borderColor: '#242B24', opacity: page <= 1 ? 0.4 : 1 }}>
              <Text style={{ color: '#7ED321', fontWeight: '700' }}>Prev</Text>
            </Pressable>
            <View style={{ backgroundColor: '#7ED321', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
              <Text style={{ color: '#000', fontWeight: '800' }}>{page}/{totalPages}</Text>
            </View>
            <Pressable onPress={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: '#151915', borderWidth: 1, borderColor: '#242B24', opacity: page >= totalPages ? 0.4 : 1 }}>
              <Text style={{ color: '#7ED321', fontWeight: '700' }}>Next</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
