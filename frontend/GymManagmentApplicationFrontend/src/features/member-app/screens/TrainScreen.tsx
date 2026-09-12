import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Platform, Animated, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMyWorkouts, useExerciseList, useBookmarkWorkout } from '../api/memberAppQueries';
import { getDifficultyColor } from '../../common/constants/statusColors';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const GOAL_COLOR: Record<string, string> = {
  general: '#AAAAAA', weightloss: '#22D3EE', musclegain: '#7ED321', endurance: '#FACC15',
};
const CAT_ICON: Record<string, FeatherIconName> = {
  strength: 'zap', cardio: 'activity', flexibility: 'wind', balance: 'target',
};
const EX_FILTERS = ['All', 'Strength', 'Cardio', 'Flexibility', 'Balance'];

function Skeleton({ height = 88, count = 4 }: { height?: number; count?: number }) {
  const op = useRef(new Animated.Value(0.25)).current;
  React.useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.65, duration: 700, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.25, duration: 700, useNativeDriver: true }),
    ]));
    l.start(); return () => l.stop();
  }, []);
  return <>{Array.from({ length: count }).map((_, k) =>
    <Animated.View key={k} style={{ height, borderRadius: 18, backgroundColor: '#151915', marginBottom: 10, opacity: op }} />
  )}</>;
}

interface Props { userId: number; onOpenWorkout: (id: number) => void; }

export default function TrainScreen({ userId, onOpenWorkout }: Props) {
  const [tab, setTab]           = useState<'workouts' | 'exercises'>('workouts');
  const [exPage, setExPage]     = useState(1);
  const [exFilter, setExFilter] = useState('All');
  const [search, setSearch]     = useState('');
  const [wPage, setWPage]       = useState(1);

  const { data: wPaged, isLoading: wLoad, isError: wErr, refetch: wRefetch } = useMyWorkouts(userId, wPage);
  const tagParam = exFilter !== 'All' ? exFilter.toLowerCase() : undefined;
  const { data: exPaged, isLoading: exLoad, isError: exErr, refetch: exRefetch } = useExerciseList(exPage, tagParam);
  const { mutate: bookmark } = useBookmarkWorkout();

  const workouts    = wPaged?.items      ?? [];
  const wTotal      = wPaged?.totalPages ?? 1;
  const exercises   = exPaged?.items     ?? [];
  const exTotal     = exPaged?.totalPages ?? 1;

  const filteredEx = search.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : exercises;

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F0A" />

      {/* Header */}
      <View className="px-5 pt-5 pb-3">
        <Text className="text-sub text-[11px] font-semibold uppercase tracking-widest mb-1">Member</Text>
        <Text className="text-white text-[28px] font-extrabold tracking-tight mb-4">Train</Text>

        {/* Tab switcher */}
        <View style={{ flexDirection: 'row', backgroundColor: '#151915', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#1C211C' }}>
          {(['workouts', 'exercises'] as const).map(t => (
            <Pressable key={t} onPress={() => setTab(t)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                backgroundColor: tab === t ? '#7ED321' : 'transparent' }}>
              <Text style={{ color: tab === t ? '#000' : '#AAAAAA', fontSize: 13, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Workouts tab ── */}
      {tab === 'workouts' && (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
          {wLoad && <Skeleton />}
          {wErr && (
            <View className="items-center pt-16">
              <Feather name="wifi-off" size={28} color="#EF4444" />
              <Text className="text-white font-bold mt-4 mb-4">Failed to load</Text>
              <Pressable onPress={() => wRefetch()} className="bg-brand rounded-full px-7 py-3">
                <Text className="text-black font-bold">Retry</Text>
              </Pressable>
            </View>
          )}
          {!wLoad && !wErr && workouts.length === 0 && (
            <View className="items-center pt-16">
              <View className="w-[68px] h-[68px] rounded-full bg-surface border border-line items-center justify-center mb-4">
                <Feather name="activity" size={28} color="#AAA" />
              </View>
              <Text className="text-white text-[16px] font-bold mb-2">No workouts assigned</Text>
              <Text className="text-sub text-[13px] text-center">Ask your trainer to assign a workout.</Text>
            </View>
          )}
          {!wLoad && !wErr && workouts.map(w => {
            const gc = GOAL_COLOR[w.goal?.toLowerCase() ?? 'general'] ?? '#AAAAAA';
            const dc = getDifficultyColor(w.difficulty?.toLowerCase() ?? 'beginner');
            return (
              <Pressable key={w.id} onPress={() => onOpenWorkout(w.id)}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#1C211C' : '#151915',
                  borderRadius: 20, padding: 16, marginBottom: 12,
                  borderWidth: 1, borderColor: pressed ? 'rgba(126,211,33,0.20)' : '#1C211C',
                })}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text className="text-white text-[16px] font-bold" numberOfLines={1}>{w.name}</Text>
                    {!!w.description && <Text className="text-sub text-[12px] mt-1" numberOfLines={2}>{w.description}</Text>}
                  </View>
                  {/* Start button */}
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#7ED321', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="play" size={15} color="#000" />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {w.goal && <View style={{ backgroundColor: gc + '15', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: gc + '35' }}><Text style={{ color: gc, fontSize: 11, fontWeight: '700' }}>{w.goal}</Text></View>}
                  {w.difficulty && <View style={{ backgroundColor: dc + '15', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: dc + '35' }}><Text style={{ color: dc, fontSize: 11, fontWeight: '700' }}>{w.difficulty}</Text></View>}
                  {w.durationMin && <View style={{ backgroundColor: '#1C211C', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#242B24', flexDirection: 'row', alignItems: 'center', gap: 4 }}><Feather name="clock" size={10} color="#777" /><Text style={{ color: '#AAAAAA', fontSize: 11 }}>{w.durationMin}min</Text></View>}
                </View>
                {/* Bookmark */}
                <Pressable onPress={() => bookmark(w.id, {
                  onSuccess: () => Alert.alert('✓', 'Bookmark toggled.'),
                  onError: () => {},
                })} style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Feather name="bookmark" size={14} color="#AAAAAA" />
                  <Text style={{ color: '#AAAAAA', fontSize: 11 }}>Save</Text>
                </Pressable>
              </Pressable>
            );
          })}
          {/* Pagination */}
          {!wLoad && !wErr && wTotal > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 16 }}>
              <Pressable onPress={() => setWPage(p => Math.max(1, p - 1))} disabled={wPage <= 1}
                style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: '#151915', borderWidth: 1, borderColor: '#242B24', opacity: wPage <= 1 ? 0.4 : 1 }}>
                <Text style={{ color: '#7ED321', fontWeight: '700' }}>Prev</Text>
              </Pressable>
              <View style={{ backgroundColor: '#7ED321', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
                <Text style={{ color: '#000', fontWeight: '900' }}>{wPage}/{wTotal}</Text>
              </View>
              <Pressable onPress={() => setWPage(p => Math.min(wTotal, p + 1))} disabled={wPage >= wTotal}
                style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: '#151915', borderWidth: 1, borderColor: '#242B24', opacity: wPage >= wTotal ? 0.4 : 1 }}>
                <Text style={{ color: '#7ED321', fontWeight: '700' }}>Next</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Exercises tab ── */}
      {tab === 'exercises' && (
        <>
          <View className="px-5 pb-3">
            {/* Category filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
              {EX_FILTERS.map(f => {
                const active = f === exFilter;
                return (
                  <Pressable key={f} onPress={() => { setExFilter(f); setExPage(1); }}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? '#7ED321' : '#151915', borderWidth: 1, borderColor: active ? '#7ED321' : '#242B24' }}>
                    <Text style={{ color: active ? '#000' : '#AAAAAA', fontSize: 12, fontWeight: '700' }}>{f}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {/* Search */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#151915', borderRadius: 16, borderWidth: 1, borderColor: '#242B24', paddingHorizontal: 12, height: 46 }}>
              <Feather name="search" size={15} color="#555" style={{ marginRight: 8 }} />
              <TextInput style={{ flex: 1, color: '#FFFFFF', fontSize: 14 }} placeholder="Search exercises…" placeholderTextColor="#555"
                value={search} onChangeText={setSearch} autoCorrect={false} autoCapitalize="none" />
              {search.length > 0 && <Pressable onPress={() => setSearch('')} hitSlop={8}><Feather name="x" size={14} color="#555" /></Pressable>}
            </View>
          </View>

          <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
            {exLoad && <Skeleton />}
            {exErr && (
              <View className="items-center pt-16">
                <Feather name="wifi-off" size={28} color="#EF4444" />
                <Pressable onPress={() => exRefetch()} className="bg-brand rounded-full px-7 py-3 mt-4">
                  <Text className="text-black font-bold">Retry</Text>
                </Pressable>
              </View>
            )}
            {!exLoad && !exErr && filteredEx.map(ex => {
              const diff  = ex.difficulty?.toLowerCase() ?? 'beginner';
              const cat   = ex.category?.toLowerCase()   ?? 'strength';
              const color = getDifficultyColor(diff);
              const icon  = CAT_ICON[cat]  ?? 'zap';
              return (
                <View key={ex.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#151915', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1C211C' }}>
                  <View style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: '#1C211C', borderWidth: 1, borderColor: '#242B24', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <Feather name={icon} size={26} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="text-white text-[15px] font-bold" numberOfLines={1}>{ex.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                      {ex.category && <View style={{ backgroundColor: '#1C211C', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#242B24' }}><Text style={{ color: '#AAAAAA', fontSize: 11, fontWeight: '600' }}>{ex.category}</Text></View>}
                      {ex.difficulty && <View style={{ backgroundColor: color + '15', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: color + '35' }}><Text style={{ color, fontSize: 11, fontWeight: '700' }}>{ex.difficulty}</Text></View>}
                    </View>
                  </View>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(126,211,33,0.10)', borderWidth: 1, borderColor: 'rgba(126,211,33,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="play" size={14} color="#7ED321" />
                  </View>
                </View>
              );
            })}
            {/* Ex Pagination */}
            {!exLoad && !exErr && exTotal > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 16 }}>
                <Pressable onPress={() => setExPage(p => Math.max(1, p - 1))} disabled={exPage <= 1}
                  style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: '#151915', borderWidth: 1, borderColor: '#242B24', opacity: exPage <= 1 ? 0.4 : 1 }}>
                  <Text style={{ color: '#7ED321', fontWeight: '700' }}>Prev</Text>
                </Pressable>
                <View style={{ backgroundColor: '#7ED321', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
                  <Text style={{ color: '#000', fontWeight: '900' }}>{exPage}/{exTotal}</Text>
                </View>
                <Pressable onPress={() => setExPage(p => Math.min(exTotal, p + 1))} disabled={exPage >= exTotal}
                  style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: '#151915', borderWidth: 1, borderColor: '#242B24', opacity: exPage >= exTotal ? 0.4 : 1 }}>
                  <Text style={{ color: '#7ED321', fontWeight: '700' }}>Next</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}
