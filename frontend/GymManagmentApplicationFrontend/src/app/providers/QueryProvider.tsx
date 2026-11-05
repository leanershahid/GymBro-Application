import React, { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';

/**
 * App-wide data defaults. The API is a round trip away (0.5 s+ before the database is even touched), so
 * the biggest speed-up is asking less often:
 *  - data stays fresh for a minute, so switching tabs/screens shows cached data instantly instead of
 *    refetching every time (React Query's default is "stale immediately");
 *  - cached data is kept 10 minutes for going back to a screen;
 *  - no refetch just because the window regained focus (queries that need live data set their own interval);
 *  - failed requests retry once, and never when the server answered 4xx (retrying a 403/404/422 can't help
 *    and used to add ~7 s of back-off before the error showed).
 * A query can still override any of these with its own staleTime / refetch options.
 *
 * Focus on phones (ARCH-121): React Query only knows about browser focus, so on iOS/Android the
 * provider maps AppState "active" onto focusManager. Queries that opt into refetchOnWindowFocus
 * (e.g. the access list) then refetch when the app returns to the foreground, like a web tab.
 * Online state: the web uses the browser's online/offline events (React Query default). Native
 * would need @react-native-community/netinfo wired into onlineManager — not installed yet.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } } | null)?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    },
    mutations: { retry: false },
  },
});

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
}

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
