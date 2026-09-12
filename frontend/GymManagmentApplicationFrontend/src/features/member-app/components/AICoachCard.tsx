import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';

interface AICoachCardProps {
  recoveryScore: number | null;
  /** Admin-configurable tip from the backend (see AiCoachSettingsPage) — falls back to a local default if not supplied. */
  tip?: string | null;
  onPress?: () => void;
}

/**
 * "AI Coach" surfaces a real metric (today's HealthMetric.RecoveryScore) inside
 * a templated message — there's no live LLM behind this, it's a static coach
 * tip keyed off the score, same placeholder-with-real-data treatment as
 * LiveCoachCard's LIVE flag. The tip text itself is admin-editable (see
 * AiCoachSettingsPage) and passed in via `tip`; these local strings are only
 * a fallback for when the backend hasn't returned one yet.
 */
export default function AICoachCard({ recoveryScore, tip: tipOverride, onPress }: AICoachCardProps) {
  const score = recoveryScore ?? 0;
  const tip = tipOverride ?? (score >= 80
    ? "Push hard today — I've added an extra set to your next session."
    : score >= 50
    ? 'Solid recovery. A moderate session will keep you on track.'
    : 'Recovery is low — consider an active-rest or mobility day.');

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: T.bgInput, borderRadius: 20, padding: 16,
        borderWidth: 1, borderColor: T.line,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <LinearGradient
            colors={T.brandGradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name="cpu" size={16} color={T.onBrand} />
          </LinearGradient>
          <Text style={{ color: T.text, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            AI Coach
          </Text>
          <View style={{ backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: T.brand, fontSize: 9.5, fontWeight: '700' }}>LIVE</Text>
          </View>
        </View>
      </View>

      <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>
        {recoveryScore !== null ? (
          <>Your recovery score is <Text style={{ color: T.brand, fontWeight: '800' }}>{score}%</Text>. {tip}</>
        ) : (
          'Log today’s health check-in to unlock your recovery insight.'
        )}
      </Text>

      <Text style={{ color: T.brand, fontSize: 12, fontWeight: '700', marginTop: 8 }}>Ask Pulse AI ›</Text>
    </Pressable>
  );
}
