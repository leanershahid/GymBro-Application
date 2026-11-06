import React, { useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { useMyTrainerProfileId } from './api/trainerAppQueries';
import { useLanding, useMenu } from '../access/context/AccessContext';
import NoAccessScreen from '../access/components/NoAccessScreen';
import { OpenRequest, ShellHosted } from '../access/types/access.types';
import { useOpenRequest, useReportLocation } from '../../navigation/useAreaRoute';
import { TrainerRoute, trainerModuleOf, trainerRouteFromPath, trainerRouteToPath } from './trainerRoutes';
import TrainerHomeScreen    from './screens/TrainerHomeScreen';
import ClientsScreen        from './screens/ClientsScreen';
import ProgramBuilderScreen from './screens/ProgramBuilderScreen';
import TrainerProfileScreen from './screens/TrainerProfileScreen';
import SecuritySettingsScreen from '../auth/screens/SecuritySettingsScreen';
import { SupportQueuePage, SupportRequestPage } from '../support/routes';
import { ReportProblemScreen } from '../facilities/routes';
import { MessagesScreen, MessageThreadScreen, isMessagingRouteId } from '../messaging/routes';
import ClassSchedulePage    from '../classes/pages/ClassSchedulePage';
import PtSessionsPage       from '../classes/pages/PtSessionsPage';
import { T } from '../../theme';
import LoadingState from '../common/components/LoadingState';
import Screen from '../common/components/Screen';

type Route = TrainerRoute;

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
  const landingId = useLanding('home', 'profile');
  const landing: Route = trainerRouteFromPath([landingId]) ?? { id: 'profile' };

  // A path from the shell (tab, Back, URL): unknown paths open the landing screen.
  const resolve = (o: OpenRequest | undefined): Route => (o && trainerRouteFromPath(o.path)) || landing;
  const [screen, setScreen] = useState<Route>(() => resolve(open));
  useOpenRequest(open, () => setScreen(resolve(open)));
  useReportLocation({ path: trainerRouteToPath(screen), module: trainerModuleOf(screen) }, open, onRouteChange);

  // One client's page belongs to Clients; profile is always there.
  const canOpen = (id: Route['id']) =>
    id === 'profile' || id === 'security' || id === 'support' || id === 'support-request' || id === 'report-problem' || isMessagingRouteId(id) || routes.has(id) || (id === 'client' && routes.has('clients'));

  const navigateFrom = (target: string) => {
    if (target.startsWith('client-')) {
      const cid = parseInt(target.replace('client-', ''), 10);
      setScreen({ id: 'client', clientId: cid });
      return;
    }
    const r = trainerRouteFromPath([target === 'performance' ? 'profile' : target]);
    if (r && canOpen(r.id)) setScreen(r);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ flex: 1 }}>
        {!canOpen(screen.id) && <NoAccessScreen onBack={() => setScreen(landing)} />}
        {canOpen(screen.id) && (<>
          {screen.id === 'home' && (
            <TrainerHomeScreen trainerId={trainerId} onNavigate={navigateFrom} />
          )}
          {screen.id === 'clients' && (
            <ClientsScreen trainerId={trainerId} onOpenThread={(conversationId) => setScreen({ id: 'message-thread', conversationId })} />
          )}
          {screen.id === 'client' && (
            <ClientsScreen
              trainerId={trainerId}
              initialClientId={screen.clientId}
              onOpenThread={(conversationId) => setScreen({ id: 'message-thread', conversationId })}
              onBack={() => setScreen({ id: 'clients' })}
            />
          )}
          {screen.id === 'builder' && (
            <ProgramBuilderScreen trainerId={trainerId} />
          )}
          {screen.id === 'classes' && <ClassSchedulePage mode="trainer" />}
          {screen.id === 'sessions' && <PtSessionsPage mode="trainer" />}
          {screen.id === 'profile' && (
            <TrainerProfileScreen trainerId={trainerId} onLogout={onLogout} onReportProblem={() => setScreen({ id: 'report-problem' })} />
          )}
          {screen.id === 'security' && (
            <SecuritySettingsScreen onBack={() => setScreen({ id: 'profile' })} />
          )}
          {screen.id === 'report-problem' && <ReportProblemScreen onBack={() => setScreen({ id: 'profile' })} />}
          {screen.id === 'support' && (
            <SupportQueuePage mode="trainer" onBack={() => setScreen(landing)} onOpen={(requestId) => setScreen({ id: 'support-request', requestId })} />
          )}
          {screen.id === 'support-request' && (
            <SupportRequestPage mode="trainer" requestId={screen.requestId} onBack={() => setScreen({ id: 'support' })} />
          )}
          {screen.id === 'messages' && (
            <MessagesScreen side="trainer" onBack={() => setScreen(landing)} onOpen={(conversationId) => setScreen({ id: 'message-thread', conversationId })} />
          )}
          {screen.id === 'message-thread' && (
            <MessageThreadScreen conversationId={screen.conversationId} onBack={() => setScreen({ id: 'messages' })} />
          )}
        </>)}
      </View>
    </View>
  );
}
