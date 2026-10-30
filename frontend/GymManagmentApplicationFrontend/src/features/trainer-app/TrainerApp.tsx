import React, { useEffect, useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { useMyTrainerProfileId } from './api/trainerAppQueries';
import { useLanding, useMenu } from '../access/context/AccessContext';
import NoAccessScreen from '../access/components/NoAccessScreen';
import { ShellHosted } from '../access/types/access.types';
import TrainerHomeScreen    from './screens/TrainerHomeScreen';
import ClientsScreen        from './screens/ClientsScreen';
import ProgramBuilderScreen from './screens/ProgramBuilderScreen';
import TrainerProfileScreen from './screens/TrainerProfileScreen';
import ClassSchedulePage    from '../classes/pages/ClassSchedulePage';
import PtSessionsPage       from '../classes/pages/PtSessionsPage';
import { T } from '../../theme';
import LoadingState from '../common/components/LoadingState';
import Screen from '../common/components/Screen';

type Route =
  | { id: 'home'    }
  | { id: 'clients' }
  | { id: 'builder' }
  | { id: 'profile' }
  | { id: 'classes' }
  | { id: 'sessions' }
  | { id: 'client'; clientId: number };

interface Props extends ShellHosted {
  trainerId: number;
  onLogout: () => void;
}

// Every /trainers/{id} endpoint needs the TrainerProfile id, resolved via /trainers/me; the
// login account's access list comes from AccessProvider (App.tsx).
export default function TrainerApp({ onLogout, open, onRouteChange }: { userId: number; onLogout: () => void } & ShellHosted) {
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

  return <TrainerAppContent trainerId={trainerId} onLogout={onLogout} open={open} onRouteChange={onRouteChange} />;
}

/** The trainer screens, hosted by the app shell; which screens open comes from the access list. */
function TrainerAppContent({ trainerId, onLogout, open, onRouteChange }: Props) {
  const { routes } = useMenu();
  const landing = useLanding('home', 'profile') as Route['id'];

  const [screen, setScreen] = useState<Route>({ id: (open?.route ?? landing) } as Route);

  // One client's page belongs to Clients; profile is always there.
  const canOpen = (id: Route['id']) =>
    id === 'profile' || routes.has(id) || (id === 'client' && routes.has('clients'));

  const goTo = (id: string) => setScreen({ id: id as any });

  useEffect(() => { if (open) goTo(open.route); }, [open]);
  useEffect(() => { onRouteChange?.(screen.id); }, [screen.id]);

  const navigateFrom = (target: string) => {
    if (target.startsWith('client-')) {
      const cid = parseInt(target.replace('client-', ''), 10);
      setScreen({ id: 'client', clientId: cid });
      return;
    }
    const mapped = target === 'performance' ? 'profile' : target;
    if (canOpen(mapped as Route['id'])) goTo(mapped);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ flex: 1 }}>
        {!canOpen(screen.id) && <NoAccessScreen onBack={() => goTo(landing)} />}
        {canOpen(screen.id) && (<>
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
        </>)}
      </View>
    </View>
  );
}
