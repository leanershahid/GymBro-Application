import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
