import React from 'react';
import { View, Text, ScrollView, StatusBar, Platform } from 'react-native';
import { T } from '../../trainers/components/theme';
import { useHealthToday } from '../api/memberAppQueries';
import SummaryRing from '../components/SummaryRing';
import MetricBar from '../components/MetricBar';
import StatChip from '../components/StatChip';
import StreakCard from '../components/StreakCard';

interface Props { userId: number; }

export default function StatsScreen({ userId }: Props) {
  const { data: health } = useHealthToday(userId);
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

      <View className="px-5 pt-5 pb-3">
        <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>Today</Text>
        <Text style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Stats</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ alignItems: 'center', backgroundColor: T.bgInput, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: T.line, marginBottom: 20 }}>
          <SummaryRing pct={overallPct} size={140} strokeWidth={14} sublabel="Daily" />
        </View>

        <View style={{ backgroundColor: T.bgInput, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: T.line, marginBottom: 20 }}>
          <MetricBar label="Move" current={rings?.move.current ?? 0} goal={rings?.move.goal ?? 8000} unit="steps" color={T.brand} />
          <MetricBar label="Train" current={rings?.train.current ?? 0} goal={rings?.train.goal ?? 60} unit="min" color={T.brandGold} />
          <MetricBar label="Stand" current={rings?.stand.current ?? 0} goal={rings?.stand.goal ?? 12} unit="hr" color={T.sky} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <StatChip icon="heart" value={health?.stats.bpm != null ? `${health.stats.bpm}` : '--'} label="BPM" color={T.rose} />
          <StatChip icon="droplet" value={health?.stats.waterLiters != null ? `${health.stats.waterLiters}L` : '--'} label="Water" color={T.sky} />
          <StatChip icon="moon" value={health?.stats.sleepHours != null ? `${health.stats.sleepHours}h` : '--'} label="Sleep" color={T.violet} />
          <StatChip icon="zap" value={health?.stats.energyPct != null ? `${health.stats.energyPct}%` : '--'} label="Energy" color={T.brandGold} />
        </View>

        <StreakCard days={health?.streakDays ?? 0} />
      </ScrollView>
    </View>
  );
}
