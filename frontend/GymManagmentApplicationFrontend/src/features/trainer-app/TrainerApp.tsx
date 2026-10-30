import React, { useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { useMyTrainerProfileId } from './api/trainerAppQueries';
import { Feather } from '@expo/vector-icons';
import { ModuleAccessProvider, useModuleAccess } from '../module-access/context/ModuleAccessContext';
import TrainerHomeScreen    from './screens/TrainerHomeScreen';
import ClientsScreen        from './screens/ClientsScreen';
import ProgramBuilderScreen from './screens/ProgramBuilderScreen';
import TrainerProfileScreen from './screens/TrainerProfileScreen';
import ClassSchedulePage    from '../classes/pages/ClassSchedulePage';
import PtSessionsPage       from '../classes/pages/PtSessionsPage';
import { T } from '../../theme';
import BottomTabBar from '../common/components/BottomTabBar';
import LoadingState from '../common/components/LoadingState';
import Screen from '../common/components/Screen';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

type Route =
  | { id: 'home'    }
  | { id: 'clients' }
  | { id: 'builder' }
  | { id: 'profile' }
  | { id: 'classes' }
  | { id: 'sessions' }
  | { id: 'client'; clientId: number };

// moduleKey undefined => always visible, not gated
const TABS: { key: string; icon: FeatherIconName; label: string; moduleKey?: string }[] = [
  { key: 'home',     icon: 'home',     label: 'Today'    },
  { key: 'clients',  icon: 'users',    label: 'Clients'  },
  { key: 'sessions', icon: 'clock',    label: 'PT'       },
  { key: 'classes',  icon: 'calendar', label: 'Classes'  },
  { key: 'builder',  icon: 'activity', label: 'Programs', moduleKey: 'workouts' },
  { key: 'profile',  icon: 'user',     label: 'Profile'  },
];

interface Props {
  trainerId: number;
  onLogout: () => void;
}

// `userId` is the login account; per-user module toggles are keyed by it, while every
// /trainers/{id} endpoint needs the TrainerProfile id, resolved via /trainers/me.
export default function TrainerApp({ userId, onLogout }: { userId: number; onLogout: () => void }) {
  const { data: trainerId = 0, isLoading, isError } = useMyTrainerProfileId();

  if (isLoading) {
    return <LoadingState fullScreen label="Loading your profile" />;
  }
  if (isError || trainerId === 0) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text style={{ color: T.text, textAlign: 'center' }}>
          This account has no trainer profile yet. Ask your gym admin to finish setting it up.
        </Text>
        <Pressable
          onPress={onLogout}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}
        >
          <Text style={{ color: T.brand, fontWeight: '600' }}>Sign out</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <ModuleAccessProvider userId={userId}>
      <TrainerAppContent trainerId={trainerId} onLogout={onLogout} />
    </ModuleAccessProvider>
  );
}

function TrainerAppContent({ trainerId, onLogout }: Props) {
  const [screen,    setScreen]    = useState<Route>({ id: 'home' });
  const [activeTab, setActiveTab] = useState('home');

  const canWorkouts = useModuleAccess('workouts');
  const visibleTabs = TABS.filter(t => !t.moduleKey || canWorkouts);

  const goTo = (id: string) => {
    setActiveTab(id);
    setScreen({ id: id as any });
  };

  const navigateFrom = (target: string) => {
    if (target.startsWith('client-')) {
      const cid = parseInt(target.replace('client-', ''), 10);
      setScreen({ id: 'client', clientId: cid });
      return;
    }
    if (['home', 'clients', 'builder', 'profile', 'performance', 'classes', 'sessions'].includes(target)) {
      const mapped = target === 'performance' ? 'profile' : target;
      goTo(mapped);
      return;
    }
  };

  if (screen.id === 'builder' && !canWorkouts) {
    setScreen({ id: 'home' });
    setActiveTab('home');
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ flex: 1 }}>
        {screen.id === 'home' && (
          <TrainerHomeScreen trainerId={trainerId} onNavigate={navigateFrom} />
        )}
        {screen.id === 'clients' && (
          <ClientsScreen trainerId={trainerId} />
        )}
        {screen.id === 'client' && (
          <ClientsScreen
            trainerId={trainerId}
            initialClientId={screen.clientId}
            onBack={() => goTo('clients')}
          />
        )}
        {screen.id === 'builder' && (
          <ProgramBuilderScreen trainerId={trainerId} />
        )}
        {screen.id === 'classes' && <ClassSchedulePage mode="trainer" />}
        {screen.id === 'sessions' && <PtSessionsPage mode="trainer" />}
        {screen.id === 'profile' && (
          <TrainerProfileScreen trainerId={trainerId} onLogout={onLogout} />
        )}
      </View>

      {/* ── Bottom tab bar ── */}
      <BottomTabBar tabs={visibleTabs} active={activeTab} onChange={goTo} />
    </View>
  );
}
