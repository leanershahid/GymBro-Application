import React, { useState } from 'react';
import { View } from 'react-native';
import { T } from '../../theme';
import BottomTabBar, { TabItem } from '../common/components/BottomTabBar';
import { useLanding, useMenu } from '../access/context/AccessContext';
import { MORE_TAB, MoreMenuScreen, useRailTabs } from '../access/components/railTabs';
import NoAccessScreen      from '../access/components/NoAccessScreen';
import HomeScreen          from './screens/HomeScreen';
import TrainScreen         from './screens/TrainScreen';
import PlansScreen         from './screens/PlansScreen';
import ProfileScreen       from './screens/ProfileScreen';
import WorkoutDetailScreen from './screens/WorkoutDetailScreen';
import CommunityScreen     from './screens/CommunityScreen';
import StatsScreen         from './screens/StatsScreen';
import ProgressScreen      from './screens/ProgressScreen';
import MyBillingScreen     from '../member-billing/screens/MyBillingScreen';
import BookScreen          from '../member-booking/screens/BookScreen';

type Screen =
  | { id: 'home'      }
  | { id: 'community' }
  | { id: 'stats'     }
  | { id: 'progress'  }
  | { id: 'profile'   }
  | { id: 'train'     }
  | { id: 'plans'; planId?: number }
  | { id: 'billing'   }
  | { id: 'book'      }
  | { id: typeof MORE_TAB }
  // `from` is the screen Back returns to (defaults to Train, or the landing screen without it)
  | { id: 'workout'; workoutId: number; from?: Screen };

// Always on, whatever the access list says — so there is always a way to sign out.
const ALWAYS_TABS: TabItem[] = [{ key: 'profile', label: 'Profile', icon: 'user' }];

interface Props {
  userId: number;
  onLogout: () => void;
}

/** The member app. Its tabs and the screens it will open come from the access list (AccessProvider). */
export default function MemberApp({ userId, onLogout }: Props) {
  const { routes } = useMenu();
  const { tabs, overflow } = useRailTabs(ALWAYS_TABS);
  const landing = useLanding('home', 'profile') as Screen['id'];

  const [screen, setScreen]       = useState<Screen>({ id: landing } as Screen);
  const [activeTab, setActiveTab] = useState<string>(landing);

  // A workout opens from Train or from a plan day; profile and the More list are always there.
  const canOpen = (id: Screen['id']) =>
    id === 'profile' || id === MORE_TAB || routes.has(id) ||
    (id === 'workout' && (routes.has('train') || routes.has('plans')));

  const goTo = (id: string) => {
    setActiveTab(tabs.some(t => t.key === id) ? id : MORE_TAB);
    setScreen({ id: id as any });
  };
  const goLanding = () => goTo(landing);
  const openBilling = canOpen('billing') ? () => setScreen({ id: 'billing' }) : undefined;

  const navigateFrom = (target: string) => {
    if (target.startsWith('workout-')) {
      const wid = parseInt(target.replace('workout-', ''), 10);
      setScreen({ id: 'workout', workoutId: wid, from: screen });
      return;
    }
    if (target === 'train' || target === 'plans' || target === 'billing') {
      setScreen({ id: target });
      return;
    }
    // Only granted screens; unknown targets are ignored
    // instead of leaving an empty content area.
    if (routes.has(target)) goTo(target);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* ── Screen content ── */}
      <View style={{ flex: 1 }}>
        {!canOpen(screen.id) && <NoAccessScreen onBack={goLanding} />}
        {canOpen(screen.id) && (<>
          {screen.id === 'workout' && (
            <WorkoutDetailScreen
              workoutId={screen.workoutId}
              userId={userId}
              onBack={() => setScreen(screen.from ?? (routes.has('train') ? { id: 'train' } : { id: landing } as Screen))}
            />
          )}
          {screen.id === 'train' && (
            <TrainScreen userId={userId} onOpenWorkout={(id) => setScreen({ id: 'workout', workoutId: id })} />
          )}
          {screen.id === 'plans' && (
            <PlansScreen
              userId={userId}
              initialPlanId={screen.planId}
              onBack={goLanding}
              onOpenWorkout={(id, planId) => setScreen({ id: 'workout', workoutId: id, from: { id: 'plans', planId } })}
            />
          )}
          {screen.id === 'book' && (
            <BookScreen userId={userId} onOpenBilling={openBilling} />
          )}
          {screen.id === 'billing' && (
            <MyBillingScreen userId={userId} onBack={goLanding} />
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
            <ProgressScreen userId={userId} onOpenPlans={canOpen('plans') ? () => setScreen({ id: 'plans' }) : undefined} />
          )}
          {screen.id === 'profile' && (
            <ProfileScreen userId={userId} onLogout={onLogout} onOpenBilling={openBilling} />
          )}
          {screen.id === MORE_TAB && <MoreMenuScreen items={overflow} onOpen={goTo} />}
        </>)}
      </View>

      {/* ── Bottom tab bar — fixed on every member screen ── */}
      <BottomTabBar tabs={tabs} active={activeTab} onChange={goTo} />
    </View>
  );
}
