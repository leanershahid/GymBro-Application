import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StatusBar, Platform, Animated } from 'react-native';
import { useBranches } from '../api/branchQueries';
import { Branch } from '../types/branch.types';
import { T } from '../../trainers/components/theme';
import StatsStrip from '../../common/StatsStrip';

type BranchWithImage = Branch & { imageUrl?: string };

// All four tints stay on-theme: only the first (green) maps to the primary accent;
// the rest use muted accent variants so they still feel cohesive in the dark palette.
const TINTS = [
  { bg: T.brandDim,                     accent: T.brand },
  { bg: 'rgba(34,211,238,0.10)',         accent: '#22D3EE' },
  { bg: 'rgba(167,139,250,0.10)',        accent: '#A78BFA' },
  { bg: 'rgba(250,204,21,0.10)',         accent: '#FACC15' },
];
const tint = (id: number) => TINTS[id % TINTS.length];

function StatusDot({ color }: { color: string }) {
  return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />;
}

function GlassIconBadge({ emoji }: { emoji: string }) {
  return (
    <View style={{
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: T.bgInputActive,
      borderWidth: 1, borderColor: T.line,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 16,
    }}>
      <Text style={{ fontSize: 30 }}>{emoji}</Text>
    </View>
  );
}

function BranchCard({ branch, index }: { branch: BranchWithImage; index: number }) {
  const c           = tint(branch.id);
  const lower       = branch.status.toLowerCase();
  const accentColor = lower === 'active' ? T.brand : lower === 'trial' ? '#FACC15' : T.textSub;
  const hasImage    = !!branch.imageUrl;

  return (
    <View style={{
      marginHorizontal: 20, marginBottom: 18, borderRadius: 26,
      shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35, shadowRadius: 18, elevation: 8,
    }}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={{ borderRadius: 26, overflow: 'hidden', height: 250, backgroundColor: hasImage ? T.bgPanel : c.bg }}
      >
        {/* Full-bleed photo */}
        {hasImage && (
          <>
            <Image
              source={{ uri: branch.imageUrl }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              resizeMode="cover"
            />
            {/* Dark scrim — palette: rgba(0,0,0,0.55) */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.42)' }} />
          </>
        )}

        {/* Top row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 14 }}>
          {/* Code pill */}
          <View style={{
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderWidth: 1, borderColor: c.accent,
            borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: T.text, letterSpacing: 0.5 }}>
              {(branch.code || branch.city || 'Branch').slice(0, 6).toUpperCase()}
            </Text>
          </View>

          {/* Arrow button — Icon/Badge Stroke: #FFFFFF at 80% opacity */}
          <TouchableOpacity style={{
            width: 34, height: 34, borderRadius: 17,
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 14, color: T.text }}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* Floating glass dock — Timer Pill BG: rgba(0,0,0,0.55) */}
        <View style={{
          position: 'absolute', left: 14, right: 14, bottom: 14,
          borderRadius: 20, overflow: 'hidden',
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
        }}>
          {/* Accent hairline */}
          <View style={{ height: 2, backgroundColor: c.accent }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
            {/* Avatar circle */}
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: T.bgInputActive,
              borderWidth: 1.5, borderColor: c.accent,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent }} />
            </View>

            <View style={{ flex: 1 }}>
              {/* Branch name — Text Primary */}
              <Text style={{ fontSize: 15, fontWeight: '800', color: T.text }} numberOfLines={1}>
                {branch.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <StatusDot color={accentColor} />
                {/* Status — accent or muted */}
                <Text style={{ fontSize: 11, color: accentColor, fontWeight: '600' }}>{branch.status}</Text>
                {/* Duration / location — Text Secondary */}
                <Text style={{ fontSize: 11, color: T.textSub }}>·  {branch.city || branch.country || 'N/A'}</Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function Pulse({ children }: { children: React.ReactNode }) {
  const opacity = React.useRef(new Animated.Value(0.4)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

function Bone({ w, h, r = 8 }: { w: number | string; h: number; r?: number }) {
  return <View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: T.bgInputActive }} />;
}

function SkeletonPage() {
  return (
    <Pulse>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 14 }}>
        <Bone w="55%" h={26} r={8} />
        <Bone w="35%" h={16} r={6} />
        {[0, 1, 2].map((k) => <Bone key={k} w="100%" h={250} r={26} />)}
      </View>
    </Pulse>
  );
}

export default function BranchesPage() {
  const { data: branches = [], isLoading, isError, refetch } = useBranches();

  return (
    <View style={{
      flex: 1, backgroundColor: T.bg,
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0,
    }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22 }}>
          {/* Hero H1: 28–32px / 800 / white / -0.5 tracking */}
          <Text style={{ fontSize: 32, fontWeight: '800', color: T.text, letterSpacing: -0.5 }}>Branches</Text>
          {/* Body description: 13–14px / 400 / #AAAAAA */}
          <Text style={{ fontSize: 14, fontWeight: '400', color: T.textSub, marginTop: 4 }}>
            {isLoading ? 'Loading…' : `${branches.length} gym location${branches.length !== 1 ? 's' : ''}`}
          </Text>
        </View>

        {/* Stats strip */}
        {!isLoading && !isError && branches.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
            <StatsStrip items={[
              { icon: 'map-pin',    label: 'Total',    value: String(branches.length),                                                          accent: '#7ED321' },
              { icon: 'check-circle', label: 'Active', value: String(branches.filter((b) => b.status.toLowerCase() === 'active').length),       accent: '#22D3EE' },
              { icon: 'clock',      label: 'Trial',    value: String(branches.filter((b) => b.status.toLowerCase() === 'trial').length),        accent: '#FACC15' },
              { icon: 'x-circle',   label: 'Inactive', value: String(branches.filter((b) => !['active','trial'].includes(b.status.toLowerCase())).length), accent: '#A78BFA' },
            ]} />
          </View>
        )}

        {isLoading && <SkeletonPage />}

        {isError && (
          <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 }}>
            <GlassIconBadge emoji="⚠️" />
            {/* Section heading: 18–20px / 700 / white */}
            <Text style={{ fontSize: 18, fontWeight: '700', color: T.text, textAlign: 'center', marginBottom: 8 }}>
              Failed to load branches
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '400', color: T.textSub, textAlign: 'center', marginBottom: 24 }}>
              Check your connection and try again.
            </Text>
            {/* CTA button: bg #7ED321 / text #000000 / 700 / 16px */}
            <TouchableOpacity
              onPress={() => refetch()}
              activeOpacity={0.85}
              style={{ backgroundColor: T.brand, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 14 }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.onBrand }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !isError && branches.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 }}>
            <GlassIconBadge emoji="🏢" />
            <Text style={{ fontSize: 18, fontWeight: '700', color: T.text, textAlign: 'center', marginBottom: 8 }}>
              No branches yet
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '400', color: T.textSub, textAlign: 'center' }}>
              Add your first gym branch to get started.
            </Text>
          </View>
        )}

        {!isLoading && !isError && branches.map((b, i) => (
          <BranchCard
            key={b.id}
            branch={{ ...b, imageUrl: b.logoUrl || undefined } as BranchWithImage}
            index={i}
          />
        ))}

      </ScrollView>
    </View>
  );
}
