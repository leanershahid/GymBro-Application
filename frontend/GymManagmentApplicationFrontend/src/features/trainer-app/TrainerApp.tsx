import React, { useState } from 'react';
import { View, Pressable, Text, Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ModuleAccessProvider, useModuleAccess } from '../module-access/context/ModuleAccessContext';
import TrainerHomeScreen    from './screens/TrainerHomeScreen';
import ClientsScreen        from './screens/ClientsScreen';
import ProgramBuilderScreen from './screens/ProgramBuilderScreen';
import TrainerProfileScreen from './screens/TrainerProfileScreen';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

type Screen =
  | { id: 'home'    }
  | { id: 'clients' }
  | { id: 'builder' }
  | { id: 'profile' }
  | { id: 'client'; clientId: number };

// moduleKey undefined => always visible, not gated
const TABS: { key: string; icon: FeatherIconName; label: string; moduleKey?: string }[] = [
  { key: 'home',    icon: 'home',     label: 'Today'    },
  { key: 'clients', icon: 'users',    label: 'Clients'  },
  { key: 'builder', icon: 'activity', label: 'Programs', moduleKey: 'workouts' },
  { key: 'profile', icon: 'user',     label: 'Profile'  },
];

interface Props {
  trainerId: number;
  onLogout: () => void;
}

export default function TrainerApp({ trainerId, onLogout }: Props) {
  return (
    <ModuleAccessProvider userId={trainerId}>
      <TrainerAppContent trainerId={trainerId} onLogout={onLogout} />
    </ModuleAccessProvider>
  );
}

function TrainerAppContent({ trainerId, onLogout }: Props) {
  const [screen,    setScreen]    = useState<Screen>({ id: 'home' });
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
    if (['home', 'clients', 'builder', 'profile', 'performance'].includes(target)) {
      const mapped = target === 'performance' ? 'profile' : target;
      goTo(mapped);
      return;
    }
  };

  // Full-screen sub-routes (no tab bar)
  if (screen.id === 'client') {
    return (
      <ClientsScreen
        trainerId={trainerId}
        onBack={() => { setScreen({ id: 'clients' }); setActiveTab('clients'); }}
      />
    );
  }
  if (screen.id === 'builder' && !canWorkouts) {
    setScreen({ id: 'home' });
    setActiveTab('home');
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0F0A' }}>
      <View style={{ flex: 1 }}>
        {screen.id === 'home' && (
          <TrainerHomeScreen trainerId={trainerId} onNavigate={navigateFrom} />
        )}
        {screen.id === 'clients' && (
          <ClientsScreen trainerId={trainerId} />
        )}
        {screen.id === 'builder' && (
          <ProgramBuilderScreen trainerId={trainerId} />
        )}
        {screen.id === 'profile' && (
          <TrainerProfileScreen trainerId={trainerId} onLogout={onLogout} />
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
              <View style={[S.tabIcon, active && S.tabIconActive]}>
                <Feather name={tab.icon} size={20} color={active ? '#7ED321' : '#666666'} />
              </View>
              <Text style={[S.tabLabel, active && S.tabLabelActive]}>{tab.label}</Text>
              {active && <View style={S.activeDot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  tabBar: {
    flexDirection:    'row',
    backgroundColor:  '#111111',
    borderTopWidth:   1,
    borderTopColor:   '#151915',
    paddingBottom:    Platform.OS === 'ios' ? 24 : 8,
    paddingTop:       10,
    paddingHorizontal:8,
  },
  tabItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  tabIcon: {
    width: 42, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: 'rgba(126,211,33,0.10)',
  },
  tabLabel: {
    fontSize: 10, fontWeight: '600', color: '#666666',
  },
  tabLabelActive: {
    color: '#7ED321',
  },
  activeDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: '#7ED321', marginTop: 1,
  },
});
