import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Exported so sign-out can drop every cached response (no data leaks to the next user).
export const queryClient = new QueryClient();

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
