import { useCallback } from 'react';
import { DashboardData } from '../types/dashboard';
import { useDashboardOverview } from '../api/dashboardQueries';

interface UseDashboardStatsResult {
  data: DashboardData | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

/** `enabled` false skips the request — for users who aren't granted the dashboard. */
export function useDashboardStats(enabled = true): UseDashboardStatsResult {
  const { data, isLoading, isRefetching, error, refetch } = useDashboardOverview(enabled);

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    data: data ?? null,
    loading: isLoading,
    refreshing: isRefetching,
    error: error ? (error as Error).message : null,
    refresh,
  };
}
