import React, { useState } from 'react';
import { View, Pressable, Text, Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '../trainers/components/theme';
import { ModuleAccessProvider, useModuleAccess } from '../module-access/context/ModuleAccessContext';
import HomeScreen          from './screens/HomeScreen';
import TrainScreen         from './screens/TrainScreen';
import PlansScreen         from './screens/PlansScreen';
import ProfileScreen       from './screens/ProfileScreen';
import WorkoutDetailScreen from './screens/WorkoutDetailScreen';
import CommunityScreen     from './screens/CommunityScreen';
import StatsScreen         from './screens/StatsScreen';
import ProgressScreen      from './screens/ProgressScreen';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

type Screen =
  | { id: 'home'      }
  | { id: 'community' }
  | { id: 'stats'     }
  | { id: 'progress'  }
  | { id: 'profile'   }
  | { id: 'train'     }
  | { id: 'plans'     }
  | { id: 'workout'; workoutId: number };

// moduleKey undefined => always visible, not gated (Home / Profile)
const TABS: { key: string; icon: FeatherIconName; label: string; moduleKey?: string }[] = [
  { key: 'home',      icon: 'home',        label: 'Home'      },
  { key: 'community',  icon: 'users',       label: 'Community', moduleKey: 'community' },
  { key: 'stats',      icon: 'bar-chart-2', label: 'Stats',      moduleKey: 'stats'     },
  { key: 'progress',   icon: 'trending-up', label: 'Progress',   moduleKey: 'plans'     },
  { key: 'profile',    icon: 'user',        label: 'Profile'   },
];

interface Props {
  userId: number;
  onLogout: () => void;
}

export default function MemberApp({ userId, onLogout }: Props) {
  return (
    <ModuleAccessProvider userId={userId}>
      <MemberAppContent userId={userId} onLogout={onLogout} />
    </ModuleAccessProvider>
  );
}

function MemberAppContent({ userId, onLogout }: Props) {
  const [screen, setScreen]   = useState<Screen>({ id: 'home' });
  const [activeTab, setActiveTab] = useState('home');

  const canWorkouts     = useModuleAccess('workouts');
  const canChallenges   = useModuleAccess('challenges');
  const canLiveCoaching = useModuleAccess('live-coaching');
  const canStats        = useModuleAccess('stats');
  const canPlans        = useModuleAccess('plans');
  // "community" isn't a real Module key — the tab is a group covering two split modules.
  const access: Record<string, boolean> = {
    community: canChallenges || canLiveCoaching,
    stats: canStats,
    plans: canPlans,
  };
  const visibleTabs = TABS.filter(t => !t.moduleKey || access[t.moduleKey]);

  const goTo = (id: string) => {
    setActiveTab(id);
    setScreen({ id: id as any });
  };

  const navigateFrom = (target: string) => {
    if (target.startsWith('workout-')) {
      const wid = parseInt(target.replace('workout-', ''), 10);
      setScreen({ id: 'workout', workoutId: wid });
      return;
    }
    if (target === 'train' || target === 'plans') {
      setScreen({ id: target as 'train' | 'plans' });
      return;
    }
    goTo(target);
  };

  // ── Full-screen sub-routes (no tab bar) ──────────────────────
  if (screen.id === 'workout') {
    return (
      <WorkoutDetailScreen
        workoutId={screen.workoutId}
        userId={userId}
        onBack={() => { setScreen({ id: 'train' }); setActiveTab('train'); }}
      />
    );
  }
  if (screen.id === 'train') {
    if (!canWorkouts) { setScreen({ id: 'home' }); return null; }
    return <TrainScreen userId={userId} onOpenWorkout={(id) => setScreen({ id: 'workout', workoutId: id })} />;
  }
  if (screen.id === 'plans') {
    return <PlansScreen onBack={() => { setScreen({ id: 'home' }); setActiveTab('home'); }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* ── Screen content ── */}
      <View style={{ flex: 1 }}>
        {screen.id === 'home' && (
          <HomeScreen userId={userId} onNavigate={navigateFrom} />
        )}
        {screen.id === 'community' && (
          <CommunityScreen userId={userId} />
        )}
        {screen.id === 'stats' && (
          <StatsScreen userId={userId} />
        )}
        {screen.id === 'progress' && (
          <ProgressScreen userId={userId} />
        )}
        {screen.id === 'profile' && (
          <ProfileScreen userId={userId} onLogout={onLogout} />
        )}
      </View>

      {/* ── Bottom tab bar ── */}
      <View style={S.tabBar}>
        {visibleTabs.map(tab => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => goTo(tab.key)}
              hitSlop={8}
              style={S.tabItem}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
            >
              {active ? (
                <LinearGradient
                  colors={T.brandGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={S.tabIconActive}
                >
                  <Feather name={tab.icon} size={19} color={T.onBrand} />
                </LinearGradient>
              ) : (
                <View style={S.tabIcon}>
                  <Feather name={tab.icon} size={19} color={T.textFaint} />
                </View>
              )}
              <Text style={[S.tabLabel, active && S.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  tabBar: {
    flexDirection:   'row',
    backgroundColor: '#111111',
    borderTopWidth:  1,
    borderTopColor:  '#151915',
    paddingBottom:   Platform.OS === 'ios' ? 24 : 8,
    paddingTop:      10,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  tabIconActive: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -14,
    shadowColor: '#7ED321', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666666',
  },
  tabLabelActive: {
    color: '#7ED321',
  },
});
