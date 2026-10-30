import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable,
  Animated, ImageBackground,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import Screen from '../../common/components/Screen';
import BackButton from '../../common/components/BackButton';
import SectionHeader from '../components/Sectionheader';

// ─── Images ───────────────────────────────────────────────────────
const IMG_COACH1  = require('../../../assets/dashboard/coach-1.jpg');
const IMG_COACH2  = require('../../../assets/dashboard/coach-2.jpg');
const IMG_WORKOUT = require('../../../assets/dashboard/workout-1.jpg');
const IMG_HERO    = require('../../../assets/dashboard/hero-athlete.jpg');

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

// ─── Color palette ────────────────────────────────────────────────
const ACCENT      = T.brand;
const ACCENT_DARK = T.brandDark;
const ACCENT_FG   = T.onBrand;
const BG          = T.bg;
const SURFACE     = T.bgInput;
const SURFACE_EL  = T.bgInputActive;
const TEXT        = T.text;
const TEXT_SUB    = T.textSub;
const ICON_STROKE = withAlpha(T.text, 0.80);

// ─── Module data ──────────────────────────────────────────────────
interface ModuleItem {
  key: string; category: string; label: string;
  sublabel: string; icon: FeatherIconName;
  stat: string; image: any;
}

// Counts come from the dashboard overview so the hub never shows invented numbers.
interface HubStats { totalBranches: number; totalTrainers: number; totalTenants: number; totalMembers: number; newSignupsToday: number; activeBranches: number; }
const fmt = (n?: number) => (n === undefined ? '—' : n.toLocaleString('en-IN'));
const buildModules = (s?: HubStats): ModuleItem[] => [
  { key: 'branch',  category: 'Locations',     label: 'Branches', sublabel: 'Add new location',   icon: 'map-pin',   stat: fmt(s?.totalBranches), image: IMG_WORKOUT },
  { key: 'trainer', category: 'Staff',          label: 'Trainers', sublabel: 'Onboard coaches',    icon: 'award',     stat: fmt(s?.totalTrainers), image: IMG_COACH1  },
  { key: 'tenant',  category: 'Organisations',  label: 'Tenants',  sublabel: 'New organisation',   icon: 'briefcase', stat: fmt(s?.totalTenants),  image: IMG_COACH2  },
  { key: 'client',  category: 'Members',        label: 'Clients',  sublabel: 'Enrol members',      icon: 'user-plus', stat: fmt(s?.totalMembers),  image: IMG_HERO    },
];

const CATEGORIES = ['All', 'Locations', 'Staff', 'Organisations', 'Members'];

// `to` is the AdminDashboard screen each row opens.
const buildActivity = (s?: HubStats) => s ? [
  { icon: 'map-pin'   as FeatherIconName, title: `${fmt(s.activeBranches)} of ${fmt(s.totalBranches)} branches active`, sub: 'Locations',            to: 'branches' },
  { icon: 'award'     as FeatherIconName, title: `${fmt(s.totalTrainers)} trainers on staff`,                          sub: 'Staff',                to: 'trainers' },
  { icon: 'user-plus' as FeatherIconName, title: `${fmt(s.newSignupsToday)} new members today`,                         sub: 'Today · all branches', to: 'members'  },
] : [];

// ─── Module card ──────────────────────────────────────────────────
function ModuleCard({
  mod, cardW, scale, onPressAdd, onPressView,
}: {
  mod: ModuleItem; cardW: number; scale: number;
  onPressAdd: () => void; onPressView: () => void;
}) {
  const anim = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(anim, { toValue: 0.975, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
  const onOut = () => Animated.spring(anim, { toValue: 1,     useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  // Scale icon circle proportionally
  const circleSize = Math.round(cardW * 0.18);
  const iconSize   = Math.round(circleSize * 0.44);
  const titleSize  = Math.min(Math.round(cardW * 0.085), 36) * scale;

  return (
    <Animated.View style={{ transform: [{ scale: anim }], width: cardW }}>
      <Pressable
        onPress={onPressView} onPressIn={onIn} onPressOut={onOut}
        accessibilityRole="button" accessibilityLabel={mod.label}
        style={{
          borderRadius: R.xl, overflow: 'hidden',
          borderWidth: 1, borderColor: withAlpha(T.brand, 0.20),
          shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
        }}
      >
        <ImageBackground
          source={mod.image}
          style={{ width: '100%' }}
          imageStyle={{ opacity: 0.45 }}
          resizeMode="cover"
        >
          <View style={{ backgroundColor: T.overlay, borderRadius: R.xl }}>

            {/* Top content */}
            <View style={{ padding: cardW * 0.055, paddingBottom: 0 }}>

              {/* Category pill + arrow */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: cardW * 0.045 }}>
                <View style={{
                  backgroundColor: T.overlay,
                  borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
                  borderWidth: 1, borderColor: withAlpha(T.brand, 0.40),
                }}>
                  <Text style={{ color: ACCENT, fontSize: 11 * scale, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' }}>
                    {mod.category}
                  </Text>
                </View>

                <Pressable
                  onPress={onPressView} hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${mod.label}`}
                  style={{
                    width: 32, height: 32, borderRadius: 10,
                    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Feather name="arrow-up-right" size={16} color={ACCENT_FG} />
                </Pressable>
              </View>

              {/* Title row */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: cardW * 0.045 }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{
                    color: TEXT, fontSize: titleSize, fontWeight: '800',
                    letterSpacing: -0.5, lineHeight: titleSize * 1.18,
                    textShadowColor: withAlpha(T.black, 0.7),
                    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
                  }}>
                    {mod.label}
                  </Text>
                  <Text style={{ color: TEXT_SUB, fontSize: 12 * scale, marginTop: 5, fontWeight: '400' }}>
                    {mod.sublabel}
                  </Text>
                </View>

                {/* Glassy icon circle — size proportional to card width */}
                <View style={{
                  width: circleSize, height: circleSize, borderRadius: circleSize / 2,
                  backgroundColor: withAlpha(T.text, 0.08),
                  borderWidth: 1.5, borderColor: ICON_STROKE,
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
                }}>
                  <Feather name={mod.icon} size={iconSize} color={ACCENT} />
                </View>
              </View>
            </View>

            {/* Glassy bottom dock */}
            <View style={{
              margin: 10, borderRadius: 18,
              backgroundColor: withAlpha(T.bgInput, 0.85),
              borderWidth: 1, borderColor: withAlpha(T.text, 0.10),
              padding: 12,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}>
              {/* Real total from the dashboard overview ("—" until loaded) */}
              <View
                accessible
                accessibilityLabel={`${mod.stat === '—' ? 'Total not available' : `${mod.stat} ${mod.label.toLowerCase()} in total`}`}
                style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexShrink: 1 }}
              >
                <Text style={{ color: ACCENT, fontSize: 18 * scale, fontWeight: '800' }}>{mod.stat}</Text>
                <Text numberOfLines={1} style={{ color: TEXT_SUB, fontSize: 11 * scale, fontWeight: '600', flexShrink: 1 }}>total</Text>
              </View>

              {/* Add CTA */}
              <Pressable
                onPress={onPressAdd} hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Add ${mod.label}`}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: pressed ? ACCENT_DARK : ACCENT,
                  borderRadius: 50, paddingHorizontal: 14, paddingVertical: 9,
                  shadowColor: ACCENT, shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: pressed ? 0 : 0.40, shadowRadius: 8, elevation: pressed ? 0 : 5,
                })}
              >
                {({ pressed }) => (
                  <>
                    <Feather name="plus" size={13} color={ACCENT_FG} />
                    <Text style={{ color: ACCENT_FG, fontSize: 12 * scale, fontWeight: '700' }}>Add new</Text>
                  </>
                )}
              </Pressable>
            </View>

          </View>
        </ImageBackground>
      </Pressable>
    </Animated.View>
  );
}

// ─── Page ─────────────────────────────────────────────────────────
interface AdminModuleDevelopmentDashboardProps {
  onNavigate?: (key: string) => void;
  onBack?: () => void;
  stats?: HubStats;
}

export default function AdminModuleDevelopmentDashboard({ onNavigate, onBack, stats }: AdminModuleDevelopmentDashboardProps) {
  const MODULES = buildModules(stats);
  const ACTIVITY = buildActivity(stats);
  const [activeFilter, setActiveFilter] = useState('All');

  const { hPad, cols, cardW, cardGap, scale, isTablet, isDesktop } = useLayout();

  // All destinations live in AdminDashboard's router — the hub only reports where to go.
  const ROUTES: Record<string, string> = {
    branch: 'add-branch',   'view-branchs':  'branches',
    trainer: 'add-trainer', 'view-trainers': 'trainers',
    tenant: 'add-tenant',   'view-tenants':  'tenants',
    client: 'add-member',   'view-clients':  'members',
  };
  const handleNavigate = (key: string) => onNavigate?.(ROUTES[key] ?? key);

  const visibleModules = activeFilter === 'All'
    ? MODULES
    : MODULES.filter((m) => m.category === activeFilter);

  // Group modules into rows of `cols` for the grid
  const rows: ModuleItem[][] = [];
  for (let i = 0; i < visibleModules.length; i += cols) {
    rows.push(visibleModules.slice(i, i + cols));
  }

  // Responsive font sizes
  const heroSize    = isDesktop ? 36 : isTablet ? 32 : 28;
  const bodySize    = isDesktop ? 15 : 14;
  const btnSize     = 40; // matches the shared BackButton

  return (
    <Screen style={{ backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Hero header ── */}
        <View style={{ paddingHorizontal: hPad, paddingTop: 22 }}>

          {/* Top bar: back */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: isTablet ? 32 : 24 }}>
            {onBack ? <BackButton onPress={onBack} /> : <View style={{ width: btnSize }} />}
          </View>

          {/* Hero title — fluid size */}
          <Text style={{
            color: TEXT, fontSize: heroSize, fontWeight: '800',
            letterSpacing: -0.5, lineHeight: heroSize * 1.22,
            marginBottom: 10,
          }}>
            Manage{'\n'}Your Gym{' '}
            <Text style={{ color: ACCENT }}>Hub</Text>
          </Text>

          <Text style={{ color: TEXT_SUB, fontSize: bodySize, lineHeight: bodySize * 1.6, marginBottom: isTablet ? 32 : 24 }}>
            Add branches, onboard trainers, register tenants and enrol clients from one place.
          </Text>
        </View>

        {/* ── Category tabs ── */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: hPad, gap: 8, paddingBottom: 4 }}
          style={{ marginBottom: isTablet ? 28 : 24 }}
        >
          {CATEGORIES.map((cat) => {
            const active = cat === activeFilter;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveFilter(cat)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${cat}`}
                accessibilityState={{ selected: active }}
                style={{
                  paddingHorizontal: isTablet ? 20 : 16,
                  minHeight: 44, justifyContent: 'center',
                  borderRadius: 999,
                  backgroundColor: active ? ACCENT : SURFACE,
                  borderWidth: 1,
                  borderColor: active ? ACCENT : T.line,
                  shadowColor: active ? ACCENT : 'transparent',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: active ? 0.40 : 0,
                  shadowRadius: 10, elevation: active ? 6 : 0,
                }}
              >
                <Text style={{
                  color: active ? ACCENT_FG : TEXT_SUB,
                  fontSize: 13 * scale, fontWeight: '700',
                }}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Module grid: 1-col on phone, 2-col on tablet+ ── */}
        <View style={{ paddingHorizontal: hPad }}>
          {rows.map((row, ri) => (
            <View
              key={ri}
              style={{
                flexDirection: 'row',
                gap: cardGap,
                marginBottom: 24,
              }}
            >
              {row.map((mod) => (
                <ModuleCard
                  key={mod.key}
                  mod={mod}
                  cardW={cardW}
                  scale={scale}
                  onPressAdd={() => handleNavigate(mod.key)}
                  onPressView={() => handleNavigate(`view-${mod.key}s`)}
                />
              ))}
              {/* Fill empty cells on a short last row */}
              {Array.from({ length: cols - row.length }, (_, k) => (
                <View key={`fill-${k}`} style={{ width: cardW }} />
              ))}
            </View>
          ))}
        </View>

        {/* ── Recent activity ── */}
        <View style={{ paddingHorizontal: hPad }}>
          <SectionHeader title="At a glance" />

          {/* On tablet/desktop, lay activity rows side-by-side in a 2-col wrap */}
          <View style={{
            flexDirection: isTablet ? 'row' : 'column',
            flexWrap: isTablet ? 'wrap' : 'nowrap',
            gap: 10,
          }}>
            {ACTIVITY.map((item, i) => (
              <Pressable
                key={i}
                onPress={() => onNavigate?.(item.to)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${item.sub}`}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: pressed ? SURFACE_EL : SURFACE,
                  borderRadius: 18, padding: 14,
                  borderWidth: 1, borderColor: pressed ? withAlpha(T.brand, 0.20) : T.bgInputActive,
                  // On tablet: each row takes ~half width minus gap
                  ...(isTablet && { flex: 1, minWidth: '45%' }),
                })}
              >
                <View style={{
                  width: 42, height: 42, borderRadius: 13,
                  backgroundColor: withAlpha(T.brand, 0.10),
                  borderWidth: 1, borderColor: withAlpha(T.brand, 0.25),
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Feather name={item.icon} size={17} color={ACCENT} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: TEXT, fontSize: 13 * scale, fontWeight: '600' }}>{item.title}</Text>
                  <Text numberOfLines={1} style={{ color: TEXT_SUB, fontSize: 11 * scale, marginTop: 3 }}>{item.sub}</Text>
                </View>

                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: T.line,
                  borderWidth: 1, borderColor: T.line,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Feather name="chevron-right" size={13} color={ICON_STROKE} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

      </ScrollView>
    </Screen>
  );
}
