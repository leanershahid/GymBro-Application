import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Asset } from 'expo-asset';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import QueryProvider  from './src/app/providers/QueryProvider';
import { ToastProvider } from './src/features/common/components/Toast';
import { BootSplash } from './src/features/common/components/LogoLoader';
import LoginPage      from './src/features/auth/components/LoginPage';
import AdminDashboard from './src/features/dashboard/pages/AdminDashboard';
import MemberApp      from './src/features/member-app/MemberApp';
import TrainerApp     from './src/features/trainer-app/TrainerApp';
import { setAuthToken } from './src/api/axios';
import { setSession, isAdminRole, isDelegatedRole } from './src/api/session';

type AppState =
  | { status: 'unauthenticated'; error?: string }
  | { status: 'admin' }
  | { status: 'member';  userId: number }
  | { status: 'trainer'; userId: number };

// Images the first screen needs; the boot splash stays up until they're ready.
const BOOT_ASSETS = [
  require('./src/assets/loginImages/image02.jpg'),
  require('./src/assets/common/logo01.png'),
];

export default function App() {
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    // A failed preload just means the image loads on demand — never block the app on it.
    Asset.loadAsync(BOOT_ASSETS).catch(() => {}).finally(() => setBooting(false));
  }, []);

  const [appState, setAppState] = useState<AppState>({ status: 'unauthenticated' });

  const handleLoginSuccess = (role: string, userId: number) => {
    // Admins and super admins get the full admin app. 'staff' and custom roles get the
    // same app, but AdminDashboard only shows the modules the role/module matrix grants
    // them — and the backend enforces that matrix on every request.
    if (isAdminRole(role) || isDelegatedRole(role)) setAppState({ status: 'admin' });
    else if (role === 'client')  setAppState({ status: 'member',  userId });
    else if (role === 'trainer') setAppState({ status: 'trainer', userId });
    else setAppState({ status: 'unauthenticated', error: `Unsupported account role "${role}". Please contact your administrator.` });
  };

  const logout = () => {
    setAuthToken(null);
    setSession(null);
    setAppState({ status: 'unauthenticated' });
  };

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <ToastProvider>
          <View style={{ flex: 1 }}>
            {appState.status === 'unauthenticated' && (
              <LoginPage onLoginSuccess={handleLoginSuccess} errorMessage={appState.error} />
            )}
            {appState.status === 'admin' && (
              <AdminDashboard onLogout={logout} />
            )}
            {appState.status === 'member' && (
              <MemberApp
                userId={appState.userId}
                onLogout={logout}
              />
            )}
            {appState.status === 'trainer' && (
              <TrainerApp
                userId={appState.userId}
                onLogout={logout}
              />
            )}
          </View>
          <BootSplash loading={booting} />
        </ToastProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
