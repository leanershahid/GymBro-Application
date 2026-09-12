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

export function useDashboardStats(): UseDashboardStatsResult {
  const { data, isLoading, isRefetching, error, refetch } = useDashboardOverview();

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
