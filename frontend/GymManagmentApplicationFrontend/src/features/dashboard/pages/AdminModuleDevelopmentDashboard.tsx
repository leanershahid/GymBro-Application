import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable,
  StatusBar, Platform, Animated, ImageBackground,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AddTrainerPage   from '../../trainers/pages/AddTrainerPage';
import ViewTrainersPage from '../../trainers/pages/ViewTrainersPage';
import AddBranchPage    from '../../branches/pages/AddBranchPage';
import ViewBranchesPage from '../../branches/pages/ViewBranchesPage';
import AddTenantPage    from '../../tenants/pages/AddTenantPage';
import ViewTenantsPage  from '../../tenants/pages/ViewTenantsPage';

// ─── Images ───────────────────────────────────────────────────────
const IMG_COACH1  = require('../../../assets/dashboard/coach-1.jpg');
const IMG_COACH2  = require('../../../assets/dashboard/coach-2.jpg');
const IMG_WORKOUT = require('../../../assets/dashboard/workout-1.jpg');
const IMG_HERO    = require('../../../assets/dashboard/hero-athlete.jpg');

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

// ─── Color palette ────────────────────────────────────────────────
const ACCENT      = '#7ED321';
const ACCENT_DARK = '#5FA317';
const ACCENT_FG   = '#000000';
const BG          = '#0A0F0A';
const SURFACE     = '#151915';
const SURFACE_EL  = '#1C211C';
const TEXT        = '#FFFFFF';
const TEXT_SUB    = '#AAAAAA';
const ICON_STROKE = 'rgba(255,255,255,0.80)';

// ─── Responsive breakpoints ───────────────────────────────────────
// phone  : w < 480
// tablet : 480 ≤ w < 768
// desktop: w ≥ 768
function useLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet  = width >= 480;
  const isDesktop = width >= 768;

  // Fluid horizontal padding: 16 → 24 → 40
  const hPad = isDesktop ? 40 : isTablet ? 24 : 16;

  // Number of card columns: 1 → 2
  const cols = isTablet ? 2 : 1;

  // Card width accounting for columns and gap
  const cardGap = isTablet ? 14 : 0;
  const cardW   = cols === 2
    ? (width - hPad * 2 - cardGap) / 2
    : width - hPad * 2;

  // Scale factor for font sizes
  const scale = isDesktop ? 1.1 : isTablet ? 1.05 : 1;

  return { width, height, isTablet, isDesktop, hPad, cols, cardW, cardGap, scale };
}

// ─── Module data ──────────────────────────────────────────────────
interface ModuleItem {
  key: string; category: string; label: string;
  sublabel: string; icon: FeatherIconName;
  stat: string; level: string; image: any;
}

const MODULES: ModuleItem[] = [
  { key: 'branch',  category: 'Locations',     label: 'Branches', sublabel: 'Add new location',   icon: 'map-pin',   stat: '5',     level: 'Manager',      image: IMG_WORKOUT },
  { key: 'trainer', category: 'Staff',          label: 'Trainers', sublabel: 'Onboard coaches',    icon: 'award',     stat: '18',    level: 'Professional', image: IMG_COACH1  },
  { key: 'tenant',  category: 'Organisations',  label: 'Tenants',  sublabel: 'New organisation',   icon: 'briefcase', stat: '3',     level: 'Enterprise',   image: IMG_COACH2  },
  { key: 'client',  category: 'Members',        label: 'Clients',  sublabel: 'Enrol members',      icon: 'user-plus', stat: '1,284', level: 'Beginner',     image: IMG_HERO    },
];

const CATEGORIES = ['All', 'Locations', 'Staff', 'Organisations', 'Members'];

const ACTIVITY = [
  { icon: 'map-pin'   as FeatherIconName, title: 'Downtown branch added',   sub: 'Mumbai · 2h ago'             },
  { icon: 'award'     as FeatherIconName, title: 'Ravi K. onboarded',       sub: 'Trainer · Westside · 5h ago' },
  { icon: 'user-plus' as FeatherIconName, title: '23 new members enrolled', sub: 'Today · all branches'        },
];

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
          borderRadius: 24, overflow: 'hidden',
          borderWidth: 1, borderColor: 'rgba(126,211,33,0.20)',
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
          <View style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 24 }}>

            {/* Top content */}
            <View style={{ padding: cardW * 0.055, paddingBottom: 0 }}>

              {/* Category pill + arrow */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: cardW * 0.045 }}>
                <View style={{
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
                  borderWidth: 1, borderColor: 'rgba(126,211,33,0.40)',
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
                    textShadowColor: 'rgba(0,0,0,0.7)',
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
                  backgroundColor: 'rgba(255,255,255,0.08)',
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
              backgroundColor: 'rgba(26,26,26,0.85)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
              padding: 12,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}>
              {/* Level badge + avatars */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                <View style={{
                  backgroundColor: 'rgba(126,211,33,0.12)',
                  borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
                  borderWidth: 1, borderColor: 'rgba(126,211,33,0.30)',
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: ACCENT }} />
                  <Text style={{ color: ACCENT, fontSize: 11 * scale, fontWeight: '600' }}>{mod.level}</Text>
                </View>

                <View style={{ flexDirection: 'row' }}>
                  {[SURFACE_EL, '#2A2A2A', '#242B24'].map((c, i) => (
                    <View key={i} style={{
                      width: 24, height: 24, borderRadius: 12,
                      backgroundColor: c, borderWidth: 1.5, borderColor: ICON_STROKE,
                      marginLeft: i === 0 ? 0 : -8,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Feather name="user" size={10} color={ICON_STROKE} />
                    </View>
                  ))}
                  <View style={{
                    width: 24, height: 24, borderRadius: 12,
                    backgroundColor: 'rgba(126,211,33,0.15)',
                    borderWidth: 1.5, borderColor: 'rgba(126,211,33,0.35)',
                    marginLeft: -8, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: ACCENT, fontSize: 11, fontWeight: '800' }}>{mod.stat}</Text>
                  </View>
                </View>
              </View>

              {/* Add CTA */}
              <Pressable
                onPress={onPressAdd} hitSlop={8}
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
}

export default function AdminModuleDevelopmentDashboard({ onNavigate, onBack }: AdminModuleDevelopmentDashboardProps) {
  const [activePage,   setActivePage]   = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('All');

  const { hPad, cols, cardW, cardGap, scale, isTablet, isDesktop } = useLayout();

  // ── Sub-page routing ─────────────────────────────────────────
  if (activePage === 'trainer')       return <AddTrainerPage   onBack={() => setActivePage(null)} />;
  if (activePage === 'view-trainers') return <ViewTrainersPage onBack={() => setActivePage(null)} onAddTrainer={() => setActivePage('trainer')} />;
  if (activePage === 'branch')        return <AddBranchPage    onBack={() => setActivePage(null)} />;
  if (activePage === 'view-branches') return <ViewBranchesPage onBack={() => setActivePage(null)} onAddBranch={() => setActivePage('branch')} />;
  if (activePage === 'tenant')        return <AddTenantPage    onBack={() => setActivePage(null)} />;
  if (activePage === 'view-tenants')  return <ViewTenantsPage  onBack={() => setActivePage(null)} onAddTenant={() => setActivePage('tenant')} />;

  const handleNavigate = (key: string) => {
    if (key === 'trainer')       { setActivePage('trainer');       return; }
    if (key === 'branch')        { setActivePage('branch');        return; }
    if (key === 'tenant')        { setActivePage('tenant');        return; }
    if (key === 'client')        { onNavigate?.('members');        return; }
    if (key === 'view-branchs')  { setActivePage('view-branches'); return; }
    if (key === 'view-trainers') { setActivePage('view-trainers'); return; }
    if (key === 'view-tenants')  { setActivePage('view-tenants');  return; }
    if (key === 'view-clients')  { onNavigate?.('members');        return; }
    onNavigate?.(key);
  };

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
  const sectionSize = isDesktop ? 20 : isTablet ? 19 : 18;
  const bodySize    = isDesktop ? 15 : 14;
  const btnSize     = 36; // icon button size (spec: 36×36)

  return (
    <View style={{
      flex: 1, backgroundColor: BG,
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0,
    }}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Hero header ── */}
        <View style={{ paddingHorizontal: hPad, paddingTop: 22 }}>

          {/* Top bar: back + bell */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: isTablet ? 32 : 24 }}>
            {onBack ? (
              <Pressable
                onPress={onBack} hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={{
                  width: btnSize, height: btnSize, borderRadius: btnSize / 2,
                  backgroundColor: SURFACE, borderWidth: 1, borderColor: '#242B24',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Feather name="arrow-left" size={18} color={TEXT} />
              </Pressable>
            ) : <View style={{ width: btnSize }} />}

            <View style={{
              width: btnSize, height: btnSize, borderRadius: btnSize / 2,
              backgroundColor: SURFACE, borderWidth: 1, borderColor: '#242B24',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Feather name="bell" size={17} color={ICON_STROKE} />
            </View>
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
          style={{ marginBottom: isTablet ? 28 : 20 }}
        >
          {CATEGORIES.map((cat) => {
            const active = cat === activeFilter;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveFilter(cat)}
                style={{
                  paddingHorizontal: isTablet ? 20 : 16,
                  paddingVertical: isTablet ? 11 : 9,
                  borderRadius: 999,
                  backgroundColor: active ? ACCENT : SURFACE,
                  borderWidth: 1,
                  borderColor: active ? ACCENT : '#242B24',
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
                marginBottom: 16,
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
              {/* Fill empty last cell on odd-count filtered results */}
              {cols === 2 && row.length === 1 && (
                <View style={{ width: cardW }} />
              )}
            </View>
          ))}
        </View>

        {/* ── Recent activity ── */}
        <View style={{ paddingHorizontal: hPad, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ color: TEXT, fontSize: sectionSize, fontWeight: '700', letterSpacing: -0.3 }}>
              Recent Activity
            </Text>
            <Text style={{ color: ACCENT, fontSize: 12 * scale, fontWeight: '600' }}>See all</Text>
          </View>

          {/* On tablet/desktop, lay activity rows side-by-side in a 2-col wrap */}
          <View style={{
            flexDirection: isTablet ? 'row' : 'column',
            flexWrap: isTablet ? 'wrap' : 'nowrap',
            gap: 10,
          }}>
            {ACTIVITY.map((item, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: pressed ? SURFACE_EL : SURFACE,
                  borderRadius: 18, padding: 14,
                  borderWidth: 1, borderColor: pressed ? 'rgba(126,211,33,0.20)' : '#1C211C',
                  // On tablet: each row takes ~half width minus gap
                  ...(isTablet && { flex: 1, minWidth: '45%' }),
                })}
              >
                <View style={{
                  width: 42, height: 42, borderRadius: 13,
                  backgroundColor: 'rgba(126,211,33,0.10)',
                  borderWidth: 1, borderColor: 'rgba(126,211,33,0.25)',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Feather name={item.icon} size={17} color={ACCENT} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: TEXT, fontSize: 13 * scale, fontWeight: '600' }}>{item.title}</Text>
                  <Text style={{ color: TEXT_SUB, fontSize: 11 * scale, marginTop: 3 }}>{item.sub}</Text>
                </View>

                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: '#2A2A2A',
                  borderWidth: 1, borderColor: '#242B24',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Feather name="chevron-right" size={13} color={ICON_STROKE} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}
