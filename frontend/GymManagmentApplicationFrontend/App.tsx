import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Asset } from 'expo-asset';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import QueryProvider, { queryClient } from './src/app/providers/QueryProvider';
import { ToastProvider } from './src/features/common/components/Toast';
import { BootSplash } from './src/features/common/components/LogoLoader';
import LoginPage      from './src/features/auth/components/LoginPage';
import AdminDashboard from './src/features/dashboard/pages/AdminDashboard';
import MemberApp      from './src/features/member-app/MemberApp';
import TrainerApp     from './src/features/trainer-app/TrainerApp';
import { configureSessionHandling } from './src/api/axios';
import { isAdminRole, isDelegatedRole } from './src/api/session';
import { applyAuth, clearAuth, currentRefreshToken, loadStoredAuth } from './src/api/authStore';
import { logoutSession, refreshSession } from './src/features/auth/api/authApi';
import { getPreviewRole, startPreview } from './src/dev/previewMode';
import { AccessProvider } from './src/features/access/context/AccessContext';
import { clearStoredAccess } from './src/features/access/api/accessStore';

type AppState =
  | { status: 'unauthenticated'; error?: string }
  | { status: 'admin';   userId: number }
  | { status: 'member';  userId: number }
  | { status: 'trainer'; userId: number };

// Images the first screen needs; the boot splash stays up until they're ready.
const BOOT_ASSETS = [
  require('./src/assets/loginImages/image02.jpg'),
  require('./src/assets/common/logo01.png'),
];

/** Swaps the refresh token for a new session; false when it's missing, expired or revoked. */
async function renewSession(token: string | null): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await refreshSession(token);
    if (!res.success || !res.data) return false;
    await applyAuth(res.data);
    return true;
  } catch {
    return false;
  }
}

export default function App() {
  // Dev-only design preview (?preview=admin|trainer|member on web) — see src/dev/previewMode.ts.
  const [appState, setAppState] = useState<AppState>(() => {
    const preview = getPreviewRole();
    if (!preview) return { status: 'unauthenticated' };
    const userId = startPreview(preview);
    return preview === 'member' ? { status: 'member', userId }
         : preview === 'trainer' ? { status: 'trainer', userId }
         : { status: 'admin', userId };
  });

  const [booting, setBooting] = useState(true);

  const routeFor = (role: string, userId: number): AppState =>
    isAdminRole(role) || isDelegatedRole(role) ? { status: 'admin', userId }
    : role === 'client'  ? { status: 'member',  userId }
    : role === 'trainer' ? { status: 'trainer', userId }
    : { status: 'unauthenticated', error: `Unsupported account role "${role}". Please contact your administrator.` };

  // Ends the session locally: token, persisted refresh token and every cached response.
  const endSession = useCallback(async (error?: string) => {
    await Promise.all([clearAuth(), clearStoredAccess()]);
    queryClient.clear();
    setAppState({ status: 'unauthenticated', error });
  }, []);

  useEffect(() => {
    configureSessionHandling(
      () => renewSession(currentRefreshToken()),
      () => { void endSession('Your session has expired. Please sign in again.'); },
    );

    // Start-up: preload first-screen images and restore a saved sign-in, behind the splash.
    // A failed preload just means the image loads on demand — never block the app on it.
    const preload = Asset.loadAsync(BOOT_ASSETS).catch(() => {});
    const restore = (async () => {
      const stored = await loadStoredAuth();
      if (!stored) return;
      if (await renewSession(stored.refreshToken)) {
        setAppState(current => current.status === 'unauthenticated'
          ? routeFor(stored.session.role, stored.session.userId) : current);
      } else {
        await clearAuth();
      }
    })();
    Promise.all([preload, restore]).finally(() => setBooting(false));
  }, [endSession]);

  const handleLoginSuccess = (role: string, userId: number) => {
    // Admins, super admins, staff and custom roles get the admin app; trainers and members
    // their own. Every app builds its menus from the user's access list (AccessProvider),
    // and the backend checks the same grants on every request.
    setAppState(routeFor(role, userId));
  };

  const logout = async () => {
    // Revoke this device's refresh token server-side (best effort, max ~2s), then clear locally.
    await Promise.race([
      logoutSession(currentRefreshToken()).catch(() => {}),
      new Promise(resolve => setTimeout(resolve, 2000)),
    ]);
    await endSession();
  };

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <ToastProvider>
          <View style={{ flex: 1 }}>
            {appState.status === 'unauthenticated' && (
              <LoginPage onLoginSuccess={handleLoginSuccess} errorMessage={appState.error} />
            )}
            {appState.status !== 'unauthenticated' && (
              // Keyed by user, so a different account never sees the previous one's menu.
              <AccessProvider key={appState.userId} userId={appState.userId} onLogout={logout}>
                {appState.status === 'admin' && <AdminDashboard onLogout={logout} />}
                {appState.status === 'member' && <MemberApp userId={appState.userId} onLogout={logout} />}
                {appState.status === 'trainer' && <TrainerApp userId={appState.userId} onLogout={logout} />}
              </AccessProvider>
            )}
          </View>
          <BootSplash loading={booting} />
        </ToastProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
