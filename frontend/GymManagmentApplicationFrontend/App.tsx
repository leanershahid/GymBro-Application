import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import QueryProvider  from './src/app/providers/QueryProvider';
import LoginPage      from './src/features/auth/components/LoginPage';
import AdminDashboard from './src/features/dashboard/pages/AdminDashboard';
import MemberApp      from './src/features/member-app/MemberApp';
import TrainerApp     from './src/features/trainer-app/TrainerApp';

type AppState =
  | { status: 'unauthenticated'; error?: string }
  | { status: 'admin' }
  | { status: 'member';  userId: number }
  | { status: 'trainer'; userId: number };

export default function App() {
  const [appState, setAppState] = useState<AppState>({ status: 'unauthenticated' });

  const handleLoginSuccess = (role: string, userId: number) => {
    // Only known roles get routed to their app — an unrecognized role (e.g. the
    // unimplemented 'staff' role) must never silently fall through to the admin
    // dashboard, which would grant it full platform access.
    if (role === 'admin')        setAppState({ status: 'admin' });
    else if (role === 'client')  setAppState({ status: 'member',  userId });
    else if (role === 'trainer') setAppState({ status: 'trainer', userId });
    else setAppState({ status: 'unauthenticated', error: `Unsupported account role "${role}". Please contact your administrator.` });
  };

  return (
    <SafeAreaProvider>
      <QueryProvider>
        {appState.status === 'unauthenticated' && (
          <LoginPage onLoginSuccess={handleLoginSuccess} errorMessage={appState.error} />
        )}
        {appState.status === 'admin' && (
          <AdminDashboard />
        )}
        {appState.status === 'member' && (
          <MemberApp
            userId={appState.userId}
            onLogout={() => setAppState({ status: 'unauthenticated' })}
          />
        )}
        {appState.status === 'trainer' && (
          <TrainerApp
            trainerId={appState.userId}
            onLogout={() => setAppState({ status: 'unauthenticated' })}
          />
        )}
      </QueryProvider>
    </SafeAreaProvider>
  );
}
