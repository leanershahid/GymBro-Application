import React from 'react';
import { View, Text, Pressable, ImageBackground } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, Shadow } from '../../trainers/components/theme';
import { BranchSummary } from '../types/dashboard';

interface BranchCardProps {
  branch: BranchSummary;
  onPress?: () => void;
  /** Called when the overflow ("...") icon is tapped — currently a visual affordance with no menu wired up yet. */
  onPressMore?: () => void;
}

function formatRevenue(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
  return `₹${value}`;
}

const glass = {
  backgroundColor: T.bgInput,
  borderWidth: 1,
  borderColor: T.line,
  ...Shadow.sm,
};

// Generic placeholder photos — no per-branch image exists in the data model yet,
// so these cycle by branch id, same placeholder-photo treatment used elsewhere.
const BRANCH_IMAGES = [
  require('../../../assets/dashboard/workout-1.jpg'),
  require('../../../assets/dashboard/workout-2.jpg'),
  require('../../../assets/dashboard/workout-3.jpg'),
  require('../../../assets/dashboard/hero-athlete.jpg'),
];

export default function BranchCard({ branch, onPress, onPressMore }: BranchCardProps) {
  const occupancyColor =
    branch.occupancyPct >= 80 ? T.brand :
    branch.occupancyPct >= 50 ? T.brandGold : T.err;

  const image = BRANCH_IMAGES[Number(branch.id.toString().replace(/\D/g, '') || 0) % BRANCH_IMAGES.length];

  return (
    <Pressable
      onPress={onPress}
      style={[glass, { borderRadius: 20, overflow: 'hidden', marginRight: 12, width: 172 }]}
      accessibilityRole="button"
      accessibilityLabel={branch.name}
    >
      <ImageBackground source={image} style={{ width: '100%', height: 72 }} imageStyle={{ opacity: 0.55 }} resizeMode="cover">
        <View style={{ flex: 1, backgroundColor: 'rgba(10,15,10,0.35)', padding: 10, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={onPressMore}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`More options for ${branch.name}`}
            style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(10,15,10,0.55)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name="more-horizontal" size={15} color={T.text} />
          </Pressable>
        </View>
      </ImageBackground>

      <View style={{ padding: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexShrink: 1, paddingRight: 8 }}>
            <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
              {branch.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <Feather name="map-pin" size={11} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 11, marginLeft: 4 }} numberOfLines={1}>
                {branch.city}
              </Text>
            </View>
          </View>
          <View style={{
            borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
            backgroundColor: branch.isOpen ? 'rgba(126,211,33,0.12)' : 'rgba(255,77,77,0.12)',
            borderWidth: 1,
            borderColor: branch.isOpen ? 'rgba(126,211,33,0.25)' : 'rgba(255,77,77,0.25)',
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: branch.isOpen ? T.brand : T.err }}>
              {branch.isOpen ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: T.line, marginBottom: 12 }} />

        {/* Members */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Feather name="users" size={13} color={T.textFaint} />
          <Text style={{ color: T.textSub, fontSize: 12, marginLeft: 5 }}>{branch.memberCount} members</Text>
        </View>

        {/* Revenue */}
        <Text style={{ color: T.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>
          {formatRevenue(branch.revenue)}
        </Text>
        <Text style={{ color: T.textSub, fontSize: 11, marginBottom: 12 }}>revenue this month</Text>

        {/* Occupancy bar */}
        <View style={{ height: 5, backgroundColor: T.line, borderRadius: 3, overflow: 'hidden' }}>
          <View style={{
            height: '100%', borderRadius: 3,
            width: `${branch.occupancyPct}%`,
            backgroundColor: occupancyColor,
          }} />
        </View>
        <Text style={{ color: T.textSub, fontSize: 11, marginTop: 5 }}>{branch.occupancyPct}% capacity</Text>
      </View>
    </Pressable>
  );
}
