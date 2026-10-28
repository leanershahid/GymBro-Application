import React, { useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../theme';
import BottomTabBar from '../common/components/BottomTabBar';
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
    // Only real tabs; unknown targets are ignored
    // instead of leaving an empty content area.
    if (TABS.some(t => t.key === target)) goTo(target);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* ── Screen content ── */}
      <View style={{ flex: 1 }}>
        {screen.id === 'workout' && (
          <WorkoutDetailScreen
            workoutId={screen.workoutId}
            userId={userId}
            onBack={() => setScreen({ id: canWorkouts ? 'train' : 'home' })}
          />
        )}
        {screen.id === 'train' && (canWorkouts
          ? <TrainScreen userId={userId} onOpenWorkout={(id) => setScreen({ id: 'workout', workoutId: id })} />
          : <HomeScreen userId={userId} onNavigate={navigateFrom} />)}
        {screen.id === 'plans' && (
          <PlansScreen onBack={() => goTo('home')} />
        )}
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

      {/* ── Bottom tab bar — fixed on every member screen ── */}
      <BottomTabBar tabs={visibleTabs} active={activeTab} onChange={goTo} />
    </View>
  );
}
