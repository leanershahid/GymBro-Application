import React, { useState } from 'react';
import { View, useWindowDimensions, ImageSourcePropType } from 'react-native';
import { T } from '../../../theme';
import PhotoHero from '../../common/components/dashboard/PhotoHero';
import Sparkline from '../../common/components/dashboard/Sparkline';
import { RevenueTrendPoint } from '../types/dashboard';
import { formatInrCompact, formatPct } from './formatInr';

// On web a require()'d image resolves to { uri, width, height }; react-native-web then sizes the
// ImageBackground's <img> to those intrinsic pixels instead of covering the card, so only the
// photo's top-left corner shows. Passing just the uri lets resizeMode="cover" fill the card.
// Native returns a number, which is passed through unchanged.
const RAW_HERO = require('../../../assets/dashboard/hero-athlete.jpg');
const HERO_IMAGE: ImageSourcePropType =
  RAW_HERO && typeof RAW_HERO === 'object' && 'uri' in RAW_HERO ? { uri: RAW_HERO.uri } : RAW_HERO;

interface Props {
  totalRevenue: number;
  growthPct: number;
  activeBranches: number;
  trend: RevenueTrendPoint[];
}

/** Admin home hero — this month's revenue is the one number the screen is about. */
export default function AdminRevenueHero({ totalRevenue, growthPct, activeBranches, trend }: Props) {
  const [w, setW] = useState(0);
  const { height: screenH } = useWindowDimensions();
  // Taller than PhotoHero's default so the athlete stays visible above the number + sparkline.
  const heroH = Math.round(Math.max(270, Math.min(330, screenH * 0.38)));
  const growing = growthPct >= 0;

  return (
    <PhotoHero
      image={HERO_IMAGE}
      height={heroH}
      eyebrow="Revenue this month"
      title={growing ? 'Your gyms are growing' : 'Here’s how this month is tracking'}
      value={formatInrCompact(totalRevenue)}
      delta={{ label: formatPct(growthPct), positive: growing }}
      valueCaption={`vs last month · ${activeBranches} active ${activeBranches === 1 ? 'branch' : 'branches'}`}
    >
      {trend.length > 1 && (
        <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height: 40 }}>
          <Sparkline values={trend.map(p => p.value)} width={w} height={40} color={growing ? T.brand : T.err} />
        </View>
      )}
    </PhotoHero>
  );
}
